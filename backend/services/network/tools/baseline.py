"""
Service for creating test baselines in Nautobot from YAML configuration files.
"""

import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml

from services.nautobot.devices.common import DeviceCommonService
from services.nautobot.devices.import_service import DeviceImportService
from services.nautobot.managers.ip_manager import IPManager
from services.nautobot.managers.cluster_manager import ClusterManager
from services.nautobot.managers.vm_manager import VirtualMachineManager
from services.nautobot.resolvers.metadata_resolver import MetadataResolver
from services.nautobot.resolvers.network_resolver import NetworkResolver

logger = logging.getLogger(__name__)

DEFAULT_CLUSTER_TYPE_NAME = "cluster-type"
DEFAULT_TAG_CONTENT_TYPES = [
    "dcim.device",
    "virtualization.virtualmachine",
    "virtualization.cluster",
]
STATUS_CONTENT_TYPE_LOCATION = "dcim.location"
STATUS_CONTENT_TYPE_VM = "virtualization.virtualmachine"
STATUS_CONTENT_TYPE_VM_INTERFACE = "virtualization.vminterface"
STATUS_CONTENT_TYPE_IP_ADDRESS = "ipam.ipaddress"


def normalize_content_types(content_types: Any) -> List[str]:
    """Normalize YAML/API content_types to a sorted list of 'app_label.model' strings."""
    if content_types is None:
        return []
    if isinstance(content_types, str):
        return [content_types]
    if not isinstance(content_types, list):
        return []

    normalized: List[str] = []
    for item in content_types:
        if isinstance(item, str):
            normalized.append(item)
        elif isinstance(item, dict):
            app_label = item.get("app_label")
            model = item.get("model")
            if app_label and model:
                normalized.append(f"{app_label}.{model}")
            elif isinstance(item.get("display"), str) and "." in item["display"]:
                normalized.append(item["display"])
    return sorted(set(normalized))


def normalize_location_type_content_types(content_types: Any) -> List[str]:
    """
    Normalize content_types for LocationType create/update.

    Virtual machines are not associated to locations directly in Nautobot; clusters
    are. Map legacy ``virtualization.virtualmachine`` to ``virtualization.cluster``.
    """
    normalized: List[str] = []
    for ct in normalize_content_types(content_types):
        if ct == "virtualization.virtualmachine":
            normalized.append("virtualization.cluster")
        else:
            normalized.append(ct)
    return sorted(set(normalized))


def content_types_from_api_record(record: Dict[str, Any]) -> List[str]:
    """Extract content type strings from a Nautobot location-type API record."""
    return normalize_location_type_content_types(record.get("content_types"))


def tag_content_types_from_api_record(record: Dict[str, Any]) -> List[str]:
    """Extract content type strings from a Nautobot tag API record."""
    return normalize_content_types(record.get("content_types"))


def desired_tag_content_types(tag: Dict[str, Any]) -> List[str]:
    """Merge YAML tag content_types with defaults required for baseline import."""
    from_yaml = normalize_content_types(tag.get("content_types"))
    if not from_yaml:
        from_yaml = list(DEFAULT_TAG_CONTENT_TYPES)
    return sorted(set(from_yaml) | set(DEFAULT_TAG_CONTENT_TYPES))


def sort_location_types_by_parent(
    location_types: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Return location types ordered so parents are created before children."""
    by_name = {lt["name"]: lt for lt in location_types}
    sorted_list: List[Dict[str, Any]] = []
    resolved: set[str] = set()

    def visit(name: str) -> None:
        if name in resolved or name not in by_name:
            return
        lt = by_name[name]
        parent = lt.get("parent")
        if parent and parent in by_name:
            visit(parent)
        sorted_list.append(lt)
        resolved.add(name)

    for lt in location_types:
        visit(lt["name"])
    return sorted_list


class BaselineImportService:
    """Service to load and create baseline test data in Nautobot."""

    def __init__(self):
        import service_factory

        nb = service_factory.build_nautobot_service()
        self.nautobot = nb
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
            "cluster_types": {},
            "cluster_groups": {},
            "clusters": {},
            "devices": {},
            "virtual_machines": {},
        }
        self.status_cache: Dict[str, str] = {}  # Cache for status name -> UUID mapping
        self.custom_field_cache: Dict[
            str, str
        ] = {}  # Cache for custom field key -> UUID mapping
        self.common = DeviceCommonService(nb)

    async def load_baseline_files(
        self, directory: str | None = None
    ) -> List[Dict[str, Any]]:
        """
        Load all YAML files from the baseline directory.

        Args:
            directory: Path to directory containing baseline YAML files (relative to
                backend/ unless absolute). Defaults to BASELINE_DIR env or
                ../contributing-data/tests_baseline.

        Returns:
            List of parsed YAML data dictionaries
        """
        if directory is None:
            directory = os.environ.get(
                "BASELINE_DIR",
                "../contributing-data/tests_baseline",
            )
        baseline_dir = Path(directory)
        if not baseline_dir.is_absolute():
            backend_root = Path(__file__).resolve().parents[3]
            baseline_dir = (backend_root / baseline_dir).resolve()
        if not baseline_dir.exists():
            raise FileNotFoundError(f"Baseline directory not found: {directory}")

        yaml_files = list(baseline_dir.glob("*.yaml")) + list(
            baseline_dir.glob("*.yml")
        )

        if not yaml_files:
            raise ValueError(f"No YAML files found in {directory}")

        baseline_data = []
        for yaml_file in yaml_files:
            logger.info("Loading baseline file: %s", yaml_file)
            with open(yaml_file) as f:
                data = yaml.safe_load(f)
                if data:
                    baseline_data.append(data)

        return baseline_data

    def _status_cache_key(self, status_name: str, content_type: Optional[str]) -> str:
        if content_type:
            return f"{content_type}:{status_name}"
        return status_name

    def _cache_status_record(
        self, status: Dict[str, Any], content_type: Optional[str]
    ) -> None:
        name = status["name"]
        status_id = status["id"]
        for key in (
            self._status_cache_key(name, content_type),
            self._status_cache_key(name.lower(), content_type),
        ):
            self.status_cache[key] = status_id
        if not content_type:
            self.status_cache[name] = status_id
            self.status_cache[name.lower()] = status_id

    async def get_status_uuid(
        self, status_name: str, content_type: Optional[str] = None
    ) -> Optional[str]:
        """
        Get the UUID for a status by name, optionally scoped to a content type.

        Nautobot statuses are per content type (e.g. VM vs VM interface); the same
        name can map to different UUIDs.

        Args:
            status_name: Name of the status (e.g., "Active", "Offline")
            content_type: Optional ``app_label.model`` filter (e.g.
                ``virtualization.vminterface``)

        Returns:
            UUID of the status, or None if not found
        """
        for lookup_name in (status_name, status_name.lower()):
            cache_key = self._status_cache_key(lookup_name, content_type)
            if cache_key in self.status_cache:
                return self.status_cache[cache_key]

        try:
            endpoint = "extras/statuses/"
            if content_type:
                endpoint = f"extras/statuses/?content_types={content_type}"

            response = await self.nautobot.rest_request(endpoint, method="GET")

            if "results" in response:
                for status in response["results"]:
                    self._cache_status_record(status, content_type)

                logger.info(
                    "Loaded %s statuses for content_type=%s",
                    len(response["results"]),
                    content_type or "all",
                )

            for lookup_name in (status_name, status_name.lower()):
                cache_key = self._status_cache_key(lookup_name, content_type)
                if cache_key in self.status_cache:
                    return self.status_cache[cache_key]

            return None

        except Exception as e:
            logger.error("Error fetching statuses from Nautobot: %s", e)
            return None

    async def create_location_types(
        self, location_types: List[Dict[str, Any]]
    ) -> Dict[str, str]:
        """Create location types in Nautobot with parent-child relationships."""
        created = {}
        sorted_types = sort_location_types_by_parent(location_types)

        for lt in sorted_types:
            try:
                desired_content_types = normalize_location_type_content_types(
                    lt.get("content_types")
                )

                response = await self.nautobot.rest_request(
                    f"dcim/location-types/?name={lt['name']}", method="GET"
                )

                if response.get("count", 0) > 0:
                    existing = response["results"][0]
                    existing_id = existing["id"]
                    created[lt["name"]] = existing_id

                    if desired_content_types:
                        existing_content_types = content_types_from_api_record(existing)
                        if desired_content_types != existing_content_types:
                            await self.nautobot.rest_request(
                                f"dcim/location-types/{existing_id}/",
                                method="PATCH",
                                data={"content_types": desired_content_types},
                            )
                            logger.info(
                                "Updated content_types for location type '%s': %s",
                                lt["name"],
                                desired_content_types,
                            )
                        else:
                            logger.info(
                                "Location type '%s' already exists with correct content_types",
                                lt["name"],
                            )
                    else:
                        logger.info("Location type '%s' already exists", lt["name"])
                    continue

                payload: Dict[str, Any] = {
                    "name": lt["name"],
                    "description": lt.get("description", ""),
                }

                if desired_content_types:
                    payload["content_types"] = desired_content_types

                parent_type_name = lt.get("parent")
                if parent_type_name:
                    parent_type_id = created.get(parent_type_name)
                    if parent_type_id:
                        payload["parent"] = {"id": parent_type_id}
                    else:
                        logger.warning(
                            "Parent location type '%s' not found for '%s'",
                            parent_type_name,
                            lt["name"],
                        )

                result = await self.nautobot.rest_request(
                    "dcim/location-types/", method="POST", data=payload
                )

                created[lt["name"]] = result["id"]
                logger.info("Created location type: %s", lt["name"])

            except Exception as e:
                logger.error("Error creating location type '%s': %s", lt["name"], e)
                raise

        return created

    async def create_locations(self, locations: List[Dict[str, Any]]) -> Dict[str, str]:
        """Create locations in Nautobot with parent-child relationships."""
        created = {}

        for location in locations:
            try:
                # Check if already exists
                response = await self.nautobot.rest_request(
                    f"dcim/locations/?name={location['name']}", method="GET"
                )

                if response.get("count", 0) > 0:
                    existing = response["results"][0]
                    created[location["name"]] = existing["id"]
                    logger.info("Location '%s' already exists", location["name"])
                    continue

                # Prepare payload
                payload = {
                    "name": location["name"],
                }

                if "description" in location:
                    payload["description"] = location["description"]

                # Resolve status name to UUID
                status_name = location.get("status", "active")
                status_uuid = await self.get_status_uuid(
                    status_name, STATUS_CONTENT_TYPE_LOCATION
                )
                if status_uuid:
                    payload["status"] = {"id": status_uuid}
                else:
                    logger.warning(
                        "Status '%s' not found, location '%s' may not be created correctly",
                        status_name,
                        location["name"],
                    )

                # Resolve location type
                if "location_types" in location:
                    lt_id = self.created_resources["location_types"].get(
                        location["location_types"]
                    )
                    if lt_id:
                        payload["location_type"] = {"id": lt_id}

                # Resolve parent location
                parent_name = location.get("parent")
                if parent_name and parent_name != "null" and parent_name is not None:
                    parent_id = created.get(parent_name)
                    if parent_id:
                        payload["parent"] = {"id": parent_id}

                result = await self.nautobot.rest_request(
                    "dcim/locations/", method="POST", data=payload
                )

                created[location["name"]] = result["id"]
                logger.info("Created location: %s", location["name"])

            except Exception as e:
                logger.error("Error creating location '%s': %s", location["name"], e)
                raise

        return created

    async def create_roles(self, roles: List[Dict[str, Any]]) -> Dict[str, str]:
        """Create roles in Nautobot."""
        created = {}

        for role in roles:
            try:
                # Check if already exists
                response = await self.nautobot.rest_request(
                    f"extras/roles/?name={role['name']}", method="GET"
                )

                if response.get("count", 0) > 0:
                    existing = response["results"][0]
                    created[role["name"]] = existing["id"]
                    logger.info("Role '%s' already exists", role["name"])
                    continue

                # Create new role
                payload = {
                    "name": role["name"],
                    "description": role.get("description", ""),
                    "content_types": role.get("content_types", ["dcim.device"]),
                }

                result = await self.nautobot.rest_request(
                    "extras/roles/", method="POST", data=payload
                )

                created[role["name"]] = result["id"]
                logger.info("Created role: %s", role["name"])

            except Exception as e:
                logger.error("Error creating role '%s': %s", role["name"], e)
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
                    f"extras/tags/?name={tag['name']}", method="GET"
                )

                desired_content_types = desired_tag_content_types(tag)

                if response.get("count", 0) > 0:
                    existing = response["results"][0]
                    tag_id = existing["id"]
                    existing_content_types = tag_content_types_from_api_record(
                        existing
                    )
                    if desired_content_types != existing_content_types:
                        await self.nautobot.rest_request(
                            f"extras/tags/{tag_id}/",
                            method="PATCH",
                            data={"content_types": desired_content_types},
                        )
                        logger.info(
                            "Updated content_types for tag '%s': %s",
                            tag["name"],
                            desired_content_types,
                        )
                    else:
                        logger.info(
                            "Tag '%s' already exists with correct content_types",
                            tag["name"],
                        )
                    created[tag["name"]] = tag_id
                    continue

                # Create new tag
                color = tag.get("color", "gray")
                hex_color = color_map.get(color.lower(), color)

                payload = {
                    "name": tag["name"],
                    "color": hex_color,
                    "content_types": desired_content_types,
                }

                if "description" in tag:
                    payload["description"] = tag["description"]

                result = await self.nautobot.rest_request(
                    "extras/tags/", method="POST", data=payload
                )

                created[tag["name"]] = result["id"]
                logger.info("Created tag: %s", tag["name"])

            except Exception as e:
                logger.error("Error creating tag '%s': %s", tag["name"], e)
                raise

        return created

    async def create_manufacturers(
        self, manufacturers: List[Dict[str, Any]]
    ) -> Dict[str, str]:
        """Create manufacturers in Nautobot."""
        created = {}

        for manufacturer in manufacturers:
            try:
                # Check if already exists
                response = await self.nautobot.rest_request(
                    f"dcim/manufacturers/?name={manufacturer['name']}", method="GET"
                )

                if response.get("count", 0) > 0:
                    existing = response["results"][0]
                    created[manufacturer["name"]] = existing["id"]
                    logger.info(
                        "Manufacturer '%s' already exists", manufacturer["name"]
                    )
                    continue

                # Create new manufacturer
                payload = {
                    "name": manufacturer["name"],
                }

                if "description" in manufacturer:
                    payload["description"] = manufacturer["description"]

                result = await self.nautobot.rest_request(
                    "dcim/manufacturers/", method="POST", data=payload
                )

                created[manufacturer["name"]] = result["id"]
                logger.info("Created manufacturer: %s", manufacturer["name"])

            except Exception as e:
                logger.error(
                    "Error creating manufacturer '%s': %s", manufacturer["name"], e
                )
                raise

        return created

    async def create_platforms(self, platforms: List[Dict[str, Any]]) -> Dict[str, str]:
        """Create platforms in Nautobot."""
        created = {}

        for platform in platforms:
            try:
                # Check if already exists
                response = await self.nautobot.rest_request(
                    f"dcim/platforms/?name={platform['name']}", method="GET"
                )

                if response.get("count", 0) > 0:
                    existing = response["results"][0]
                    created[platform["name"]] = existing["id"]
                    logger.info("Platform '%s' already exists", platform["name"])
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
                    mfr_id = self.created_resources["manufacturers"].get(
                        platform["manufacturer"]
                    )
                    if mfr_id:
                        payload["manufacturer"] = {"id": mfr_id}

                result = await self.nautobot.rest_request(
                    "dcim/platforms/", method="POST", data=payload
                )

                created[platform["name"]] = result["id"]
                logger.info("Created platform: %s", platform["name"])

            except Exception as e:
                logger.error("Error creating platform '%s': %s", platform["name"], e)
                raise

        return created

    async def create_device_types(
        self, device_types: List[Dict[str, Any]]
    ) -> Dict[str, str]:
        """Create device types in Nautobot."""
        created = {}

        for device_type in device_types:
            try:
                # Check if already exists
                response = await self.nautobot.rest_request(
                    f"dcim/device-types/?model={device_type['model']}", method="GET"
                )

                if response.get("count", 0) > 0:
                    existing = response["results"][0]
                    created[device_type["model"]] = existing["id"]
                    logger.info("Device type '%s' already exists", device_type["model"])
                    continue

                # Resolve manufacturer
                mfr_id = self.created_resources["manufacturers"].get(
                    device_type["manufacturer"]
                )
                if not mfr_id:
                    logger.error(
                        "Manufacturer '%s' not found for device type '%s'",
                        device_type["manufacturer"],
                        device_type["model"],
                    )
                    continue

                # Create new device type
                payload = {
                    "model": device_type["model"],
                    "manufacturer": {"id": mfr_id},
                }

                if "description" in device_type:
                    payload["description"] = device_type["description"]

                result = await self.nautobot.rest_request(
                    "dcim/device-types/", method="POST", data=payload
                )

                created[device_type["model"]] = result["id"]
                logger.info("Created device type: %s", device_type["model"])

            except Exception as e:
                logger.error(
                    "Error creating device type '%s': %s",
                    device_type.get("model", "unknown"),
                    e,
                )
                raise

        return created

    async def create_prefixes(self, prefixes: List[Dict[str, Any]]) -> Dict[str, str]:
        """Create IP prefixes in Nautobot using DeviceCommonService."""
        created = {}

        for prefix in prefixes:
            try:
                prefix_cidr = prefix.get("prefix")
                logger.info("Processing prefix: %s", prefix_cidr)

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
                logger.info("Prefix '%s' ensured with ID: %s", prefix_cidr, prefix_id)

            except Exception as e:
                logger.error(
                    "Error creating prefix '%s': %s", prefix.get("prefix", "unknown"), e
                )
                raise

        return created

    async def create_custom_fields(
        self, custom_fields_data: Dict[str, List[Dict[str, Any]]]
    ) -> Dict[str, str]:
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
                logger.warning("Custom field '%s' has invalid configuration", field_key)
                continue

            field_config = field_configs[0]  # Get the first (and should be only) config

            try:
                # Generate key from label if not provided
                key = field_config.get("key", field_config.get("label", field_key))

                # Check if custom field already exists by fetching all and filtering client-side
                # (Nautobot API doesn't support filtering by key parameter)
                response = await self.nautobot.rest_request(
                    "extras/custom-fields/", method="GET"
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
                    logger.info("Custom field '%s' already exists", key)
                    continue

                # Prepare payload for custom field creation
                payload = {
                    "label": field_config.get("label", field_key),
                    "key": key,
                    "type": field_config[
                        "type"
                    ],  # Required: select, multi-select, text, etc.
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
                    "extras/custom-fields/", method="POST", data=payload
                )

                created[field_key] = result["id"]
                self.custom_field_cache[key] = result["id"]
                logger.info(
                    "Created custom field: %s (type: %s)", key, field_config["type"]
                )

            except Exception as e:
                logger.error("Error creating custom field '%s': %s", field_key, e)
                raise

        return created

    async def create_custom_field_choices(
        self, choices_data: Dict[str, List[Dict[str, Any]]]
    ) -> Dict[str, int]:
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
                logger.warning(
                    "Custom field choices for '%s' has invalid configuration", field_key
                )
                continue

            # Get the custom field UUID from cache
            custom_field_id = self.created_resources["custom_fields"].get(field_key)

            if not custom_field_id:
                # Try to look it up by key
                custom_field_id = self.custom_field_cache.get(field_key)

            if not custom_field_id:
                logger.error(
                    "Custom field '%s' not found. Cannot create choices.", field_key
                )
                continue

            created_count = 0

            for idx, choice in enumerate(choices):
                try:
                    value = choice.get("value")

                    if not value:
                        logger.warning(
                            "Choice for custom field '%s' missing 'value' field",
                            field_key,
                        )
                        continue

                    # Check if choice already exists
                    response = await self.nautobot.rest_request(
                        f"extras/custom-field-choices/?custom_field={custom_field_id}&value={value}",
                        method="GET",
                    )

                    if response.get("count", 0) > 0:
                        logger.info(
                            "Custom field choice '%s' for field '%s' already exists",
                            value,
                            field_key,
                        )
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
                        payload["weight"] = (
                            idx + 1
                        ) * 100  # Auto-increment: 100, 200, 300...

                    # Create the choice
                    await self.nautobot.rest_request(
                        "extras/custom-field-choices/", method="POST", data=payload
                    )

                    created_count += 1
                    logger.info(
                        "Created custom field choice: %s for field '%s'",
                        value,
                        field_key,
                    )

                except Exception as e:
                    logger.error(
                        "Error creating custom field choice '%s' for field '%s': %s",
                        choice.get("value", "unknown"),
                        field_key,
                        e,
                    )
                    # Continue with next choice instead of raising
                    continue

            created_counts[field_key] = created_count
            logger.info(
                "Created %s choices for custom field '%s'", created_count, field_key
            )

        return created_counts

    async def create_devices(self, devices: List[Dict[str, Any]]) -> Dict[str, str]:
        """Create devices in Nautobot using DeviceImportService."""
        created = {}
        import_service = DeviceImportService(self.nautobot)

        for device in devices:
            try:
                device_name = device.get("name")
                logger.info("Processing device: %s", device_name)

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
                    role_name = (
                        device["roles"][0]
                        if isinstance(device["roles"], list)
                        else device["roles"]
                    )
                    device_data["role"] = role_name
                elif "role" in device:
                    device_data["role"] = device["role"]
                else:
                    logger.error("No role specified for device '%s'", device_name)
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
                # Service now raises exceptions on failure instead of returning error dict
                result = await import_service.import_device(
                    device_data=device_data,
                    interface_config=interface_config,
                    skip_if_exists=True,
                )

                # If we got here, the import succeeded
                created[device_name] = result["device_id"]
                if result["created"]:
                    logger.info("Created device: %s", device_name)
                else:
                    logger.info("Device '%s' already exists, skipped", device_name)

            except Exception as e:
                logger.error(
                    "Error creating device '%s': %s", device.get("name", "unknown"), e
                )
                raise

        return created

    async def create_cluster_groups(
        self, cluster_groups: List[Dict[str, Any]]
    ) -> Dict[str, str]:
        """Create virtualization cluster groups in Nautobot."""
        created: Dict[str, str] = {}
        for group in cluster_groups:
            name = group["name"]
            try:
                response = await self.nautobot.rest_request(
                    f"virtualization/cluster-groups/?name={name}",
                    method="GET",
                )
                if response.get("count", 0) > 0:
                    existing = response["results"][0]
                    created[name] = existing["id"]
                    logger.info("Cluster group '%s' already exists", name)
                    continue

                payload = {"name": name}
                if "description" in group:
                    payload["description"] = group["description"]

                result = await self.nautobot.rest_request(
                    "virtualization/cluster-groups/",
                    method="POST",
                    data=payload,
                )
                created[name] = result["id"]
                logger.info("Created cluster group: %s", name)
            except Exception as e:
                logger.error("Error creating cluster group '%s': %s", name, e)
                raise
        return created

    async def create_cluster_types(
        self, cluster_types: List[Dict[str, Any]]
    ) -> Dict[str, str]:
        """Create virtualization cluster types in Nautobot."""
        created: Dict[str, str] = {}
        cluster_manager = ClusterManager(self.nautobot)
        for cluster_type in cluster_types:
            name = cluster_type["name"]
            try:
                response = await self.nautobot.rest_request(
                    f"virtualization/cluster-types/?name={name}",
                    method="GET",
                )
                if response.get("count", 0) > 0:
                    existing = response["results"][0]
                    created[name] = existing["id"]
                    logger.info("Cluster type '%s' already exists", name)
                    continue

                result = await cluster_manager.create_cluster_type(
                    name=name,
                    slug=cluster_type.get("slug"),
                    description=cluster_type.get("description"),
                )
                created[name] = result["id"]
                logger.info("Created cluster type: %s", name)
            except Exception as e:
                logger.error("Error creating cluster type '%s': %s", name, e)
                raise
        return created

    async def create_clusters(self, clusters: List[Dict[str, Any]]) -> Dict[str, str]:
        """Create virtualization clusters in Nautobot."""
        created: Dict[str, str] = {}
        cluster_manager = ClusterManager(self.nautobot)
        for cluster in clusters:
            name = cluster["name"]
            try:
                response = await self.nautobot.rest_request(
                    f"virtualization/clusters/?name={name}",
                    method="GET",
                )
                if response.get("count", 0) > 0:
                    existing = response["results"][0]
                    created[name] = existing["id"]
                    logger.info("Cluster '%s' already exists", name)
                    continue

                group_id: Optional[str] = None
                group_name = cluster.get("cluster_group")
                if group_name:
                    group_id = self.created_resources["cluster_groups"].get(group_name)
                    if not group_id:
                        logger.warning(
                            "Cluster group '%s' not found for cluster '%s'",
                            group_name,
                            name,
                        )

                location_id: Optional[str] = None
                location_name = cluster.get("location")
                if location_name:
                    location_id = self.created_resources["locations"].get(
                        location_name
                    )
                    if not location_id:
                        logger.warning(
                            "Location '%s' not found for cluster '%s'",
                            location_name,
                            name,
                        )

                type_name = cluster.get("cluster_type", DEFAULT_CLUSTER_TYPE_NAME)
                type_id: Optional[str] = None
                if type_name:
                    type_id = self.created_resources["cluster_types"].get(type_name)
                    if not type_id:
                        logger.warning(
                            "Cluster type '%s' not found for cluster '%s'",
                            type_name,
                            name,
                        )

                description = cluster.get("description")
                result = await cluster_manager.create_cluster(
                    name=name,
                    description=description,
                    cluster_type_id=type_id,
                    cluster_group_id=group_id,
                    location_id=location_id,
                )
                created[name] = result["id"]
                logger.info("Created cluster: %s", name)
            except Exception as e:
                logger.error("Error creating cluster '%s': %s", name, e)
                raise
        return created

    async def create_virtual_machines(
        self, virtual_machines: List[Dict[str, Any]]
    ) -> Dict[str, str]:
        """Create virtual machines in Nautobot using VirtualMachineManager."""
        created: Dict[str, str] = {}
        vm_manager = VirtualMachineManager(self.nautobot)
        network_resolver = NetworkResolver(self.nautobot)
        metadata_resolver = MetadataResolver(self.nautobot)
        ip_manager = IPManager(self.nautobot, network_resolver, metadata_resolver)

        for vm in virtual_machines:
            vm_name = vm.get("name")
            if not vm_name:
                continue
            try:
                existing = await self.nautobot.rest_request(
                    f"virtualization/virtual-machines/?name={vm_name}",
                    method="GET",
                )
                if existing.get("count", 0) > 0:
                    created[vm_name] = existing["results"][0]["id"]
                    logger.info("Virtual machine '%s' already exists", vm_name)
                    continue

                cluster_name = vm.get("cluster")
                cluster_id = self.created_resources["clusters"].get(cluster_name)
                if not cluster_id:
                    logger.error(
                        "Cluster '%s' not found for VM '%s'", cluster_name, vm_name
                    )
                    continue

                status_name = vm.get("status", "active")
                status_uuid = await self.get_status_uuid(
                    status_name, STATUS_CONTENT_TYPE_VM
                )
                if not status_uuid:
                    logger.error(
                        "Status '%s' not found for VM '%s' (content_type=%s)",
                        status_name,
                        vm_name,
                        STATUS_CONTENT_TYPE_VM,
                    )
                    continue

                role_id = None
                if "roles" in vm and vm["roles"]:
                    role_name = (
                        vm["roles"][0] if isinstance(vm["roles"], list) else vm["roles"]
                    )
                    role_id = self.created_resources["roles"].get(role_name)
                elif "role" in vm:
                    role_id = self.created_resources["roles"].get(vm["role"])

                platform_id = None
                if "platform" in vm:
                    platform_id = self.created_resources["platforms"].get(
                        vm["platform"]
                    )

                tag_ids: List[str] = []
                if vm.get("tags"):
                    for tag_name in vm["tags"]:
                        tag_id = self.created_resources["tags"].get(tag_name)
                        if tag_id:
                            tag_ids.append(tag_id)

                custom_fields = vm.get("custom_fields") or {}

                vm_result = await vm_manager.create_virtual_machine(
                    name=vm_name,
                    cluster_id=cluster_id,
                    status_id=status_uuid,
                    role_id=role_id,
                    platform_id=platform_id,
                    tags=tag_ids or None,
                    custom_fields=custom_fields,
                )
                vm_id = vm_result.get("id")
                if not vm_id:
                    raise RuntimeError(f"VM '{vm_name}' created without ID")

                primary_ip_id = None
                if vm.get("interfaces"):
                    for iface in vm["interfaces"]:
                        iface_status_name = iface.get("status", status_name)
                        iface_status_uuid = await self.get_status_uuid(
                            iface_status_name, STATUS_CONTENT_TYPE_VM_INTERFACE
                        )
                        if not iface_status_uuid and iface_status_name.lower() != "active":
                            logger.warning(
                                "Status '%s' not found for VM interface on '%s'; "
                                "falling back to Active",
                                iface_status_name,
                                vm_name,
                            )
                            iface_status_uuid = await self.get_status_uuid(
                                "active", STATUS_CONTENT_TYPE_VM_INTERFACE
                            )
                        if not iface_status_uuid:
                            logger.error(
                                "No suitable status for VM interface on '%s' "
                                "(content_type=%s)",
                                vm_name,
                                STATUS_CONTENT_TYPE_VM_INTERFACE,
                            )
                            raise RuntimeError(
                                "Missing Active status for virtualization interface"
                            )

                        iface_result = await vm_manager.create_virtual_interface(
                            name=iface.get("name", "eth0"),
                            virtual_machine_id=vm_id,
                            status_id=iface_status_uuid,
                            enabled=iface.get("enabled", True),
                        )
                        interface_id = iface_result.get("id")
                        if not interface_id or "ip_address" not in iface:
                            continue

                        namespace = iface.get("namespace", "Global")
                        namespace_id = await network_resolver.resolve_namespace_id(
                            namespace
                        )
                        if not namespace_id:
                            raise ValueError(
                                f"Could not resolve namespace '{namespace}'"
                            )

                        ip_status_name = iface.get("ip_status", "active")
                        ip_id = await ip_manager.ensure_ip_address_exists(
                            ip_address=iface["ip_address"],
                            namespace_id=namespace_id,
                            status_name=ip_status_name,
                            add_prefixes_automatically=True,
                        )
                        await vm_manager.assign_ip_to_virtual_interface(
                            ip_address_id=ip_id,
                            virtual_interface_id=interface_id,
                        )

                        if "primary_ip4" in vm:
                            primary_ip = vm["primary_ip4"].split("/")[0]
                            iface_ip = iface["ip_address"].split("/")[0]
                            if primary_ip == iface_ip:
                                primary_ip_id = ip_id

                if primary_ip_id:
                    await vm_manager.assign_primary_ip_to_vm(vm_id, primary_ip_id)

                created[vm_name] = vm_id
                logger.info("Created virtual machine: %s", vm_name)
            except Exception as e:
                logger.error(
                    "Error creating virtual machine '%s': %s",
                    vm.get("name", "unknown"),
                    e,
                )
                raise

        return created

    async def create_baseline(
        self, directory: str | None = None
    ) -> Dict[str, Any]:
        """
        Load baseline files and create all resources in Nautobot.
        Creates resources in the correct order to handle dependencies.

        Returns:
            Dictionary with summary of created resources
        """
        try:
            # Load all baseline files
            baseline_data_list = await self.load_baseline_files(directory)

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
                "cluster_types": [],
                "cluster_groups": [],
                "clusters": [],
                "devices": [],
                "virtual_machines": [],
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

            if merged_data["clusters"] and not merged_data["cluster_types"]:
                merged_data["cluster_types"] = [
                    {
                        "name": DEFAULT_CLUSTER_TYPE_NAME,
                        "slug": DEFAULT_CLUSTER_TYPE_NAME,
                    }
                ]

            # Create resources in dependency order
            summary = {
                "success": True,
                "message": "Test baseline created successfully",
                "created": {},
                "errors": [],
            }

            # 1. Location Types (no dependencies)
            if merged_data["location_types"]:
                self.created_resources[
                    "location_types"
                ] = await self.create_location_types(merged_data["location_types"])
                summary["created"]["location_types"] = len(
                    self.created_resources["location_types"]
                )

            # 2. Locations (depends on location types and parent locations)
            if merged_data["location"]:
                self.created_resources["locations"] = await self.create_locations(
                    merged_data["location"]
                )
                summary["created"]["locations"] = len(
                    self.created_resources["locations"]
                )

            # 3. Roles (no dependencies)
            if merged_data["roles"]:
                self.created_resources["roles"] = await self.create_roles(
                    merged_data["roles"]
                )
                summary["created"]["roles"] = len(self.created_resources["roles"])

            # 4. Tags (no dependencies)
            if merged_data["tags"]:
                self.created_resources["tags"] = await self.create_tags(
                    merged_data["tags"]
                )
                summary["created"]["tags"] = len(self.created_resources["tags"])

            # 5. Manufacturers (no dependencies)
            if merged_data["manufacturers"]:
                self.created_resources[
                    "manufacturers"
                ] = await self.create_manufacturers(merged_data["manufacturers"])
                summary["created"]["manufacturers"] = len(
                    self.created_resources["manufacturers"]
                )

            # 6. Platforms (depends on manufacturers)
            if merged_data["platforms"]:
                self.created_resources["platforms"] = await self.create_platforms(
                    merged_data["platforms"]
                )
                summary["created"]["platforms"] = len(
                    self.created_resources["platforms"]
                )

            # 7. Device Types (depends on manufacturers)
            if merged_data["device_types"]:
                self.created_resources["device_types"] = await self.create_device_types(
                    merged_data["device_types"]
                )
                summary["created"]["device_types"] = len(
                    self.created_resources["device_types"]
                )

            # 8. Prefixes (no dependencies, but should be created before devices)
            if merged_data["prefixes"]:
                self.created_resources["prefixes"] = await self.create_prefixes(
                    merged_data["prefixes"]
                )
                summary["created"]["prefixes"] = len(self.created_resources["prefixes"])

            # 9. Custom Fields (no dependencies, but should be created before custom field choices)
            if merged_data["custom_fields"]:
                self.created_resources[
                    "custom_fields"
                ] = await self.create_custom_fields(merged_data["custom_fields"])
                summary["created"]["custom_fields"] = len(
                    self.created_resources["custom_fields"]
                )

            # 10. Custom Field Choices (depends on custom fields)
            if merged_data["custom_field_choices"]:
                choice_counts = await self.create_custom_field_choices(
                    merged_data["custom_field_choices"]
                )
                # Sum up all the choice counts
                total_choices = sum(choice_counts.values())
                summary["created"]["custom_field_choices"] = total_choices

            # 11. Cluster types (before cluster groups and clusters)
            if merged_data["cluster_types"]:
                self.created_resources[
                    "cluster_types"
                ] = await self.create_cluster_types(merged_data["cluster_types"])
                summary["created"]["cluster_types"] = len(
                    self.created_resources["cluster_types"]
                )

            # 12. Cluster groups (before clusters)
            if merged_data["cluster_groups"]:
                self.created_resources[
                    "cluster_groups"
                ] = await self.create_cluster_groups(merged_data["cluster_groups"])
                summary["created"]["cluster_groups"] = len(
                    self.created_resources["cluster_groups"]
                )

            # 13. Clusters (depends on cluster types and cluster groups)
            if merged_data["clusters"]:
                self.created_resources["clusters"] = await self.create_clusters(
                    merged_data["clusters"]
                )
                summary["created"]["clusters"] = len(self.created_resources["clusters"])

            # 14. Devices (depends on device types, locations, platforms, roles, tags, prefixes, and custom fields)
            if merged_data["devices"]:
                self.created_resources["devices"] = await self.create_devices(
                    merged_data["devices"]
                )
                summary["created"]["devices"] = len(self.created_resources["devices"])

            # 15. Virtual machines (depends on clusters, roles, platforms, tags, prefixes)
            if merged_data["virtual_machines"]:
                self.created_resources[
                    "virtual_machines"
                ] = await self.create_virtual_machines(merged_data["virtual_machines"])
                summary["created"]["virtual_machines"] = len(
                    self.created_resources["virtual_machines"]
                )

            logger.info("Baseline creation complete: %s", summary)
            return summary

        except Exception as e:
            logger.error("Error creating baseline: %s", e, exc_info=True)
            return {
                "success": False,
                "message": f"Failed to create baseline: {str(e)}",
                "error": str(e),
            }
