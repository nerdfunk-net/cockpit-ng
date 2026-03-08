"""
Inventory query service — Nautobot GraphQL query methods for device lookups.

Extracted from InventoryService as part of Phase 4 decomposition.
See: doc/refactoring/REFACTORING_SERVICES.md — Phase 4
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

from models.inventory import DeviceInfo

logger = logging.getLogger(__name__)


class InventoryQueryService:
    """Handles all Nautobot GraphQL queries for inventory device lookups."""

    def __init__(self):
        # Cache for custom field types (key -> type mapping)
        self._custom_field_types_cache = None

    async def _get_custom_field_types(self) -> Dict[str, str]:
        """
        Fetch custom field types from Nautobot API and cache them.

        Returns:
            Dictionary mapping custom field keys to their types
            (e.g., {"checkmk_site": "select", "freifeld": "text"})
        """
        if self._custom_field_types_cache is not None:
            return self._custom_field_types_cache

        try:
            import service_factory

            nautobot_metadata_service = service_factory.build_nautobot_metadata_service()

            logger.info("Fetching custom field types from Nautobot")

            custom_fields = await nautobot_metadata_service.get_device_custom_fields()

            type_mapping = {}
            for field in custom_fields:
                field_key = field.get("key")
                field_type_dict = field.get("type", {})
                field_type_value = (
                    field_type_dict.get("value")
                    if isinstance(field_type_dict, dict)
                    else None
                )

                if field_key and field_type_value:
                    type_mapping[field_key] = field_type_value
                    logger.info(
                        "Custom field '%s' has type '%s'", field_key, field_type_value
                    )

            logger.info(
                "Loaded %s custom field types: %s", len(type_mapping), type_mapping
            )

            self._custom_field_types_cache = type_mapping
            return type_mapping

        except Exception as e:
            logger.error("Error fetching custom field types: %s", e, exc_info=True)
            return {}

    async def _query_all_devices(self) -> List[DeviceInfo]:
        """Query all devices from Nautobot without any filters."""
        import service_factory
        nautobot_service = service_factory.build_nautobot_service()

        query = """
        query all_devices {
            devices {
                id
                name
                serial
                primary_ip4 {
                    address
                }
                status {
                    name
                }
                device_type {
                    model
                    manufacturer {
                        name
                    }
                }
                role {
                    name
                }
                location {
                    name
                }
                tags {
                    name
                }
                platform {
                    name
                }
            }
        }
        """

        result = await nautobot_service.graphql_query(query, {})
        devices_data = result.get("data", {}).get("devices", [])
        logger.info("Retrieved %s total devices", len(devices_data))
        return self._parse_device_data(devices_data)

    async def _query_devices_by_name(
        self, name_filter: str, use_contains: bool = False
    ) -> List[DeviceInfo]:
        """Query devices by name using GraphQL."""
        import service_factory
        nautobot_service = service_factory.build_nautobot_service()

        if not name_filter or (
            isinstance(name_filter, str) and name_filter.strip() == ""
        ):
            logger.warning("Empty name_filter provided, returning empty result")
            return []

        if use_contains:
            query = """
            query devices_by_name($name_filter: [String]) {
                devices(name__ire: $name_filter) {
                    id
                    name
                    serial
                    primary_ip4 {
                        address
                    }
                    status {
                        name
                    }
                    device_type {
                        model
                        manufacturer {
                            name
                        }
                    }
                    role {
                        name
                    }
                    location {
                        name
                    }
                    tags {
                        name
                    }
                    platform {
                        name
                    }
                }
            }
            """
        else:
            query = """
            query devices_by_name($name_filter: [String]) {
                devices(name: $name_filter) {
                    id
                    name
                    serial
                    primary_ip4 {
                        address
                    }
                    status {
                        name
                    }
                    device_type {
                        model
                        manufacturer {
                            name
                        }
                    }
                    role {
                        name
                    }
                    location {
                        name
                    }
                    tags {
                        name
                    }
                    platform {
                        name
                    }
                }
            }
            """

        variables = {"name_filter": [name_filter]}
        result = await nautobot_service.graphql_query(query, variables)

        logger.info("GraphQL result for name query: %s", result)

        devices_data = result.get("data", {}).get("devices", [])
        return self._parse_device_data(devices_data)

    async def _query_devices_by_location(
        self,
        location_filter: str,
        use_contains: bool = False,
        use_negation: bool = False,
    ) -> List[DeviceInfo]:
        """Query devices by location using GraphQL.

        This method queries devices directly by location filter, which automatically
        includes devices from child locations in the hierarchy.

        Args:
            location_filter: Location name or ID to filter by
            use_contains: Use case-insensitive contains matching
            use_negation: Use negation (location__n) to exclude devices from this location
        """
        import service_factory
        nautobot_service = service_factory.build_nautobot_service()

        if not location_filter or (
            isinstance(location_filter, str) and location_filter.strip() == ""
        ):
            logger.warning("Empty location_filter provided, returning empty result")
            return []

        if use_negation:
            query = """
            query devices_by_location ($location_filter: [String]) {
                devices (location__n: $location_filter) {
                    id
                    name
                    serial
                    role {
                        name
                    }
                    location {
                        name
                    }
                    primary_ip4 {
                        address
                    }
                    status {
                        name
                    }
                    device_type {
                        model
                        manufacturer {
                            name
                        }
                    }
                    tags {
                        name
                    }
                    platform {
                        name
                    }
                }
            }
            """
        elif use_contains:
            query = """
            query devices_by_location ($location_filter: [String]) {
                devices (location__name__ic: $location_filter) {
                    id
                    name
                    serial
                    role {
                        name
                    }
                    location {
                        name
                    }
                    primary_ip4 {
                        address
                    }
                    status {
                        name
                    }
                    device_type {
                        model
                        manufacturer {
                            name
                        }
                    }
                    tags {
                        name
                    }
                    platform {
                        name
                    }
                }
            }
            """
        else:
            query = """
            query devices_by_location ($location_filter: [String]) {
                devices (location: $location_filter) {
                    id
                    name
                    serial
                    role {
                        name
                    }
                    location {
                        name
                    }
                    primary_ip4 {
                        address
                    }
                    status {
                        name
                    }
                    device_type {
                        model
                        manufacturer {
                            name
                        }
                    }
                    tags {
                        name
                    }
                    platform {
                        name
                    }
                }
            }
            """

        variables = {"location_filter": [location_filter]}
        result = await nautobot_service.graphql_query(query, variables)

        logger.info(
            "GraphQL result for location query '%s': Found %s devices",
            location_filter,
            len(result.get("data", {}).get("devices", [])),
        )

        devices_data = result.get("data", {}).get("devices", [])
        return self._parse_device_data(devices_data)

    async def _query_devices_by_role(self, role_filter: str) -> List[DeviceInfo]:
        """Query devices by role using GraphQL."""
        import service_factory
        nautobot_service = service_factory.build_nautobot_service()

        if not role_filter or (
            isinstance(role_filter, str) and role_filter.strip() == ""
        ):
            logger.warning("Empty role_filter provided, returning empty result")
            return []

        query = """
        query devices_by_role($role_filter: [String]) {
            devices(role: $role_filter) {
                id
                name
                serial
                primary_ip4 {
                    address
                }
                status {
                    name
                }
                device_type {
                    model
                    manufacturer {
                        name
                    }
                }
                role {
                    name
                }
                location {
                    name
                }
                tags {
                    name
                }
                platform {
                    name
                }
            }
        }
        """

        variables = {"role_filter": [role_filter]}
        result = await nautobot_service.graphql_query(query, variables)

        return self._parse_device_data(result.get("data", {}).get("devices", []))

    async def _query_devices_by_status(self, status_filter: str) -> List[DeviceInfo]:
        """Query devices by status using GraphQL."""
        import service_factory
        nautobot_service = service_factory.build_nautobot_service()

        if not status_filter or (
            isinstance(status_filter, str) and status_filter.strip() == ""
        ):
            logger.warning("Empty status_filter provided, returning empty result")
            return []

        query = """
        query devices_by_status($status_filter: [String]) {
            devices(status: $status_filter) {
                id
                name
                serial
                primary_ip4 {
                    address
                }
                status {
                    name
                }
                device_type {
                    model
                    manufacturer {
                        name
                    }
                }
                role {
                    name
                }
                location {
                    name
                }
                tags {
                    name
                }
                platform {
                    name
                }
            }
        }
        """

        variables = {"status_filter": [status_filter]}
        result = await nautobot_service.graphql_query(query, variables)

        return self._parse_device_data(result.get("data", {}).get("devices", []))

    async def _query_devices_by_tag(self, tag_filter: str) -> List[DeviceInfo]:
        """Query devices by tag using GraphQL."""
        import service_factory
        nautobot_service = service_factory.build_nautobot_service()

        if not tag_filter or (isinstance(tag_filter, str) and tag_filter.strip() == ""):
            logger.warning("Empty tag_filter provided, returning empty result")
            return []

        query = """
        query devices_by_tag($tag_filter: [String]) {
            devices(tags: $tag_filter) {
                id
                name
                serial
                primary_ip4 {
                    address
                }
                status {
                    name
                }
                device_type {
                    model
                    manufacturer {
                        name
                    }
                }
                role {
                    name
                }
                location {
                    name
                }
                tags {
                    name
                }
                platform {
                    name
                }
            }
        }
        """

        variables = {"tag_filter": [tag_filter]}
        result = await nautobot_service.graphql_query(query, variables)

        return self._parse_device_data(result.get("data", {}).get("devices", []))

    async def _query_devices_by_devicetype(
        self, devicetype_filter: str
    ) -> List[DeviceInfo]:
        """Query devices by device type using GraphQL."""
        import service_factory
        nautobot_service = service_factory.build_nautobot_service()

        if not devicetype_filter or (
            isinstance(devicetype_filter, str) and devicetype_filter.strip() == ""
        ):
            logger.warning("Empty devicetype_filter provided, returning empty result")
            return []

        query = """
        query devices_by_devicetype($devicetype_filter: [String]) {
            devices(device_type: $devicetype_filter) {
                id
                name
                serial
                primary_ip4 {
                    address
                }
                status {
                    name
                }
                device_type {
                    model
                    manufacturer {
                        name
                    }
                }
                role {
                    name
                }
                location {
                    name
                }
                tags {
                    name
                }
                platform {
                    name
                }
            }
        }
        """

        variables = {"devicetype_filter": [devicetype_filter]}
        result = await nautobot_service.graphql_query(query, variables)

        return self._parse_device_data(result.get("data", {}).get("devices", []))

    async def _query_devices_by_manufacturer(
        self, manufacturer_filter: str
    ) -> List[DeviceInfo]:
        """Query devices by manufacturer using GraphQL."""
        import service_factory
        nautobot_service = service_factory.build_nautobot_service()

        if not manufacturer_filter or (
            isinstance(manufacturer_filter, str) and manufacturer_filter.strip() == ""
        ):
            logger.warning("Empty manufacturer_filter provided, returning empty result")
            return []

        query = """
        query devices_by_manufacturer($manufacturer_filter: [String]) {
            devices(manufacturer: $manufacturer_filter) {
                id
                name
                serial
                primary_ip4 {
                    address
                }
                status {
                    name
                }
                device_type {
                    model
                    manufacturer {
                        name
                    }
                }
                role {
                    name
                }
                location {
                    name
                }
                tags {
                    name
                }
                platform {
                    name
                }
            }
        }
        """

        variables = {"manufacturer_filter": [manufacturer_filter]}
        result = await nautobot_service.graphql_query(query, variables)

        return self._parse_device_data(result.get("data", {}).get("devices", []))

    async def _query_devices_by_platform(
        self, platform_filter: str
    ) -> List[DeviceInfo]:
        """Query devices by platform using GraphQL."""
        import service_factory
        nautobot_service = service_factory.build_nautobot_service()

        if not platform_filter or (
            isinstance(platform_filter, str) and platform_filter.strip() == ""
        ):
            logger.warning("Empty platform_filter provided, returning empty result")
            return []

        query = """
        query devices_by_platform($platform_filter: [String]) {
            devices(platform: $platform_filter) {
                id
                name
                serial
                primary_ip4 {
                    address
                }
                status {
                    name
                }
                device_type {
                    model
                    manufacturer {
                        name
                    }
                }
                role {
                    name
                }
                location {
                    name
                }
                tags {
                    name
                }
                platform {
                    name
                }
            }
        }
        """

        variables = {"platform_filter": [platform_filter]}
        result = await nautobot_service.graphql_query(query, variables)

        return self._parse_device_data(result.get("data", {}).get("devices", []))

    async def _query_devices_by_has_primary(
        self, has_primary_filter: str
    ) -> List[DeviceInfo]:
        """Query devices by whether they have a primary IP using GraphQL."""
        import service_factory
        nautobot_service = service_factory.build_nautobot_service()

        has_primary_bool = has_primary_filter.lower() == "true"

        logger.info("Querying devices with has_primary_ip=%s", has_primary_bool)

        query = """
        query devices_by_has_primary($has_primary: Boolean) {
            devices(has_primary_ip: $has_primary) {
                id
                name
                serial
                primary_ip4 {
                    address
                }
                status {
                    name
                }
                device_type {
                    model
                    manufacturer {
                        name
                    }
                }
                role {
                    name
                }
                location {
                    name
                }
                tags {
                    name
                }
                platform {
                    name
                }
            }
        }
        """

        variables = {"has_primary": has_primary_bool}
        result = await nautobot_service.graphql_query(query, variables)

        devices = self._parse_device_data(result.get("data", {}).get("devices", []))
        logger.info(
            "Found %s devices with has_primary_ip=%s", len(devices), has_primary_bool
        )

        return devices

    def _parse_device_data(
        self, devices_data: List[Dict[str, Any]]
    ) -> List[DeviceInfo]:
        """Parse GraphQL device data into DeviceInfo objects."""
        devices = []

        for device_data in devices_data:
            primary_ip = None
            if device_data.get("primary_ip4") and device_data["primary_ip4"].get(
                "address"
            ):
                primary_ip = device_data["primary_ip4"]["address"]

            status = None
            if device_data.get("status") and device_data["status"].get("name"):
                status = device_data["status"]["name"]

            device_type = None
            if device_data.get("device_type") and device_data["device_type"].get(
                "model"
            ):
                device_type = device_data["device_type"]["model"]

            manufacturer = None
            if (
                device_data.get("device_type")
                and device_data["device_type"].get("manufacturer")
                and device_data["device_type"]["manufacturer"].get("name")
            ):
                manufacturer = device_data["device_type"]["manufacturer"]["name"]

            role = None
            if device_data.get("role") and device_data["role"].get("name"):
                role = device_data["role"]["name"]

            location = None
            if device_data.get("location") and device_data["location"].get("name"):
                location = device_data["location"]["name"]

            platform = None
            if device_data.get("platform") and device_data["platform"].get("name"):
                platform = device_data["platform"]["name"]

            tags = []
            if device_data.get("tags"):
                tags = [
                    tag.get("name", "")
                    for tag in device_data["tags"]
                    if tag.get("name")
                ]

            device_name = device_data.get("name")
            serial = device_data.get("serial")

            device = DeviceInfo(
                id=device_data.get("id", ""),
                name=device_name,
                serial=serial,
                primary_ip4=primary_ip,
                status=status,
                device_type=device_type,
                role=role,
                location=location,
                platform=platform,
                tags=tags,
                manufacturer=manufacturer,
            )

            devices.append(device)

        return devices

    async def _query_devices_by_custom_field(
        self,
        custom_field_name: str,
        custom_field_value: str,
        use_contains: bool = False,
    ) -> List[DeviceInfo]:
        """
        Query devices by custom field value.

        Args:
            custom_field_name: Name of the custom field (with cf_ prefix)
            custom_field_value: Value to search for
            use_contains: Whether to use contains (icontains) or exact match

        Returns:
            List of matching devices
        """
        try:
            import service_factory
            nautobot_service = service_factory.build_nautobot_service()

            if (
                not custom_field_name
                or not custom_field_value
                or (
                    isinstance(custom_field_value, str)
                    and custom_field_value.strip() == ""
                )
            ):
                logger.warning(
                    "Empty custom_field_name or custom_field_value provided, returning empty result"
                )
                return []

            custom_field_types = await self._get_custom_field_types()

            cf_key = custom_field_name.replace("cf_", "")
            cf_type = custom_field_types.get(cf_key)

            if cf_type == "select":
                graphql_var_type = "[String]"
            elif use_contains:
                graphql_var_type = "[String]"
            else:
                graphql_var_type = "String"

            logger.info(
                "Custom field '%s' type='%s', use_contains=%s, GraphQL type='%s'",
                cf_key,
                cf_type,
                use_contains,
                graphql_var_type,
            )

            filter_field = custom_field_name

            if use_contains:
                query = f"""
                query devices_by_custom_field($field_value: {graphql_var_type}) {{
                  devices({filter_field}__ic: $field_value) {{
                    id
                    name
                    serial
                    role {{
                      name
                    }}
                    location {{
                      name
                    }}
                    primary_ip4 {{
                      address
                    }}
                    status {{
                      name
                    }}
                    device_type {{
                      model
                      manufacturer {{
                        name
                      }}
                    }}
                    tags {{
                      name
                    }}
                    platform {{
                      name
                    }}
                  }}
                }}
                """
            else:
                query = f"""
                query devices_by_custom_field($field_value: {graphql_var_type}) {{
                  devices({filter_field}: $field_value) {{
                    id
                    name
                    serial
                    role {{
                      name
                    }}
                    location {{
                      name
                    }}
                    primary_ip4 {{
                      address
                    }}
                    status {{
                      name
                    }}
                    device_type {{
                      model
                      manufacturer {{
                        name
                      }}
                    }}
                    tags {{
                      name
                    }}
                    platform {{
                      name
                    }}
                  }}
                }}
                """

            if graphql_var_type == "[String]":
                variables = {"field_value": [custom_field_value]}
            else:
                variables = {"field_value": custom_field_value}

            logger.debug("Custom field '%s' GraphQL query:\n%s", cf_key, query)
            logger.debug("Custom field '%s' variables: %s", cf_key, variables)
            logger.info(
                "Custom field '%s' filter: %s, type: %s, graphql_var_type: %s",
                cf_key,
                filter_field,
                cf_type,
                graphql_var_type,
            )

            result = await nautobot_service.graphql_query(query, variables)

            if "errors" in result:
                logger.error(
                    "GraphQL errors in custom field query: %s", result["errors"]
                )
                return []

            return self._parse_device_data(result.get("data", {}).get("devices", []))

        except Exception as e:
            logger.error(
                "Error querying devices by custom field '%s': %s", custom_field_name, e
            )
            return []
