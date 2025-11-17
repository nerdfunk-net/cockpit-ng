"""
Nautobot IPAM IP Address endpoints.
"""

from __future__ import annotations
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from services import nautobot_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ipam/ip-addresses", tags=["nautobot-ipam-addresses"])


# IPAM IP Address Endpoints
# =============================================================================


@router.get("")
async def get_ipam_ip_addresses(
    address: Optional[str] = None,
    namespace: Optional[str] = None,
    parent: Optional[str] = None,
    status: Optional[str] = None,
    dns_name: Optional[str] = None,
    device: Optional[str] = None,
    interface: Optional[str] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = None,
    current_user: dict = Depends(require_permission("nautobot.locations", "read")),
):
    """
    Get IP addresses from Nautobot IPAM.

    Query parameters:
    - address: Filter by IP address (e.g., "192.168.1.1")
    - namespace: Filter by namespace name
    - parent: Filter by parent prefix ID
    - status: Filter by status (e.g., "active", "reserved", "deprecated")
    - dns_name: Filter by DNS name
    - device: Filter by device name or ID
    - interface: Filter by interface name or ID
    - limit: Maximum number of results
    - offset: Pagination offset
    """
    try:
        # Build query parameters
        params = {}
        if address:
            params["address"] = address
        if namespace:
            params["namespace"] = namespace
        if parent:
            params["parent"] = parent
        if status:
            params["status"] = status
        if dns_name:
            params["dns_name"] = dns_name
        if device:
            params["device"] = device
        if interface:
            params["interface"] = interface
        if limit:
            params["limit"] = limit
        if offset:
            params["offset"] = offset

        # Build endpoint URL with query parameters
        endpoint = "ipam/ip-addresses/"
        if params:
            query_string = "&".join([f"{k}={v}" for k, v in params.items()])
            endpoint = f"{endpoint}?{query_string}"

        result = await nautobot_service.rest_request(endpoint, method="GET")

        logger.info(
            f"Retrieved {result.get('count', 0)} IP addresses from Nautobot IPAM"
        )
        return result

    except Exception as e:
        logger.error(f"Failed to get IPAM IP addresses: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve IPAM IP addresses: {str(e)}",
        )


@router.get("/{ip_address_id}")
async def get_ipam_ip_address(
    ip_address_id: str,
    current_user: dict = Depends(require_permission("nautobot.locations", "read")),
):
    """
    Get a specific IP address by ID from Nautobot IPAM.

    Parameters:
    - ip_address_id: The UUID of the IP address
    """
    try:
        endpoint = f"ipam/ip-addresses/{ip_address_id}/"
        result = await nautobot_service.rest_request(endpoint, method="GET")

        logger.info(f"Retrieved IP address {ip_address_id} from Nautobot IPAM")
        return result

    except Exception as e:
        logger.error(f"Failed to get IPAM IP address {ip_address_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND
            if "404" in str(e)
            else status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve IPAM IP address: {str(e)}",
        )


@router.post("")
async def create_ipam_ip_address(
    ip_address_data: dict,
    current_user: dict = Depends(require_permission("nautobot.locations", "write")),
):
    """
    Create a new IP address in Nautobot IPAM.

    Request body should contain:
    - address: The IP address with mask (e.g., "192.168.1.1/24" or "192.168.1.1")
    - namespace: Namespace ID (optional, defaults to Global)
    - status: Status ID or name (e.g., "active")
    - type: Address type (e.g., "host", "anycast", "loopback")
    - parent: (optional) Parent prefix ID
    - dns_name: (optional) DNS name
    - description: (optional) Description
    - tags: (optional) List of tag IDs

    Example:
    {
        "address": "192.168.1.100/24",
        "namespace": "global",
        "status": "active",
        "type": "host",
        "dns_name": "server.example.com",
        "description": "Application server"
    }
    """
    try:
        # Validate required fields
        if "address" not in ip_address_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required field: address",
            )

        endpoint = "ipam/ip-addresses/"
        result = await nautobot_service.rest_request(
            endpoint, method="POST", data=ip_address_data
        )

        logger.info(
            f"Created IP address {ip_address_data.get('address')} in Nautobot IPAM"
        )
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create IPAM IP address: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create IPAM IP address: {str(e)}",
        )


@router.put("/{ip_address_id}")
@router.patch("/{ip_address_id}")
async def update_ipam_ip_address(
    ip_address_id: str,
    ip_address_data: dict,
    current_user: dict = Depends(require_permission("nautobot.locations", "write")),
):
    """
    Update an existing IP address in Nautobot IPAM.

    Parameters:
    - ip_address_id: The UUID of the IP address to update

    Request body can contain any updatable fields:
    - address: The IP address with mask
    - namespace: Namespace ID
    - status: Status ID
    - type: Address type
    - parent: Parent prefix ID
    - dns_name: DNS name
    - description: Description
    - tags: List of tag IDs
    """
    try:
        endpoint = f"ipam/ip-addresses/{ip_address_id}/"

        # Use PATCH for partial updates
        result = await nautobot_service.rest_request(
            endpoint, method="PATCH", data=ip_address_data
        )

        logger.info(f"Updated IP address {ip_address_id} in Nautobot IPAM")
        return result

    except Exception as e:
        logger.error(f"Failed to update IPAM IP address {ip_address_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND
            if "404" in str(e)
            else status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update IPAM IP address: {str(e)}",
        )


@router.delete("/{ip_address_id}")
async def delete_ipam_ip_address(
    ip_address_id: str,
    current_user: dict = Depends(require_permission("nautobot.locations", "delete")),
):
    """
    Delete an IP address from Nautobot IPAM.

    Parameters:
    - ip_address_id: The UUID of the IP address to delete
    """
    try:
        endpoint = f"ipam/ip-addresses/{ip_address_id}/"
        result = await nautobot_service.rest_request(endpoint, method="DELETE")

        logger.info(f"Deleted IP address {ip_address_id} from Nautobot IPAM")
        return result

    except Exception as e:
        logger.error(f"Failed to delete IPAM IP address {ip_address_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND
            if "404" in str(e)
            else status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete IPAM IP address: {str(e)}",
        )
