# Git subsystem analysis

Backend review of the Git code in cockpit-ng. The question was whether there is one Git subsystem, whether it is implemented correctly, and whether leftover or dead code explains why a port of this feature produced two Git subsystems.

**Verdict:** there are two independent Git subsystems. That is leftover architecture in this repo, not a copy error during porting. The live product uses only subsystem A (`git_repositories`). Subsystem B (`git_settings`) is still registered, still writable, and has no frontend caller.

`GIT_SERVICE.md` documents A only. Anyone who copies Git-related files from the tree, rather than from that document, takes both stacks.

---

## Table of contents

1. [The two subsystems](#the-two-subsystems)
2. [Comparison](#comparison)
3. [Is subsystem A correctly implemented?](#is-subsystem-a-correctly-implemented)
4. [Three clone and pull implementations inside A](#three-clone-and-pull-implementations-inside-a)
5. [Connection tests](#connection-tests)
6. [Dead, unused, or leftover code](#dead-unused-or-leftover-code)
7. [What is not a second subsystem](#what-is-not-a-second-subsystem)
8. [Recommended consolidation](#recommended-consolidation)
9. [Porting rule](#porting-rule)

---

## The two subsystems

They share the word "git" and little else: different tables, different credential models, different connection tests, different APIs.

### A — Git repositories (live, intended)

This is the system [GIT_SERVICE.md](GIT_SERVICE.md) describes.

- Table: `git_repositories`
- APIs: `/api/git-repositories`, `/api/git/{repo_id}`
- Credentials: `credential_name` into the credentials service. Secrets are never stored on the repository row.
- On-disk clones: `{DATA_DIR}/git/{path_or_name}/`
- Operations: GitPython via `GitService` and `GitOperationsService`
- UI: **Settings → Git Management**
- Consumers: device backups, CSV import and export, inventory JSON, agent deploy, snapshots, templates (`category=templates`)

### B — Git settings (leftover singleton)

This stack is not in `GIT_SERVICE.md`.

- Table: `git_settings` (`repo_url`, `branch`, `username`, `token`, `config_path`, `sync_interval`, `verify_ssl`)
- APIs: `/api/settings/git`, plus the `git` field on GET and PUT `/api/settings`
- Credentials: plaintext `username` and `token` columns on the settings row
- Connection test: `connection_tester.test_git_connection` via `git ls-remote`
- UI: none. No frontend caller found.

The two stacks do not share a code path. The only bridge is `settings_metadata.selected_git_repository`. Nothing in production writes that value, so the startup commit prefetch in `main.py` always skips.

---

## Comparison

| Concern | A — `git_repositories` | B — `git_settings` |
|---|---|---|
| Purpose | Many categorized remotes | One app-wide Git connection |
| Storage | `git_repositories` | `git_settings` (plus `selected_git_repository` metadata) |
| Secrets | Named credential. Never on the repo row. | `username` and `token` columns on the settings row |
| HTTP API | `/api/git-repositories`, `/api/git/{id}` | `/api/settings/git`, `/api/settings` (aggregate) |
| Connection test | `GitConnectionService` shallow clone | `connection_tester` `git ls-remote` |
| Frontend | Git Management page and many feature pickers | None found |
| Porting doc | Fully documented in `GIT_SERVICE.md` | Omitted. Easy to copy by accident from the tree. |

Request flow:

```
Subsystem A (live)
  Git Management UI
    → /api/git-repositories  and  /api/git/{id}
      → services/git  (GitService for writes, GitOperationsService in part)
        → git_repositories table + disk clone

  Feature writers on A (never touch git_settings):
    backup · CSV export · inventory · agents · snapshots · templates sync

Subsystem B (leftover)
  No UI caller
    → /api/settings/git  and  PUT /api/settings
      → GitSettingsService + connection_tester
        → git_settings table (plaintext token)
```

---

## Is subsystem A correctly implemented?

The intended design is sound: SQLAlchemy model → repository → service → router, credentials never inlined, GitPython for local ops. Runtime behavior works for backups, inventory, agents, and the Git UI.

The implementation is not clean. Clone and pull exist three times. The HTTP sync path ignores the operations service. Several services are wired but unused.

### What is right

- Layered CRUD on `git_repositories` with category indexes and credential-by-name auth.
- `GitAuthenticationService` plus `set_ssl_env` and `set_git_author` as shared primitives.
- `GitService` is the real write path: `open_or_clone`, `pull`, `commit`, `push`. Used by backup, CSV export, inventory, agents, and snapshots.
- File browse is a facade (`GitFileService`) over list, read, search, and history. Same pattern as `DeviceCommonService`. Not a second stack.

### Correctness gaps inside A

- `POST /api/git/{id}/sync` does not call `GitOperationsService.sync_repository`. It pastes the same clone and pull logic into the router (about 130 duplicated lines). The same is true of `/remove-and-sync`.
- That router and operations path sets `origin.set_url(clone_url)` (token in the remote URL). `GitService.pull` uses `http.extraHeader` and never persists credentials. Same app, two auth behaviors.
- `GET /api/git/{id}/commits` reimplements cache instead of calling `GitCacheService.get_commits`.
- `POST /api/git/{id}/diff` uses inline `difflib`. `GitDiffService` exists, is factory-wired, and has no production caller.

---

## Three clone and pull implementations inside A

This is the second "two Git systems" feeling people hit when extracting the package: `GitService` versus `GitOperationsService` versus the operations router.

| Implementation | Clone / pull | Used by | Status |
|---|---|---|---|
| `GitService` (`services/git/service.py`, 729 lines) | `open_or_clone`, `clone`, `pull` with `extraHeader` auth | backup, CSV export, inventory, agents, snapshots, `shared_utils` | Canonical write path |
| `GitOperationsService` (`services/git/operations.py`, 455 lines) | `sync_repository`, `remove_and_sync`, `clone_repository`; `set_url` auth | templates sync, plus the status endpoint | Overlaps `GitService`. `clone_repository` unused in production. |
| `routers/git/operations.py` (429 lines) | Inline copy of `GitOperationsService.sync` and `remove_and_sync` | `POST /sync` and `/remove-and-sync` (the UI sync buttons) | Should delegate. Currently duplicates about 250 lines. |

`get_git_service()` in `dependencies.py` is never injected into a router. Callers use `service_factory.build_git_service()` or construct `GitService()` directly.

---

## Connection tests

| Tester | Method | Auth | Caller |
|---|---|---|---|
| `GitConnectionService` | `git clone --depth 1` (subprocess) | Credentials service plus inline fallback | `/api/git-repositories/test-connection` and templates `/git/test` |
| `connection_tester.test_git_connection` | `git ls-remote --heads` | Inline username and token from `GitTestRequest` | `/api/settings/test/git` only |

`test_all_connections()` in `connection_tester.py` has no callers.

Templates wrap `GitConnectionService` with a separate `TemplateGitTestRequest`. That is a thin adapter, not a third engine.

---

## Dead, unused, or leftover code

Git-related backend files total about 8,000 lines. A material share of that is unused or duplicated.

| Item | Where | Why it is leftover |
|---|---|---|
| `git_settings` table, `GitSettingsService`, git settings router | `core/models/settings.py`, `services/settings/git_service.py`, `routers/settings/git_settings.py` | No UI. Aggregate GET and PUT `/api/settings` still include it. |
| `GitDiffService` | `services/git/diff.py` plus factory and tests only | Diff endpoint uses inline `difflib` in `version_control.py`. |
| `get_git_service()`, `get_git_diff_service()` | `dependencies.py` | Never injected into a router. |
| `GitService.clone()` | `services/git/service.py` | No production caller. `open_or_clone` covers the same ground. |
| `GitService.get_status()` | `services/git/service.py` | Tests only. The status endpoint uses `GitOperationsService.get_repository_status` instead. |
| `GitOperationsService.clone_repository()` | `services/git/operations.py` | Tests only. |
| `get_cached_commits()` | `routers/git/operations.py` | Defined, marked deprecated, never called. |
| `test_all_connections()` | `connection_tester.py` | No callers. |
| `set_selected_git_repository()` | `GitSettingsService` / `SettingsManager` | Never called in production. Startup cache prefetch therefore always skips. |
| `GitCommitRequest`, `GitBranchRequest` | `models/git.py`, re-exported from `models/__init__.py` | No endpoint uses them. |
| `GitSyncRequest`, `GitSyncResponse` | `models/git_repositories.py` | No endpoint uses them. |
| `StatusInfo`, `FileHistory`, `GitCommitDetails`, `CommitComparison`, `CrossRepoComparison` | `models/git.py` | Unused pydantic shapes. `SyncResult`, `CloneResult`, and `DiffResult` are used. |
| `toggle-active` API | frontend `use-git-mutations-optimistic.ts` | Frontend posts `git-repositories/{id}/toggle-active`. Backend has no such route. |
| `GET /api/git-repositories/health` | `routers/git/repositories.py` | Registered after `GET /{repo_id}`, so the literal path is shadowed and always returns 422. No frontend caller. |
| Template `git_repo_url` / `git_branch` | frontend template form plus pydantic Template models | SQLAlchemy `Template` has no such columns. Sync uses `category=templates` repos instead. |

`GitCacheService` still contains a `subprocess` fallback for listing commits (`_fetch_commits_subprocess`). The primary path is GitPython.

The debug router (`routers/git/debug.py`, 834 lines) is fat but unique (read, write, delete, push, diagnostics). The push test could call `GitService.commit_and_push` instead of inlining Git.

---

## What is not a second subsystem

These look Git-related and are domain helpers or facades on top of A, not parallel engines.

| Piece | Role |
|---|---|
| `GitFileService` plus `file_list_service`, `file_read_service`, `file_search_service`, `file_history_service` | Facade over list, read, search, and history. Keep. |
| `InventoryGitStorage` | Writes `inventories/*.json` via `GitService`. |
| Templates `/git/test` and `/sync` | Feature router on `GitConnectionService` and `GitOperationsService`. Extra request DTO, same engine. |
| Debug router | Diagnostic endpoints for a managed repository. |

---

## Recommended consolidation

Treat A as the only Git subsystem. Collapse duplicate ops inside A. Delete B after confirming no external client hits `/api/settings/git`.

| Priority | Change | Effect |
|---|---|---|
| 1 | Point `POST /sync` and `/remove-and-sync` at `GitOperationsService` (or better: `GitService.open_or_clone` plus `pull`) | Removes about 250 duplicated router lines. One auth behavior. |
| 2 | Fold `GitOperationsService` into `GitService` (`sync` = `open_or_clone` plus `pull`; status stays as a method) | One operational core. Matches the class docstring on `GitService`. |
| 3 | Route `GET /commits` and `POST /diff` through `GitCacheService` and `GitDiffService` | Stops the service and router split that `GIT_SERVICE.md` already warns about. |
| 4 | Remove `git_settings`: table, `GitSettingsService`, git settings router, `GitSettingsRequest` from `AllSettingsRequest`, `connection_tester` Git test | Porting a second subsystem becomes impossible because it is gone. |
| 5 | Delete unused pydantic models, `get_cached_commits`, unused factory injectors, and template `git_repo_url` fields. Add the missing `toggle-active` route or remove the frontend call. | Dead code and the frontend 404 go away. |

Use `GitService.pull` auth (`http.extraHeader`) as the single token-auth behavior. Do not persist credentials in `origin` URLs.

---

## Porting rule

Copy only:

- `backend/services/git/`
- `backend/routers/git/`
- `backend/core/models/git.py`
- `backend/models/git_repositories.py`
- `backend/repositories/git/`

Do not copy:

- `backend/routers/settings/git_settings.py`
- `backend/services/settings/git_service.py`
- the `git_settings` table (`GitSetting` in `core/models/settings.py`)
- `connection_tester.test_git_connection` as a second connection tester

After a port, grep the destination for `git_settings` and `/api/settings/git`. If either exists, the leftover singleton came along.

For the intended feature surface and wiring, use [GIT_SERVICE.md](GIT_SERVICE.md). Treat this document as the map of what that reference omits and what is duplicated inside the live stack.
