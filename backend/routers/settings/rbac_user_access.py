"""RBAC user-role assignment, permission override, and check endpoints."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_role, verify_token
from core.safe_http_errors import raise_internal_server_error
from dependencies import get_rbac_service
from models.rbac import (
    BulkRoleAssignment,
    PermissionCheck,
    PermissionCheckResult,
    PermissionWithGrant,
    Role,
    UserPermissionAssignment,
    UserPermissions,
    UserRoleAssignment,
)
from routers.settings.rbac_common import ensure_self_or_admin, permission_check_result
from services.auth.rbac_service import RBACService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/users/{user_id}/roles", response_model=list[Role])
async def get_user_roles(
    user_id: int,
    current_user: dict = Depends(verify_token),
    rbac: RBACService = Depends(get_rbac_service),
):
    """Get all roles assigned to a user."""
    ensure_self_or_admin(rbac, current_user, user_id, "Can only view your own roles")

    roles = rbac.get_user_roles(user_id)
    return roles


@router.post("/users/{user_id}/roles", status_code=status.HTTP_204_NO_CONTENT)
async def assign_role_to_user(
    user_id: int,
    assignment: UserRoleAssignment,
    current_user: dict = Depends(require_role("admin")),
    rbac: RBACService = Depends(get_rbac_service),
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
    rbac: RBACService = Depends(get_rbac_service),
):
    """Assign multiple roles to a user (admin only)."""
    for role_id in assignment.role_ids:
        rbac.assign_role_to_user(user_id, role_id)


@router.delete(
    "/users/{user_id}/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def remove_role_from_user(
    user_id: int,
    role_id: int,
    current_user: dict = Depends(require_role("admin")),
    rbac: RBACService = Depends(get_rbac_service),
):
    """Remove a role from a user (admin only)."""
    rbac.remove_role_from_user(user_id, role_id)


# ============================================================================
# User-Permission Override Endpoints
# ============================================================================


@router.get("/users/{user_id}/permissions", response_model=UserPermissions)
async def get_user_permissions(
    user_id: int,
    current_user: dict = Depends(verify_token),
    rbac: RBACService = Depends(get_rbac_service),
):
    """Get all effective permissions for a user (from roles + overrides)."""
    ensure_self_or_admin(
        rbac, current_user, user_id, "Can only view your own permissions"
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
    "/users/{user_id}/permissions/overrides", response_model=list[PermissionWithGrant]
)
async def get_user_permission_overrides(
    user_id: int,
    current_user: dict = Depends(verify_token),
    rbac: RBACService = Depends(get_rbac_service),
):
    """Get permission overrides for a user (direct assignments)."""
    ensure_self_or_admin(
        rbac, current_user, user_id, "Can only view your own permission overrides"
    )

    overrides = rbac.get_user_permission_overrides(user_id)
    return overrides


@router.post("/users/{user_id}/permissions", status_code=status.HTTP_204_NO_CONTENT)
async def assign_permission_to_user(
    user_id: int,
    assignment: UserPermissionAssignment,
    current_user: dict = Depends(require_role("admin")),
    rbac: RBACService = Depends(get_rbac_service),
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
    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(logger, "Failed to assign permission: ", e)


@router.delete(
    "/users/{user_id}/permissions/{permission_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_permission_from_user(
    user_id: int,
    permission_id: int,
    current_user: dict = Depends(require_role("admin")),
    rbac: RBACService = Depends(get_rbac_service),
):
    """Remove a permission override from a user (admin only)."""
    rbac.remove_permission_from_user(user_id, permission_id)


# ============================================================================
# Permission Check Endpoints
# ============================================================================


@router.post("/users/{user_id}/check-permission", response_model=PermissionCheckResult)
async def check_user_permission(
    user_id: int,
    check: PermissionCheck,
    current_user: dict = Depends(verify_token),
    rbac: RBACService = Depends(get_rbac_service),
):
    """Check if a user has a specific permission."""
    ensure_self_or_admin(
        rbac, current_user, user_id, "Can only check your own permissions"
    )

    return permission_check_result(rbac, user_id, check)


@router.get("/users/me/permissions", response_model=UserPermissions)
async def get_my_permissions(
    current_user: dict = Depends(verify_token),
    rbac: RBACService = Depends(get_rbac_service),
):
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
    check: PermissionCheck,
    current_user: dict = Depends(verify_token),
    rbac: RBACService = Depends(get_rbac_service),
):
    """Check if current user has a specific permission (convenience endpoint)."""
    user_id = current_user["user_id"]
    return permission_check_result(rbac, user_id, check)
