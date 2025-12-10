"""
Device query service for Nautobot.

Handles device listing with filtering, pagination, and caching.
"""

import logging
from typing import Optional
from services import nautobot_service
from services.cache_service import cache_service
from services.nautobot_helpers.cache_helpers import (
    DEVICE_CACHE_TTL,
    get_device_list_cache_key,
    cache_device_list,
    get_cached_device_list,
)

logger = logging.getLogger(__name__)

# Common device fields for GraphQL queries
DEVICE_FIELDS = """
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
    }
    cf_last_backup
"""


class DeviceQueryService:
    """Service for querying devices from Nautobot."""

    async def get_devices(
        self,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
        filter_type: Optional[str] = None,
        filter_value: Optional[str] = None,
        reload: bool = False,
    ) -> dict:
        """
        Get list of devices from Nautobot with optional filtering and pagination.

        Args:
            limit: Number of devices per page
            offset: Number of devices to skip
            filter_type: Type of filter ('name', 'location', 'prefix', 'ip_addresses')
            filter_value: Value to filter by
            reload: If True, bypass cache

        Returns:
            dict with devices list and pagination info
        """
        # Check cache first
        cache_key = get_device_list_cache_key(filter_type, filter_value, limit, offset)

        if not reload:
            cached_result = get_cached_device_list(cache_key)
            if cached_result is not None:
                logger.debug(f"Cache hit for devices list: {cache_key}")
                return cached_result
        else:
            logger.debug(f"Reload requested, bypassing cache for: {cache_key}")

        # Route to appropriate query method based on filter type
        if filter_type and filter_value:
            if filter_type == "name":
                return await self._query_by_name(
                    filter_value, limit, offset, cache_key, use_contains=False
                )
            elif filter_type == "name__ic":
                return await self._query_by_name(
                    filter_value, limit, offset, cache_key, use_contains=True
                )
            elif filter_type == "location":
                return await self._query_by_location(
                    filter_value, limit, offset, cache_key
                )
            elif filter_type == "prefix":
                return await self._query_by_prefix(
                    filter_value, limit, offset, cache_key
                )
            elif filter_type == "ip_addresses":
                return await self._query_by_ip_addresses(
                    filter_value, limit, offset, cache_key
                )

        # No filter - return all devices
        return await self._query_all_devices(limit, offset, cache_key)

    async def _query_by_name(
        self,
        name_filter: str,
        limit: Optional[int],
        offset: Optional[int],
        cache_key: str,
        use_contains: bool = False,
    ) -> dict:
        """Query devices filtered by name.

        Args:
            name_filter: The name filter value
            limit: Number of devices per page
            offset: Number of devices to skip
            cache_key: Cache key for storing results
            use_contains: If True, use name__ic (case-insensitive contains),
                         otherwise use name__ire (case-insensitive regex exact match)
        """
        # Determine which GraphQL filter to use
        filter_field = "name__ic" if use_contains else "name__ire"
        filter_type_label = "name__ic" if use_contains else "name"

        # Get total count first
        count_query = f"""
        query devices_count_by_name($name_filter: [String]) {{
          devices({filter_field}: $name_filter) {{
            id
          }}
        }}
        """
        count_result = await nautobot_service.graphql_query(
            count_query, {"name_filter": [name_filter]}
        )
        if "errors" in count_result:
            raise Exception(f"GraphQL errors in count query: {count_result['errors']}")
        total_count = len(count_result["data"]["devices"])

        # Get paginated data
        query = f"""
        query devices_by_name(
          $name_filter: [String],
          $limit: Int,
          $offset: Int
        ) {{
          devices({filter_field}: $name_filter, limit: $limit, offset: $offset) {{
            {DEVICE_FIELDS}
          }}
        }}
        """
        variables = {"name_filter": [name_filter]}
        if limit is not None:
            variables["limit"] = limit
        if offset is not None:
            variables["offset"] = offset

        result = await nautobot_service.graphql_query(query, variables)
        if "errors" in result:
            raise Exception(f"GraphQL errors: {result['errors']}")

        devices = result["data"]["devices"]
        return self._build_response(
            devices,
            total_count,
            limit,
            offset,
            cache_key,
            filter_type=filter_type_label,
            filter_value=name_filter,
        )

    async def _query_by_location(
        self,
        location_filter: str,
        limit: Optional[int],
        offset: Optional[int],
        cache_key: str,
    ) -> dict:
        """Query devices filtered by location."""
        query = f"""
        query devices_by_location(
          $location_filter: [String],
          $limit: Int,
          $offset: Int
        ) {{
          locations(name__ire: $location_filter) {{
            name
            devices(limit: $limit, offset: $offset) {{
              {DEVICE_FIELDS}
            }}
          }}
        }}
        """
        variables = {"location_filter": [location_filter]}
        if limit is not None:
            variables["limit"] = limit
        if offset is not None:
            variables["offset"] = offset

        result = await nautobot_service.graphql_query(query, variables)
        if "errors" in result:
            raise Exception(f"GraphQL errors: {result['errors']}")

        # Extract devices from locations
        devices = []
        for location in result["data"]["locations"]:
            for device in location["devices"]:
                device["location"] = {"name": location["name"]}
                devices.append(device)

        return self._build_response(
            devices,
            len(devices),
            limit,
            offset,
            cache_key,
            filter_type="location",
            filter_value=location_filter,
        )

    async def _query_by_prefix(
        self,
        prefix_filter: str,
        limit: Optional[int],
        offset: Optional[int],
        cache_key: str,
    ) -> dict:
        """Query devices filtered by IP prefix."""
        query = f"""
        query devices_by_ip_prefix(
          $prefix_filter: [String],
          $limit: Int,
          $offset: Int
        ) {{
          prefixes(within_include: $prefix_filter) {{
            prefix
            ip_addresses(limit: $limit, offset: $offset) {{
              primary_ip4_for {{
                {DEVICE_FIELDS}
              }}
            }}
          }}
        }}
        """
        variables = {"prefix_filter": [prefix_filter]}
        if limit is not None:
            variables["limit"] = limit
        if offset is not None:
            variables["offset"] = offset

        result = await nautobot_service.graphql_query(query, variables)
        if "errors" in result:
            raise Exception(f"GraphQL errors: {result['errors']}")

        # Extract unique devices from prefixes
        devices_dict = {}
        for prefix in result["data"]["prefixes"]:
            for ip_addr in prefix["ip_addresses"]:
                if ip_addr["primary_ip4_for"]:
                    device = ip_addr["primary_ip4_for"]
                    devices_dict[device["id"]] = device

        devices = list(devices_dict.values())
        return self._build_response(
            devices,
            len(devices),
            limit,
            offset,
            cache_key,
            filter_type="prefix",
            filter_value=prefix_filter,
        )

    async def _query_by_ip_addresses(
        self,
        ip_filter: str,
        limit: Optional[int],
        offset: Optional[int],
        cache_key: str,
    ) -> dict:
        """Query devices filtered by IP address in CIDR notation."""
        query = f"""
        query devices_by_ip_address(
          $ip_filter: [String],
          $limit: Int,
          $offset: Int
        ) {{
          ip_addresses(address__net_in: $ip_filter, limit: $limit, offset: $offset) {{
            address
            primary_ip4_for {{
              {DEVICE_FIELDS}
            }}
          }}
        }}
        """
        variables = {"ip_filter": [ip_filter]}
        if limit is not None:
            variables["limit"] = limit
        if offset is not None:
            variables["offset"] = offset

        result = await nautobot_service.graphql_query(query, variables)
        if "errors" in result:
            raise Exception(f"GraphQL errors: {result['errors']}")

        # Extract unique devices from IP addresses
        devices_dict = {}
        for ip_addr in result["data"]["ip_addresses"]:
            if ip_addr["primary_ip4_for"]:
                device = ip_addr["primary_ip4_for"]
                devices_dict[device["id"]] = device

        devices = list(devices_dict.values())
        return self._build_response(
            devices,
            len(devices),
            limit,
            offset,
            cache_key,
            filter_type="ip_addresses",
            filter_value=ip_filter,
        )

    async def _query_all_devices(
        self,
        limit: Optional[int],
        offset: Optional[int],
        cache_key: str,
    ) -> dict:
        """Query all devices without filtering."""
        query = f"""
        query all_devices($limit: Int, $offset: Int) {{
          devices(limit: $limit, offset: $offset) {{
            {DEVICE_FIELDS}
          }}
        }}
        """
        variables = {}
        if limit is not None:
            variables["limit"] = limit
        if offset is not None:
            variables["offset"] = offset

        result = await nautobot_service.graphql_query(query, variables)
        if "errors" in result:
            raise Exception(f"GraphQL errors: {result['errors']}")

        devices = result["data"]["devices"]

        # Get total count if paginated
        total_count = len(devices)
        if limit is not None:
            count_query = """
            query all_devices_count {
              devices {
                id
              }
            }
            """
            count_result = await nautobot_service.graphql_query(count_query, {})
            if "errors" in count_result:
                raise Exception(
                    f"GraphQL errors in count query: {count_result['errors']}"
                )
            total_count = len(count_result["data"]["devices"])

        return self._build_response(devices, total_count, limit, offset, cache_key)

    def _build_response(
        self,
        devices: list,
        total_count: int,
        limit: Optional[int],
        offset: Optional[int],
        cache_key: str,
        filter_type: Optional[str] = None,
        filter_value: Optional[str] = None,
    ) -> dict:
        """Build standardized response with pagination info and cache the result."""
        current_offset = offset or 0
        has_more = current_offset + len(devices) < total_count if limit else False

        # Build pagination URLs
        base_url = "/api/nautobot/devices"
        filter_params = ""
        if filter_type and filter_value:
            filter_params = f"&filter_type={filter_type}&filter_value={filter_value}"

        next_url = None
        prev_url = None

        if limit:
            if has_more:
                next_url = f"{base_url}?limit={limit}&offset={current_offset + limit}{filter_params}"
            if current_offset > 0:
                prev_url = f"{base_url}?limit={limit}&offset={max(0, current_offset - limit)}{filter_params}"

        response_data = {
            "devices": devices,
            "count": total_count,
            "has_more": has_more,
            "is_paginated": limit is not None,
            "current_offset": current_offset,
            "current_limit": limit,
            "next": next_url,
            "previous": prev_url,
        }

        # Cache the result
        logger.debug(f"Caching devices list: {cache_key}")
        cache_service.set(cache_key, response_data, DEVICE_CACHE_TTL)
        cache_device_list(cache_key, response_data["devices"])

        return response_data


# Singleton instance
device_query_service = DeviceQueryService()
