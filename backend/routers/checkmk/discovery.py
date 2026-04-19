"""
CheckMK service discovery router — 5 endpoints.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from dependencies import get_checkmk_discovery_service
from models.checkmk import (
    CheckMKServiceDiscoveryRequest,
    CheckMKDiscoveryPhaseUpdateRequest,
    CheckMKBulkDiscoveryRequest,
    CheckMKOperationResponse,
)
from services.checkmk.exceptions import CheckMKClientError

logger = logging.getLogger(__name__)
router = APIRouter(tags=["checkmk"])


@router.get(
    "/service-discovery/host/{hostname}", response_model=CheckMKOperationResponse
)
async def get_service_discovery(
    hostname: str,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_discovery_service),
):
    """Get service discovery status for a host."""
    try:
        result = await service.get_service_discovery(hostname)
        return CheckMKOperationResponse(
            success=True,
            message=f"Retrieved service discovery status for host {hostname} successfully",
            data=result,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Error getting service discovery for host %s: %s", hostname, str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get service discovery for host {hostname}: {str(e)}",
        )


@router.post(
    "/service-discovery/host/{hostname}/start", response_model=CheckMKOperationResponse
)
async def start_service_discovery(
    hostname: str,
    request: CheckMKServiceDiscoveryRequest = CheckMKServiceDiscoveryRequest(),
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_discovery_service),
):
    """Start service discovery for a host."""
    try:
        result = await service.start_service_discovery(hostname, request.mode)
        return CheckMKOperationResponse(
            success=True,
            message=f"Started service discovery for host {hostname} successfully",
            data=result,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Error starting service discovery for host %s: %s", hostname, str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start service discovery for host {hostname}: {str(e)}",
        )


@router.post(
    "/service-discovery/host/{hostname}/wait", response_model=CheckMKOperationResponse
)
async def wait_for_service_discovery(
    hostname: str,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_discovery_service),
):
    """Wait for service discovery completion."""
    try:
        result = await service.wait_for_service_discovery(hostname)
        return CheckMKOperationResponse(
            success=True,
            message=f"Service discovery completed for host {hostname}",
            data=result,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Error waiting for service discovery for host %s: %s", hostname, str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to wait for service discovery for host {hostname}: {str(e)}",
        )


@router.post(
    "/service-discovery/host/{hostname}/update-phase",
    response_model=CheckMKOperationResponse,
)
async def update_discovery_phase(
    hostname: str,
    request: CheckMKDiscoveryPhaseUpdateRequest,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_discovery_service),
):
    """Update discovery phase for a host."""
    try:
        result = await service.update_discovery_phase(
            hostname, request.phase, request.services
        )
        return CheckMKOperationResponse(
            success=True,
            message=f"Updated discovery phase for host {hostname} successfully",
            data=result,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating discovery phase for host %s: %s", hostname, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update discovery phase for host {hostname}: {str(e)}",
        )


@router.post("/service-discovery/bulk", response_model=CheckMKOperationResponse)
async def start_bulk_discovery(
    request: CheckMKBulkDiscoveryRequest,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_discovery_service),
):
    """Start a bulk discovery job."""
    try:
        result = await service.start_bulk_discovery(request)
        return CheckMKOperationResponse(
            success=True,
            message=f"Started bulk discovery for {len(request.hostnames)} hosts",
            data=result,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error starting bulk discovery: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start bulk discovery: {str(e)}",
        )
