"""
Virtual machine manager for Nautobot virtualization operations.

This manager handles lifecycle operations (create/update) for virtual machines.
"""

import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class VirtualMachineManager:
    """Manager for virtual machine lifecycle operations."""

    def __init__(self, nautobot_service):
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
            logger.info(f"    -> IP Address ID: {ip_address_id}")
            logger.info(f"    -> Virtual Interface ID: {virtual_interface_id}")

            # Check if assignment already exists
            check_endpoint = f"ipam/ip-address-to-interface/?ip_address={ip_address_id}&vm_interface={virtual_interface_id}"
            logger.info(f"    -> Checking if assignment already exists...")
            logger.info(f"    -> Check endpoint: {check_endpoint}")

            existing_assignment = await self.nautobot.rest_request(
                endpoint=check_endpoint,
                method="GET",
            )

            if existing_assignment and existing_assignment.get("count", 0) > 0:
                logger.info(f"    -> Assignment already exists, skipping creation")
                logger.info(f"    -> Existing assignment: {existing_assignment['results'][0]}")
                return True

            # Create the IP-to-Interface mapping using vm_interface field
            endpoint = "ipam/ip-address-to-interface/"
            payload = {
                "ip_address": {"id": ip_address_id},
                "vm_interface": {"id": virtual_interface_id},
            }

            logger.info(f"    -> Creating new IP-to-Interface assignment...")
            logger.info(f"    -> Endpoint: {endpoint}")
            logger.info(f"    -> Payload: {payload}")
            logger.info(f"    -> Making POST request to Nautobot...")

            result = await self.nautobot.rest_request(
                endpoint=endpoint,
                method="POST",
                data=payload,
            )

            logger.info(f"    -> POST request successful")
            logger.info(f"    -> Response: {result}")
            logger.info(f"    -> Assignment ID: {result.get('id')}")
            logger.info(f"    -> ✓ Successfully assigned IP to virtual interface")
            return True

        except Exception as e:
            logger.error(f"    -> ✗ Request failed")
            logger.error(f"    -> Error: {str(e)}")
            logger.error(
                f"Failed to assign IP to virtual interface {virtual_interface_id}: {str(e)}"
            )
            raise Exception(f"Failed to assign IP to virtual interface: {str(e)}")

    async def assign_primary_ip_to_vm(
        self, vm_id: str, ip_address_id: str
    ) -> bool:
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
            logger.info(f"    -> VM ID: {vm_id}")
            logger.info(f"    -> IP Address ID: {ip_address_id}")

            endpoint = f"virtualization/virtual-machines/{vm_id}/"
            payload = {"primary_ip4": {"id": ip_address_id}}

            logger.info(f"    -> Endpoint: {endpoint}")
            logger.info(f"    -> Payload: {payload}")
            logger.info(f"    -> Making PATCH request to Nautobot...")

            result = await self.nautobot.rest_request(
                endpoint=endpoint,
                method="PATCH",
                data=payload,
            )

            logger.info(f"    -> PATCH request successful")
            logger.info(f"    -> Response: {result}")
            logger.info(f"    -> ✓ Successfully set primary IPv4 for VM")
            return True

        except Exception as e:
            logger.error(f"    -> ✗ PATCH request failed")
            logger.error(f"    -> Error: {str(e)}")
            logger.error(
                f"Failed to assign primary IPv4 to VM {vm_id}: {str(e)}"
            )
            raise Exception(f"Failed to assign primary IP to VM: {str(e)}")

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
        logger.info(f"    -> VM Name: {name}")
        logger.info(f"    -> Cluster ID: {cluster_id}")
        logger.info(f"    -> Status ID: {status_id}")
        logger.info(f"    -> Role ID: {role_id}")
        logger.info(f"    -> Platform ID: {platform_id}")

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
            logger.info(f"    -> Payload: {vm_data}")
            logger.info(f"    -> Making POST request to virtualization/virtual-machines/")

            # Call Nautobot REST API to create the VM
            result = await self.nautobot.rest_request(
                "virtualization/virtual-machines/", method="POST", data=vm_data
            )

            logger.info(f"    -> POST request successful")
            logger.info(f"    -> Response: {result}")
            logger.info(f"    -> VM ID: {result.get('id')}")
            logger.info(f"    -> ✓ Successfully created VM '{name}'")
            return result

        except Exception as e:
            logger.error(f"    -> ✗ POST request failed")
            logger.error(f"    -> Error: {str(e)}")
            logger.error(f"Failed to create VM '{name}': {e}", exc_info=True)
            raise Exception(f"Failed to create virtual machine: {str(e)}")

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
        logger.info(f"    -> Interface Name: {name}")
        logger.info(f"    -> VM ID: {virtual_machine_id}")
        logger.info(f"    -> Status ID: {status_id}")
        logger.info(f"    -> Enabled: {enabled}")

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
            logger.info(f"    -> Payload: {interface_data}")
            logger.info(f"    -> Making POST request to virtualization/interfaces/")

            # Call Nautobot REST API to create the interface
            result = await self.nautobot.rest_request(
                "virtualization/interfaces/", method="POST", data=interface_data
            )

            logger.info(f"    -> POST request successful")
            logger.info(f"    -> Response: {result}")
            logger.info(f"    -> Interface ID: {result.get('id')}")
            logger.info(f"    -> ✓ Successfully created interface '{name}'")
            return result

        except Exception as e:
            logger.error(f"    -> ✗ POST request failed")
            logger.error(f"    -> Error: {str(e)}")
            logger.error(
                f"Failed to create interface '{name}' for VM {virtual_machine_id}: {e}",
                exc_info=True,
            )
            raise Exception(f"Failed to create virtual interface: {str(e)}")
