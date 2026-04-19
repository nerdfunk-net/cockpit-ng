"""
Nautobot device operation endpoints: device details, delete device, offboard device.
"""

from __future__ import annotations
import logging
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from services.nautobot.common.exceptions import NautobotNotFoundError
from models.nautobot import OffboardDeviceRequest
from dependencies import (
    get_nautobot_service,
    get_offboarding_service,
    get_device_query_service,
    get_cache_service,
)
from services.nautobot.client import NautobotService
from services.nautobot.devices.query import DeviceQueryService
from services.nautobot.offboarding.service import OffboardingService
from repositories.audit_log_repository import audit_log_repo

logger = logging.getLogger(__name__)
router = APIRouter(tags=["nautobot-device-ops"])


@router.get(
    "/devices/{device_id}/details", summary="🔷 GraphQL: Get Detailed Device Info"
)
async def get_device_details(
    device_id: str,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
    device_query_service: DeviceQueryService = Depends(get_device_query_service),
):
    """Get detailed device information using the comprehensive devices.md query.

    **🔷 This endpoint uses GraphQL** to fetch comprehensive device details.
    """
    try:
        # Use shared device details service
        device = await device_query_service.get_device_details(
            device_id=device_id,
            use_cache=True,
        )
        return device
    except HTTPException:
        raise
    except ValueError as e:
        # ValueError from service indicates device not found or query error
        if "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e),
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
    except Exception as e:
        logger.error("Error fetching device details for %s: %s", device_id, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch device details: {str(e)}",
        )


@router.delete("/devices/{device_id}", summary="🔶 REST: Delete Device")
async def delete_device(
    device_id: str,
    current_user: dict = Depends(require_permission("nautobot.devices", "delete")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
    cache_service=Depends(get_cache_service),
):
    """Delete a device from Nautobot."""
    try:
        # Use REST API to delete the device
        await nautobot_service.rest_request(
            f"dcim/devices/{device_id}/", method="DELETE"
        )

        # Clear device from cache
        cache_key = f"nautobot:devices:{device_id}"
        cache_service.delete(cache_key)

        # Clear device details cache
        details_cache_key = f"nautobot:device_details:{device_id}"
        cache_service.delete(details_cache_key)

        # Clear device list caches to force refresh
        cache_keys_to_clear = [
            "nautobot:devices:list:all",
        ]
        for key in cache_keys_to_clear:
            cache_service.delete(key)

        audit_log_repo.create_log(
            username=current_user.get("sub"),
            user_id=current_user.get("user_id"),
            event_type="nautobot-device-deleted",
            message=f"Device '{device_id}' deleted from Nautobot",
            resource_type="device",
            resource_id=device_id,
            resource_name=device_id,
            severity="info",
        )

        return {
            "success": True,
            "message": f"Device {device_id} deleted successfully",
            "device_id": device_id,
        }

    except NautobotNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device {device_id} not found",
        )
    except Exception as e:
        logger.error("Error deleting device %s: %s", device_id, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete device: {str(e)}",
        )


@router.post("/offboard/{device_id}", summary="🟠 Mixed API: Offboard Device")
async def offboard_device(
    device_id: str,
    request: OffboardDeviceRequest,
    current_user: dict = Depends(require_permission("devices.offboard", "execute")),
    offboarding_service: OffboardingService = Depends(get_offboarding_service),
):
    """Offboard a device by removing it or applying configured offboarding values.

    **🟠 This endpoint uses multiple APIs** including GraphQL and REST for device offboarding.
    """
    try:
        return await offboarding_service.offboard_device(
            device_id=device_id,
            request=request,
            current_user=current_user,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Unexpected error during offboard process for device %s: %s",
            device_id,
            str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Offboarding failed: {str(e)}",
        )
