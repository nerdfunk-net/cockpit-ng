"""
Service for creating test baselines in Nautobot from YAML configuration files.
"""

import logging
import yaml
from pathlib import Path
from typing import Dict, List, Any, Optional
from services.nautobot import nautobot_service
from services.nautobot.devices.import_service import DeviceImportService
from services.nautobot.devices.common import DeviceCommonService

logger = logging.getLogger(__name__)


class TestBaselineService:
    """Service to load and create test baseline data in Nautobot."""

    def __init__(self):
        self.nautobot = nautobot_service
        self.created_resources = {
            "location_types": {},
            "locations": {},
            "roles": {},
            "tags": {},
            "manufacturers": {},
            "platforms": {},
            "device_types": {},
            "prefixes": {},
            "custom_fields": {},
            "custom_field_choices": {},
            "devices": {},
        }
        self.status_cache: Dict[str, str] = {}  # Cache for status name -> UUID mapping
        self.custom_field_cache: Dict[str, str] = {}  # Cache for custom field key -> UUID mapping
        self.common = DeviceCommonService(nautobot_service)

    async def load_baseline_files(self, directory: str = "../contributing-data/tests_baseline") -> List[Dict[str, Any]]:
        """
        Load all YAML files from the baseline directory.

        Args:
            directory: Path to directory containing baseline YAML files (relative to backend directory)

        Returns:
            List of parsed YAML data dictionaries
        """
        baseline_dir = Path(directory)
        if not baseline_dir.exists():
            raise FileNotFoundError(f"Baseline directory not found: {directory}")

        yaml_files = list(baseline_dir.glob("*.yaml")) + list(baseline_dir.glob("*.yml"))

        if not yaml_files:
            raise ValueError(f"No YAML files found in {directory}")

        baseline_data = []
        for yaml_file in yaml_files:
            logger.info(f"Loading baseline file: {yaml_file}")
            with open(yaml_file, "r") as f:
                data = yaml.safe_load(f)
                if data:
                    baseline_data.append(data)

        return baseline_data

    async def get_status_uuid(self, status_name: str) -> Optional[str]:
        """
        Get the UUID for a status by name.
        Uses cached values if available, otherwise fetches from Nautobot.

        Args:
            status_name: Name of the status (e.g., "active")

        Returns:
            UUID of the status, or None if not found
        """
        # Check cache first
        if status_name in self.status_cache:
            return self.status_cache[status_name]

        # Fetch all statuses from Nautobot
        try:
            response = await self.nautobot.rest_request(
                "extras/statuses/",
                method="GET"
            )

            # Cache all statuses
            if "results" in response:
                for status in response["results"]:
                    # Cache both the exact name and lowercase version for case-insensitive lookup
                    self.status_cache[status["name"]] = status["id"]
                    self.status_cache[status["name"].lower()] = status["id"]

                # Debug: log available statuses
                available_statuses = [s["name"] for s in response["results"]]
                logger.info(f"Available statuses: {available_statuses}")

            # Try exact match first, then case-insensitive
            status_uuid = self.status_cache.get(status_name)
            if not status_uuid:
                status_uuid = self.status_cache.get(status_name.lower())

            return status_uuid

        except Exception as e:
            logger.error(f"Error fetching statuses from Nautobot: {e}")
            return None

    async def create_location_types(self, location_types: List[Dict[str, Any]]) -> Dict[str, str]:
        """Create location types in Nautobot with parent-child relationships."""
        created = {}

        # Sort location types to create parent types first (those without parent field)
        sorted_types = sorted(location_types, key=lambda x: 0 if not x.get("parent") else 1)

        for lt in sorted_types:
            try:
                # Check if already exists
                response = await self.nautobot.rest_request(
                    f"dcim/location-types/?name={lt['name']}",
                    method="GET"
                )

                if response.get("count", 0) > 0:
                    existing = response["results"][0]
                    created[lt["name"]] = existing["id"]
                    logger.info(f"Location type '{lt['name']}' already exists")
                    continue

                # Create new location type
                payload = {
                    "name": lt["name"],
                    "description": lt.get("description", ""),
                }

                # Handle content_types
                if "content_types" in lt:
                    content_types = lt["content_types"]
                    if isinstance(content_types, str):
                        content_types = [content_types]
                    payload["content_types"] = content_types

                # Handle parent location type
                if "parent" in lt and lt["parent"]:
                    parent_type_name = lt["parent"]
                    parent_type_id = created.get(parent_type_name)
                    if parent_type_id:
                        payload["parent"] = {"id": parent_type_id}
                    else:
                        logger.warning(f"Parent location type '{parent_type_name}' not found for '{lt['name']}'")

                result = await self.nautobot.rest_request(
                    "dcim/location-types/",
                    method="POST",
                    data=payload
                )

                created[lt["name"]] = result["id"]
                logger.info(f"Created location type: {lt['name']}")

            except Exception as e:
                logger.error(f"Error creating location type '{lt['name']}': {e}")
                raise

        return created

    async def create_locations(self, locations: List[Dict[str, Any]]) -> Dict[str, str]:
        """Create locations in Nautobot with parent-child relationships."""
        created = {}

        for location in locations:
            try:
                # Check if already exists
                response = await self.nautobot.rest_request(
                    f"dcim/locations/?name={location['name']}",
                    method="GET"
                )

                if response.get("count", 0) > 0:
                    existing = response["results"][0]
                    created[location["name"]] = existing["id"]
                    logger.info(f"Location '{location['name']}' already exists")
                    continue

                # Prepare payload
                payload = {
                    "name": location["name"],
                }

                if "description" in location:
                    payload["description"] = location["description"]

                # Resolve status name to UUID
                status_name = location.get("status", "active")
                status_uuid = await self.get_status_uuid(status_name)
                if status_uuid:
                    payload["status"] = {"id": status_uuid}
                else:
                    logger.warning(f"Status '{status_name}' not found, location '{location['name']}' may not be created correctly")

                # Resolve location type
                if "location_types" in location:
                    lt_id = self.created_resources["location_types"].get(location["location_types"])
                    if lt_id:
                        payload["location_type"] = {"id": lt_id}

                # Resolve parent location
                parent_name = location.get("parent")
                if parent_name and parent_name != "null" and parent_name is not None:
                    parent_id = created.get(parent_name)
                    if parent_id:
                        payload["parent"] = {"id": parent_id}

                result = await self.nautobot.rest_request(
                    "dcim/locations/",
                    method="POST",
                    data=payload
                )

                created[location["name"]] = result["id"]
                logger.info(f"Created location: {location['name']}")

            except Exception as e:
                logger.error(f"Error creating location '{location['name']}': {e}")
                raise

        return created

    async def create_roles(self, roles: List[Dict[str, Any]]) -> Dict[str, str]:
        """Create roles in Nautobot."""
        created = {}

        for role in roles:
            try:
                # Check if already exists
                response = await self.nautobot.rest_request(
                    f"extras/roles/?name={role['name']}",
                    method="GET"
                )

                if response.get("count", 0) > 0:
                    existing = response["results"][0]
                    created[role["name"]] = existing["id"]
                    logger.info(f"Role '{role['name']}' already exists")
                    continue

                # Create new role
                payload = {
                    "name": role["name"],
                    "description": role.get("description", ""),
                    "content_types": role.get("content_types", ["dcim.device"])
                }

                result = await self.nautobot.rest_request(
                    "extras/roles/",
                    method="POST",
                    data=payload
                )

                created[role["name"]] = result["id"]
                logger.info(f"Created role: {role['name']}")

            except Exception as e:
                logger.error(f"Error creating role '{role['name']}': {e}")
                raise

        return created

    async def create_tags(self, tags: List[Dict[str, Any]]) -> Dict[str, str]:
        """Create tags in Nautobot."""
        created = {}

        # Color mapping
        color_map = {
            "green": "4caf50",
            "yellow": "ffc107",
            "red": "f44336",
            "blue": "2196f3",
            "orange": "ff9800",
            "purple": "9c27b0",
            "gray": "9e9e9e",
            "black": "000000",
        }

        for tag in tags:
            try:
                # Check if already exists
                response = await self.nautobot.rest_request(
                    f"extras/tags/?name={tag['name']}",
                    method="GET"
                )

                if response.get("count", 0) > 0:
                    existing = response["results"][0]
                    created[tag["name"]] = existing["id"]
                    logger.info(f"Tag '{tag['name']}' already exists")
                    continue

                # Create new tag
                color = tag.get("color", "gray")
                hex_color = color_map.get(color.lower(), color)

                payload = {
                    "name": tag["name"],
                    "color": hex_color,
                }

                if "description" in tag:
                    payload["description"] = tag["description"]

                if "content_types" in tag:
                    payload["content_types"] = tag["content_types"]

                result = await self.nautobot.rest_request(
                    "extras/tags/",
                    method="POST",
                    data=payload
                )

                created[tag["name"]] = result["id"]
                logger.info(f"Created tag: {tag['name']}")

            except Exception as e:
                logger.error(f"Error creating tag '{tag['name']}': {e}")
                raise

        return created

    async def create_manufacturers(self, manufacturers: List[Dict[str, Any]]) -> Dict[str, str]:
        """Create manufacturers in Nautobot."""
        created = {}

        for manufacturer in manufacturers:
            try:
                # Check if already exists
                response = await self.nautobot.rest_request(
                    f"dcim/manufacturers/?name={manufacturer['name']}",
                    method="GET"
                )

                if response.get("count", 0) > 0:
                    existing = response["results"][0]
                    created[manufacturer["name"]] = existing["id"]
                    logger.info(f"Manufacturer '{manufacturer['name']}' already exists")
                    continue

                # Create new manufacturer
                payload = {
                    "name": manufacturer["name"],
                }

                if "description" in manufacturer:
                    payload["description"] = manufacturer["description"]

                result = await self.nautobot.rest_request(
                    "dcim/manufacturers/",
                    method="POST",
                    data=payload
                )

                created[manufacturer["name"]] = result["id"]
                logger.info(f"Created manufacturer: {manufacturer['name']}")

            except Exception as e:
                logger.error(f"Error creating manufacturer '{manufacturer['name']}': {e}")
                raise

        return created

    async def create_platforms(self, platforms: List[Dict[str, Any]]) -> Dict[str, str]:
        """Create platforms in Nautobot."""
        created = {}

        for platform in platforms:
            try:
                # Check if already exists
                response = await self.nautobot.rest_request(
                    f"dcim/platforms/?name={platform['name']}",
                    method="GET"
                )

                if response.get("count", 0) > 0:
                    existing = response["results"][0]
                    created[platform["name"]] = existing["id"]
                    logger.info(f"Platform '{platform['name']}' already exists")
                    continue

                # Create new platform
                payload = {
                    "name": platform["name"],
                }

                if "description" in platform:
                    payload["description"] = platform["description"]

                if "network_driver" in platform:
                    payload["network_driver"] = platform["network_driver"]

                # Resolve manufacturer
                if "manufacturer" in platform:
                    mfr_id = self.created_resources["manufacturers"].get(platform["manufacturer"])
                    if mfr_id:
                        payload["manufacturer"] = {"id": mfr_id}

                result = await self.nautobot.rest_request(
                    "dcim/platforms/",
                    method="POST",
                    data=payload
                )

                created[platform["name"]] = result["id"]
                logger.info(f"Created platform: {platform['name']}")

            except Exception as e:
                logger.error(f"Error creating platform '{platform['name']}': {e}")
                raise

        return created

    async def create_device_types(self, device_types: List[Dict[str, Any]]) -> Dict[str, str]:
        """Create device types in Nautobot."""
        created = {}

        for device_type in device_types:
            try:
                # Check if already exists
                response = await self.nautobot.rest_request(
                    f"dcim/device-types/?model={device_type['model']}",
                    method="GET"
                )

                if response.get("count", 0) > 0:
                    existing = response["results"][0]
                    created[device_type["model"]] = existing["id"]
                    logger.info(f"Device type '{device_type['model']}' already exists")
                    continue

                # Resolve manufacturer
                mfr_id = self.created_resources["manufacturers"].get(device_type["manufacturer"])
                if not mfr_id:
                    logger.error(f"Manufacturer '{device_type['manufacturer']}' not found for device type '{device_type['model']}'")
                    continue

                # Create new device type
                payload = {
                    "model": device_type["model"],
                    "manufacturer": {"id": mfr_id},
                }

                if "description" in device_type:
                    payload["description"] = device_type["description"]

                result = await self.nautobot.rest_request(
                    "dcim/device-types/",
                    method="POST",
                    data=payload
                )

                created[device_type["model"]] = result["id"]
                logger.info(f"Created device type: {device_type['model']}")

            except Exception as e:
                logger.error(f"Error creating device type '{device_type.get('model', 'unknown')}': {e}")
                raise

        return created

    async def create_prefixes(self, prefixes: List[Dict[str, Any]]) -> Dict[str, str]:
        """Create IP prefixes in Nautobot using DeviceCommonService."""
        created = {}

        for prefix in prefixes:
            try:
                prefix_cidr = prefix.get("prefix")
                logger.info(f"Processing prefix: {prefix_cidr}")

                # Use DeviceCommonService to ensure prefix exists
                prefix_id = await self.common.ensure_prefix_exists(
                    prefix=prefix_cidr,
                    namespace=prefix.get("namespace", "Global"),
                    status=prefix.get("status", "active"),
                    prefix_type=prefix.get("type", "network"),
                    location=prefix.get("location"),
                    description=prefix.get("description"),
                    role=prefix.get("role"),
                    parent=prefix.get("parent"),
                    tenant=prefix.get("tenant"),
                    vlan=prefix.get("vlan"),
                    rir=prefix.get("rir"),
                    tags=prefix.get("tags"),
                    custom_fields=prefix.get("custom_fields"),
                )

                created[prefix_cidr] = prefix_id
                logger.info(f"Prefix '{prefix_cidr}' ensured with ID: {prefix_id}")

            except Exception as e:
                logger.error(f"Error creating prefix '{prefix.get('prefix', 'unknown')}': {e}")
                raise

        return created

    async def create_custom_fields(self, custom_fields_data: Dict[str, List[Dict[str, Any]]]) -> Dict[str, str]:
        """
        Create custom fields in Nautobot.

        Args:
            custom_fields_data: Dictionary where keys are custom field names and values are lists of field configs

        Returns:
            Dictionary mapping custom field keys to their UUIDs
        """
        created = {}

        for field_key, field_configs in custom_fields_data.items():
            # In YAML, each custom field is defined as a list with one element
            if not field_configs or not isinstance(field_configs, list):
                logger.warning(f"Custom field '{field_key}' has invalid configuration")
                continue

            field_config = field_configs[0]  # Get the first (and should be only) config

            try:
                # Generate key from label if not provided
                key = field_config.get("key", field_config.get("label", field_key))

                # Check if custom field already exists by fetching all and filtering client-side
                # (Nautobot API doesn't support filtering by key parameter)
                response = await self.nautobot.rest_request(
                    "extras/custom-fields/",
                    method="GET"
                )

                # Filter client-side by key
                existing = None
                if response.get("results"):
                    for cf in response["results"]:
                        if cf.get("key") == key:
                            existing = cf
                            break

                if existing:
                    created[field_key] = existing["id"]
                    self.custom_field_cache[key] = existing["id"]
                    logger.info(f"Custom field '{key}' already exists")
                    continue

                # Prepare payload for custom field creation
                payload = {
                    "label": field_config.get("label", field_key),
                    "key": key,
                    "type": field_config["type"],  # Required: select, multi-select, text, etc.
                    "content_types": field_config["content_types"],  # Required
                }

                # Add optional fields
                if "description" in field_config:
                    payload["description"] = field_config["description"]

                if "required" in field_config:
                    payload["required"] = field_config["required"]

                if "default" in field_config:
                    payload["default"] = field_config["default"]

                if "weight" in field_config:
                    payload["weight"] = field_config["weight"]

                if "grouping" in field_config:
                    payload["grouping"] = field_config["grouping"]

                if "filter_logic" in field_config:
                    payload["filter_logic"] = field_config["filter_logic"]

                if "validation_minimum" in field_config:
                    payload["validation_minimum"] = field_config["validation_minimum"]

                if "validation_maximum" in field_config:
                    payload["validation_maximum"] = field_config["validation_maximum"]

                if "validation_regex" in field_config:
                    payload["validation_regex"] = field_config["validation_regex"]

                if "advanced_ui" in field_config:
                    payload["advanced_ui"] = field_config["advanced_ui"]

                # Create the custom field
                result = await self.nautobot.rest_request(
                    "extras/custom-fields/",
                    method="POST",
                    data=payload
                )

                created[field_key] = result["id"]
                self.custom_field_cache[key] = result["id"]
                logger.info(f"Created custom field: {key} (type: {field_config['type']})")

            except Exception as e:
                logger.error(f"Error creating custom field '{field_key}': {e}")
                raise

        return created

    async def create_custom_field_choices(self, choices_data: Dict[str, List[Dict[str, Any]]]) -> Dict[str, int]:
        """
        Create custom field choices in Nautobot.

        Args:
            choices_data: Dictionary where keys are custom field names and values are lists of choice configs

        Returns:
            Dictionary mapping custom field keys to the count of choices created
        """
        created_counts = {}

        for field_key, choices in choices_data.items():
            if not choices or not isinstance(choices, list):
                logger.warning(f"Custom field choices for '{field_key}' has invalid configuration")
                continue

            # Get the custom field UUID from cache
            custom_field_id = self.created_resources["custom_fields"].get(field_key)

            if not custom_field_id:
                # Try to look it up by key
                custom_field_id = self.custom_field_cache.get(field_key)

            if not custom_field_id:
                logger.error(f"Custom field '{field_key}' not found. Cannot create choices.")
                continue

            created_count = 0

            for idx, choice in enumerate(choices):
                try:
                    value = choice.get("value")

                    if not value:
                        logger.warning(f"Choice for custom field '{field_key}' missing 'value' field")
                        continue

                    # Check if choice already exists
                    response = await self.nautobot.rest_request(
                        f"extras/custom-field-choices/?custom_field={custom_field_id}&value={value}",
                        method="GET"
                    )

                    if response.get("count", 0) > 0:
                        logger.info(f"Custom field choice '{value}' for field '{field_key}' already exists")
                        created_count += 1
                        continue

                    # Prepare payload for custom field choice
                    payload = {
                        "custom_field": {"id": custom_field_id},
                        "value": value,
                    }

                    # Add optional weight (use index if not provided for ordering)
                    if "weight" in choice:
                        payload["weight"] = choice["weight"]
                    else:
                        payload["weight"] = (idx + 1) * 100  # Auto-increment: 100, 200, 300...

                    # Create the choice
                    await self.nautobot.rest_request(
                        "extras/custom-field-choices/",
                        method="POST",
                        data=payload
                    )

                    created_count += 1
                    logger.info(f"Created custom field choice: {value} for field '{field_key}'")

                except Exception as e:
                    logger.error(f"Error creating custom field choice '{choice.get('value', 'unknown')}' for field '{field_key}': {e}")
                    # Continue with next choice instead of raising
                    continue

            created_counts[field_key] = created_count
            logger.info(f"Created {created_count} choices for custom field '{field_key}'")

        return created_counts

    async def create_devices(self, devices: List[Dict[str, Any]]) -> Dict[str, str]:
        """Create devices in Nautobot using DeviceImportService."""
        created = {}
        import_service = DeviceImportService(self.nautobot)

        for device in devices:
            try:
                device_name = device.get("name")
                logger.info(f"Processing device: {device_name}")

                # Prepare device data for import service
                device_data = {
                    "name": device_name,
                    "device_type": device.get("device_type"),
                    "location": device.get("location"),
                    "status": device.get("status", "active"),
                }

                # Add optional fields
                if "platform" in device:
                    device_data["platform"] = device["platform"]

                if "serial" in device:
                    device_data["serial"] = device["serial"]

                # Handle roles (import service expects singular 'role')
                if "roles" in device and device["roles"]:
                    role_name = device["roles"][0] if isinstance(device["roles"], list) else device["roles"]
                    device_data["role"] = role_name
                elif "role" in device:
                    device_data["role"] = device["role"]
                else:
                    logger.error(f"No role specified for device '{device_name}'")
                    continue

                # Handle tags
                if "tags" in device and device["tags"]:
                    device_data["tags"] = device["tags"]

                # Handle custom fields
                if "custom_fields" in device and device["custom_fields"]:
                    # Convert date/datetime objects to ISO format strings
                    from datetime import date, datetime
                    custom_fields = {}
                    for key, value in device["custom_fields"].items():
                        if isinstance(value, datetime):
                            custom_fields[key] = value.isoformat()
                        elif isinstance(value, date):
                            custom_fields[key] = value.isoformat()
                        else:
                            custom_fields[key] = value
                    device_data["custom_fields"] = custom_fields

                # Prepare interface configuration if interfaces are provided
                interface_config = None
                if "interfaces" in device and device["interfaces"]:
                    interface_config = []
                    for iface in device["interfaces"]:
                        iface_data = {
                            "name": iface.get("name"),
                            "type": iface.get("type", "other"),
                            "status": iface.get("status", "active"),
                            "enabled": iface.get("enabled", True),
                        }

                        # Add IP address if provided
                        if "ip_address" in iface:
                            iface_data["ip_address"] = iface["ip_address"]
                            iface_data["namespace"] = iface.get("namespace", "Global")

                        # Check if this is the primary IP
                        if "primary_ip4" in device:
                            # Extract just the IP part (without CIDR) for comparison
                            primary_ip = device["primary_ip4"].split("/")[0]
                            iface_ip = iface["ip_address"].split("/")[0]
                            if primary_ip == iface_ip:
                                iface_data["is_primary_ipv4"] = True

                        # Add optional interface fields
                        if "description" in iface:
                            iface_data["description"] = iface["description"]
                        if "mac_address" in iface:
                            iface_data["mac_address"] = iface["mac_address"]
                        if "mtu" in iface:
                            iface_data["mtu"] = iface["mtu"]

                        interface_config.append(iface_data)

                # Use DeviceImportService to create device with interfaces
                result = await import_service.import_device(
                    device_data=device_data,
                    interface_config=interface_config,
                    skip_if_exists=True
                )

                if result["success"]:
                    created[device_name] = result["device_id"]
                    if result["created"]:
                        logger.info(f"Created device: {device_name}")
                    else:
                        logger.info(f"Device '{device_name}' already exists, skipped")
                else:
                    logger.error(f"Failed to import device '{device_name}': {result['message']}")

            except Exception as e:
                logger.error(f"Error creating device '{device.get('name', 'unknown')}': {e}")
                raise

        return created

    async def create_baseline(self) -> Dict[str, Any]:
        """
        Load baseline files and create all resources in Nautobot.
        Creates resources in the correct order to handle dependencies.

        Returns:
            Dictionary with summary of created resources
        """
        try:
            # Load all baseline files
            baseline_data_list = await self.load_baseline_files()

            # Merge all data
            merged_data = {
                "location_types": [],
                "location": [],
                "roles": [],
                "tags": [],
                "manufacturers": [],
                "platforms": [],
                "device_types": [],
                "prefixes": [],
                "custom_fields": {},
                "custom_field_choices": {},
                "devices": [],
            }

            for data in baseline_data_list:
                for key in merged_data.keys():
                    if key in data and data[key]:
                        # Custom fields and choices are dictionaries, not lists
                        if key in ["custom_fields", "custom_field_choices"]:
                            if isinstance(data[key], dict):
                                merged_data[key].update(data[key])
                        else:
                            merged_data[key].extend(data[key])

            # Create resources in dependency order
            summary = {
                "success": True,
                "message": "Test baseline created successfully",
                "created": {},
                "errors": [],
            }

            # 1. Location Types (no dependencies)
            if merged_data["location_types"]:
                self.created_resources["location_types"] = await self.create_location_types(merged_data["location_types"])
                summary["created"]["location_types"] = len(self.created_resources["location_types"])

            # 2. Locations (depends on location types and parent locations)
            if merged_data["location"]:
                self.created_resources["locations"] = await self.create_locations(merged_data["location"])
                summary["created"]["locations"] = len(self.created_resources["locations"])

            # 3. Roles (no dependencies)
            if merged_data["roles"]:
                self.created_resources["roles"] = await self.create_roles(merged_data["roles"])
                summary["created"]["roles"] = len(self.created_resources["roles"])

            # 4. Tags (no dependencies)
            if merged_data["tags"]:
                self.created_resources["tags"] = await self.create_tags(merged_data["tags"])
                summary["created"]["tags"] = len(self.created_resources["tags"])

            # 5. Manufacturers (no dependencies)
            if merged_data["manufacturers"]:
                self.created_resources["manufacturers"] = await self.create_manufacturers(merged_data["manufacturers"])
                summary["created"]["manufacturers"] = len(self.created_resources["manufacturers"])

            # 6. Platforms (depends on manufacturers)
            if merged_data["platforms"]:
                self.created_resources["platforms"] = await self.create_platforms(merged_data["platforms"])
                summary["created"]["platforms"] = len(self.created_resources["platforms"])

            # 7. Device Types (depends on manufacturers)
            if merged_data["device_types"]:
                self.created_resources["device_types"] = await self.create_device_types(merged_data["device_types"])
                summary["created"]["device_types"] = len(self.created_resources["device_types"])

            # 8. Prefixes (no dependencies, but should be created before devices)
            if merged_data["prefixes"]:
                self.created_resources["prefixes"] = await self.create_prefixes(merged_data["prefixes"])
                summary["created"]["prefixes"] = len(self.created_resources["prefixes"])

            # 9. Custom Fields (no dependencies, but should be created before custom field choices)
            if merged_data["custom_fields"]:
                self.created_resources["custom_fields"] = await self.create_custom_fields(merged_data["custom_fields"])
                summary["created"]["custom_fields"] = len(self.created_resources["custom_fields"])

            # 10. Custom Field Choices (depends on custom fields)
            if merged_data["custom_field_choices"]:
                choice_counts = await self.create_custom_field_choices(merged_data["custom_field_choices"])
                # Sum up all the choice counts
                total_choices = sum(choice_counts.values())
                summary["created"]["custom_field_choices"] = total_choices

            # 11. Devices (depends on device types, locations, platforms, roles, tags, prefixes, and custom fields)
            if merged_data["devices"]:
                self.created_resources["devices"] = await self.create_devices(merged_data["devices"])
                summary["created"]["devices"] = len(self.created_resources["devices"])

            logger.info(f"Baseline creation complete: {summary}")
            return summary

        except Exception as e:
            logger.error(f"Error creating baseline: {e}", exc_info=True)
            return {
                "success": False,
                "message": f"Failed to create baseline: {str(e)}",
                "error": str(e),
            }
