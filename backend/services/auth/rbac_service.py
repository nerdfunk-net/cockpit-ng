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

    def create_permission(
        self, resource: str, action: str, description: str = ""
    ) -> Dict[str, Any]:
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

    def create_role(
        self, name: str, description: str = "", is_system: bool = False
    ) -> Dict[str, Any]:
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

    def update_role(
        self,
        role_id: int,
        name: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Dict[str, Any]:
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

    def assign_permission_to_role(
        self, role_id: int, permission_id: int, granted: bool = True
    ) -> None:
        self._rbac_repo.assign_permission_to_role(role_id, permission_id, granted)

    def remove_permission_from_role(self, role_id: int, permission_id: int) -> None:
        self._rbac_repo.remove_permission_from_role(role_id, permission_id)

    def get_role_permissions(self, role_id: int) -> List[Dict[str, Any]]:
        return [
            self._perm_to_dict(p) for p in self._rbac_repo.get_role_permissions(role_id)
        ]

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

    def assign_permission_to_user(
        self, user_id: int, permission_id: int, granted: bool = True
    ) -> None:
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
            if any(
                p.id == perm.id for p in self._rbac_repo.get_role_permissions(role.id)
            ):
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

    def check_any_permission(
        self, user_id: int, resource: str, actions: List[str]
    ) -> bool:
        return any(self.has_permission(user_id, resource, a) for a in actions)

    def check_all_permissions(
        self, user_id: int, resource: str, actions: List[str]
    ) -> bool:
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
            username=username,
            realname=realname,
            password=password,
            email=email,
            permissions=1,
            debug=debug,
            is_active=is_active,
        )
        if role_ids:
            for role_id in role_ids:
                if not self.get_role(role_id):
                    self._user_service.hard_delete_user(user["id"])
                    raise ValueError(f"Role with id {role_id} not found")
                self.assign_role_to_user(user["id"], role_id)
        return user

    def get_user_with_rbac(
        self, user_id: int, include_inactive: bool = False
    ) -> Optional[Dict[str, Any]]:
        user = self._user_service.get_user_by_id(
            user_id, include_inactive=include_inactive
        )
        if not user:
            return None
        user["roles"] = self.get_user_roles(user_id)
        user["permissions"] = self.get_user_permissions(user_id)
        return user

    def list_users_with_rbac(
        self, include_inactive: bool = True
    ) -> List[Dict[str, Any]]:
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
            user_id=user_id,
            realname=realname,
            email=email,
            password=password,
            permissions=None,
            debug=None,
            is_active=is_active,
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
                logger.info(
                    "Deleted %s private credentials for user %s", deleted, username
                )
            except Exception as e:
                logger.warning(
                    "Failed to delete credentials for user %s: %s", username, e
                )
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
