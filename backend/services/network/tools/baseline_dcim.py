"""DCIM/extras resource creation phase of the baseline import.

Mixin for :class:`services.network.tools.baseline.BaselineImportService`;
expects ``self.nautobot``, ``self.common``, ``self.created_resources`` and
``self.get_status_uuid`` from the host class.
"""

import logging
from typing import Any, Dict, List

from services.network.tools.baseline_normalizers import (
    STATUS_CONTENT_TYPE_LOCATION,
    content_types_from_api_record,
    desired_tag_content_types,
    normalize_location_type_content_types,
    sort_location_types_by_parent,
    tag_content_types_from_api_record,
)

logger = logging.getLogger(__name__)


class BaselineDcimMixin:
    """Creation of location types, locations, roles, tags, manufacturers,
    platforms, device types, and prefixes."""

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
                    existing_content_types = tag_content_types_from_api_record(existing)
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
