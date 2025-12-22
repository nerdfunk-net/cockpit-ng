"""
Ansible Inventory service for handling device queries and inventory generation.
"""

from __future__ import annotations
import logging
from typing import List, Dict, Any, Set
from models.ansible_inventory import LogicalOperation, LogicalCondition, DeviceInfo

logger = logging.getLogger(__name__)


class AnsibleInventoryService:
    """Service for handling Ansible inventory operations."""

    def __init__(self):
        """Initialize the service."""
        # Map field names to GraphQL query functions
        self.field_to_query_map = {
            "name": self._query_devices_by_name,
            "location": self._query_devices_by_location,
            "role": self._query_devices_by_role,
            "status": self._query_devices_by_status,
            "tag": self._query_devices_by_tag,
            "device_type": self._query_devices_by_devicetype,
            "manufacturer": self._query_devices_by_manufacturer,
            "platform": self._query_devices_by_platform,
        }
        # Cache for custom fields to avoid repeated API calls
        self._custom_fields_cache = None
        # Cache for custom field types (key -> type mapping)
        self._custom_field_types_cache = None

    async def _get_custom_field_types(self) -> Dict[str, str]:
        """
        Fetch custom field types from Nautobot API and cache them.

        Returns:
            Dictionary mapping custom field keys to their types (e.g., {"checkmk_site": "select", "freifeld": "text"})
        """
        if self._custom_field_types_cache is not None:
            return self._custom_field_types_cache

        try:
            # Import here to avoid circular imports
            from services.nautobot import nautobot_service

            logger.info("Fetching custom field types from Nautobot")

            # Fetch custom fields for devices
            custom_fields = await nautobot_service.get_custom_fields_for_devices()

            # Build a mapping of custom field key -> type
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
                        f"Custom field '{field_key}' has type '{field_type_value}'"
                    )

            logger.info(
                f"Loaded {len(type_mapping)} custom field types: {type_mapping}"
            )

            # Cache the result
            self._custom_field_types_cache = type_mapping
            return type_mapping

        except Exception as e:
            logger.error(f"Error fetching custom field types: {e}", exc_info=True)
            # Return empty dict on error, don't cache failures
            return {}

    async def preview_inventory(
        self, operations: List[LogicalOperation]
    ) -> tuple[List[DeviceInfo], int]:
        """
        Preview inventory by executing logical operations and returning matching devices.

        Args:
            operations: List of logical operations to execute

        Returns:
            Tuple of (devices, operations_count)
        """
        try:
            logger.info(f"Preview inventory called with {len(operations)} operations")

            # Start with empty result set
            result_devices: Set[str] = set()  # Use device IDs for set operations
            all_devices_data: Dict[str, DeviceInfo] = {}
            operations_count = 0

            # Process each top-level operation
            for i, operation in enumerate(operations):
                logger.info(
                    f"Processing operation {i}: type={operation.operation_type}, "
                    f"conditions={len(operation.conditions)}, nested={len(operation.nested_operations)}"
                )

                (
                    operation_result,
                    op_count,
                    devices_data,
                ) = await self._execute_operation(operation)
                operations_count += op_count
                all_devices_data.update(devices_data)

                logger.info(
                    f"Operation {i} result: {len(operation_result)} devices, {op_count} queries"
                )

                # Apply the operation result to our main result set
                if not result_devices:  # First operation
                    if operation.operation_type.upper() == "NOT":
                        # NOT operation as first operation means start with empty set
                        # (we can't subtract from nothing)
                        result_devices = set()
                        logger.info("First operation is NOT, starting with empty set")
                    else:
                        result_devices = operation_result
                        logger.info(
                            f"First operation set result devices to {len(result_devices)} devices"
                        )
                else:
                    # Handle different operation types
                    if operation.operation_type.upper() == "NOT":
                        # Subtract the NOT operation result from current result
                        old_count = len(result_devices)
                        result_devices = result_devices.difference(operation_result)
                        logger.info(
                            f"Applied NOT: {old_count} - {len(operation_result)} = {len(result_devices)} devices"
                        )
                    else:
                        # For AND/OR operations, combine with intersection (AND behavior)
                        old_count = len(result_devices)
                        result_devices = result_devices.intersection(operation_result)
                        logger.info(
                            f"Combined with AND: {old_count} ∩ {len(operation_result)} = {len(result_devices)} devices"
                        )

            # Convert result to list of DeviceInfo objects
            result_list = [
                all_devices_data[device_id]
                for device_id in result_devices
                if device_id in all_devices_data
            ]

            logger.info(
                f"Preview completed: {len(result_list)} devices found, {operations_count} operations executed"
            )

            return result_list, operations_count

        except Exception as e:
            logger.error(f"Error previewing inventory: {e}")
            raise

    async def _execute_operation(
        self, operation: LogicalOperation
    ) -> tuple[Set[str], int, Dict[str, DeviceInfo]]:
        """
        Execute a single logical operation.

        Args:
            operation: The logical operation to execute

        Returns:
            Tuple of (device_ids_set, operations_count, devices_data)
        """
        logger.info(
            f"Executing operation: type={operation.operation_type}, "
            f"conditions={len(operation.conditions)}, nested={len(operation.nested_operations)}"
        )

        operations_count = 0
        all_devices_data: Dict[str, DeviceInfo] = {}

        # Execute all conditions in this operation
        condition_results: List[Set[str]] = []

        for i, condition in enumerate(operation.conditions):
            logger.info(
                f"  Executing condition {i}: {condition.field} {condition.operator} '{condition.value}'"
            )
            devices, op_count, devices_data = await self._execute_condition(condition)
            condition_results.append(devices)
            operations_count += op_count
            all_devices_data.update(devices_data)
            logger.info(f"  Condition {i} result: {len(devices)} devices")

        # Execute nested operations
        for i, nested_op in enumerate(operation.nested_operations):
            logger.info(f"  Executing nested operation {i}")
            nested_result, nested_count, nested_data = await self._execute_operation(
                nested_op
            )
            condition_results.append(nested_result)
            operations_count += nested_count
            all_devices_data.update(nested_data)
            logger.info(f"  Nested operation {i} result: {len(nested_result)} devices")

        # Combine results based on operation type
        if operation.operation_type.upper() == "AND":
            result = self._intersect_sets(condition_results)
            logger.info(f"  AND operation result: {len(result)} devices")
        elif operation.operation_type.upper() == "OR":
            result = self._union_sets(condition_results)
            logger.info(f"  OR operation result: {len(result)} devices")
        elif operation.operation_type.upper() == "NOT":
            # For NOT operations, return the devices that match the conditions
            # The actual NOT logic will be applied in the main preview_inventory method
            if condition_results:
                result = self._union_sets(
                    condition_results
                )  # Get all devices that match the NOT conditions
            else:
                result = set()
            logger.info(f"  NOT operation devices to exclude: {len(result)} devices")
        else:
            logger.warning(f"Unknown operation type: {operation.operation_type}")
            result = set()

        logger.info(
            f"Operation completed: {len(result)} devices, {operations_count} total queries"
        )
        return result, operations_count, all_devices_data

    async def _execute_condition(
        self, condition: LogicalCondition
    ) -> tuple[Set[str], int, Dict[str, DeviceInfo]]:
        """
        Execute a single condition by calling the appropriate GraphQL query.

        Args:
            condition: The condition to execute

        Returns:
            Tuple of (device_ids_set, operations_count, devices_data)
        """
        try:
            # Validate condition values - prevent None/empty values from causing issues
            if not condition.field or condition.value is None or condition.value == "":
                logger.warning(
                    f"Skipping condition with empty field or value: field={condition.field}, value={condition.value}"
                )
                return set(), 0, {}

            # Check if this is a custom field (starts with cf_)
            if condition.field.startswith("cf_"):
                # Keep the full field name with cf_ prefix for GraphQL query
                use_contains = condition.operator == "contains"
                devices_data = await self._query_devices_by_custom_field(
                    condition.field, condition.value, use_contains
                )
                device_ids = {device.id for device in devices_data}
                devices_dict = {device.id: device for device in devices_data}
                return device_ids, 1, devices_dict

            # Handle regular fields
            query_func = self.field_to_query_map.get(condition.field)
            if not query_func:
                logger.error(f"No query function found for field: {condition.field}")
                return set(), 0, {}

            # Determine if we should use contains matching
            use_contains = condition.operator == "contains"

            # Only name and location support contains matching
            if condition.field in ["name", "location"] and use_contains:
                devices_data = await query_func(condition.value, use_contains=True)
            elif condition.field in ["name", "location"]:
                devices_data = await query_func(condition.value, use_contains=False)
            else:
                # Other fields only support exact matching
                if use_contains:
                    logger.warning(
                        f"Field {condition.field} does not support 'contains' operator, using exact match"
                    )
                devices_data = await query_func(condition.value)

            device_ids = {device.id for device in devices_data}
            devices_dict = {device.id: device for device in devices_data}

            logger.info(
                f"Condition {condition.field} {condition.operator} '{condition.value}' returned {len(devices_data)} devices"
            )

            return device_ids, 1, devices_dict

        except Exception as e:
            logger.error(
                f"Error executing condition {condition.field}={condition.value}: {e}"
            )
            return set(), 0, {}

    def _intersect_sets(self, sets: List[Set[str]]) -> Set[str]:
        """Compute intersection of multiple sets (AND operation)."""
        if not sets:
            return set()
        result = sets[0]
        for s in sets[1:]:
            result = result.intersection(s)
        return result

    def _union_sets(self, sets: List[Set[str]]) -> Set[str]:
        """Compute union of multiple sets (OR operation)."""
        result = set()
        for s in sets:
            result = result.union(s)
        return result

    # GraphQL Query Methods
    async def _query_devices_by_name(
        self, name_filter: str, use_contains: bool = False
    ) -> List[DeviceInfo]:
        """Query devices by name using GraphQL."""
        from services.nautobot import nautobot_service

        # Validate filter value - check for None first before calling .strip()
        if not name_filter or (
            isinstance(name_filter, str) and name_filter.strip() == ""
        ):
            logger.warning("Empty name_filter provided, returning empty result")
            return []

        # Use different queries based on match type
        if use_contains:
            # Regular expression query for contains
            query = """
            query devices_by_name($name_filter: [String]) {
                devices(name__ire: $name_filter) {
                    id
                    name
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
            # Exact name query
            query = """
            query devices_by_name($name_filter: [String]) {
                devices(name: $name_filter) {
                    id
                    name
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

        logger.info(f"GraphQL result for name query: {result}")

        # Extract devices from GraphQL response structure
        devices_data = result.get("data", {}).get("devices", [])
        return self._parse_device_data(devices_data)

    async def _query_devices_by_location(
        self, location_filter: str, use_contains: bool = False
    ) -> List[DeviceInfo]:
        """Query devices by location using GraphQL.

        This method queries devices directly by location filter, which automatically
        includes devices from child locations in the hierarchy.

        For example, querying location="Europe" will return devices from all child
        locations like "Germany", "Berlin", etc.
        """
        from services.nautobot import nautobot_service

        # Validate filter value - check for None first before calling .strip()
        if not location_filter or (
            isinstance(location_filter, str) and location_filter.strip() == ""
        ):
            logger.warning("Empty location_filter provided, returning empty result")
            return []

        # Query devices directly by location - this includes hierarchical locations
        # The location filter in Nautobot automatically includes devices from descendant locations
        if use_contains:
            # Use case-insensitive contains for location name
            query = """
            query devices_by_location ($location_filter: [String]) {
                devices (location__name__ic: $location_filter) {
                    id
                    name
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
            # Exact location name match - includes devices from this location and all descendants
            query = """
            query devices_by_location ($location_filter: [String]) {
                devices (location: $location_filter) {
                    id
                    name
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
            f"GraphQL result for location query '{location_filter}': Found {len(result.get('data', {}).get('devices', []))} devices"
        )

        # Extract devices directly from the devices query
        devices_data = result.get("data", {}).get("devices", [])
        return self._parse_device_data(devices_data)

    async def _query_devices_by_role(self, role_filter: str) -> List[DeviceInfo]:
        """Query devices by role using GraphQL."""
        from services.nautobot import nautobot_service

        # Validate filter value - check for None first before calling .strip()
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
        from services.nautobot import nautobot_service

        # Validate filter value - check for None first before calling .strip()
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
        from services.nautobot import nautobot_service

        # Validate filter value - check for None first before calling .strip()
        if not tag_filter or (isinstance(tag_filter, str) and tag_filter.strip() == ""):
            logger.warning("Empty tag_filter provided, returning empty result")
            return []

        query = """
        query devices_by_tag($tag_filter: [String]) {
            devices(tags: $tag_filter) {
                id
                name
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
        from services.nautobot import nautobot_service

        # Validate filter value - check for None first before calling .strip()
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
        from services.nautobot import nautobot_service

        # Validate filter value - check for None first before calling .strip()
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
        from services.nautobot import nautobot_service

        # Validate filter value - check for None first before calling .strip()
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

    def _parse_device_data(
        self, devices_data: List[Dict[str, Any]]
    ) -> List[DeviceInfo]:
        """Parse GraphQL device data into DeviceInfo objects."""
        devices = []

        for device_data in devices_data:
            # Extract nested data safely
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

            # Extract tags
            tags = []
            if device_data.get("tags"):
                tags = [
                    tag.get("name", "")
                    for tag in device_data["tags"]
                    if tag.get("name")
                ]

            # Get device name, handling None/null case
            device_name = device_data.get("name")

            device = DeviceInfo(
                id=device_data.get("id", ""),
                name=device_name,  # Can be None for unnamed devices
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
            # Import here to avoid circular imports
            from services.nautobot import nautobot_service

            # Validate filter value - check for None first before calling .strip()
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

            # Get custom field types to determine correct GraphQL variable type
            custom_field_types = await self._get_custom_field_types()

            # Extract the custom field key (remove cf_ prefix if present)
            cf_key = custom_field_name.replace("cf_", "")
            cf_type = custom_field_types.get(cf_key)

            # Determine the GraphQL variable type:
            # - If type is "select": always use [String]
            # - If type is NOT "select" (e.g., "text"):
            #   - WITH lookup (__ic): use [String]
            #   - WITHOUT lookup: use String
            if cf_type == "select":
                graphql_var_type = "[String]"
            elif use_contains:
                graphql_var_type = "[String]"
            else:
                graphql_var_type = "String"

            logger.info(
                f"Custom field '{cf_key}' type='{cf_type}', use_contains={use_contains}, GraphQL type='{graphql_var_type}'"
            )

            # Use the custom field name directly (it should already have cf_ prefix)
            filter_field = custom_field_name

            if use_contains:
                # Use ic for partial matching (case-insensitive contains)
                query = f"""
                query devices_by_custom_field($field_value: {graphql_var_type}) {{
                  devices({filter_field}__ic: $field_value) {{
                    id
                    name
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
                # For exact match - use determined GraphQL type
                query = f"""
                query devices_by_custom_field($field_value: {graphql_var_type}) {{
                  devices({filter_field}: $field_value) {{
                    id
                    name
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

            # Wrap value in array if GraphQL type is [String]; otherwise pass as string
            if graphql_var_type == "[String]":
                variables = {"field_value": [custom_field_value]}
            else:
                variables = {"field_value": custom_field_value}

            logger.debug(f"Custom field '{cf_key}' GraphQL query:\n{query}")
            logger.debug(f"Custom field '{cf_key}' variables: {variables}")
            logger.info(
                f"Custom field '{cf_key}' filter: {filter_field}, type: {cf_type}, graphql_var_type: {graphql_var_type}"
            )

            result = await nautobot_service.graphql_query(query, variables)

            if "errors" in result:
                logger.error(
                    f"GraphQL errors in custom field query: {result['errors']}"
                )
                return []

            return self._parse_device_data(result.get("data", {}).get("devices", []))

        except Exception as e:
            logger.error(
                f"Error querying devices by custom field '{custom_field_name}': {e}"
            )
            return []

    async def generate_inventory(
        self,
        operations: List[LogicalOperation],
        template_name: str,
        template_category: str,
    ) -> tuple[str, int]:
        """
        Generate final Ansible inventory using Jinja2 template.

        Args:
            operations: List of logical operations to execute
            template_name: Name of the Jinja2 template
            template_category: Category of the template

        Returns:
            Tuple of (inventory_content, device_count)
        """
        try:
            # Get devices using preview functionality
            devices, _ = await self.preview_inventory(operations)

            # Convert devices to dict format for template rendering
            all_devices = []
            for device in devices:
                # Provide fallback for unnamed devices (consistent with other apps)
                device_name = device.name or "Unnamed Device"

                device_dict = {
                    "name": device_name,
                    "uuid": device.id,
                    "location": device.location,
                    "role": device.role,
                    "tags": device.tags,
                    "device_type": device.device_type,
                    "manufacturer": device.manufacturer,
                    "platform": device.platform,
                    "primary_ip4": device.primary_ip4,
                    "status": device.status,
                }
                all_devices.append(device_dict)

            # Render template
            from template_manager import template_manager

            template_data = {
                "all_devices": all_devices,
                "total_devices": len(all_devices),
            }

            inventory_content = template_manager.render_template(
                template_name=template_name,
                category=template_category,
                data=template_data,
            )

            return inventory_content, len(devices)

        except Exception as e:
            logger.error(f"Error generating inventory: {e}")
            raise

    async def get_custom_fields(self) -> List[Dict[str, Any]]:
        """
        Get available custom fields for devices.

        Returns:
            List of custom field dictionaries with 'name', 'label', and 'type' keys
        """
        try:
            # Use cached result if available
            if self._custom_fields_cache is not None:
                return self._custom_fields_cache

            # Import here to avoid circular imports
            from services.nautobot import nautobot_service

            # Get custom fields for dcim.device
            response = await nautobot_service.rest_request(
                "extras/custom-fields/?content_types=dcim.device"
            )
            if not response or "results" not in response:
                logger.error("Invalid REST response for custom fields")
                return []

            # Transform the results to ensure consistent format for frontend
            # Nautobot may return label as an object with display info
            transformed_fields = []
            for field in response["results"]:
                # Get the field key/name - Nautobot uses 'key' in v2+
                field_name = field.get("key") or field.get("name", "")

                # Get label - ensure it's a string, not an object
                label = field.get("label", field_name)
                if isinstance(label, dict):
                    # If label is a dict, try to get display value
                    label = label.get("display") or label.get("value") or str(label)

                # Get type - ensure it's a string
                field_type = field.get("type", "text")
                if isinstance(field_type, dict):
                    field_type = (
                        field_type.get("value")
                        or field_type.get("label")
                        or str(field_type)
                    )

                transformed_fields.append(
                    {
                        "name": str(field_name),
                        "label": str(label) if label else str(field_name),
                        "type": str(field_type),
                    }
                )

            # Cache the transformed results
            self._custom_fields_cache = transformed_fields
            logger.info(
                f"Retrieved {len(self._custom_fields_cache)} custom fields for devices"
            )

            return self._custom_fields_cache

        except Exception as e:
            logger.error(f"Error getting custom fields: {e}")
            return []

    async def get_field_values(self, field_name: str) -> List[Dict[str, str]]:
        """
        Get available values for a specific field for dropdown population.

        Args:
            field_name: Name of the field to get values for (may include 'cf_' prefix for custom fields)

        Returns:
            List of dictionaries with 'value' and 'label' keys
        """
        try:
            # Import here to avoid circular imports
            from services.nautobot import nautobot_service

            # Return empty list for fields that should remain as text input
            if field_name == "name":
                return []

            # Check if this is a custom field request (starts with cf_)
            if field_name.startswith("cf_"):
                # Get the custom field name without the cf_ prefix
                cf_key = field_name[3:]  # Remove 'cf_' prefix

                # Get custom fields to check the type
                custom_fields = await self.get_custom_fields()
                cf_info = next(
                    (cf for cf in custom_fields if cf.get("name") == cf_key), None
                )

                if cf_info and cf_info.get("type") == "select":
                    # For select-type custom fields, fetch the available choices
                    logger.info(
                        f"Custom field '{cf_key}' is type 'select' - fetching choices"
                    )
                    try:
                        choices_response = await nautobot_service.rest_request(
                            f"extras/custom-field-choices/?custom_field={cf_key}"
                        )
                        if choices_response and "results" in choices_response:
                            values = []
                            for choice in choices_response["results"]:
                                choice_value = choice.get("value", "")
                                if choice_value:
                                    values.append(
                                        {
                                            "value": str(choice_value),
                                            "label": str(choice_value),
                                        }
                                    )
                            # Sort safely - handle None or empty labels
                            values.sort(key=lambda x: (x.get("label") or "").lower())
                            logger.info(
                                f"Retrieved {len(values)} choices for custom field '{cf_key}'"
                            )
                            return values
                    except Exception as e:
                        logger.error(
                            f"Error fetching choices for custom field '{cf_key}': {e}"
                        )
                        return []

                # For non-select custom fields (text, date, integer, etc.), return empty list for text input
                logger.info(
                    f"Custom field '{field_name}' is type '{cf_info.get('type') if cf_info else 'unknown'}' - using text input"
                )
                return []

            # Handle special case for custom fields list
            if field_name == "custom_fields":
                custom_fields = await self.get_custom_fields()
                values = []
                for cf in custom_fields:
                    # Create the cf_ prefixed value for backend queries
                    cf_name = cf.get("name", "")
                    if cf_name:
                        values.append(
                            {
                                "value": f"cf_{cf_name}",  # Backend expects cf_ prefix
                                "label": cf.get("label")
                                or cf_name,  # Use label if available, fallback to name
                            }
                        )

                # Sort values by label - handle None or empty labels safely
                values.sort(key=lambda x: (x.get("label") or "").lower())
                logger.info(f"Retrieved {len(values)} custom field options")
                return values

            # Map field names to REST API endpoints
            endpoint_map = {
                "location": "dcim/locations/?limit=0",
                "role": "extras/roles/?content_types=dcim.device&limit=0",
                "status": "extras/statuses/?content_types=dcim.device&limit=0",
                "device_type": "dcim/device-types/?limit=0&depth=1",  # depth=1 to include manufacturer
                "manufacturer": "dcim/manufacturers/?limit=0",
                "platform": "dcim/platforms/?limit=0",
                "tag": "extras/tags/?content_types=dcim.device&limit=0",
            }

            endpoint = endpoint_map.get(field_name)
            if not endpoint:
                logger.warning(f"No endpoint defined for field: {field_name}")
                return []

            # Make REST request to Nautobot
            response = await nautobot_service.rest_request(endpoint)
            if not response or "results" not in response:
                logger.error(f"Invalid REST response for field {field_name}")
                return []

            # Extract values based on field type
            values = []
            results = response["results"]

            if field_name == "location":
                for location in results:
                    values.append(
                        {"value": location["name"], "label": location["name"]}
                    )
            elif field_name == "role":
                for role in results:
                    values.append({"value": role["name"], "label": role["name"]})
            elif field_name == "status":
                for status_item in results:
                    values.append(
                        {"value": status_item["name"], "label": status_item["name"]}
                    )
            elif field_name == "device_type":
                for device_type in results:
                    # Create a descriptive label with manufacturer
                    manufacturer_data = device_type.get("manufacturer")
                    if manufacturer_data and isinstance(manufacturer_data, dict):
                        manufacturer_name = manufacturer_data.get("name", "Unknown")
                    else:
                        manufacturer_name = "Unknown"

                    model = device_type.get("model", device_type.get("name", "Unknown"))
                    label = f"{manufacturer_name} {model}"
                    values.append({"value": model, "label": label})
            elif field_name == "manufacturer":
                for manufacturer in results:
                    values.append(
                        {"value": manufacturer["name"], "label": manufacturer["name"]}
                    )
            elif field_name == "platform":
                for platform in results:
                    values.append(
                        {"value": platform["name"], "label": platform["name"]}
                    )
            elif field_name == "tag":
                for tag in results:
                    values.append({"value": tag["name"], "label": tag["name"]})

            # Sort values by label - handle None or empty labels safely
            values.sort(key=lambda x: (x.get("label") or "").lower())

            logger.info(f"Retrieved {len(values)} values for field '{field_name}'")
            return values

        except Exception as e:
            logger.error(f"Error getting field values for '{field_name}': {e}")
            return []

    async def save_inventory(
        self,
        name: str,
        description: str | None,
        conditions: List[Any],
        repository_id: int,
    ) -> Dict[str, Any]:
        """
        Save inventory configuration to a git repository.

        Args:
            name: Inventory name
            description: Inventory description
            conditions: List of logical conditions
            repository_id: Git repository ID

        Returns:
            Dictionary with success message
        """
        import json
        from datetime import datetime
        from pathlib import Path
        from git_repositories_manager import GitRepositoryManager
        from services.git_service import git_service
        from services.git_auth_service import git_auth_service

        try:
            logger.info(f"Saving inventory '{name}' to repository {repository_id}")

            # Get repository information
            git_manager = GitRepositoryManager()
            repository = git_manager.get_repository(repository_id)

            if not repository:
                raise ValueError(f"Repository with ID {repository_id} not found")

            # Check if repository has credentials configured for HTTPS URLs
            if (
                repository.get("url", "").startswith("https://")
                and repository.get("auth_type") != "ssh_key"
            ):
                username, token, _ = git_auth_service.resolve_credentials(repository)
                if not token:
                    raise ValueError(
                        f"Repository '{repository['name']}' requires credentials. "
                        "Please configure a credential for this repository in Settings → Credentials, "
                        "or use SSH URL (git@...) instead of HTTPS."
                    )

            # Open or clone repository using git_service
            logger.info(f"Opening/cloning Git repository: {repository['name']}")
            logger.info(f"  - Auth type: {repository.get('auth_type', 'token')}")
            repo = git_service.open_or_clone(repository)

            # Create inventories directory if it doesn't exist
            inventories_dir = Path(repo.working_dir) / "inventories"
            inventories_dir.mkdir(exist_ok=True)

            # Create inventory file
            inventory_file = inventories_dir / f"{name}.json"

            # Check if file exists to determine if this is an update
            is_update = inventory_file.exists()

            # Prepare inventory data
            inventory_data = {
                "name": name,
                "description": description,
                "conditions": [
                    {
                        "field": c.field,
                        "operator": c.operator,
                        "value": c.value,
                        "logic": c.logic,
                    }
                    for c in conditions
                ],
                "created_at": datetime.now().isoformat() if not is_update else None,
                "updated_at": datetime.now().isoformat(),
            }

            # If updating, preserve created_at
            if is_update:
                try:
                    existing_data = json.loads(inventory_file.read_text())
                    inventory_data["created_at"] = existing_data.get("created_at")
                except Exception as e:
                    logger.warning(f"Could not read existing inventory: {e}")

            # Write inventory to file
            logger.info(f"Writing inventory to {inventory_file}")
            inventory_file.write_text(json.dumps(inventory_data, indent=2))

            # Commit changes using git_service
            action = "Updated" if is_update else "Created"
            commit_message = f"{action} inventory: {name}"
            if description:
                commit_message += f"\n\n{description}"

            logger.info(f"Committing and pushing with message: {commit_message}")
            result = git_service.commit_and_push(
                repository=repository,
                message=commit_message,
                files=[str(inventory_file.relative_to(repo.working_dir))],
                repo=repo,
                branch=repository.get("branch", "main"),
            )

            if not result.success:
                raise ValueError(f"Failed to commit/push: {result.message}")

            logger.info(f"Successfully saved inventory '{name}' to repository")

            return {
                "success": True,
                "message": f"Inventory '{name}' successfully saved to {repository['name']}",
            }

        except Exception as e:
            logger.error(f"Error saving inventory: {e}")
            raise

    async def list_inventories(self, repository_id: int) -> List[Dict[str, Any]]:
        """
        List all saved inventories from a git repository.

        Args:
            repository_id: Git repository ID

        Returns:
            List of saved inventories
        """
        import json
        from pathlib import Path
        from git_repositories_manager import GitRepositoryManager
        from services.git_service import git_service
        from services.git_auth_service import git_auth_service
        from models.ansible_inventory import SavedInventory, SavedInventoryCondition

        try:
            logger.info(f"Listing inventories from repository {repository_id}")

            # Get repository information
            git_manager = GitRepositoryManager()
            repository = git_manager.get_repository(repository_id)

            if not repository:
                raise ValueError(f"Repository with ID {repository_id} not found")

            # Check if repository has credentials configured for HTTPS URLs
            if (
                repository.get("url", "").startswith("https://")
                and repository.get("auth_type") != "ssh_key"
            ):
                username, token, _ = git_auth_service.resolve_credentials(repository)
                if not token:
                    raise ValueError(
                        f"Repository '{repository['name']}' requires credentials. "
                        "Please configure a credential for this repository in Settings → Credentials."
                    )

            # Open or clone repository using git_service
            logger.info(f"Opening/cloning Git repository: {repository['name']}")
            repo = git_service.open_or_clone(repository)

            # Pull latest changes using git_service
            git_service.pull(repository, repo=repo)

            # Read inventories directory
            inventories_dir = Path(repo.working_dir) / "inventories"
            if not inventories_dir.exists():
                logger.info("No inventories directory found")
                return []

            inventories = []
            for inventory_file in inventories_dir.glob("*.json"):
                try:
                    data = json.loads(inventory_file.read_text())

                    # Convert to SavedInventory model
                    inventory = SavedInventory(
                        name=data["name"],
                        description=data.get("description"),
                        conditions=[
                            SavedInventoryCondition(**c) for c in data["conditions"]
                        ],
                        created_at=data.get("created_at"),
                        updated_at=data.get("updated_at"),
                    )
                    inventories.append(inventory)
                except Exception as e:
                    logger.warning(
                        f"Error reading inventory file {inventory_file}: {e}"
                    )
                    continue

            logger.info(f"Found {len(inventories)} inventories")
            return inventories

        except Exception as e:
            logger.error(f"Error listing inventories: {e}")
            raise

    async def load_inventory(
        self, name: str, repository_id: int
    ) -> Dict[str, Any] | None:
        """
        Load a saved inventory configuration from a git repository.

        Args:
            name: Inventory name
            repository_id: Git repository ID

        Returns:
            Inventory data or None if not found
        """
        import json
        from pathlib import Path
        from git_repositories_manager import GitRepositoryManager
        from services.git_service import git_service
        from services.git_auth_service import git_auth_service
        from models.ansible_inventory import SavedInventory, SavedInventoryCondition

        try:
            logger.info(f"Loading inventory '{name}' from repository {repository_id}")

            # Get repository information
            git_manager = GitRepositoryManager()
            repository = git_manager.get_repository(repository_id)

            if not repository:
                raise ValueError(f"Repository with ID {repository_id} not found")

            # Check if repository has credentials configured for HTTPS URLs
            if (
                repository.get("url", "").startswith("https://")
                and repository.get("auth_type") != "ssh_key"
            ):
                username, token, _ = git_auth_service.resolve_credentials(repository)
                if not token:
                    raise ValueError(
                        f"Repository '{repository['name']}' requires credentials. "
                        "Please configure a credential for this repository in Settings → Credentials."
                    )

            # Open or clone repository using git_service
            logger.info(f"Opening/cloning Git repository: {repository['name']}")
            repo = git_service.open_or_clone(repository)

            # Pull latest changes using git_service
            git_service.pull(repository, repo=repo)

            # Read inventory file
            inventory_file = Path(repo.working_dir) / "inventories" / f"{name}.json"
            if not inventory_file.exists():
                logger.warning(f"Inventory file not found: {inventory_file}")
                return None

            data = json.loads(inventory_file.read_text())

            # Convert to SavedInventory model
            inventory = SavedInventory(
                name=data["name"],
                description=data.get("description"),
                conditions=[SavedInventoryCondition(**c) for c in data["conditions"]],
                created_at=data.get("created_at"),
                updated_at=data.get("updated_at"),
            )

            logger.info(f"Successfully loaded inventory '{name}'")
            return inventory

        except Exception as e:
            logger.error(f"Error loading inventory: {e}")
            raise


# Global service instance
ansible_inventory_service = AnsibleInventoryService()
