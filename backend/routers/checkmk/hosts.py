"""
CheckMK hosts router — 11 endpoints.

Route ordering note: static paths (bulk-*, create) are registered before
parameterised {hostname} paths to prevent FastAPI path-matching conflicts.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from dependencies import get_checkmk_host_service
from models.checkmk import (
    CheckMKHostCreateRequest,
    CheckMKHostUpdateRequest,
    CheckMKHostMoveRequest,
    CheckMKHostRenameRequest,
    CheckMKBulkHostCreateRequest,
    CheckMKBulkHostUpdateRequest,
    CheckMKBulkHostDeleteRequest,
    CheckMKHostListResponse,
    CheckMKOperationResponse,
)
from services.checkmk.exceptions import (
    CheckMKAPIError,
    CheckMKClientError,
    HostNotFoundError,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["checkmk"])


@router.get("/hosts", response_model=CheckMKHostListResponse)
async def get_all_hosts(
    effective_attributes: bool = False,
    include_links: bool = False,
    site: str = None,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_host_service),
):
    """Get all hosts from CheckMK."""
    try:
        result = await service.get_all_hosts(
            effective_attributes=effective_attributes,
            include_links=include_links,
            site=site,
        )
        return CheckMKHostListResponse(hosts=result["hosts"], total=result["total"])
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting hosts: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get hosts: {str(e)}",
        )


# Static POST paths before parameterised /{hostname}/... paths


@router.post("/hosts/create", response_model=CheckMKOperationResponse)
async def create_host_v2(
    request: CheckMKHostCreateRequest,
    bake_agent: bool = False,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_host_service),
):
    """Create new host in CheckMK (v2 endpoint with query parameter support)."""
    try:
        data = await service.create_host_v2(
            hostname=request.host_name,
            folder=request.folder,
            attributes=request.attributes,
            bake_agent=bake_agent,
            request_bake_agent=request.bake_agent,
            start_discovery=request.start_discovery,
            discovery_mode=request.discovery_mode,
        )
        return CheckMKOperationResponse(
            success=True,
            message=f"Host {request.host_name} created successfully",
            data=data,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error creating host %s: %s", request.host_name, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create host {request.host_name}: {str(e)}",
        )


@router.post("/hosts/bulk-create", response_model=CheckMKOperationResponse)
async def bulk_create_hosts(
    request: CheckMKBulkHostCreateRequest,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_host_service),
):
    """Create multiple hosts in one request."""
    try:
        result = await service.bulk_create_hosts(request.entries)
        return CheckMKOperationResponse(
            success=True,
            message=f"Created {len(request.entries)} hosts successfully",
            data=result,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error bulk creating hosts: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to bulk create hosts: {str(e)}",
        )


@router.post("/hosts/bulk-update", response_model=CheckMKOperationResponse)
async def bulk_update_hosts(
    request: CheckMKBulkHostUpdateRequest,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_host_service),
):
    """Update multiple hosts in one request."""
    try:
        result = await service.bulk_update_hosts(request.entries)
        return CheckMKOperationResponse(
            success=True,
            message=f"Updated {len(request.entries)} hosts successfully",
            data=result,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error bulk updating hosts: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to bulk update hosts: {str(e)}",
        )


@router.post("/hosts/bulk-delete", response_model=CheckMKOperationResponse)
async def bulk_delete_hosts(
    request: CheckMKBulkHostDeleteRequest,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_host_service),
):
    """Delete multiple hosts in one request."""
    try:
        result = await service.bulk_delete_hosts(request.entries)
        return CheckMKOperationResponse(
            success=True,
            message=f"Deleted {len(request.entries)} hosts successfully",
            data=result,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error bulk deleting hosts: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to bulk delete hosts: {str(e)}",
        )


@router.post("/hosts", response_model=CheckMKOperationResponse)
async def create_host(
    request: CheckMKHostCreateRequest,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_host_service),
):
    """Create new host in CheckMK."""
    try:
        data = await service.create_host(
            hostname=request.host_name,
            folder=request.folder,
            attributes=request.attributes,
            bake_agent=request.bake_agent,
            start_discovery=request.start_discovery,
            discovery_mode=request.discovery_mode,
        )
        return CheckMKOperationResponse(
            success=True,
            message=f"Host {request.host_name} created successfully",
            data=data,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error creating host %s: %s", request.host_name, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create host {request.host_name}: {str(e)}",
        )


@router.get("/hosts/{hostname}", response_model=CheckMKOperationResponse)
async def get_host(
    hostname: str,
    effective_attributes: bool = False,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_host_service),
):
    """Get specific host configuration."""
    try:
        result = await service.get_host(hostname, effective_attributes)
        return CheckMKOperationResponse(
            success=True, message=f"Host {hostname} retrieved successfully", data=result
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HostNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except CheckMKAPIError as e:
        logger.error(
            "CheckMK API error getting host %s: %s (status: %s)",
            hostname,
            str(e),
            e.status_code,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"CheckMK API error: {str(e)}",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting host %s: %s", hostname, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get host {hostname}: {str(e)}",
        )


@router.put("/hosts/{hostname}", response_model=CheckMKOperationResponse)
async def update_host(
    hostname: str,
    request: CheckMKHostUpdateRequest,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_host_service),
):
    """Update existing host configuration."""
    try:
        result = await service.update_host(hostname, request.attributes)
        return CheckMKOperationResponse(
            success=True, message=f"Host {hostname} updated successfully", data=result
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating host %s: %s", hostname, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update host {hostname}: {str(e)}",
        )


@router.delete("/hosts/{hostname}", response_model=CheckMKOperationResponse)
async def delete_host(
    hostname: str,
    current_user: dict = Depends(require_permission("checkmk.devices", "delete")),
    service=Depends(get_checkmk_host_service),
):
    """Delete host from CheckMK."""
    try:
        result = await service.delete_host(hostname)
        return CheckMKOperationResponse(
            success=result["success"], message=result["message"]
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting host %s: %s", hostname, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete host {hostname}: {str(e)}",
        )


@router.post("/hosts/{hostname}/move", response_model=CheckMKOperationResponse)
async def move_host(
    hostname: str,
    request: CheckMKHostMoveRequest,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_host_service),
):
    """Move host to different folder."""
    try:
        result = await service.move_host(hostname, request.target_folder)
        return CheckMKOperationResponse(
            success=True,
            message=f"Host {hostname} moved to {request.target_folder} successfully",
            data=result,
        )
    except CheckMKAPIError as e:
        if e.status_code == 428:
            raise HTTPException(
                status_code=status.HTTP_428_PRECONDITION_REQUIRED,
                detail=f"Cannot move host '{hostname}' - CheckMK changes need to be activated first",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST
            if e.status_code == 400
            else status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to move host '{hostname}': {str(e)}",
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error moving host %s: %s", hostname, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to move host {hostname}: {str(e)}",
        )


@router.post("/hosts/{hostname}/rename", response_model=CheckMKOperationResponse)
async def rename_host(
    hostname: str,
    request: CheckMKHostRenameRequest,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_host_service),
):
    """Rename host."""
    try:
        result = await service.rename_host(hostname, request.new_name)
        return CheckMKOperationResponse(
            success=True,
            message=f"Host {hostname} renamed to {request.new_name} successfully",
            data=result,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error renaming host %s: %s", hostname, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to rename host {hostname}: {str(e)}",
        )
