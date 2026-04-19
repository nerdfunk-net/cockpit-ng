"""
Nautobot status endpoints.
"""

from __future__ import annotations
import logging
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from services.nautobot.client import NautobotService
from dependencies import get_nautobot_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["nautobot-statuses"])


@router.get("/statuses", summary="🔶 REST: List All Statuses")
async def get_nautobot_statuses(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """Get all Nautobot statuses."""
    try:
        result = await nautobot_service.rest_request("extras/statuses/")
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch statuses: {str(e)}",
        )


@router.get("/statuses/device", summary="🔶 REST: List Device Statuses")
async def get_nautobot_device_statuses(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """Get Nautobot device statuses."""
    try:
        result = await nautobot_service.rest_request(
            "extras/statuses/?content_types=dcim.device"
        )
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch device statuses: {str(e)}",
        )


@router.get("/statuses/interface", summary="🔶 REST: List Interface Statuses")
async def get_nautobot_interface_statuses(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """Get Nautobot interface statuses."""
    try:
        result = await nautobot_service.rest_request(
            "extras/statuses/?content_types=dcim.interface"
        )
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch interface statuses: {str(e)}",
        )


@router.get("/statuses/ipaddress", summary="🔶 REST: List IP Address Statuses")
async def get_nautobot_ipaddress_statuses(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """Get Nautobot IP address statuses."""
    try:
        result = await nautobot_service.rest_request(
            "extras/statuses/?content_types=ipam.ipaddress"
        )
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch IP address statuses: {str(e)}",
        )


@router.get("/statuses/prefix", summary="🔶 REST: List Prefix Statuses")
async def get_nautobot_prefix_statuses(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """Get Nautobot prefix statuses."""
    try:
        result = await nautobot_service.rest_request(
            "extras/statuses/?content_types=ipam.prefix"
        )
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch prefix statuses: {str(e)}",
        )


@router.get("/statuses/vm", summary="🔶 REST: List Virtual Machine Statuses")
async def get_nautobot_vm_statuses(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """Get Nautobot virtual machine statuses."""
    try:
        result = await nautobot_service.rest_request(
            "extras/statuses/?content_types=virtualization.virtualmachine"
        )
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch VM statuses: {str(e)}",
        )


@router.get("/statuses/combined", summary="🔶 REST: List All Statuses (Combined)")
async def get_nautobot_combined_statuses(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """Get combined Nautobot statuses."""
    try:
        result = await nautobot_service.rest_request("extras/statuses/")
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch combined statuses: {str(e)}",
        )
