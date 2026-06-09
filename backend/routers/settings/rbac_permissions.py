"""RBAC permission endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_role, verify_token
from dependencies import get_rbac_service
from models.rbac import Permission, PermissionCreate
from services.auth.exceptions import RBACConflictError, RBACNotFoundError
from services.auth.rbac_service import RBACService

router = APIRouter()


@router.get("/permissions", response_model=list[Permission])
async def list_permissions(
    current_user: dict = Depends(verify_token),
    rbac: RBACService = Depends(get_rbac_service),
):
    """List all permissions in the system."""
    permissions = rbac.list_permissions()
    return permissions


@router.post(
    "/permissions", response_model=Permission, status_code=status.HTTP_201_CREATED
)
async def create_permission(
    permission: PermissionCreate,
    current_user: dict = Depends(require_role("admin")),
    rbac: RBACService = Depends(get_rbac_service),
):
    """Create a new permission (admin only)."""
    try:
        created = rbac.create_permission(
            resource=permission.resource,
            action=permission.action,
            description=permission.description or "",
        )
        return created
    except RBACConflictError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Permission already exists"
        )


@router.get("/permissions/{permission_id}", response_model=Permission)
async def get_permission(
    permission_id: int,
    current_user: dict = Depends(verify_token),
    rbac: RBACService = Depends(get_rbac_service),
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
    permission_id: int,
    current_user: dict = Depends(require_role("admin")),
    rbac: RBACService = Depends(get_rbac_service),
):
    """Delete a permission (admin only)."""
    try:
        rbac.delete_permission(permission_id)
    except RBACNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Permission not found"
        )
