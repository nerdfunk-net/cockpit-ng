"""
Nautobot device taxonomy endpoints: platforms, device types, manufacturers, roles.
"""

from __future__ import annotations
import logging
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from services.nautobot.client import NautobotService
from dependencies import get_nautobot_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["nautobot-taxonomy"])


@router.get("/roles", summary="🔶 REST: List Roles")
async def get_nautobot_roles(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """Get Nautobot device roles.

    **🔶 This endpoint uses REST API** to fetch roles.
    """
    try:
        result = await nautobot_service.rest_request("extras/roles/")
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch roles: {str(e)}",
        )


@router.get("/roles/devices", summary="🔶 REST: List Device Roles")
async def get_nautobot_device_roles(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """Get Nautobot roles specifically for dcim.device content type."""
    try:
        result = await nautobot_service.rest_request(
            "extras/roles/?content_types=dcim.device&limit=0"
        )
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch device roles: {str(e)}",
        )


@router.get("/roles/vm", summary="🔶 REST: List Virtual Machine Roles")
async def get_nautobot_vm_roles(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """Get Nautobot roles specifically for virtualization.virtualmachine content type."""
    try:
        result = await nautobot_service.rest_request(
            "extras/roles/?content_types=virtualization.virtualmachine&limit=0"
        )
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch VM roles: {str(e)}",
        )


@router.get("/roles/prefix", summary="🔶 REST: List Prefix Roles")
async def get_nautobot_prefix_roles(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """Get Nautobot roles specifically for ipam.prefix content type."""
    try:
        result = await nautobot_service.rest_request(
            "extras/roles/?content_types=ipam.prefix&limit=0"
        )
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch prefix roles: {str(e)}",
        )


@router.get("/roles/ipaddress", summary="🔶 REST: List IP Address Roles")
async def get_nautobot_ipaddress_roles(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """Get Nautobot roles specifically for ipam.ipaddress content type."""
    try:
        result = await nautobot_service.rest_request(
            "extras/roles/?content_types=ipam.ipaddress&limit=0"
        )
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch IP address roles: {str(e)}",
        )


@router.get("/platforms", summary="🔶 REST: List Platforms")
async def get_nautobot_platforms(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """Get Nautobot platforms."""
    try:
        result = await nautobot_service.rest_request("dcim/platforms/?limit=0")
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch platforms: {str(e)}",
        )


@router.get("/device-types", summary="🔶 REST: List Device Types")
async def get_nautobot_device_types(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """Get Nautobot device types."""
    try:
        result = await nautobot_service.rest_request("dcim/device-types/?limit=0")
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch device types: {str(e)}",
        )


@router.get("/manufacturers", summary="🔶 REST: List Manufacturers")
async def get_nautobot_manufacturers(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """Get Nautobot manufacturers."""
    try:
        result = await nautobot_service.rest_request("dcim/manufacturers/?limit=0")
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch manufacturers: {str(e)}",
        )
