"""Modern user database management system.

This module provides a dedicated user management system using PostgreSQL
for storing user information including secure password hashing and permission management.

MIGRATION NOTE: This file has been refactored to use SQLAlchemy and PostgreSQL
instead of direct SQLite3 connections. The API remains the same for backward compatibility.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional, Tuple
from core.auth import get_password_hash, verify_password
from repositories.auth.user_repository import UserRepository
from core.models import User

# Permission bit flags
PERMISSION_READ = 1
PERMISSION_WRITE = 2
PERMISSION_ADMIN = 4
PERMISSION_DELETE = 8
PERMISSION_USER_MANAGE = 16

# Permission presets
PERMISSIONS_VIEWER = PERMISSION_READ
PERMISSIONS_USER = PERMISSION_READ | PERMISSION_WRITE
PERMISSIONS_ADMIN = (
    PERMISSION_READ
    | PERMISSION_WRITE
    | PERMISSION_ADMIN
    | PERMISSION_DELETE
    | PERMISSION_USER_MANAGE
)

# Initialize repository
_user_repo = UserRepository()


def _user_to_dict(user: User) -> Dict[str, Any]:
    """Convert User model to dictionary for backward compatibility."""
    return {
        "id": user.id,
        "username": user.username,
        "realname": user.realname,
        "email": user.email,
        "permissions": user.permissions,
        "debug": user.debug,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }


def create_user(
    username: str,
    realname: str,
    password: str,
    email: Optional[str] = None,
    permissions: int = PERMISSIONS_USER,
    debug: bool = False,
    is_active: bool = True,
) -> Dict[str, Any]:
    """Create a new user."""
    if not username or not realname or not password:
        raise ValueError("Username, realname, and password are required")

    # Check if username already exists
    if _user_repo.username_exists(username):
        raise ValueError(f"Username '{username}' already exists")

    # Hash the password
    hashed_password = get_password_hash(password)

    # Create user
    user = _user_repo.create(
        username=username,
        realname=realname,
        email=email or "",
        password=hashed_password,
        permissions=permissions,
        debug=debug,
        is_active=is_active,
    )

    return _user_to_dict(user)


def get_all_users(include_inactive: bool = True) -> List[Dict[str, Any]]:
    """Get all users."""
    if include_inactive:
        users = _user_repo.get_all()
    else:
        users = _user_repo.get_active_users()

    return [_user_to_dict(user) for user in users]


def get_user_by_id(
    user_id: int, include_inactive: bool = False
) -> Optional[Dict[str, Any]]:
    """Get user by ID."""
    user = _user_repo.get_by_id(user_id)

    if user and (include_inactive or user.is_active):
        return _user_to_dict(user)

    return None


def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    """Get user by username."""
    user = _user_repo.get_by_username(username)

    if user and user.is_active:
        return _user_to_dict(user)

    return None


def authenticate_user(username: str, password: str) -> Optional[Dict[str, Any]]:
    """Authenticate user with username and password."""
    user = _user_repo.get_by_username(username)

    if user and user.is_active and verify_password(password, user.password):
        return _user_to_dict(user)

    return None


def update_user(
    user_id: int,
    realname: Optional[str] = None,
    email: Optional[str] = None,
    password: Optional[str] = None,
    permissions: Optional[int] = None,
    debug: Optional[bool] = None,
    is_active: Optional[bool] = None,
) -> Optional[Dict[str, Any]]:
    """Update an existing user."""
    # Get current user to verify existence
    current_user = _user_repo.get_by_id(user_id)
    if not current_user:
        return None

    # Build update kwargs
    updates = {}

    if realname is not None:
        updates["realname"] = realname

    if email is not None:
        updates["email"] = email

    if password is not None:
        # Ensure password meets minimum requirements if being changed
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
        return _user_to_dict(current_user)

    # Update user
    updated_user = _user_repo.update(user_id, **updates)

    if updated_user:
        return _user_to_dict(updated_user)

    return None


def delete_user(user_id: int) -> bool:
    """Soft delete a user (set is_active = False)."""
    return _user_repo.set_active_status(user_id, False)


def hard_delete_user(user_id: int) -> bool:
    """Permanently delete a user from the database."""
    return _user_repo.delete(user_id)


def bulk_delete_users(user_ids: List[int]) -> Tuple[int, List[str]]:
    """Soft delete multiple users. Returns (success_count, error_messages)."""
    success_count = 0
    errors = []

    for user_id in user_ids:
        try:
            if delete_user(user_id):
                success_count += 1
            else:
                errors.append(f"User ID {user_id} not found")
        except Exception as e:
            errors.append(f"Failed to delete user ID {user_id}: {str(e)}")

    return success_count, errors


def bulk_hard_delete_users(user_ids: List[int]) -> Tuple[int, List[str]]:
    """Permanently delete multiple users from the database. Returns (success_count, error_messages)."""
    success_count = 0
    errors = []

    for user_id in user_ids:
        try:
            if hard_delete_user(user_id):
                success_count += 1
            else:
                errors.append(f"User ID {user_id} not found")
        except Exception as e:
            errors.append(f"Failed to delete user ID {user_id}: {str(e)}")

    return success_count, errors


def bulk_update_permissions(
    user_ids: List[int], permissions: int
) -> Tuple[int, List[str]]:
    """Update permissions for multiple users. Returns (success_count, error_messages)."""
    success_count = 0
    errors = []

    for user_id in user_ids:
        try:
            if update_user(user_id, permissions=permissions):
                success_count += 1
            else:
                errors.append(f"User ID {user_id} not found")
        except Exception as e:
            errors.append(
                f"Failed to update permissions for user ID {user_id}: {str(e)}"
            )

    return success_count, errors


def has_permission(user: Dict[str, Any], permission: int) -> bool:
    """Check if user has a specific permission."""
    return bool(user["permissions"] & permission)


def get_permission_name(permission: int) -> str:
    """Get human-readable permission name."""
    permissions = []
    if permission & PERMISSION_READ:
        permissions.append("Read")
    if permission & PERMISSION_WRITE:
        permissions.append("Write")
    if permission & PERMISSION_ADMIN:
        permissions.append("Admin")
    if permission & PERMISSION_DELETE:
        permissions.append("Delete")
    if permission & PERMISSION_USER_MANAGE:
        permissions.append("User Management")

    return ", ".join(permissions) if permissions else "None"


def get_role_name(permissions: int) -> str:
    """Get role name based on permissions."""
    if permissions == PERMISSIONS_ADMIN:
        return "admin"
    elif permissions == PERMISSIONS_USER:
        return "user"
    elif permissions == PERMISSIONS_VIEWER:
        return "viewer"
    else:
        return "custom"


def get_permissions_for_role(role: str) -> int:
    """Get permission flags for a role."""
    role_map = {
        "admin": PERMISSIONS_ADMIN,
        "user": PERMISSIONS_USER,
        "viewer": PERMISSIONS_VIEWER,
    }
    return role_map.get(role, PERMISSIONS_USER)


def ensure_admin_user_permissions() -> None:
    """Ensure the admin user always has admin permissions."""
    admin_user = _user_repo.get_by_username("admin")

    if admin_user and admin_user.permissions != PERMISSIONS_ADMIN:
        # Fix admin permissions
        _user_repo.update(admin_user.id, permissions=PERMISSIONS_ADMIN)


def _ensure_admin_role_assigned(user_id: Optional[int] = None) -> None:
    """Ensure admin user has admin role assigned in RBAC system.

    Args:
        user_id: User ID to assign admin role to. If None, looks up admin user.
    """
    try:
        # Avoid circular import
        import rbac_manager as rbac

        # Get admin user ID if not provided
        if user_id is None:
            admin_user = get_user_by_username("admin")
            if not admin_user:
                return
            user_id = admin_user["id"]

        # Get or create admin role
        admin_role = rbac.get_role_by_name("admin")
        if not admin_role:
            # Run seed script to create roles and permissions (silently)
            try:
                import seed_rbac

                seed_rbac.main(verbose=False)
                admin_role = rbac.get_role_by_name("admin")
                import logging

                logging.getLogger(__name__).info(
                    "Initialized RBAC system with default roles and permissions"
                )
            except Exception as e:
                import logging

                logging.getLogger(__name__).warning(f"Failed to seed RBAC: {e}")
                return

        if admin_role:
            # Check if user already has admin role
            user_roles = rbac.get_user_roles(user_id)
            if not any(role["name"] == "admin" for role in user_roles):
                # Assign admin role
                rbac.assign_role_to_user(user_id, admin_role["id"])
                import logging

                logging.getLogger(__name__).info(
                    f"Assigned admin role to user ID {user_id}"
                )
    except Exception as e:
        import logging

        logging.getLogger(__name__).warning(
            f"Failed to ensure admin role assignment: {e}"
        )


def _create_default_admin_without_rbac() -> Optional[Dict[str, Any]]:
    """Create default admin user without RBAC assignment (to avoid circular imports at module init)."""
    # Check if any users exist
    user_count = _user_repo.count()
    if user_count > 0:
        # Ensure existing admin user has correct permissions
        ensure_admin_user_permissions()
        return None

    # Create default admin user
    try:
        from config import settings as config_settings

        admin_user = create_user(
            username="admin",
            realname="System Administrator",
            password=config_settings.initial_password,
            email="admin@localhost",
            permissions=PERMISSIONS_ADMIN,
            debug=True,
        )
        import logging

        logging.getLogger(__name__).info(
            "Created default admin user (RBAC role will be assigned at startup)"
        )
        return admin_user
    except Exception as e:
        import logging

        logging.getLogger(__name__).warning(f"Failed to create default admin: {e}")
        return None


def ensure_admin_has_rbac_role() -> None:
    """
    Ensure admin user exists and has admin role assigned.
    Called at app startup after tables are created.
    """
    try:
        # First create default admin if no users exist
        _create_default_admin_without_rbac()

        # Then ensure admin has RBAC role
        admin_user = get_user_by_username("admin")
        if admin_user:
            _ensure_admin_role_assigned(admin_user["id"])
    except Exception as e:
        import logging

        logging.getLogger(__name__).warning(f"Failed to ensure admin RBAC role: {e}")


# NOTE: Default admin creation moved to ensure_admin_has_rbac_role()
# to avoid running before tables are created
