"""
Virtual machine update service for Nautobot.

Orchestrates VM property updates and interface synchronization.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

from models.nautobot import InterfaceData, UpdateVirtualMachineRequest
from services.nautobot import NautobotService
from services.nautobot.managers.vm_manager import VirtualMachineManager
from services.nautobot.virtualization.vm_interface_workflow import (
    VirtualMachineInterfaceWorkflow,
)

logger = logging.getLogger(__name__)


class VirtualMachineUpdateService:
    """Update virtual machines and their interfaces in Nautobot."""

    def __init__(self, nautobot_service: NautobotService):
        self.nautobot = nautobot_service
        self.vm_manager = VirtualMachineManager(nautobot_service)
        self.interface_workflow = VirtualMachineInterfaceWorkflow(nautobot_service)

    async def update_virtual_machine(
        self,
        vm_id: str,
        request: UpdateVirtualMachineRequest,
    ) -> Dict[str, Any]:
        """
        Update a VM and optionally sync its interfaces.

        Returns a response dict aligned with the VM create endpoint.
        """
        warnings: List[str] = []
        response_data: Dict[str, Any] = {
            "virtual_machine": None,
            "interfaces": [],
            "ip_addresses": [],
            "primary_ip": None,
            "warnings": warnings,
            "message": "Virtual machine updated successfully",
        }

        software_image_file_ids = None
        if request.softwareImageFile:
            software_image_file_ids = [request.softwareImageFile]

        vm_fields = {
            "cluster_id": request.cluster,
            "status_id": request.status,
            "role_id": request.role,
            "platform_id": request.platform,
            "vcpus": request.vcpus,
            "memory": request.memory,
            "disk": request.disk,
            "software_version_id": request.softwareVersion,
            "software_image_file_ids": software_image_file_ids,
            "tags": request.tags,
            "custom_fields": request.customFieldValues,
        }
        has_vm_fields = any(v is not None for v in vm_fields.values())

        if has_vm_fields:
            vm_result = await self.vm_manager.update_virtual_machine(vm_id, **vm_fields)
            response_data["virtual_machine"] = vm_result
        else:
            response_data["virtual_machine"] = {"id": vm_id}

        if request.interfaces is not None:
            interface_dicts = [
                iface.model_dump() if isinstance(iface, InterfaceData) else iface
                for iface in request.interfaces
            ]
            iface_result = await self.interface_workflow.sync_vm_interfaces(
                vm_id=vm_id,
                interfaces=interface_dicts,
                sync_interfaces=request.sync_interfaces,
                add_prefixes_automatically=True,
            )
            warnings.extend(iface_result.warnings)
            response_data["primary_ip"] = iface_result.primary_ip4_id

            if iface_result.interfaces_created:
                response_data["message"] += (
                    f" ({iface_result.interfaces_created} interface(s) created)"
                )
            if iface_result.interfaces_updated:
                response_data["message"] += (
                    f" ({iface_result.interfaces_updated} interface(s) updated)"
                )
            if iface_result.interfaces_deleted:
                response_data["message"] += (
                    f" ({iface_result.interfaces_deleted} interface(s) deleted)"
                )

        response_data["warnings"] = warnings
        return response_data
