"""
Nautobot tag and custom field endpoints.
"""

from __future__ import annotations
import logging
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from services.nautobot.client import NautobotService
from dependencies import get_nautobot_service, get_nautobot_metadata_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["nautobot-tags"])


@router.get("/tags", summary="🔶 REST: List Tags")
async def get_nautobot_tags(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """Get Nautobot tags."""
    try:
        result = await nautobot_service.rest_request("extras/tags/?limit=0")
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch tags: {str(e)}",
        )


@router.get("/tags/devices", summary="🔶 REST: List Device Tags")
async def get_nautobot_device_tags(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """Get Nautobot tags specifically for dcim.device content type."""
    try:
        result = await nautobot_service.rest_request(
            "extras/tags/?content_types=dcim.device"
        )
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch device tags: {str(e)}",
        )


@router.get("/tags/vm", summary="🔶 REST: List Virtual Machine Tags")
async def get_nautobot_vm_tags(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """Get Nautobot tags specifically for virtualization.virtualmachine content type."""
    try:
        result = await nautobot_service.rest_request(
            "extras/tags/?content_types=virtualization.virtualmachine"
        )
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch VM tags: {str(e)}",
        )


@router.get("/tags/ip-addresses", summary="🔶 REST: List IP Address Tags")
async def get_nautobot_ip_address_tags(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """Get Nautobot tags specifically for ipam.ipaddress content type."""
    try:
        result = await nautobot_service.rest_request(
            "extras/tags/?content_types=ipam.ipaddress"
        )
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch IP address tags: {str(e)}",
        )


@router.get("/custom-fields/devices", summary="🔶 REST: List Device Custom Fields")
async def get_nautobot_device_custom_fields(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
    nautobot_metadata_service=Depends(get_nautobot_metadata_service),
):
    """Get Nautobot custom fields specifically for dcim.device content type."""
    try:
        return await nautobot_metadata_service.get_device_custom_fields()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch device custom fields: {str(e)}",
        )


@router.get("/custom-fields/prefixes", summary="🔶 REST: List Prefix Custom Fields")
async def get_nautobot_prefix_custom_fields(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
    nautobot_metadata_service=Depends(get_nautobot_metadata_service),
):
    """Get Nautobot custom fields specifically for ipam.prefix content type."""
    try:
        return await nautobot_metadata_service.get_prefix_custom_fields()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch prefix custom fields: {str(e)}",
        )


@router.get("/custom-fields/vm", summary="🔶 REST: List VM Custom Fields")
async def get_nautobot_vm_custom_fields(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
    nautobot_metadata_service=Depends(get_nautobot_metadata_service),
):
    """Get Nautobot custom fields specifically for virtualization.virtualmachine content type."""
    try:
        return await nautobot_metadata_service.get_vm_custom_fields()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch VM custom fields: {str(e)}",
        )


@router.get("/custom-field-choices/{custom_field_name}")
async def get_nautobot_custom_field_choices(
    custom_field_name: str,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
    nautobot_metadata_service=Depends(get_nautobot_metadata_service),
):
    """Get Nautobot custom field choices for a specific custom field."""
    try:
        return await nautobot_metadata_service.get_custom_field_choices(
            custom_field_name
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch custom field choices for {custom_field_name}: {str(e)}",
        )
