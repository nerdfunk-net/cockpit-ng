# Refactoring plan: one Git subsystem

Implemented. Kept as historical context — see [doc/GIT_SERVICE.md](../GIT_SERVICE.md) for the current implementation reference.

Source of findings: [GIT_SUBSYSTEM_ANALSYSIS.md](../GIT_SUBSYSTEM_ANALSYSIS.md).
Intended live stack (keep and extend): [GIT_SERVICE.md](../GIT_SERVICE.md).

---

## 1. Goal

End with **one** Git subsystem that covers every live feature:

- Multi-repository CRUD (`git_repositories`).
- Clone, pull, commit, push, sync, force-reclone, status.
- Connection test (shallow clone).
- Branches, commits, file browse, content search, CSV helpers, diffs.
- Debug read, write, delete, push, diagnostics.
- Feature writers: backups, CSV import and export, inventory JSON, agent deploy, snapshots, templates sync.

Delete the leftover singleton (`git_settings`) and collapse the three clone and pull implementations into `GitService`.

After this plan, a port copies `services/git/`, `routers/git/`, `core/models/git.py`, `models/git_repositories.py`, and `repositories/git/` only. There is no second Git stack to copy by accident.

## 2. Non-goals

- Do not change Git category values, credential-by-name auth, or on-disk layout `{DATA_DIR}/git/{path_or_name}/`.
- Do not merge `GitFileService` facades (list, read, search, history). Those are one subsystem, already split by responsibility.
- Do not implement the stub `git_bulk` template import (`TemplateImportService._import_git_bulk` still returns fake names). Leave `TemplateImportRequest.git_repo_url` on that import DTO.
- Do not change frontend Git Management except where a call is already broken (`toggle-active`) or fields that never persist (per-template Git URL on the template form).
- Do not auto-drop the `git_settings` PostgreSQL table on startup. Auto-schema never drops tables. Drop it with the CLI after the model is gone (Phase 5).

## 3. End-state architecture

One operational core. One catalog table. One connection tester.

```
PostgreSQL git_repositories
        ▲
        │ CRUD only
GitRepositoryService          (repository_service.py)
        │
        │ repo dicts
        ▼
GitService                    (service.py)  ← THE git engine
  open_or_clone / pull / push / commit / commit_and_push
  sync_repository / remove_and_sync / get_repository_status
        │
        ├── GitAuthenticationService   auth.py
        ├── set_ssl_env / set_git_author
        ├── GitConnectionService       connection.py  (test only)
        ├── GitCacheService            cache.py
        ├── GitDiffService             diff.py
        └── GitFileService             file_service.py facade

Routers (thin)
  /api/git-repositories/*     repositories.py + debug.py
  /api/git/{repo_id}/*        operations.py, version_control.py, files.py
  /api/templates/git/test     GitConnectionService
  /api/templates/sync         GitService.sync_repository
```

Deleted:

- `GitOperationsService` and `services/git/operations.py`
- `GitSetting` table model, `GitSettingsService`, `routers/settings/git_settings.py`
- `connection_tester.test_git_connection` and `test_all_connections`
- Unused pydantic Git request models listed in Phase 6

Token auth rule (one behavior): `GitService.pull` and `push` use `http.extraHeader` via `GitAuthenticationService.http_auth_config`. Never call `origin.set_url(clone_url)` (that writes the token into the stored remote URL).

## 4. HTTP contracts you must keep

Do not change these response shapes. The frontend depends on them.

| Method | Path | Keep |
|---|---|---|
| GET, POST, PUT, DELETE | `/api/git-repositories/` and `/api/git-repositories/{id}` | `GitRepositoryResponse` |
| POST | `/api/git-repositories/test-connection` | `GitConnectionTestResponse` |
| GET | `/api/git/{id}/status` | `{success, data}` where `data` is the status dict from today's `GitOperationsService.get_repository_status` |
| POST | `/api/git/{id}/sync` | `{success, message, repository_path}` |
| POST | `/api/git/{id}/remove-and-sync` | same as sync |
| GET | `/api/git/{id}/commits/{branch}` | list of `{hash, short_hash, message, author: {name, email}, date, files_changed}` |
| POST | `/api/git/{id}/diff` | `{commit1, commit2, file_path, diff_lines, left_file, right_file, left_lines, right_lines, stats}` with line `type` in `equal`, `delete`, `insert`, `replace` |
| GET | file, tree, directory, CSV, history endpoints | unchanged |
| POST | `/api/templates/git/test` and `/api/templates/sync` | unchanged |

Add (frontend already calls this; backend is missing):

| Method | Path | Body | Response |
|---|---|---|---|
| PATCH | `/api/git-repositories/{id}/toggle-active` | `{is_active: bool}` | `GitRepositoryResponse` |

Remove:

| Method | Path |
|---|---|
| GET, PUT, POST | `/api/settings/git` |
| POST | `/api/settings/test/git` |
| PUT `/api/settings` field | required `git` on `AllSettingsRequest` |

GET `/api/settings` currently returns a `git` key. After Phase 5 it does not. No frontend caller exists.

## 5. Work order

Do the phases in order. Each phase leaves tests green.

| Phase | What | Why this order |
|---|---|---|
| 0 | Confirm no external `/api/settings/git` client | Deleting B is irreversible for that API |
| 1 | Move sync, remove-and-sync, status onto `GitService` | One engine before you retarget callers |
| 2 | Thin operations router and templates sync | Stop duplicating clone and pull |
| 3 | Commits cache + diff service, preserve payloads | Stop inline logic in version_control |
| 4 | Add `toggle-active` | Fix the already-broken UI call |
| 5 | Delete `git_settings` and connection_tester Git | Remove subsystem B |
| 6 | Delete dead models, unused factory, subprocess cache fallback | Cleanup |
| 7 | Template form Git URL fields; update `GIT_SERVICE.md` | Frontend + porting doc match the code |
| 8 | Tests and verification | Definition of done |

---

## Phase 0 — Preconditions

No code changes.

1. Confirm no external client of `GET|PUT|POST /api/settings/git` or `POST /api/settings/test/git` (scripts, agents, other apps). Repo frontend has zero callers.
2. Confirm no client of PUT `/api/settings` that sends a required `git` object. Repo frontend has zero callers.
3. Keep a checkout of current `/api/git/{id}/diff` and `/api/git/{id}/status` sample JSON from a running instance if you have one. Use them as regression fixtures in Phase 8.

---

## Phase 1 — Fold `GitOperationsService` into `GitService`

### 1.1 Delete `GitService.clone`

`clone()` has no production caller. Keep private `_clone_fresh`.

**Before** (`services/git/service.py`):

```python
def clone(
    self, repository: Dict, target_path: Optional[Union[str, Path]] = None
) -> Repo:
    if target_path:
        path = Path(target_path)
    else:
        path = self.get_repo_path(repository)
    return self._clone_fresh(repository, path)
```

**After:** delete the method. If `test_git_service.py` tests `clone`, delete those tests.

### 1.2 Add three methods to `GitService`

Add these imports at the top of `services/git/service.py` if missing: `os`, `time`, plus `from models.git import SyncResult`.

Copy `get_repository_status` from `services/git/operations.py` lines 308–455 almost verbatim. Change `get_repo_path(repository)` to `str(self.get_repo_path(repository))`. Keep the cache lookup via `service_factory.build_git_cache_service()`.

Add `sync_repository` and `remove_and_sync` as follows. They reuse `_clone_fresh` and `pull` so token auth stays `http.extraHeader`, not `origin.set_url`.

Also add this private helper. It preserves the user-facing error classification the UI shows today ("Authentication failed…", "Repository or branch not found…") — the current router and `GitOperationsService` both produce these messages, and `test_git_operations_service.py::test_sync_repository_clone_auth_error_message` asserts the auth variant, so dropping the classification would both change UX and break the retargeted test:

```python
def _clone_error_message(self, repository: Dict[str, Any], error: Exception) -> str:
    """Map clone failures to the user-facing messages the UI shows today."""
    err = str(error)
    if "authentication" in err.lower():
        return "Authentication failed. Please check your Git credentials."
    if "not found" in err.lower():
        return (
            f"Repository or branch not found. "
            f"URL: {repository['url']} Branch: {repository['branch']}"
        )
    return f"Git clone failed: {_redact(err)}"
```

**After** (append to `GitService` in `services/git/service.py`):

```python
def sync_repository(
    self, repository: Dict[str, Any], force_clone: bool = False
) -> SyncResult:
    """Clone if missing, pull if present. Never persist credentials in origin URL."""
    if force_clone:
        return self.remove_and_sync(repository)

    repo_path = str(self.get_repo_path(repository))
    logger.info(
        "Syncing repository '%s' to path: %s", repository["name"], repo_path
    )
    os.makedirs(os.path.dirname(repo_path) or ".", exist_ok=True)

    repo_dir_exists = os.path.exists(repo_path)
    is_git_repo = os.path.isdir(os.path.join(repo_path, ".git"))

    if not is_git_repo:
        if repo_dir_exists:
            parent_dir = os.path.dirname(repo_path.rstrip(os.sep)) or os.path.dirname(
                repo_path
            )
            base_name = os.path.basename(os.path.normpath(repo_path))
            backup_path = os.path.join(
                parent_dir, f"{base_name}_backup_{int(time.time())}"
            )
            shutil.move(repo_path, backup_path)
            logger.info("Backed up existing directory to %s", backup_path)
        try:
            self._clone_fresh(repository, Path(repo_path))
            return SyncResult(
                success=True,
                message=(
                    f"Repository '{repository['name']}' cloned successfully "
                    f"to {repo_path}"
                ),
                repository_path=repo_path,
            )
        except Exception as e:
            message = self._clone_error_message(repository, e)
            logger.error("Git clone failed: %s", e)
            return SyncResult(success=False, message=message)

    pull_result = self.pull(repository)
    return SyncResult(
        success=pull_result.success,
        message=pull_result.message,
        repository_path=repo_path if pull_result.success else None,
    )


def remove_and_sync(self, repository: Dict[str, Any]) -> SyncResult:
    """Backup existing working tree, then clone fresh."""
    repo_path = str(self.get_repo_path(repository))
    logger.info(
        "Removing and re-syncing repository '%s' at %s",
        repository["name"],
        repo_path,
    )
    if os.path.exists(repo_path):
        parent_dir = os.path.dirname(repo_path.rstrip(os.sep)) or os.path.dirname(
            repo_path
        )
        base_name = os.path.basename(os.path.normpath(repo_path))
        backup_path = os.path.join(
            parent_dir, f"{base_name}_removed_{int(time.time())}"
        )
        try:
            shutil.move(repo_path, backup_path)
            logger.info("Existing repository backed up to %s", backup_path)
        except Exception as e:
            logger.warning("Could not backup existing repository: %s", e)
            shutil.rmtree(repo_path, ignore_errors=True)

    try:
        self._clone_fresh(repository, Path(repo_path))
        return SyncResult(
            success=True,
            message=(
                f"Repository '{repository['name']}' removed and "
                f"re-cloned successfully"
            ),
            repository_path=repo_path,
        )
    except Exception as e:
        message = self._clone_error_message(repository, e)
        logger.error("Git clone failed: %s", e)
        return SyncResult(success=False, message=message)
```

Preserve `get_repository_status` field names exactly: `repository_name`, `repository_url`, `repository_branch`, `sync_status`, `exists`, `is_git_repo`, `is_synced`, `behind_count`, `ahead_count`, `current_commit`, `current_branch`, `last_commit_message`, `last_commit_date`, `last_commit_author`, `last_commit_author_email`, `branches`, `commits`, `config_files`.

### 1.3 Delete `GitOperationsService`

Delete file: `backend/services/git/operations.py`.

**Before** (`service_factory.py`):

```python
def build_git_operations_service():
    """Create a fresh GitOperationsService instance."""
    from services.git.operations import GitOperationsService

    return GitOperationsService()
```

**After:** delete `build_git_operations_service`.

**Before** (`dependencies.py`):

```python
def get_git_operations_service():
    """Provide the GitOperationsService."""
    return service_factory.build_git_operations_service()
```

**After:** delete `get_git_operations_service`.

`get_git_service()` already exists in `dependencies.py`. Start using it in Phase 2.

Move tests in `backend/tests/unit/services/test_git_operations_service.py` onto `GitService`:

- Import `GitService` instead of `GitOperationsService`.
- Patch `services.git.service.get_repo_path` or `GitService.get_repo_path`, not `services.git.operations.get_repo_path`.
- Drop `test_clone_repository_success` and `test_clone_repository_failure_cleans_up` (`clone_repository` is not part of the public engine).
- Keep status, sync, and remove-and-sync tests, retargeted. `test_sync_repository_clone_auth_error_message` stays green because `_clone_error_message` preserves the "Authentication failed…" classification.

Rename the file to keep discoverability, or merge those tests into `test_git_service.py`. Either is fine. Do not leave imports of `services.git.operations`.

Grep after this phase (must be empty):

```bash
rg -n "GitOperationsService|services.git.operations|build_git_operations_service|get_git_operations_service" backend
```

Phase 1 cannot grep-clean until Phase 2 retargets the two production callers. Do Phase 2 in the same PR as Phase 1.

---

## Phase 2 — Thin routers that currently clone and pull

### 2.1 `routers/git/operations.py`

Delete `get_cached_commits` (defined, marked deprecated, never called).

Delete unused imports: `os`, `shutil`, `time`, `GitCommandError`, `Repo`, `set_ssl_env`, `git_repo_path`, `get_git_auth_service`. Keep `get_git_repo_by_id` for `/info` and `/debug`.

**Before** (`get_repository_status` handler):

```python
from dependencies import (
    get_git_auth_service,
    get_git_cache_service,
    get_git_operations_service,
)

@router.get("/status")
async def get_repository_status(
    repo_id: int,
    current_user: dict = Depends(require_permission("git.operations", "execute")),
    git_operations_service=Depends(get_git_operations_service),
):
    ...
    status_info = git_operations_service.get_repository_status(repository, repo_id)
    return {"success": True, "data": status_info}
```

**After:**

```python
from dependencies import get_git_cache_service, get_git_service

@router.get("/status")
async def get_repository_status(
    repo_id: int,
    current_user: dict = Depends(require_permission("git.operations", "execute")),
    git_service=Depends(get_git_service),
):
    try:
        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")
        status_info = git_service.get_repository_status(repository, repo_id)
        return {"success": True, "data": status_info}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting repository status: %s", e, exc_info=True)
        return {"success": False, "message": "Failed to get repository status"}
```

**Before** (`POST /sync`): the handler inlines clone and pull (~140 lines), including:

```python
if resolved_token and "http" in repository["url"]:
    origin.set_url(clone_url)
...
Repo.clone_from(clone_url, repo_path, branch=repository["branch"])
```

**After** (replace the whole handler body after the 404 check):

```python
@router.post("/sync")
async def sync_repository(
    repo_id: int,
    current_user: dict = Depends(require_permission("git.operations", "execute")),
    git_service=Depends(get_git_service),
    git_cache_service=Depends(get_git_cache_service),
):
    try:
        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")

        git_repo_manager.update_sync_status(repo_id, "syncing")
        result = git_service.sync_repository(repository)
        if result.success:
            git_repo_manager.update_sync_status(repo_id, "synced")
            git_cache_service.invalidate_repo(repo_id)
            return {
                "success": True,
                "message": result.message,
                "repository_path": result.repository_path,
            }
        git_repo_manager.update_sync_status(repo_id, f"error: {result.message}")
        raise_internal_server_error(logger, "Repository sync failed")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error syncing repository %s: %s", repo_id, e)
        git_repo_manager.update_sync_status(repo_id, f"error: {str(e)}")
        raise_internal_server_error(logger, "Internal error", e)
```

**Before** (`POST /remove-and-sync`): same inline clone (~120 lines).

**After:**

```python
@router.post("/remove-and-sync")
async def remove_and_sync_repository(
    repo_id: int,
    current_user: dict = Depends(require_permission("git.operations", "execute")),
    git_service=Depends(get_git_service),
    git_cache_service=Depends(get_git_cache_service),
):
    try:
        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")

        git_repo_manager.update_sync_status(repo_id, "removing-and-syncing")
        result = git_service.remove_and_sync(repository)
        if result.success:
            git_repo_manager.update_sync_status(repo_id, "synced")
            git_cache_service.invalidate_repo(repo_id)
            return {
                "success": True,
                "message": result.message,
                "repository_path": result.repository_path,
            }
        git_repo_manager.update_sync_status(repo_id, f"error: {result.message}")
        raise_internal_server_error(logger, "Repository sync failed")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error removing and syncing repository %s: %s", repo_id, e)
        git_repo_manager.update_sync_status(repo_id, f"error: {str(e)}")
        raise_internal_server_error(logger, "Internal error", e)
```

Leave `GET /info` and `GET /debug` as they are (they already use `get_git_repo_by_id`).

Target file size after this phase: about 180 lines, down from 429.

### 2.2 Templates sync

**Before** (`routers/settings/templates/git.py`):

```python
from dependencies import get_git_connection_service, get_git_operations_service
...
    git_operations_service=Depends(get_git_operations_service),
...
            sync_result = git_operations_service.sync_repository(repo)
```

**After:**

```python
from dependencies import get_git_connection_service, get_git_service
...
    git_service=Depends(get_git_service),
...
            sync_result = git_service.sync_repository(repo)
```

Keep `GitConnectionService` for `POST /git/test`. That is the one connection tester.

### 2.3 Debug push (optional in this phase, required before done)

`routers/git/debug.py` `debug_push_test` inlines write, commit, and push (~280 lines). Replace the commit and push portion with:

```python
git_service = service_factory.build_git_service()
# write .cockpit_debug_test.txt as today
result = git_service.commit_and_push(
    repository,
    message="Cockpit debug push test",
    files=[".cockpit_debug_test.txt"],
    repo=repo,
)
```

Keep the existing success and error JSON envelope so the Git Management debug tab does not change. If the current handler also deletes the test file after push, keep that cleanup.

---

## Phase 3 — Version control router uses cache and diff services

### 3.1 Commits

**Before** (`routers/git/version_control.py` `get_commits`): inline cache keys `repo:{id}:commits:{branch}` and `repo.iter_commits`.

**After:**

```python
from dependencies import get_git_cache_service, get_git_diff_service

@router.get("/commits/{branch_name}")
async def get_commits(
    repo_id: int,
    branch_name: str,
    current_user: dict = Depends(require_permission("git.repositories", "read")),
    git_cache_service=Depends(get_git_cache_service),
):
    try:
        from services.settings.manager import SettingsManager

        cache_cfg = SettingsManager().get_cache_settings()
        repo = get_git_repo_by_id(repo_id)
        if branch_name not in [ref.name for ref in repo.refs]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Branch '{branch_name}' not found",
            )
        limit = int(cache_cfg.get("max_commits", 500))
        return git_cache_service.get_commits(
            repo_id=repo_id,
            repo_path=repo.working_dir,
            branch_name=branch_name,
            limit=limit,
            use_models=False,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(logger, "Failed to get commits: ", e)
```

Cache key format stays `repo:{id}:commits:{branch}` (`GitCacheService._build_cache_key`). Do not invent a new key.

**GitCacheService fix (same phase):** `_fetch_commits_from_repo` currently writes to the cache only when `len(commits) < max_commits`. Once the router delegates with `limit = max_commits` (500), a repository with 500 or more commits would never be cached — a regression versus today's router, which always caches. Make the cache write unconditional:

**Before** (`services/git/cache.py` `_fetch_commits_from_repo`):

```python
            if cache_cfg.get("enabled", True):
                max_commits = int(cache_cfg.get("max_commits", 500))
                if len(commits) < max_commits:
                    # Fetch full list for cache
                    full_commits = []
                    for commit in repo.iter_commits(branch_name, max_count=max_commits):
                        full_commits.append(commit_to_dict(commit))

                    ttl = int(cache_cfg.get("ttl_seconds", 600))
                    cache_key = self._build_cache_key(repo_id, "commits", branch_name)
                    self._cache.set(cache_key, full_commits, ttl)
```

**After:**

```python
            if cache_cfg.get("enabled", True):
                max_commits = int(cache_cfg.get("max_commits", 500))
                full_commits = commits
                if limit < max_commits:
                    # Requested fewer than the cache ceiling: cache the fuller list
                    full_commits = [
                        commit_to_dict(c)
                        for c in repo.iter_commits(branch_name, max_count=max_commits)
                    ]
                ttl = int(cache_cfg.get("ttl_seconds", 600))
                cache_key = self._build_cache_key(repo_id, "commits", branch_name)
                self._cache.set(cache_key, full_commits, ttl)
```

### 3.2 Diff — preserve side-by-side payload

Do **not** return `DiffResult` from `compare_file_versions` as the HTTP body. The UI (`file-diff-dialog.tsx`) needs `left_lines` and `right_lines` with types `equal | delete | insert | replace`.

Add this method to `GitDiffService` (`services/git/diff.py`). Move the SequenceMatcher loop from `version_control.py` lines 113–252 into the service unchanged.

```python
def compare_commits_side_by_side(
    self, repo: Repo, commit1: str, commit2: str, file_path: str
) -> dict:
    """Return the /api/git/{id}/diff JSON body. Do not change keys."""
    commit_obj1 = repo.commit(commit1)
    commit_obj2 = repo.commit(commit2)
    try:
        file_content1 = (
            (commit_obj1.tree / file_path).data_stream.read().decode("utf-8")
        )
    except KeyError:
        file_content1 = ""
    try:
        file_content2 = (
            (commit_obj2.tree / file_path).data_stream.read().decode("utf-8")
        )
    except KeyError:
        file_content2 = ""

    lines1 = file_content1.splitlines(keepends=True)
    lines2 = file_content2.splitlines(keepends=True)
    diff_lines = self.unified_diff(lines1, lines2)
    stats = self.calculate_diff_stats(diff_lines)

    file1_lines = []
    file2_lines = []
    lines1_list = file_content1.splitlines()
    lines2_list = file_content2.splitlines()
    matcher = difflib.SequenceMatcher(None, lines1_list, lines2_list)
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            for i in range(i1, i2):
                file1_lines.append(
                    {
                        "line_number": i + 1,
                        "content": lines1_list[i],
                        "type": "equal",
                    }
                )
            for j in range(j1, j2):
                file2_lines.append(
                    {
                        "line_number": j + 1,
                        "content": lines2_list[j],
                        "type": "equal",
                    }
                )
        elif tag == "delete":
            for i in range(i1, i2):
                file1_lines.append(
                    {
                        "line_number": i + 1,
                        "content": lines1_list[i],
                        "type": "delete",
                    }
                )
        elif tag == "insert":
            for j in range(j1, j2):
                file2_lines.append(
                    {
                        "line_number": j + 1,
                        "content": lines2_list[j],
                        "type": "insert",
                    }
                )
        elif tag == "replace":
            for i in range(i1, i2):
                file1_lines.append(
                    {
                        "line_number": i + 1,
                        "content": lines1_list[i],
                        "type": "replace",
                    }
                )
            for j in range(j1, j2):
                file2_lines.append(
                    {
                        "line_number": j + 1,
                        "content": lines2_list[j],
                        "type": "replace",
                    }
                )

    return {
        "commit1": commit1[:8],
        "commit2": commit2[:8],
        "file_path": file_path,
        "diff_lines": diff_lines,
        "left_file": f"{file_path} ({commit1[:8]})",
        "right_file": f"{file_path} ({commit2[:8]})",
        "left_lines": file1_lines,
        "right_lines": file2_lines,
        "stats": {
            "additions": stats.additions,
            "deletions": stats.deletions,
            "changes": stats.additions + stats.deletions,
            "total_lines": len(diff_lines),
        },
    }
```

**After** (router):

```python
@router.post("/diff")
async def compare_commits(
    repo_id: int,
    request: dict,
    current_user: dict = Depends(require_permission("git.operations", "execute")),
    git_diff_service=Depends(get_git_diff_service),
):
    try:
        commit1 = request.get("commit1")
        commit2 = request.get("commit2")
        file_path = request.get("file_path")
        if not all([commit1, commit2, file_path]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required parameters: commit1, commit2, file_path",
            )
        repo = get_git_repo_by_id(repo_id)
        return git_diff_service.compare_commits_side_by_side(
            repo, commit1, commit2, file_path
        )
    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(logger, "Failed to compare commits: ", e)
```

Remove `import difflib` from the router. Add a unit test in `test_git_diff_service.py` that two one-line files produce `left_lines` and `right_lines` with the expected types.

### 3.3 Startup commit prefetch

`main.py` `prefetch_commits_once` reads `settings_manager.get_selected_git_repository()`, which nothing in production writes. Prefetch every active repository instead, through `GitCacheService` so keys match the API.

**Before:**

```python
selected_id = settings_manager.get_selected_git_repository()
if not selected_id:
    logger.warning(
        "Startup cache: No repository selected; skipping commits prefetch"
    )
    return
repo = get_git_repo_by_id(selected_id)
...
cache_service.set(cache_key, commits, ttl)
```

**After** — do **not** use `get_git_repo_by_id` here: it calls `open_or_clone`, which would clone missing repositories over the network during startup (and raises `HTTPException`, a router concern). Prefetch only repositories already on disk; sync stays a user action:

```python
from git import Repo  # add to main.py imports (or import locally in the hook)

git_repo_svc = service_factory.build_git_repository_service()
git_cache_service = service_factory.build_git_cache_service()
git_service = service_factory.build_git_service()
limit = int(cache_cfg.get("max_commits", 500))
for repository in git_repo_svc.get_repositories(active_only=True):
    try:
        repo_path = git_service.get_repo_path(repository)
        if not (repo_path / ".git").is_dir():
            continue  # never clone at startup
        repo = Repo(repo_path)
        if not repo.head.is_valid():
            continue
        branch_name = repo.active_branch.name
        git_cache_service.get_commits(
            repo_id=repository["id"],
            repo_path=str(repo_path),
            branch_name=branch_name,
            limit=limit,
            use_models=False,
        )
        logger.debug(
            "Startup cache: prefetched commits for repo %s branch %s",
            repository["id"],
            branch_name,
        )
    except Exception as e:
        logger.warning(
            "Startup cache: commits prefetch skipped for repo %s: %s",
            repository.get("id"),
            e,
        )
```

Remove `from services.git.shared_utils import get_git_repo_by_id` from `main.py` (this function was its only caller). Remove the `get_selected_git_repository` call from this function.

---

## Phase 4 — Add `PATCH /api/git-repositories/{id}/toggle-active`

Frontend already posts this from `use-git-mutations-optimistic.ts`:

```typescript
apiCall(`git-repositories/${id}/toggle-active`, {
  method: 'PATCH',
  body: JSON.stringify({ is_active }),
})
```

`GitRepositoryService.update_repository` already accepts `is_active`.

Add to `routers/git/repositories.py` **before** the `/{repo_id}` GET if FastAPI would otherwise treat `toggle-active` as an int (it will not, because the path is `/{repo_id}/toggle-active`). Place it next to PUT.

```python
from pydantic import BaseModel

class GitToggleActiveRequest(BaseModel):
    is_active: bool


@router.patch("/{repo_id}/toggle-active", response_model=GitRepositoryResponse)
async def toggle_repository_active(
    repo_id: int,
    body: GitToggleActiveRequest,
    current_user: dict = Depends(require_permission("git.repositories", "write")),
):
    try:
        existing = git_repo_manager.get_repository(repo_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Repository not found")
        git_repo_manager.update_repository(repo_id, {"is_active": body.is_active})
        updated = git_repo_manager.get_repository(repo_id)
        return GitRepositoryResponse(**dict(updated))
    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(logger, "Internal error", e)
```

Put `GitToggleActiveRequest` in `models/git_repositories.py`, not inline in the router, to match the rest of the stack.

While editing this router, fix the unreachable health route: `GET /health` is registered **after** `GET /{repo_id}`, so `/api/git-repositories/health` matches `/{repo_id}` first and returns 422. No frontend caller exists. Move the `/health` route declaration above the `/{repo_id}` routes (or delete the endpoint) — do not leave it shadowed.

---

## Phase 5 — Delete subsystem B (`git_settings`)

Do this as one PR after Phases 1–3 so SettingsManager still compiles while you move prefetch.

### 5.1 Delete files

| File | Action |
|---|---|
| `backend/routers/settings/git_settings.py` | Delete |
| `backend/services/settings/git_service.py` | Delete |
| `backend/tests/unit/services/test_git_settings_service.py` | Delete |

### 5.2 SQLAlchemy model

**Before** (`core/models/settings.py`): class `GitSetting` mapped to table `git_settings` (lines 60–81).

**After:** delete the entire class.

**Before** (`core/models/__init__.py`):

```python
    GitSetting,
...
    "GitSetting",
```

**After:** remove both.

### 5.3 Repository

**Before** (`repositories/settings/settings_repository.py`): import `GitSetting` and class `GitSettingRepository`.

**After:** remove the import and the class.

### 5.4 Defaults and SettingsManager

**Before** (`services/settings/defaults.py`):

```python
__all__ = [
    ...
    "GitSettings",
    ...
]

@dataclass
class GitSettings:
    repo_url: str = ""
    branch: str = "main"
    username: str = ""
    token: str = ""
    config_path: str = "configs/"
    sync_interval: int = 15
    verify_ssl: bool = True
```

**After:** remove `GitSettings` from `__all__` and delete the dataclass.

**Before** (`services/settings/manager.py`):

```python
from services.settings.defaults import (
    ...
    GitSettings,
    ...
)
from services.settings.git_service import GitSettingsService
...
        self._git = GitSettingsService(GitSettings())
...
    def get_git_settings(self) -> Dict[str, Any]:
        return self._git.get()

    def update_git_settings(self, settings: Dict[str, Any]) -> bool:
        return self._git.update(settings)

    def get_selected_git_repository(self) -> Optional[int]:
        return self._git.get_selected_repository()

    def set_selected_git_repository(self, repository_id: int) -> bool:
        return self._git.set_selected_repository(repository_id)
...
    def get_all_settings(self) -> Dict[str, Any]:
        return {
            "nautobot": self.get_nautobot_settings(),
            "git": self.get_git_settings(),
            "checkmk": self.get_checkmk_settings(),
            "cache": self.get_cache_settings(),
            "metadata": self._system.get_metadata(),
        }

    def update_all_settings(self, settings: Dict[str, Any]) -> bool:
        success = True
        if "nautobot" in settings:
            success &= self.update_nautobot_settings(settings["nautobot"])
        if "git" in settings:
            success &= self.update_git_settings(settings["git"])
        if "checkmk" in settings:
            success &= self.update_checkmk_settings(settings["checkmk"])
        if "cache" in settings:
            success &= self.update_cache_settings(settings["cache"])
        return success
```

**After:** drop `GitSettings`, `GitSettingsService`, `self._git`, and the four Git methods. `get_all_settings` has no `git` key. `update_all_settings` has no `if "git"` branch.

### 5.5 System settings

**Before** (`services/settings/system_service.py`):

```python
from repositories.settings.settings_repository import (
    GitSettingRepository,
    NautobotSettingRepository,
    SettingsMetadataRepository,
)
...
            git_repo = GitSettingRepository()
            return {
                "status": "healthy",
                "database_type": "postgresql",
                "nautobot_settings_count": 1 if nautobot_repo.get_settings() else 0,
                "git_settings_count": 1 if git_repo.get_settings() else 0,
            }
...
                GitSetting,
...
                session.query(GitSetting).delete()
```

**After:**

```python
from repositories.settings.settings_repository import (
    NautobotSettingRepository,
    SettingsMetadataRepository,
)
...
            return {
                "status": "healthy",
                "database_type": "postgresql",
                "nautobot_settings_count": 1 if nautobot_repo.get_settings() else 0,
            }
...
            from core.models import (
                CacheSetting,
                CheckMKSetting,
                NautobotSetting,
            )
...
                session.query(NautobotSetting).delete()
                session.query(CheckMKSetting).delete()
                session.query(CacheSetting).delete()
```

Update `tests/unit/services/test_system_settings_service.py`:

- Remove `_PATCH_GIT_REPO` and every `git_settings_count` assertion.
- Remove `GitSettingRepository` patches from `test_health_check_returns_healthy` and `test_health_check_includes_database_type`.

### 5.6 Pydantic settings models

**Before** (`models/settings.py`):

```python
class GitSettingsRequest(BaseModel):
    repo_url: str
    branch: str = "main"
    username: Optional[str] = ""
    token: Optional[str] = ""
    config_path: str = "configs/"
    sync_interval: int = 15
    verify_ssl: bool = True

class AllSettingsRequest(BaseModel):
    nautobot: NautobotSettingsRequest
    git: GitSettingsRequest
    checkmk: Optional[CheckMKSettingsRequest] = None
    cache: Optional[CacheSettingsRequest] = None

class GitTestRequest(BaseModel):
    repo_url: str
    branch: str = "main"
    username: Optional[str] = ""
    token: Optional[str] = ""
    verify_ssl: bool = True
```

**After:** delete `GitSettingsRequest` and `GitTestRequest`.

```python
class AllSettingsRequest(BaseModel):
    nautobot: NautobotSettingsRequest
    checkmk: Optional[CheckMKSettingsRequest] = None
    cache: Optional[CacheSettingsRequest] = None
```

**Before** (`models/__init__.py`): imports and `__all__` entries for `GitSettingsRequest` and `GitTestRequest`.

**After:** remove them.

**Before** (`routers/settings/common.py` `update_all_settings`):

```python
        settings_dict = {
            "nautobot": settings_request.nautobot.dict(),
            "git": settings_request.git.dict(),
        }
```

**After:**

```python
        settings_dict = {
            "nautobot": settings_request.nautobot.dict(),
        }
```

### 5.7 Router registration

**Before** (`routers/settings/__init__.py`):

```python
from .git_settings import router as git_settings_router
...
    "git_settings_router",
```

**After:** remove both.

**Before** (`main.py`):

```python
    git_settings_router,
...
app.include_router(git_settings_router)
```

**After:** remove both. Keep `app.include_router(git_router)`.

### 5.8 `connection_tester.py`

**Before:** methods `test_git_connection` (lines 209–328) and `test_all_connections` (lines 331–373). Module-level `connection_tester` stays for Nautobot tests.

**After:** delete those two methods. Keep `test_nautobot_connection`. If `test_all_connections` is the only caller of Git besides the settings router, nothing else needs a stub.

Grep (must be empty except this plan and the analysis doc):

```bash
rg -n "git_settings|GitSetting[^s]|GitSettingsService|GitSettingsRequest|GitTestRequest|test_git_connection|get_git_settings|update_git_settings|get_selected_git_repository" backend
```

Allowed remaining hits: comments you choose to leave, and `GitConnectionTestRequest` (different name).

### 5.9 Drop the leftover table

Auto-schema does not drop tables. After deploy:

```bash
cd backend
python scripts/database/sync.py --table git_settings
python scripts/database/sync.py --migrate --drop --table git_settings
```

Until you drop it, an empty `git_settings` table can remain. It has no code path.

Optional: delete `settings_metadata` row `selected_git_repository` if present. Nothing reads it after Phase 3.

---

## Phase 6 — Dead models and leftover helpers

### 6.1 `models/git.py`

Keep: `GitAuthor`, `GitCommit`, `DiffStats`, `DiffLine`, `DiffResult`, `SyncResult`, `CloneResult`, `commit_to_dict`, `create_git_commit` (keep `create_git_commit` only if something still calls it; grep first).

Delete these classes (no production caller):

- `GitCommitDetails`
- `CommitStats`
- `StatusInfo`
- `FileHistoryCommit`
- `FileHistory`
- `GitBranch`
- `CommitComparison`
- `CrossRepoComparison`
- `GitCommitRequest`
- `GitBranchRequest`

**Before** (`models/__init__.py`):

```python
from .git import GitBranchRequest, GitCommitRequest
...
    "GitCommitRequest",
    "GitBranchRequest",
```

**After:** remove those imports and `__all__` entries.

### 6.2 `models/git_repositories.py`

Delete `GitSyncRequest` and `GitSyncResponse` (no endpoint uses them). Keep `GitConnectionTestRequest` and `GitConnectionTestResponse`.

### 6.3 Cache subprocess fallback

**Before** (`services/git/cache.py`): `_fetch_commits_from_repo` catches any GitPython error and calls `_fetch_commits_subprocess`. `import subprocess` exists for that.

**After:** on GitPython failure, log and re-raise or return `[]`. Delete `_fetch_commits_subprocess` and the `subprocess` import.

Delete tests `test_fetch_commits_subprocess_parses_log` and `test_fetch_commits_subprocess_returns_empty_on_failure` in `test_git_cache_service.py`.

### 6.4 Factory injectors

Keep `get_git_service` and `get_git_diff_service` (Phase 2 and 3 use them).

If `get_git_diff_service` was unused before Phase 3, it is live after Phase 3. Do not delete it.

### 6.5 `GitService.get_status`

`GitService.get_status` (local working-tree status: `is_dirty`, `untracked_files`, `modified_files`, `staged_files`) has **no production caller** — only `test_git_service.py`. The API status endpoint uses `get_repository_status` (moved onto `GitService` in Phase 1). Delete the `get_status` method and its tests so the engine has exactly one status implementation. Grep first to confirm nothing new started calling it:

```bash
rg -n "git_service\.get_status|GitService\(\)\.get_status" backend
```

---

## Phase 7 — Frontend leftovers and porting doc

### 7.1 Template form Git URL fields

These fields POST on create and update and are dropped by `TemplateRequest` (no SQLAlchemy columns). Git templates come from repositories with `category=templates`.

Files:

- `frontend/src/components/features/settings/templates/components/template-form.tsx`
- `frontend/src/components/features/settings/templates/hooks/use-template-mutations.ts`
- `frontend/src/components/features/settings/templates/types/index.ts`
- `frontend/src/components/features/settings/templates/utils/constants.ts`

**Before** (form schema and UI): `git_repo_url`, `git_branch`, `git_path`, `git_username`, `git_token` inputs when `source === 'git'`.

**After:** remove those schema fields, defaults, and mutation assignments. When `watchedSource === 'git'`, replace the URL card with copy that Git-sourced templates are files from repositories registered under **Settings → Git** with category **templates**, then synced with the template Sync action.

Keep `source: 'git'` as a valid source value. That still maps to DB `templates.source`.

Do not remove `TemplateImportRequest.git_repo_url` (stub `git_bulk` import DTO).

### 7.2 Update `doc/GIT_SERVICE.md`

After the code matches this plan, edit the implementation reference:

- Service layer: there is no `GitOperationsService`. Document `GitService.sync_repository`, `remove_and_sync`, `get_repository_status`.
- Routers: `/sync` and `/remove-and-sync` delegate to `GitService`. `/commits` uses `GitCacheService`. `/diff` uses `GitDiffService.compare_commits_side_by_side`.
- Porting checklist: do not list `operations.py`. Do not mention `git_settings`.
- Add an explicit "do not copy" list: `routers/settings/git_settings.py`, `services/settings/git_service.py`, `GitSetting` model.

Point readers at this refactoring doc as historical context only.

---

## Phase 8 — Tests and verification

### 8.1 Tests to rewrite

| File | Change |
|---|---|
| `tests/unit/services/test_git_operations_service.py` | Retarget to `GitService` or merge into `test_git_service.py`, then delete |
| `tests/unit/services/test_git_service.py` | Add sync (clone path and pull path) and `remove_and_sync`; delete the two `get_status` tests (Phase 6.5) |
| `tests/unit/services/test_git_diff_service.py` | Add `compare_commits_side_by_side` |
| `tests/unit/services/test_git_cache_service.py` | Delete subprocess tests; adjust any test asserting the cache-write skip at `max_commits` (Phase 3.1 makes the write unconditional) |
| `tests/unit/services/test_git_settings_service.py` | Delete file |
| `tests/unit/services/test_system_settings_service.py` | Drop git_settings patches and assertions |

Add a router unit test for `PATCH .../toggle-active` if you have a git repositories router test module. If none exists, a service-level test of `update_repository(..., {"is_active": False})` is enough.

### 8.2 Commands (definition of done)

From `backend/`:

```bash
ruff format .
ruff check --fix .
python scripts/check_asyncio_run.py
python scripts/check_http_500_leaks.py
python scripts/check_router_repositories.py
python scripts/check_text_sql.py
python scripts/check_blocking_http_in_async.py
pytest -q
```

From `frontend/`:

```bash
npm run lint
```

### 8.3 Grep gates (must be empty in `backend/` except comments you intend)

```bash
rg -n "GitOperationsService|services\.git\.operations" backend
rg -n "origin.set_url" backend/services/git backend/routers/git
rg -n "GitSetting[^sR]|GitSettingsService|git_settings_router|GitSettingsRequest" backend
rg -n "test_all_connections|def test_git_connection" backend
rg -n "GitCommitRequest|GitBranchRequest|GitSyncRequest" backend
rg -n "toggle-active" backend/routers/git
```

Last grep must have a hit (the new route).

### 8.4 Manual product checks

1. **Settings → Git Management:** create a repo with a stored credential, test connection, sync, open status, toggle active (no 404).
2. **Sync then remove-and-sync:** working tree refreshes. `git remote -v` in the clone has **no** embedded token.
3. **Config viewer diff:** open two commits of one file. Side-by-side still renders (`left_lines` / `right_lines`).
4. **Templates:** sync git templates. Test connection still uses `GitConnectionService`.
5. **Backup / inventory / agent deploy:** still commit and push through `GitService` (no code change required in those callers if they already use `build_git_service()`).

---

## 9. File checklist

### Create

None required. All work is edit or delete. Optional: `models/git_repositories.py` already exists for `GitToggleActiveRequest`.

### Edit

- `backend/services/git/service.py`
- `backend/services/git/diff.py`
- `backend/services/git/cache.py`
- `backend/routers/git/operations.py`
- `backend/routers/git/version_control.py`
- `backend/routers/git/repositories.py`
- `backend/routers/git/debug.py` (push test)
- `backend/routers/settings/templates/git.py`
- `backend/service_factory.py`
- `backend/dependencies.py`
- `backend/main.py`
- `backend/core/models/settings.py`
- `backend/core/models/__init__.py`
- `backend/repositories/settings/settings_repository.py`
- `backend/services/settings/defaults.py`
- `backend/services/settings/manager.py`
- `backend/services/settings/system_service.py`
- `backend/models/settings.py`
- `backend/models/__init__.py`
- `backend/models/git.py`
- `backend/models/git_repositories.py`
- `backend/routers/settings/__init__.py`
- `backend/routers/settings/common.py`
- `backend/connection_tester.py`
- frontend template form files listed in Phase 7
- `doc/GIT_SERVICE.md`

### Delete

- `backend/services/git/operations.py`
- `backend/routers/settings/git_settings.py`
- `backend/services/settings/git_service.py`
- `backend/tests/unit/services/test_git_settings_service.py`
- `backend/tests/unit/services/test_git_operations_service.py` (if merged into `test_git_service.py`)

### Do not touch (already on the single subsystem)

- `backend/services/git/auth.py`, `config.py`, `env.py`, `paths.py`, `path_containment.py`, `shared_utils.py`
- `backend/services/git/file_*.py`, `file_service.py`
- `backend/services/inventory/git_storage_service.py`
- `backend/services/agents/deployment_service.py`
- backup and snapshot callers of `GitService.open_or_clone` / `commit_and_push`

---

## 10. What "one working Git subsystem" means when you are done

- One table: `git_repositories`.
- One engine class for clone, pull, push, commit, sync, status: `GitService`.
- One connection tester: `GitConnectionService`.
- One cache: `GitCacheService` (GitPython only).
- One diff implementation used by the API: `GitDiffService.compare_commits_side_by_side`.
- No `/api/settings/git`.
- No plaintext Git token column.
- No second clone path in a router.
- One status implementation: `GitService.get_repository_status` (`get_status` deleted).
- No shadowed routes: `/api/git-repositories/health` reachable or removed; `toggle-active` returns 200.
- Porting from `GIT_SERVICE.md` cannot pick up a second stack because it is gone.
