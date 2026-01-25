# Git Endpoints Usage Analysis

**Purpose:** Document all Git-related API endpoints and their usage across the application to identify which endpoints can be safely removed.

**Created:** 2026-01-25  
**Status:** Active Analysis

---

## Overview

This document catalogs all Git-related endpoints (prefixed with `/api/git/` or `/api/git-repositories/`) and tracks which frontend components use each endpoint. This analysis helps identify unused endpoints that can be removed during refactoring.

**Important Discovery:** Most Git operations (clone, commit, push) are performed **directly by backend services** using the `git_service` Python module, **NOT through HTTP API endpoints**. The API endpoints are primarily used by the frontend for read operations and repository management.

---

## Git Service Architecture

### Backend Git Operations (Direct Service Calls)

The application uses a **dual approach** for Git operations:

1. **Backend Services (Internal)** - Direct Git operations via `services.settings.git.service.GitService`
2. **API Endpoints (External)** - HTTP endpoints for frontend consumption

#### Backend Components Using `git_service` Directly

**The following backend components perform Git operations WITHOUT using API endpoints:**

1. **Device Backup Task** (`backend/tasks/backup_tasks.py`)
   - Uses: `git_service.commit_and_push()`
   - Purpose: Commits and pushes device configurations to Git after backup
   - Flow: Connect to device → Save config → Commit → Push

2. **Backup Executor** (`backend/tasks/execution/backup_executor.py`)
   - Uses: `git_service.commit_and_push()`
   - Purpose: Job execution workflow for device backups

3. **Ansible Inventory Service** (`backend/services/inventory/inventory.py`)
   - Uses: `git_service.commit_and_push()`
   - Purpose: Commits generated Ansible inventory files to Git

4. **Ansible Inventory Router** (`backend/routers/inventory/ansible_inventory.py`)
   - Uses: `git_service.commit_and_push()`
   - Purpose: Push-to-git endpoint for inventory management

5. **Snapshot Execution Service** (`backend/services/network/snapshots/execution_service.py`)
   - Uses: `git_service.commit_and_push()` (called twice)
   - Purpose: Commits network snapshots to Git repository

#### Key GitService Methods Used Internally

```python
# From backend/services/settings/git/service.py

git_service.open_or_clone(repository)     # Clone or open existing repo
git_service.commit_and_push(repository, message, ...)  # Commit + push in one operation
git_service.commit(repository, message, files, ...)    # Just commit
git_service.push(repository, branch, ...)              # Just push
git_service.fetch(repository, ...)                     # Fetch updates
git_service.pull(repository, ...)                      # Pull changes
```

**Critical Finding:** The unused POST endpoints for commits and branches were likely intended for frontend-triggered Git operations, but the application evolved to handle all write operations through backend services instead. This is the correct architectural pattern - frontend requests actions via task endpoints (like `/tasks/backup-devices`), and backend services handle Git operations internally.

---

## Endpoint Categories

### 1. Repository Management (`/api/git-repositories/`)
Backend: `backend/routers/settings/git/repositories.py`

| Endpoint | Method | Purpose | Used By | Status |
|----------|--------|---------|---------|--------|
| `/api/git-repositories/` | GET | List all repositories | Multiple components | ✅ **ACTIVE** |
| `/api/git-repositories/{repo_id}` | GET | Get repository details | Settings > Git Management | ✅ **ACTIVE** |
| `/api/git-repositories/{repo_id}/edit` | GET | Get repository for editing | Settings > Git Management | ✅ **ACTIVE** |
| `/api/git-repositories/` | POST | Create new repository | Settings > Git Management | ✅ **ACTIVE** |
| `/api/git-repositories/{repo_id}` | PUT | Update repository | Settings > Git Management | ✅ **ACTIVE** |
| `/api/git-repositories/{repo_id}` | DELETE | Delete repository | Settings > Git Management | ✅ **ACTIVE** |
| `/api/git-repositories/test-connection` | POST | Test repository connection | Settings > Git Management | ✅ **ACTIVE** |
| `/api/git-repositories/health` | GET | Health check | System monitoring | ✅ **ACTIVE** |

**Frontend Components Using Repository Management:**
- `frontend/src/components/features/settings/git/git-management.tsx` - Main Git settings page
- `frontend/src/components/features/settings/git/hooks/queries/use-git-repositories-query.ts` - Repository data fetching
- `frontend/src/components/features/settings/git/hooks/queries/use-git-mutations.ts` - Repository CRUD operations
- `frontend/src/components/features/settings/git/hooks/use-git-mutations-optimistic.ts` - Optimistic updates
- `frontend/src/components/features/shared/git/hooks/use-git-repositories.ts` - Shared repository access
- `frontend/src/components/features/network/configs/view/configs-view-page.tsx` - Config file browser
- `frontend/src/components/features/settings/common/dialogs/git-import-dialog.tsx` - Import from Git
- `frontend/src/components/features/settings/connections/grafana/grafana-settings.tsx` - Grafana settings
- `frontend/src/components/features/general/inventory/inventory-page.tsx` - Ansible inventory

---

### 2. Repository Operations (`/api/git/{repo_id}/`)
Backend: `backend/routers/settings/git/operations.py`

| Endpoint | Method | Purpose | Used By | Status |
|----------|--------|---------|---------|--------|
| `/api/git/{repo_id}/status` | GET | Get repository sync status | Settings > Git Management | ✅ **ACTIVE** |
| `/api/git/{repo_id}/sync` | POST | Sync repository (pull) | Settings > Git Management | ✅ **ACTIVE** |
| `/api/git/{repo_id}/remove-and-sync` | POST | Remove local and re-clone | Settings > Git Management | ✅ **ACTIVE** |
| `/api/git/{repo_id}/info` | GET | Get repository information | Settings > Git Management | ⚠️ **VERIFY** |
| `/api/git/{repo_id}/debug` | GET | Debug information | Settings > Git Management | ⚠️ **VERIFY** |

**Frontend Components Using Repository Operations:**
- `frontend/src/components/features/settings/git/hooks/use-repository-status.ts` - Status checking
- `frontend/src/components/features/settings/git/hooks/queries/use-git-mutations.ts` - Sync operations
- `frontend/src/components/features/settings/git/hooks/use-git-mutations-optimistic.ts` - Optimistic sync
- `frontend/src/components/features/settings/common/dialogs/git-import-dialog.tsx` - Import dialog

---

### 3. Version Control Operations (`/api/git/{repo_id}/`)
Backend: `backend/routers/settings/git/version_control.py`

| Endpoint | Method | Purpose | Used By | Status |
|----------|--------|---------|---------|--------|
| `/api/git/{repo_id}/branches` | GET | List branches | Shared Git Components | ✅ **ACTIVE** |
| `/api/git/{repo_id}/branches` | POST | Create new branch | Not found | ❌ **UNUSED** |
| `/api/git/{repo_id}/commits/{branch_name}` | GET | Get commits for branch | Shared Git Components | ✅ **ACTIVE** |
| `/api/git/{repo_id}/commits` | POST | Create commit | Not found | ❌ **UNUSED** |
| `/api/git/{repo_id}/commits/{commit_hash}/diff` | GET | Get commit diff | Not found | ❌ **UNUSED** |
| `/api/git/{repo_id}/diff` | POST | Compare commits/files | Config File Browser | ✅ **ACTIVE** |
| `/api/git/{repo_id}/compare-files` | POST | Compare two files | Not found | ❌ **UNUSED** |

**Frontend Components Using Version Control:**
- `frontend/src/components/features/shared/git/hooks/use-git-branches.ts` - Branch listing
- `frontend/src/components/features/shared/git/hooks/use-git-commits.ts` - Commit history
- `frontend/src/hooks/queries/use-file-diff-query.ts` - File comparison

---

### 4. File Operations (`/api/git/{repo_id}/`)
Backend: `backend/routers/settings/git/files.py`

| Endpoint | Method | Purpose | Used By | Status |
|----------|--------|---------|---------|--------|
| `/api/git/{repo_id}/files/search` | GET | Search files in repository | Config File Browser | ✅ **ACTIVE** |
| `/api/git/{repo_id}/files/{commit_hash}/commit` | GET | Get file at specific commit | Config File Browser (History) | ✅ **ACTIVE** |
| `/api/git/{repo_id}/files/{file_path}/history` | GET | Get file history (summary) | Not found | ⚠️ **VERIFY** |
| `/api/git/{repo_id}/files/{file_path}/complete-history` | GET | Get complete file history | Config File Browser | ✅ **ACTIVE** |
| `/api/git/{repo_id}/file-content` | GET | Get current file content | Config File Browser | ✅ **ACTIVE** |
| `/api/git/{repo_id}/tree` | GET | Get repository tree structure | Config File Browser | ✅ **ACTIVE** |
| `/api/git/{repo_id}/directory` | GET | List files in directory | Config File Browser | ✅ **ACTIVE** |

**Frontend Components Using File Operations:**
- `frontend/src/components/features/network/configs/view/configs-view-page.tsx` - Main file browser
- `frontend/src/components/features/network/configs/view/dialogs/file-history-dialog.tsx` - File history
- `frontend/src/hooks/queries/use-git-tree-query.ts` - Tree structure
- `frontend/src/hooks/queries/use-file-content-query.ts` - File content
- `frontend/src/hooks/queries/use-directory-files-query.ts` - Directory listing
- `frontend/src/hooks/queries/use-file-history-query.ts` - File history
- `frontend/src/components/features/settings/common/dialogs/git-import-dialog.tsx` - Import from Git

---

### 5. Debug Operations (`/api/git-repositories/{repo_id}/debug/`)
Backend: `backend/routers/settings/git/debug.py`

| Endpoint | Method | Purpose | Used By | Status |
|----------|--------|---------|---------|--------|
| `/api/git-repositories/{repo_id}/debug/read` | POST | Test read operations | Settings > Git Debug | ✅ **ACTIVE** |
| `/api/git-repositories/{repo_id}/debug/write` | POST | Test write operations | Settings > Git Debug | ✅ **ACTIVE** |
| `/api/git-repositories/{repo_id}/debug/delete` | POST | Test delete operations | Settings > Git Debug | ✅ **ACTIVE** |
| `/api/git-repositories/{repo_id}/debug/push` | POST | Test push operations | Settings > Git Debug | ✅ **ACTIVE** |
| `/api/git-repositories/{repo_id}/debug/diagnostics` | GET | Get diagnostics | Settings > Git Debug | ✅ **ACTIVE** |

**Frontend Components Using Debug Operations:**
- `frontend/src/components/features/settings/git/hooks/use-repository-debug.ts` - Debug operations
- `frontend/src/components/features/settings/git/components/repository-debug-dialog/` - Debug UI

---

### 6. Cross-Repository Comparison (`/api/git-compare/`)
Backend: `backend/routers/settings/git/compare.py`

| Endpoint | Method | Purpose | Used By | Status |
|----------|--------|---------|---------|--------|
| `/api/git-compare/repos` | POST | Compare across repositories | Not found | ❌ **UNUSED** |

**Note:** This endpoint was likely used by the removed `/compare` feature.

---

### 7. Legacy File Compare Endpoints (`/api/file-compare/`)
Backend: `backend/routers/network/configs/compare.py`

| Endpoint | Method | Purpose | Used By | Status |
|----------|--------|---------|---------|--------|
| `/api/file-compare/list` | GET | List config files | Not found | ❌ **UNUSED** |
| `/api/file-compare/compare` | POST | Compare configuration files | Not found | ❌ **UNUSED** |
| `/api/file-compare/export-diff` | POST | Export diff | Not found | ❌ **UNUSED** |
| `/api/file-compare/config` | GET | Get compare config | Not found | ❌ **UNUSED** |

**Note:** These endpoints were used by the removed `/compare` feature. They are separate from the Git endpoints but related to file comparison functionality.

---

### 8. Ansible Inventory Git Integration (`/api/ansible-inventory/`)
Backend: `backend/routers/inventory/ansible_inventory.py`

| Endpoint | Method | Purpose | Used By | Status |
|----------|--------|---------|---------|--------|
| `/api/ansible-inventory/git-repositories` | GET | Get Git repos for inventory | General > Inventory | ✅ **ACTIVE** |
| `/api/ansible-inventory/push-to-git` | POST | Push inventory to Git | General > Inventory | ✅ **ACTIVE** |

**Frontend Components Using Ansible Git Integration:**
- `frontend/src/components/features/general/inventory/inventory-page.tsx` - Inventory management
- `frontend/src/components/features/general/inventory/tabs/inventory-generation-tab.tsx` - Inventory generation

---

## Summary Statistics

### Active Endpoints
**Total Git-related endpoints:** 33  
**Actively used:** 24 (73%)  
**Unused:** 6 (18%)  
**Need verification:** 3 (9%)

### Breakdown by Category
1. **Repository Management:** 8/8 active (100%)
2. **Repository Operations:** 3/5 active (60%)
3. **Version Control:** 3/7 active (43%) ⚠️
4. **File Operations:** 6/7 active (86%)
5. **Debug Operations:** 5/5 active (100%)
6. **Cross-Repository Compare:** 0/1 active (0%) ❌
7. **Legacy File Compare:** 0/4 active (0%) ❌
8. **Ansible Git Integration:** 2/2 active (100%)

---

## Endpoints Marked for Removal

### ❌ Confirmed Unused (Can be removed)

1. **POST /api/git/{repo_id}/branches**
   - Purpose: Create new branch
   - Backend: `backend/routers/settings/git/version_control.py:53`
   - Reason: No frontend usage found. Backend services don't use API endpoints for Git operations.

2. **POST /api/git/{repo_id}/commits**
   - Purpose: Create commit
   - Backend: `backend/routers/settings/git/version_control.py:146`
   - Reason: No frontend usage found. Backend services use `git_service.commit()` directly instead.
   - Note: All commits are made by backend services (backup_tasks, snapshot tasks, inventory) using internal `git_service`.

3. **GET /api/git/{repo_id}/commits/{commit_hash}/diff**
   - Purpose: Get commit diff
   - Backend: `backend/routers/settings/git/version_control.py:185`
   - Reason: No frontend usage found (uses `/diff` endpoint instead)

4. **POST /api/git/{repo_id}/compare-files**
   - Purpose: Compare two files
   - Backend: `backend/routers/settings/git/version_control.py:382`
   - Reason: No frontend usage found

5. **POST /api/git-compare/repos**
   - Purpose: Compare across repositories
   - Backend: `backend/routers/settings/git/compare.py:19`
   - Reason: Used by removed `/compare` feature

6. **ALL /api/file-compare/ endpoints** (4 endpoints)
   - Backend: `backend/routers/network/configs/compare.py`
   - Reason: Used by removed `/compare` feature
   - Endpoints:
     - GET `/api/file-compare/list`
     - POST `/api/file-compare/compare`
     - POST `/api/file-compare/export-diff`
     - GET `/api/file-compare/config`

### ⚠️ Needs Verification (Check before removal)

1. **GET /api/git/{repo_id}/files/{file_path}/history**
   - Purpose: Get file history (summary version)
   - Backend: `backend/routers/settings/git/files.py:199`
   - Note: Frontend uses `/complete-history` instead. Verify if this summary version is still needed.

2. **GET /api/git/{repo_id}/info**
   - Purpose: Get repository information
   - Backend: `backend/routers/settings/git/operations.py:338`
   - Note: Might be used by backend services or monitoring. Verify backend usage.

3. **GET /api/git/{repo_id}/debug**
   - Purpose: Debug information
   - Backend: `backend/routers/settings/git/operations.py:402`
   - Note: Different from `/debug/diagnostics`. Verify if still needed.

---

## Primary Frontend Components Using Git Endpoints

### High-Usage Components (Core Features)

1. **Config File Browser** (`frontend/src/components/features/network/configs/view/`)
   - Main file: `configs-view-page.tsx`
   - Endpoints used: 7 different endpoints
   - Core functionality for browsing device configurations

2. **Git Management Settings** (`frontend/src/components/features/settings/git/`)
   - Main file: `git-management.tsx`
   - Endpoints used: 10+ different endpoints
   - Core functionality for managing Git repositories

3. **Git Import Dialog** (`frontend/src/components/features/settings/common/dialogs/git-import-dialog.tsx`)
   - Endpoints used: 5 different endpoints
   - Used by Settings pages for importing from Git

### Medium-Usage Components

4. **Ansible Inventory** (`frontend/src/components/features/general/inventory/`)
   - Main file: `inventory-page.tsx`
   - Endpoints used: 2 endpoints (git-repositories, push-to-git)
   - Git integration for inventory management

5. **Grafana Settings** (`frontend/src/components/features/settings/connections/grafana/`)
   - Main file: `grafana-settings.tsx`
   - Endpoints used: 1 endpoint (list repositories)
   - Repository selection for Grafana configuration

---

## Backend Services Using Git Internally

**These backend components commit and push to Git using `git_service` directly (NOT via API endpoints):**

### Celery Tasks (Automated Git Operations)

1. **Device Backup Task** (`backend/tasks/backup_tasks.py`)
   ```python
   git_service.commit_and_push(repository, message="Backup config {date}", add_all=True)
   ```
   - Triggered by: `POST /api/celery/tasks/backup-devices`
   - Git operations: Clone/open repo → Save configs → Commit all changes → Push
   - No API endpoint usage for Git operations

2. **Backup Executor** (`backend/tasks/execution/backup_executor.py`)
   ```python
   git_service.commit_and_push(repository, message, ...)
   ```
   - Job execution workflow for scheduled backups
   - Direct Git service usage

3. **Snapshot Execution Service** (`backend/services/network/snapshots/execution_service.py`)
   ```python
   git_service.commit_and_push(repository, message, ...)  # Called twice
   ```
   - Commits network snapshots to Git
   - Used by snapshot automation tasks

### Service Layer (Business Logic)

4. **Ansible Inventory Service** (`backend/services/inventory/inventory.py`)
   ```python
   git_service.commit_and_push(repository, message, files=[...])
   ```
   - Generates and commits inventory files
   - Used by inventory generation workflows

5. **Ansible Inventory Router** (`backend/routers/inventory/ansible_inventory.py`)
   ```python
   git_service.commit_and_push(repository, message, ...)
   ```
   - Endpoint: `POST /api/ansible-inventory/push-to-git`
   - Commits inventory to Git when requested by frontend

### Architecture Pattern

```
Frontend Request → API Endpoint → Celery Task → git_service (Direct Git Ops)
                                                      ↓
                                              GitPython Library
                                                      ↓
                                              Git Repository
```

**Not used:** `Frontend → API Endpoint → Git Commit/Push Endpoint` (This pattern doesn't exist in the codebase)

---

## Removed Features That Used Git Endpoints

### Config Compare Feature (Removed)
**Location:** `frontend/src/app/(dashboard)/compare/` (DELETED)  
**Components:** `frontend/src/components/features/network/configs/compare/` (DELETED)

**Endpoints that were used:**
- All `/api/file-compare/` endpoints (4 endpoints) ❌
- `/api/git-compare/repos` ❌
- Possibly some version control endpoints for commit comparison

---

## Recommendations

### Immediate Actions

1. **Remove Unused Endpoints** (6-10 endpoints)
   - Remove all `/api/file-compare/` endpoints (4 endpoints)
   - Remove `/api/git-compare/repos` endpoint
   - Remove unused version control POST endpoints:
     - `POST /api/git/{repo_id}/branches` - Branch creation not needed via API
     - `POST /api/git/{repo_id}/commits` - Commits handled by backend services
     - `POST /api/git/{repo_id}/compare-files` - Unused comparison endpoint
     - `GET /api/git/{repo_id}/commits/{commit_hash}/diff` - Superseded by `/diff`

2. **Verify Uncertain Endpoints** (3 endpoints)
   - Check backend services for usage of `/info` and `/debug` endpoints
   - Confirm `/files/{file_path}/history` vs `/complete-history` usage

3. **Update Documentation**
   - Document which endpoints are still active
   - Add deprecation warnings to any endpoints planned for future removal
   - Clarify that write operations are handled by `git_service` internally

### Future Refactoring

1. **Consolidate File Operations**
   - Consider combining `/directory` and `/tree` endpoints if possible
   - Evaluate if `/history` and `/complete-history` can be unified

2. **Improve Endpoint Naming**
   - Consider renaming `/git/{repo_id}/diff` to be more specific
   - Standardize endpoint prefixes (git vs git-repositories)

3. **Add Usage Tracking**
   - Consider adding telemetry to track endpoint usage
   - Monitor deprecated endpoints before removal

---

## Testing Strategy

Before removing any endpoint:

1. ✅ Confirm no frontend references (grep search completed)
2. ⏳ Check backend service usage (internal API calls)
3. ⏳ Review integration tests that might use the endpoint
4. ⏳ Check for any external API clients
5. ⏳ Deploy to staging and monitor for errors

---

## Version History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-25 | 1.0 | Initial analysis after removing /compare feature | GitHub Copilot |

---

## Related Documents

- [Git Router Refactoring](../REFACTORING_GIT_ROUTER.md) - If exists
- [API Deprecation Policy](../API_DEPRECATION_POLICY.md) - If exists
- [Config Compare Removal](./REMOVE_CONFIG_COMPARE_FEATURE.md) - If exists

---

## Notes

- This analysis was performed after removing the `/compare` feature (2026-01-25)
- Search patterns used: `git[\-/]`, `/api/proxy/git`, `git-repositories`, `file-compare`
- All frontend files in `frontend/src/` were searched
- Backend routes in `backend/routers/settings/git/` were analyzed
- **Critical finding:** All Git write operations (commit, push) are handled by `backend/services/settings/git/service.py` directly, not through API endpoints
- Backend services that use `git_service` directly:
  - `tasks/backup_tasks.py` - Device configuration backups
  - `tasks/execution/backup_executor.py` - Backup job execution
  - `services/network/snapshots/execution_service.py` - Network snapshots
  - `services/inventory/inventory.py` - Ansible inventory generation
  - `routers/inventory/ansible_inventory.py` - Inventory push-to-git endpoint
