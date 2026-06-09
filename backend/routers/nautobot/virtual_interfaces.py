"""
Nautobot virtual interface endpoints.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, status

from core.auth import require_permission
from core.safe_http_errors import raise_internal_server_error
from dependencies import get_nautobot_service
from models.nautobot import AddVirtualInterfaceRequest
from services.nautobot.client import NautobotService
from services.nautobot.managers.vm_manager import VirtualMachineManager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/virtualization", tags=["nautobot-virtualization"])


@router.post(
    "/interfaces",
    summary="🔧 REST: Create Virtual Interface",
    status_code=status.HTTP_201_CREATED,
)
async def create_virtual_interface(
    interface_request: AddVirtualInterfaceRequest,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """
    Create a new virtual interface for a VM in Nautobot.

    **🔧 This endpoint uses REST API** to create the virtual interface.

    **Required Permission:** `nautobot.devices:write`

    **Request Body:**
    - `name`: Interface name (required)
    - `virtual_machine`: VM UUID (required)
    - `status`: Status UUID (required)
    - `enabled`: Whether the interface is enabled (default: True)
    - `mac_address`: MAC address (optional)
    - `mtu`: MTU value (optional)
    - `description`: Description (optional)
    - `mode`: Mode like 'access', 'tagged' (optional)
    - `untagged_vlan`: Untagged VLAN UUID (optional)
    - `tagged_vlans`: List of tagged VLAN UUIDs (optional)
    - `tags`: List of tag UUIDs (optional)

    **Returns:**
    - Created interface object with ID

    **Raises:**
    - `400`: Invalid request data
    - `500`: Interface creation failed
    """
    try:
        logger.info(
            "Creating virtual interface '%s' for VM %s",
            interface_request.name,
            interface_request.virtual_machine,
        )

        # Initialize the VM manager
        vm_manager = VirtualMachineManager(nautobot_service)

        # Create the virtual interface
        result = await vm_manager.create_virtual_interface(
            name=interface_request.name,
            virtual_machine_id=interface_request.virtual_machine,
            status_id=interface_request.status,
            enabled=interface_request.enabled,
            mac_address=interface_request.mac_address,
            mtu=interface_request.mtu,
            description=interface_request.description,
            mode=interface_request.mode,
            untagged_vlan_id=interface_request.untagged_vlan,
            tagged_vlan_ids=interface_request.tagged_vlans,
            tags=interface_request.tags,
        )

        logger.info(
            "Successfully created interface '%s' with ID: %s",
            interface_request.name,
            result.get("id"),
        )
        return result

    except Exception as e:
        raise_internal_server_error(logger, "Failed to create virtual interface: ", e)
