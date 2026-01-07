"""
Device Update Service - Update existing devices in Nautobot.

This service handles updating devices from various sources (CSV, API, UI forms)
with validation, field updates, and interface management.

Based on the workflow from update_devices_task.py but redesigned to:
- Use DeviceCommonService for all shared utilities
- Support flexible input formats and device identification
- Handle primary_ip4 updates with automatic interface creation
- Return detailed results for caller inspection
"""

import logging
from typing import Optional, Dict, Any, List, Tuple
from services.nautobot import NautobotService
from services.nautobot.devices.common import DeviceCommonService

logger = logging.getLogger(__name__)


class DeviceUpdateService:
    """
    Service for updating devices in Nautobot.

    Handles the complete workflow:
    1. Resolve device ID from identifier (UUID/name/IP)
    2. Validate and resolve update data
    3. Update device properties via PATCH
    4. Update/create interfaces if needed
    5. Verify updates applied successfully
    """

    def __init__(self, nautobot_service: NautobotService):
        """
        Initialize the update service.

        Args:
            nautobot_service: NautobotService instance for API calls
        """
        self.nautobot = nautobot_service
        self.common = DeviceCommonService(nautobot_service)

    async def update_device(
        self,
        device_identifier: Dict[str, Any],
        update_data: Dict[str, Any],
        interface_config: Optional[Dict[str, str]] = None,
        interfaces: Optional[List[Dict[str, Any]]] = None,
        create_if_missing: bool = False,
    ) -> Dict[str, Any]:
        """
        Update a single device.

        Workflow:
        1. Resolve device UUID from identifier
        2. Validate and resolve update data (names → UUIDs)
        3. Update device properties via PATCH
        4. Update/create interfaces if needed
        5. Verify updates applied

        Args:
            device_identifier: Device identifier dict with at least one of:
                - id: Device UUID
                - name: Device name
                - ip_address: Primary IPv4 address

            update_data: Fields to update, can include:
                - status: Status name or UUID
                - platform: Platform name or UUID
                - role: Role name or UUID
                - location: Location name or UUID
                - device_type: Device type name or UUID
                - serial: Serial number
                - asset_tag: Asset tag
                - tags: List of tag names or comma-separated string
                - custom_fields: Dict of custom field values
                - primary_ip4: IP address (will create interface if needed)
                - Any other device field

            interface_config: Optional interface config for primary_ip4 updates (legacy):
                {
                    "name": "Loopback0",        # Default: "Loopback"
                    "type": "virtual",          # Default: "virtual"
                    "status": "active",         # Default: "active"
                }

            interfaces: Optional list of interfaces to create/update:
                [
                    {
                        "name": "Ethernet0/0",
                        "type": "1000base-t",
                        "status": "active",
                        "ip_address": "192.168.1.1/24",
                        "namespace": "Global",
                        "is_primary_ipv4": True,
                        "enabled": True,
                        "description": "...",
                        ...
                    },
                    ...
                ]

            create_if_missing: If True, create device if not found (uses DeviceImportService)

        Returns:
            {
                "success": bool,
                "device_id": str,
                "device_name": str,
                "message": str,
                "updated_fields": List[str],
                "warnings": List[str],
                "interfaces_created": int,
                "interfaces_failed": int,
                "details": {
                    "before": {...},  # Device state before update
                    "after": {...},   # Device state after update
                    "changes": {...}  # Fields that changed
                }
            }

        Raises:
            ValueError: If device not found and create_if_missing=False
            Exception: If update fails
        """
        logger.info(f"Starting device update for: {device_identifier}")

        warnings = []
        details = {
            "before": None,
            "after": None,
            "changes": {},
        }

        try:
            # Step 1: Resolve device ID
            logger.info("Step 1: Resolving device ID")
            device_id, device_name = await self._resolve_device_id(device_identifier)

            if not device_id:
                if create_if_missing:
                    # TODO: Call DeviceImportService to create device
                    # For now, raise error
                    raise ValueError(
                        "Device not found and create_if_missing not yet implemented"
                    )
                else:
                    raise ValueError(
                        f"Device not found with identifier: {device_identifier}"
                    )

            # Get device state before update (with depth=1 to get full primary_ip4 object)
            details["before"] = await self.common.get_device_details(
                device_id=device_id, depth=1
            )

            # Extract current primary_ip4 for updating existing interface
            current_primary_ip4 = await self.common.extract_primary_ip_address(
                details["before"]
            )

            # Step 2: Validate and resolve update data
            logger.info("Step 2: Validating and resolving update data")
            validated_data, ip_namespace = await self.validate_update_data(
                device_id, update_data, interface_config
            )

            # Only return early if BOTH validated_data AND interfaces are empty
            if not validated_data and not interfaces:
                logger.info(f"No fields to update and no interfaces for device {device_name}")
                return {
                    "success": True,
                    "device_id": device_id,
                    "device_name": device_name,
                    "message": f"Device '{device_name}' - no fields to update and no interfaces",
                    "updated_fields": [],
                    "warnings": ["No fields to update and no interfaces"],
                    "details": details,
                }

            # Log what we're going to process
            if not validated_data and interfaces:
                logger.info(f"No device fields to update, but processing {len(interfaces)} interface(s)")

            # Step 3: Update device properties (if any)
            updated_fields = []
            if validated_data:
                logger.info(f"Step 3: Updating device {device_name} with {len(validated_data)} field(s)")
                updated_fields = await self._update_device_properties(
                    device_id=device_id,
                    validated_data=validated_data,
                    interface_config=interface_config,
                    ip_namespace=ip_namespace,
                    device_name=device_name,
                    current_primary_ip4=current_primary_ip4,
                )
            else:
                logger.info(f"Step 3: Skipping device property updates (no fields to update)")

            # Step 3.5: Create/update interfaces if provided
            interfaces_created = 0
            interfaces_updated = 0
            interfaces_failed = 0
            if interfaces:
                logger.info(f"Step 3.5: Creating/updating {len(interfaces)} interface(s)")
                interface_result = await self._update_device_interfaces(
                    device_id=device_id,
                    interfaces=interfaces,
                )
                interfaces_created = interface_result.get("interfaces_created", 0)
                interfaces_updated = interface_result.get("interfaces_updated", 0)
                interfaces_failed = interface_result.get("interfaces_failed", 0)
                warnings.extend(interface_result.get("warnings", []))
                logger.info(f"Interface update complete: {interfaces_created} created, {interfaces_updated} updated, {interfaces_failed} failed")

            # Get device state after update
            details["after"] = await self.common.get_device_details(
                device_id=device_id, depth=0
            )

            # Track changes
            details["changes"] = {
                field: {
                    "from": details["before"].get(field),
                    "to": details["after"].get(field),
                }
                for field in updated_fields
            }

            # Step 4: Verify updates (optional)
            logger.info("Step 4: Verifying updates")
            verification_passed, mismatches = await self.common.verify_device_updates(
                device_id, validated_data, details["after"]
            )

            if not verification_passed:
                warnings.append("Some updates may not have been applied correctly")
                # Add detailed mismatch info to warnings
                for mismatch in mismatches:
                    warnings.append(
                        f"{mismatch['field']}: expected {mismatch['expected']}, got {mismatch['actual']}"
                    )

            # Success!
            success_message = f"Device '{device_name}' updated successfully"
            if interfaces_created > 0 or interfaces_updated > 0:
                success_message += f" ({interfaces_created} interface(s) created, {interfaces_updated} updated)"

            return {
                "success": True,
                "device_id": device_id,
                "device_name": device_name,
                "message": success_message,
                "updated_fields": updated_fields,
                "warnings": warnings,
                "interfaces_created": interfaces_created,
                "interfaces_updated": interfaces_updated,
                "interfaces_failed": interfaces_failed,
                "details": details,
            }

        except Exception as e:
            error_msg = f"Failed to update device {device_identifier}: {str(e)}"
            logger.error(error_msg, exc_info=True)

            return {
                "success": False,
                "device_id": None,
                "device_name": device_identifier.get("name", "unknown"),
                "message": error_msg,
                "updated_fields": [],
                "warnings": warnings,
                "details": details,
            }

    async def _resolve_device_id(
        self, device_identifier: Dict[str, Any]
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Resolve device UUID and name from identifier.

        Args:
            device_identifier: Dict with id, name, or ip_address

        Returns:
            Tuple of (device_id, device_name)

        Raises:
            ValueError: If no valid identifier provided
        """
        device_id = device_identifier.get("id")
        device_name = device_identifier.get("name")
        ip_address = device_identifier.get("ip_address")

        if not any([device_id, device_name, ip_address]):
            raise ValueError(
                "Device identifier must include at least one of: id, name, ip_address"
            )

        # Use common service to resolve
        resolved_id = await self.common.resolve_device_id(
            device_id=device_id,
            device_name=device_name,
            ip_address=ip_address,
        )

        if not resolved_id:
            return None, None

        # If we don't have the name yet, fetch it
        if not device_name:
            device_response = await self.nautobot.rest_request(
                endpoint=f"dcim/devices/{resolved_id}/",
                method="GET",
            )
            device_name = device_response.get("name", resolved_id)

        logger.info(f"Resolved device: {device_name} ({resolved_id})")
        return resolved_id, device_name

    async def validate_update_data(
        self,
        device_id: str,
        update_data: Dict[str, Any],
        interface_config: Optional[Dict[str, str]] = None,
    ) -> Tuple[Dict[str, Any], Optional[str]]:
        """
        Validate update data and resolve all resource names to UUIDs.

        Args:
            device_id: Device UUID (for context)
            update_data: Raw update data dictionary
            interface_config: Optional interface config for primary_ip4

        Returns:
            Tuple of (validated_data dict, ip_namespace str or None)

        Note:
            - Filters out empty values
            - Handles nested fields like "platform.name" → "platform"
            - Resolves all names to UUIDs
            - Normalizes tags to list format
        """
        logger.debug(f"Validating update data for device {device_id}: {update_data}")

        validated = {}
        ip_namespace = None

        for field, value in update_data.items():
            # Skip empty values
            if value is None or (isinstance(value, str) and not value.strip()):
                continue

            # Handle nested fields (e.g., "platform.name" → "platform")
            if "." in field:
                base_field, nested_field = field.rsplit(".", 1)
                field = base_field
                logger.debug(
                    f"Flattened nested field: {field}.{nested_field} → {field}"
                )

            # Clean string values
            if isinstance(value, str):
                value = value.strip()

            # Handle special fields that need resolution
            if field == "status":
                # Resolve status name to UUID
                if not self.common._is_valid_uuid(value):
                    validated[field] = await self.common.resolve_status_id(
                        value, "dcim.device"
                    )
                else:
                    validated[field] = value

            elif field == "platform":
                # Resolve platform name to UUID
                if not self.common._is_valid_uuid(value):
                    platform_id = await self.common.resolve_platform_id(value)
                    if platform_id:
                        validated[field] = platform_id
                    else:
                        logger.warning(f"Platform '{value}' not found, will be omitted")
                else:
                    validated[field] = value

            elif field == "role":
                # Resolve role name to UUID
                if not self.common._is_valid_uuid(value):
                    role_id = await self.common.resolve_role_id(value)
                    if role_id:
                        validated[field] = role_id
                    else:
                        logger.warning(f"Role '{value}' not found, will be omitted")
                else:
                    validated[field] = value

            elif field == "location":
                # Resolve location name to UUID
                if not self.common._is_valid_uuid(value):
                    location_id = await self.common.resolve_location_id(value)
                    if location_id:
                        validated[field] = location_id
                    else:
                        logger.warning(f"Location '{value}' not found, will be omitted")
                else:
                    validated[field] = value

            elif field == "device_type":
                # Resolve device type name to UUID
                if not self.common._is_valid_uuid(value):
                    device_type_id = await self.common.resolve_device_type_id(value)
                    if device_type_id:
                        validated[field] = device_type_id
                    else:
                        logger.warning(
                            f"Device type '{value}' not found, will be omitted"
                        )
                else:
                    validated[field] = value

            elif field == "tags":
                # Normalize tags to list
                validated[field] = self.common.normalize_tags(value)

            elif field == "ip_namespace":
                # Store for later use with primary_ip4
                ip_namespace = value

            elif field == "custom_fields":
                # Ensure custom_fields is a simple dict (Nautobot expects {"field_name": "value"})
                if isinstance(value, dict):
                    validated[field] = value
                else:
                    logger.warning(
                        f"Invalid custom_fields format: {type(value)}, expected dict"
                    )

            else:
                # Copy other fields as-is (including primary_ip4, etc.)
                validated[field] = value

        logger.info(f"Validation complete, {len(validated)} fields to update")
        logger.debug(f"Validated data: {validated}")

        return validated, ip_namespace

    async def _update_device_properties(
        self,
        device_id: str,
        validated_data: Dict[str, Any],
        interface_config: Optional[Dict[str, str]] = None,
        ip_namespace: Optional[str] = None,
        device_name: Optional[str] = None,
        current_primary_ip4: Optional[str] = None,
    ) -> List[str]:
        """
        Update device properties via PATCH request.

        Special handling for primary_ip4:
        - If createOnIpChange=true: Creates new interface with new IP
        - If createOnIpChange=false: Updates existing interface's IP address

        Args:
            device_id: Device UUID
            validated_data: Validated update data with UUIDs
            interface_config: Optional interface config for primary_ip4
            ip_namespace: Optional IP namespace for primary_ip4
            device_name: Device name (required for updating existing interface)
            current_primary_ip4: Current primary IP address (for finding interface to update)

        Returns:
            List of updated field names
        """
        logger.info(f"Updating device {device_id} via REST API")
        logger.debug(f"Update data: {validated_data}")

        # Make a copy so we don't modify the original
        update_payload = validated_data.copy()
        updated_fields = list(update_payload.keys())

        # Special handling for primary_ip4
        if "primary_ip4" in update_payload:
            primary_ip4 = update_payload["primary_ip4"]
            logger.info(f"Processing primary_ip4 update: {primary_ip4}")

            # Use interface config if provided, otherwise use defaults
            if not interface_config:
                interface_config = {
                    "name": "Loopback",
                    "type": "virtual",
                    "status": "active",
                    "mgmt_interface_create_on_ip_change": False,
                }

            # Use namespace if provided, otherwise default to "Global"
            namespace = ip_namespace or "Global"

            # Check if we should create a new interface or update existing
            create_new = interface_config.get(
                "mgmt_interface_create_on_ip_change", False
            )
            logger.info(f"Create new interface on IP change: {create_new}")

            # Get add_prefixes_automatically flag (default to False for backward compatibility)
            add_prefixes_automatically = interface_config.get(
                "add_prefixes_automatically", False
            )
            logger.info(f"Add prefixes automatically: {add_prefixes_automatically}")

            # Get use_assigned_ip_if_exists flag (default to False for backward compatibility)
            use_assigned_ip_if_exists = interface_config.get(
                "use_assigned_ip_if_exists", False
            )
            logger.info(f"Use assigned IP if exists: {use_assigned_ip_if_exists}")

            if create_new:
                # BEHAVIOR 1: Create new interface with new IP (existing behavior)
                logger.info("Creating new interface with new IP address")
                ip_id = await self.common.ensure_interface_with_ip(
                    device_id=device_id,
                    ip_address=primary_ip4,
                    interface_name=interface_config.get("name", "Loopback"),
                    interface_type=interface_config.get("type", "virtual"),
                    interface_status=interface_config.get("status", "active"),
                    ip_namespace=namespace,
                    add_prefixes_automatically=add_prefixes_automatically,
                    use_assigned_ip_if_exists=use_assigned_ip_if_exists,
                )
            else:
                # BEHAVIOR 2: Update existing interface's IP address
                logger.info("Updating existing interface's IP address")
                ip_id = await self.common.update_interface_ip(
                    device_id=device_id,
                    device_name=device_name,
                    old_ip=current_primary_ip4,
                    new_ip=primary_ip4,
                    namespace=namespace,
                    add_prefixes_automatically=add_prefixes_automatically,
                    use_assigned_ip_if_exists=use_assigned_ip_if_exists,
                )

            # Update the payload to use the IP UUID instead of the address string
            update_payload["primary_ip4"] = ip_id
            logger.info(f"Updated primary_ip4 to use IP UUID: {ip_id}")

        # PATCH the device
        endpoint = f"dcim/devices/{device_id}/"
        result = await self.nautobot.rest_request(
            endpoint=endpoint,
            method="PATCH",
            data=update_payload,
        )

        # Verify primary_ip4 was set if it was in the update
        if "primary_ip4" in update_payload:
            expected_ip_id = update_payload["primary_ip4"]
            actual_ip = result.get("primary_ip4", {})
            actual_ip_id = (
                actual_ip.get("id") if isinstance(actual_ip, dict) else actual_ip
            )

            if actual_ip_id != expected_ip_id:
                error_msg = (
                    f"Device update verification failed: primary_ip4 mismatch "
                    f"(expected {expected_ip_id}, got {actual_ip_id})"
                )
                logger.error(error_msg)
                logger.error(f"Full update result: {result}")
                raise ValueError(error_msg)

            logger.info(
                f"✓ Successfully verified device {device_id} primary_ip4 is set to {expected_ip_id}"
            )

        logger.info(f"Successfully updated device {device_id}")
        return updated_fields

    async def _update_device_interfaces(
        self,
        device_id: str,
        interfaces: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Create or update multiple interfaces for a device.

        This method handles:
        1. Creating IP addresses in IPAM
        2. Creating interfaces on the device
        3. Assigning IP addresses to interfaces
        4. Setting primary IPv4 if specified

        Args:
            device_id: Device UUID
            interfaces: List of interface dicts with format:
                {
                    "name": "Ethernet0/0",
                    "type": "1000base-t",
                    "status": "active",
                    "ip_address": "192.168.1.1/24",  # Optional
                    "namespace": "Global",            # Required if ip_address provided
                    "is_primary_ipv4": True,          # Optional
                    "enabled": True,                  # Optional
                    "description": "...",             # Optional
                    ... (other interface properties)
                }

        Returns:
            Dict with:
                - interfaces_created: Number of interfaces created
                - interfaces_failed: Number of interfaces that failed
                - ip_addresses_created: Number of IP addresses created
                - primary_ip4_id: Primary IPv4 ID if set
                - warnings: List of warning messages
        """
        logger.info(f"Creating/updating {len(interfaces)} interface(s) for device {device_id}")

        created_interfaces = []
        updated_interfaces = []  # Interfaces that already existed
        failed_interfaces = []
        ip_address_map = {}  # Maps interface name to IP ID
        primary_ipv4_id = None
        warnings = []
        cleaned_interfaces = set()  # Track which interfaces we've already cleaned IPs from

        # Step 1: Create IP addresses first
        for interface in interfaces:
            if not interface.get("ip_address"):
                continue

            ip_address = interface["ip_address"]
            namespace = interface.get("namespace", "Global")
            status = interface.get("status", "active")
            ip_role = interface.get("ip_role")  # Optional: "Secondary" for secondary IPs

            if not namespace:
                warnings.append(f"Interface {interface['name']}: namespace required for IP {ip_address}, skipping IP creation")
                continue

            try:
                # Resolve status name to UUID if needed
                if not self.common._is_valid_uuid(status):
                    status_id = await self.common.resolve_status_id(status, "ipam.ipaddress")
                else:
                    status_id = status

                # Resolve namespace name to UUID if needed
                if not self.common._is_valid_uuid(namespace):
                    namespace_id = await self.common.resolve_namespace_id(namespace)
                else:
                    namespace_id = namespace

                # Resolve role name to ID if provided
                role_id = None
                if ip_role:
                    # Role is typically "Secondary", "Anycast", etc.
                    # Keep the original case (Nautobot uses "Secondary" not "secondary")
                    role_id = ip_role

                # Create or get existing IP address
                ip_payload = {
                    "address": ip_address,
                    "status": status_id,
                    "namespace": namespace_id,
                }

                # Add role if specified
                if role_id:
                    ip_payload["role"] = role_id

                try:
                    ip_response = await self.nautobot.rest_request(
                        endpoint="ipam/ip-addresses/",
                        method="POST",
                        data=ip_payload,
                    )
                    if ip_response and "id" in ip_response:
                        ip_address_map[interface["name"]] = ip_response["id"]
                        logger.info(f"Created IP address {ip_address} with ID: {ip_response['id']}")

                except Exception as create_error:
                    error_msg = str(create_error)

                    # If IP already exists, look it up
                    if "already exists" in error_msg.lower():
                        logger.info(f"IP address {ip_address} already exists, looking it up...")

                        # Try to find the existing IP address
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
                                    ip_address_map[interface["name"]] = ip_id
                                    logger.info(f"Found existing IP address {ip_address} with ID: {ip_id}")
                                else:
                                    warnings.append(f"Interface {interface['name']}: IP {ip_address} exists but could not be found")

                        except Exception as lookup_error:
                            warnings.append(f"Interface {interface['name']}: Failed to lookup existing IP {ip_address}: {str(lookup_error)}")
                    else:
                        warnings.append(f"Interface {interface['name']}: Failed to create IP {ip_address}: {error_msg}")

            except Exception as e:
                warnings.append(f"Interface {interface['name']}: Error processing IP address: {str(e)}")

        # Step 2: Create interfaces
        for interface in interfaces:
            try:
                # Resolve status name to UUID if needed
                interface_status = interface.get("status", "active")
                if not self.common._is_valid_uuid(interface_status):
                    interface_status_id = await self.common.resolve_status_id(interface_status, "dcim.interface")
                else:
                    interface_status_id = interface_status

                interface_payload = {
                    "name": interface["name"],
                    "device": device_id,
                    "type": interface["type"],
                    "status": interface_status_id,
                }

                # Add optional properties
                if "enabled" in interface and interface["enabled"] is not None:
                    interface_payload["enabled"] = interface["enabled"]
                if "mgmt_only" in interface and interface["mgmt_only"] is not None:
                    interface_payload["mgmt_only"] = interface["mgmt_only"]
                if interface.get("description"):
                    interface_payload["description"] = interface["description"]
                if interface.get("mac_address"):
                    interface_payload["mac_address"] = interface["mac_address"]
                if interface.get("mtu"):
                    interface_payload["mtu"] = interface["mtu"]
                if interface.get("mode"):
                    interface_payload["mode"] = interface["mode"]

                # Create the interface (or get existing if already exists)
                interface_id = None
                try:
                    interface_response = await self.nautobot.rest_request(
                        endpoint="dcim/interfaces/",
                        method="POST",
                        data=interface_payload,
                    )

                    if interface_response and "id" in interface_response:
                        interface_id = interface_response["id"]
                        logger.info(f"Created interface {interface['name']} with ID: {interface_id}")
                        created_interfaces.append(interface["name"])

                except Exception as create_error:
                    error_msg = str(create_error)

                    # Check if this is a "unique set" error (interface already exists)
                    if "must make a unique set" in error_msg.lower():
                        logger.info(f"Interface {interface['name']} already exists, looking it up...")

                        # Look up the existing interface
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
                                "name": [interface["name"]],
                            }

                            result = await self.nautobot.graphql_query(query, variables)

                            if result and "data" in result and "interfaces" in result["data"]:
                                interfaces_list = result["data"]["interfaces"]
                                if interfaces_list and len(interfaces_list) > 0:
                                    existing_interface = interfaces_list[0]
                                    interface_id = existing_interface["id"]
                                    logger.info(f"Found existing interface {interface['name']} with ID: {interface_id}")
                                    updated_interfaces.append(interface["name"])
                                else:
                                    warnings.append(f"Interface {interface['name']}: Interface exists but could not be found via GraphQL")
                                    continue

                        except Exception as lookup_error:
                            warnings.append(f"Interface {interface['name']}: Failed to lookup existing interface: {str(lookup_error)}")
                            continue
                    else:
                        # Different error, re-raise
                        raise

                if interface_id:
                    # First, unassign any existing IP addresses from the interface (only once per interface)
                    if interface_id not in cleaned_interfaces:
                        try:
                            # Get all existing IP assignments for this interface
                            existing_assignments_endpoint = f"ipam/ip-address-to-interface/?interface={interface_id}&format=json"
                            existing_assignments = await self.nautobot.rest_request(
                                endpoint=existing_assignments_endpoint,
                                method="GET"
                            )

                            if existing_assignments and existing_assignments.get("count", 0) > 0:
                                logger.info(f"Found {existing_assignments['count']} existing IP assignment(s) on interface {interface['name']}, removing them...")
                                for assignment in existing_assignments.get("results", []):
                                    assignment_id = assignment["id"]
                                    try:
                                        await self.nautobot.rest_request(
                                            endpoint=f"ipam/ip-address-to-interface/{assignment_id}/",
                                            method="DELETE"
                                        )
                                        logger.info(f"Unassigned IP assignment {assignment_id} from interface {interface['name']}")
                                    except Exception as delete_error:
                                        warnings.append(f"Interface {interface['name']}: Failed to unassign existing IP: {str(delete_error)}")

                            # Mark this interface as cleaned
                            cleaned_interfaces.add(interface_id)

                        except Exception as e:
                            warnings.append(f"Interface {interface['name']}: Failed to check existing IP assignments: {str(e)}")
                    else:
                        logger.info(f"Interface {interface['name']} already cleaned in this run, skipping unassignment")

                    # Assign IP address to interface if available
                    if interface["name"] in ip_address_map:
                        ip_id = ip_address_map[interface["name"]]
                        try:
                            assignment_payload = {
                                "ip_address": ip_id,
                                "interface": interface_id,
                            }
                            await self.nautobot.rest_request(
                                endpoint="ipam/ip-address-to-interface/",
                                method="POST",
                                data=assignment_payload,
                            )
                            logger.info(f"Assigned IP to interface {interface['name']}")

                            # Check if this should be the primary IPv4
                            is_ipv4 = interface.get("ip_address") and ":" not in interface["ip_address"]

                            if is_ipv4:
                                if interface.get("is_primary_ipv4"):
                                    primary_ipv4_id = ip_id
                                    logger.info(f"Interface {interface['name']} marked as primary IPv4 (explicit)")
                                elif primary_ipv4_id is None:
                                    primary_ipv4_id = ip_id
                                    logger.info(f"Interface {interface['name']} set as primary IPv4 (first IPv4 found)")

                        except Exception as e:
                            warnings.append(f"Interface {interface['name']}: Failed to assign IP address: {str(e)}")

            except Exception as e:
                error_msg = str(e)
                failed_interfaces.append(interface["name"])
                warnings.append(f"Interface {interface['name']}: Failed to process interface: {error_msg}")
                logger.error(f"Error processing interface {interface['name']}: {error_msg}")

        # Step 3: Set primary IPv4 if found
        if primary_ipv4_id:
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

        return {
            "interfaces_created": len(created_interfaces),
            "interfaces_updated": len(updated_interfaces),
            "interfaces_failed": len(failed_interfaces),
            "ip_addresses_created": len(ip_address_map),
            "primary_ip4_id": primary_ipv4_id,
            "warnings": warnings,
        }
