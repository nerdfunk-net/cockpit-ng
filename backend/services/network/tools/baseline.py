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
from services.network.tools.baseline_dcim import BaselineDcimMixin
from services.network.tools.baseline_extras import BaselineExtrasMixin

# Re-exported for backward compatibility — callers and tests import these
# names from this module.
from services.network.tools.baseline_normalizers import (
    DEFAULT_CLUSTER_TYPE_NAME as DEFAULT_CLUSTER_TYPE_NAME,
)
from services.network.tools.baseline_normalizers import (
    DEFAULT_TAG_CONTENT_TYPES as DEFAULT_TAG_CONTENT_TYPES,
)
from services.network.tools.baseline_normalizers import (
    STATUS_CONTENT_TYPE_IP_ADDRESS as STATUS_CONTENT_TYPE_IP_ADDRESS,
)
from services.network.tools.baseline_normalizers import (
    STATUS_CONTENT_TYPE_LOCATION as STATUS_CONTENT_TYPE_LOCATION,
)
from services.network.tools.baseline_normalizers import (
    STATUS_CONTENT_TYPE_VM as STATUS_CONTENT_TYPE_VM,
)
from services.network.tools.baseline_normalizers import (
    STATUS_CONTENT_TYPE_VM_INTERFACE as STATUS_CONTENT_TYPE_VM_INTERFACE,
)
from services.network.tools.baseline_normalizers import (
    content_types_from_api_record as content_types_from_api_record,
)
from services.network.tools.baseline_normalizers import (
    desired_tag_content_types as desired_tag_content_types,
)
from services.network.tools.baseline_normalizers import (
    normalize_content_types as normalize_content_types,
)
from services.network.tools.baseline_normalizers import (
    normalize_location_type_content_types as normalize_location_type_content_types,
)
from services.network.tools.baseline_normalizers import (
    sort_location_types_by_parent as sort_location_types_by_parent,
)
from services.network.tools.baseline_normalizers import (
    tag_content_types_from_api_record as tag_content_types_from_api_record,
)
from services.network.tools.baseline_virtualization import (
    BaselineVirtualizationMixin,
)

logger = logging.getLogger(__name__)


class BaselineImportService(
    BaselineDcimMixin, BaselineExtrasMixin, BaselineVirtualizationMixin
):
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

    async def create_baseline(self, directory: str | None = None) -> Dict[str, Any]:
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
