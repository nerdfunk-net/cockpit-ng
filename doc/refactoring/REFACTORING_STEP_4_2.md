# Refactoring Step 4.2 — `git_repositories_manager.py`

**Priority:** 4 — Manager Migration  
**Risk:** Low–Medium  
**Estimated effort:** 2–4 hours  
**Prerequisites:** None (independent of all other steps)  
**Independent of:** Steps 4.1, 4.3–4.7

---

## Goal

Migrate `backend/git_repositories_manager.py` (214 lines) →  
`backend/services/settings/git/repository_service.py`

Register in `service_factory.py`, add `Depends()` in `dependencies.py`, update all callers.

---

## Current State

`git_repositories_manager.py` is a class-based manager:

```python
class GitRepositoryManager:
    def __init__(self, db_path=None):  # db_path is backward-compat no-op
        self.repo = GitRepositoryRepository()
    
    # Public methods:
    create_repository(repo_data)   → int (new ID)
    get_repository(repo_id)        → Optional[dict]
    get_repositories(category, active_only) → List[dict]
    update_repository(repo_id, repo_data)  → bool
    delete_repository(repo_id, hard_delete=True) → bool
    update_sync_status(repo_id, status, last_sync) → bool
    get_repositories_by_category(category) → List[dict]
    _model_to_dict(repo)          → dict  (private)
    health_check()                → dict
```

**Note:** `services/settings/git/service.py` already exists and handles git operations (clone, sync, pull). The new `repository_service.py` covers only **PostgreSQL CRUD for the git_repositories table** — these are complementary, not conflicting.

---

## Callers

```bash
grep -rn "from git_repositories_manager\|import git_repositories_manager" backend/ --include="*.py" | grep -v __pycache__
```

| File | Import | Usage |
|---|---|---|
| `services/settings/git/shared_utils.py` | `from git_repositories_manager import GitRepositoryManager` | top-level import, instantiated per use |
| `services/network/snapshots/execution_service.py` | `from git_repositories_manager import GitRepositoryManager` | top-level import |
| `services/agents/template_render_service.py` | lazy `from git_repositories_manager import GitRepositoryManager` | inside method |
| `services/inventory/git_storage_service.py` | lazy × 3 `from git_repositories_manager import GitRepositoryManager` | inside 3 methods |

All callers instantiate `GitRepositoryManager()` directly (no args). None are routers — they're all service files. This means no FastAPI `Depends()` is needed for these callers; they use `service_factory` directly.

---

## New File: `services/settings/git/repository_service.py`

Create this file as a near-direct copy of `git_repositories_manager.py`, with:
1. Module docstring updated
2. Class renamed from `GitRepositoryManager` to `GitRepositoryService` 
3. `db_path` backward-compat param removed (it was already a no-op)
4. `print()` → `logger` (if any)

```python
"""Git repository CRUD service — manages git_repositories table in PostgreSQL."""

from __future__ import annotations
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from repositories import GitRepositoryRepository
from core.models import GitRepository

logger = logging.getLogger(__name__)


class GitRepositoryService:
    """CRUD service for Git repositories in PostgreSQL.

    Separate from GitService (git operations: clone, sync, pull).
    This service only manages the database records.
    """

    def __init__(self) -> None:
        self._repo = GitRepositoryRepository()

    def create_repository(self, repo_data: Dict[str, Any]) -> int:
        """Create a new git repository record. Returns new ID."""
        if self._repo.name_exists(repo_data["name"]):
            raise ValueError(f"Repository with name '{repo_data['name']}' already exists")

        new_repo = self._repo.create(
            name=repo_data["name"],
            category=repo_data["category"],
            url=repo_data["url"],
            branch=repo_data.get("branch", "main"),
            credential_name=repo_data.get("credential_name"),
            path=repo_data.get("path"),
            verify_ssl=repo_data.get("verify_ssl", True),
            git_author_name=repo_data.get("git_author_name"),
            git_author_email=repo_data.get("git_author_email"),
            description=repo_data.get("description"),
            is_active=repo_data.get("is_active", True),
        )
        logger.info("Created git repository: %s (ID: %s)", repo_data["name"], new_repo.id)
        return new_repo.id

    def get_repository(self, repo_id: int) -> Optional[Dict[str, Any]]:
        repo = self._repo.get_by_id(repo_id)
        return self._to_dict(repo) if repo else None

    def get_repositories(
        self, category: Optional[str] = None, active_only: bool = False
    ) -> List[Dict[str, Any]]:
        if category:
            repos = self._repo.get_by_category(category, active_only)
        elif active_only:
            repos = self._repo.get_all_active()
        else:
            repos = self._repo.get_all()
        return [self._to_dict(r) for r in repos]

    def get_repositories_by_category(self, category: str) -> List[Dict[str, Any]]:
        return self.get_repositories(category=category, active_only=True)

    def update_repository(self, repo_id: int, repo_data: Dict[str, Any]) -> bool:
        valid_fields = [
            "name", "category", "url", "branch", "auth_type",
            "credential_name", "path", "verify_ssl", "git_author_name",
            "git_author_email", "description", "is_active",
        ]
        update_kwargs = {k: v for k, v in repo_data.items() if k in valid_fields}
        if not update_kwargs:
            return False

        if "name" in update_kwargs:
            existing = self._repo.get_by_name(update_kwargs["name"])
            if existing and existing.id != repo_id:
                raise ValueError(f"Repository with name '{update_kwargs['name']}' already exists")

        update_kwargs["updated_at"] = datetime.utcnow()
        self._repo.update(repo_id, **update_kwargs)
        logger.info("Updated git repository ID: %s", repo_id)
        return True

    def delete_repository(self, repo_id: int, hard_delete: bool = True) -> bool:
        if hard_delete:
            self._repo.delete(repo_id)
            logger.info("Deleted git repository ID: %s", repo_id)
        else:
            self._repo.update(repo_id, is_active=False, updated_at=datetime.utcnow())
            logger.info("Deactivated git repository ID: %s", repo_id)
        return True

    def update_sync_status(
        self, repo_id: int, status: str, last_sync: Optional[datetime] = None
    ) -> bool:
        if last_sync is None:
            last_sync = datetime.utcnow()
        self._repo.update(
            repo_id,
            sync_status=status,
            last_sync=last_sync,
            updated_at=datetime.utcnow(),
        )
        return True

    def health_check(self) -> Dict[str, Any]:
        try:
            all_repos = self._repo.get_all()
            active_repos = [r for r in all_repos if r.is_active]
            category_counts: Dict[str, int] = {}
            for repo in all_repos:
                category_counts[repo.category] = category_counts.get(repo.category, 0) + 1
            return {
                "status": "healthy",
                "total_repositories": len(all_repos),
                "active_repositories": len(active_repos),
                "categories": category_counts,
                "database": "PostgreSQL",
            }
        except Exception as e:
            logger.error("Health check failed: %s", e)
            return {"status": "error", "error": str(e), "database": "PostgreSQL"}

    def _to_dict(self, repo: GitRepository) -> Dict[str, Any]:
        return {
            "id": repo.id,
            "name": repo.name,
            "category": repo.category,
            "url": repo.url,
            "branch": repo.branch,
            "auth_type": repo.auth_type,
            "credential_name": repo.credential_name,
            "path": repo.path,
            "verify_ssl": repo.verify_ssl,
            "git_author_name": repo.git_author_name,
            "git_author_email": repo.git_author_email,
            "description": repo.description,
            "is_active": repo.is_active,
            "last_sync": repo.last_sync.isoformat() if repo.last_sync else None,
            "sync_status": repo.sync_status,
            "created_at": repo.created_at.isoformat() if repo.created_at else None,
            "updated_at": repo.updated_at.isoformat() if repo.updated_at else None,
        }
```

---

## `service_factory.py` Addition

```python
def build_git_repository_service():
    """Create a fresh GitRepositoryService instance."""
    from services.settings.git.repository_service import GitRepositoryService
    return GitRepositoryService()
```

---

## `dependencies.py` Addition

No router currently calls `GitRepositoryManager` directly. Skip for now; add if a router needs it in the future.

---

## Caller Updates

### `services/settings/git/shared_utils.py`

```python
# Before:
from git_repositories_manager import GitRepositoryManager

# After:
from services.settings.git.repository_service import GitRepositoryService as GitRepositoryManager
```
All call sites remain `GitRepositoryManager()` — the alias preserves the old name, requiring zero further changes.

### `services/network/snapshots/execution_service.py`

```python
# Before:
from git_repositories_manager import GitRepositoryManager

# After:
from services.settings.git.repository_service import GitRepositoryService as GitRepositoryManager
```

### `services/agents/template_render_service.py` (lazy import inside method)

```python
# Before:
from git_repositories_manager import GitRepositoryManager

# After:
from services.settings.git.repository_service import GitRepositoryService as GitRepositoryManager
```

### `services/inventory/git_storage_service.py` (3 lazy imports inside methods)

Same replacement in all 3 places:
```python
# Before:
from git_repositories_manager import GitRepositoryManager

# After:
from services.settings.git.repository_service import GitRepositoryService as GitRepositoryManager
```

**Alternatively** — if you prefer not to use the alias, rename all instantiation call sites from `GitRepositoryManager()` to `GitRepositoryService()`, removing the alias. The alias approach is faster and risk-free for this step.

---

## Backward-Compatibility Note

The old `GitRepositoryManager.__init__` accepted `db_path=None` for backward compatibility. The new `GitRepositoryService.__init__` takes no arguments. Verify no caller passes `db_path` before removing it:

```bash
grep -rn "GitRepositoryManager(" backend/ --include="*.py" | grep -v __pycache__
# All results should show GitRepositoryManager() with no arguments
```

---

## Steps

1. Create `backend/services/settings/git/repository_service.py` (content above).
2. Add `build_git_repository_service()` to `service_factory.py`.
3. Update 4 caller files (replace import with aliased import as shown above).
4. Delete `backend/git_repositories_manager.py`.
5. Verify:
   ```bash
   grep -rn "git_repositories_manager" backend/ --include="*.py" | grep -v __pycache__
   # Should return 0 results
   
   python -c "from services.settings.git.repository_service import GitRepositoryService; print('OK')"
   ```

---

## Verification Checklist

- [ ] `grep -rn "git_repositories_manager" backend/` → 0 results
- [ ] `git_repositories_manager.py` deleted
- [ ] `services/settings/git/repository_service.py` exists
- [ ] `service_factory.build_git_repository_service()` importable
- [ ] Backend starts: `python -c "import main"`
- [ ] Git settings page (if applicable) continues to list/create/update/delete repositories
