"""
Interface Management Service for Nautobot Devices.

This service handles creating, updating, and managing interfaces and their IP addresses
for devices in Nautobot. It is designed to be used by DeviceUpdateService and other
services that need to manipulate device interfaces.
"""

from __future__ import annotations

import logging
from typing import Dict, Any, List, Optional, Set

from services.nautobot import NautobotService
from services.nautobot.devices.common import DeviceCommonService
from services.nautobot.devices.types import InterfaceSpec, InterfaceUpdateResult

logger = logging.getLogger(__name__)


class InterfaceManagerService:
    """
    Service for managing device interfaces and IP addresses in Nautobot.

    Handles the complete workflow:
    1. Creating IP addresses in IPAM
    2. Creating or updating interfaces
    3. Assigning IP addresses to interfaces
    4. Setting primary IPv4 addresses
    5. Cleaning up old IP assignments
    """

    def __init__(self, nautobot_service: NautobotService):
        """
        Initialize the interface manager service.

        Args:
            nautobot_service: NautobotService instance for API calls
        """
        self.nautobot = nautobot_service
        self.common = DeviceCommonService(nautobot_service)

    async def update_device_interfaces(
        self,
        device_id: str,
        interfaces: List[Dict[str, Any]],
    ) -> InterfaceUpdateResult:
        """
        Create or update multiple interfaces for a device.

        This method handles:
        1. Creating IP addresses in IPAM
        2. Creating interfaces on the device
        3. Assigning IP addresses to interfaces
        4. Setting primary IPv4 if specified

        Args:
            device_id: Device UUID
            interfaces: List of interface dicts (can be InterfaceSpec or plain dicts)

        Returns:
            InterfaceUpdateResult with operation statistics and warnings
        """
        logger.info(f"Creating/updating {len(interfaces)} interface(s) for device {device_id}")

        created_interfaces = []
        updated_interfaces = []
        failed_interfaces = []
        ip_address_map = {}
        primary_ipv4_id = None
        warnings = []
        cleaned_interfaces: Set[str] = set()

        # Step 1: Create IP addresses first
        ip_address_map = await self._create_ip_addresses(
            interfaces=interfaces,
            warnings=warnings,
        )

        # Step 2: Create or update interfaces
        for interface in interfaces:
            try:
                interface_id = await self._create_or_update_interface(
                    device_id=device_id,
                    interface=interface,
                    warnings=warnings,
                )

                if interface_id:
                    if interface["name"] in updated_interfaces or interface["name"] in created_interfaces:
                        # Already tracked
                        pass
                    else:
                        # Check if it was created or updated
                        # (This will be handled by _create_or_update_interface)
                        pass

                    # Clean existing IP assignments (once per interface)
                    if interface_id not in cleaned_interfaces:
                        await self._clean_interface_ips(
                            interface_id=interface_id,
                            interface_name=interface["name"],
                            warnings=warnings,
                        )
                        cleaned_interfaces.add(interface_id)

                    # Assign new IP address
                    ip_assigned = await self._assign_ip_to_interface(
                        interface=interface,
                        interface_id=interface_id,
                        ip_address_map=ip_address_map,
                        warnings=warnings,
                    )

                    # Track if this should be primary IPv4
                    if ip_assigned:
                        is_ipv4 = interface.get("ip_address") and ":" not in interface["ip_address"]
                        if is_ipv4:
                            if interface.get("is_primary_ipv4"):
                                primary_ipv4_id = ip_assigned
                                logger.info(f"Interface {interface['name']} marked as primary IPv4 (explicit)")
                            elif primary_ipv4_id is None:
                                primary_ipv4_id = ip_assigned
                                logger.info(f"Interface {interface['name']} set as primary IPv4 (first IPv4 found)")

                    # Track success
                    if interface["name"] not in created_interfaces and interface["name"] not in updated_interfaces:
                        created_interfaces.append(interface["name"])

            except Exception as e:
                error_msg = str(e)
                failed_interfaces.append(interface["name"])
                warnings.append(f"Interface {interface['name']}: Failed to process interface: {error_msg}")
                logger.error(f"Error processing interface {interface['name']}: {error_msg}")

        # Step 3: Set primary IPv4 if found
        if primary_ipv4_id:
            await self._set_primary_ipv4(
                device_id=device_id,
                primary_ipv4_id=primary_ipv4_id,
                warnings=warnings,
            )

        return InterfaceUpdateResult(
            interfaces_created=len(created_interfaces),
            interfaces_updated=len(updated_interfaces),
            interfaces_failed=len(failed_interfaces),
            ip_addresses_created=len(ip_address_map),
            primary_ip4_id=primary_ipv4_id,
            warnings=warnings,
        )

    async def _create_ip_addresses(
        self,
        interfaces: List[Dict[str, Any]],
        warnings: List[str],
    ) -> Dict[str, str]:
        """
        Create IP addresses for all interfaces that need them.

        Args:
            interfaces: List of interface specifications
            warnings: List to append warnings to

        Returns:
            Dictionary mapping "interface_name:ip_address" to IP UUID
        """
        ip_address_map = {}

        for interface in interfaces:
            if not interface.get("ip_address"):
                continue

            ip_address = interface["ip_address"]
            namespace = interface.get("namespace", "Global")
            status = interface.get("status", "active")
            ip_role = interface.get("ip_role")

            if not namespace:
                warnings.append(
                    f"Interface {interface['name']}: namespace required for IP {ip_address}, skipping IP creation"
                )
                continue

            try:
                # Resolve status and namespace to UUIDs
                status_id = await self._resolve_status_id(status, "ipam.ipaddress")
                namespace_id = await self._resolve_namespace_id(namespace)

                # Create or get existing IP address
                ip_payload = {
                    "address": ip_address,
                    "status": status_id,
                    "namespace": namespace_id,
                }

                # Add role if specified
                if ip_role:
                    ip_payload["role"] = ip_role
                    logger.info(f"Added role '{ip_role}' to IP payload for {ip_address}")

                try:
                    logger.info(f"Creating IP address {ip_address} for interface {interface['name']}")
                    ip_response = await self.nautobot.rest_request(
                        endpoint="ipam/ip-addresses/",
                        method="POST",
                        data=ip_payload,
                    )
                    if ip_response and "id" in ip_response:
                        map_key = f"{interface['name']}:{ip_address}"
                        ip_address_map[map_key] = ip_response["id"]
                        logger.info(f"Created IP address {ip_address} with ID: {ip_response['id']}")

                except Exception as create_error:
                    # If IP already exists, look it up
                    if "already exists" in str(create_error).lower():
                        ip_id = await self._lookup_existing_ip(
                            ip_address=ip_address,
                            namespace_id=namespace_id,
                            interface_name=interface["name"],
                            warnings=warnings,
                        )
                        if ip_id:
                            map_key = f"{interface['name']}:{ip_address}"
                            ip_address_map[map_key] = ip_id
                    else:
                        warnings.append(
                            f"Interface {interface['name']}: Failed to create IP {ip_address}: {str(create_error)}"
                        )

            except Exception as e:
                warnings.append(
                    f"Interface {interface['name']}: Error processing IP address: {str(e)}"
                )

        return ip_address_map

    async def _create_or_update_interface(
        self,
        device_id: str,
        interface: Dict[str, Any],
        warnings: List[str],
    ) -> Optional[str]:
        """
        Create or update a single interface.

        Args:
            device_id: Device UUID
            interface: Interface specification
            warnings: List to append warnings to

        Returns:
            Interface UUID if successful, None otherwise
        """
        # Resolve status to UUID
        interface_status = interface.get("status", "active")
        interface_status_id = await self._resolve_status_id(interface_status, "dcim.interface")

        interface_payload = {
            "name": interface["name"],
            "device": device_id,
            "type": interface["type"],
            "status": interface_status_id,
        }

        # Add optional properties
        optional_fields = ["enabled", "mgmt_only", "description", "mac_address", "mtu", "mode"]
        for field in optional_fields:
            if field in interface and interface[field] is not None:
                interface_payload[field] = interface[field]

        # Try to create the interface
        try:
            interface_response = await self.nautobot.rest_request(
                endpoint="dcim/interfaces/",
                method="POST",
                data=interface_payload,
            )

            if interface_response and "id" in interface_response:
                interface_id = interface_response["id"]
                logger.info(f"Created interface {interface['name']} with ID: {interface_id}")
                return interface_id

        except Exception as create_error:
            # Check if interface already exists
            if "must make a unique set" in str(create_error).lower():
                interface_id = await self._lookup_existing_interface(
                    device_id=device_id,
                    interface_name=interface["name"],
                    warnings=warnings,
                )
                if interface_id:
                    logger.info(f"Found existing interface {interface['name']} with ID: {interface_id}")
                    return interface_id
            else:
                warnings.append(
                    f"Interface {interface['name']}: Failed to create interface: {str(create_error)}"
                )

        return None

    async def _clean_interface_ips(
        self,
        interface_id: str,
        interface_name: str,
        warnings: List[str],
    ) -> None:
        """
        Remove all existing IP assignments from an interface.

        Args:
            interface_id: Interface UUID
            interface_name: Interface name (for logging)
            warnings: List to append warnings to
        """
        try:
            existing_assignments_endpoint = f"ipam/ip-address-to-interface/?interface={interface_id}&format=json"
            existing_assignments = await self.nautobot.rest_request(
                endpoint=existing_assignments_endpoint,
                method="GET"
            )

            if existing_assignments and existing_assignments.get("count", 0) > 0:
                logger.info(f"Found {existing_assignments['count']} existing IP assignment(s) on interface {interface_name}, removing them...")
                for assignment in existing_assignments.get("results", []):
                    assignment_id = assignment["id"]
                    try:
                        await self.nautobot.rest_request(
                            endpoint=f"ipam/ip-address-to-interface/{assignment_id}/",
                            method="DELETE"
                        )
                        logger.info(f"Unassigned IP assignment {assignment_id} from interface {interface_name}")
                    except Exception as delete_error:
                        warnings.append(
                            f"Interface {interface_name}: Failed to unassign existing IP: {str(delete_error)}"
                        )

        except Exception as e:
            warnings.append(
                f"Interface {interface_name}: Failed to check existing IP assignments: {str(e)}"
            )

    async def _assign_ip_to_interface(
        self,
        interface: Dict[str, Any],
        interface_id: str,
        ip_address_map: Dict[str, str],
        warnings: List[str],
    ) -> Optional[str]:
        """
        Assign an IP address to an interface.

        Args:
            interface: Interface specification
            interface_id: Interface UUID
            ip_address_map: Map of interface:ip to IP UUIDs
            warnings: List to append warnings to

        Returns:
            IP UUID if successfully assigned, None otherwise
        """
        ip_address = interface.get("ip_address")
        if not ip_address:
            return None

        map_key = f"{interface['name']}:{ip_address}"
        if map_key not in ip_address_map:
            logger.warning(f"IP address not found in map for key '{map_key}'")
            return None

        ip_id = ip_address_map[map_key]
        logger.info(f"Attempting to assign IP {ip_address} (ID: {ip_id}) to interface {interface['name']}")

        try:
            # Check if assignment already exists
            check_assignment_endpoint = f"ipam/ip-address-to-interface/?ip_address={ip_id}&interface={interface_id}&format=json"
            existing_assignment = await self.nautobot.rest_request(
                endpoint=check_assignment_endpoint,
                method="GET"
            )

            if existing_assignment and existing_assignment.get("count", 0) > 0:
                logger.info(f"IP-to-Interface assignment already exists for IP {ip_id} and interface {interface['name']}")
            else:
                # Create new assignment
                assignment_payload = {
                    "ip_address": ip_id,
                    "interface": interface_id,
                }
                await self.nautobot.rest_request(
                    endpoint="ipam/ip-address-to-interface/",
                    method="POST",
                    data=assignment_payload,
                )
                logger.info(f"Created new IP-to-Interface assignment: IP {ip_id} → interface {interface['name']}")

            return ip_id

        except Exception as e:
            warnings.append(
                f"Interface {interface['name']}: Failed to assign IP address: {str(e)}"
            )
            return None

    async def _set_primary_ipv4(
        self,
        device_id: str,
        primary_ipv4_id: str,
        warnings: List[str],
    ) -> None:
        """
        Set the primary IPv4 address for a device.

        Args:
            device_id: Device UUID
            primary_ipv4_id: IP address UUID to set as primary
            warnings: List to append warnings to
        """
        try:
            update_payload = {"primary_ip4": primary_ipv4_id}
            await self.nautobot.rest_request(
                endpoint=f"dcim/devices/{device_id}/",
                method="PATCH",
                data=update_payload,
            )
            logger.info(f"Set primary IPv4 to {primary_ipv4_id}")
        except Exception as e:
            warnings.append(f"Failed to set primary IPv4: {str(e)}")

    async def _lookup_existing_ip(
        self,
        ip_address: str,
        namespace_id: str,
        interface_name: str,
        warnings: List[str],
    ) -> Optional[str]:
        """
        Look up an existing IP address by address and namespace.

        Args:
            ip_address: IP address string
            namespace_id: Namespace UUID
            interface_name: Interface name (for logging)
            warnings: List to append warnings to

        Returns:
            IP UUID if found, None otherwise
        """
        logger.info(f"IP address {ip_address} already exists, looking it up...")

        try:
            query = """
            query GetIPAddress($filter: [String], $namespace: [String]) {
              ip_addresses(address: $filter, namespace: $namespace) {
                id
                address
              }
            }
            """
            variables = {
                "filter": [ip_address],
                "namespace": [namespace_id],
            }

            result = await self.nautobot.graphql_query(query, variables)

            if result and "data" in result and "ip_addresses" in result["data"]:
                ip_addresses = result["data"]["ip_addresses"]
                if ip_addresses and len(ip_addresses) > 0:
                    existing_ip = ip_addresses[0]
                    ip_id = existing_ip["id"]
                    logger.info(f"Found existing IP address {ip_address} with ID: {ip_id}")
                    return ip_id
                else:
                    warnings.append(
                        f"Interface {interface_name}: IP {ip_address} exists but could not be found"
                    )
            return None

        except Exception as lookup_error:
            warnings.append(
                f"Interface {interface_name}: Failed to lookup existing IP {ip_address}: {str(lookup_error)}"
            )
            return None

    async def _lookup_existing_interface(
        self,
        device_id: str,
        interface_name: str,
        warnings: List[str],
    ) -> Optional[str]:
        """
        Look up an existing interface by device and name.

        Args:
            device_id: Device UUID
            interface_name: Interface name
            warnings: List to append warnings to

        Returns:
            Interface UUID if found, None otherwise
        """
        logger.info(f"Interface {interface_name} already exists, looking it up...")

        try:
            query = """
            query GetInterface($device: [String], $name: [String]) {
              interfaces(device_id: $device, name: $name) {
                id
                name
              }
            }
            """
            variables = {
                "device": [device_id],
                "name": [interface_name],
            }

            result = await self.nautobot.graphql_query(query, variables)

            if result and "data" in result and "interfaces" in result["data"]:
                interfaces_list = result["data"]["interfaces"]
                if interfaces_list and len(interfaces_list) > 0:
                    existing_interface = interfaces_list[0]
                    interface_id = existing_interface["id"]
                    logger.info(f"Found existing interface {interface_name} with ID: {interface_id}")
                    return interface_id
                else:
                    warnings.append(
                        f"Interface {interface_name}: Interface exists but could not be found via GraphQL"
                    )
            return None

        except Exception as lookup_error:
            warnings.append(
                f"Interface {interface_name}: Failed to lookup existing interface: {str(lookup_error)}"
            )
            return None

    async def _resolve_status_id(self, status: str, content_type: str) -> str:
        """
        Resolve a status name to UUID if needed.

        Args:
            status: Status name or UUID
            content_type: Content type for status resolution

        Returns:
            Status UUID
        """
        if not self.common._is_valid_uuid(status):
            return await self.common.resolve_status_id(status, content_type)
        return status

    async def _resolve_namespace_id(self, namespace: str) -> str:
        """
        Resolve a namespace name to UUID if needed.

        Args:
            namespace: Namespace name or UUID

        Returns:
            Namespace UUID
        """
        if not self.common._is_valid_uuid(namespace):
            return await self.common.resolve_namespace_id(namespace)
        return namespace
