"""
Device Common Service - Shared utilities for device import and update operations.

This service provides reusable functions for:
- Name-to-UUID resolution (devices, platforms, statuses, namespaces, etc.)
- Data validation and normalization
- Interface and IP address management
- Error handling patterns

Used by both DeviceImportService and DeviceUpdateService.
"""

import logging
import re
from typing import Optional, List, Dict, Any, Tuple
from services.nautobot import NautobotService

logger = logging.getLogger(__name__)


class DeviceCommonService:
    """
    Common service providing shared utilities for device operations.

    This service encapsulates all shared logic between import and update
    workflows, ensuring DRY principles and consistent behavior.
    """

    def __init__(self, nautobot_service: NautobotService):
        """
        Initialize the common service.

        Args:
            nautobot_service: NautobotService instance for API calls
        """
        self.nautobot = nautobot_service

    # ========================================================================
    # DEVICE RESOLUTION METHODS
    # ========================================================================

    async def resolve_device_by_name(self, device_name: str) -> Optional[str]:
        """
        Resolve device UUID from device name using GraphQL.

        Args:
            device_name: Name of the device to look up

        Returns:
            Device UUID if found, None otherwise
        """
        try:
            logger.info(f"Looking up device by name: {device_name}")

            query = """
            query GetDeviceByName($name: [String]) {
              devices(name: $name) {
                id
                name
              }
            }
            """
            variables = {"name": [device_name]}
            result = await self.nautobot.graphql_query(query, variables)

            if "errors" in result:
                logger.error(
                    f"GraphQL error looking up device by name: {result['errors']}"
                )
                return None

            devices = result.get("data", {}).get("devices", [])
            if devices and len(devices) > 0:
                device_id = devices[0].get("id")
                logger.info(f"Found device by name '{device_name}': {device_id}")
                return device_id

            logger.warning(f"No device found with name: {device_name}")
            return None

        except Exception as e:
            logger.error(f"Error resolving device by name: {e}", exc_info=True)
            return None

    async def resolve_device_by_ip(self, ip_address: str) -> Optional[str]:
        """
        Resolve device UUID from primary IPv4 address using GraphQL.

        Looks up the IP address object and returns the device it's assigned
        to as primary IP.

        Args:
            ip_address: Primary IPv4 address to search for

        Returns:
            Device UUID if found, None otherwise
        """
        try:
            logger.info(f"Looking up device by primary IPv4: {ip_address}")

            # Query for IP address and get the device it's assigned to as primary IP
            query = """
            query GetIPAddress($address: [String]) {
              ip_addresses(address: $address) {
                id
                address
                primary_ip4_for {
                  id
                  name
                }
              }
            }
            """
            variables = {"address": [ip_address]}
            result = await self.nautobot.graphql_query(query, variables)

            if "errors" in result:
                logger.error(f"GraphQL error looking up IP address: {result['errors']}")
                return None

            ip_addresses = result.get("data", {}).get("ip_addresses", [])
            if not ip_addresses or len(ip_addresses) == 0:
                logger.warning(f"No IP address found: {ip_address}")
                return None

            # Get the device from primary_ip4_for
            ip_obj = ip_addresses[0]
            devices = ip_obj.get("primary_ip4_for")

            if not devices:
                logger.warning(
                    f"IP address {ip_address} is not set as primary IP for any device"
                )
                return None

            # primary_ip4_for can be a list or a single device
            if isinstance(devices, list):
                if len(devices) == 0:
                    logger.warning(
                        f"IP address {ip_address} is not set as primary IP for any device"
                    )
                    return None
                device = devices[0]
            else:
                device = devices

            device_id = device.get("id")
            device_name = device.get("name")
            logger.info(
                f"Found device by IP '{ip_address}': {device_name} ({device_id})"
            )
            return device_id

        except Exception as e:
            logger.error(f"Error resolving device by IP: {e}", exc_info=True)
            return None

    async def resolve_device_id(
        self,
        device_id: Optional[str] = None,
        device_name: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> Optional[str]:
        """
        Resolve device UUID from any available identifier.

        Tries in order: device_id (if valid), device_name, ip_address

        Args:
            device_id: Device UUID (if already known)
            device_name: Device name to search for
            ip_address: Primary IPv4 address to search for

        Returns:
            Device UUID if found, None otherwise
        """
        # If device_id is already provided, validate and return it
        if device_id:
            # Basic UUID validation
            if self._is_valid_uuid(device_id):
                logger.debug(f"Using provided device ID: {device_id}")
                return device_id
            else:
                logger.warning(f"Invalid device ID format: {device_id}")

        # Try resolving by name
        if device_name:
            device_id = await self.resolve_device_by_name(device_name)
            if device_id:
                return device_id

        # Try resolving by IP address
        if ip_address:
            device_id = await self.resolve_device_by_ip(ip_address)
            if device_id:
                return device_id

        logger.error("Could not resolve device ID from any identifier")
        return None

    async def find_interface_with_ip(
        self, device_name: str, ip_address: str
    ) -> Optional[Tuple[str, str]]:
        """
        Find the interface that currently has a specific IP address on a device.

        Args:
            device_name: Name of the device
            ip_address: IP address to search for (in CIDR notation, e.g., "10.0.0.1/24")

        Returns:
            Tuple of (interface_id, interface_name) if found, None otherwise
        """
        try:
            logger.info(
                f"Finding interface with IP {ip_address} on device {device_name}"
            )

            query = """
            query ($filter_device: [String], $filter_address: [String]) {
              devices(name: $filter_device) {
                id
                name
                interfaces(ip_addresses: $filter_address) {
                  id
                  name
                }
              }
            }
            """
            variables = {
                "filter_device": [device_name],
                "filter_address": [ip_address],
            }

            result = await self.nautobot.graphql_query(query, variables)

            if "errors" in result:
                logger.error(
                    f"GraphQL error finding interface with IP: {result['errors']}"
                )
                return None

            devices = result.get("data", {}).get("devices", [])
            if not devices or len(devices) == 0:
                logger.warning(f"Device '{device_name}' not found")
                return None

            device = devices[0]
            interfaces = device.get("interfaces", [])

            if not interfaces or len(interfaces) == 0:
                logger.info(
                    f"No interface found with IP {ip_address} on device {device_name}"
                )
                return None

            # Return the first interface with this IP
            interface = interfaces[0]
            interface_id = interface.get("id")
            interface_name = interface.get("name")

            logger.info(
                f"Found interface '{interface_name}' (ID: {interface_id}) with IP {ip_address}"
            )
            return (interface_id, interface_name)

        except Exception as e:
            logger.error(f"Error finding interface with IP: {e}", exc_info=True)
            return None

    # ========================================================================
    # RESOURCE RESOLUTION METHODS
    # ========================================================================

    async def resolve_status_id(
        self, status_name: str, content_type: str = "dcim.device"
    ) -> str:
        """
        Resolve a status name to its UUID using REST API.

        Args:
            status_name: Name of the status (e.g., "active", "planned")
            content_type: Content type for the status
                         (e.g., "dcim.device", "dcim.interface", "ipam.ipaddress")

        Returns:
            Status UUID

        Raises:
            ValueError: If status not found
        """
        logger.info(
            f"Resolving status '{status_name}' for content type '{content_type}'"
        )

        # Query for statuses filtered by content type
        endpoint = f"extras/statuses/?content_types={content_type}&format=json"
        result = await self.nautobot.rest_request(endpoint=endpoint, method="GET")

        if result and result.get("count", 0) > 0:
            for status in result.get("results", []):
                if status.get("name", "").lower() == status_name.lower():
                    logger.info(
                        f"Resolved status '{status_name}' to UUID {status['id']}"
                    )
                    return status["id"]

        raise ValueError(
            f"Status '{status_name}' not found for content type '{content_type}'"
        )

    async def resolve_namespace_id(self, namespace_name: str) -> str:
        """
        Resolve a namespace name to its UUID using GraphQL.

        Args:
            namespace_name: Name of the namespace (e.g., "Global")

        Returns:
            Namespace UUID

        Raises:
            ValueError: If namespace not found
        """
        logger.info(f"Resolving namespace '{namespace_name}'")

        query = f"""
        query {{
            namespaces(name: "{namespace_name}") {{
                id
                name
            }}
        }}
        """
        result = await self.nautobot.graphql_query(query)

        if "errors" in result:
            raise ValueError(
                f"GraphQL errors while resolving namespace: {result['errors']}"
            )

        namespaces = result.get("data", {}).get("namespaces", [])
        if namespaces:
            namespace_id = namespaces[0]["id"]
            logger.info(f"Resolved namespace '{namespace_name}' to UUID {namespace_id}")
            return namespace_id

        raise ValueError(f"Namespace '{namespace_name}' not found")

    async def resolve_platform_id(self, platform_name: str) -> Optional[str]:
        """
        Resolve platform name to UUID using GraphQL.

        Args:
            platform_name: Name of the platform

        Returns:
            Platform UUID if found, None otherwise
        """
        try:
            logger.info(f"Resolving platform '{platform_name}'")

            query = """
            query GetPlatform($name: String!) {
              platforms(name: $name) {
                id
                name
              }
            }
            """
            variables = {"name": platform_name}
            result = await self.nautobot.graphql_query(query, variables)

            if "errors" in result:
                logger.error(f"GraphQL error resolving platform: {result['errors']}")
                return None

            platforms = result.get("data", {}).get("platforms", [])
            if platforms and len(platforms) > 0:
                platform_id = platforms[0]["id"]
                logger.info(
                    f"Resolved platform '{platform_name}' to UUID {platform_id}"
                )
                return platform_id

            logger.warning(f"Platform not found: {platform_name}")
            return None

        except Exception as e:
            logger.error(f"Error resolving platform: {e}", exc_info=True)
            return None

    async def resolve_role_id(self, role_name: str) -> Optional[str]:
        """
        Resolve role name to UUID using GraphQL.

        Args:
            role_name: Name of the role

        Returns:
            Role UUID if found, None otherwise
        """
        try:
            logger.info(f"Resolving role '{role_name}'")

            query = """
            query GetRole($name: [String]) {
              roles(name: $name) {
                id
                name
              }
            }
            """
            variables = {"name": [role_name]}
            result = await self.nautobot.graphql_query(query, variables)

            if "errors" in result:
                logger.error(f"GraphQL error resolving role: {result['errors']}")
                return None

            roles = result.get("data", {}).get("roles", [])
            if roles and len(roles) > 0:
                role_id = roles[0]["id"]
                logger.info(f"Resolved role '{role_name}' to UUID {role_id}")
                return role_id

            logger.warning(f"Role not found: {role_name}")
            return None

        except Exception as e:
            logger.error(f"Error resolving role: {e}", exc_info=True)
            return None

    async def resolve_location_id(self, location_name: str) -> Optional[str]:
        """
        Resolve location name to UUID using GraphQL.

        Args:
            location_name: Name of the location

        Returns:
            Location UUID if found, None otherwise
        """
        try:
            logger.info(f"Resolving location '{location_name}'")

            query = """
            query GetLocation($name: [String]) {
              locations(name: $name) {
                id
                name
              }
            }
            """
            variables = {"name": [location_name]}
            result = await self.nautobot.graphql_query(query, variables)

            if "errors" in result:
                logger.error(f"GraphQL error resolving location: {result['errors']}")
                return None

            locations = result.get("data", {}).get("locations", [])
            if locations and len(locations) > 0:
                location_id = locations[0]["id"]
                logger.info(
                    f"Resolved location '{location_name}' to UUID {location_id}"
                )
                return location_id

            logger.warning(f"Location not found: {location_name}")
            return None

        except Exception as e:
            logger.error(f"Error resolving location: {e}", exc_info=True)
            return None

    async def resolve_device_type_id(
        self, model: str, manufacturer: Optional[str] = None
    ) -> Optional[str]:
        """
        Resolve device type (model) to UUID using GraphQL.

        Args:
            model: Device type model name
            manufacturer: Optional manufacturer name for disambiguation

        Returns:
            Device type UUID if found, None otherwise
        """
        try:
            logger.info(
                f"Resolving device type '{model}'"
                + (f" from manufacturer '{manufacturer}'" if manufacturer else "")
            )

            # Build query with optional manufacturer filter
            if manufacturer:
                query = """
                query GetDeviceType($model: [String], $manufacturer: [String]) {
                  device_types(model: $model, manufacturer: $manufacturer) {
                    id
                    model
                    manufacturer {
                      name
                    }
                  }
                }
                """
                variables = {"model": [model], "manufacturer": [manufacturer]}
            else:
                query = """
                query GetDeviceType($model: [String]) {
                  device_types(model: $model) {
                    id
                    model
                    manufacturer {
                      name
                    }
                  }
                }
                """
                variables = {"model": [model]}

            result = await self.nautobot.graphql_query(query, variables)

            if "errors" in result:
                logger.error(f"GraphQL error resolving device type: {result['errors']}")
                return None

            device_types = result.get("data", {}).get("device_types", [])
            if device_types and len(device_types) > 0:
                device_type = device_types[0]
                device_type_id = device_type["id"]
                mfr_name = device_type.get("manufacturer", {}).get("name", "unknown")
                logger.info(
                    f"Resolved device type '{model}' ({mfr_name}) to UUID {device_type_id}"
                )
                return device_type_id

            logger.warning(f"Device type not found: {model}")
            return None

        except Exception as e:
            logger.error(f"Error resolving device type: {e}", exc_info=True)
            return None

    # ========================================================================
    # VALIDATION METHODS
    # ========================================================================

    def validate_required_fields(
        self, data: Dict[str, Any], required_fields: List[str]
    ) -> None:
        """
        Validate that all required fields are present in data.

        Args:
            data: Dictionary to validate
            required_fields: List of required field names

        Raises:
            ValueError: If any required field is missing or empty
        """
        missing_fields = []
        for field in required_fields:
            if field not in data or not data[field]:
                missing_fields.append(field)

        if missing_fields:
            raise ValueError(f"Missing required fields: {', '.join(missing_fields)}")

    def validate_ip_address(self, ip: str) -> bool:
        """
        Validate IP address format (IPv4 or IPv6, with or without CIDR).

        Args:
            ip: IP address string to validate

        Returns:
            True if valid, False otherwise
        """
        # Simple regex patterns for IPv4 and IPv6
        ipv4_pattern = r"^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$"
        ipv6_pattern = r"^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}(\/\d{1,3})?$"

        if re.match(ipv4_pattern, ip) or re.match(ipv6_pattern, ip):
            return True

        logger.warning(f"Invalid IP address format: {ip}")
        return False

    def validate_mac_address(self, mac: str) -> bool:
        """
        Validate MAC address format.

        Args:
            mac: MAC address string to validate

        Returns:
            True if valid, False otherwise
        """
        # Common MAC address formats: XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX
        mac_pattern = r"^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$"

        if re.match(mac_pattern, mac):
            return True

        logger.warning(f"Invalid MAC address format: {mac}")
        return False

    def _is_valid_uuid(self, uuid_str: str) -> bool:
        """
        Validate UUID format.

        Args:
            uuid_str: UUID string to validate

        Returns:
            True if valid UUID format, False otherwise
        """
        uuid_pattern = r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
        return bool(re.match(uuid_pattern, uuid_str.lower()))

    # ========================================================================
    # DATA PROCESSING METHODS
    # ========================================================================

    def flatten_nested_fields(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Flatten nested fields in data.

        For example, converts {"platform.name": "ios"} to {"platform": "ios"}

        Args:
            data: Dictionary with potentially nested field names

        Returns:
            Dictionary with flattened field names
        """
        flattened = {}

        for key, value in data.items():
            if "." in key:
                # Extract base field from nested notation
                base_field = key.split(".")[0]
                flattened[base_field] = value
            else:
                flattened[key] = value

        return flattened

    def extract_nested_value(self, data: Dict[str, Any], path: str) -> Any:
        """
        Extract value from nested dictionary using dot notation path.

        Args:
            data: Dictionary to extract from
            path: Dot-notation path (e.g., "platform.name")

        Returns:
            Extracted value or None if not found
        """
        keys = path.split(".")
        current = data

        for key in keys:
            if isinstance(current, dict) and key in current:
                current = current[key]
            else:
                return None

        return current

    def normalize_tags(self, tags: Any) -> List[str]:
        """
        Normalize tags to a list of strings.

        Handles:
        - Comma-separated string: "tag1,tag2,tag3"
        - List: ["tag1", "tag2", "tag3"]
        - Single string: "tag1"

        Args:
            tags: Tags in various formats

        Returns:
            List of tag strings
        """
        if not tags:
            return []

        if isinstance(tags, list):
            return [str(tag).strip() for tag in tags if str(tag).strip()]

        if isinstance(tags, str):
            # Check if comma-separated
            if "," in tags:
                return [tag.strip() for tag in tags.split(",") if tag.strip()]
            else:
                return [tags.strip()] if tags.strip() else []

        # Fallback: convert to string
        return [str(tags).strip()] if str(tags).strip() else []

    def prepare_update_data(
        self,
        row: Dict[str, str],
        headers: List[str],
        excluded_fields: Optional[List[str]] = None,
    ) -> Tuple[Dict[str, Any], Optional[Dict[str, str]], Optional[str]]:
        """
        Prepare update data from CSV row.

        Filters out empty values and excluded fields.
        Handles special fields like tags (converts to list).
        Handles nested fields like 'platform.name' by extracting just the nested value.
        Extracts interface configuration if present.

        Args:
            row: CSV row as dictionary
            headers: List of column headers
            excluded_fields: Optional list of fields to exclude (default: id, name, ip_address)

        Returns:
            Tuple of (update_data dict, interface_config dict or None, ip_namespace str or None)
        """
        update_data = {}
        interface_config = None
        ip_namespace = None

        # Default excluded fields (identifiers)
        if excluded_fields is None:
            excluded_fields = ["id", "name", "ip_address"]
        excluded_set = set(excluded_fields)

        # Interface configuration fields
        interface_fields = {
            "interface_name",
            "interface_type",
            "interface_status",
            "ip_namespace",
        }

        # Extract interface configuration if present
        if any(
            f in headers
            for f in ["interface_name", "interface_type", "interface_status"]
        ):
            interface_config = {
                "name": row.get("interface_name", "").strip() or "Loopback",
                "type": row.get("interface_type", "").strip() or "virtual",
                "status": row.get("interface_status", "").strip() or "active",
            }

        # Extract IP namespace if present
        if "ip_namespace" in headers:
            ip_namespace = row.get("ip_namespace", "").strip() or "Global"

        for field in headers:
            if field in excluded_set or field in interface_fields:
                continue

            value = row.get(field, "").strip()

            # Skip empty values
            if not value:
                continue

            # Handle special fields
            if field == "tags":
                # Tags should be a list
                update_data[field] = self.normalize_tags(value)
            # Handle nested fields (e.g., "platform.name" -> extract just the name)
            elif "." in field:
                base_field, nested_field = field.rsplit(".", 1)
                update_data[base_field] = value
            else:
                update_data[field] = value

        return update_data, interface_config, ip_namespace

    # ========================================================================
    # INTERFACE AND IP ADDRESS HELPERS
    # ========================================================================

    async def ensure_ip_address_exists(
        self, ip_address: str, namespace_id: str, status_name: str = "active", **kwargs
    ) -> str:
        """
        Ensure IP address exists in Nautobot.

        If IP already exists, returns its UUID.
        If not, creates it and returns the new UUID.

        Args:
            ip_address: IP address in CIDR format (e.g., "192.168.1.1/24")
            namespace_id: UUID of the namespace
            status_name: Status name for the IP (default: "active")
            **kwargs: Additional fields for IP creation

        Returns:
            IP address UUID

        Raises:
            Exception: If creation fails and IP doesn't exist
        """
        logger.info(f"Ensuring IP address exists: {ip_address}")

        # Check if IP already exists
        ip_search_endpoint = f"ipam/ip-addresses/?address={ip_address}&namespace={namespace_id}&format=json"
        ip_result = await self.nautobot.rest_request(
            endpoint=ip_search_endpoint, method="GET"
        )

        if ip_result and ip_result.get("count", 0) > 0:
            existing_ip = ip_result["results"][0]
            logger.info(f"IP address already exists: {existing_ip['id']}")
            return existing_ip["id"]

        # IP doesn't exist, create it
        logger.info(f"Creating new IP address: {ip_address}")

        # Resolve status to UUID
        status_id = await self.resolve_status_id(
            status_name, content_type="ipam.ipaddress"
        )

        ip_create_data = {
            "address": ip_address,
            "status": status_id,
            "namespace": namespace_id,
            **kwargs,  # Additional fields from caller
        }

        ip_create_result = await self.nautobot.rest_request(
            endpoint="ipam/ip-addresses/?format=json",
            method="POST",
            data=ip_create_data,
        )

        ip_id = ip_create_result["id"]
        logger.info(f"Created IP address: {ip_id}")
        return ip_id

    async def ensure_interface_exists(
        self,
        device_id: str,
        interface_name: str,
        interface_type: str = "virtual",
        interface_status: str = "active",
        **kwargs,
    ) -> str:
        """
        Ensure interface exists on device.

        If interface already exists, returns its UUID.
        If not, creates it and returns the new UUID.

        Args:
            device_id: Device UUID
            interface_name: Name of the interface
            interface_type: Type of interface (default: "virtual")
            interface_status: Status name for the interface (default: "active")
            **kwargs: Additional fields for interface creation

        Returns:
            Interface UUID

        Raises:
            Exception: If creation fails and interface doesn't exist
        """
        logger.info(
            f"Ensuring interface exists: {interface_name} on device {device_id}"
        )

        # Check if interface already exists
        interfaces_endpoint = (
            f"dcim/interfaces/?device_id={device_id}&name={interface_name}&format=json"
        )
        interfaces_result = await self.nautobot.rest_request(
            endpoint=interfaces_endpoint, method="GET"
        )

        if interfaces_result and interfaces_result.get("count", 0) > 0:
            existing_interface = interfaces_result["results"][0]
            logger.info(f"Interface already exists: {existing_interface['id']}")
            return existing_interface["id"]

        # Interface doesn't exist, create it
        logger.info(f"Creating new interface: {interface_name}")

        # Resolve status to UUID
        status_id = await self.resolve_status_id(
            interface_status, content_type="dcim.interface"
        )

        interface_data = {
            "device": device_id,
            "name": interface_name,
            "type": interface_type,
            "status": status_id,
            **kwargs,  # Additional fields from caller
        }

        interface_result = await self.nautobot.rest_request(
            endpoint="dcim/interfaces/?format=json", method="POST", data=interface_data
        )

        interface_id = interface_result["id"]
        logger.info(f"Created interface: {interface_id}")
        return interface_id

    async def assign_ip_to_interface(
        self, ip_id: str, interface_id: str, is_primary: bool = False
    ) -> dict:
        """
        Assign IP address to interface using IP-to-Interface association.

        Args:
            ip_id: IP address UUID
            interface_id: Interface UUID
            is_primary: Whether this is the primary IP for the device

        Returns:
            Association result dict

        Raises:
            Exception: If assignment fails
        """
        logger.info(f"Assigning IP {ip_id} to interface {interface_id}")

        # Check if association already exists
        check_endpoint = f"ipam/ip-address-to-interface/?ip_address={ip_id}&interface={interface_id}&format=json"
        existing_associations = await self.nautobot.rest_request(
            endpoint=check_endpoint, method="GET"
        )

        if existing_associations and existing_associations.get("count", 0) > 0:
            logger.info("IP-to-Interface association already exists")
            return existing_associations["results"][0]

        # Create new association
        logger.info("Creating new IP-to-Interface association")
        association_data = {
            "ip_address": ip_id,
            "interface": interface_id,
            "is_primary": is_primary,
        }

        association_result = await self.nautobot.rest_request(
            endpoint="ipam/ip-address-to-interface/?format=json",
            method="POST",
            data=association_data,
        )

        logger.info(f"Created IP-to-Interface association: {association_result['id']}")
        return association_result

    async def ensure_interface_with_ip(
        self,
        device_id: str,
        ip_address: str,
        interface_name: str = "Loopback",
        interface_type: str = "virtual",
        interface_status: str = "active",
        ip_namespace: str = "Global",
    ) -> str:
        """
        Ensure an interface exists with the specified IP address.

        High-level helper that combines multiple operations:
        1. Ensures IP address exists in IPAM
        2. Ensures interface exists on device
        3. Assigns IP to interface

        Args:
            device_id: Device UUID
            ip_address: IP address in CIDR format
            interface_name: Interface name (default: "Loopback")
            interface_type: Interface type (default: "virtual")
            interface_status: Interface status (default: "active")
            ip_namespace: IP namespace name (default: "Global")

        Returns:
            IP address UUID
        """
        logger.info(f"Ensuring interface with IP {ip_address} for device {device_id}")

        # Resolve namespace
        namespace_id = await self.resolve_namespace_id(ip_namespace)

        # Ensure IP exists
        ip_id = await self.ensure_ip_address_exists(
            ip_address=ip_address, namespace_id=namespace_id, status_name="active"
        )

        # Ensure interface exists
        interface_id = await self.ensure_interface_exists(
            device_id=device_id,
            interface_name=interface_name,
            interface_type=interface_type,
            interface_status=interface_status,
        )

        # Assign IP to interface
        await self.assign_ip_to_interface(
            ip_id=ip_id, interface_id=interface_id, is_primary=True
        )

        logger.info(
            f"Successfully ensured interface {interface_name} with IP {ip_address}"
        )
        return ip_id

    async def update_interface_ip(
        self,
        device_id: str,
        device_name: str,
        old_ip: Optional[str],
        new_ip: str,
        namespace: str,
    ) -> str:
        """
        Update an existing interface's IP address (instead of creating a new interface).

        This is a reusable utility that:
        1. Finds the interface that currently has the old IP address
        2. Creates/gets the new IP address in Nautobot
        3. Assigns the new IP to the existing interface

        This method can be used by both DeviceUpdateService and DeviceImportService.

        Args:
            device_id: Device UUID
            device_name: Device name (for GraphQL lookup)
            old_ip: Current IP address (to find the interface to update)
            new_ip: New IP address to assign
            namespace: IP namespace name (will be resolved to UUID)

        Returns:
            UUID of the new IP address

        Note:
            - If interface cannot be found, falls back to creating a new interface
            - Old IP will remain on the interface (Nautobot allows multiple IPs)
        """
        logger.info(
            f"Updating interface IP from {old_ip} to {new_ip} on device {device_name}"
        )

        # Step 1: Find the interface that currently has the old IP
        if old_ip:
            interface_info = await self.find_interface_with_ip(
                device_name=device_name, ip_address=old_ip
            )

            if interface_info:
                interface_id, interface_name = interface_info
                logger.info(
                    f"Found interface '{interface_name}' (ID: {interface_id}) with IP {old_ip}"
                )
            else:
                logger.warning(
                    f"Could not find interface with IP {old_ip}, creating new interface"
                )
                # Fallback: create new interface
                return await self.ensure_interface_with_ip(
                    device_id=device_id,
                    ip_address=new_ip,
                    interface_name="Loopback",
                    interface_type="virtual",
                    interface_status="active",
                    ip_namespace=namespace,
                )
        else:
            logger.warning("No old IP provided, creating new interface with new IP")
            # Fallback: create new interface
            return await self.ensure_interface_with_ip(
                device_id=device_id,
                ip_address=new_ip,
                interface_name="Loopback",
                interface_type="virtual",
                interface_status="active",
                ip_namespace=namespace,
            )

        # Step 2: Resolve namespace name to UUID
        logger.info(f"Resolving namespace '{namespace}'")
        namespace_id = await self.resolve_namespace_id(namespace)

        # Step 3: Create or get the new IP address in Nautobot
        logger.info(f"Ensuring IP address {new_ip} exists in namespace {namespace}")
        new_ip_id = await self.ensure_ip_address_exists(
            ip_address=new_ip, namespace_id=namespace_id
        )

        # Step 4: Assign the new IP to the existing interface
        logger.info(f"Assigning IP {new_ip} to interface {interface_name}")
        await self.assign_ip_to_interface(ip_id=new_ip_id, interface_id=interface_id)

        logger.info(
            f"✓ Successfully updated interface {interface_name} from {old_ip} to {new_ip}"
        )

        return new_ip_id

    # ========================================================================
    # DEVICE OPERATIONS
    # ========================================================================

    async def get_device_details(
        self, device_id: str, depth: int = 0
    ) -> Dict[str, Any]:
        """
        Fetch device details from Nautobot.

        Args:
            device_id: Device UUID
            depth: API depth parameter (0 for UUIDs only, 1+ for nested objects)

        Returns:
            Device details dictionary

        Raises:
            Exception: If device fetch fails
        """
        logger.info(f"Fetching device details for {device_id} (depth={depth})")

        endpoint = f"dcim/devices/{device_id}/"
        if depth > 0:
            endpoint += f"?depth={depth}"

        device_data = await self.nautobot.rest_request(endpoint=endpoint, method="GET")

        logger.debug(f"Retrieved device data: {device_data.get('name', device_id)}")
        return device_data

    async def extract_primary_ip_address(
        self, device_data: Dict[str, Any]
    ) -> Optional[str]:
        """
        Extract primary IPv4 address from device data.

        Handles both dict format (with 'address' field) and UUID string format
        (by fetching the IP address details).

        Args:
            device_data: Device data dictionary (typically from REST API)

        Returns:
            Primary IPv4 address in CIDR notation (e.g., "10.0.0.1/24") or None

        Note:
            - If primary_ip4 is a dict, extracts the 'address' field
            - If primary_ip4 is a UUID string, fetches IP details from Nautobot
            - Returns None if no primary IP is set
        """
        primary_ip4_field = device_data.get("primary_ip4")
        logger.debug(f"Device primary_ip4 field: {primary_ip4_field}")
        logger.debug(f"Type: {type(primary_ip4_field)}")

        if not primary_ip4_field:
            logger.info("Device has no primary_ip4 set")
            return None

        # Case 1: primary_ip4 is a dict with 'address' field (depth=1+ API response)
        if isinstance(primary_ip4_field, dict):
            current_primary_ip4 = primary_ip4_field.get("address")
            logger.info(f"Current primary_ip4 (from dict): {current_primary_ip4}")
            return current_primary_ip4

        # Case 2: primary_ip4 is a UUID string (depth=0 API response)
        elif isinstance(primary_ip4_field, str):
            logger.info(f"Primary IP field is a UUID: {primary_ip4_field}")
            try:
                ip_details = await self.nautobot.rest_request(
                    endpoint=f"ipam/ip-addresses/{primary_ip4_field}/",
                    method="GET",
                )
                current_primary_ip4 = ip_details.get("address")
                logger.info(
                    f"Current primary_ip4 (from UUID lookup): {current_primary_ip4}"
                )
                return current_primary_ip4
            except Exception as e:
                logger.warning(f"Could not fetch IP details: {e}")
                return None

        else:
            logger.warning(f"Unexpected primary_ip4 type: {type(primary_ip4_field)}")
            return None

    async def assign_primary_ip_to_device(
        self, device_id: str, ip_address_id: str
    ) -> bool:
        """
        Assign primary IPv4 address to a device.

        Args:
            device_id: Device UUID
            ip_address_id: IP address UUID to set as primary

        Returns:
            True if successful, False otherwise
        """
        try:
            logger.info(f"Assigning primary IPv4 {ip_address_id} to device {device_id}")

            endpoint = f"dcim/devices/{device_id}/"
            await self.nautobot.rest_request(
                endpoint=endpoint,
                method="PATCH",
                data={"primary_ip4": ip_address_id},
            )

            logger.info(f"Successfully assigned primary IPv4 to device {device_id}")
            return True

        except Exception as e:
            logger.error(
                f"Failed to assign primary IPv4 to device {device_id}: {str(e)}"
            )
            return False

    async def verify_device_updates(
        self,
        device_id: str,
        expected_updates: Dict[str, Any],
        actual_device: Dict[str, Any],
    ) -> Tuple[bool, List[Dict[str, Any]]]:
        """
        Verify that device updates were applied successfully.

        Compares expected update values against actual device state.
        Handles special cases:
        - custom_fields: Compares each field individually
        - tags: Skipped (different structure)
        - nested objects: Extracts 'id' field for comparison

        Args:
            device_id: Device UUID
            expected_updates: The data we sent in PATCH/POST
            actual_device: The device object after update

        Returns:
            Tuple of (success: bool, mismatches: List[Dict])
            - success: True if all updates verified, False if any mismatches
            - mismatches: List of mismatch details
        """
        logger.debug(f"Verifying updates for device {device_id}")

        mismatches = []

        for field, expected_value in expected_updates.items():
            actual_value = actual_device.get(field)

            # Handle custom_fields specially - compare each field individually
            if field == "custom_fields":
                if isinstance(expected_value, dict) and isinstance(actual_value, dict):
                    for cf_name, cf_expected in expected_value.items():
                        cf_actual = actual_value.get(cf_name)
                        if cf_actual != cf_expected:
                            mismatches.append(
                                {
                                    "field": f"custom_fields.{cf_name}",
                                    "expected": cf_expected,
                                    "actual": cf_actual,
                                }
                            )
                            logger.warning(
                                f"Custom field '{cf_name}' mismatch: expected '{cf_expected}', "
                                f"got '{cf_actual}'"
                            )
                continue

            # Skip tags (different structure - tags are objects, not simple strings)
            if field == "tags":
                continue

            # Handle nested objects (e.g., primary_ip4 is an object with 'id')
            if isinstance(actual_value, dict) and "id" in actual_value:
                actual_value = actual_value["id"]

            if actual_value != expected_value:
                mismatches.append(
                    {
                        "field": field,
                        "expected": expected_value,
                        "actual": actual_value,
                    }
                )
                logger.warning(
                    f"Field '{field}' mismatch: expected '{expected_value}', "
                    f"got '{actual_value}'"
                )

        if mismatches:
            logger.warning(f"Verification found {len(mismatches)} mismatch(es)")
            return False, mismatches
        else:
            logger.debug("All updates verified successfully")
            return True, []

    # ========================================================================
    # ERROR HANDLING
    # ========================================================================

    def is_duplicate_error(self, error: Exception) -> bool:
        """
        Check if error is a "duplicate" or "already exists" error.

        Args:
            error: Exception to check

        Returns:
            True if this is a duplicate error, False otherwise
        """
        error_msg = str(error).lower()
        duplicate_keywords = ["already exists", "duplicate", "unique constraint"]
        return any(keyword in error_msg for keyword in duplicate_keywords)

    def handle_already_exists_error(
        self, error: Exception, resource_type: str
    ) -> Dict[str, Any]:
        """
        Handle "already exists" errors with appropriate logging and response.

        Args:
            error: The exception that occurred
            resource_type: Type of resource (for logging)

        Returns:
            Dictionary with error info
        """
        error_msg = str(error)
        logger.warning(f"{resource_type} already exists: {error_msg}")

        return {
            "error": "already_exists",
            "message": f"{resource_type} already exists",
            "detail": error_msg,
        }
