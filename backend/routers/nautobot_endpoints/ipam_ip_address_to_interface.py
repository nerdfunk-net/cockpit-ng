"""
Nautobot IPAM IP Address to Interface assignment endpoint.
"""

from __future__ import annotations
import logging
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from services import nautobot_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ipam", tags=["nautobot-ipam-addresses"])


@router.post("/ip-address-to-interface", summary="🔶 REST: Assign IP to Interface")
async def assign_ip_address_to_interface(
    assignment_data: dict,
    current_user: dict = Depends(require_permission("nautobot.locations", "write")),
):
    """
    Assign an IP address to an interface in Nautobot.

    **🔶 This endpoint uses REST API** to create IP address to interface assignments.

    This endpoint creates an IP address to interface assignment using the
    Nautobot REST API endpoint /api/ipam/ip-address-to-interface/.

    Request body should contain:
    - ip_address: IP address ID (UUID)
    - interface: Interface ID (UUID)

    Example:
    {
        "ip_address": "uuid-of-ip-address",
        "interface": "uuid-of-interface"
    }

    Returns the created assignment object.
    """
    try:
        # Validate required fields
        if "ip_address" not in assignment_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required field: ip_address",
            )
        if "interface" not in assignment_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required field: interface",
            )

        endpoint = "ipam/ip-address-to-interface/"
        result = await nautobot_service.rest_request(
            endpoint, method="POST", data=assignment_data
        )

        logger.info(
            f"Assigned IP address {assignment_data.get('ip_address')} to interface {assignment_data.get('interface')}"
        )
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to assign IP address to interface: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to assign IP address to interface: {str(e)}",
        )
