"""RBAC (Role-Based Access Control) API endpoints.

This router provides endpoints for managing:
- Roles
- Permissions
- User-Role assignments
- User-Permission overrides
- Permission checks
"""

import logging
from typing import List

import rbac_manager as rbac
from core.auth import require_role, verify_token
from fastapi import APIRouter, Depends, HTTPException, status
from models.rbac import (
    BulkPermissionAssignment,
    BulkRoleAssignment,
    Permission,
    PermissionCheck,
    PermissionCheckResult,
    PermissionCreate,
    PermissionWithGrant,
    Role,
    RoleCreate,
    RolePermissionAssignment,
    RoleUpdate,
    RoleWithPermissions,
    UserPermissionAssignment,
    UserPermissions,
    UserRoleAssignment,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/rbac", tags=["rbac"])


# ============================================================================
# Permission Endpoints
# ============================================================================


@router.get("/permissions", response_model=List[Permission])
async def list_permissions(current_user: dict = Depends(verify_token)):
    """List all permissions in the system."""
    permissions = rbac.list_permissions()
    return permissions


@router.post(
    "/permissions", response_model=Permission, status_code=status.HTTP_201_CREATED
)
async def create_permission(
    permission: PermissionCreate, current_user: dict = Depends(require_role("admin"))
):
    """Create a new permission (admin only)."""
    try:
        created = rbac.create_permission(
            resource=permission.resource,
            action=permission.action,
            description=permission.description or "",
        )
        return created
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/permissions/{permission_id}", response_model=Permission)
async def get_permission(
    permission_id: int, current_user: dict = Depends(verify_token)
):
    """Get a specific permission by ID."""
    permission = rbac.get_permission_by_id(permission_id)
    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Permission not found"
        )
    return permission


@router.delete("/permissions/{permission_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_permission(
    permission_id: int, current_user: dict = Depends(require_role("admin"))
):
    """Delete a permission (admin only)."""
    try:
        rbac.delete_permission(permission_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ============================================================================
# Role Endpoints
# ============================================================================


@router.get("/roles", response_model=List[Role])
async def list_roles(current_user: dict = Depends(verify_token)):
    """List all roles in the system."""
    roles = rbac.list_roles()
    return roles


@router.post("/roles", response_model=Role, status_code=status.HTTP_201_CREATED)
async def create_role(
    role: RoleCreate, current_user: dict = Depends(require_role("admin"))
):
    """Create a new role (admin only)."""
    try:
        created = rbac.create_role(
            name=role.name, description=role.description or "", is_system=role.is_system
        )
        return created
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/roles/{role_id}", response_model=RoleWithPermissions)
async def get_role(role_id: int, current_user: dict = Depends(verify_token)):
    """Get a specific role by ID with its permissions."""
    role = rbac.get_role(role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Role not found"
        )

    permissions = rbac.get_role_permissions(role_id)

    return {"permissions": permissions, **role}


@router.put("/roles/{role_id}", response_model=Role)
async def update_role(
    role_id: int,
    role_update: RoleUpdate,
    current_user: dict = Depends(require_role("admin")),
):
    """Update a role (admin only)."""
    try:
        updated = rbac.update_role(
            role_id=role_id, name=role_update.name, description=role_update.description
        )
        return updated
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: int, current_user: dict = Depends(require_role("admin"))
):
    """Delete a role (admin only, cannot delete system roles)."""
    try:
        rbac.delete_role(role_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/roles/{role_id}/permissions", response_model=List[PermissionWithGrant])
async def get_role_permissions(
    role_id: int, current_user: dict = Depends(verify_token)
):
    """Get all permissions for a role."""
    role = rbac.get_role(role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Role not found"
        )

    permissions = rbac.get_role_permissions(role_id)
    return permissions


# ============================================================================
# Role-Permission Assignment Endpoints
# ============================================================================


@router.post("/roles/{role_id}/permissions", status_code=status.HTTP_204_NO_CONTENT)
async def assign_permission_to_role(
    role_id: int,
    assignment: RolePermissionAssignment,
    current_user: dict = Depends(require_role("admin")),
):
    """Assign a permission to a role (admin only)."""
    # Verify role exists
    role = rbac.get_role(role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Role not found"
        )

    # Verify permission exists
    permission = rbac.get_permission_by_id(assignment.permission_id)
    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Permission not found"
        )

    rbac.assign_permission_to_role(
        role_id, assignment.permission_id, assignment.granted
    )


@router.post(
    "/roles/{role_id}/permissions/bulk", status_code=status.HTTP_204_NO_CONTENT
)
async def assign_multiple_permissions_to_role(
    role_id: int,
    assignment: BulkPermissionAssignment,
    current_user: dict = Depends(require_role("admin")),
):
    """Assign multiple permissions to a role (admin only)."""
    # Verify role exists
    role = rbac.get_role(role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Role not found"
        )

    for permission_id in assignment.permission_ids:
        rbac.assign_permission_to_role(role_id, permission_id, assignment.granted)


@router.delete(
    "/roles/{role_id}/permissions/{permission_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_permission_from_role(
    role_id: int,
    permission_id: int,
    current_user: dict = Depends(require_role("admin")),
):
    """Remove a permission from a role (admin only)."""
    rbac.remove_permission_from_role(role_id, permission_id)


# ============================================================================
# User-Role Assignment Endpoints
# ============================================================================


@router.get("/users/{user_id}/roles", response_model=List[Role])
async def get_user_roles(user_id: int, current_user: dict = Depends(verify_token)):
    """Get all roles assigned to a user."""
    # Users can view their own roles, admins can view anyone's
    if current_user["user_id"] != user_id:
        # Check if current user is admin
        user_roles = rbac.get_user_roles(current_user["user_id"])
        if not any(role["name"] == "admin" for role in user_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Can only view your own roles",
            )

    roles = rbac.get_user_roles(user_id)
    return roles


@router.post("/users/{user_id}/roles", status_code=status.HTTP_204_NO_CONTENT)
async def assign_role_to_user(
    user_id: int,
    assignment: UserRoleAssignment,
    current_user: dict = Depends(require_role("admin")),
):
    """Assign a role to a user (admin only)."""
    # Verify role exists
    role = rbac.get_role(assignment.role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Role not found"
        )

    rbac.assign_role_to_user(user_id, assignment.role_id)


@router.post("/users/{user_id}/roles/bulk", status_code=status.HTTP_204_NO_CONTENT)
async def assign_multiple_roles_to_user(
    user_id: int,
    assignment: BulkRoleAssignment,
    current_user: dict = Depends(require_role("admin")),
):
    """Assign multiple roles to a user (admin only)."""
    for role_id in assignment.role_ids:
        rbac.assign_role_to_user(user_id, role_id)


@router.delete(
    "/users/{user_id}/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def remove_role_from_user(
    user_id: int, role_id: int, current_user: dict = Depends(require_role("admin"))
):
    """Remove a role from a user (admin only)."""
    rbac.remove_role_from_user(user_id, role_id)


# ============================================================================
# User-Permission Override Endpoints
# ============================================================================


@router.get("/users/{user_id}/permissions", response_model=UserPermissions)
async def get_user_permissions(
    user_id: int, current_user: dict = Depends(verify_token)
):
    """Get all effective permissions for a user (from roles + overrides)."""
    # Users can view their own permissions, admins can view anyone's
    if current_user["user_id"] != user_id:
        user_roles = rbac.get_user_roles(current_user["user_id"])
        if not any(role["name"] == "admin" for role in user_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Can only view your own permissions",
            )

    roles = rbac.get_user_roles(user_id)
    permissions = rbac.get_user_permissions(user_id)
    overrides = rbac.get_user_permission_overrides(user_id)

    return {
        "user_id": user_id,
        "roles": roles,
        "permissions": permissions,
        "overrides": overrides,
    }


@router.get(
    "/users/{user_id}/permissions/overrides", response_model=List[PermissionWithGrant]
)
async def get_user_permission_overrides(
    user_id: int, current_user: dict = Depends(verify_token)
):
    """Get permission overrides for a user (direct assignments)."""
    # Users can view their own overrides, admins can view anyone's
    if current_user["user_id"] != user_id:
        user_roles = rbac.get_user_roles(current_user["user_id"])
        if not any(role["name"] == "admin" for role in user_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Can only view your own permission overrides",
            )

    overrides = rbac.get_user_permission_overrides(user_id)
    return overrides


@router.post("/users/{user_id}/permissions", status_code=status.HTTP_204_NO_CONTENT)
async def assign_permission_to_user(
    user_id: int,
    assignment: UserPermissionAssignment,
    current_user: dict = Depends(require_role("admin")),
):
    """Assign a permission directly to a user (override) (admin only)."""
    try:
        # Verify permission exists
        permission = rbac.get_permission_by_id(assignment.permission_id)
        if not permission:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Permission not found"
            )

        rbac.assign_permission_to_user(
            user_id, assignment.permission_id, assignment.granted
        )
    except Exception as e:
        logger.error(f"Error assigning permission to user: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to assign permission: {str(e)}",
        )


@router.delete(
    "/users/{user_id}/permissions/{permission_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_permission_from_user(
    user_id: int,
    permission_id: int,
    current_user: dict = Depends(require_role("admin")),
):
    """Remove a permission override from a user (admin only)."""
    rbac.remove_permission_from_user(user_id, permission_id)


# ============================================================================
# Permission Check Endpoints
# ============================================================================


@router.post("/users/{user_id}/check-permission", response_model=PermissionCheckResult)
async def check_user_permission(
    user_id: int, check: PermissionCheck, current_user: dict = Depends(verify_token)
):
    """Check if a user has a specific permission."""
    # Users can check their own permissions, admins can check anyone's
    if current_user["user_id"] != user_id:
        user_roles = rbac.get_user_roles(current_user["user_id"])
        if not any(role["name"] == "admin" for role in user_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Can only check your own permissions",
            )

    has_perm = rbac.has_permission(user_id, check.resource, check.action)

    # Determine source if granted
    source = None
    if has_perm:
        # Check if it's from override
        overrides = rbac.get_user_permission_overrides(user_id)
        if any(
            p["resource"] == check.resource
            and p["action"] == check.action
            and p["granted"]
            for p in overrides
        ):
            source = "override"
        else:
            source = "role"

    return {
        "has_permission": has_perm,
        "resource": check.resource,
        "action": check.action,
        "source": source,
    }


@router.get("/users/me/permissions", response_model=UserPermissions)
async def get_my_permissions(current_user: dict = Depends(verify_token)):
    """Get current user's permissions (convenience endpoint)."""
    user_id = current_user["user_id"]

    roles = rbac.get_user_roles(user_id)
    permissions = rbac.get_user_permissions(user_id)
    overrides = rbac.get_user_permission_overrides(user_id)

    return {
        "user_id": user_id,
        "roles": roles,
        "permissions": permissions,
        "overrides": overrides,
    }


@router.post("/users/me/check-permission", response_model=PermissionCheckResult)
async def check_my_permission(
    check: PermissionCheck, current_user: dict = Depends(verify_token)
):
    """Check if current user has a specific permission (convenience endpoint)."""
    user_id = current_user["user_id"]
    has_perm = rbac.has_permission(user_id, check.resource, check.action)

    # Determine source if granted
    source = None
    if has_perm:
        overrides = rbac.get_user_permission_overrides(user_id)
        if any(
            p["resource"] == check.resource
            and p["action"] == check.action
            and p["granted"]
            for p in overrides
        ):
            source = "override"
        else:
            source = "role"

    return {
        "has_permission": has_perm,
        "resource": check.resource,
        "action": check.action,
        "source": source,
    }
