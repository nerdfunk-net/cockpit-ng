"""
Router for snapshot command template management.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from core.auth import verify_token, require_permission
from services.network.snapshots import SnapshotTemplateService
from models.snapshots import (
    SnapshotCommandTemplateCreate,
    SnapshotCommandTemplateUpdate,
    SnapshotCommandTemplateResponse,
)

router = APIRouter(prefix="/api/network/snapshots/templates", tags=["snapshots"])


@router.post(
    "",
    response_model=SnapshotCommandTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_template(
    template: SnapshotCommandTemplateCreate,
    current_user: dict = Depends(require_permission("snapshots", "write")),
):
    """
    Create a new snapshot command template.

    Requires: snapshots:write permission
    """
    service = SnapshotTemplateService()
    try:
        return service.create_template(template, current_user["username"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=List[SnapshotCommandTemplateResponse])
async def list_templates(
    current_user: dict = Depends(require_permission("snapshots", "read")),
):
    """
    List all snapshot command templates accessible by current user.

    Returns global templates + user's private templates.
    Requires: snapshots:read permission
    """
    service = SnapshotTemplateService()
    return service.list_templates(username=current_user["username"])


@router.get("/{template_id}", response_model=SnapshotCommandTemplateResponse)
async def get_template(
    template_id: int,
    current_user: dict = Depends(require_permission("snapshots", "read")),
):
    """
    Get a specific snapshot command template by ID.

    Requires: snapshots:read permission
    """
    service = SnapshotTemplateService()
    template = service.get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.put("/{template_id}", response_model=SnapshotCommandTemplateResponse)
async def update_template(
    template_id: int,
    template: SnapshotCommandTemplateUpdate,
    current_user: dict = Depends(require_permission("snapshots", "write")),
):
    """
    Update a snapshot command template.

    Only the template owner can update private templates.
    Requires: snapshots:write permission
    """
    service = SnapshotTemplateService()
    try:
        updated = service.update_template(
            template_id, template, current_user["username"]
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Template not found")
        return updated
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: int,
    current_user: dict = Depends(require_permission("snapshots", "delete")),
):
    """
    Delete a snapshot command template (soft delete).

    Only the template owner can delete private templates.
    Requires: snapshots:delete permission
    """
    service = SnapshotTemplateService()
    try:
        deleted = service.delete_template(template_id, current_user["username"])
        if not deleted:
            raise HTTPException(status_code=404, detail="Template not found")
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
