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

MIGRATION NOTE: This file has been refactored to use SQLAlchemy and PostgreSQL
instead of direct SQLite3 connections. The API remains the same for backward compatibility.
"""

from __future__ import annotations
import logging
from typing import Any, Dict, List, Optional, Tuple
from repositories.auth.rbac_repository import RBACRepository
from core.models import Role, Permission
import user_db_manager as user_db

# Logger
logger = logging.getLogger(__name__)

# Initialize repository
_rbac_repo = RBACRepository()


def _role_to_dict(role: Role) -> Dict[str, Any]:
    """Convert Role model to dictionary for backward compatibility."""
    return {
        "id": role.id,
        "name": role.name,
        "description": role.description,
        "is_system": role.is_system,
        "created_at": role.created_at.isoformat() if role.created_at else None,
        "updated_at": role.updated_at.isoformat() if role.updated_at else None,
    }


def _permission_to_dict(permission: Permission) -> Dict[str, Any]:
    """Convert Permission model to dictionary for backward compatibility."""
    return {
        "id": permission.id,
        "resource": permission.resource,
        "action": permission.action,
        "description": permission.description,
        "created_at": permission.created_at.isoformat()
        if permission.created_at
        else None,
    }


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
    # Check if already exists
    existing = _rbac_repo.get_permission(resource, action)
    if existing:
        raise ValueError(f"Permission {resource}:{action} already exists")

    permission = _rbac_repo.create_permission(resource, action, description)
    return _permission_to_dict(permission)


def get_permission(resource: str, action: str) -> Optional[Dict[str, Any]]:
    """Get permission by resource and action."""
    permission = _rbac_repo.get_permission(resource, action)
    return _permission_to_dict(permission) if permission else None


def get_permission_by_id(permission_id: int) -> Optional[Dict[str, Any]]:
    """Get permission by ID."""
    permission = _rbac_repo.get_permission_by_id(permission_id)
    return _permission_to_dict(permission) if permission else None


def list_permissions() -> List[Dict[str, Any]]:
    """List all permissions."""
    permissions = _rbac_repo.list_permissions()
    return [_permission_to_dict(p) for p in permissions]


def delete_permission(permission_id: int) -> None:
    """Delete a permission."""
    _rbac_repo.delete_permission(permission_id)


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
    # Check if already exists
    if _rbac_repo.role_name_exists(name):
        raise ValueError(f"Role '{name}' already exists")

    role = _rbac_repo.create_role(name, description, is_system)
    return _role_to_dict(role)


def get_role(role_id: int) -> Optional[Dict[str, Any]]:
    """Get role by ID."""
    role = _rbac_repo.get_role(role_id)
    return _role_to_dict(role) if role else None


def get_role_by_name(name: str) -> Optional[Dict[str, Any]]:
    """Get role by name."""
    role = _rbac_repo.get_role_by_name(name)
    return _role_to_dict(role) if role else None


def list_roles() -> List[Dict[str, Any]]:
    """List all roles."""
    roles = _rbac_repo.list_roles()
    return [_role_to_dict(r) for r in roles]


def update_role(
    role_id: int, name: Optional[str] = None, description: Optional[str] = None
) -> Dict[str, Any]:
    """Update a role."""
    role = _rbac_repo.get_role(role_id)
    if not role:
        raise ValueError(f"Role with id {role_id} not found")

    updates = {}
    if name is not None:
        updates["name"] = name
    if description is not None:
        updates["description"] = description

    updated_role = _rbac_repo.update_role(role_id, **updates)
    return _role_to_dict(updated_role)


def delete_role(role_id: int) -> None:
    """Delete a role (unless it's a system role)."""
    role = _rbac_repo.get_role(role_id)
    if not role:
        raise ValueError(f"Role with id {role_id} not found")

    if role.is_system:
        raise ValueError("Cannot delete system role")

    _rbac_repo.delete_role(role_id)


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
    _rbac_repo.assign_permission_to_role(role_id, permission_id, granted)


def remove_permission_from_role(role_id: int, permission_id: int) -> None:
    """Remove a permission from a role."""
    _rbac_repo.remove_permission_from_role(role_id, permission_id)


def get_role_permissions(role_id: int) -> List[Dict[str, Any]]:
    """Get all permissions for a role."""
    permissions = _rbac_repo.get_role_permissions(role_id)
    return [_permission_to_dict(p) for p in permissions]


# ============================================================================
# User-Role Assignment
# ============================================================================


def assign_role_to_user(user_id: int, role_id: int) -> None:
    """Assign a role to a user."""
    _rbac_repo.assign_role_to_user(user_id, role_id)


def remove_role_from_user(user_id: int, role_id: int) -> None:
    """Remove a role from a user."""
    _rbac_repo.remove_role_from_user(user_id, role_id)


def get_user_roles(user_id: int) -> List[Dict[str, Any]]:
    """Get all roles for a user."""
    roles = _rbac_repo.get_user_roles(user_id)
    return [_role_to_dict(r) for r in roles]


def get_users_with_role(role_id: int) -> List[int]:
    """Get all user IDs with a specific role."""
    return _rbac_repo.get_users_with_role(role_id)


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
    _rbac_repo.assign_permission_to_user(user_id, permission_id, granted)


def remove_permission_from_user(user_id: int, permission_id: int) -> None:
    """Remove a permission override from a user."""
    _rbac_repo.remove_permission_from_user(user_id, permission_id)


def get_user_permission_overrides(user_id: int) -> List[Dict[str, Any]]:
    """Get all permission overrides for a user."""
    overrides = _rbac_repo.get_user_permission_overrides_with_status(user_id)
    result = []
    for permission, granted in overrides:
        perm_dict = _permission_to_dict(permission)
        perm_dict["granted"] = granted
        perm_dict["source"] = "override"
        result.append(perm_dict)
    return result


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
    # Get permission object
    permission = _rbac_repo.get_permission(resource, action)
    if not permission:
        return False

    # Step 1: Check user-specific permission override
    override = _rbac_repo.get_user_permission_override(user_id, permission.id)
    if override is not None:
        return override

    # Step 2: Check role-based permissions
    user_roles = _rbac_repo.get_user_roles(user_id)
    for role in user_roles:
        role_permissions = _rbac_repo.get_role_permissions(role.id)
        if any(p.id == permission.id for p in role_permissions):
            return True

    # Step 3: Default deny
    return False


def get_user_permissions(user_id: int) -> List[Dict[str, Any]]:
    """Get all effective permissions for a user (combined from roles and overrides)."""
    permissions_map: Dict[Tuple[str, str], Dict[str, Any]] = {}

    # Get role-based permissions
    user_roles = _rbac_repo.get_user_roles(user_id)
    for role in user_roles:
        role_permissions = _rbac_repo.get_role_permissions(role.id)
        for perm in role_permissions:
            key = (perm.resource, perm.action)
            if key not in permissions_map:
                perm_dict = _permission_to_dict(perm)
                perm_dict["granted"] = True
                perm_dict["source"] = "role"
                permissions_map[key] = perm_dict

    # Get user-specific overrides (higher priority)
    user_permissions = _rbac_repo.get_user_permissions(user_id)
    for perm in user_permissions:
        key = (perm.resource, perm.action)
        perm_dict = _permission_to_dict(perm)
        perm_dict["granted"] = True
        perm_dict["source"] = "override"
        permissions_map[key] = perm_dict

    # Filter to only granted permissions and sort
    granted_perms = [p for p in permissions_map.values() if p.get("granted", False)]
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


def get_user_with_rbac(
    user_id: int, include_inactive: bool = False
) -> Optional[Dict[str, Any]]:
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
    is_active: Optional[bool] = None,
) -> Optional[Dict[str, Any]]:
    """Update user profile (delegates to user_db_manager).

    Args:
        user_id: User ID
        realname: New real name
        email: New email address
        password: New password (will be hashed)
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
        debug=None,  # Don't update debug field
        is_active=is_active,
    )


def delete_user_with_rbac(user_id: int) -> bool:
    """Delete user and all RBAC associations.

    This cascades to remove:
    - All role assignments
    - All permission overrides
    - Private credentials owned by the user
    - User profile
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

    username = user.get("username")

    # Remove all role assignments
    roles = get_user_roles(user_id)
    for role in roles:
        remove_role_from_user(user_id, role["id"])

    # Remove all permission overrides
    overrides = get_user_permission_overrides(user_id)
    for override in overrides:
        remove_permission_from_user(user_id, override["id"])

    # Delete user's private credentials
    if username:
        try:
            import credentials_manager

            deleted_count = credentials_manager.delete_credentials_by_owner(username)
            logger.info(
                f"Deleted {deleted_count} private credentials for user {username}"
            )
        except Exception as e:
            logger.warning(f"Failed to delete credentials for user {username}: {e}")

    # Delete user profile
    if username:
        try:
            import profile_manager

            profile_manager.delete_user_profile(username)
            logger.info(f"Deleted profile for user {username}")
        except Exception as e:
            logger.warning(f"Failed to delete profile for user {username}: {e}")

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
