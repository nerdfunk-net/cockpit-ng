"""User management service — thin layer over UserRepository with password hashing."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Tuple

if TYPE_CHECKING:
    from services.auth.rbac_service import RBACService

from core.auth import get_password_hash, verify_password
from core.models import User
from repositories.auth.user_repository import UserRepository

logger = logging.getLogger(__name__)

# Permission bit flags — exported at module level for backward compatibility
PERMISSION_READ = 1
PERMISSION_WRITE = 2
PERMISSION_ADMIN = 4
PERMISSION_DELETE = 8
PERMISSION_USER_MANAGE = 16

PERMISSIONS_VIEWER = PERMISSION_READ
PERMISSIONS_USER = PERMISSION_READ | PERMISSION_WRITE
PERMISSIONS_ADMIN = PERMISSION_READ | PERMISSION_WRITE | PERMISSION_ADMIN | PERMISSION_DELETE | PERMISSION_USER_MANAGE


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

    def ensure_admin_has_rbac_role(self, rbac_service: RBACService) -> None:
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

    def _ensure_admin_role_assigned(self, user_id: int, rbac_service: RBACService) -> None:
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
        if permission & PERMISSION_READ:
            names.append("Read")
        if permission & PERMISSION_WRITE:
            names.append("Write")
        if permission & PERMISSION_ADMIN:
            names.append("Admin")
        if permission & PERMISSION_DELETE:
            names.append("Delete")
        if permission & PERMISSION_USER_MANAGE:
            names.append("User Management")
        return ", ".join(names) if names else "None"

    @staticmethod
    def get_role_name(permissions: int) -> str:
        return {
            PERMISSIONS_ADMIN: "admin",
            PERMISSIONS_USER: "user",
            PERMISSIONS_VIEWER: "viewer",
        }.get(permissions, "custom")

    @staticmethod
    def get_permissions_for_role(role: str) -> int:
        return {
            "admin": PERMISSIONS_ADMIN,
            "user": PERMISSIONS_USER,
            "viewer": PERMISSIONS_VIEWER,
        }.get(role, PERMISSIONS_USER)

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
