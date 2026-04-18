"""
CheckMK connection router — 5 endpoints.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from dependencies import get_checkmk_service, get_cache_service
from models.checkmk import (
    CheckMKTestConnectionRequest,
    CheckMKTestConnectionResponse,
    CheckMKVersionResponse,
    CheckMKOperationResponse,
)
from services.checkmk.exceptions import CheckMKClientError, CheckMKAPIError, HostNotFoundError

logger = logging.getLogger(__name__)
router = APIRouter(tags=["checkmk"])


@router.post("/test", response_model=CheckMKTestConnectionResponse)
async def test_checkmk_connection(
    request: CheckMKTestConnectionRequest,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_service),
):
    """Test CheckMK connection with provided settings."""
    try:
        success, message = await service.test_connection(
            request.url,
            request.site,
            request.username,
            request.password,
            request.verify_ssl,
        )
        return CheckMKTestConnectionResponse(
            success=success,
            message=message,
            checkmk_url=request.url,
            connection_source="manual_test",
        )
    except Exception as e:
        logger.error("Error testing CheckMK connection: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to test CheckMK connection: {str(e)}",
        )


@router.get("/test")
async def test_current_checkmk_connection(
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_service),
):
    """Test current CheckMK connection using saved settings."""
    try:
        return await service.test_connection_from_settings()
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error testing CheckMK connection: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to test CheckMK connection: {str(e)}",
        )


@router.get("/stats")
async def get_checkmk_stats(
    current_user: dict = Depends(require_permission("checkmk.devices", "read")),
    service=Depends(get_checkmk_service),
    cache_service=Depends(get_cache_service),
):
    """Get CheckMK statistics with 10-minute caching."""
    try:
        return await service.get_stats(cache_service)
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except CheckMKAPIError as e:
        logger.error("CheckMK API error: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"CheckMK API error: {str(e)}",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error fetching CheckMK stats: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch CheckMK statistics: {str(e)}",
        )


@router.get("/version", response_model=CheckMKVersionResponse)
async def get_version(
    current_user: dict = Depends(require_permission("checkmk.devices", "read")),
    service=Depends(get_checkmk_service),
):
    """Get CheckMK version information."""
    try:
        version_data = await service.get_version()
        return CheckMKVersionResponse(
            version=version_data.get("version", "unknown"),
            edition=version_data.get("edition"),
            demo=version_data.get("demo", False),
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting CheckMK version: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get CheckMK version: {str(e)}",
        )


@router.get("/inventory/{hostname}", response_model=CheckMKOperationResponse)
async def get_host_inventory(
    hostname: str,
    current_user: dict = Depends(require_permission("checkmk.devices", "read")),
    service=Depends(get_checkmk_service),
):
    """Get inventory data for a specific host."""
    try:
        inventory_data = await service.get_host_inventory(hostname)
        return CheckMKOperationResponse(
            success=True,
            message=f"Inventory for host {hostname} retrieved successfully",
            data=inventory_data,
        )
    except HostNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except CheckMKAPIError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"CheckMK inventory API error: {str(e)}",
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting inventory for %s: %s", hostname, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get inventory for {hostname}: {str(e)}",
        )
