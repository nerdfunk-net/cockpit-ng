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
    BulkUserDelete,
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
    UserCreate,
    UserListResponse,
    UserPermissionAssignment,
    UserPermissions,
    UserResponse,
    UserRoleAssignment,
    UserUpdate,
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

    # Add granted and source fields to match PermissionWithGrant model
    permissions_with_grant = [
        {**perm, "granted": True, "source": "role"} for perm in permissions
    ]

    return {"permissions": permissions_with_grant, **role}


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


# ============================================================================
# User Management Endpoints
# ============================================================================


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate, current_user: dict = Depends(require_role("admin"))
):
    """Create a new user with initial role assignments (admin only)."""
    try:
        user = rbac.create_user_with_roles(
            username=user_data.username,
            realname=user_data.realname,
            password=user_data.password,
            email=user_data.email,
            role_ids=user_data.role_ids,
            is_active=user_data.is_active,
        )

        # Get full user with roles and permissions
        user_with_rbac = rbac.get_user_with_rbac(user["id"])
        return user_with_rbac
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating user: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user: {str(e)}",
        )


@router.get("/users", response_model=UserListResponse)
async def list_users(
    include_inactive: bool = True,
    current_user: dict = Depends(verify_token),
):
    """List all users with their roles."""
    try:
        users = rbac.list_users_with_rbac(include_inactive)
        return UserListResponse(users=users, total=len(users))
    except Exception as e:
        logger.error(f"Error listing users: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list users",
        )


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: int, current_user: dict = Depends(verify_token)):
    """Get user details with roles and permissions."""
    try:
        user = rbac.get_user_with_rbac(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )
        return user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user {user_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user",
        )


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    current_user: dict = Depends(require_role("admin")),
):
    """Update user profile (admin only)."""
    try:
        user = rbac.update_user_profile(
            user_id=user_id,
            realname=user_data.realname,
            email=user_data.email,
            password=user_data.password,
            is_active=user_data.is_active,
        )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        # Get full user with roles and permissions (include inactive in case we just deactivated)
        user_with_rbac = rbac.get_user_with_rbac(user_id, include_inactive=True)

        if not user_with_rbac:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User {user_id} not found after update",
            )

        return user_with_rbac
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user {user_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user",
        )


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int, current_user: dict = Depends(require_role("admin"))
):
    """Delete a user and all RBAC associations (admin only)."""
    try:
        success = rbac.delete_user_with_rbac(user_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user {user_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete user",
        )


@router.patch("/users/{user_id}/activate", response_model=UserResponse)
async def toggle_user_activation(
    user_id: int, current_user: dict = Depends(require_role("admin"))
):
    """Toggle user active status (admin only)."""
    try:
        user = rbac.toggle_user_activation(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        # Get full user with roles and permissions
        user_with_rbac = rbac.get_user_with_rbac(user_id, include_inactive=True)
        return user_with_rbac
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error toggling activation for user {user_id}: {str(e)}", exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to toggle user activation",
        )


@router.patch("/users/{user_id}/debug", response_model=UserResponse)
async def toggle_user_debug(
    user_id: int, current_user: dict = Depends(require_role("admin"))
):
    """Toggle user debug mode (admin only)."""
    try:
        user = rbac.toggle_user_debug(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        # Get full user with roles and permissions
        user_with_rbac = rbac.get_user_with_rbac(user_id)
        return user_with_rbac
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error toggling debug for user {user_id}: {str(e)}", exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to toggle user debug mode",
        )


@router.post("/users/bulk-delete", status_code=status.HTTP_200_OK)
async def bulk_delete_users(
    bulk_data: BulkUserDelete, current_user: dict = Depends(require_role("admin"))
):
    """Bulk delete users with RBAC cleanup (admin only)."""
    try:
        success_count, errors = rbac.bulk_delete_users_with_rbac(bulk_data.user_ids)
        return {
            "success_count": success_count,
            "errors": errors,
            "message": f"Successfully deleted {success_count} user(s)",
        }
    except Exception as e:
        logger.error(f"Error bulk deleting users: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to bulk delete users",
        )
