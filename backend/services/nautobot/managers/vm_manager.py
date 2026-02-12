"""
Virtual machine manager for Nautobot virtualization operations.

This manager handles lifecycle operations (create/update) for virtual machines.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Dict, Any, Optional

from ..common.exceptions import NautobotAPIError

if TYPE_CHECKING:
    from services.nautobot import NautobotService

logger = logging.getLogger(__name__)


class VirtualMachineManager:
    """Manager for virtual machine lifecycle operations."""

    def __init__(self, nautobot_service: NautobotService):
        """
        Initialize the VM manager.

        Args:
            nautobot_service: NautobotService instance for API calls
        """
        self.nautobot = nautobot_service

    async def assign_ip_to_virtual_interface(
        self, ip_address_id: str, virtual_interface_id: str
    ) -> bool:
        """
        Assign an IP address to a virtual interface.

        Uses the IP-to-Interface mapping endpoint with the vm_interface field.

        Args:
            ip_address_id: IP address UUID
            virtual_interface_id: Virtual interface UUID

        Returns:
            True if successful, False otherwise

        Raises:
            Exception: If assignment fails
        """
        try:
            logger.info("    -> Entering assign_ip_to_virtual_interface")
            logger.info("    -> IP Address ID: %s", ip_address_id)
            logger.info("    -> Virtual Interface ID: %s", virtual_interface_id)

            # Check if assignment already exists
            check_endpoint = (
                "ipam/ip-address-to-interface/?ip_address=%s&vm_interface=%s"
                % (ip_address_id, virtual_interface_id)
            )
            logger.info("    -> Checking if assignment already exists...")
            logger.info("    -> Check endpoint: %s", check_endpoint)

            existing_assignment = await self.nautobot.rest_request(
                endpoint=check_endpoint,
                method="GET",
            )

            if existing_assignment and existing_assignment.get("count", 0) > 0:
                logger.info("    -> Assignment already exists, skipping creation")
                logger.info(
                    "    -> Existing assignment: %s", existing_assignment["results"][0]
                )
                return True

            # Create the IP-to-Interface mapping using vm_interface field
            endpoint = "ipam/ip-address-to-interface/"
            payload = {
                "ip_address": {"id": ip_address_id},
                "vm_interface": {"id": virtual_interface_id},
            }

            logger.info("    -> Creating new IP-to-Interface assignment...")
            logger.info("    -> Endpoint: %s", endpoint)
            logger.info("    -> Payload: %s", payload)
            logger.info("    -> Making POST request to Nautobot...")

            result = await self.nautobot.rest_request(
                endpoint=endpoint,
                method="POST",
                data=payload,
            )

            logger.info("    -> POST request successful")
            logger.info("    -> Response: %s", result)
            logger.info("    -> Assignment ID: %s", result.get("id"))
            logger.info("    -> ✓ Successfully assigned IP to virtual interface")
            return True

        except Exception as e:
            logger.error("    -> ✗ Request failed")
            logger.error("    -> Error: %s", str(e))
            logger.error(
                "Failed to assign IP to virtual interface %s: %s",
                virtual_interface_id,
                str(e),
            )
            raise NautobotAPIError(
                f"Failed to assign IP to virtual interface: {str(e)}"
            )

    async def assign_primary_ip_to_vm(self, vm_id: str, ip_address_id: str) -> bool:
        """
        Assign primary IPv4 address to a virtual machine.

        Args:
            vm_id: Virtual machine UUID
            ip_address_id: IP address UUID to set as primary

        Returns:
            True if successful, False otherwise

        Raises:
            Exception: If assignment fails
        """
        try:
            logger.info("    -> Entering assign_primary_ip_to_vm")
            logger.info("    -> VM ID: %s", vm_id)
            logger.info("    -> IP Address ID: %s", ip_address_id)

            endpoint = "virtualization/virtual-machines/%s/" % vm_id
            payload = {"primary_ip4": {"id": ip_address_id}}

            logger.info("    -> Endpoint: %s", endpoint)
            logger.info("    -> Payload: %s", payload)
            logger.info("    -> Making PATCH request to Nautobot...")

            result = await self.nautobot.rest_request(
                endpoint=endpoint,
                method="PATCH",
                data=payload,
            )

            logger.info("    -> PATCH request successful")
            logger.info("    -> Response: %s", result)
            logger.info("    -> ✓ Successfully set primary IPv4 for VM")
            return True

        except Exception as e:
            logger.error("    -> ✗ PATCH request failed")
            logger.error("    -> Error: %s", str(e))
            logger.error("Failed to assign primary IPv4 to VM %s: %s", vm_id, str(e))
            raise NautobotAPIError(f"Failed to assign primary IP to VM: {str(e)}")

    async def create_virtual_machine(
        self,
        name: str,
        cluster_id: str,
        status_id: str,
        role_id: Optional[str] = None,
        platform_id: Optional[str] = None,
        vcpus: Optional[int] = None,
        memory: Optional[int] = None,
        disk: Optional[int] = None,
        software_version_id: Optional[str] = None,
        software_image_file_ids: Optional[list[str]] = None,
        tags: Optional[list[str]] = None,
    ) -> Dict[str, Any]:
        """
        Create a virtual machine in Nautobot using the REST API.

        Args:
            name: VM name
            cluster_id: UUID of the cluster
            status_id: UUID of the status
            role_id: Optional UUID of the role
            platform_id: Optional UUID of the platform
            vcpus: Optional number of virtual CPUs
            memory: Optional memory in MB
            disk: Optional disk size in GB
            software_version_id: Optional UUID of software version
            software_image_file_ids: Optional list of software image file UUIDs
            tags: Optional list of tag UUIDs

        Returns:
            Dict containing the created VM data with 'id' field

        Raises:
            Exception: If VM creation fails
        """
        logger.info("    -> Entering create_virtual_machine")
        logger.info("    -> VM Name: %s", name)
        logger.info("    -> Cluster ID: %s", cluster_id)
        logger.info("    -> Status ID: %s", status_id)
        logger.info("    -> Role ID: %s", role_id)
        logger.info("    -> Platform ID: %s", platform_id)

        # Build the VM data payload according to Nautobot's REST API schema
        vm_data: Dict[str, Any] = {
            "name": name,
            "cluster": {"id": cluster_id},
            "status": {"id": status_id},
        }

        # Add optional fields only if provided
        if role_id:
            vm_data["role"] = {"id": role_id}

        if platform_id:
            vm_data["platform"] = {"id": platform_id}

        if vcpus is not None:
            vm_data["vcpus"] = vcpus

        if memory is not None:
            vm_data["memory"] = memory

        if disk is not None:
            vm_data["disk"] = disk

        if software_version_id:
            vm_data["software_version"] = {"id": software_version_id}

        if software_image_file_ids:
            vm_data["software_image_files"] = [
                {"id": img_id} for img_id in software_image_file_ids
            ]

        if tags:
            vm_data["tags"] = [{"id": tag_id} for tag_id in tags]

        try:
            logger.info("    -> Payload: %s", vm_data)
            logger.info(
                "    -> Making POST request to virtualization/virtual-machines/"
            )

            # Call Nautobot REST API to create the VM
            result = await self.nautobot.rest_request(
                "virtualization/virtual-machines/", method="POST", data=vm_data
            )

            logger.info("    -> POST request successful")
            logger.info("    -> Response: %s", result)
            logger.info("    -> VM ID: %s", result.get("id"))
            logger.info("    -> ✓ Successfully created VM '%s'", name)
            return result

        except Exception as e:
            logger.error("    -> ✗ POST request failed")
            logger.error("    -> Error: %s", str(e))
            logger.error("Failed to create VM '%s': %s", name, e, exc_info=True)
            raise NautobotAPIError(f"Failed to create virtual machine: {str(e)}")

    async def create_virtual_interface(
        self,
        name: str,
        virtual_machine_id: str,
        status_id: str,
        enabled: bool = True,
        mac_address: Optional[str] = None,
        mtu: Optional[int] = None,
        description: Optional[str] = None,
        mode: Optional[str] = None,
        untagged_vlan_id: Optional[str] = None,
        tagged_vlan_ids: Optional[list[str]] = None,
        tags: Optional[list[str]] = None,
    ) -> Dict[str, Any]:
        """
        Create a virtual interface for a VM in Nautobot using the REST API.

        Args:
            name: Interface name
            virtual_machine_id: UUID of the VM
            status_id: UUID of the interface status
            enabled: Whether the interface is enabled (default: True)
            mac_address: Optional MAC address
            mtu: Optional MTU value
            description: Optional description
            mode: Optional mode ('access', 'tagged', etc.)
            untagged_vlan_id: Optional UUID of untagged VLAN
            tagged_vlan_ids: Optional list of tagged VLAN UUIDs
            tags: Optional list of tag UUIDs

        Returns:
            Dict containing the created interface data with 'id' field

        Raises:
            Exception: If interface creation fails
        """
        logger.info("    -> Entering create_virtual_interface")
        logger.info("    -> Interface Name: %s", name)
        logger.info("    -> VM ID: %s", virtual_machine_id)
        logger.info("    -> Status ID: %s", status_id)
        logger.info("    -> Enabled: %s", enabled)

        # Build the interface data payload according to Nautobot's REST API schema
        interface_data: Dict[str, Any] = {
            "name": name,
            "virtual_machine": {"id": virtual_machine_id},
            "status": {"id": status_id},
            "enabled": enabled,
        }

        # Add optional fields only if provided
        if mac_address:
            interface_data["mac_address"] = mac_address

        if mtu is not None:
            interface_data["mtu"] = mtu

        if description:
            interface_data["description"] = description

        if mode:
            interface_data["mode"] = mode

        if untagged_vlan_id:
            interface_data["untagged_vlan"] = {"id": untagged_vlan_id}

        if tagged_vlan_ids:
            interface_data["tagged_vlans"] = [
                {"id": vlan_id} for vlan_id in tagged_vlan_ids
            ]

        if tags:
            interface_data["tags"] = [{"id": tag_id} for tag_id in tags]

        try:
            logger.info("    -> Payload: %s", interface_data)
            logger.info("    -> Making POST request to virtualization/interfaces/")

            # Call Nautobot REST API to create the interface
            result = await self.nautobot.rest_request(
                "virtualization/interfaces/", method="POST", data=interface_data
            )

            logger.info("    -> POST request successful")
            logger.info("    -> Response: %s", result)
            logger.info("    -> Interface ID: %s", result.get("id"))
            logger.info("    -> ✓ Successfully created interface '%s'", name)
            return result

        except Exception as e:
            logger.error("    -> ✗ POST request failed")
            logger.error("    -> Error: %s", str(e))
            logger.error(
                "Failed to create interface '%s' for VM %s: %s",
                name,
                virtual_machine_id,
                e,
                exc_info=True,
            )
            raise NautobotAPIError(f"Failed to create virtual interface: {str(e)}")
