"""
CheckMK host groups router — 7 endpoints.

Route ordering note: static paths (bulk-update, bulk-delete) are registered before
parameterised /{name} paths to prevent FastAPI path-matching conflicts.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from dependencies import get_checkmk_host_group_service
from models.checkmk import (
    CheckMKHostGroupCreateRequest,
    CheckMKHostGroupUpdateRequest,
    CheckMKHostGroupBulkUpdateRequest,
    CheckMKHostGroupBulkDeleteRequest,
    CheckMKOperationResponse,
)
from services.checkmk.exceptions import CheckMKClientError

logger = logging.getLogger(__name__)
router = APIRouter(tags=["checkmk"])


@router.get("/host-groups", response_model=CheckMKOperationResponse)
async def get_host_groups(
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_host_group_service),
):
    """Get all host groups."""
    try:
        result = await service.get_host_groups()
        return CheckMKOperationResponse(
            success=True, message="Retrieved host groups successfully", data=result
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting host groups: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get host groups: {str(e)}",
        )


@router.post("/host-groups", response_model=CheckMKOperationResponse)
async def create_host_group(
    request: CheckMKHostGroupCreateRequest,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_host_group_service),
):
    """Create host group."""
    try:
        result = await service.create_host_group(request.name, request.alias)
        return CheckMKOperationResponse(
            success=True,
            message=f"Created host group {request.name} successfully",
            data=result,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error creating host group %s: %s", request.name, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create host group {request.name}: {str(e)}",
        )


# Static paths before parameterised /{name}

@router.put("/host-groups/bulk-update", response_model=CheckMKOperationResponse)
async def bulk_update_host_groups(
    request: CheckMKHostGroupBulkUpdateRequest,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_host_group_service),
):
    """Update multiple host groups in one request."""
    try:
        result = await service.bulk_update_host_groups(request.entries)
        return CheckMKOperationResponse(
            success=True,
            message=f"Updated {len(request.entries)} host groups successfully",
            data=result,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error bulk updating host groups: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to bulk update host groups: {str(e)}",
        )


@router.delete("/host-groups/bulk-delete", response_model=CheckMKOperationResponse)
async def bulk_delete_host_groups(
    request: CheckMKHostGroupBulkDeleteRequest,
    current_user: dict = Depends(require_permission("checkmk.devices", "delete")),
    service=Depends(get_checkmk_host_group_service),
):
    """Delete multiple host groups in one request."""
    try:
        result = await service.bulk_delete_host_groups(request.entries)
        return CheckMKOperationResponse(
            success=True,
            message=f"Deleted {len(request.entries)} host groups successfully",
            data=result,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error bulk deleting host groups: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to bulk delete host groups: {str(e)}",
        )


@router.get("/host-groups/{group_name}", response_model=CheckMKOperationResponse)
async def get_host_group(
    group_name: str,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_host_group_service),
):
    """Get specific host group."""
    try:
        result = await service.get_host_group(group_name)
        return CheckMKOperationResponse(
            success=True,
            message=f"Retrieved host group {group_name} successfully",
            data=result,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting host group %s: %s", group_name, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get host group {group_name}: {str(e)}",
        )


@router.put("/host-groups/{name}", response_model=CheckMKOperationResponse)
async def update_host_group(
    name: str,
    request: CheckMKHostGroupUpdateRequest,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_host_group_service),
):
    """Update existing host group."""
    try:
        result = await service.update_host_group(name, alias=request.alias)
        return CheckMKOperationResponse(
            success=True, message=f"Updated host group {name} successfully", data=result
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating host group %s: %s", name, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update host group {name}: {str(e)}",
        )


@router.delete("/host-groups/{name}", response_model=CheckMKOperationResponse)
async def delete_host_group(
    name: str,
    current_user: dict = Depends(require_permission("checkmk.devices", "delete")),
    service=Depends(get_checkmk_host_group_service),
):
    """Delete host group."""
    try:
        await service.delete_host_group(name)
        return CheckMKOperationResponse(
            success=True, message=f"Deleted host group {name} successfully"
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting host group %s: %s", name, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete host group {name}: {str(e)}",
        )
