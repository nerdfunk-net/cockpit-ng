"""Stateful in-memory auth repository fakes for unit testing.

Drop-in replacements for UserRepository and RBACRepository. All data lives in
plain dicts keyed by integer IDs. Methods mirror the real repository interfaces
exactly so services under test require no changes.

Usage::

    from tests.mocks.fake_auth_repositories import FakeUserRepository, FakeRBACRepository

    user_repo = FakeUserRepository()
    user_repo.create(username="alice", realname="Alice", email="", password="hash", permissions=3)

    rbac_repo = FakeRBACRepository()
    role = rbac_repo.create_role("admin", is_system=True)
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Lightweight stand-in objects that mirror SQLAlchemy model attribute access
# ---------------------------------------------------------------------------


class _FakeUser:
    _counter = 0

    def __init__(
        self,
        *,
        username: str,
        realname: str,
        email: str,
        password: str,
        permissions: int,
        debug: bool = False,
        is_active: bool = True,
    ) -> None:
        _FakeUser._counter += 1
        self.id: int = _FakeUser._counter
        self.username = username
        self.realname = realname
        self.email = email
        self.password = password
        self.permissions = permissions
        self.debug = debug
        self.is_active = is_active
        self.last_login: Optional[datetime] = None
        self.created_at: datetime = datetime.now(timezone.utc)
        self.updated_at: datetime = datetime.now(timezone.utc)


class _FakeRole:
    _counter = 0

    def __init__(
        self, *, name: str, description: str = "", is_system: bool = False
    ) -> None:
        _FakeRole._counter += 1
        self.id: int = _FakeRole._counter
        self.name = name
        self.description = description
        self.is_system = is_system
        self.created_at: datetime = datetime.now(timezone.utc)
        self.updated_at: datetime = datetime.now(timezone.utc)


class _FakePermission:
    _counter = 0

    def __init__(self, *, resource: str, action: str, description: str = "") -> None:
        _FakePermission._counter += 1
        self.id: int = _FakePermission._counter
        self.resource = resource
        self.action = action
        self.description = description
        self.created_at: datetime = datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# FakeUserRepository
# ---------------------------------------------------------------------------


class FakeUserRepository:
    """In-memory replacement for UserRepository."""

    def __init__(self) -> None:
        _FakeUser._counter = 0
        self._users: Dict[int, _FakeUser] = {}

    # -- BaseRepository methods -------------------------------------------

    def get_by_id(self, id: int, db: Any = None) -> Optional[_FakeUser]:
        return self._users.get(id)

    def get_all(self, db: Any = None) -> List[_FakeUser]:
        return list(self._users.values())

    def create(
        self,
        *,
        username: str,
        realname: str,
        email: str,
        password: str,
        permissions: int,
        debug: bool = False,
        is_active: bool = True,
        db: Any = None,
    ) -> _FakeUser:
        user = _FakeUser(
            username=username,
            realname=realname,
            email=email,
            password=password,
            permissions=permissions,
            debug=debug,
            is_active=is_active,
        )
        self._users[user.id] = user
        return user

    def update(self, id: int, db: Any = None, **kwargs: Any) -> Optional[_FakeUser]:
        user = self._users.get(id)
        if not user:
            return None
        for key, value in kwargs.items():
            if hasattr(user, key):
                setattr(user, key, value)
        user.updated_at = datetime.now(timezone.utc)
        return user

    def delete(self, id: int, db: Any = None) -> bool:
        if id in self._users:
            del self._users[id]
            return True
        return False

    def count(self, db: Any = None) -> int:
        return len(self._users)

    # -- UserRepository-specific methods ----------------------------------

    def get_by_username(self, username: str) -> Optional[_FakeUser]:
        for u in self._users.values():
            if u.username == username:
                return u
        return None

    def get_by_email(self, email: str) -> Optional[_FakeUser]:
        for u in self._users.values():
            if u.email == email:
                return u
        return None

    def get_active_users(self) -> List[_FakeUser]:
        return [u for u in self._users.values() if u.is_active]

    def username_exists(self, username: str) -> bool:
        return any(u.username == username for u in self._users.values())

    def email_exists(self, email: str) -> bool:
        return any(u.email == email for u in self._users.values())

    def update_password(self, user_id: int, hashed_password: str) -> bool:
        user = self._users.get(user_id)
        if user:
            user.password = hashed_password
            return True
        return False

    def set_active_status(self, user_id: int, is_active: bool) -> bool:
        user = self._users.get(user_id)
        if user:
            user.is_active = is_active
            return True
        return False

    def update_last_login(self, user_id: int, db=None, auto_commit: bool = True) -> bool:
        user = self._users.get(user_id)
        if user:
            user.last_login = datetime.now(timezone.utc)
            return True
        return False

    def search_users(self, query: str) -> List[_FakeUser]:
        q = query.lower()
        return [
            u
            for u in self._users.values()
            if q in u.username.lower()
            or q in (u.email or "").lower()
            or q in u.realname.lower()
        ]

    def get_by_username_or_email(self, identifier: str) -> Optional[_FakeUser]:
        return self.get_by_username(identifier) or self.get_by_email(identifier)


# ---------------------------------------------------------------------------
# FakeRBACRepository
# ---------------------------------------------------------------------------


class FakeRBACRepository:
    """In-memory replacement for RBACRepository."""

    def __init__(self) -> None:
        _FakeRole._counter = 0
        _FakePermission._counter = 0
        self._roles: Dict[int, _FakeRole] = {}
        self._permissions: Dict[int, _FakePermission] = {}
        # role_id -> {permission_id -> granted}
        self._role_permissions: Dict[int, Dict[int, bool]] = {}
        # user_id -> {role_id}
        self._user_roles: Dict[int, set] = {}
        # user_id -> {permission_id -> granted}
        self._user_permissions: Dict[int, Dict[int, bool]] = {}

    # -- Permission operations --------------------------------------------

    def create_permission(
        self, resource: str, action: str, description: str = ""
    ) -> _FakePermission:
        perm = _FakePermission(
            resource=resource, action=action, description=description
        )
        self._permissions[perm.id] = perm
        return perm

    def get_permission(self, resource: str, action: str) -> Optional[_FakePermission]:
        for p in self._permissions.values():
            if p.resource == resource and p.action == action:
                return p
        return None

    def get_permission_by_id(self, permission_id: int) -> Optional[_FakePermission]:
        return self._permissions.get(permission_id)

    def list_permissions(self) -> List[_FakePermission]:
        return sorted(self._permissions.values(), key=lambda p: (p.resource, p.action))

    def delete_permission(self, permission_id: int) -> bool:
        if permission_id in self._permissions:
            del self._permissions[permission_id]
            # Clean up role_permissions and user_permissions
            for role_id in self._role_permissions:
                self._role_permissions[role_id].pop(permission_id, None)
            for user_id in self._user_permissions:
                self._user_permissions[user_id].pop(permission_id, None)
            return True
        return False

    # -- Role operations --------------------------------------------------

    def create_role(
        self, name: str, description: str = "", is_system: bool = False
    ) -> _FakeRole:
        role = _FakeRole(name=name, description=description, is_system=is_system)
        self._roles[role.id] = role
        self._role_permissions[role.id] = {}
        return role

    def get_role(self, role_id: int) -> Optional[_FakeRole]:
        return self._roles.get(role_id)

    def get_role_by_name(self, name: str) -> Optional[_FakeRole]:
        for r in self._roles.values():
            if r.name == name:
                return r
        return None

    def list_roles(self) -> List[_FakeRole]:
        return sorted(self._roles.values(), key=lambda r: r.name)

    def update_role(self, role_id: int, **kwargs: Any) -> Optional[_FakeRole]:
        role = self._roles.get(role_id)
        if role:
            for key, value in kwargs.items():
                if hasattr(role, key):
                    setattr(role, key, value)
        return role

    def delete_role(self, role_id: int) -> bool:
        if role_id in self._roles:
            del self._roles[role_id]
            self._role_permissions.pop(role_id, None)
            for user_id in self._user_roles:
                self._user_roles[user_id].discard(role_id)
            return True
        return False

    def role_name_exists(self, name: str) -> bool:
        return any(r.name == name for r in self._roles.values())

    # -- Role-Permission operations ----------------------------------------

    def assign_permission_to_role(
        self, role_id: int, permission_id: int, granted: bool = True
    ) -> None:
        self._role_permissions.setdefault(role_id, {})[permission_id] = granted

    def remove_permission_from_role(self, role_id: int, permission_id: int) -> bool:
        mapping = self._role_permissions.get(role_id, {})
        if permission_id in mapping:
            del mapping[permission_id]
            return True
        return False

    def get_role_permissions(self, role_id: int) -> List[_FakePermission]:
        mapping = self._role_permissions.get(role_id, {})
        return [
            self._permissions[pid]
            for pid, granted in mapping.items()
            if granted and pid in self._permissions
        ]

    # -- User-Role operations ---------------------------------------------

    def assign_role_to_user(self, user_id: int, role_id: int) -> None:
        self._user_roles.setdefault(user_id, set()).add(role_id)

    def remove_role_from_user(self, user_id: int, role_id: int) -> bool:
        roles = self._user_roles.get(user_id, set())
        if role_id in roles:
            roles.discard(role_id)
            return True
        return False

    def get_user_roles(self, user_id: int) -> List[_FakeRole]:
        role_ids = self._user_roles.get(user_id, set())
        return [self._roles[rid] for rid in role_ids if rid in self._roles]

    def get_users_with_role(self, role_id: int) -> List[int]:
        return [uid for uid, roles in self._user_roles.items() if role_id in roles]

    # -- User-Permission operations ----------------------------------------

    def assign_permission_to_user(
        self, user_id: int, permission_id: int, granted: bool = True
    ) -> None:
        self._user_permissions.setdefault(user_id, {})[permission_id] = granted

    def remove_permission_from_user(self, user_id: int, permission_id: int) -> bool:
        mapping = self._user_permissions.get(user_id, {})
        if permission_id in mapping:
            del mapping[permission_id]
            return True
        return False

    def get_user_permissions(self, user_id: int) -> List[_FakePermission]:
        mapping = self._user_permissions.get(user_id, {})
        return [
            self._permissions[pid]
            for pid, granted in mapping.items()
            if granted and pid in self._permissions
        ]

    def get_user_permission_override(
        self, user_id: int, permission_id: int
    ) -> Optional[bool]:
        return self._user_permissions.get(user_id, {}).get(permission_id)

    def get_user_permission_overrides_with_status(
        self, user_id: int
    ) -> List[Tuple[_FakePermission, bool]]:
        mapping = self._user_permissions.get(user_id, {})
        result = []
        for pid, granted in mapping.items():
            perm = self._permissions.get(pid)
            if perm:
                result.append((perm, granted))
        return result
