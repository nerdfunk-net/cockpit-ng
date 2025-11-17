"""
Nautobot DCIM Device endpoints - Basic CRUD operations for devices.
"""

from __future__ import annotations
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from services import nautobot_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dcim/devices", tags=["nautobot-dcim-devices"])


# DCIM Device Endpoints
# =============================================================================


@router.get("")
async def get_dcim_devices(
    name: Optional[str] = None,
    location: Optional[str] = None,
    role: Optional[str] = None,
    device_type: Optional[str] = None,
    platform: Optional[str] = None,
    status: Optional[str] = None,
    tenant: Optional[str] = None,
    tag: Optional[str] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = None,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """
    Get devices from Nautobot DCIM.

    Query parameters:
    - name: Filter by device name
    - location: Filter by location name or ID
    - role: Filter by role name or ID
    - device_type: Filter by device type name or ID
    - platform: Filter by platform name or ID
    - status: Filter by status (e.g., "active", "planned", "offline")
    - tenant: Filter by tenant name or ID
    - tag: Filter by tag name
    - limit: Maximum number of results
    - offset: Pagination offset
    """
    try:
        # Build query parameters
        params = {}
        if name:
            params["name"] = name
        if location:
            params["location"] = location
        if role:
            params["role"] = role
        if device_type:
            params["device_type"] = device_type
        if platform:
            params["platform"] = platform
        if status:
            params["status"] = status
        if tenant:
            params["tenant"] = tenant
        if tag:
            params["tag"] = tag
        if limit:
            params["limit"] = limit
        if offset:
            params["offset"] = offset

        # Build endpoint URL with query parameters
        endpoint = "dcim/devices/"
        if params:
            query_string = "&".join([f"{k}={v}" for k, v in params.items()])
            endpoint = f"{endpoint}?{query_string}"

        result = await nautobot_service.rest_request(endpoint, method="GET")

        logger.info(f"Retrieved {result.get('count', 0)} devices from Nautobot DCIM")
        return result

    except Exception as e:
        logger.error(f"Failed to get DCIM devices: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve DCIM devices: {str(e)}",
        )


@router.get("/{device_id}")
async def get_dcim_device(
    device_id: str,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """
    Get a specific device by ID from Nautobot DCIM.

    Parameters:
    - device_id: The UUID of the device
    """
    try:
        endpoint = f"dcim/devices/{device_id}/"
        result = await nautobot_service.rest_request(endpoint, method="GET")

        logger.info(f"Retrieved device {device_id} from Nautobot DCIM")
        return result

    except Exception as e:
        logger.error(f"Failed to get DCIM device {device_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND
            if "404" in str(e)
            else status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve DCIM device: {str(e)}",
        )


@router.post("")
async def create_dcim_device(
    device_data: dict,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
):
    """
    Create a new device in Nautobot DCIM.

    Request body should contain:
    - name: Device name (required)
    - device_type: Device type ID (required)
    - role: Role ID (required)
    - location: Location ID (required)
    - status: Status ID or name (required)
    - platform: (optional) Platform ID
    - serial: (optional) Serial number
    - asset_tag: (optional) Asset tag
    - tenant: (optional) Tenant ID
    - rack: (optional) Rack ID
    - position: (optional) Rack position
    - face: (optional) Rack face ("front" or "rear")
    - primary_ip4: (optional) Primary IPv4 address ID
    - primary_ip6: (optional) Primary IPv6 address ID
    - comments: (optional) Comments
    - tags: (optional) List of tag IDs
    - custom_fields: (optional) Custom field values

    Example:
    {
        "name": "switch-01",
        "device_type": "device-type-uuid",
        "role": "role-uuid",
        "location": "location-uuid",
        "status": "active",
        "platform": "platform-uuid",
        "serial": "SN123456",
        "comments": "Main distribution switch"
    }
    """
    try:
        # Validate required fields
        required_fields = ["name", "device_type", "role", "location", "status"]
        missing_fields = [
            field for field in required_fields if field not in device_data
        ]

        if missing_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required fields: {', '.join(missing_fields)}",
            )

        endpoint = "dcim/devices/"
        result = await nautobot_service.rest_request(
            endpoint, method="POST", data=device_data
        )

        logger.info(f"Created device {device_data.get('name')} in Nautobot DCIM")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create DCIM device: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create DCIM device: {str(e)}",
        )


@router.put("/{device_id}")
@router.patch("/{device_id}")
async def update_dcim_device(
    device_id: str,
    device_data: dict,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
):
    """
    Update an existing device in Nautobot DCIM.

    Parameters:
    - device_id: The UUID of the device to update

    Request body can contain any updatable fields:
    - name: Device name
    - device_type: Device type ID
    - role: Role ID
    - location: Location ID
    - status: Status ID
    - platform: Platform ID
    - serial: Serial number
    - asset_tag: Asset tag
    - tenant: Tenant ID
    - rack: Rack ID
    - position: Rack position
    - face: Rack face
    - primary_ip4: Primary IPv4 address ID
    - primary_ip6: Primary IPv6 address ID
    - comments: Comments
    - tags: List of tag IDs
    - custom_fields: Custom field values
    """
    try:
        endpoint = f"dcim/devices/{device_id}/"

        # Use PATCH for partial updates
        result = await nautobot_service.rest_request(
            endpoint, method="PATCH", data=device_data
        )

        logger.info(f"Updated device {device_id} in Nautobot DCIM")
        return result

    except Exception as e:
        logger.error(f"Failed to update DCIM device {device_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND
            if "404" in str(e)
            else status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update DCIM device: {str(e)}",
        )


@router.delete("/{device_id}")
async def delete_dcim_device(
    device_id: str,
    current_user: dict = Depends(require_permission("nautobot.devices", "delete")),
):
    """
    Delete a device from Nautobot DCIM.

    Parameters:
    - device_id: The UUID of the device to delete
    """
    try:
        endpoint = f"dcim/devices/{device_id}/"
        result = await nautobot_service.rest_request(endpoint, method="DELETE")

        logger.info(f"Deleted device {device_id} from Nautobot DCIM")
        return result

    except Exception as e:
        logger.error(f"Failed to delete DCIM device {device_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND
            if "404" in str(e)
            else status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete DCIM device: {str(e)}",
        )
