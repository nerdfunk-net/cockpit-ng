# Refactoring Step 4.1 — `profile_manager.py` + `settings_manager.py` cleanup

**Priority:** 4 — Manager Migration  
**Risk:** Low  
**Estimated effort:** 2–4 hours  
**Independent of:** Steps 4.2–4.7  

---

## Goals

1. Migrate `profile_manager.py` (152 lines) → `services/auth/profile_service.py`
2. Delete `settings_manager.py` (5-line shim) after updating all its callers to import `SettingsManager` directly from `services.settings.manager`

---

## Part A — `settings_manager.py` Shim Removal

### What it is

`/backend/settings_manager.py` is already a shim:

```python
from services.settings.manager import SettingsManager
settings_manager = SettingsManager()
```

It creates a module-level singleton. All callers do either:
- `from settings_manager import settings_manager` — use the singleton
- `import settings_manager` then `settings_manager.settings_manager` (never seen in practice)

### Callers (30+)

All references confirmed by:
```bash
grep -rn "from settings_manager\|import settings_manager" backend/ --include="*.py" | grep -v __pycache__ | grep -v "_manager.py"
```

Files to update:

| File | Import pattern |
|---|---|
| `backend/start.py` | `from settings_manager import settings_manager` |
| `backend/start_celery.py` | `from settings_manager import settings_manager` |
| `backend/main.py` (2 places) | lazy `from settings_manager import settings_manager` |
| `routers/settings/checkmk_settings.py` (2) | lazy `from settings_manager import settings_manager` |
| `routers/settings/common.py` (4) | lazy `from settings_manager import settings_manager` |
| `routers/settings/cache_settings.py` (3) | lazy `from settings_manager import settings_manager` |
| `routers/settings/git_settings.py` (3) | lazy `from settings_manager import settings_manager` |
| `routers/settings/nautobot.py` (5) | lazy `from settings_manager import settings_manager` |
| `routers/settings/agents_settings.py` (2) | lazy `from settings_manager import settings_manager` |
| `routers/settings/git/files.py` (1) | lazy `from settings_manager import settings_manager` |
| `routers/settings/git/version_control.py` (1) | lazy `from settings_manager import settings_manager` |
| `routers/auth/oidc.py` | `from settings_manager import settings_manager` |
| `routers/nautobot/infrastructure.py` (3) | lazy |
| `routers/nautobot/ipam.py` (3) | lazy |
| `routers/nautobot/locations.py` (1) | lazy |
| `routers/nautobot/devices.py` (3) | lazy |
| `routers/jobs/celery_admin.py` (2) | lazy |
| `tasks/check_ip_task.py` | `from settings_manager import settings_manager` |
| `tasks/periodic_tasks.py` (3) | lazy |
| `tasks/execution/sync_executor.py` (1) | lazy |
| `core/config.py` | lazy `from settings_manager import settings_manager` |
| `services/background_jobs/checkmk_device_jobs.py` (1) | lazy |
| `services/settings/git/cache.py` (1) | lazy |
| `services/checkmk/base.py` (1) | lazy |
| `services/auth/oidc.py` | `from settings_manager import settings_manager` |
| `services/nautobot/client.py` (1) | lazy |
| `services/celery/admin_service.py` (1) | lazy |
| `utils/nautobot_helpers.py` (1) | lazy |
| `tests/integration/test_snmp_mapping_comparison.py` | lazy |
| `tests/integration/test_checkmk_device_lifecycle.py` | `from settings_manager import settings_manager` |

### Migration pattern

**Replace every occurrence of:**
```python
from settings_manager import settings_manager
```
**With:**
```python
from services.settings.manager import SettingsManager as _SettingsManager
settings_manager = _SettingsManager()
```

**BUT** — this creates a new instance per call. The original shim created one module-level singleton that was shared. The `SettingsManager` is stateless (all methods read from PostgreSQL), so instantiating fresh is safe. However, to avoid any risk, prefer the canonical import below instead.

**Recommended canonical replacement** — reuse the singleton from the shim's source, injected via `service_factory`:

**Option A (no factory, direct import):**
```python
from services.settings.manager import SettingsManager
# then use: settings_manager = SettingsManager()  inside the function
```

**Option B (add to service_factory.py):**
Add one function:
```python
def build_settings_manager():
    from services.settings.manager import SettingsManager
    return SettingsManager()
```
Then all callers do:
```python
import service_factory
settings_manager = service_factory.build_settings_manager()
```

For lazy imports inside functions (the pattern used in routers/tasks), the simplest mechanical replacement is:
```python
# Before:
from settings_manager import settings_manager

# After:
from services.settings.manager import SettingsManager
settings_manager = SettingsManager()
```

Since `SettingsManager.__init__` is cheap (no I/O), creating a new instance per-call is fine.

### Steps

1. Add `build_settings_manager()` to `service_factory.py`:
   ```python
   def build_settings_manager():
       """Create a fresh SettingsManager instance."""
       from services.settings.manager import SettingsManager
       return SettingsManager()
   ```

2. For **top-level imports** (non-lazy), replace `from settings_manager import settings_manager` with `from services.settings.manager import SettingsManager` and instantiate where used, or import the singleton directly:
   ```python
   # routers/auth/oidc.py — was top-level
   from services.settings.manager import SettingsManager as _SM
   _settings_manager = _SM()  # module-level, stateless, safe
   ```

3. For **lazy imports** inside functions, mechanically replace:
   ```python
   # Before
   from settings_manager import settings_manager
   # After
   from services.settings.manager import SettingsManager as _SM
   settings_manager = _SM()
   ```

4. Delete `backend/settings_manager.py`.

5. Verify:
   ```bash
   grep -rn "settings_manager" backend/ --include="*.py" | grep -v __pycache__ | grep "import settings_manager\|from settings_manager"
   # Should return 0 results
   ```

---

## Part B — `profile_manager.py` → `services/auth/profile_service.py`

### What it is

`/backend/profile_manager.py` (152 lines) contains 4 module-level functions:
- `get_user_profile(username)` — reads UserProfile from DB
- `update_user_profile(username, ...)` — upserts UserProfile in DB
- `update_user_password(username, new_password)` — uses `credentials_manager` internally (lazy import)
- `delete_user_profile(username)` — deletes UserProfile from DB

It also has a module-level `_profile_repo = ProfileRepository()`.

### Callers

```bash
grep -rn "import profile_manager\|from profile_manager" backend/ --include="*.py" | grep -v __pycache__
```

| File | Usage |
|---|---|
| `routers/auth/profile.py` | `import profile_manager` (top-level) |
| `rbac_manager.py` | lazy `import profile_manager` inside `delete_user_with_rbac()` |

### New file: `services/auth/profile_service.py`

```python
"""User profile service — manages UserProfile records in PostgreSQL."""

from __future__ import annotations
import logging
from datetime import datetime
from typing import Any, Dict, Optional

from repositories import ProfileRepository
from core.models import UserProfile

logger = logging.getLogger(__name__)

_profile_repo = ProfileRepository()


def _profile_to_dict(profile: UserProfile) -> Dict[str, Any]:
    return {
        "id": profile.id,
        "username": profile.username,
        "realname": profile.realname,
        "email": profile.email,
        "debug": profile.debug_mode,
        "api_key": profile.api_key,
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
        "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
    }


def get_user_profile(username: str) -> Optional[Dict[str, Any]]:
    profile = _profile_repo.get_by_username(username)
    if profile:
        return _profile_to_dict(profile)
    return {
        "username": username,
        "realname": "",
        "email": "",
        "debug": False,
        "api_key": None,
    }


def update_user_profile(
    username: str,
    realname: Optional[str] = None,
    email: Optional[str] = None,
    debug_mode: Optional[bool] = None,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    existing = _profile_repo.get_by_username(username)
    now = datetime.utcnow()
    if existing:
        update_kwargs: Dict[str, Any] = {"updated_at": now}
        if realname is not None:
            update_kwargs["realname"] = realname
        if email is not None:
            update_kwargs["email"] = email
        if debug_mode is not None:
            update_kwargs["debug_mode"] = debug_mode
        if api_key is not None:
            update_kwargs["api_key"] = api_key
        updated = _profile_repo.update(existing.id, **update_kwargs)
        return _profile_to_dict(updated)
    new_profile = _profile_repo.create(
        username=username,
        realname=realname or "",
        email=email or "",
        debug_mode=debug_mode if debug_mode is not None else False,
        api_key=api_key,
        created_at=now,
        updated_at=now,
    )
    return _profile_to_dict(new_profile)


def update_user_password(username: str, new_password: str) -> bool:
    """Update user password. Delegates to credentials service."""
    from services.settings.credentials_service import (
        list_credentials,
        update_credential,
        create_credential,
    )
    try:
        credentials = list_credentials(include_expired=False)
        user_cred = next(
            (c for c in credentials if c["username"] == username and c["status"] == "active"),
            None,
        )
        if user_cred:
            update_credential(cred_id=user_cred["id"], password=new_password)
        else:
            create_credential(
                name=f"{username} User Account",
                username=username,
                cred_type="generic",
                password=new_password,
                valid_until=None,
            )
        return True
    except Exception as e:
        logger.error("Error updating password for %s: %s", username, e)
        return False


def delete_user_profile(username: str) -> bool:
    try:
        return _profile_repo.delete_by_username(username)
    except Exception as e:
        logger.error("Error deleting profile for %s: %s", username, e)
        return False
```

**Important:** `update_user_password` previously lazily imported `credentials_manager`. The new version lazily imports from `services.settings.credentials_service` (Step 4.5). Until Step 4.5 is done, keep the lazy import pointing at `credentials_manager` — the change to `services.settings.credentials_service` happens atomically in Step 4.5.

### Add to `service_factory.py`

```python
def build_profile_service():
    """Create a fresh ProfileService module reference."""
    import services.auth.profile_service as profile_service
    return profile_service
```

Since profile_manager is a module (not a class), the service is also a module with module-level functions. The factory just imports it. Alternatively, wrap in a class for consistency (optional — not required by CLAUDE.md).

### Add to `dependencies.py`

```python
def get_profile_service():
    """Provide the profile service module."""
    return service_factory.build_profile_service()
```

### Update callers

**`routers/auth/profile.py`:**
```python
# Before:
import profile_manager
import credentials_manager

# After:
import services.auth.profile_service as profile_manager
import services.settings.credentials_service as credentials_manager
```
All call sites remain identical because the function signatures are preserved.

**`rbac_manager.py` (until it gets migrated in Step 4.4):**
```python
# Before (inside delete_user_with_rbac):
import profile_manager
profile_manager.delete_user_profile(username)

# After:
from services.auth import profile_service
profile_service.delete_user_profile(username)
```

### Steps

1. Create `backend/services/auth/profile_service.py` with the content above.
2. Update `routers/auth/profile.py` import.
3. Update `rbac_manager.py` lazy import (will be fully replaced in Step 4.4).
4. Add `build_profile_service()` to `service_factory.py`.
5. Add `get_profile_service()` to `dependencies.py`.
6. Delete `backend/profile_manager.py`.
7. Verify:
   ```bash
   grep -rn "profile_manager" backend/ --include="*.py" | grep -v __pycache__
   # Should return 0 results
   ```

---

## Verification Checklist

- [ ] `grep -rn "from settings_manager\|import settings_manager" backend/ --include="*.py" | grep -v __pycache__` → 0 results
- [ ] `grep -rn "from profile_manager\|import profile_manager" backend/ --include="*.py" | grep -v __pycache__` → 0 results
- [ ] `settings_manager.py` deleted
- [ ] `profile_manager.py` deleted
- [ ] `services/auth/profile_service.py` created
- [ ] Backend starts without import errors: `cd backend && python -c "import main"`
- [ ] Profile GET/PUT endpoints still work via manual test or curl
