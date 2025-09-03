"""User management service.

Provides comprehensive user management functionality including CRUD operations,
role management, and permissions handling.
"""

from __future__ import annotations
import os
import sqlite3
import json
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from config import settings as config_settings
import credentials_manager as cred_mgr
import profile_manager
from models.user_management import UserRole, UserPermissions

DB_PATH = os.path.join(
    config_settings.data_directory, "settings", "cockpit_settings.db"
)


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _ensure_user_management_tables() -> None:
    """Create user management tables if they don't exist."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with _get_conn() as conn:
        # Extend existing user_profiles table with role and permissions
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_management (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                realname TEXT NOT NULL,
                email TEXT,
                role TEXT NOT NULL DEFAULT 'user',
                permissions TEXT NOT NULL DEFAULT '{"can_read": true, "can_write": false, "can_admin": false, "can_delete": false}',
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


def _serialize_permissions(permissions: UserPermissions) -> str:
    """Serialize permissions to JSON string."""
    return json.dumps(permissions.model_dump())


def _deserialize_permissions(permissions_json: str) -> UserPermissions:
    """Deserialize permissions from JSON string."""
    try:
        perms_dict = json.loads(permissions_json)
        return UserPermissions(**perms_dict)
    except (json.JSONDecodeError, TypeError):
        # Return default permissions if deserialization fails
        return UserPermissions()


def create_user(
    username: str,
    realname: str,
    password: str,
    email: Optional[str] = None,
    role: UserRole = UserRole.user,
    permissions: Optional[UserPermissions] = None,
) -> Dict[str, Any]:
    """Create a new user with credentials."""
    _ensure_user_management_tables()

    if permissions is None:
        permissions = UserPermissions()

    now = datetime.utcnow().isoformat()

    try:
        # Create credential first
        cred_mgr.create_credential(
            name=f"{username} User Account",
            username=username,
            cred_type="user",
            password=password,
            valid_until=None,
        )

        # Create user record
        with _get_conn() as conn:
            cursor = conn.execute(
                """
                INSERT INTO user_management (username, realname, email, role, permissions, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    username,
                    realname,
                    email or "",
                    role.value,
                    _serialize_permissions(permissions),
                    now,
                    now,
                ),
            )
            user_id = cursor.lastrowid
            conn.commit()

        # Also create profile record for compatibility
        profile_manager.update_user_profile(
            username=username, realname=realname, email=email, debug_mode=False
        )

        return get_user_by_id(user_id)

    except Exception as e:
        # Clean up credential if user creation failed
        try:
            credentials = cred_mgr.list_credentials()
            for cred in credentials:
                if (
                    cred["username"] == username
                    and cred["name"] == f"{username} User Account"
                ):
                    cred_mgr.delete_credential(cred["id"])
                    break
        except Exception:
            # Ignore errors during cleanup
            pass
        raise Exception(f"Failed to create user: {str(e)}")


def get_all_users() -> List[Dict[str, Any]]:
    """Get all users."""
    _ensure_user_management_tables()

    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM user_management ORDER BY created_at DESC"
        ).fetchall()

        users = []
        for row in rows:
            user = {
                "id": row["id"],
                "username": row["username"],
                "realname": row["realname"],
                "email": row["email"],
                "role": row["role"],
                "permissions": _deserialize_permissions(row["permissions"]),
                "is_active": bool(row["is_active"]),
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }
            users.append(user)

        return users


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """Get user by ID."""
    _ensure_user_management_tables()

    with _get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM user_management WHERE id = ?", (user_id,)
        ).fetchone()

        if row:
            return {
                "id": row["id"],
                "username": row["username"],
                "realname": row["realname"],
                "email": row["email"],
                "role": row["role"],
                "permissions": _deserialize_permissions(row["permissions"]),
                "is_active": bool(row["is_active"]),
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }

        return None


def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    """Get user by username."""
    _ensure_user_management_tables()

    with _get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM user_management WHERE username = ?", (username,)
        ).fetchone()

        if row:
            return {
                "id": row["id"],
                "username": row["username"],
                "realname": row["realname"],
                "email": row["email"],
                "role": row["role"],
                "permissions": _deserialize_permissions(row["permissions"]),
                "is_active": bool(row["is_active"]),
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }

        return None


def update_user(
    user_id: int,
    realname: Optional[str] = None,
    email: Optional[str] = None,
    password: Optional[str] = None,
    role: Optional[UserRole] = None,
    permissions: Optional[UserPermissions] = None,
    is_active: Optional[bool] = None,
) -> Optional[Dict[str, Any]]:
    """Update an existing user."""
    _ensure_user_management_tables()

    # Get current user data
    user = get_user_by_id(user_id)
    if not user:
        return None

    now = datetime.utcnow().isoformat()

    try:
        with _get_conn() as conn:
            # Build update query dynamically
            updates = []
            params = []

            if realname is not None:
                updates.append("realname = ?")
                params.append(realname)

            if email is not None:
                updates.append("email = ?")
                params.append(email)

            if role is not None:
                updates.append("role = ?")
                params.append(role.value)

            if permissions is not None:
                updates.append("permissions = ?")
                params.append(_serialize_permissions(permissions))

            if is_active is not None:
                updates.append("is_active = ?")
                params.append(1 if is_active else 0)

            updates.append("updated_at = ?")
            params.append(now)
            params.append(user_id)

            conn.execute(
                f"UPDATE user_management SET {', '.join(updates)} WHERE id = ?", params
            )
            conn.commit()

        # Update password in credentials if provided
        if password is not None:
            profile_manager.update_user_password(user["username"], password)

        # Update profile for compatibility
        if realname is not None or email is not None:
            profile_manager.update_user_profile(
                username=user["username"], realname=realname, email=email
            )

        return get_user_by_id(user_id)

    except Exception as e:
        raise Exception(f"Failed to update user: {str(e)}")


def delete_user(user_id: int) -> bool:
    """Delete a user and their credentials."""
    _ensure_user_management_tables()

    # Get user data before deletion
    user = get_user_by_id(user_id)
    if not user:
        return False

    try:
        # Delete from user_management table
        with _get_conn() as conn:
            conn.execute("DELETE FROM user_management WHERE id = ?", (user_id,))
            conn.commit()

        # Delete credentials
        credentials = cred_mgr.list_credentials()
        for cred in credentials:
            if cred["username"] == user["username"]:
                cred_mgr.delete_credential(cred["id"])

        # Delete profile (optional, for cleanup)
        with _get_conn() as conn:
            conn.execute(
                "DELETE FROM user_profiles WHERE username = ?", (user["username"],)
            )
            conn.commit()

        return True

    except Exception as e:
        raise Exception(f"Failed to delete user: {str(e)}")


def bulk_delete_users(user_ids: List[int]) -> Tuple[int, List[str]]:
    """Delete multiple users. Returns (success_count, error_messages)."""
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


def bulk_update_permissions(
    user_ids: List[int], permissions: UserPermissions
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


# Initialize tables on import
_ensure_user_management_tables()
