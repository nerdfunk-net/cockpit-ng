# Refactoring Step 4.4 — `rbac_manager.py` + `user_db_manager.py`

**Priority:** 4 — Manager Migration  
**Risk:** Medium–High (core auth infrastructure)  
**Estimated effort:** 1–2 days  
**Prerequisites:** None strictly required, but do this before Step 4.5 and 4.6 since rbac_manager calls into both  
**Independent of:** Steps 4.1, 4.2, 4.3, 4.5–4.7  

---

## Goal

Migrate two tightly-coupled managers together:
- `backend/rbac_manager.py` (596 lines) → `backend/services/auth/rbac_service.py`
- `backend/user_db_manager.py` (409 lines) → `backend/services/auth/user_service.py`

These managers **call each other**:
- `rbac_manager.py` imports `user_db_manager as user_db` (top-level)
- `user_db_manager.py` lazy-imports `rbac_manager as rbac` inside `_ensure_admin_role_assigned()`

Migrating them together eliminates the cross-manager dependency.

**Note:** `services/auth/user_management.py` already exists as a thin wrapper around `user_db_manager`. After this migration, `user_management.py` will delegate to `UserService` instead.

---

## Callers of `rbac_manager.py`

```bash
grep -rn "import rbac_manager\|from rbac_manager" backend/ --include="*.py" | grep -v __pycache__
```

| File | Import pattern |
|---|---|
| `routers/settings/rbac.py` | `import rbac_manager as rbac` (top-level) |
| `routers/auth/auth.py` | lazy (2 places) `import rbac_manager as rbac` |
| `routers/auth/oidc.py` | lazy `import rbac_manager as rbac` |
| `routers/jobs/templates.py` | `import rbac_manager` (top-level) |
| `routers/jobs/schedules.py` | lazy × 3 `import rbac_manager` |
| `core/auth.py` | lazy × 5 `import rbac_manager as rbac` |
| `tools/check_user_permissions.py` | `import rbac_manager as rbac` |
| `tools/seed_rbac.py` | `import rbac_manager as rbac` |
| `services/auth/user_management.py` | (indirectly via user_db_manager → rbac) |
| `user_db_manager.py` | lazy `import rbac_manager as rbac` (will be replaced) |

---

## Callers of `user_db_manager.py`

```bash
grep -rn "import user_db_manager\|from user_db_manager" backend/ --include="*.py" | grep -v __pycache__
```

| File | Import / Symbol |
|---|---|
| `rbac_manager.py` | `import user_db_manager as user_db` (top-level, will be replaced) |
| `services/auth/user_management.py` | `import user_db_manager as user_db` (top-level) |
| `core/auth.py` | `from user_db_manager import PERMISSIONS_ADMIN` (lazy) |
| `set_admin_password.py` | `from user_db_manager import PERMISSIONS_ADMIN` |
| `tools/check_user_permissions.py` | `import user_db_manager as user_db` |
| `tools/seed_rbac.py` | `import user_db_manager as user_db` (× 2) |
| `scripts/credential_manager/set_password.py` | `from user_db_manager import get_user_by_username, update_user` |

---

## New File 1: `services/auth/user_service.py`

Convert module-level functions to a class. Export the constants at module level for backward compatibility.

```python
"""User management service — thin layer over UserRepository with password hashing."""

from __future__ import annotations
import logging
from typing import Any, Dict, List, Optional, Tuple

from core.auth import get_password_hash, verify_password
from repositories.auth.user_repository import UserRepository
from core.models import User

logger = logging.getLogger(__name__)

# Permission bit flags — exported at module level for backward compatibility
PERMISSION_READ = 1
PERMISSION_WRITE = 2
PERMISSION_ADMIN = 4
PERMISSION_DELETE = 8
PERMISSION_USER_MANAGE = 16

PERMISSIONS_VIEWER = PERMISSION_READ
PERMISSIONS_USER = PERMISSION_READ | PERMISSION_WRITE
PERMISSIONS_ADMIN = (
    PERMISSION_READ | PERMISSION_WRITE | PERMISSION_ADMIN
    | PERMISSION_DELETE | PERMISSION_USER_MANAGE
)


class UserService:
    def __init__(self) -> None:
        self._repo = UserRepository()

    def create_user(
        self,
        username: str,
        realname: str,
        password: str,
        email: Optional[str] = None,
        permissions: int = PERMISSIONS_USER,
        debug: bool = False,
        is_active: bool = True,
    ) -> Dict[str, Any]:
        if not username or not realname or not password:
            raise ValueError("Username, realname, and password are required")
        if self._repo.username_exists(username):
            raise ValueError(f"Username '{username}' already exists")
        user = self._repo.create(
            username=username,
            realname=realname,
            email=email or "",
            password=get_password_hash(password),
            permissions=permissions,
            debug=debug,
            is_active=is_active,
        )
        return self._to_dict(user)

    def get_all_users(self, include_inactive: bool = True) -> List[Dict[str, Any]]:
        users = self._repo.get_all() if include_inactive else self._repo.get_active_users()
        return [self._to_dict(u) for u in users]

    def get_user_by_id(self, user_id: int, include_inactive: bool = False) -> Optional[Dict[str, Any]]:
        user = self._repo.get_by_id(user_id)
        if user and (include_inactive or user.is_active):
            return self._to_dict(user)
        return None

    def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        user = self._repo.get_by_username(username)
        if user and user.is_active:
            return self._to_dict(user)
        return None

    def authenticate_user(self, username: str, password: str) -> Optional[Dict[str, Any]]:
        user = self._repo.get_by_username(username)
        if user and user.is_active and verify_password(password, user.password):
            return self._to_dict(user)
        return None

    def update_user(
        self,
        user_id: int,
        realname: Optional[str] = None,
        email: Optional[str] = None,
        password: Optional[str] = None,
        permissions: Optional[int] = None,
        debug: Optional[bool] = None,
        is_active: Optional[bool] = None,
    ) -> Optional[Dict[str, Any]]:
        current = self._repo.get_by_id(user_id)
        if not current:
            return None
        updates: Dict[str, Any] = {}
        if realname is not None:
            updates["realname"] = realname
        if email is not None:
            updates["email"] = email
        if password is not None:
            if len(password) < 8:
                raise ValueError("Password must be at least 8 characters long")
            updates["password"] = get_password_hash(password)
        if permissions is not None:
            updates["permissions"] = permissions
        if debug is not None:
            updates["debug"] = debug
        if is_active is not None:
            updates["is_active"] = is_active
        if not updates:
            return self._to_dict(current)
        updated = self._repo.update(user_id, **updates)
        return self._to_dict(updated) if updated else None

    def delete_user(self, user_id: int) -> bool:
        return self._repo.set_active_status(user_id, False)

    def hard_delete_user(self, user_id: int) -> bool:
        return self._repo.delete(user_id)

    def bulk_delete_users(self, user_ids: List[int]) -> Tuple[int, List[str]]:
        success, errors = 0, []
        for uid in user_ids:
            try:
                if self.delete_user(uid):
                    success += 1
                else:
                    errors.append(f"User ID {uid} not found")
            except Exception as e:
                errors.append(f"Failed to delete user ID {uid}: {e}")
        return success, errors

    def bulk_hard_delete_users(self, user_ids: List[int]) -> Tuple[int, List[str]]:
        success, errors = 0, []
        for uid in user_ids:
            try:
                if self.hard_delete_user(uid):
                    success += 1
                else:
                    errors.append(f"User ID {uid} not found")
            except Exception as e:
                errors.append(f"Failed to delete user ID {uid}: {e}")
        return success, errors

    def bulk_update_permissions(self, user_ids: List[int], permissions: int) -> Tuple[int, List[str]]:
        success, errors = 0, []
        for uid in user_ids:
            try:
                if self.update_user(uid, permissions=permissions):
                    success += 1
                else:
                    errors.append(f"User ID {uid} not found")
            except Exception as e:
                errors.append(f"Failed to update permissions for user ID {uid}: {e}")
        return success, errors

    def ensure_admin_user_permissions(self) -> None:
        admin = self._repo.get_by_username("admin")
        if admin and admin.permissions != PERMISSIONS_ADMIN:
            self._repo.update(admin.id, permissions=PERMISSIONS_ADMIN)

    def ensure_admin_has_rbac_role(self, rbac_service: "RBACService") -> None:
        """Ensure admin user exists and has the admin role. Called at startup."""
        self._create_default_admin_if_needed()
        admin = self.get_user_by_username("admin")
        if admin:
            self._ensure_admin_role_assigned(admin["id"], rbac_service)

    def _create_default_admin_if_needed(self) -> Optional[Dict[str, Any]]:
        if self._repo.count() > 0:
            self.ensure_admin_user_permissions()
            return None
        try:
            from config import settings as config_settings
            user = self.create_user(
                username="admin",
                realname="System Administrator",
                password=config_settings.initial_password,
                email="admin@localhost",
                permissions=PERMISSIONS_ADMIN,
                debug=True,
            )
            logger.info("Created default admin user")
            return user
        except Exception as e:
            logger.warning("Failed to create default admin: %s", e)
            return None

    def _ensure_admin_role_assigned(self, user_id: int, rbac_service: "RBACService") -> None:
        try:
            admin_role = rbac_service.get_role_by_name("admin")
            if not admin_role:
                try:
                    from tools import seed_rbac
                    seed_rbac.main(verbose=False)
                    admin_role = rbac_service.get_role_by_name("admin")
                    logger.info("Initialized RBAC system with default roles and permissions")
                except Exception as e:
                    logger.warning("Failed to seed RBAC: %s", e)
                    return
            if admin_role:
                user_roles = rbac_service.get_user_roles(user_id)
                if not any(r["name"] == "admin" for r in user_roles):
                    rbac_service.assign_role_to_user(user_id, admin_role["id"])
                    logger.info("Assigned admin role to user ID %s", user_id)
        except Exception as e:
            logger.warning("Failed to ensure admin role assignment: %s", e)

    @staticmethod
    def has_permission_flag(user: Dict[str, Any], permission: int) -> bool:
        return bool(user["permissions"] & permission)

    @staticmethod
    def get_permission_name(permission: int) -> str:
        names = []
        if permission & PERMISSION_READ: names.append("Read")
        if permission & PERMISSION_WRITE: names.append("Write")
        if permission & PERMISSION_ADMIN: names.append("Admin")
        if permission & PERMISSION_DELETE: names.append("Delete")
        if permission & PERMISSION_USER_MANAGE: names.append("User Management")
        return ", ".join(names) if names else "None"

    @staticmethod
    def get_role_name(permissions: int) -> str:
        return {PERMISSIONS_ADMIN: "admin", PERMISSIONS_USER: "user", PERMISSIONS_VIEWER: "viewer"}.get(permissions, "custom")

    @staticmethod
    def get_permissions_for_role(role: str) -> int:
        return {"admin": PERMISSIONS_ADMIN, "user": PERMISSIONS_USER, "viewer": PERMISSIONS_VIEWER}.get(role, PERMISSIONS_USER)

    def _to_dict(self, user: User) -> Dict[str, Any]:
        return {
            "id": user.id,
            "username": user.username,
            "realname": user.realname,
            "email": user.email,
            "permissions": user.permissions,
            "debug": user.debug,
            "is_active": user.is_active,
            "last_login": user.last_login.isoformat() if user.last_login else None,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "updated_at": user.updated_at.isoformat() if user.updated_at else None,
        }
```

**Note on circular dependency:** `_ensure_admin_role_assigned` previously called `rbac_manager` lazily to avoid circular imports. The new design passes `rbac_service` as an argument, eliminating the circular dependency entirely. The caller (`main.py`) constructs both services and calls `user_service.ensure_admin_has_rbac_role(rbac_service)`.

---

## New File 2: `services/auth/rbac_service.py`

Convert module-level functions to a class. The "bridge" functions that previously called `user_db_manager` now call `UserService`.

```python
"""RBAC service — roles, permissions, user-role and user-permission management."""

from __future__ import annotations
import logging
from typing import Any, Dict, List, Optional, Tuple, TYPE_CHECKING

from repositories.auth.rbac_repository import RBACRepository
from core.models import Role, Permission

if TYPE_CHECKING:
    from services.auth.user_service import UserService

logger = logging.getLogger(__name__)


class RBACService:
    def __init__(self, user_service: "UserService") -> None:
        self._rbac_repo = RBACRepository()
        self._user_service = user_service

    # -------------------------------------------------------------------------
    # Permissions
    # -------------------------------------------------------------------------

    def create_permission(self, resource: str, action: str, description: str = "") -> Dict[str, Any]:
        if self._rbac_repo.get_permission(resource, action):
            raise ValueError(f"Permission {resource}:{action} already exists")
        perm = self._rbac_repo.create_permission(resource, action, description)
        return self._perm_to_dict(perm)

    def get_permission(self, resource: str, action: str) -> Optional[Dict[str, Any]]:
        perm = self._rbac_repo.get_permission(resource, action)
        return self._perm_to_dict(perm) if perm else None

    def get_permission_by_id(self, permission_id: int) -> Optional[Dict[str, Any]]:
        perm = self._rbac_repo.get_permission_by_id(permission_id)
        return self._perm_to_dict(perm) if perm else None

    def list_permissions(self) -> List[Dict[str, Any]]:
        return [self._perm_to_dict(p) for p in self._rbac_repo.list_permissions()]

    def delete_permission(self, permission_id: int) -> None:
        self._rbac_repo.delete_permission(permission_id)

    # -------------------------------------------------------------------------
    # Roles
    # -------------------------------------------------------------------------

    def create_role(self, name: str, description: str = "", is_system: bool = False) -> Dict[str, Any]:
        if self._rbac_repo.role_name_exists(name):
            raise ValueError(f"Role '{name}' already exists")
        role = self._rbac_repo.create_role(name, description, is_system)
        return self._role_to_dict(role)

    def get_role(self, role_id: int) -> Optional[Dict[str, Any]]:
        role = self._rbac_repo.get_role(role_id)
        return self._role_to_dict(role) if role else None

    def get_role_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        role = self._rbac_repo.get_role_by_name(name)
        return self._role_to_dict(role) if role else None

    def list_roles(self) -> List[Dict[str, Any]]:
        return [self._role_to_dict(r) for r in self._rbac_repo.list_roles()]

    def update_role(self, role_id: int, name: Optional[str] = None, description: Optional[str] = None) -> Dict[str, Any]:
        role = self._rbac_repo.get_role(role_id)
        if not role:
            raise ValueError(f"Role with id {role_id} not found")
        updates: Dict[str, Any] = {}
        if name is not None:
            updates["name"] = name
        if description is not None:
            updates["description"] = description
        return self._role_to_dict(self._rbac_repo.update_role(role_id, **updates))

    def delete_role(self, role_id: int) -> None:
        role = self._rbac_repo.get_role(role_id)
        if not role:
            raise ValueError(f"Role with id {role_id} not found")
        if role.is_system:
            raise ValueError("Cannot delete system role")
        self._rbac_repo.delete_role(role_id)

    # -------------------------------------------------------------------------
    # Role-Permission Assignment
    # -------------------------------------------------------------------------

    def assign_permission_to_role(self, role_id: int, permission_id: int, granted: bool = True) -> None:
        self._rbac_repo.assign_permission_to_role(role_id, permission_id, granted)

    def remove_permission_from_role(self, role_id: int, permission_id: int) -> None:
        self._rbac_repo.remove_permission_from_role(role_id, permission_id)

    def get_role_permissions(self, role_id: int) -> List[Dict[str, Any]]:
        return [self._perm_to_dict(p) for p in self._rbac_repo.get_role_permissions(role_id)]

    # -------------------------------------------------------------------------
    # User-Role Assignment
    # -------------------------------------------------------------------------

    def assign_role_to_user(self, user_id: int, role_id: int) -> None:
        self._rbac_repo.assign_role_to_user(user_id, role_id)

    def remove_role_from_user(self, user_id: int, role_id: int) -> None:
        self._rbac_repo.remove_role_from_user(user_id, role_id)

    def get_user_roles(self, user_id: int) -> List[Dict[str, Any]]:
        return [self._role_to_dict(r) for r in self._rbac_repo.get_user_roles(user_id)]

    def get_users_with_role(self, role_id: int) -> List[int]:
        return self._rbac_repo.get_users_with_role(role_id)

    # -------------------------------------------------------------------------
    # User-Permission Overrides
    # -------------------------------------------------------------------------

    def assign_permission_to_user(self, user_id: int, permission_id: int, granted: bool = True) -> None:
        self._rbac_repo.assign_permission_to_user(user_id, permission_id, granted)

    def remove_permission_from_user(self, user_id: int, permission_id: int) -> None:
        self._rbac_repo.remove_permission_from_user(user_id, permission_id)

    def get_user_permission_overrides(self, user_id: int) -> List[Dict[str, Any]]:
        overrides = self._rbac_repo.get_user_permission_overrides_with_status(user_id)
        result = []
        for perm, granted in overrides:
            d = self._perm_to_dict(perm)
            d["granted"] = granted
            d["source"] = "override"
            result.append(d)
        return result

    # -------------------------------------------------------------------------
    # Permission Checking
    # -------------------------------------------------------------------------

    def has_permission(self, user_id: int, resource: str, action: str) -> bool:
        perm = self._rbac_repo.get_permission(resource, action)
        if not perm:
            return False
        override = self._rbac_repo.get_user_permission_override(user_id, perm.id)
        if override is not None:
            return override
        for role in self._rbac_repo.get_user_roles(user_id):
            if any(p.id == perm.id for p in self._rbac_repo.get_role_permissions(role.id)):
                return True
        return False

    def get_user_permissions(self, user_id: int) -> List[Dict[str, Any]]:
        pmap: Dict[Tuple[str, str], Dict[str, Any]] = {}
        for role in self._rbac_repo.get_user_roles(user_id):
            for perm in self._rbac_repo.get_role_permissions(role.id):
                key = (perm.resource, perm.action)
                if key not in pmap:
                    d = self._perm_to_dict(perm)
                    d["granted"] = True
                    d["source"] = "role"
                    pmap[key] = d
        for perm in self._rbac_repo.get_user_permissions(user_id):
            key = (perm.resource, perm.action)
            d = self._perm_to_dict(perm)
            d["granted"] = True
            d["source"] = "override"
            pmap[key] = d
        granted = [p for p in pmap.values() if p.get("granted")]
        granted.sort(key=lambda x: (x["resource"], x["action"]))
        return granted

    def check_any_permission(self, user_id: int, resource: str, actions: List[str]) -> bool:
        return any(self.has_permission(user_id, resource, a) for a in actions)

    def check_all_permissions(self, user_id: int, resource: str, actions: List[str]) -> bool:
        return all(self.has_permission(user_id, resource, a) for a in actions)

    # -------------------------------------------------------------------------
    # Cross-entity operations (previously "bridge" functions in rbac_manager)
    # -------------------------------------------------------------------------

    def create_user_with_roles(
        self,
        username: str,
        realname: str,
        password: str,
        email: Optional[str] = None,
        role_ids: Optional[List[int]] = None,
        debug: bool = False,
        is_active: bool = True,
    ) -> Dict[str, Any]:
        user = self._user_service.create_user(
            username=username, realname=realname, password=password,
            email=email, permissions=1, debug=debug, is_active=is_active,
        )
        if role_ids:
            for role_id in role_ids:
                if not self.get_role(role_id):
                    self._user_service.hard_delete_user(user["id"])
                    raise ValueError(f"Role with id {role_id} not found")
                self.assign_role_to_user(user["id"], role_id)
        return user

    def get_user_with_rbac(self, user_id: int, include_inactive: bool = False) -> Optional[Dict[str, Any]]:
        user = self._user_service.get_user_by_id(user_id, include_inactive=include_inactive)
        if not user:
            return None
        user["roles"] = self.get_user_roles(user_id)
        user["permissions"] = self.get_user_permissions(user_id)
        return user

    def list_users_with_rbac(self, include_inactive: bool = True) -> List[Dict[str, Any]]:
        users = self._user_service.get_all_users(include_inactive=include_inactive)
        for user in users:
            user["roles"] = self.get_user_roles(user["id"])
            user["permissions"] = self.get_user_permissions(user["id"])
        return users

    def update_user_profile(
        self,
        user_id: int,
        realname: Optional[str] = None,
        email: Optional[str] = None,
        password: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> Optional[Dict[str, Any]]:
        return self._user_service.update_user(
            user_id=user_id, realname=realname, email=email,
            password=password, permissions=None, debug=None, is_active=is_active,
        )

    def delete_user_with_rbac(self, user_id: int) -> bool:
        user = self._user_service.get_user_by_id(user_id, include_inactive=True)
        if not user:
            return False
        username = user.get("username")
        for role in self.get_user_roles(user_id):
            self.remove_role_from_user(user_id, role["id"])
        for override in self.get_user_permission_overrides(user_id):
            self.remove_permission_from_user(user_id, override["id"])
        if username:
            try:
                from services.settings.credentials_service import CredentialsService
                cred_svc = CredentialsService()
                deleted = cred_svc.delete_credentials_by_owner(username)
                logger.info("Deleted %s private credentials for user %s", deleted, username)
            except Exception as e:
                logger.warning("Failed to delete credentials for user %s: %s", username, e)
            try:
                from services.auth.profile_service import delete_user_profile
                delete_user_profile(username)
            except Exception as e:
                logger.warning("Failed to delete profile for user %s: %s", username, e)
        return self._user_service.hard_delete_user(user_id)

    def bulk_delete_users_with_rbac(self, user_ids: List[int]) -> Tuple[int, List[str]]:
        success, errors = 0, []
        for uid in user_ids:
            try:
                if self.delete_user_with_rbac(uid):
                    success += 1
                else:
                    errors.append(f"User {uid} not found")
            except Exception as e:
                errors.append(f"User {uid}: {e}")
        return success, errors

    def toggle_user_activation(self, user_id: int) -> Optional[Dict[str, Any]]:
        user = self._user_service.get_user_by_id(user_id, include_inactive=True)
        if not user:
            return None
        return self._user_service.update_user(user_id, is_active=not user["is_active"])

    def toggle_user_debug(self, user_id: int) -> Optional[Dict[str, Any]]:
        user = self._user_service.get_user_by_id(user_id)
        if not user:
            return None
        return self._user_service.update_user(user_id, debug=not user["debug"])

    # -------------------------------------------------------------------------
    # Private helpers
    # -------------------------------------------------------------------------

    def _role_to_dict(self, role: Role) -> Dict[str, Any]:
        return {
            "id": role.id,
            "name": role.name,
            "description": role.description,
            "is_system": role.is_system,
            "created_at": role.created_at.isoformat() if role.created_at else None,
            "updated_at": role.updated_at.isoformat() if role.updated_at else None,
        }

    def _perm_to_dict(self, perm: Permission) -> Dict[str, Any]:
        return {
            "id": perm.id,
            "resource": perm.resource,
            "action": perm.action,
            "description": perm.description,
            "created_at": perm.created_at.isoformat() if perm.created_at else None,
        }
```

---

## `service_factory.py` Additions

```python
def build_user_service():
    """Create a fresh UserService instance."""
    from services.auth.user_service import UserService
    return UserService()


def build_rbac_service():
    """Create a fresh RBACService instance (with UserService injected)."""
    from services.auth.rbac_service import RBACService
    return RBACService(user_service=build_user_service())
```

---

## `dependencies.py` Additions

```python
def get_user_service():
    """Provide a UserService instance."""
    return service_factory.build_user_service()


def get_rbac_service():
    """Provide an RBACService instance."""
    return service_factory.build_rbac_service()
```

---

## Caller Updates

### `core/auth.py`

This is the most critical file. It contains 5 lazy imports of `rbac_manager` and 1 `from user_db_manager import PERMISSIONS_ADMIN`.

**Replace all lazy `import rbac_manager as rbac` with `import service_factory; rbac = service_factory.build_rbac_service()`.**

```python
# Before:
import rbac_manager as rbac

# After:
import service_factory
rbac = service_factory.build_rbac_service()
```

**Replace:**
```python
# Before:
from user_db_manager import PERMISSIONS_ADMIN

# After:
from services.auth.user_service import PERMISSIONS_ADMIN
```

### `routers/settings/rbac.py`

```python
# Before:
import rbac_manager as rbac

# After:
from dependencies import get_rbac_service
from services.auth.rbac_service import RBACService

# Then add to each endpoint:
async def some_endpoint(rbac: RBACService = Depends(get_rbac_service), ...):
    ...
```

### `routers/auth/auth.py` and `routers/auth/oidc.py` (lazy imports)

```python
# Before:
import rbac_manager as rbac

# After:
import service_factory
rbac = service_factory.build_rbac_service()
```

### `routers/jobs/templates.py` and `routers/jobs/schedules.py`

Same lazy import replacement pattern.

### `services/auth/user_management.py`

This existing wrapper currently imports `user_db_manager as user_db`. Update it to use `UserService`:

```python
# Before:
import user_db_manager as user_db

# After:
import service_factory

def _user_service():
    return service_factory.build_user_service()
```
Then replace all `user_db.X(...)` calls with `_user_service().X(...)`.

### `tools/check_user_permissions.py` and `tools/seed_rbac.py`

These are CLI tools, not request handlers. Replace imports:
```python
# Before:
import rbac_manager as rbac
import user_db_manager as user_db

# After:
import service_factory
rbac = service_factory.build_rbac_service()
user_db = service_factory.build_user_service()
```

### `set_admin_password.py` and `scripts/credential_manager/set_password.py`

```python
# Before:
from user_db_manager import PERMISSIONS_ADMIN
from user_db_manager import get_user_by_username, update_user

# After:
from services.auth.user_service import PERMISSIONS_ADMIN
import service_factory
_svc = service_factory.build_user_service()
get_user_by_username = _svc.get_user_by_username
update_user = _svc.update_user
```

### `main.py` — Startup admin creation

```python
# Before (in lifespan or startup):
import user_db_manager
user_db_manager.ensure_admin_has_rbac_role()

# After:
import service_factory
user_svc = service_factory.build_user_service()
rbac_svc = service_factory.build_rbac_service()
user_svc.ensure_admin_has_rbac_role(rbac_svc)
```

---

## Steps

1. Create `backend/services/auth/user_service.py`
2. Create `backend/services/auth/rbac_service.py`
3. Add `build_user_service()` and `build_rbac_service()` to `service_factory.py`
4. Add `get_user_service()` and `get_rbac_service()` to `dependencies.py`
5. Update `core/auth.py` (highest-risk file — test thoroughly after)
6. Update `routers/settings/rbac.py`
7. Update `routers/auth/auth.py`
8. Update `routers/auth/oidc.py`
9. Update `routers/jobs/templates.py` and `routers/jobs/schedules.py`
10. Update `services/auth/user_management.py`
11. Update `tools/check_user_permissions.py` and `tools/seed_rbac.py`
12. Update `set_admin_password.py` and `scripts/credential_manager/set_password.py`
13. Update `main.py` startup call
14. Delete `backend/rbac_manager.py`
15. Delete `backend/user_db_manager.py`
16. Verify:
    ```bash
    grep -rn "rbac_manager\|user_db_manager" backend/ --include="*.py" | grep -v __pycache__
    # Should return 0 results
    ```

---

## Verification Checklist

- [ ] `grep -rn "rbac_manager" backend/` → 0 results
- [ ] `grep -rn "user_db_manager" backend/` → 0 results
- [ ] Both files deleted
- [ ] Backend starts: `python -c "import main"`
- [ ] Login works end-to-end
- [ ] RBAC endpoints (roles, permissions) work
- [ ] Admin role is assigned on startup
- [ ] `core/auth.py` `require_permission()` still enforces permissions correctly
