# Git Service — Implementation Reference

This document describes the complete implementation of the Git repository management service in cockpit-ng. It is intended for developers porting this code to a new application. Reading this document alone should be sufficient to reproduce the feature.

---

## Table of Contents

1. [Overview](#overview)
2. [Directory Structure](#directory-structure)
3. [Database Model](#database-model)
4. [Pydantic Models (Request / Response)](#pydantic-models)
5. [Repository Layer](#repository-layer)
6. [Service Layer](#service-layer)
7. [REST API Endpoints](#rest-api-endpoints)
8. [Authentication Mechanisms](#authentication-mechanisms)
9. [External Dependencies](#external-dependencies)
10. [Internal Dependencies (Coupling to Host App)](#internal-dependencies)
11. [Wiring: service_factory, dependencies, main.py](#wiring)
12. [Porting Checklist](#porting-checklist)

---

## Overview

The Git service provides:

- CRUD management of Git repository configurations (stored in PostgreSQL).
- Sync operations: clone a remote repo to disk, pull updates, force-reclone.
- Version control queries: list branches, list commits per branch, diff two commits.
- File browsing: directory tree, file content, file history, CSV file listing.
- Connection testing: shallow-clone against a remote URL to validate credentials.
- Debug endpoints: test read/write/delete/push access on a live repository.

Repositories are stored as configuration records (URL, branch, credentials reference, category, etc.) in the `git_repositories` PostgreSQL table. The actual git content lives on disk under `{DATA_DIR}/git/{path_or_name}/`.

Credentials (SSH keys, tokens, passwords) are **never stored inline** on the repository record. They are stored separately in the credentials system and referenced by name via `credential_name`.

---

## Directory Structure

```
backend/
├── core/models/git.py                          # SQLAlchemy ORM model
├── models/git_repositories.py                  # Pydantic request/response models
├── models/git.py                               # Additional Pydantic models (GitCommit, SyncResult, etc.)
├── repositories/git/
│   └── git_repository_repository.py            # Data access layer (CRUD on git_repositories table)
├── services/git/
│   ├── __init__.py
│   ├── service.py                              # GitService: core git ops (clone, pull, push, commit)
│   ├── repository_service.py                   # GitRepositoryService: DB record CRUD
│   ├── operations.py                           # GitOperationsService: sync/status workflows
│   ├── auth.py                                 # GitAuthenticationService: credential resolution + auth env
│   ├── connection.py                           # GitConnectionService: connection testing via shallow clone
│   ├── cache.py                                # GitCacheService: Redis caching for commits/file history
│   ├── diff.py                                 # GitDiffService: unified diff, line-by-line comparison
│   ├── file_service.py                         # GitFileService: file browse, content, history, CSV ops
│   ├── config.py                               # set_git_author() context manager
│   ├── env.py                                  # set_ssl_env() context manager
│   ├── paths.py                                # repo_path() — resolves on-disk path for a repository
│   └── shared_utils.py                         # Module-level git_repo_manager singleton + helpers
└── routers/git/
    ├── __init__.py                             # Exports `router` (the combined router)
    ├── main.py                                 # Combines all 5 sub-routers into one APIRouter
    ├── repositories.py                         # CRUD endpoints: /api/git-repositories/
    ├── operations.py                           # Sync/status: /api/git/{repo_id}/
    ├── version_control.py                      # Branches/commits/diff: /api/git/{repo_id}/
    ├── files.py                                # File ops: /api/git/{repo_id}/
    └── debug.py                                # Debug tests: /api/git-repositories/{repo_id}/debug/
```

---

## Database Model

**File:** `backend/core/models/git.py`

```python
class GitRepository(Base):
    __tablename__ = "git_repositories"

    id             = Column(Integer, primary_key=True, index=True)
    name           = Column(String(255), unique=True, nullable=False)
    category       = Column(String(50), nullable=False)   # see GitCategory enum
    url            = Column(String(1000), nullable=False)
    branch         = Column(String(255), nullable=False, default="main")
    auth_type      = Column(String(50), nullable=False, default="token")  # token | ssh_key | none | generic
    credential_name= Column(String(255))                  # reference into credentials table; never a raw secret
    path           = Column(String(1000))                 # on-disk sub-path override; falls back to name
    verify_ssl     = Column(Boolean, nullable=False, default=True)
    git_author_name= Column(String(255))                  # git user.name for commits
    git_author_email= Column(String(255))                 # git user.email for commits
    description    = Column(Text)
    is_active      = Column(Boolean, nullable=False, default=True)
    last_sync      = Column(DateTime(timezone=True))
    sync_status    = Column(String(255))                  # "synced" | "syncing" | "error: ..." | etc.
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_git_repos_category", "category"),
        Index("idx_git_repos_active", "is_active"),
    )
```

**`category` values** (defined as `GitCategory` enum in `models/git_repositories.py`):

| Value | Meaning |
|---|---|
| `device_configs` | Network device configuration backups |
| `cockpit_configs` | Application-level config files |
| `templates` | Jinja/Ansible templates |
| `agent` | Agent deployment payloads |
| `csv_imports` | CSV files used for bulk imports |
| `csv_exports` | CSV files produced by export tasks |

The category field is a plain string in the database — the enum is enforced at the API layer only. A porting app may use any string values that suit it.

**`auth_type` values:** `token`, `ssh_key`, `generic`, `none`

---

## Pydantic Models

**File:** `backend/models/git_repositories.py`

### `GitRepositoryRequest` (POST body for creation)

```python
name:             str           # required, unique
category:         GitCategory   # required
url:              str           # required
branch:           str = "main"
auth_type:        GitAuthType = "token"
credential_name:  Optional[str]  # name of stored credential
path:             Optional[str]  # overrides name as on-disk sub-path
verify_ssl:       bool = True
git_author_name:  Optional[str]
git_author_email: Optional[str]
description:      Optional[str]
is_active:        bool = True
```

### `GitRepositoryUpdateRequest` (PUT body, all fields optional)

Same fields as `GitRepositoryRequest` but every field is `Optional`.

### `GitRepositoryResponse`

```python
id, name, category, url, branch, auth_type, credential_name,
path, verify_ssl, git_author_name, git_author_email, description,
is_active, created_at, updated_at, last_sync, sync_status
```

Note: credentials (token, password, SSH key content) are **never** included in the response.

### `GitRepositoryListResponse`

```python
repositories: List[GitRepositoryResponse]
total:        int
```

### `GitConnectionTestRequest`

```python
url:             str
branch:          str = "main"
auth_type:       GitAuthType = "token"
username:        Optional[str]   # inline fallback, not preferred
token:           Optional[str]   # inline fallback, not preferred
credential_name: Optional[str]   # preferred: resolves via credentials service
verify_ssl:      bool = True
```

### `GitConnectionTestResponse`

```python
success: bool
message: str
details: Optional[dict]
```

---

## Repository Layer

**File:** `backend/repositories/git/git_repository_repository.py`

Extends `BaseRepository[GitRepository]`. Additional methods beyond the base CRUD:

| Method | Description |
|---|---|
| `get_by_name(name)` | Find one by unique name |
| `get_by_category(category, active_only=True)` | Filter by category |
| `get_all_active()` | All rows where `is_active=True` |
| `name_exists(name)` | Boolean uniqueness check |

`BaseRepository` (at `repositories/base.py`) provides: `get_by_id`, `get_all`, `create`, `update`, `delete`.

---

## Service Layer

### `GitRepositoryService` — `services/git/repository_service.py`

**Purpose:** CRUD on the `git_repositories` PostgreSQL table. Does **not** touch the filesystem or git.

Key methods:

| Method | Returns | Notes |
|---|---|---|
| `create_repository(repo_data: dict) → int` | New record ID | Raises `ValueError` if name already exists |
| `get_repository(repo_id: int) → dict \| None` | Serialized dict | Returns `None` if not found |
| `get_repositories(category?, active_only?) → list[dict]` | List of dicts | Both filters optional |
| `get_repositories_by_category(category) → list[dict]` | Active repos in category | Convenience wrapper |
| `update_repository(repo_id, repo_data) → bool` | Success flag | Only updates valid field names; raises `ValueError` on name collision |
| `delete_repository(repo_id, hard_delete=True) → bool` | Success flag | Soft-delete sets `is_active=False` |
| `update_sync_status(repo_id, status, last_sync?) → bool` | Success flag | Called by sync endpoints |
| `health_check() → dict` | Stats dict | Returns totals per category |

The service converts SQLAlchemy model instances to plain dicts via `_to_dict()`. All timestamps are serialised to ISO 8601 strings.

**Module-level singleton:** `shared_utils.py` exposes `git_repo_manager = GitRepositoryService()` for use by routers that don't receive it via dependency injection.

---

### `GitService` — `services/git/service.py`

**Purpose:** Core git operations using GitPython (`gitpython` library). Works on the local filesystem clone.

Constructed via `service_factory.build_git_service()`.

Key methods:

| Method | Returns | Notes |
|---|---|---|
| `open_or_clone(repository: dict) → Repo` | GitPython `Repo` | Opens if exists and URL matches; re-clones if URL mismatch |
| `clone(repository, target_path?) → Repo` | `Repo` | Explicit clone to path |
| `pull(repository, repo?) → PullResult` | dataclass | Pulls `repository["branch"]` from `origin` |
| `push(repository, repo?, branch?) → PushResult` | dataclass | Pushes to remote; handles token URL injection |
| `commit(repository, message, files?, repo?, add_all?) → CommitResult` | dataclass | Stages and commits; uses `set_git_author()` context |
| `commit_and_push(repository, message, files?, ...) → CommitAndPushResult` | dataclass | Convenience: commit then push |
| `fetch(repository, repo?) → GitResult` | dataclass | Fetch without merge |
| `get_status(repository, repo?) → dict` | Status dict | branch, HEAD commit, dirty flag, file lists |
| `get_repo_path(repository) → Path` | `Path` | Delegates to `paths.repo_path()` |
| `with_auth_environment(repository)` | Context manager | Yields `(auth_url, username, token, ssh_key_path)` |

**Result dataclasses** (all defined in `service.py`):

```python
@dataclass
class GitResult:
    success: bool
    message: str
    details: Optional[dict] = None

@dataclass
class CommitResult(GitResult):
    commit_sha: Optional[str] = None
    files_changed: int = 0

@dataclass
class PushResult(GitResult):
    pushed: bool = False
    branch: Optional[str] = None

@dataclass
class PullResult(GitResult):
    commits_pulled: int = 0
    branch: Optional[str] = None

@dataclass
class CommitAndPushResult(GitResult):
    commit_sha: Optional[str] = None
    files_changed: int = 0
    pushed: bool = False
    branch: Optional[str] = None
```

---

### `GitAuthenticationService` — `services/git/auth.py`

**Purpose:** Centralizes credential resolution and auth environment setup. All git operations that touch a remote call through this service.

Key methods:

| Method | Notes |
|---|---|
| `resolve_credentials(repository) → (username, token, ssh_key_path)` | Looks up `credential_name` in the credentials service; returns `(None, None, None)` if not found |
| `build_auth_url(url, username, token) → str` | Injects `username:token@` into HTTP(S) URLs; leaves SSH/git URLs unchanged |
| `normalize_url(url) → str` | Strips userinfo from URL for comparison |
| `setup_auth_environment(repository)` | **Context manager.** Resolves credentials, sets `GIT_SSH_COMMAND` for SSH auth, yields `(clone_url, username, token, ssh_key_path)`, restores env on exit |

**Auth flow per `auth_type`:**

- `token` — resolves a credential of type `token` by name; embeds `username:token` into the HTTPS clone URL.
- `ssh_key` — resolves a credential of type `ssh_key` by name; sets `GIT_SSH_COMMAND=ssh -i {key_path} -o StrictHostKeyChecking=no` in the environment before the git operation.
- `generic` — resolves a credential of type `generic`; embeds `username:password` into the HTTPS clone URL.
- `none` — no credentials; URL used as-is.

---

### `GitOperationsService` — `services/git/operations.py`

**Purpose:** Sync/clone/status workflows used by the sync endpoints. Wraps `GitAuthenticationService` and `set_ssl_env`.

Key methods:

| Method | Returns | Notes |
|---|---|---|
| `sync_repository(repository, force_clone=False) → SyncResult` | dataclass | Clone if missing; pull if exists |
| `remove_and_sync(repository) → SyncResult` | dataclass | `rmtree` existing; clone fresh |
| `clone_repository(repository, target_path?) → CloneResult` | dataclass | Explicit clone |
| `get_repository_status(repository, repo_id) → dict` | Status dict | GitPython-based; no subprocess |

---

### `GitConnectionService` — `services/git/connection.py`

**Purpose:** Tests connectivity to a remote URL via `git clone --depth 1` in a temporary directory. Used by the `POST /api/git-repositories/test-connection` endpoint.

Key method: `test_connection(request: GitConnectionTestRequest) → GitConnectionTestResponse`

Steps:
1. Resolves credentials via `GitAuthenticationService.resolve_credentials()`.
2. Validates resolution (returns error response if credential_name was given but resolution failed).
3. Builds clone URL with auth.
4. Runs `subprocess.run(["git", "clone", "--depth", "1", ...], timeout=30)`.
5. Returns `GitConnectionTestResponse(success=True/False, ...)`.

Uses `set_ssl_env()` for SSL configuration during the clone.

---

### `GitCacheService` — `services/git/cache.py`

**Purpose:** Redis-backed caching for commit lists and file history. Wraps a generic `cache_service`.

Constructor: `GitCacheService(cache_service)` — injected via `service_factory.build_git_cache_service()`.

Cache key format: `repo:{repo_id}:commits:{branch}` and `repo:{repo_id}:file-history:{path}`.

Key methods: `get_commits(...)`, `get_file_history(...)`, `get_commit_details(...)`, `invalidate_repo(repo_id)`, `invalidate_all()`.

Cache config (TTL, enabled, max_commits) is read from `SettingsManager.get_cache_settings()` at call time.

---

### `GitFileService` — `services/git/file_service.py`

**Purpose:** File-level operations on a checked-out repository. Instantiated as a module-level singleton in `routers/git/files.py`.

Key methods (all take `repo_id: int` as first argument):

| Method | Description |
|---|---|
| `search_files(repo_id, query, limit)` | Fuzzy filename search across the working tree |
| `get_commit_files(repo_id, commit_hash, file_path?)` | Files changed in a specific commit |
| `get_file_last_commit(repo_id, file_path)` | Last commit that touched a file |
| `get_file_history(repo_id, file_path, from_commit?, cache_service, ...)` | Full commit history for a file |
| `get_file_content(repo_id, path, username?)` | Raw file content as string |
| `get_file_content_parsed(repo_id, path, username?)` | Parsed content with metadata |
| `get_directory_tree(repo_id, path)` | Recursive tree structure |
| `get_directory_files(repo_id, path)` | Flat file listing for a directory |
| `list_csv_files(repo_id, query, limit)` | List `.csv` files across the repo |
| `get_csv_headers(repo_id, path, delimiter, quote_char)` | Parse CSV headers |

All methods resolve the repository path via `repo_path()` and open with GitPython's `Repo`.

---

### `GitDiffService` — `services/git/diff.py`

**Purpose:** Diff operations. Not used directly by the main router endpoints (those use inline `difflib` in `version_control.py`). Used by other services that need diffs.

Key methods: `unified_diff(...)`, `calculate_diff_stats(diff_lines)`, `line_by_line_diff(...)`, `compare_file_versions(...)`, `compare_files_across_repos(...)`, `compare_text_content(content1, content2)`.

---

### Helper modules

| File | Purpose |
|---|---|
| `services/git/paths.py` | `repo_path(repository: dict) → Path` — returns `Path(DATA_DIR) / "git" / (path or name)`. Reads `config.settings.data_directory`. |
| `services/git/env.py` | `set_ssl_env(repository)` context manager — sets/unsets `GIT_SSL_NO_VERIFY`, `GIT_SSL_CA_INFO`, `GIT_SSL_CERT` based on `verify_ssl` and optional SSL fields in the repository dict. |
| `services/git/config.py` | `set_git_author(repository, repo)` context manager — temporarily sets `user.name` / `user.email` in the GitPython repo's local config for the duration of a commit. Restores originals on exit. |
| `services/git/shared_utils.py` | `git_repo_manager = GitRepositoryService()` singleton used by routers. Also provides `get_git_repo_by_id(repo_id)` (opens/clones and returns a `Repo`) and `get_git_repositories_by_category(category)` (returns a list of open `Repo` objects). |

---

## REST API Endpoints

All endpoints require JWT authentication (enforced via `Depends(require_permission(...))`).

### Group 1 — Repository CRUD

**Router file:** `routers/git/repositories.py`  
**Prefix:** `/api/git-repositories`

| Method | Path | Permission | Handler | Description |
|---|---|---|---|---|
| GET | `/api/git-repositories/` | `git.repositories:read` | `get_repositories` | List all repositories. Query params: `category` (string), `active_only` (bool). Returns `GitRepositoryListResponse`. |
| GET | `/api/git-repositories/{repo_id}` | `git.repositories:read` | `get_repository` | Get one repository by ID. Returns `GitRepositoryResponse`. |
| GET | `/api/git-repositories/{repo_id}/edit` | `git.repositories:write` | `get_repository_for_edit` | Get all fields including internal data for edit forms. Returns raw dict. |
| POST | `/api/git-repositories/` | `git.repositories:write` | `create_repository` | Create repository. Body: `GitRepositoryRequest`. Returns `GitRepositoryResponse`. |
| PUT | `/api/git-repositories/{repo_id}` | `git.repositories:write` | `update_repository` | Partial update. Body: `GitRepositoryUpdateRequest` (all fields optional). Returns `GitRepositoryResponse`. |
| DELETE | `/api/git-repositories/{repo_id}` | `git.repositories:delete` | `delete_repository` | Delete or deactivate. Query param: `hard_delete` (bool, default `True`). Returns `{"message": "..."}`. |
| POST | `/api/git-repositories/test-connection` | `git.repositories:write` | `test_git_connection` | Test connectivity. Body: `GitConnectionTestRequest`. Returns `GitConnectionTestResponse`. Delegates to `GitConnectionService.test_connection()`. |
| GET | `/api/git-repositories/health` | `git.repositories:read` | `health_check` | Returns stats: total repos, active repos, count per category. |

---

### Group 2 — Repository Operations

**Router file:** `routers/git/operations.py`  
**Prefix:** `/api/git/{repo_id}`

| Method | Path | Permission | Handler | Description |
|---|---|---|---|---|
| GET | `/api/git/{repo_id}/status` | `git.operations:execute` | `get_repository_status` | Returns `{success, data}` with branch, HEAD commit, dirty flag, file counts. Implemented via `GitOperationsService.get_repository_status()`. |
| POST | `/api/git/{repo_id}/sync` | `git.operations:execute` | `sync_repository` | Clone (if missing) or pull (if exists). Updates `sync_status` on the DB record. Invalidates cache on success. Returns `{success, message, repository_path}`. Inline implementation in the router (does not delegate to service). |
| POST | `/api/git/{repo_id}/remove-and-sync` | `git.operations:execute` | `remove_and_sync_repository` | Backs up existing directory (with timestamp suffix) then clones fresh. Same response shape as `/sync`. |
| GET | `/api/git/{repo_id}/info` | `git.operations:execute` | `get_repository_info` | Returns DB metadata plus live git stats (total_commits, total_branches, current_branch, working_directory). |
| GET | `/api/git/{repo_id}/debug` | `git.operations:execute` | `debug_git` | Returns `{status, repo_path, branch}` from a live `Repo` instance. Simple health check. |

---

### Group 3 — Version Control

**Router file:** `routers/git/version_control.py`  
**Prefix:** `/api/git/{repo_id}`

| Method | Path | Permission | Handler | Description |
|---|---|---|---|---|
| GET | `/api/git/{repo_id}/branches` | `git.operations:execute` | `get_branches` | Returns list of `{name, current}` for all local branches. |
| GET | `/api/git/{repo_id}/commits/{branch_name}` | `git.repositories:read` | `get_commits` | Returns up to `max_commits` (from cache settings, default 500) commits for the branch. Each commit: `{hash, short_hash, message, author: {name, email}, date, files_changed}`. Results are cached in Redis. |
| POST | `/api/git/{repo_id}/diff` | `git.operations:execute` | `compare_commits` | Compare a single file between two commits. Body: `{commit1, commit2, file_path}`. Returns `{left_lines, right_lines, diff_lines, stats: {additions, deletions, changes, total_lines}}` where each line is `{line_number, content, type}` with type `equal \| delete \| insert \| replace`. |

---

### Group 4 — File Operations

**Router file:** `routers/git/files.py`  
**Prefix:** `/api/git/{repo_id}`  
All endpoints require `git.repositories:read` permission. All delegate directly to `GitFileService`.

| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/api/git/{repo_id}/files/search` | `search_repository_files` | Query param: `query` (string), `limit` (int, default 50). Fuzzy filename search. |
| GET | `/api/git/{repo_id}/files/{commit_hash}/commit` | `get_files` | Files changed in a commit. Optional query param: `file_path` to filter. |
| GET | `/api/git/{repo_id}/files/{file_path}/history` | `get_file_history` | Last commit that touched a file. |
| GET | `/api/git/{repo_id}/files/{file_path}/complete-history` | `get_file_complete_history` | Full per-file commit history. Optional query param: `from_commit` (hash). Cache-aware via `SettingsManager`. |
| GET | `/api/git/{repo_id}/file-content` | `get_file_content` | Query param: `path`. Returns `text/plain` response body. |
| GET | `/api/git/{repo_id}/file-content-parsed` | `get_file_content_parsed` | Query param: `path`. Returns JSON with content + metadata. |
| GET | `/api/git/{repo_id}/tree` | `get_directory_tree` | Query param: `path` (default `""`). Returns recursive tree structure. |
| GET | `/api/git/{repo_id}/directory` | `get_directory_files` | Query param: `path` (default `""`). Flat file listing. |
| GET | `/api/git/{repo_id}/csv-files` | `list_csv_files` | Query params: `query` (string), `limit` (int, default 200). Lists `.csv` files. |
| GET | `/api/git/{repo_id}/csv-headers` | `get_csv_headers` | Query params: `path`, `delimiter` (default `,`), `quote_char` (default `"`). Returns column headers. |

---

### Group 5 — Debug Endpoints

**Router file:** `routers/git/debug.py`  
**Prefix:** `/api/git-repositories`  
All require `git.repositories:write` permission.

| Method | Path | Handler | Description |
|---|---|---|---|
| POST | `/api/git-repositories/{repo_id}/debug/read` | `debug_read_test` | Reads `.cockpit_debug_test.txt` from the repo root. Returns details including content and file size. |
| POST | `/api/git-repositories/{repo_id}/debug/write` | `debug_write_test` | Writes `.cockpit_debug_test.txt` with a timestamp. Returns verification and git status. |
| POST | `/api/git-repositories/{repo_id}/debug/delete` | `debug_delete_test` | Deletes `.cockpit_debug_test.txt`. Returns verification and git status. |
| POST | `/api/git-repositories/{repo_id}/debug/push` | `debug_push_test` | Full write → commit → push test using `set_git_author()` and `GitAuthenticationService`. Cleans up after itself. |
| GET | `/api/git-repositories/{repo_id}/debug/info` | `debug_repository_info` | Returns filesystem stats: path exists, is_git_repo, disk usage, permissions, SSL cert info, remote URL. |

---

## Authentication Mechanisms

Authentication is managed entirely by `GitAuthenticationService` (`services/git/auth.py`). The repository dict drives behaviour via its `auth_type` and `credential_name` fields.

### Token / Generic (HTTP/HTTPS)

Credentials are fetched from the credentials service by `credential_name`. The token/password is decrypted and embedded into the clone URL:

```
https://username:token@host/path/to/repo.git
```

`build_auth_url()` handles URL-encoding of both username and token.

### SSH Key

The credentials service returns the path to the SSH private key file on disk. The `GIT_SSH_COMMAND` environment variable is set before any git operation:

```
GIT_SSH_COMMAND=ssh -i /path/to/key -o StrictHostKeyChecking=no -o IdentitiesOnly=yes
```

The env var is restored to its original value (or unset) after the context manager exits.

### None / Public

No credential lookup; the original URL is used as-is.

### SSL Verification

Controlled by `verify_ssl` (bool) on the repository record. `set_ssl_env()` sets `GIT_SSL_NO_VERIFY=1` when `verify_ssl=False`. Supports optional `ssl_ca_info` and `ssl_cert` keys in the repository dict (not exposed via API currently, but handled in the env module).

---

## External Dependencies

Python packages required (in addition to FastAPI + SQLAlchemy):

| Package | Used for |
|---|---|
| `gitpython` (`git` module) | All local git operations: clone, pull, push, commit, branch/commit queries, file content |
| `subprocess` | `git clone --depth 1` in `GitConnectionService.test_connection()` for connectivity testing |

No other git-specific libraries are used.

---

## Internal Dependencies (Coupling to Host App)

These are the points where the git service calls back into the rest of the application. When porting, these must be re-implemented or replaced.

### 1. Credentials Service

**Where used:** `services/git/auth.py` — `resolve_credentials()`

```python
import service_factory
cred_mgr = service_factory.build_credentials_service()
creds = cred_mgr.list_credentials(include_expired=False)
ssh_key_path = cred_mgr.get_ssh_key_path(credential_id)
token = cred_mgr.get_decrypted_password(credential_id)
```

The credentials service must provide:
- A list of credential objects with at minimum: `id`, `name`, `type` (`token` | `ssh_key` | `generic`), `username`.
- `get_ssh_key_path(id) → str` — filesystem path to the SSH private key.
- `get_decrypted_password(id) → str` — decrypted token or password.

**To port without credentials service:** hardcode `resolve_credentials()` to read from environment variables or a config file.

### 2. Cache Service

**Where used:** `services/git/cache.py`, `routers/git/version_control.py`, `routers/git/files.py`

A generic key-value cache with `get(key)`, `set(key, value, ttl)`, and `delete(key)` interface, backed by Redis. Injected via `dependencies.get_cache_service()`.

**To port without Redis:** replace with a simple in-memory dict or remove caching entirely.

### 3. Settings Manager

**Where used:** `services/git/cache.py`, `routers/git/version_control.py`, `routers/git/files.py`

```python
from services.settings.manager import SettingsManager
cfg = SettingsManager().get_cache_settings()
# cfg: {"enabled": bool, "ttl_seconds": int, "max_commits": int}
```

Controls cache TTL and max commit count. **To port:** replace with hardcoded constants or a config file.

### 4. `paths.py` — `config.settings.data_directory`

```python
from config import settings as config_settings
Path(config_settings.data_directory) / "git" / sub_path
```

The host app's config must expose `data_directory` (the root for on-disk storage). **To port:** replace with a constant or env variable, e.g., `DATA_DIR = os.getenv("DATA_DIR", "/data")`.

### 5. `safe_http_errors.raise_internal_server_error`

Used in all routers instead of `raise HTTPException(500, str(e))`. It logs the exception with a correlation ID and returns a sanitized `{message, error_id}` response (no raw exception text). **To port:** replace with `raise HTTPException(status_code=500, detail="Internal server error")` or implement the same helper.

### 6. `require_permission(resource, action)`

FastAPI dependency that validates JWT permissions. **To port:** replace with your own auth dependency. All it needs to do is inject `current_user: dict` with at minimum a `"username"` key.

### 7. `BaseRepository`

Located at `repositories/base.py`. Provides `get_by_id`, `get_all`, `create`, `update`, `delete` on top of SQLAlchemy. **To port:** implement a minimal base with those methods, or write `GitRepositoryRepository` methods directly without inheritance.

---

## Wiring

### `service_factory.py`

```python
def build_git_service():
    from services.git.service import GitService
    return GitService()

def build_git_auth_service():
    from services.git.auth import GitAuthenticationService
    return GitAuthenticationService()

def build_git_cache_service():
    from services.git.cache import GitCacheService
    cache_service = build_cache_service()  # Redis wrapper
    return GitCacheService(cache_service)

def build_git_repository_service():
    from services.git.repository_service import GitRepositoryService
    return GitRepositoryService()

def build_git_operations_service():
    from services.git.operations import GitOperationsService
    return GitOperationsService()

def build_git_connection_service():
    from services.git.connection import GitConnectionService
    return GitConnectionService()

def build_git_diff_service():
    from services.git.diff import GitDiffService
    return GitDiffService()
```

### `dependencies.py`

```python
def get_git_service():
    return service_factory.build_git_service()

def get_git_auth_service():
    return service_factory.build_git_auth_service()

def get_git_cache_service():
    return service_factory.build_git_cache_service()

def get_git_operations_service():
    return service_factory.build_git_operations_service()

def get_git_connection_service():
    return service_factory.build_git_connection_service()

def get_git_diff_service():
    return service_factory.build_git_diff_service()
```

### `main.py` registration

```python
from routers.git import router as git_router
app.include_router(git_router)
```

`routers/git/__init__.py` exports `router` from `routers/git/main.py`, which includes all 5 sub-routers:

```python
router = APIRouter()
router.include_router(repositories_router)   # /api/git-repositories/
router.include_router(operations_router)     # /api/git/{repo_id}/
router.include_router(version_control_router)# /api/git/{repo_id}/
router.include_router(files_router)          # /api/git/{repo_id}/
router.include_router(debug_router)          # /api/git-repositories/{repo_id}/debug/
```

---

## Porting Checklist

Copy these files verbatim (no changes needed if the stubs below are satisfied):

- [ ] `core/models/git.py` — SQLAlchemy model
- [ ] `models/git_repositories.py` — Pydantic models
- [ ] `repositories/git/git_repository_repository.py`
- [ ] `services/git/auth.py`
- [ ] `services/git/cache.py`
- [ ] `services/git/config.py`
- [ ] `services/git/connection.py`
- [ ] `services/git/diff.py`
- [ ] `services/git/env.py`
- [ ] `services/git/file_service.py`
- [ ] `services/git/operations.py`
- [ ] `services/git/paths.py`
- [ ] `services/git/repository_service.py`
- [ ] `services/git/service.py`
- [ ] `services/git/shared_utils.py`
- [ ] `routers/git/__init__.py`
- [ ] `routers/git/main.py`
- [ ] `routers/git/repositories.py`
- [ ] `routers/git/operations.py`
- [ ] `routers/git/version_control.py`
- [ ] `routers/git/files.py`
- [ ] `routers/git/debug.py`

Adapt / stub out these internal dependencies:

- [ ] `config.settings.data_directory` — replace with `os.getenv("DATA_DIR", "/data")` in `paths.py`
- [ ] `services.settings.manager.SettingsManager` — replace `get_cache_settings()` calls with hardcoded defaults `{"enabled": True, "ttl_seconds": 600, "max_commits": 500}`
- [ ] Credentials service — implement `resolve_credentials()` in `auth.py` to match your credential store, or return `(None, None, None)` to disable auth support
- [ ] Cache service — provide an object with `get(key)`, `set(key, value, ttl)`, `delete(key)` or stub them as no-ops
- [ ] `require_permission(resource, action)` — replace with your auth dependency
- [ ] `raise_internal_server_error(logger, msg, exc)` — replace with `raise HTTPException(500, "Internal server error")`
- [ ] `BaseRepository` — implement `get_by_id`, `get_all`, `create`, `update`, `delete` or rewrite `GitRepositoryRepository` directly
- [ ] Register `GitRepository` in your SQLAlchemy metadata (`Base`)
- [ ] Add `service_factory` builder functions and `dependencies.py` injectors
- [ ] Register `git_router` in `main.py`
- [ ] Create the `git_repositories` table via migration or `Base.metadata.create_all()`
