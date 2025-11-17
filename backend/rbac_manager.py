"""Modern Role-Based Access Control (RBAC) system.

This module implements a flexible permission management system with:
- Roles: Groups of permissions (admin, operator, viewer, etc.)
- Permissions: Granular access control (resource + action)
- User-Role mapping: Users can have multiple roles
- User-Permission overrides: Direct permission grants/denials

Permission Resolution:
1. Check user-specific permission overrides (highest priority)
2. Check role-based permissions
3. Default deny
"""

from __future__ import annotations
import os
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from config import settings as config_settings

# Database path
RBAC_DB_PATH = os.path.join(config_settings.data_directory, "settings", "rbac.db")


def _get_conn() -> sqlite3.Connection:
    """Get database connection."""
    conn = sqlite3.connect(RBAC_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _ensure_rbac_database() -> None:
    """Create RBAC database and tables if they don't exist."""
    os.makedirs(os.path.dirname(RBAC_DB_PATH), exist_ok=True)

    with _get_conn() as conn:
        # Roles table
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS roles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                is_system INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )

        # Permissions table
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS permissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                resource TEXT NOT NULL,
                action TEXT NOT NULL,
                description TEXT,
                created_at TEXT NOT NULL,
                UNIQUE(resource, action)
            )
            """
        )

        # Role-Permission mapping
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS role_permissions (
                role_id INTEGER NOT NULL,
                permission_id INTEGER NOT NULL,
                granted INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                PRIMARY KEY (role_id, permission_id),
                FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
                FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
            )
            """
        )

        # User-Role mapping
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_roles (
                user_id INTEGER NOT NULL,
                role_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY (user_id, role_id),
                FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
            )
            """
        )

        # User-Permission overrides
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_permissions (
                user_id INTEGER NOT NULL,
                permission_id INTEGER NOT NULL,
                granted INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                PRIMARY KEY (user_id, permission_id),
                FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
            )
            """
        )

        # Create indexes for performance
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource, action)"
        )

        conn.commit()


# Initialize database on module import
_ensure_rbac_database()


# ============================================================================
# Permission Management
# ============================================================================


def create_permission(
    resource: str, action: str, description: str = ""
) -> Dict[str, Any]:
    """Create a new permission.

    Args:
        resource: Resource identifier (e.g., 'nautobot.devices', 'configs.backup')
        action: Action type (e.g., 'read', 'write', 'delete', 'execute')
        description: Human-readable description

    Returns:
        Dictionary with permission details
    """
    now = datetime.utcnow().isoformat()

    with _get_conn() as conn:
        try:
            cursor = conn.execute(
                """
                INSERT INTO permissions (resource, action, description, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (resource, action, description, now),
            )
            conn.commit()
            permission_id = cursor.lastrowid

            row = conn.execute(
                "SELECT * FROM permissions WHERE id = ?", (permission_id,)
            ).fetchone()

            return dict(row)
        except sqlite3.IntegrityError:
            raise ValueError(f"Permission {resource}:{action} already exists")


def get_permission(resource: str, action: str) -> Optional[Dict[str, Any]]:
    """Get permission by resource and action."""
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM permissions WHERE resource = ? AND action = ?",
            (resource, action),
        ).fetchone()
        return dict(row) if row else None


def get_permission_by_id(permission_id: int) -> Optional[Dict[str, Any]]:
    """Get permission by ID."""
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM permissions WHERE id = ?", (permission_id,)
        ).fetchone()
        return dict(row) if row else None


def list_permissions() -> List[Dict[str, Any]]:
    """List all permissions."""
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM permissions ORDER BY resource, action"
        ).fetchall()
        return [dict(row) for row in rows]


def delete_permission(permission_id: int) -> None:
    """Delete a permission."""
    with _get_conn() as conn:
        conn.execute("DELETE FROM permissions WHERE id = ?", (permission_id,))
        conn.commit()


# ============================================================================
# Role Management
# ============================================================================


def create_role(
    name: str, description: str = "", is_system: bool = False
) -> Dict[str, Any]:
    """Create a new role.

    Args:
        name: Role name (e.g., 'admin', 'operator', 'viewer')
        description: Human-readable description
        is_system: Whether this is a system role (cannot be deleted)

    Returns:
        Dictionary with role details
    """
    now = datetime.utcnow().isoformat()

    with _get_conn() as conn:
        try:
            cursor = conn.execute(
                """
                INSERT INTO roles (name, description, is_system, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (name, description, 1 if is_system else 0, now, now),
            )
            conn.commit()
            role_id = cursor.lastrowid

            row = conn.execute(
                "SELECT * FROM roles WHERE id = ?", (role_id,)
            ).fetchone()
            return dict(row)
        except sqlite3.IntegrityError:
            raise ValueError(f"Role '{name}' already exists")


def get_role(role_id: int) -> Optional[Dict[str, Any]]:
    """Get role by ID."""
    with _get_conn() as conn:
        row = conn.execute("SELECT * FROM roles WHERE id = ?", (role_id,)).fetchone()
        return dict(row) if row else None


def get_role_by_name(name: str) -> Optional[Dict[str, Any]]:
    """Get role by name."""
    with _get_conn() as conn:
        row = conn.execute("SELECT * FROM roles WHERE name = ?", (name,)).fetchone()
        return dict(row) if row else None


def list_roles() -> List[Dict[str, Any]]:
    """List all roles."""
    with _get_conn() as conn:
        rows = conn.execute("SELECT * FROM roles ORDER BY name").fetchall()
        return [dict(row) for row in rows]


def update_role(
    role_id: int, name: Optional[str] = None, description: Optional[str] = None
) -> Dict[str, Any]:
    """Update a role."""
    now = datetime.utcnow().isoformat()

    with _get_conn() as conn:
        role = conn.execute("SELECT * FROM roles WHERE id = ?", (role_id,)).fetchone()
        if not role:
            raise ValueError(f"Role with id {role_id} not found")

        new_name = name if name is not None else role["name"]
        new_description = (
            description if description is not None else role["description"]
        )

        conn.execute(
            "UPDATE roles SET name = ?, description = ?, updated_at = ? WHERE id = ?",
            (new_name, new_description, now, role_id),
        )
        conn.commit()

        updated_row = conn.execute(
            "SELECT * FROM roles WHERE id = ?", (role_id,)
        ).fetchone()
        return dict(updated_row)


def delete_role(role_id: int) -> None:
    """Delete a role (unless it's a system role)."""
    with _get_conn() as conn:
        role = conn.execute("SELECT * FROM roles WHERE id = ?", (role_id,)).fetchone()
        if not role:
            raise ValueError(f"Role with id {role_id} not found")

        if role["is_system"]:
            raise ValueError("Cannot delete system role")

        conn.execute("DELETE FROM roles WHERE id = ?", (role_id,))
        conn.commit()


# ============================================================================
# Role-Permission Assignment
# ============================================================================


def assign_permission_to_role(
    role_id: int, permission_id: int, granted: bool = True
) -> None:
    """Assign a permission to a role.

    Args:
        role_id: Role ID
        permission_id: Permission ID
        granted: True to allow, False to deny
    """
    now = datetime.utcnow().isoformat()

    with _get_conn() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO role_permissions (role_id, permission_id, granted, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (role_id, permission_id, 1 if granted else 0, now),
        )
        conn.commit()


def remove_permission_from_role(role_id: int, permission_id: int) -> None:
    """Remove a permission from a role."""
    with _get_conn() as conn:
        conn.execute(
            "DELETE FROM role_permissions WHERE role_id = ? AND permission_id = ?",
            (role_id, permission_id),
        )
        conn.commit()


def get_role_permissions(role_id: int) -> List[Dict[str, Any]]:
    """Get all permissions for a role."""
    with _get_conn() as conn:
        rows = conn.execute(
            """
            SELECT p.*, rp.granted
            FROM permissions p
            JOIN role_permissions rp ON p.id = rp.permission_id
            WHERE rp.role_id = ?
            ORDER BY p.resource, p.action
            """,
            (role_id,),
        ).fetchall()
        return [dict(row) for row in rows]


# ============================================================================
# User-Role Assignment
# ============================================================================


def assign_role_to_user(user_id: int, role_id: int) -> None:
    """Assign a role to a user."""
    now = datetime.utcnow().isoformat()

    with _get_conn() as conn:
        try:
            conn.execute(
                """
                INSERT INTO user_roles (user_id, role_id, created_at)
                VALUES (?, ?, ?)
                """,
                (user_id, role_id, now),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            # Already assigned, ignore
            pass


def remove_role_from_user(user_id: int, role_id: int) -> None:
    """Remove a role from a user."""
    with _get_conn() as conn:
        conn.execute(
            "DELETE FROM user_roles WHERE user_id = ? AND role_id = ?",
            (user_id, role_id),
        )
        conn.commit()


def get_user_roles(user_id: int) -> List[Dict[str, Any]]:
    """Get all roles for a user."""
    with _get_conn() as conn:
        rows = conn.execute(
            """
            SELECT r.*
            FROM roles r
            JOIN user_roles ur ON r.id = ur.role_id
            WHERE ur.user_id = ?
            ORDER BY r.name
            """,
            (user_id,),
        ).fetchall()
        return [dict(row) for row in rows]


def get_users_with_role(role_id: int) -> List[int]:
    """Get all user IDs with a specific role."""
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT user_id FROM user_roles WHERE role_id = ?", (role_id,)
        ).fetchall()
        return [row["user_id"] for row in rows]


# ============================================================================
# User-Permission Overrides
# ============================================================================


def assign_permission_to_user(
    user_id: int, permission_id: int, granted: bool = True
) -> None:
    """Assign a permission directly to a user (override).

    Args:
        user_id: User ID
        permission_id: Permission ID
        granted: True to allow, False to deny
    """
    now = datetime.utcnow().isoformat()

    with _get_conn() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO user_permissions (user_id, permission_id, granted, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (user_id, permission_id, 1 if granted else 0, now),
        )
        conn.commit()


def remove_permission_from_user(user_id: int, permission_id: int) -> None:
    """Remove a permission override from a user."""
    with _get_conn() as conn:
        conn.execute(
            "DELETE FROM user_permissions WHERE user_id = ? AND permission_id = ?",
            (user_id, permission_id),
        )
        conn.commit()


def get_user_permission_overrides(user_id: int) -> List[Dict[str, Any]]:
    """Get all permission overrides for a user."""
    with _get_conn() as conn:
        rows = conn.execute(
            """
            SELECT p.*, up.granted
            FROM permissions p
            JOIN user_permissions up ON p.id = up.permission_id
            WHERE up.user_id = ?
            ORDER BY p.resource, p.action
            """,
            (user_id,),
        ).fetchall()
        return [dict(row) for row in rows]


# ============================================================================
# Permission Checking (Core RBAC Logic)
# ============================================================================


def has_permission(user_id: int, resource: str, action: str) -> bool:
    """Check if a user has a specific permission.

    Permission resolution order:
    1. Check user-specific permission overrides (highest priority)
    2. Check role-based permissions
    3. Default deny

    Args:
        user_id: User ID
        resource: Resource identifier (e.g., 'nautobot.devices')
        action: Action type (e.g., 'read', 'write')

    Returns:
        True if user has permission, False otherwise
    """
    with _get_conn() as conn:
        # Step 1: Check user-specific permission override
        user_perm = conn.execute(
            """
            SELECT up.granted
            FROM user_permissions up
            JOIN permissions p ON up.permission_id = p.id
            WHERE up.user_id = ? AND p.resource = ? AND p.action = ?
            """,
            (user_id, resource, action),
        ).fetchone()

        if user_perm is not None:
            return bool(user_perm["granted"])

        # Step 2: Check role-based permissions
        role_perm = conn.execute(
            """
            SELECT rp.granted
            FROM role_permissions rp
            JOIN permissions p ON rp.permission_id = p.id
            JOIN user_roles ur ON rp.role_id = ur.role_id
            WHERE ur.user_id = ? AND p.resource = ? AND p.action = ?
            AND rp.granted = 1
            LIMIT 1
            """,
            (user_id, resource, action),
        ).fetchone()

        if role_perm is not None:
            return True

        # Step 3: Default deny
        return False


def get_user_permissions(user_id: int) -> List[Dict[str, Any]]:
    """Get all effective permissions for a user (combined from roles and overrides)."""
    permissions_map: Dict[Tuple[str, str], Dict[str, Any]] = {}

    with _get_conn() as conn:
        # Get role-based permissions
        role_perms = conn.execute(
            """
            SELECT DISTINCT p.id, p.resource, p.action, p.description, p.created_at, rp.granted, 'role' as source
            FROM permissions p
            JOIN role_permissions rp ON p.id = rp.permission_id
            JOIN user_roles ur ON rp.role_id = ur.role_id
            WHERE ur.user_id = ?
            """,
            (user_id,),
        ).fetchall()

        for perm in role_perms:
            key = (perm["resource"], perm["action"])
            if key not in permissions_map or perm["granted"]:
                permissions_map[key] = dict(perm)

        # Get user-specific overrides (higher priority)
        user_perms = conn.execute(
            """
            SELECT p.id, p.resource, p.action, p.description, p.created_at, up.granted, 'override' as source
            FROM permissions p
            JOIN user_permissions up ON p.id = up.permission_id
            WHERE up.user_id = ?
            """,
            (user_id,),
        ).fetchall()

        for perm in user_perms:
            key = (perm["resource"], perm["action"])
            permissions_map[key] = dict(perm)

    # Filter to only granted permissions and sort
    granted_perms = [p for p in permissions_map.values() if p["granted"]]
    granted_perms.sort(key=lambda x: (x["resource"], x["action"]))

    return granted_perms


def check_any_permission(user_id: int, resource: str, actions: List[str]) -> bool:
    """Check if user has ANY of the specified permissions for a resource."""
    return any(has_permission(user_id, resource, action) for action in actions)


def check_all_permissions(user_id: int, resource: str, actions: List[str]) -> bool:
    """Check if user has ALL of the specified permissions for a resource."""
    return all(has_permission(user_id, resource, action) for action in actions)


# ============================================================================
# User Management Functions (Bridge to user_db_manager)
# ============================================================================

import user_db_manager as user_db


def create_user_with_roles(
    username: str,
    realname: str,
    password: str,
    email: Optional[str] = None,
    role_ids: Optional[List[int]] = None,
    debug: bool = False,
    is_active: bool = True,
) -> Dict[str, Any]:
    """Create user and assign roles in one operation.
    
    Args:
        username: Unique username
        realname: User's real name
        password: Plain text password (will be hashed)
        email: Optional email address
        role_ids: List of role IDs to assign to user
        debug: Enable debug mode for user
        is_active: User account active status
        
    Returns:
        Dictionary with user details
        
    Raises:
        ValueError: If username already exists or role_id is invalid
    """
    # Create user in users.db
    user = user_db.create_user(
        username=username,
        realname=realname,
        password=password,
        email=email,
        permissions=1,  # Default minimal permissions (legacy field)
        debug=debug,
        is_active=is_active,
    )
    
    # Assign roles in rbac.db
    if role_ids:
        for role_id in role_ids:
            # Verify role exists
            role = get_role(role_id)
            if not role:
                # Rollback: delete the user we just created
                user_db.hard_delete_user(user["id"])
                raise ValueError(f"Role with id {role_id} not found")
            
            assign_role_to_user(user["id"], role_id)
    
    return user


def get_user_with_rbac(user_id: int, include_inactive: bool = False) -> Optional[Dict[str, Any]]:
    """Get user with their roles and effective permissions.
    
    Args:
        user_id: User ID
        include_inactive: Include inactive users
        
    Returns:
        Dictionary with user details, roles, and permissions, or None if not found
    """
    user = user_db.get_user_by_id(user_id, include_inactive=include_inactive)
    if not user:
        return None
    
    # Add RBAC data
    user["roles"] = get_user_roles(user_id)
    user["permissions"] = get_user_permissions(user_id)
    
    return user


def list_users_with_rbac(include_inactive: bool = True) -> List[Dict[str, Any]]:
    """List all users with their roles and permissions.
    
    Args:
        include_inactive: Include inactive users in the list
        
    Returns:
        List of user dictionaries with roles and permissions
    """
    users = user_db.get_all_users(include_inactive=include_inactive)
    
    # Add role and permission information to each user
    for user in users:
        user["roles"] = get_user_roles(user["id"])
        user["permissions"] = get_user_permissions(user["id"])
    
    return users


def update_user_profile(
    user_id: int,
    realname: Optional[str] = None,
    email: Optional[str] = None,
    password: Optional[str] = None,
    debug: Optional[bool] = None,
    is_active: Optional[bool] = None,
) -> Optional[Dict[str, Any]]:
    """Update user profile (delegates to user_db_manager).
    
    Args:
        user_id: User ID
        realname: New real name
        email: New email address
        password: New password (will be hashed)
        debug: Enable/disable debug mode
        is_active: Enable/disable account
        
    Returns:
        Updated user dictionary or None if not found
    """
    return user_db.update_user(
        user_id=user_id,
        realname=realname,
        email=email,
        password=password,
        permissions=None,  # Don't update legacy permissions field
        debug=debug,
        is_active=is_active,
    )


def delete_user_with_rbac(user_id: int) -> bool:
    """Delete user and all RBAC associations.
    
    This cascades to remove:
    - All role assignments
    - All permission overrides
    - The user account itself
    
    Args:
        user_id: User ID
        
    Returns:
        True if user was deleted, False if not found
    """
    # Check if user exists
    user = user_db.get_user_by_id(user_id, include_inactive=True)
    if not user:
        return False
    
    # Remove all role assignments
    roles = get_user_roles(user_id)
    for role in roles:
        remove_role_from_user(user_id, role["id"])
    
    # Remove all permission overrides
    overrides = get_user_permission_overrides(user_id)
    for override in overrides:
        remove_permission_from_user(user_id, override["id"])
    
    # Delete user from users.db
    return user_db.hard_delete_user(user_id)


def bulk_delete_users_with_rbac(user_ids: List[int]) -> Tuple[int, List[str]]:
    """Bulk delete users with RBAC cleanup.
    
    Args:
        user_ids: List of user IDs to delete
        
    Returns:
        Tuple of (success_count, error_messages)
    """
    success_count = 0
    errors = []
    
    for user_id in user_ids:
        try:
            if delete_user_with_rbac(user_id):
                success_count += 1
            else:
                errors.append(f"User {user_id} not found")
        except Exception as e:
            errors.append(f"User {user_id}: {str(e)}")
    
    return success_count, errors


def toggle_user_activation(user_id: int) -> Optional[Dict[str, Any]]:
    """Toggle user active status.
    
    Args:
        user_id: User ID
        
    Returns:
        Updated user dictionary or None if not found
    """
    user = user_db.get_user_by_id(user_id, include_inactive=True)
    if not user:
        return None
    
    return user_db.update_user(user_id, is_active=not user["is_active"])


def toggle_user_debug(user_id: int) -> Optional[Dict[str, Any]]:
    """Toggle user debug mode.
    
    Args:
        user_id: User ID
        
    Returns:
        Updated user dictionary or None if not found
    """
    user = user_db.get_user_by_id(user_id)
    if not user:
        return None
    
    return user_db.update_user(user_id, debug=not user["debug"])
