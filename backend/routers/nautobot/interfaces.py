"""
Nautobot DCIM Interface endpoints - CRUD operations for device interfaces.
"""

from __future__ import annotations
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from services.nautobot import nautobot_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dcim/interfaces", tags=["nautobot-dcim-interfaces"])


# DCIM Interface Endpoints
# =============================================================================


@router.get("", summary="🔶 REST: List Device Interfaces")
async def get_dcim_interfaces(
    device: Optional[str] = None,
    device_id: Optional[str] = None,
    name: Optional[str] = None,
    type: Optional[str] = None,
    enabled: Optional[bool] = None,
    mgmt_only: Optional[bool] = None,
    mac_address: Optional[str] = None,
    status: Optional[str] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = None,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """
    Get device interfaces from Nautobot DCIM.

    **🔶 This endpoint uses REST API** to query Nautobot DCIM interfaces.

    Query parameters:
    - device: Filter by device name
    - device_id: Filter by device ID
    - name: Filter by interface name
    - type: Filter by interface type (e.g., "1000base-t", "10gbase-x-sfpp")
    - enabled: Filter by enabled status (true/false)
    - mgmt_only: Filter by management-only status (true/false)
    - mac_address: Filter by MAC address
    - status: Filter by status
    - limit: Maximum number of results
    - offset: Pagination offset
    """
    try:
        # Build query parameters
        params = {}
        if device:
            params["device"] = device
        if device_id:
            params["device_id"] = device_id
        if name:
            params["name"] = name
        if type:
            params["type"] = type
        if enabled is not None:
            params["enabled"] = str(enabled).lower()
        if mgmt_only is not None:
            params["mgmt_only"] = str(mgmt_only).lower()
        if mac_address:
            params["mac_address"] = mac_address
        if status:
            params["status"] = status
        if limit:
            params["limit"] = limit
        if offset:
            params["offset"] = offset

        # Build endpoint URL with query parameters
        endpoint = "dcim/interfaces/"
        if params:
            query_string = "&".join([f"{k}={v}" for k, v in params.items()])
            endpoint = f"{endpoint}?{query_string}"

        result = await nautobot_service.rest_request(endpoint, method="GET")

        logger.info("Retrieved %s interfaces from Nautobot DCIM", result.get('count', 0))
        return result

    except Exception as e:
        logger.error("Failed to get DCIM interfaces: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve DCIM interfaces: {str(e)}",
        )


@router.get("/{interface_id}", summary="🔶 REST: Get Device Interface")
async def get_dcim_interface(
    interface_id: str,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """
    Get a specific interface by ID from Nautobot DCIM.

    Parameters:
    - interface_id: The UUID of the interface
    """
    try:
        endpoint = f"dcim/interfaces/{interface_id}/"
        result = await nautobot_service.rest_request(endpoint, method="GET")

        logger.info("Retrieved interface %s from Nautobot DCIM", interface_id)
        return result

    except Exception as e:
        logger.error("Failed to get DCIM interface %s: %s", interface_id, str(e))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND
            if "404" in str(e)
            else status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve DCIM interface: {str(e)}",
        )


@router.post("", summary="🔶 REST: Create Device Interface")
async def create_dcim_interface(
    interface_data: dict,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
):
    """
    Create a new interface in Nautobot DCIM.

    Request body should contain:
    - name: Interface name (required)
    - device: Device ID (required)
    - type: Interface type (required, e.g., "1000base-t", "10gbase-x-sfpp")
    - status: Status ID or name (required)
    - enabled: Enable status (optional, default: true)
    - mgmt_only: Management-only flag (optional, default: false)
    - description: Description (optional)
    - mac_address: MAC address (optional)
    - mtu: MTU size (optional)
    - mode: Interface mode (optional, e.g., "access", "tagged")
    - untagged_vlan: Untagged VLAN ID (optional)
    - tagged_vlans: List of tagged VLAN IDs (optional)
    - parent_interface: Parent interface ID for sub-interfaces (optional)
    - bridge: Bridge interface ID (optional)
    - lag: LAG interface ID (optional)
    - tags: List of tag IDs (optional)

    Example:
    {
        "name": "GigabitEthernet0/1",
        "device": "device-uuid",
        "type": "1000base-t",
        "status": "active",
        "enabled": true,
        "description": "Uplink to core switch"
    }
    """
    try:
        # Validate required fields
        required_fields = ["name", "device", "type", "status"]
        missing_fields = [
            field for field in required_fields if field not in interface_data
        ]

        if missing_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required fields: {', '.join(missing_fields)}",
            )

        endpoint = "dcim/interfaces/"
        result = await nautobot_service.rest_request(
            endpoint, method="POST", data=interface_data
        )

        logger.info(
            "Created interface %s on device %s in Nautobot DCIM", interface_data.get('name'), interface_data.get('device')
        )
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to create DCIM interface: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create DCIM interface: {str(e)}",
        )


@router.put("/{interface_id}", summary="🔶 REST: Update Device Interface (Full)")
@router.patch("/{interface_id}", summary="🔶 REST: Update Device Interface (Partial)")
async def update_dcim_interface(
    interface_id: str,
    interface_data: dict,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
):
    """
    Update an existing interface in Nautobot DCIM.

    Parameters:
    - interface_id: The UUID of the interface to update

    Request body can contain any updatable fields:
    - name: Interface name
    - device: Device ID
    - type: Interface type
    - status: Status ID
    - enabled: Enable status
    - mgmt_only: Management-only flag
    - description: Description
    - mac_address: MAC address
    - mtu: MTU size
    - mode: Interface mode
    - untagged_vlan: Untagged VLAN ID
    - tagged_vlans: List of tagged VLAN IDs
    - parent_interface: Parent interface ID
    - bridge: Bridge interface ID
    - lag: LAG interface ID
    - tags: List of tag IDs
    """
    try:
        endpoint = f"dcim/interfaces/{interface_id}/"

        # Use PATCH for partial updates
        result = await nautobot_service.rest_request(
            endpoint, method="PATCH", data=interface_data
        )

        logger.info("Updated interface %s in Nautobot DCIM", interface_id)
        return result

    except Exception as e:
        logger.error("Failed to update DCIM interface %s: %s", interface_id, str(e))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND
            if "404" in str(e)
            else status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update DCIM interface: {str(e)}",
        )


@router.delete("/{interface_id}", summary="🔶 REST: Delete Device Interface")
async def delete_dcim_interface(
    interface_id: str,
    current_user: dict = Depends(require_permission("nautobot.devices", "delete")),
):
    """
    Delete an interface from Nautobot DCIM.

    Parameters:
    - interface_id: The UUID of the interface to delete
    """
    try:
        endpoint = f"dcim/interfaces/{interface_id}/"
        result = await nautobot_service.rest_request(endpoint, method="DELETE")

        logger.info("Deleted interface %s from Nautobot DCIM", interface_id)
        return result

    except Exception as e:
        logger.error("Failed to delete DCIM interface %s: %s", interface_id, str(e))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND
            if "404" in str(e)
            else status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete DCIM interface: {str(e)}",
        )
