"""RBAC role and role-permission assignment endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_role, verify_token
from dependencies import get_audit_log_service, get_rbac_service
from models.rbac import (
    BulkPermissionAssignment,
    PermissionWithGrant,
    Role,
    RoleCreate,
    RolePermissionAssignment,
    RoleUpdate,
    RoleWithPermissions,
)
from services.audit.audit_log_service import AuditLogService
from services.auth.exceptions import (
    RBACConflictError,
    RBACConstraintError,
    RBACNotFoundError,
)
from services.auth.rbac_service import RBACService

router = APIRouter()


@router.get("/roles", response_model=list[Role])
async def list_roles(
    current_user: dict = Depends(verify_token),
    rbac: RBACService = Depends(get_rbac_service),
):
    """List all roles in the system."""
    roles = rbac.list_roles()
    return roles


@router.post("/roles", response_model=Role, status_code=status.HTTP_201_CREATED)
async def create_role(
    role: RoleCreate,
    current_user: dict = Depends(require_role("admin")),
    rbac: RBACService = Depends(get_rbac_service),
    audit_log: AuditLogService = Depends(get_audit_log_service),
):
    """Create a new role (admin only)."""
    try:
        created = rbac.create_role(
            name=role.name, description=role.description or "", is_system=role.is_system
        )
        audit_log.log_event(
            username=current_user.get("username"),
            user_id=current_user.get("user_id"),
            event_type="rbac-role-created",
            message=f"Role '{role.name}' created",
            resource_type="role",
            resource_id=str(created.get("id")) if created else None,
            resource_name=role.name,
            severity="info",
        )
        return created
    except RBACConflictError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Role name already exists"
        )


@router.get("/roles/{role_id}", response_model=RoleWithPermissions)
async def get_role(
    role_id: int,
    current_user: dict = Depends(verify_token),
    rbac: RBACService = Depends(get_rbac_service),
):
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
    rbac: RBACService = Depends(get_rbac_service),
    audit_log: AuditLogService = Depends(get_audit_log_service),
):
    """Update a role (admin only)."""
    try:
        updated = rbac.update_role(
            role_id=role_id, name=role_update.name, description=role_update.description
        )
        audit_log.log_event(
            username=current_user.get("username"),
            user_id=current_user.get("user_id"),
            event_type="rbac-role-updated",
            message=f"Role '{role_update.name}' updated",
            resource_type="role",
            resource_id=str(role_id),
            resource_name=role_update.name,
            severity="info",
        )
        return updated
    except RBACNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Role not found"
        )


@router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: int,
    current_user: dict = Depends(require_role("admin")),
    rbac: RBACService = Depends(get_rbac_service),
    audit_log: AuditLogService = Depends(get_audit_log_service),
):
    """Delete a role (admin only, cannot delete system roles)."""
    try:
        rbac.delete_role(role_id)
        audit_log.log_event(
            username=current_user.get("username"),
            user_id=current_user.get("user_id"),
            event_type="rbac-role-deleted",
            message=f"Role '{role_id}' deleted",
            resource_type="role",
            resource_id=str(role_id),
            resource_name=str(role_id),
            severity="info",
        )
    except RBACNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Role not found"
        )
    except RBACConstraintError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete a system role",
        )


@router.get("/roles/{role_id}/permissions", response_model=list[PermissionWithGrant])
async def get_role_permissions(
    role_id: int,
    current_user: dict = Depends(verify_token),
    rbac: RBACService = Depends(get_rbac_service),
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
    rbac: RBACService = Depends(get_rbac_service),
    audit_log: AuditLogService = Depends(get_audit_log_service),
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
    audit_log.log_event(
        username=current_user.get("username"),
        user_id=current_user.get("user_id"),
        event_type="rbac-permission-assigned",
        message=f"Permission '{assignment.permission_id}' assigned to role '{role.get('name', role_id)}'",
        resource_type="permission",
        resource_id=str(assignment.permission_id),
        resource_name=str(role.get("name", role_id)),
        severity="info",
    )


@router.post(
    "/roles/{role_id}/permissions/bulk", status_code=status.HTTP_204_NO_CONTENT
)
async def assign_multiple_permissions_to_role(
    role_id: int,
    assignment: BulkPermissionAssignment,
    current_user: dict = Depends(require_role("admin")),
    rbac: RBACService = Depends(get_rbac_service),
    audit_log: AuditLogService = Depends(get_audit_log_service),
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
    audit_log.log_event(
        username=current_user.get("username"),
        user_id=current_user.get("user_id"),
        event_type="rbac-permission-assigned",
        message=f"{len(assignment.permission_ids)} permission(s) assigned to role '{role.get('name', role_id)}'",
        resource_type="permission",
        resource_name=str(role.get("name", role_id)),
        severity="info",
        extra_data={"permission_ids": assignment.permission_ids},
    )


@router.delete(
    "/roles/{role_id}/permissions/{permission_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_permission_from_role(
    role_id: int,
    permission_id: int,
    current_user: dict = Depends(require_role("admin")),
    rbac: RBACService = Depends(get_rbac_service),
    audit_log: AuditLogService = Depends(get_audit_log_service),
):
    """Remove a permission from a role (admin only)."""
    rbac.remove_permission_from_role(role_id, permission_id)
    audit_log.log_event(
        username=current_user.get("username"),
        user_id=current_user.get("user_id"),
        event_type="rbac-permission-revoked",
        message=f"Permission '{permission_id}' removed from role '{role_id}'",
        resource_type="permission",
        resource_id=str(permission_id),
        resource_name=str(role_id),
        severity="info",
    )
