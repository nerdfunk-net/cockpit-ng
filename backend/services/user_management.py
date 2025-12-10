"""User management service using the new users database.

This service provides user management functionality using the new users.db database
with modern permission handling and secure password management.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional, Tuple
import logging
import user_db_manager as user_db
from models.user_management import UserRole

logger = logging.getLogger(__name__)


def create_user(
    username: str,
    realname: str,
    password: str,
    email: Optional[str] = None,
    role: UserRole = UserRole.user,
    debug: bool = False,
    is_active: bool = True,
) -> Dict[str, Any]:
    """Create a new user."""
    # Get permissions for role
    permissions = user_db.get_permissions_for_role(role.value)

    try:
        user = user_db.create_user(
            username=username,
            realname=realname,
            password=password,
            email=email,
            permissions=permissions,
            debug=debug,
            is_active=is_active,
        )

        # Add role to response
        user["role"] = user_db.get_role_name(user["permissions"])
        return user

    except ValueError as e:
        raise Exception(str(e))
    except Exception as e:
        raise Exception(f"Failed to create user: {str(e)}")


def get_all_users(include_inactive: bool = True) -> List[Dict[str, Any]]:
    """Get all users with role information."""
    try:
        users = user_db.get_all_users(include_inactive=include_inactive)

        # Add role information to each user
        for user in users:
            user["role"] = user_db.get_role_name(user["permissions"])

        return users
    except Exception as e:
        raise Exception(f"Failed to get users: {str(e)}")


def get_user_by_id(
    user_id: int, include_inactive: bool = False
) -> Optional[Dict[str, Any]]:
    """Get user by ID with role information."""
    try:
        user = user_db.get_user_by_id(user_id, include_inactive=include_inactive)
        if user:
            user["role"] = user_db.get_role_name(user["permissions"])
        return user
    except Exception as e:
        raise Exception(f"Failed to get user: {str(e)}")


def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    """Get user by username with role information."""
    try:
        user = user_db.get_user_by_username(username)
        if user:
            user["role"] = user_db.get_role_name(user["permissions"])
        return user
    except Exception as e:
        raise Exception(f"Failed to get user: {str(e)}")


def authenticate_user(username: str, password: str) -> Optional[Dict[str, Any]]:
    """Authenticate user with username and password."""
    try:
        user = user_db.authenticate_user(username, password)
        if user:
            user["role"] = user_db.get_role_name(user["permissions"])
        return user
    except Exception as e:
        raise Exception(f"Authentication failed: {str(e)}")


def update_user(
    user_id: int,
    realname: Optional[str] = None,
    email: Optional[str] = None,
    password: Optional[str] = None,
    role: Optional[UserRole] = None,
    permissions: Optional[int] = None,
    debug: Optional[bool] = None,
    is_active: Optional[bool] = None,
) -> Optional[Dict[str, Any]]:
    """Update an existing user."""
    try:
        # If role is provided, convert to permissions
        if role is not None and permissions is None:
            permissions = user_db.get_permissions_for_role(role.value)

        user = user_db.update_user(
            user_id=user_id,
            realname=realname,
            email=email,
            password=password,
            permissions=permissions,
            debug=debug,
            is_active=is_active,
        )

        if user:
            user["role"] = user_db.get_role_name(user["permissions"])

        return user
    except Exception as e:
        raise Exception(f"Failed to update user: {str(e)}")


def delete_user(user_id: int) -> bool:
    """Delete a user (soft delete - sets is_active=0)."""
    try:
        return user_db.delete_user(user_id)
    except Exception as e:
        raise Exception(f"Failed to delete user: {str(e)}")


def hard_delete_user(user_id: int) -> bool:
    """Permanently delete a user from the database."""
    try:
        return user_db.hard_delete_user(user_id)
    except Exception as e:
        raise Exception(f"Failed to permanently delete user: {str(e)}")


def bulk_delete_users(user_ids: List[int]) -> Tuple[int, List[str]]:
    """Delete multiple users. Returns (success_count, error_messages)."""
    try:
        return user_db.bulk_delete_users(user_ids)
    except Exception as e:
        return 0, [f"Failed to delete users: {str(e)}"]


def bulk_hard_delete_users(user_ids: List[int]) -> Tuple[int, List[str]]:
    """Permanently delete multiple users. Returns (success_count, error_messages)."""
    try:
        return user_db.bulk_hard_delete_users(user_ids)
    except Exception as e:
        return 0, [f"Failed to delete users: {str(e)}"]


def bulk_update_permissions(
    user_ids: List[int], permissions: int
) -> Tuple[int, List[str]]:
    """Update permissions for multiple users. Returns (success_count, error_messages)."""
    try:
        return user_db.bulk_update_permissions(user_ids, permissions)
    except Exception as e:
        return 0, [f"Failed to update permissions: {str(e)}"]


def has_permission(user: Dict[str, Any], permission: int) -> bool:
    """Check if user has a specific permission."""
    return user_db.has_permission(user, permission)


def get_permission_name(permissions: int) -> str:
    """Get human-readable permission name."""
    return user_db.get_permission_name(permissions)


def toggle_user_status(user_id: int) -> Optional[Dict[str, Any]]:
    """Toggle user active status."""
    try:
        logger.info(f"toggle_user_status: Starting for user_id={user_id}")
        # Include inactive users when fetching for status toggle
        user = get_user_by_id(user_id, include_inactive=True)
        logger.info(f"toggle_user_status: get_user_by_id returned: {user}")
        if not user:
            logger.warning(f"toggle_user_status: User not found for user_id={user_id}")
            return None

        # Toggle the status
        new_status = not user["is_active"]
        logger.info(
            f"toggle_user_status: Toggling from {user['is_active']} to {new_status}"
        )
        result = update_user(user_id, is_active=new_status)
        logger.info(f"toggle_user_status: update_user returned: {result}")
        return result
    except Exception as e:
        logger.error(f"toggle_user_status: Exception occurred: {e}")
        raise Exception(f"Failed to toggle user status: {str(e)}")


# Permission constants for easy access
PERMISSION_READ = user_db.PERMISSION_READ
PERMISSION_WRITE = user_db.PERMISSION_WRITE
PERMISSION_ADMIN = user_db.PERMISSION_ADMIN
PERMISSION_DELETE = user_db.PERMISSION_DELETE
PERMISSION_USER_MANAGE = user_db.PERMISSION_USER_MANAGE

PERMISSIONS_VIEWER = user_db.PERMISSIONS_VIEWER
PERMISSIONS_USER = user_db.PERMISSIONS_USER
PERMISSIONS_ADMIN = user_db.PERMISSIONS_ADMIN
