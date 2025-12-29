"""
Device Import Service - Create new devices in Nautobot.

This service handles importing devices from various sources (CSV, API, UI forms)
with validation, interface creation, and IP assignment.

Based on the workflow from device_creation_service.py but redesigned to:
- Use DeviceCommonService for all shared utilities
- Support flexible input formats (not just Pydantic models)
- Handle "already exists" gracefully with skip_if_exists flag
- Return detailed results for caller inspection
"""

import logging
from typing import Optional, Dict, Any, List
from services.nautobot import NautobotService
from services.nautobot.devices.common import DeviceCommonService

logger = logging.getLogger(__name__)


class DeviceImportService:
    """
    Service for importing devices into Nautobot.

    Handles the complete workflow:
    1. Validate import data
    2. Resolve all resource names to UUIDs
    3. Create device in Nautobot
    4. Create interfaces and IP addresses
    5. Assign primary IP to device
    """

    def __init__(self, nautobot_service: NautobotService):
        """
        Initialize the import service.

        Args:
            nautobot_service: NautobotService instance for API calls
        """
        self.nautobot = nautobot_service
        self.common = DeviceCommonService(nautobot_service)

    async def import_device(
        self,
        device_data: Dict[str, Any],
        interface_config: Optional[List[Dict[str, Any]]] = None,
        skip_if_exists: bool = False,
    ) -> Dict[str, Any]:
        """
        Import a single device with optional interface configuration.

        Workflow:
        1. Validate and resolve device data (names → UUIDs)
        2. Create device (or skip if exists and skip_if_exists=True)
        3. Create interfaces and IP addresses
        4. Assign primary IP to device

        Args:
            device_data: Device properties dict with required fields:
                - name: Device name (required)
                - device_type: Device type name or UUID (required)
                - role: Role name or UUID (required)
                - location: Location name or UUID (required)
                - status: Status name or UUID (optional, defaults to "active")
                - platform: Platform name or UUID (optional)
                - serial: Serial number (optional)
                - asset_tag: Asset tag (optional)
                - tags: List of tag names (optional)
                - custom_fields: Dict of custom field values (optional)

            interface_config: Optional list of interface configurations:
                [
                    {
                        "name": "Loopback0",
                        "type": "virtual",
                        "status": "active",
                        "ip_address": "10.0.0.1/32",
                        "namespace": "Global",
                        "is_primary_ipv4": True,
                        "enabled": True,
                        "description": "...",
                        # ... other interface fields
                    }
                ]

            skip_if_exists: If True, skip device if it already exists (don't raise error)

        Returns:
            {
                "success": bool,
                "device_id": str,
                "device_name": str,
                "message": str,
                "created": bool,  # False if already existed and skipped
                "warnings": List[str],
                "details": {
                    "device": {...},
                    "interfaces": [...],
                    "primary_ip": str or None
                }
            }

        Raises:
            ValueError: If validation fails or required resources not found
            Exception: If creation fails and skip_if_exists=False
        """
        logger.info(f"Starting device import for: {device_data.get('name', 'unknown')}")

        warnings = []
        details = {
            "device": None,
            "interfaces": [],
            "primary_ip": None,
        }

        try:
            # Step 1: Validate and resolve data
            logger.info("Step 1: Validating and resolving device data")
            validated_data = await self.validate_import_data(device_data)

            # Step 2: Create device
            logger.info("Step 2: Creating device in Nautobot")
            device_id, device_response, was_created = await self._create_device(
                validated_data, skip_if_exists
            )
            details["device"] = device_response

            if not was_created:
                logger.info(
                    f"Device '{validated_data['name']}' already exists, skipped creation"
                )
                warnings.append("Device already exists, skipped creation")

            # Step 3: Create interfaces (if provided)
            primary_ipv4_id = None
            if interface_config:
                logger.info(f"Step 3: Creating {len(interface_config)} interface(s)")
                (
                    created_interfaces,
                    primary_ipv4_id,
                ) = await self._create_device_interfaces(
                    device_id, interface_config, validated_data["name"]
                )
                details["interfaces"] = created_interfaces

                # Check for interface warnings
                for iface_result in created_interfaces:
                    if "warning" in iface_result:
                        warnings.append(iface_result["warning"])
            else:
                logger.info("Step 3: No interfaces to create")

            # Step 4: Assign primary IP (if we have one)
            if primary_ipv4_id:
                logger.info("Step 4: Assigning primary IPv4 to device")
                success = await self.common.assign_primary_ip_to_device(
                    device_id, primary_ipv4_id
                )
                if success:
                    details["primary_ip"] = primary_ipv4_id
                else:
                    warnings.append("Failed to assign primary IPv4 to device")
            else:
                logger.info("Step 4: No primary IPv4 to assign")

            # Success!
            success_message = f"Device '{validated_data['name']}' "
            success_message += (
                "imported successfully" if was_created else "already exists"
            )

            return {
                "success": True,
                "device_id": device_id,
                "device_name": validated_data["name"],
                "message": success_message,
                "created": was_created,
                "warnings": warnings,
                "details": details,
            }

        except Exception as e:
            error_msg = f"Failed to import device '{device_data.get('name', 'unknown')}': {str(e)}"
            logger.error(error_msg, exc_info=True)

            return {
                "success": False,
                "device_id": None,
                "device_name": device_data.get("name", "unknown"),
                "message": error_msg,
                "created": False,
                "warnings": warnings,
                "details": details,
            }

    async def validate_import_data(self, device_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate device data and resolve all resource names to UUIDs.

        Required fields:
        - name: Device name
        - device_type: Device type name or UUID
        - role: Role name or UUID
        - location: Location name or UUID
        - status: Status name or UUID (defaults to "active" if not provided)

        Optional fields:
        - platform: Platform name or UUID
        - serial: Serial number
        - asset_tag: Asset tag
        - tags: List of tag names
        - custom_fields: Dict of custom field values

        Args:
            device_data: Raw device data dictionary

        Returns:
            Validated data dictionary with all names resolved to UUIDs

        Raises:
            ValueError: If validation fails or required resources not found
        """
        logger.debug(f"Validating import data: {device_data}")

        # Check required fields
        required_fields = ["name", "device_type", "role", "location"]
        self.common.validate_required_fields(device_data, required_fields)

        # Start building validated data
        validated = {
            "name": device_data["name"].strip(),
        }

        # Resolve device_type
        device_type = device_data["device_type"]
        if self.common._is_valid_uuid(device_type):
            validated["device_type"] = device_type
        else:
            # Try to resolve by name
            manufacturer = device_data.get("manufacturer")
            device_type_id = await self.common.resolve_device_type_id(
                device_type, manufacturer
            )
            if not device_type_id:
                raise ValueError(
                    f"Device type '{device_type}' not found"
                    + (f" for manufacturer '{manufacturer}'" if manufacturer else "")
                )
            validated["device_type"] = device_type_id

        # Resolve role
        role = device_data["role"]
        if self.common._is_valid_uuid(role):
            validated["role"] = role
        else:
            role_id = await self.common.resolve_role_id(role)
            if not role_id:
                raise ValueError(f"Role '{role}' not found")
            validated["role"] = role_id

        # Resolve location
        location = device_data["location"]
        if self.common._is_valid_uuid(location):
            validated["location"] = location
        else:
            location_id = await self.common.resolve_location_id(location)
            if not location_id:
                raise ValueError(f"Location '{location}' not found")
            validated["location"] = location_id

        # Resolve status (default to "active" if not provided)
        status = device_data.get("status", "active")
        if self.common._is_valid_uuid(status):
            validated["status"] = status
        else:
            status_id = await self.common.resolve_status_id(status, "dcim.device")
            validated["status"] = status_id

        # Resolve platform (optional)
        if "platform" in device_data and device_data["platform"]:
            platform = device_data["platform"]
            if self.common._is_valid_uuid(platform):
                validated["platform"] = platform
            else:
                platform_id = await self.common.resolve_platform_id(platform)
                if platform_id:
                    validated["platform"] = platform_id
                else:
                    logger.warning(f"Platform '{platform}' not found, will be omitted")

        # Copy optional string fields as-is
        optional_fields = ["serial", "asset_tag", "software_version", "description"]
        for field in optional_fields:
            if field in device_data and device_data[field]:
                validated[field] = device_data[field]

        # Handle tags (normalize to list)
        if "tags" in device_data and device_data["tags"]:
            validated["tags"] = self.common.normalize_tags(device_data["tags"])

        # Copy custom_fields as-is
        if "custom_fields" in device_data and device_data["custom_fields"]:
            validated["custom_fields"] = device_data["custom_fields"]

        logger.info(f"Validation complete for device '{validated['name']}'")
        logger.debug(f"Validated data: {validated}")

        return validated

    async def _create_device(
        self,
        validated_data: Dict[str, Any],
        skip_if_exists: bool = False,
    ) -> tuple[str, Dict[str, Any], bool]:
        """
        Create device in Nautobot DCIM.

        Args:
            validated_data: Validated device data with UUIDs
            skip_if_exists: If True, return existing device instead of raising error

        Returns:
            Tuple of (device_id, device_response, was_created)
            - device_id: UUID of device
            - device_response: Full device object from Nautobot
            - was_created: True if newly created, False if already existed

        Raises:
            Exception: If device creation fails and skip_if_exists=False
        """
        device_name = validated_data["name"]
        logger.info(f"Creating device '{device_name}' in Nautobot DCIM")
        logger.debug(f"Device payload: {validated_data}")

        try:
            device_response = await self.nautobot.rest_request(
                endpoint="dcim/devices/",
                method="POST",
                data=validated_data,
            )

            if not device_response or "id" not in device_response:
                raise Exception("No device ID returned from Nautobot")

            device_id = device_response["id"]
            logger.info(
                f"Device '{device_name}' created successfully with ID: {device_id}"
            )

            return device_id, device_response, True

        except Exception as e:
            error_msg = str(e)

            # Check if device already exists
            if self.common.is_duplicate_error(e):
                if skip_if_exists:
                    logger.info(
                        f"Device '{device_name}' already exists, looking up existing device"
                    )

                    # Look up existing device by name
                    existing_id = await self.common.resolve_device_by_name(device_name)
                    if existing_id:
                        # Fetch full device details
                        device_response = await self.nautobot.rest_request(
                            endpoint=f"dcim/devices/{existing_id}/",
                            method="GET",
                        )
                        logger.info(f"Found existing device: {existing_id}")
                        return existing_id, device_response, False
                    else:
                        raise Exception(
                            f"Device '{device_name}' reported as duplicate but lookup failed"
                        )
                else:
                    raise Exception(f"Device '{device_name}' already exists") from e
            else:
                # Some other error
                logger.error(f"Failed to create device '{device_name}': {error_msg}")
                raise

    async def _create_device_interfaces(
        self,
        device_id: str,
        interface_config: List[Dict[str, Any]],
        device_name: str,
    ) -> tuple[List[Dict[str, Any]], Optional[str]]:
        """
        Create interfaces and IP addresses for device.

        Args:
            device_id: Device UUID
            interface_config: List of interface configuration dicts
            device_name: Device name (for logging)

        Returns:
            Tuple of (created_interfaces list, primary_ipv4_id or None)
            - created_interfaces: List of interface result dicts
            - primary_ipv4_id: UUID of primary IPv4 address (if any)
        """
        logger.info(
            f"Creating {len(interface_config)} interface(s) for device '{device_name}'"
        )

        created_interfaces = []
        primary_ipv4_id = None

        # Separate LAG interfaces (must be created first for dependencies)
        lag_interfaces = [
            iface for iface in interface_config if iface.get("type") == "lag"
        ]
        other_interfaces = [
            iface for iface in interface_config if iface.get("type") != "lag"
        ]

        # Map frontend interface IDs to Nautobot interface IDs (for LAG dependencies)
        interface_id_map = {}

        sorted_interfaces = lag_interfaces + other_interfaces
        logger.debug(
            f"Creating {len(lag_interfaces)} LAG interface(s) first, "
            f"then {len(other_interfaces)} other interface(s)"
        )

        for iface_data in sorted_interfaces:
            try:
                interface_name = iface_data.get("name")
                if not interface_name:
                    logger.warning("Interface config missing 'name', skipping")
                    created_interfaces.append(
                        {
                            "name": None,
                            "success": False,
                            "error": "Missing interface name",
                        }
                    )
                    continue

                logger.info(f"Creating interface '{interface_name}'")

                # Build interface payload
                interface_payload = {
                    "name": interface_name,
                    "device": device_id,
                    "type": iface_data.get("type", "other"),
                    "status": await self.common.resolve_status_id(
                        iface_data.get("status", "active"), "dcim.interface"
                    ),
                }

                # Add optional properties
                optional_fields = [
                    "enabled",
                    "mgmt_only",
                    "description",
                    "mac_address",
                    "mtu",
                    "mode",
                    "parent_interface",
                    "bridge",
                ]
                for field in optional_fields:
                    if field in iface_data and iface_data[field] is not None:
                        interface_payload[field] = iface_data[field]

                # Handle LAG dependency (map frontend ID to Nautobot ID)
                if "lag" in iface_data and iface_data["lag"]:
                    lag_nautobot_id = interface_id_map.get(iface_data["lag"])
                    if lag_nautobot_id:
                        interface_payload["lag"] = lag_nautobot_id
                        logger.debug(
                            f"Mapped LAG {iface_data['lag']} → {lag_nautobot_id}"
                        )
                    else:
                        logger.warning(
                            f"LAG interface {iface_data['lag']} not found in map"
                        )

                # Handle VLAN fields (convert comma-separated strings to lists)
                if "tagged_vlans" in iface_data and iface_data["tagged_vlans"]:
                    tagged_vlans = iface_data["tagged_vlans"]
                    if isinstance(tagged_vlans, str):
                        interface_payload["tagged_vlans"] = [
                            v.strip() for v in tagged_vlans.split(",") if v.strip()
                        ]
                    else:
                        interface_payload["tagged_vlans"] = tagged_vlans

                if "untagged_vlan" in iface_data and iface_data["untagged_vlan"]:
                    interface_payload["untagged_vlan"] = iface_data["untagged_vlan"]

                # Handle tags
                if "tags" in iface_data and iface_data["tags"]:
                    interface_payload["tags"] = self.common.normalize_tags(
                        iface_data["tags"]
                    )

                # Create interface
                interface_response = await self.nautobot.rest_request(
                    endpoint="dcim/interfaces/",
                    method="POST",
                    data=interface_payload,
                )

                if not interface_response or "id" not in interface_response:
                    raise Exception("No interface ID returned from Nautobot")

                interface_id = interface_response["id"]
                logger.info(
                    f"Created interface '{interface_name}' with ID: {interface_id}"
                )

                # Store mapping for LAG references
                if "id" in iface_data:
                    interface_id_map[iface_data["id"]] = interface_id
                    logger.debug(
                        f"Mapped frontend ID {iface_data['id']} → {interface_id}"
                    )

                interface_result = {
                    "name": interface_name,
                    "id": interface_id,
                    "success": True,
                    "ip_assigned": False,
                }

                # Assign IP address if provided
                if "ip_address" in iface_data and iface_data["ip_address"]:
                    ip_address = iface_data["ip_address"]
                    namespace = iface_data.get("namespace", "Global")

                    try:
                        logger.info(
                            f"Assigning IP {ip_address} to interface '{interface_name}'"
                        )

                        # Resolve namespace
                        namespace_id = await self.common.resolve_namespace_id(namespace)

                        # Ensure IP exists
                        ip_id = await self.common.ensure_ip_address_exists(
                            ip_address=ip_address,
                            namespace_id=namespace_id,
                            status_name="active",
                        )

                        # Assign IP to interface
                        await self.common.assign_ip_to_interface(
                            ip_id=ip_id,
                            interface_id=interface_id,
                            is_primary=iface_data.get("is_primary_ipv4", False),
                        )

                        interface_result["ip_assigned"] = True
                        interface_result["ip_id"] = ip_id
                        logger.info(
                            f"Successfully assigned IP {ip_address} to interface '{interface_name}'"
                        )

                        # Track primary IPv4
                        is_ipv4 = ":" not in ip_address  # Simple IPv4 check
                        if is_ipv4:
                            if iface_data.get("is_primary_ipv4"):
                                primary_ipv4_id = ip_id
                                logger.info(
                                    f"Interface '{interface_name}' marked as primary IPv4 (explicit)"
                                )
                            elif primary_ipv4_id is None:
                                primary_ipv4_id = ip_id
                                logger.info(
                                    f"Interface '{interface_name}' set as primary IPv4 (first IPv4 found)"
                                )

                    except Exception as ip_error:
                        error_msg = f"Failed to assign IP to interface: {str(ip_error)}"
                        logger.error(error_msg)
                        interface_result["warning"] = error_msg

                created_interfaces.append(interface_result)

            except Exception as e:
                error_msg = f"Failed to create interface '{iface_data.get('name', 'unknown')}': {str(e)}"
                logger.error(error_msg)
                created_interfaces.append(
                    {
                        "name": iface_data.get("name", "unknown"),
                        "success": False,
                        "error": error_msg,
                    }
                )

        logger.info(
            f"Interface creation complete: {sum(1 for i in created_interfaces if i.get('success'))} succeeded, "
            f"{sum(1 for i in created_interfaces if not i.get('success'))} failed"
        )

        return created_interfaces, primary_ipv4_id
