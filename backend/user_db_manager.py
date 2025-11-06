"""Modern user database management system.

This module provides a dedicated user management system with a separate users.db database
for storing user information including secure password hashing and permission management.
"""

from __future__ import annotations
import os
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from config import settings as config_settings
from core.auth import get_password_hash, verify_password

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

# Database path
USERS_DB_PATH = os.path.join(config_settings.data_directory, "settings", "users.db")


def _get_conn() -> sqlite3.Connection:
    """Get database connection."""
    conn = sqlite3.connect(USERS_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _ensure_users_database() -> None:
    """Create users database and table if they don't exist."""
    os.makedirs(os.path.dirname(USERS_DB_PATH), exist_ok=True)

    with _get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                realname TEXT NOT NULL,
                email TEXT,
                password TEXT NOT NULL,
                permissions INTEGER NOT NULL DEFAULT 1,
                debug INTEGER NOT NULL DEFAULT 0,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )

        # Create index for faster username lookups
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)
            """
        )

        conn.commit()


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
    _ensure_users_database()

    if not username or not realname or not password:
        raise ValueError("Username, realname, and password are required")

    # Hash the password
    hashed_password = get_password_hash(password)
    now = datetime.utcnow().isoformat()

    with _get_conn() as conn:
        try:
            cursor = conn.execute(
                """
                INSERT INTO users (username, realname, email, password, permissions, debug, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    username,
                    realname,
                    email or "",
                    hashed_password,
                    permissions,
                    1 if debug else 0,
                    1 if is_active else 0,
                    now,
                    now,
                ),
            )
            user_id = cursor.lastrowid
            conn.commit()

            return get_user_by_id(user_id, include_inactive=True)

        except sqlite3.IntegrityError as e:
            if "UNIQUE constraint failed: users.username" in str(e):
                raise ValueError(f"Username '{username}' already exists")
            raise


def get_all_users(include_inactive: bool = True) -> List[Dict[str, Any]]:
    """Get all users."""
    _ensure_users_database()

    with _get_conn() as conn:
        if include_inactive:
            query = "SELECT * FROM users ORDER BY created_at DESC"
        else:
            query = "SELECT * FROM users WHERE is_active = 1 ORDER BY created_at DESC"

        rows = conn.execute(query).fetchall()

        users = []
        for row in rows:
            user = {
                "id": row["id"],
                "username": row["username"],
                "realname": row["realname"],
                "email": row["email"] if row["email"] else None,
                "permissions": row["permissions"],
                "debug": bool(row["debug"]),
                "is_active": bool(row["is_active"]),
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }
            users.append(user)

        return users


def get_user_by_id(
    user_id: int, include_inactive: bool = False
) -> Optional[Dict[str, Any]]:
    """Get user by ID."""
    _ensure_users_database()

    with _get_conn() as conn:
        if include_inactive:
            query = "SELECT * FROM users WHERE id = ?"
        else:
            query = "SELECT * FROM users WHERE id = ? AND is_active = 1"

        row = conn.execute(query, (user_id,)).fetchone()

        if row:
            return {
                "id": row["id"],
                "username": row["username"],
                "realname": row["realname"],
                "email": row["email"] if row["email"] else None,
                "permissions": row["permissions"],
                "debug": bool(row["debug"]),
                "is_active": bool(row["is_active"]),
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }

        return None


def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    """Get user by username."""
    _ensure_users_database()

    with _get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE username = ? AND is_active = 1", (username,)
        ).fetchone()

        if row:
            return {
                "id": row["id"],
                "username": row["username"],
                "realname": row["realname"],
                "email": row["email"] if row["email"] else None,
                "permissions": row["permissions"],
                "debug": bool(row["debug"]),
                "is_active": bool(row["is_active"]),
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }

        return None


def authenticate_user(username: str, password: str) -> Optional[Dict[str, Any]]:
    """Authenticate user with username and password."""
    _ensure_users_database()

    with _get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE username = ? AND is_active = 1", (username,)
        ).fetchone()

        if row and verify_password(password, row["password"]):
            return {
                "id": row["id"],
                "username": row["username"],
                "realname": row["realname"],
                "email": row["email"] if row["email"] else None,
                "permissions": row["permissions"],
                "debug": bool(row["debug"]),
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
    permissions: Optional[int] = None,
    debug: Optional[bool] = None,
    is_active: Optional[bool] = None,
) -> Optional[Dict[str, Any]]:
    """Update an existing user."""
    _ensure_users_database()

    # Get current user to verify existence (include inactive for status updates)
    current_user = get_user_by_id(user_id, include_inactive=True)
    if not current_user:
        return None

    now = datetime.utcnow().isoformat()
    updates = []
    params = []

    if realname is not None:
        updates.append("realname = ?")
        params.append(realname)

    if email is not None:
        updates.append("email = ?")
        params.append(email)

    if password is not None:
        updates.append("password = ?")
        params.append(get_password_hash(password))

    if permissions is not None:
        updates.append("permissions = ?")
        params.append(permissions)

    if debug is not None:
        updates.append("debug = ?")
        params.append(1 if debug else 0)

    if is_active is not None:
        updates.append("is_active = ?")
        params.append(1 if is_active else 0)

    if not updates:
        return current_user

    updates.append("updated_at = ?")
    params.append(now)
    params.append(user_id)

    with _get_conn() as conn:
        conn.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()

    return get_user_by_id(user_id, include_inactive=True)


def delete_user(user_id: int) -> bool:
    """Soft delete a user (set is_active = 0)."""
    _ensure_users_database()

    with _get_conn() as conn:
        result = conn.execute(
            "UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?",
            (datetime.utcnow().isoformat(), user_id),
        )
        conn.commit()
        return result.rowcount > 0


def hard_delete_user(user_id: int) -> bool:
    """Permanently delete a user from the database."""
    _ensure_users_database()

    with _get_conn() as conn:
        result = conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
        return result.rowcount > 0


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
    _ensure_users_database()

    with _get_conn() as conn:
        # Check if admin user exists and has correct permissions
        admin_user = conn.execute(
            "SELECT id, permissions FROM users WHERE username = 'admin' AND is_active = 1"
        ).fetchone()

        if admin_user and admin_user["permissions"] != PERMISSIONS_ADMIN:
            # Fix admin permissions
            conn.execute(
                "UPDATE users SET permissions = ?, updated_at = ? WHERE id = ?",
                (PERMISSIONS_ADMIN, datetime.utcnow().isoformat(), admin_user["id"]),
            )
            conn.commit()


def create_default_admin() -> Optional[Dict[str, Any]]:
    """Create a default admin user if no users exist."""
    _ensure_users_database()

    # Check if any users exist
    with _get_conn() as conn:
        count = conn.execute(
            "SELECT COUNT(*) FROM users WHERE is_active = 1"
        ).fetchone()[0]
        if count > 0:
            # Ensure existing admin user has correct permissions
            ensure_admin_user_permissions()
            return None

    # Create default admin user
    try:
        admin_user = create_user(
            username="admin",
            realname="System Administrator",
            password=config_settings.initial_password,
            email="admin@localhost",
            permissions=PERMISSIONS_ADMIN,
            debug=True,
        )
        return admin_user
    except Exception:
        return None


# Initialize database on import
_ensure_users_database()

# Create default admin if no users exist
create_default_admin()
