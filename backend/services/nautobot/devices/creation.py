"""
Device creation service for Nautobot.

Handles the orchestrated workflow for creating devices with interfaces.
"""

import logging
import ipaddress
from typing import Optional, List, Dict, Any
from models.nautobot import AddDeviceRequest, InterfaceData
from services.nautobot import nautobot_service
from services.nautobot.common.exceptions import NautobotAPIError
from services.nautobot.devices.common import DeviceCommonService
from services.nautobot.devices.interface_workflow import InterfaceManagerService

logger = logging.getLogger(__name__)


class DeviceCreationService:
    """Service for creating devices in Nautobot with a multi-step workflow."""

    def __init__(self):
        """Initialize the service."""
        self.common_service = DeviceCommonService(nautobot_service)
        self.interface_manager = InterfaceManagerService(nautobot_service)

    async def create_device_with_interfaces(
        self,
        request: AddDeviceRequest,
        username: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> dict:
        """
        Orchestrated workflow to add a device with interfaces to Nautobot.

        Workflow:
        1. Create device in Nautobot DCIM
        2. Create IP addresses for all interfaces (if specified)
        3. Create interfaces and assign IP addresses
        4. Assign primary IPv4 address to device

        Args:
            request: AddDeviceRequest with device and interface data
            username: Username of the user creating the device (for audit logging)
            user_id: User ID of the user creating the device (for audit logging)

        Returns:
            dict with success status, device_id, workflow_status, and summary
        """
        logger.info("Starting add-device workflow for: %s", request.name)

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

        # Steps 2-4: Create interfaces with IP addresses using InterfaceManagerService
        interfaces_created, primary_ipv4_id = await self._create_interfaces_with_ips(
            request, device_id, workflow_status
        )

        # Determine overall success
        overall_success = workflow_status["step1_device"][
            "status"
        ] == "success" and workflow_status["step3_interfaces"]["status"] in [
            "success",
            "partial",
        ]

        # Log device creation to audit log
        if username:
            from repositories.audit_log_repository import audit_log_repo

            device_created = workflow_status["step1_device"]["status"] == "success"

            # Prepare extra data for audit log
            extra_data = {
                "serial_number": request.serial,
            }

            # Extract human-readable names using common service helper methods
            if device_response:
                # Get device_type display name from UUID
                device_type_field = device_response.get("device_type")
                if isinstance(device_type_field, dict) and "id" in device_type_field:
                    device_type_name = (
                        await self.common_service.get_device_type_display(
                            device_type_field["id"]
                        )
                    )
                    extra_data["device_type"] = device_type_name or request.device_type
                else:
                    extra_data["device_type"] = request.device_type

                # Get platform name from UUID
                platform_field = device_response.get("platform")
                if isinstance(platform_field, dict) and "id" in platform_field:
                    platform_name = await self.common_service.get_platform_name(
                        platform_field["id"]
                    )
                    extra_data["platform"] = platform_name or request.platform
                elif request.platform:
                    extra_data["platform"] = request.platform
            else:
                extra_data["device_type"] = request.device_type
                if request.platform:
                    extra_data["platform"] = request.platform

            # Add primary IP if available
            if primary_ipv4_id:
                # Find the primary IP address from the created IPs
                for ip_data in workflow_status["step2_ip_addresses"]["data"]:
                    if ip_data.get("id") == primary_ipv4_id:
                        extra_data["primary_ip_address"] = ip_data.get("address")
                        break

            if device_created:
                audit_log_repo.create_log(
                    username=username,
                    user_id=user_id,
                    event_type="add-device",
                    message=f"Device '{request.name}' added to Nautobot",
                    resource_type="device",
                    resource_id=device_id,
                    resource_name=request.name,
                    severity="info",
                    extra_data=extra_data,
                )
            else:
                error_message = workflow_status["step1_device"].get(
                    "message", "Unknown error"
                )
                audit_log_repo.create_log(
                    username=username,
                    user_id=user_id,
                    event_type="add-device",
                    message=f"Failed to add device '{request.name}' - Error: {error_message}",
                    resource_type="device",
                    resource_id=None,
                    resource_name=request.name,
                    severity="error",
                    extra_data=extra_data,
                )

        return {
            "success": overall_success,
            "message": f"Device '{request.name}' workflow completed",
            "device_id": device_id,
            "device": device_response,
            "workflow_status": workflow_status,
            "summary": {
                "device_created": workflow_status["step1_device"]["status"]
                == "success",
                "interfaces_created": interfaces_created,
                "interfaces_failed": len(workflow_status["step3_interfaces"]["errors"]),
                "ip_addresses_created": len(
                    workflow_status["step2_ip_addresses"]["data"]
                ),
                "ip_addresses_failed": len(
                    workflow_status["step2_ip_addresses"]["errors"]
                ),
                "primary_ipv4_assigned": primary_ipv4_id is not None,
            },
        }

    def _log_request_data(self, request: AddDeviceRequest) -> None:
        """Log incoming request data for debugging."""
        logger.info("=== ADD DEVICE DEBUG ===")
        logger.info("Device name: %s", request.name)
        logger.info("Device type: %s", request.device_type)
        logger.info("Role: %s", request.role)
        logger.info("Location: %s", request.location)
        logger.info("Status: %s", request.status)
        logger.info("Platform: %s", request.platform)
        logger.info("Software version: %s", request.software_version)
        logger.info("Serial: %s", request.serial)
        logger.info("Asset tag: %s", request.asset_tag)
        logger.info("Tags: %s", request.tags)
        logger.info("Custom fields: %s", request.custom_fields)
        logger.info("Interfaces count: %s", len(request.interfaces))
        for i, iface in enumerate(request.interfaces):
            logger.info(
                "  Interface %s: name=%s, type=%s, ip_addresses_count=%s",
                i + 1,
                iface.name,
                iface.type,
                len(iface.ip_addresses),
            )
            for j, ip_data in enumerate(iface.ip_addresses):
                logger.info(
                    "    IP %s: address=%s, namespace=%s, role=%s, is_primary=%s",
                    j + 1, ip_data.address, ip_data.namespace, ip_data.ip_role, ip_data.is_primary,
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

        logger.info("Device payload: %s", device_payload)

        device_response = await nautobot_service.rest_request(
            endpoint="dcim/devices/", method="POST", data=device_payload
        )

        if not device_response or "id" not in device_response:
            workflow_status["step1_device"]["status"] = "failed"
            workflow_status["step1_device"]["message"] = (
                "Failed to create device: No device ID returned"
            )
            raise NautobotAPIError("Failed to create device: No device ID returned")

        device_id = device_response["id"]
        workflow_status["step1_device"]["status"] = "success"
        workflow_status["step1_device"]["message"] = (
            f"Device '{request.name}' created successfully"
        )
        workflow_status["step1_device"]["data"] = {
            "id": device_id,
            "name": request.name,
        }
        logger.info("Device created with ID: %s", device_id)

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

        # Collect all IP addresses from all interfaces
        ip_address_list = []
        for interface in request.interfaces:
            for ip_data in interface.ip_addresses:
                ip_address_list.append((interface.name, ip_data))

        if not ip_address_list:
            logger.info("No IP addresses to create prefixes for")
            return

        prefixes_created = set()  # Track created prefixes to avoid duplicates

        for interface_name, ip_data in ip_address_list:
            try:
                ip_str = ip_data.address.strip()
                namespace = ip_data.namespace or "Global"

                # Determine if IP has CIDR notation
                if "/" in ip_str:
                    # IP has CIDR notation (e.g., "192.168.100.100/24")
                    ip_with_cidr = ip_str
                else:
                    # IP has no CIDR notation, append default prefix length
                    ip_with_cidr = f"{ip_str}{request.default_prefix_length}"
                    logger.info(
                        "Appending default prefix length %s to %s",
                        request.default_prefix_length,
                        ip_str,
                    )

                # Parse IP address and calculate network prefix
                try:
                    ip_network = ipaddress.ip_network(ip_with_cidr, strict=False)
                    prefix_str = str(ip_network)
                    logger.info(
                        "Calculated prefix for %s: %s", ip_with_cidr, prefix_str
                    )
                except ValueError as e:
                    logger.error(
                        "Invalid IP address format for %s: %s", ip_with_cidr, e
                    )
                    continue

                # Create unique key for prefix+namespace to avoid duplicates
                prefix_key = f"{prefix_str}|{namespace}"
                if prefix_key in prefixes_created:
                    logger.info(
                        "Prefix %s in namespace %s already processed, skipping",
                        prefix_str,
                        namespace,
                    )
                    continue

                # Create prefix using common service
                # Note: We don't set location for auto-created prefixes because
                # Nautobot has restrictions on which location types can be used with prefixes
                logger.info(
                    "Ensuring prefix exists: %s in namespace %s", prefix_str, namespace
                )
                prefix_id = await self.common_service.ensure_prefix_exists(
                    prefix=prefix_str,
                    namespace=namespace,
                    status="active",
                    prefix_type="network",
                    description=f"Auto-created for device {request.name}",
                )
                logger.info("Prefix %s exists with ID: %s", prefix_str, prefix_id)
                prefixes_created.add(prefix_key)

            except Exception as e:
                logger.error(
                    "Error creating prefix for interface %s with IP %s: %s",
                    interface_name,
                    ip_data.address,
                    e,
                )
                # Continue with other interfaces - prefix creation failures shouldn't stop device creation
                continue

        logger.info(
            "Completed prefix creation step. Created/verified %s unique prefix(es)", len(prefixes_created)
        )

    def _convert_interfaces_to_dict_format(
        self, interfaces: List[InterfaceData]
    ) -> List[Dict[str, Any]]:
        """
        Convert AddDeviceRequest interfaces to dict format for InterfaceManagerService.

        Args:
            interfaces: List of InterfaceData from AddDeviceRequest

        Returns:
            List of interface dicts in the format expected by InterfaceManagerService
        """
        interface_dicts = []

        # Separate LAG interfaces (must be created first)
        lag_interfaces = [iface for iface in interfaces if iface.type == "lag"]
        other_interfaces = [iface for iface in interfaces if iface.type != "lag"]
        sorted_interfaces = lag_interfaces + other_interfaces

        for interface in sorted_interfaces:
            interface_dict: Dict[str, Any] = {
                "name": interface.name,
                "type": interface.type,
                "status": interface.status,
                "ip_addresses": [],
            }

            # Add optional properties
            if interface.enabled is not None:
                interface_dict["enabled"] = interface.enabled
            if interface.mgmt_only is not None:
                interface_dict["mgmt_only"] = interface.mgmt_only
            if interface.description:
                interface_dict["description"] = interface.description
            if interface.mac_address:
                interface_dict["mac_address"] = interface.mac_address
            if interface.mtu:
                interface_dict["mtu"] = interface.mtu
            if interface.mode:
                interface_dict["mode"] = interface.mode
            if interface.untagged_vlan:
                interface_dict["untagged_vlan"] = interface.untagged_vlan
            if interface.tagged_vlans:
                interface_dict["tagged_vlans"] = [
                    v.strip() for v in interface.tagged_vlans.split(",") if v.strip()
                ]
            if interface.parent_interface:
                interface_dict["parent_interface"] = interface.parent_interface
            if interface.bridge:
                interface_dict["bridge"] = interface.bridge
            if interface.lag:
                interface_dict["lag"] = interface.lag
            if interface.tags:
                interface_dict["tags"] = interface.tags
            if interface.id:
                interface_dict["id"] = interface.id

            # Convert IP addresses
            for ip_data in interface.ip_addresses:
                ip_dict = {
                    "address": ip_data.address,
                    "namespace": ip_data.namespace,
                    "is_primary": ip_data.is_primary or False,
                }
                if ip_data.ip_role and ip_data.ip_role != "none":
                    ip_dict["ip_role"] = ip_data.ip_role
                interface_dict["ip_addresses"].append(ip_dict)

            interface_dicts.append(interface_dict)

        return interface_dicts

    async def _create_interfaces_with_ips(
        self,
        request: AddDeviceRequest,
        device_id: str,
        workflow_status: dict,
    ) -> tuple[int, Optional[str]]:
        """
        Create interfaces with IP addresses using InterfaceManagerService.

        This replaces the previous _step2_create_ip_addresses, _step3_create_interfaces,
        and _step4_assign_primary_ip methods with a single call to InterfaceManagerService.

        Args:
            request: AddDeviceRequest containing interface specifications
            device_id: The created device's UUID
            workflow_status: Workflow status dict to update

        Returns:
            tuple of (number of interfaces created, primary_ipv4_id or None)
        """
        logger.info("Steps 2-4: Creating interfaces with IP addresses")
        workflow_status["step2_ip_addresses"]["status"] = "in_progress"
        workflow_status["step3_interfaces"]["status"] = "in_progress"
        workflow_status["step4_primary_ip"]["status"] = "in_progress"

        if not request.interfaces:
            workflow_status["step2_ip_addresses"]["status"] = "skipped"
            workflow_status["step2_ip_addresses"]["message"] = (
                "No IP addresses to create"
            )
            workflow_status["step3_interfaces"]["status"] = "skipped"
            workflow_status["step3_interfaces"]["message"] = "No interfaces to create"
            workflow_status["step4_primary_ip"]["status"] = "skipped"
            workflow_status["step4_primary_ip"]["message"] = "No IPv4 address available"
            return 0, None

        # Convert interfaces to dict format
        interface_dicts = self._convert_interfaces_to_dict_format(request.interfaces)

        # Use InterfaceManagerService to create interfaces with IPs
        result = await self.interface_manager.update_device_interfaces(
            device_id=device_id,
            interfaces=interface_dicts,
            add_prefixes_automatically=request.add_prefix,
        )

        # Update workflow_status from InterfaceUpdateResult
        # Step 2: IP addresses
        if result.ip_addresses_created > 0:
            workflow_status["step2_ip_addresses"]["status"] = "success"
            workflow_status["step2_ip_addresses"]["message"] = (
                f"Created {result.ip_addresses_created} IP address(es)"
            )
            # Populate data for summary (count only, detailed tracking in InterfaceManagerService)
            workflow_status["step2_ip_addresses"]["data"] = [
                {"status": "success"} for _ in range(result.ip_addresses_created)
            ]
        else:
            workflow_status["step2_ip_addresses"]["status"] = "skipped"
            workflow_status["step2_ip_addresses"]["message"] = "No IP addresses created"

        # Add warnings as errors for tracking
        for warning in result.warnings:
            if "IP" in warning or "ip_address" in warning.lower():
                workflow_status["step2_ip_addresses"]["errors"].append(
                    {"error": warning}
                )
            elif "Interface" in warning or "interface" in warning.lower():
                workflow_status["step3_interfaces"]["errors"].append({"error": warning})

        # Step 3: Interfaces
        interfaces_created = result.interfaces_created + result.interfaces_updated
        if interfaces_created > 0 and result.interfaces_failed == 0:
            workflow_status["step3_interfaces"]["status"] = "success"
            workflow_status["step3_interfaces"]["message"] = (
                f"Created {interfaces_created} interface(s) successfully"
            )
        elif interfaces_created > 0 and result.interfaces_failed > 0:
            workflow_status["step3_interfaces"]["status"] = "partial"
            workflow_status["step3_interfaces"]["message"] = (
                f"Created {interfaces_created} interface(s), {result.interfaces_failed} failed"
            )
        elif interfaces_created == 0 and result.interfaces_failed > 0:
            workflow_status["step3_interfaces"]["status"] = "failed"
            workflow_status["step3_interfaces"]["message"] = (
                f"Failed to create all {result.interfaces_failed} interface(s)"
            )
        else:
            workflow_status["step3_interfaces"]["status"] = "skipped"
            workflow_status["step3_interfaces"]["message"] = "No interfaces to create"

        # Step 4: Primary IP
        if result.primary_ip4_id:
            workflow_status["step4_primary_ip"]["status"] = "success"
            workflow_status["step4_primary_ip"]["message"] = (
                "Primary IPv4 address assigned successfully"
            )
            workflow_status["step4_primary_ip"]["data"] = {
                "ip_id": result.primary_ip4_id
            }
        else:
            workflow_status["step4_primary_ip"]["status"] = "skipped"
            workflow_status["step4_primary_ip"]["message"] = (
                "No IPv4 address available for primary IP assignment"
            )

        return interfaces_created, result.primary_ip4_id


# Singleton instance
device_creation_service = DeviceCreationService()
