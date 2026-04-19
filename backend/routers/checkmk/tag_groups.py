"""
CheckMK host tag groups router — 5 endpoints.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from dependencies import get_checkmk_tag_group_service
from models.checkmk import (
    CheckMKHostTagGroupCreateRequest,
    CheckMKHostTagGroupUpdateRequest,
    CheckMKHostTagGroupListResponse,
    CheckMKOperationResponse,
)
from services.checkmk.exceptions import CheckMKClientError

logger = logging.getLogger(__name__)
router = APIRouter(tags=["checkmk"])


@router.get("/host-tag-groups", response_model=CheckMKHostTagGroupListResponse)
async def get_all_host_tag_groups(
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_tag_group_service),
):
    """Get all host tag groups."""
    try:
        result = await service.get_all_host_tag_groups()
        return CheckMKHostTagGroupListResponse(
            tag_groups=result["tag_groups"], total=result["total"]
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting host tag groups: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get host tag groups: {str(e)}",
        )


@router.get("/host-tag-groups/{name}", response_model=CheckMKOperationResponse)
async def get_host_tag_group(
    name: str,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_tag_group_service),
):
    """Get specific host tag group."""
    try:
        result = await service.get_host_tag_group(name)
        return CheckMKOperationResponse(
            success=True,
            message=f"Retrieved host tag group {name} successfully",
            data=result,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting host tag group %s: %s", name, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get host tag group {name}: {str(e)}",
        )


@router.post("/host-tag-groups", response_model=CheckMKOperationResponse)
async def create_host_tag_group(
    request: CheckMKHostTagGroupCreateRequest,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_tag_group_service),
):
    """Create new host tag group."""
    try:
        result = await service.create_host_tag_group(request)
        return CheckMKOperationResponse(
            success=True,
            message=f"Created host tag group {request.id} successfully",
            data=result,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error creating host tag group %s: %s", request.id, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create host tag group {request.id}: {str(e)}",
        )


@router.put("/host-tag-groups/{name}", response_model=CheckMKOperationResponse)
async def update_host_tag_group(
    name: str,
    request: CheckMKHostTagGroupUpdateRequest,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_tag_group_service),
):
    """Update existing host tag group."""
    try:
        result = await service.update_host_tag_group(name, request)
        return CheckMKOperationResponse(
            success=True,
            message=f"Updated host tag group {name} successfully",
            data=result,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating host tag group %s: %s", name, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update host tag group {name}: {str(e)}",
        )


@router.delete("/host-tag-groups/{name}", response_model=CheckMKOperationResponse)
async def delete_host_tag_group(
    name: str,
    repair: bool = False,
    mode: str = None,
    current_user: dict = Depends(require_permission("checkmk.devices", "delete")),
    service=Depends(get_checkmk_tag_group_service),
):
    """Delete host tag group."""
    try:
        await service.delete_host_tag_group(name, repair=repair, mode=mode)
        return CheckMKOperationResponse(
            success=True, message=f"Deleted host tag group {name} successfully"
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting host tag group %s: %s", name, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete host tag group {name}: {str(e)}",
        )
