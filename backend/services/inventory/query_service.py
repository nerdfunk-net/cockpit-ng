"""
Inventory query service — Nautobot GraphQL query methods for device lookups.

Extracted from InventoryService as part of Phase 4 decomposition.
See: doc/refactoring/REFACTORING_SERVICES.md — Phase 4

Cache strategy (Option A — cache-first):
  Most filter operations load the full device list once from Redis
  (key: nautobot:devices:all, populated by cache_all_devices_task) and
  perform in-Python filtering.  The per-request cache lives in
  DeviceCacheLoader so multiple conditions in the same inventory preview
  only pay the Redis round-trip once.

  Exceptions that still go directly to Nautobot GraphQL:
    • location  — Nautobot resolves child-location hierarchy server-side
    • ip_prefix — requires server-side CIDR containment logic
    • custom_field — fields are dynamic and not stored in the cache
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from models.inventory import DeviceInfo
from services.inventory import device_filters as filters
from services.inventory.device_cache import DeviceCacheLoader

if TYPE_CHECKING:
    from services.settings.cache import RedisCacheService

logger = logging.getLogger(__name__)


class InventoryQueryService:
    """Handles all Nautobot GraphQL queries for inventory device lookups."""

    def __init__(self, cache_service: Optional[RedisCacheService] = None):
        self._cache = DeviceCacheLoader(cache_service)

    # ------------------------------------------------------------------
    # Delegation shim (used by inventory.py and tests)
    # ------------------------------------------------------------------

    async def _get_custom_field_types(self) -> Dict[str, str]:
        return await self._cache.get_custom_field_types()

    # ------------------------------------------------------------------
    # Cache-backed device list (with live fallback)
    # ------------------------------------------------------------------

    async def _get_all_devices_cached(self) -> List[DeviceInfo]:
        """Return all devices, preferring the Redis bulk cache over a live API call."""
        devices = await self._cache.get_all()
        if not self._cache.is_populated:
            # Redis miss — fall back to live Nautobot query and warm the loader
            devices = await self._query_all_devices_live()
            self._cache.set_devices(devices)
        return devices

    # ------------------------------------------------------------------
    # Live Nautobot GraphQL helpers (used as fallback or for uncacheable queries)
    # ------------------------------------------------------------------

    async def _query_all_devices_live(self) -> List[DeviceInfo]:
        """Query all devices from Nautobot without any filters (no cache)."""
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
        logger.info("Retrieved %s total devices from Nautobot", len(devices_data))
        return self._parse_device_data(devices_data)

    async def _query_all_devices(self) -> List[DeviceInfo]:
        """Return all devices, using the bulk cache when available."""
        return await self._get_all_devices_cached()

    # ------------------------------------------------------------------
    # Cache-first filter methods (delegate pure logic to device_filters)
    # ------------------------------------------------------------------

    async def _query_devices_by_name(
        self, name_filter: str, use_contains: bool = False
    ) -> List[DeviceInfo]:
        if not name_filter or name_filter.strip() == "":
            logger.warning("Empty name_filter provided, returning empty result")
            return []
        all_devices = await self._get_all_devices_cached()
        result = filters.by_name(all_devices, name_filter, use_contains)
        logger.info(
            "Cache filter name='%s' (contains=%s): %s devices",
            name_filter,
            use_contains,
            len(result),
        )
        return result

    async def _query_devices_by_role(
        self, role_filter: str, use_negation: bool = False
    ) -> List[DeviceInfo]:
        if not role_filter or role_filter.strip() == "":
            logger.warning("Empty role_filter provided, returning empty result")
            return []
        all_devices = await self._get_all_devices_cached()
        result = filters.by_role(all_devices, role_filter, use_negation)
        logger.info(
            "Cache filter role='%s' (negation=%s): %s devices",
            role_filter,
            use_negation,
            len(result),
        )
        return result

    async def _query_devices_by_status(self, status_filter: str) -> List[DeviceInfo]:
        if not status_filter or status_filter.strip() == "":
            logger.warning("Empty status_filter provided, returning empty result")
            return []
        all_devices = await self._get_all_devices_cached()
        result = filters.by_status(all_devices, status_filter)
        logger.info("Cache filter status='%s': %s devices", status_filter, len(result))
        return result

    async def _query_devices_by_tag(self, tag_filter: str) -> List[DeviceInfo]:
        if not tag_filter or tag_filter.strip() == "":
            logger.warning("Empty tag_filter provided, returning empty result")
            return []
        all_devices = await self._get_all_devices_cached()
        result = filters.by_tag(all_devices, tag_filter)
        logger.info("Cache filter tag='%s': %s devices", tag_filter, len(result))
        return result

    async def _query_devices_by_devicetype(
        self, devicetype_filter: str, use_negation: bool = False
    ) -> List[DeviceInfo]:
        if not devicetype_filter or devicetype_filter.strip() == "":
            logger.warning("Empty devicetype_filter provided, returning empty result")
            return []
        all_devices = await self._get_all_devices_cached()
        result = filters.by_device_type(all_devices, devicetype_filter, use_negation)
        logger.info(
            "Cache filter device_type='%s' (negation=%s): %s devices",
            devicetype_filter,
            use_negation,
            len(result),
        )
        return result

    async def _query_devices_by_manufacturer(
        self, manufacturer_filter: str, use_negation: bool = False
    ) -> List[DeviceInfo]:
        if not manufacturer_filter or manufacturer_filter.strip() == "":
            logger.warning("Empty manufacturer_filter provided, returning empty result")
            return []
        all_devices = await self._get_all_devices_cached()
        result = filters.by_manufacturer(all_devices, manufacturer_filter, use_negation)
        logger.info(
            "Cache filter manufacturer='%s' (negation=%s): %s devices",
            manufacturer_filter,
            use_negation,
            len(result),
        )
        return result

    async def _query_devices_by_platform(
        self, platform_filter: str
    ) -> List[DeviceInfo]:
        if not platform_filter or platform_filter.strip() == "":
            logger.warning("Empty platform_filter provided, returning empty result")
            return []
        all_devices = await self._get_all_devices_cached()
        result = filters.by_platform(all_devices, platform_filter)
        logger.info(
            "Cache filter platform='%s': %s devices", platform_filter, len(result)
        )
        return result

    async def _query_devices_by_has_primary(
        self, has_primary_filter: str
    ) -> List[DeviceInfo]:
        all_devices = await self._get_all_devices_cached()
        result = filters.by_has_primary_ip(all_devices, has_primary_filter)
        logger.info(
            "Cache filter has_primary=%s: %s devices",
            has_primary_filter.lower() == "true",
            len(result),
        )
        return result

    # ------------------------------------------------------------------
    # Live Nautobot queries (location hierarchy / CIDR / custom fields)
    # ------------------------------------------------------------------

    async def _query_devices_by_location(
        self,
        location_filter: str,
        use_contains: bool = False,
        use_negation: bool = False,
    ) -> List[DeviceInfo]:
        """Query devices by location using GraphQL.

        Intentionally kept as a live Nautobot call: Nautobot resolves the full
        child-location hierarchy server-side.  Replicating that logic in Python
        would require fetching and traversing the entire location tree, which is
        more expensive than a single filtered GraphQL query.
        """
        import service_factory

        nautobot_service = service_factory.build_nautobot_service()

        if not location_filter or location_filter.strip() == "":
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

    async def _query_devices_by_ip_prefix(
        self, prefix_filter: str, operator: str = "within_include"
    ) -> List[DeviceInfo]:
        """Query devices by IP prefix using GraphQL.

        Intentionally kept as a live Nautobot call: CIDR containment filtering
        (within_include / within / exact) requires server-side evaluation.
        """
        import service_factory

        nautobot_service = service_factory.build_nautobot_service()

        if not prefix_filter or prefix_filter.strip() == "":
            logger.warning("Empty prefix_filter provided, returning empty result")
            return []

        parts = prefix_filter.strip().split(None, 1)
        cidr = parts[0]
        namespace = parts[1].strip() if len(parts) > 1 else None

        namespace_arg = f', namespace: "{namespace}"' if namespace else ""

        if operator == "within":
            prefix_arg = f'within: "{cidr}"{namespace_arg}'
        elif operator == "exact":
            prefix_arg = f'prefix: "{cidr}"{namespace_arg}'
        else:
            prefix_arg = f'within_include: "{cidr}"{namespace_arg}'

        logger.info(
            "ip_prefix query: cidr='%s', namespace=%s, operator=%s",
            cidr,
            namespace,
            operator,
        )

        query = f"""
        query devices_by_ip_prefix {{
            prefixes({prefix_arg}) {{
                ip_addresses {{
                    interface_assignments {{
                        interface {{
                            device {{
                                id
                                name
                                serial
                                primary_ip4 {{ address }}
                                status {{ name }}
                                device_type {{ model manufacturer {{ name }} }}
                                role {{ name }}
                                location {{ name }}
                                tags {{ name }}
                                platform {{ name }}
                            }}
                        }}
                    }}
                }}
            }}
        }}
        """

        result = await nautobot_service.graphql_query(query, {})

        if "errors" in result:
            logger.error("GraphQL errors in ip_prefix query: %s", result["errors"])
            return []

        prefixes_data = result.get("data", {}).get("prefixes", [])
        seen_ids: Dict[str, DeviceInfo] = {}

        for prefix in prefixes_data:
            for ip_addr in prefix.get("ip_addresses", []):
                for assignment in ip_addr.get("interface_assignments", []):
                    interface = assignment.get("interface") or {}
                    device_data = interface.get("device") or {}
                    device_id = device_data.get("id")
                    if device_id and device_id not in seen_ids:
                        parsed = self._parse_device_data([device_data])
                        if parsed:
                            seen_ids[device_id] = parsed[0]

        devices = list(seen_ids.values())
        logger.info(
            "ip_prefix query '%s' namespace=%s (operator=%s) returned %s unique devices",
            cidr,
            namespace,
            operator,
            len(devices),
        )
        return devices

    async def _query_devices_by_custom_field(
        self,
        custom_field_name: str,
        custom_field_value: str,
        use_contains: bool = False,
    ) -> List[DeviceInfo]:
        """Query devices by custom field value.

        Intentionally kept as a live Nautobot call: custom fields are dynamic
        and not stored in the bulk device cache.
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

            custom_field_types = await self._cache.get_custom_field_types()

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

    # ------------------------------------------------------------------
    # Shared parser (GraphQL nested dicts → DeviceInfo)
    # ------------------------------------------------------------------

    def _parse_device_data(
        self, devices_data: List[Dict[str, Any]]
    ) -> List[DeviceInfo]:
        """Parse GraphQL device data (nested dicts) into DeviceInfo objects."""
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

            device = DeviceInfo(
                id=device_data.get("id", ""),
                name=device_data.get("name"),
                serial=device_data.get("serial"),
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
