"""
Nautobot virtual machine endpoints.

VM creation orchestration lives in
``services.nautobot.virtualization.vm_create_service`` so this router stays thin.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from core.safe_http_errors import raise_internal_server_error
from dependencies import get_audit_log_service, get_nautobot_service
from models.nautobot import AddVirtualMachineRequest, UpdateVirtualMachineRequest
from routers.nautobot.rest_errors import extract_nautobot_error_detail
from services.audit.audit_log_service import AuditLogService
from services.nautobot.client import NautobotService
from services.nautobot.common.exceptions import NautobotAPIError, NautobotNotFoundError
from services.nautobot.managers.vm_manager import VirtualMachineManager
from services.nautobot.virtualization.vm_create_service import (
    VirtualMachineCreateService,
)
from services.nautobot.virtualization.vm_update_service import (
    VirtualMachineUpdateService,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/virtualization", tags=["nautobot-virtualization"])


@router.post(
    "/virtual-machines",
    summary="🔧 REST: Create Virtual Machine",
    status_code=status.HTTP_201_CREATED,
)
async def create_virtual_machine(
    vm_request: AddVirtualMachineRequest,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
    audit_log: AuditLogService = Depends(get_audit_log_service),
):
    """
    Create a new virtual machine in Nautobot with interfaces and IP addresses.

    This endpoint creates a VM and optionally creates virtual interfaces with IP addresses.
    Supports both new interface array format and legacy single interface format.

    **🔧 This endpoint uses REST API** to create the virtual machine.

    **Required Permission:** `nautobot.devices:write`

    **Request Body:**
    - `name`: VM name (required)
    - `status`: Status UUID (required)
    - `cluster`: Cluster UUID (required)
    - `role`: Role UUID (optional)
    - `platform`: Platform UUID (optional)
    - `vcpus`: Number of virtual CPUs (optional)
    - `memory`: Memory in MB (optional)
    - `disk`: Disk size in GB (optional)
    - `softwareVersion`: Software version UUID (optional)
    - `softwareImageFile`: Software image file UUID (optional)
    - `tags`: List of tag UUIDs (optional)
    - `customFieldValues`: Dict of custom field key-value pairs (optional)
    - `interfaces`: List of interface configurations with properties (optional, new format)
    - `interfaceName`: Name for the first interface (optional, legacy format)
    - `primaryIpv4`: Primary IPv4 address (optional, legacy format)

    **Returns:**
    - Created VM object with ID
    - List of created interfaces
    - List of created IP addresses
    - Primary IP assignment status

    **Raises:**
    - `400`: Invalid request data
    - `500`: VM creation failed
    """
    try:
        logger.info("Received VM creation request for '%s'", vm_request.name)

        create_service = VirtualMachineCreateService(nautobot_service)
        response_data = await create_service.create_virtual_machine(vm_request)

        audit_log.log_event(
            username=current_user.get("username") or "unknown",
            user_id=current_user.get("user_id"),
            event_type="nautobot-vm-created",
            message=f"Virtual machine '{vm_request.name}' created in Nautobot",
            resource_type="virtual_machine",
            resource_id=response_data["virtual_machine"].get("id"),
            resource_name=vm_request.name,
            severity="info",
            extra_data={
                "cluster": vm_request.cluster,
                "interfaces_created": len(response_data["interfaces"]),
                "ip_addresses_created": len(response_data["ip_addresses"]),
            },
        )

        return response_data

    except HTTPException:
        raise
    except NautobotAPIError as exc:
        error_msg = extract_nautobot_error_detail(str(exc))
        if "status 400" in str(exc):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_msg,
            ) from exc
        raise_internal_server_error(
            logger,
            "Failed to create virtual machine (Nautobot API error)",
            exc,
            extra={"vm_name": vm_request.name},
        )
    except Exception as e:
        logger.error(
            "Fatal error creating virtual machine %s", vm_request.name, exc_info=True
        )
        raise_internal_server_error(
            logger,
            "Failed to create virtual machine",
            e,
            extra={"vm_name": vm_request.name},
        )


@router.patch(
    "/virtual-machines/{vm_id}",
    summary="🔧 REST: Update Virtual Machine",
)
async def update_virtual_machine(
    vm_id: str,
    vm_request: UpdateVirtualMachineRequest,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
    audit_log: AuditLogService = Depends(get_audit_log_service),
):
    """
    Update an existing virtual machine in Nautobot with optional interface sync.

    **🔧 This endpoint uses REST API** to PATCH the virtual machine and interfaces.

    **Required Permission:** `nautobot.devices:write`

    **Path Parameters:**
    - `vm_id`: UUID of the virtual machine to update

    **Request Body:** All fields optional (see UpdateVirtualMachineRequest).
    Set ``sync_interfaces`` to true (default) to delete VM interfaces not in the list.
    """
    try:
        logger.info("Received VM update request for %s", vm_id)
        update_service = VirtualMachineUpdateService(nautobot_service)
        response_data = await update_service.update_virtual_machine(vm_id, vm_request)

        audit_log.log_event(
            username=current_user.get("username") or "unknown",
            user_id=current_user.get("user_id"),
            event_type="nautobot-vm-updated",
            message="Virtual machine updated in Nautobot",
            resource_type="virtual_machine",
            resource_id=vm_id,
            resource_name=vm_id,
            severity="info",
            extra_data={
                "cluster": vm_request.cluster,
                "sync_interfaces": vm_request.sync_interfaces,
            },
        )

        return response_data

    except HTTPException:
        raise
    except NautobotAPIError as exc:
        error_msg = extract_nautobot_error_detail(str(exc))
        if "status 400" in str(exc):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_msg,
            ) from exc
        raise_internal_server_error(
            logger,
            "Failed to update virtual machine (Nautobot API error)",
            exc,
            extra={"vm_id": vm_id},
        )
    except Exception as e:
        logger.error("Failed to update virtual machine %s: %s", vm_id, e, exc_info=True)
        raise_internal_server_error(
            logger,
            "Failed to update virtual machine",
            e,
            extra={"vm_id": vm_id},
        )


@router.delete(
    "/virtual-machines/{vm_id}",
    summary="🔧 REST: Delete Virtual Machine",
)
async def delete_virtual_machine(
    vm_id: str,
    current_user: dict = Depends(require_permission("nautobot.devices", "delete")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
    audit_log: AuditLogService = Depends(get_audit_log_service),
):
    """
    Delete a virtual machine from Nautobot.

    **🔧 This endpoint uses REST API** to delete the VM and its interfaces.

    **Required Permission:** `nautobot.devices:delete`
    """
    try:
        vm_manager = VirtualMachineManager(nautobot_service)
        await vm_manager.delete_virtual_machine(vm_id)

        audit_log.log_event(
            username=current_user.get("username") or "unknown",
            user_id=current_user.get("user_id"),
            event_type="nautobot-vm-deleted",
            message="Virtual machine deleted from Nautobot",
            resource_type="virtual_machine",
            resource_id=vm_id,
            resource_name=vm_id,
            severity="info",
        )

        return {
            "success": True,
            "message": f"Virtual machine {vm_id} deleted successfully",
            "virtual_machine_id": vm_id,
        }

    except NautobotNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Virtual machine {vm_id} not found",
        )
    except Exception as e:
        logger.error("Failed to delete virtual machine %s: %s", vm_id, e, exc_info=True)
        raise_internal_server_error(
            logger,
            "Failed to delete virtual machine",
            e,
            extra={"vm_id": vm_id},
        )
