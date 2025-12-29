"""
Device creation service for Nautobot.

Handles the orchestrated workflow for creating devices with interfaces.
"""

import logging
import ipaddress
from typing import Optional
from models.nautobot import AddDeviceRequest
from services.nautobot import nautobot_service
from services.device_common_service import DeviceCommonService

logger = logging.getLogger(__name__)


class DeviceCreationService:
    """Service for creating devices in Nautobot with a multi-step workflow."""

    def __init__(self):
        """Initialize the service."""
        self.common_service = DeviceCommonService(nautobot_service)

    async def create_device_with_interfaces(self, request: AddDeviceRequest) -> dict:
        """
        Orchestrated workflow to add a device with interfaces to Nautobot.

        Workflow:
        1. Create device in Nautobot DCIM
        2. Create IP addresses for all interfaces (if specified)
        3. Create interfaces and assign IP addresses
        4. Assign primary IPv4 address to device

        Args:
            request: AddDeviceRequest with device and interface data

        Returns:
            dict with success status, device_id, workflow_status, and summary
        """
        logger.info(f"Starting add-device workflow for: {request.name}")

        # Initialize workflow status tracking
        workflow_status = {
            "step1_device": {"status": "pending", "message": "", "data": None},
            "step2_ip_addresses": {
                "status": "pending",
                "message": "",
                "data": [],
                "errors": [],
            },
            "step3_interfaces": {
                "status": "pending",
                "message": "",
                "data": [],
                "errors": [],
            },
            "step4_primary_ip": {"status": "pending", "message": "", "data": None},
        }

        # Log incoming request data
        self._log_request_data(request)

        # Step 1: Create device
        device_id, device_response = await self._step1_create_device(
            request, workflow_status
        )

        # Step 1.5: Create prefixes if needed
        if request.add_prefix:
            await self._step1_5_create_prefixes(request, workflow_status)

        # Step 2: Create IP addresses
        ip_address_map = await self._step2_create_ip_addresses(request, workflow_status)

        # Step 3: Create interfaces and assign IPs
        created_interfaces, primary_ipv4_id = await self._step3_create_interfaces(
            request, device_id, ip_address_map, workflow_status
        )

        # Step 4: Assign primary IPv4
        await self._step4_assign_primary_ip(device_id, primary_ipv4_id, workflow_status)

        # Determine overall success
        overall_success = workflow_status["step1_device"][
            "status"
        ] == "success" and workflow_status["step3_interfaces"]["status"] in [
            "success",
            "partial",
        ]

        return {
            "success": overall_success,
            "message": f"Device '{request.name}' workflow completed",
            "device_id": device_id,
            "device": device_response,
            "workflow_status": workflow_status,
            "summary": {
                "device_created": workflow_status["step1_device"]["status"]
                == "success",
                "interfaces_created": len(created_interfaces),
                "interfaces_failed": len(workflow_status["step3_interfaces"]["errors"]),
                "ip_addresses_created": len(ip_address_map),
                "ip_addresses_failed": len(
                    workflow_status["step2_ip_addresses"]["errors"]
                ),
                "primary_ipv4_assigned": primary_ipv4_id is not None,
            },
        }

    def _log_request_data(self, request: AddDeviceRequest) -> None:
        """Log incoming request data for debugging."""
        logger.info("=== ADD DEVICE DEBUG ===")
        logger.info(f"Device name: {request.name}")
        logger.info(f"Device type: {request.device_type}")
        logger.info(f"Role: {request.role}")
        logger.info(f"Location: {request.location}")
        logger.info(f"Status: {request.status}")
        logger.info(f"Platform: {request.platform}")
        logger.info(f"Software version: {request.software_version}")
        logger.info(f"Serial: {request.serial}")
        logger.info(f"Asset tag: {request.asset_tag}")
        logger.info(f"Tags: {request.tags}")
        logger.info(f"Custom fields: {request.custom_fields}")
        logger.info(f"Interfaces count: {len(request.interfaces)}")
        for i, iface in enumerate(request.interfaces):
            logger.info(
                f"  Interface {i + 1}: name={iface.name}, type={iface.type}, "
                f"ip={iface.ip_address}, is_primary={iface.is_primary_ipv4}"
            )

    async def _step1_create_device(
        self, request: AddDeviceRequest, workflow_status: dict
    ) -> tuple[str, dict]:
        """
        Step 1: Create device in Nautobot DCIM.

        Returns:
            tuple of (device_id, device_response)

        Raises:
            Exception if device creation fails
        """
        logger.info("Step 1: Creating device in Nautobot DCIM")
        workflow_status["step1_device"]["status"] = "in_progress"

        device_payload = {
            "name": request.name,
            "device_type": request.device_type,
            "role": request.role,
            "location": request.location,
            "status": request.status,
        }

        # Add optional fields if provided
        if request.platform:
            device_payload["platform"] = request.platform
        if request.software_version:
            device_payload["software_version"] = request.software_version
        if request.serial:
            device_payload["serial"] = request.serial
        if request.asset_tag:
            device_payload["asset_tag"] = request.asset_tag
        if request.tags:
            device_payload["tags"] = request.tags
        if request.custom_fields:
            device_payload["custom_fields"] = request.custom_fields

        logger.info(f"Device payload: {device_payload}")

        device_response = await nautobot_service.rest_request(
            endpoint="dcim/devices/", method="POST", data=device_payload
        )

        if not device_response or "id" not in device_response:
            workflow_status["step1_device"]["status"] = "failed"
            workflow_status["step1_device"]["message"] = (
                "Failed to create device: No device ID returned"
            )
            raise Exception("Failed to create device: No device ID returned")

        device_id = device_response["id"]
        workflow_status["step1_device"]["status"] = "success"
        workflow_status["step1_device"]["message"] = (
            f"Device '{request.name}' created successfully"
        )
        workflow_status["step1_device"]["data"] = {
            "id": device_id,
            "name": request.name,
        }
        logger.info(f"Device created with ID: {device_id}")

        return device_id, device_response

    async def _step1_5_create_prefixes(
        self, request: AddDeviceRequest, workflow_status: dict
    ) -> None:
        """
        Step 1.5: Create parent prefixes for IP addresses if they don't exist.

        For each interface with an IP address:
        - If IP has CIDR notation (e.g., 192.168.100.100/24), calculate network prefix
        - If IP has no CIDR notation, append default_prefix_length and calculate
        - Create prefix using ensure_prefix_exists from common service
        """
        logger.info("Step 1.5: Creating parent prefixes for IP addresses")

        interfaces_with_ips = [
            iface for iface in request.interfaces if iface.ip_address
        ]

        if not interfaces_with_ips:
            logger.info("No IP addresses to create prefixes for")
            return

        prefixes_created = set()  # Track created prefixes to avoid duplicates

        for interface in interfaces_with_ips:
            try:
                ip_str = interface.ip_address.strip()
                namespace = interface.namespace or "Global"

                # Determine if IP has CIDR notation
                if "/" in ip_str:
                    # IP has CIDR notation (e.g., "192.168.100.100/24")
                    ip_with_cidr = ip_str
                else:
                    # IP has no CIDR notation, append default prefix length
                    ip_with_cidr = f"{ip_str}{request.default_prefix_length}"
                    logger.info(
                        f"Appending default prefix length {request.default_prefix_length} to {ip_str}"
                    )

                # Parse IP address and calculate network prefix
                try:
                    ip_network = ipaddress.ip_network(ip_with_cidr, strict=False)
                    prefix_str = str(ip_network)
                    logger.info(
                        f"Calculated prefix for {ip_with_cidr}: {prefix_str}"
                    )
                except ValueError as e:
                    logger.error(
                        f"Invalid IP address format for {ip_with_cidr}: {e}"
                    )
                    continue

                # Create unique key for prefix+namespace to avoid duplicates
                prefix_key = f"{prefix_str}|{namespace}"
                if prefix_key in prefixes_created:
                    logger.info(
                        f"Prefix {prefix_str} in namespace {namespace} already processed, skipping"
                    )
                    continue

                # Create prefix using common service
                # Note: We don't set location for auto-created prefixes because
                # Nautobot has restrictions on which location types can be used with prefixes
                logger.info(
                    f"Ensuring prefix exists: {prefix_str} in namespace {namespace}"
                )
                prefix_id = await self.common_service.ensure_prefix_exists(
                    prefix=prefix_str,
                    namespace=namespace,
                    status="active",
                    prefix_type="network",
                    description=f"Auto-created for device {request.name}",
                )
                logger.info(
                    f"Prefix {prefix_str} exists with ID: {prefix_id}"
                )
                prefixes_created.add(prefix_key)

            except Exception as e:
                logger.error(
                    f"Error creating prefix for interface {interface.name} with IP {interface.ip_address}: {e}"
                )
                # Continue with other interfaces - prefix creation failures shouldn't stop device creation
                continue

        logger.info(
            f"Completed prefix creation step. Created/verified {len(prefixes_created)} unique prefix(es)"
        )

    async def _step2_create_ip_addresses(
        self, request: AddDeviceRequest, workflow_status: dict
    ) -> dict[str, str]:
        """
        Step 2: Create IP addresses for all interfaces.

        Returns:
            dict mapping interface name to IP address ID
        """
        logger.info("Step 2: Creating IP addresses")
        workflow_status["step2_ip_addresses"]["status"] = "in_progress"
        ip_address_map = {}

        interfaces_with_ips = [
            iface for iface in request.interfaces if iface.ip_address
        ]

        if not interfaces_with_ips:
            workflow_status["step2_ip_addresses"]["status"] = "skipped"
            workflow_status["step2_ip_addresses"]["message"] = (
                "No IP addresses to create"
            )
            return ip_address_map

        for interface in interfaces_with_ips:
            try:
                if not interface.namespace:
                    workflow_status["step2_ip_addresses"]["errors"].append(
                        {
                            "interface": interface.name,
                            "ip_address": interface.ip_address,
                            "error": "Namespace is required for all IP addresses",
                        }
                    )
                    logger.error(
                        f"Missing namespace for IP address {interface.ip_address} "
                        f"on interface {interface.name}"
                    )
                    continue

                ip_payload = {
                    "address": interface.ip_address,
                    "status": interface.status,
                    "namespace": interface.namespace,
                }

                try:
                    ip_response = await nautobot_service.rest_request(
                        endpoint="ipam/ip-addresses/", method="POST", data=ip_payload
                    )

                    if ip_response and "id" in ip_response:
                        ip_address_map[interface.name] = ip_response["id"]
                        workflow_status["step2_ip_addresses"]["data"].append(
                            {
                                "interface": interface.name,
                                "ip_address": interface.ip_address,
                                "id": ip_response["id"],
                                "status": "success",
                            }
                        )
                        logger.info(
                            f"Created IP address {interface.ip_address} with ID: {ip_response['id']}"
                        )
                    else:
                        workflow_status["step2_ip_addresses"]["errors"].append(
                            {
                                "interface": interface.name,
                                "ip_address": interface.ip_address,
                                "error": "No IP ID returned from Nautobot",
                            }
                        )
                        logger.warning(
                            f"Failed to create IP address {interface.ip_address} "
                            f"for interface {interface.name}"
                        )

                except Exception as create_error:
                    error_msg = str(create_error)

                    # Check if this is an "already exists" error
                    if "already exists" in error_msg.lower():
                        logger.info(
                            f"IP address {interface.ip_address} already exists in IPAM, looking it up..."
                        )

                        # Try to find the existing IP address using GraphQL
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
                                "filter": [interface.ip_address],
                                "namespace": [interface.namespace],
                            }

                            result = await nautobot_service.graphql_query(
                                query, variables
                            )

                            if (
                                result
                                and "data" in result
                                and "ip_addresses" in result["data"]
                            ):
                                ip_addresses = result["data"]["ip_addresses"]
                                if ip_addresses and len(ip_addresses) > 0:
                                    existing_ip = ip_addresses[0]
                                    ip_id = existing_ip["id"]
                                    ip_address_map[interface.name] = ip_id
                                    workflow_status["step2_ip_addresses"][
                                        "data"
                                    ].append(
                                        {
                                            "interface": interface.name,
                                            "ip_address": interface.ip_address,
                                            "id": ip_id,
                                            "status": "existing",
                                        }
                                    )
                                    logger.info(
                                        f"Found existing IP address {interface.ip_address} with ID: {ip_id}"
                                    )
                                    continue  # Skip error handling below
                                else:
                                    logger.warning(
                                        f"IP address {interface.ip_address} reported as existing but lookup returned no results"
                                    )
                            else:
                                logger.warning(
                                    f"Failed to query existing IP address {interface.ip_address}"
                                )

                        except Exception as lookup_error:
                            logger.error(
                                f"Error looking up existing IP address {interface.ip_address}: {str(lookup_error)}"
                            )

                    # If we get here, either it wasn't an "already exists" error,
                    # or the lookup failed - record the original error
                    workflow_status["step2_ip_addresses"]["errors"].append(
                        {
                            "interface": interface.name,
                            "ip_address": interface.ip_address,
                            "error": error_msg,
                        }
                    )
                    logger.error(
                        f"Error creating IP address {interface.ip_address}: {error_msg}"
                    )

            except Exception as e:
                # Catch any outer exceptions not related to IP creation
                error_msg = str(e)
                workflow_status["step2_ip_addresses"]["errors"].append(
                    {
                        "interface": interface.name,
                        "ip_address": interface.ip_address,
                        "error": error_msg,
                    }
                )
                logger.error(
                    f"Unexpected error processing IP address {interface.ip_address}: {error_msg}"
                )

        # Update status based on results
        success_count = len(workflow_status["step2_ip_addresses"]["data"])
        error_count = len(workflow_status["step2_ip_addresses"]["errors"])

        if success_count > 0 and error_count == 0:
            workflow_status["step2_ip_addresses"]["status"] = "success"
            workflow_status["step2_ip_addresses"]["message"] = (
                f"Created {success_count} IP address(es) successfully"
            )
        elif success_count > 0 and error_count > 0:
            workflow_status["step2_ip_addresses"]["status"] = "partial"
            workflow_status["step2_ip_addresses"]["message"] = (
                f"Created {success_count} IP address(es), {error_count} failed"
            )
        else:
            workflow_status["step2_ip_addresses"]["status"] = "failed"
            workflow_status["step2_ip_addresses"]["message"] = (
                f"Failed to create all {error_count} IP address(es)"
            )

        return ip_address_map

    async def _step3_create_interfaces(
        self,
        request: AddDeviceRequest,
        device_id: str,
        ip_address_map: dict[str, str],
        workflow_status: dict,
    ) -> tuple[list, Optional[str]]:
        """
        Step 3: Create interfaces and assign IP addresses.

        Returns:
            tuple of (created_interfaces list, primary_ipv4_id or None)
        """
        logger.info("Step 3: Creating interfaces")
        workflow_status["step3_interfaces"]["status"] = "in_progress"
        created_interfaces = []
        primary_ipv4_id = None

        # Separate LAG interfaces from other interfaces (LAGs must be created first)
        lag_interfaces = [iface for iface in request.interfaces if iface.type == "lag"]
        other_interfaces = [
            iface for iface in request.interfaces if iface.type != "lag"
        ]

        # Map frontend interface IDs to Nautobot interface IDs
        interface_id_map = {}

        sorted_interfaces = lag_interfaces + other_interfaces
        logger.info(
            f"Creating {len(lag_interfaces)} LAG interfaces first, "
            f"then {len(other_interfaces)} other interfaces"
        )

        for interface in sorted_interfaces:
            try:
                interface_payload = {
                    "name": interface.name,
                    "device": device_id,
                    "type": interface.type,
                    "status": interface.status,
                }

                # Add optional properties
                if interface.enabled is not None:
                    interface_payload["enabled"] = interface.enabled
                if interface.mgmt_only is not None:
                    interface_payload["mgmt_only"] = interface.mgmt_only
                if interface.description:
                    interface_payload["description"] = interface.description
                if interface.mac_address:
                    interface_payload["mac_address"] = interface.mac_address
                if interface.mtu:
                    interface_payload["mtu"] = interface.mtu
                if interface.mode:
                    interface_payload["mode"] = interface.mode
                if interface.untagged_vlan:
                    interface_payload["untagged_vlan"] = interface.untagged_vlan
                if interface.tagged_vlans:
                    interface_payload["tagged_vlans"] = [
                        v.strip()
                        for v in interface.tagged_vlans.split(",")
                        if v.strip()
                    ]
                if interface.parent_interface:
                    interface_payload["parent_interface"] = interface.parent_interface
                if interface.bridge:
                    interface_payload["bridge"] = interface.bridge
                if interface.lag:
                    lag_nautobot_id = interface_id_map.get(interface.lag)
                    if lag_nautobot_id:
                        interface_payload["lag"] = lag_nautobot_id
                        logger.info(
                            f"Mapping LAG {interface.lag} to Nautobot ID {lag_nautobot_id}"
                        )
                    else:
                        logger.warning(
                            f"LAG interface {interface.lag} not found in interface_id_map"
                        )
                if interface.tags:
                    interface_payload["tags"] = interface.tags

                interface_response = await nautobot_service.rest_request(
                    endpoint="dcim/interfaces/", method="POST", data=interface_payload
                )

                if interface_response and "id" in interface_response:
                    interface_id = interface_response["id"]
                    logger.info(
                        f"Created interface {interface.name} with ID: {interface_id}"
                    )

                    # Store mapping for LAG references
                    if interface.id:
                        interface_id_map[interface.id] = interface_id
                        logger.debug(
                            f"Mapped frontend ID {interface.id} to Nautobot ID {interface_id}"
                        )

                    interface_result = {
                        "name": interface.name,
                        "id": interface_id,
                        "status": "success",
                        "ip_assigned": False,
                        "ip_assignment_error": None,
                    }

                    # Assign IP address to interface
                    if interface.name in ip_address_map:
                        ip_id = ip_address_map[interface.name]
                        try:
                            assignment_payload = {
                                "ip_address": ip_id,
                                "interface": interface_id,
                            }
                            await nautobot_service.rest_request(
                                endpoint="ipam/ip-address-to-interface/",
                                method="POST",
                                data=assignment_payload,
                            )
                            interface_result["ip_assigned"] = True
                            logger.info(
                                f"Assigned IP {interface.ip_address} to interface {interface.name}"
                            )

                            # Determine primary IPv4
                            # Check if this is an IPv4 address (not IPv6)
                            is_ipv4 = (
                                interface.ip_address and ":" not in interface.ip_address
                            )

                            if is_ipv4:
                                if interface.is_primary_ipv4:
                                    primary_ipv4_id = ip_id
                                    logger.info(
                                        f"Interface {interface.name} marked as primary IPv4 (explicit)"
                                    )
                                elif primary_ipv4_id is None:
                                    primary_ipv4_id = ip_id
                                    logger.info(
                                        f"Interface {interface.name} set as primary IPv4 (first IPv4 found)"
                                    )

                        except Exception as e:
                            interface_result["ip_assignment_error"] = str(e)
                            logger.error(f"Failed to assign IP to interface: {str(e)}")

                    workflow_status["step3_interfaces"]["data"].append(interface_result)
                    created_interfaces.append(interface_response)
                else:
                    workflow_status["step3_interfaces"]["errors"].append(
                        {
                            "interface": interface.name,
                            "error": "No interface ID returned from Nautobot",
                        }
                    )
                    logger.warning(f"Failed to create interface {interface.name}")

            except Exception as e:
                error_msg = str(e)
                workflow_status["step3_interfaces"]["errors"].append(
                    {
                        "interface": interface.name,
                        "error": error_msg,
                    }
                )
                logger.error(f"Error creating interface {interface.name}: {error_msg}")

        # Update status based on results
        success_count = len(workflow_status["step3_interfaces"]["data"])
        error_count = len(workflow_status["step3_interfaces"]["errors"])

        if success_count > 0 and error_count == 0:
            workflow_status["step3_interfaces"]["status"] = "success"
            workflow_status["step3_interfaces"]["message"] = (
                f"Created {success_count} interface(s) successfully"
            )
        elif success_count > 0 and error_count > 0:
            workflow_status["step3_interfaces"]["status"] = "partial"
            workflow_status["step3_interfaces"]["message"] = (
                f"Created {success_count} interface(s), {error_count} failed"
            )
        elif success_count == 0 and error_count > 0:
            workflow_status["step3_interfaces"]["status"] = "failed"
            workflow_status["step3_interfaces"]["message"] = (
                f"Failed to create all {error_count} interface(s)"
            )
        else:
            workflow_status["step3_interfaces"]["status"] = "skipped"
            workflow_status["step3_interfaces"]["message"] = "No interfaces to create"

        return created_interfaces, primary_ipv4_id

    async def _step4_assign_primary_ip(
        self,
        device_id: str,
        primary_ipv4_id: Optional[str],
        workflow_status: dict,
    ) -> None:
        """Step 4: Assign primary IPv4 address to device."""
        logger.info("Step 4: Assigning primary IPv4 address to device")
        workflow_status["step4_primary_ip"]["status"] = "in_progress"

        if primary_ipv4_id:
            success = await self._assign_primary_ipv4(device_id, primary_ipv4_id)
            if success:
                workflow_status["step4_primary_ip"]["status"] = "success"
                workflow_status["step4_primary_ip"]["message"] = (
                    "Primary IPv4 address assigned successfully"
                )
                workflow_status["step4_primary_ip"]["data"] = {"ip_id": primary_ipv4_id}
                logger.info(f"Primary IPv4 assigned successfully: {primary_ipv4_id}")
            else:
                workflow_status["step4_primary_ip"]["status"] = "failed"
                workflow_status["step4_primary_ip"]["message"] = (
                    "Failed to assign primary IPv4 address"
                )
                logger.warning("Failed to assign primary IPv4 address")
        else:
            workflow_status["step4_primary_ip"]["status"] = "skipped"
            workflow_status["step4_primary_ip"]["message"] = (
                "No IPv4 address available for primary IP assignment"
            )
            logger.info("No IPv4 address found for primary IP assignment")

    async def _assign_primary_ipv4(self, device_id: str, ip_address_id: str) -> bool:
        """
        Assign primary IPv4 address to a device.

        Args:
            device_id: The Nautobot device ID (UUID)
            ip_address_id: The Nautobot IP address ID (UUID) to set as primary

        Returns:
            bool: True if successful, False otherwise
        """
        try:
            logger.info(f"Assigning primary IPv4 {ip_address_id} to device {device_id}")

            endpoint = f"dcim/devices/{device_id}/"
            await nautobot_service.rest_request(
                endpoint=endpoint, method="PATCH", data={"primary_ip4": ip_address_id}
            )

            logger.info(
                f"Successfully assigned primary IPv4 {ip_address_id} to device {device_id}"
            )
            return True
        except Exception as e:
            logger.error(
                f"Error assigning primary IPv4 to device {device_id}: {str(e)}"
            )
            return False


# Singleton instance
device_creation_service = DeviceCreationService()
