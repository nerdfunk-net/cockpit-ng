"""
Nautobot metadata and lookup endpoints.
"""

from __future__ import annotations
import logging
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from models.nautobot import OffboardDeviceRequest
from services.nautobot import nautobot_service, offboarding_service
from services.settings.cache import cache_service

logger = logging.getLogger(__name__)
router = APIRouter(
    tags=["nautobot-metadata"]
)  # No prefix - endpoints at /api/nautobot root

# Cache configuration
DEVICE_CACHE_TTL = 30 * 60  # 30 minutes in seconds


@router.get("/locations", summary="🔷 GraphQL: List Locations")
async def get_locations(
    current_user: dict = Depends(require_permission("nautobot.locations", "read")),
):
    """Get list of locations from Nautobot with parent and children relationships.

    **🔷 This endpoint uses GraphQL** to fetch hierarchical location data.
    """
    try:
        # Try in-memory cache first
        from services.settings.cache import cache_service
        from settings_manager import settings_manager

        cache_key = "nautobot:locations:list"
        cached = cache_service.get(cache_key)
        if cached is not None:
            return cached

        # Cache miss; fetch from Nautobot and populate cache
        query = """
                query locations {
                    locations {
                        id
                        name
                        description
                        parent {
                            id
                            name
                            description
                        }
                        children {
                            id
                            name
                            description
                        }
                    }
                }
                """
        result = await nautobot_service.graphql_query(query)

        if "errors" in result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"GraphQL errors: {result['errors']}",
            )

        locations = result["data"]["locations"]
        ttl = int(settings_manager.get_cache_settings().get("ttl_seconds", 600))
        cache_service.set(cache_key, locations, ttl)
        return locations
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch locations: {str(e)}",
        )


@router.get("/namespaces", summary="🔷 GraphQL: List Namespaces")
async def get_namespaces(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get list of namespaces from Nautobot.

    **🔷 This endpoint uses GraphQL** to fetch namespace data.
    """
    try:
        query = """
        query {
          namespaces {
            id
            name
            description
          }
        }
        """
        result = await nautobot_service.graphql_query(query)

        if "errors" in result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"GraphQL errors: {result['errors']}",
            )

        return result["data"]["namespaces"]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch namespaces: {str(e)}",
        )


@router.get("/stats", summary="🔶 REST: Get Nautobot Statistics")
async def get_nautobot_stats(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get Nautobot statistics with 10-minute caching.

    **🔶 This endpoint uses REST API** to fetch aggregated statistics.
    """
    from datetime import datetime, timezone

    # Cache configuration - 10 minutes
    cache_key = "nautobot:stats"
    cache_ttl = 600  # 10 minutes in seconds

    # Check Redis cache first
    cached_stats = cache_service.get(cache_key)
    if cached_stats is not None:
        logger.info("Returning cached Nautobot stats from Redis")
        return cached_stats

    logger.info("Cache expired or missing, fetching fresh Nautobot stats")

    try:
        # Get device counts by status
        devices_result = await nautobot_service.rest_request("dcim/devices/")
        locations_result = await nautobot_service.rest_request("dcim/locations/")
        device_types_result = await nautobot_service.rest_request("dcim/device-types/")

        # Try to get IP addresses and prefixes (might not exist in all Nautobot versions)
        try:
            ip_addresses_result = await nautobot_service.rest_request(
                "ipam/ip-addresses/"
            )
            ip_addresses_count = ip_addresses_result.get("count", 0)
        except Exception:
            ip_addresses_count = 0

        try:
            prefixes_result = await nautobot_service.rest_request("ipam/prefixes/")
            prefixes_count = prefixes_result.get("count", 0)
        except Exception:
            prefixes_count = 0

        from datetime import datetime, timezone

        stats = {
            # Frontend expects these exact field names
            "devices": devices_result.get("count", 0),
            "locations": locations_result.get("count", 0),
            "device_types": device_types_result.get("count", 0),
            "ip_addresses": ip_addresses_count,
            "prefixes": prefixes_count,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            # Keep backward compatibility
            "total_devices": devices_result.get("count", 0),
            "total_locations": locations_result.get("count", 0),
            "total_device_types": device_types_result.get("count", 0),
        }

        # Save to Redis cache
        cache_service.set(cache_key, stats, cache_ttl)
        logger.info("Nautobot stats cached successfully in Redis")

        return stats
    except Exception as e:
        logger.error(f"Error fetching Nautobot stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch statistics: {str(e)}",
        )


@router.get("/roles", summary="🔶 REST: List Roles")
async def get_nautobot_roles(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get Nautobot device roles.

    **🔶 This endpoint uses REST API** to fetch roles.
    """
    try:
        result = await nautobot_service.rest_request("extras/roles/")
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch roles: {str(e)}",
        )


@router.get("/roles/devices", summary="🔶 REST: List Device Roles")
async def get_nautobot_device_roles(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get Nautobot roles specifically for dcim.device content type."""
    try:
        result = await nautobot_service.rest_request(
            "extras/roles/?content_types=dcim.device&limit=0"
        )
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch device roles: {str(e)}",
        )


@router.get("/roles/ipaddress", summary="🔶 REST: List IP Address Roles")
async def get_nautobot_ipaddress_roles(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get Nautobot roles specifically for ipam.ipaddress content type."""
    try:
        result = await nautobot_service.rest_request(
            "extras/roles/?content_types=ipam.ipaddress&limit=0"
        )
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch IP address roles: {str(e)}",
        )


@router.get("/platforms", summary="🔶 REST: List Platforms")
async def get_nautobot_platforms(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get Nautobot platforms."""
    try:
        result = await nautobot_service.rest_request("dcim/platforms/?limit=0")
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch platforms: {str(e)}",
        )


@router.get("/statuses", summary="🔶 REST: List All Statuses")
async def get_nautobot_statuses(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get all Nautobot statuses."""
    try:
        result = await nautobot_service.rest_request("extras/statuses/")
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch statuses: {str(e)}",
        )


@router.get("/statuses/device", summary="🔶 REST: List Device Statuses")
async def get_nautobot_device_statuses(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get Nautobot device statuses."""
    try:
        result = await nautobot_service.rest_request(
            "extras/statuses/?content_types=dcim.device"
        )
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch device statuses: {str(e)}",
        )


@router.get("/statuses/interface", summary="🔶 REST: List Interface Statuses")
async def get_nautobot_interface_statuses(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get Nautobot interface statuses."""
    try:
        result = await nautobot_service.rest_request(
            "extras/statuses/?content_types=dcim.interface"
        )
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch interface statuses: {str(e)}",
        )


@router.get("/statuses/ipaddress", summary="🔶 REST: List IP Address Statuses")
async def get_nautobot_ipaddress_statuses(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get Nautobot IP address statuses."""
    try:
        result = await nautobot_service.rest_request(
            "extras/statuses/?content_types=ipam.ipaddress"
        )
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch IP address statuses: {str(e)}",
        )


@router.get("/statuses/prefix", summary="🔶 REST: List Prefix Statuses")
async def get_nautobot_prefix_statuses(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get Nautobot prefix statuses."""
    try:
        result = await nautobot_service.rest_request(
            "extras/statuses/?content_types=ipam.prefix"
        )
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch prefix statuses: {str(e)}",
        )


@router.get("/statuses/combined", summary="🔶 REST: List All Statuses (Combined)")
async def get_nautobot_combined_statuses(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get combined Nautobot statuses."""
    try:
        result = await nautobot_service.rest_request("extras/statuses/")
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch combined statuses: {str(e)}",
        )


@router.get("/secret-groups", summary="🔷 GraphQL: List Secret Groups")
async def get_nautobot_secret_groups(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get Nautobot secret groups.

    **🔷 This endpoint uses GraphQL** to fetch secret groups.
    """
    try:
        # Use GraphQL query as specified in nautobot_access.md
        query = """
        query secrets_groups {
          secrets_groups {
            id
            name
          }
        }
        """
        result = await nautobot_service.graphql_query(query)

        if "errors" in result:
            logger.warning(f"GraphQL errors fetching secret groups: {result['errors']}")
            return []

        return result["data"]["secrets_groups"]
    except Exception as e:
        # Return empty list if secret groups don't exist
        logger.warning(f"Secret groups endpoint not available: {str(e)}")
        return []


@router.get("/device-types", summary="🔶 REST: List Device Types")
async def get_nautobot_device_types(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get Nautobot device types."""
    try:
        result = await nautobot_service.rest_request("dcim/device-types/?limit=0")
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch device types: {str(e)}",
        )


@router.get("/manufacturers", summary="🔶 REST: List Manufacturers")
async def get_nautobot_manufacturers(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get Nautobot manufacturers."""
    try:
        result = await nautobot_service.rest_request("dcim/manufacturers/?limit=0")
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch manufacturers: {str(e)}",
        )


@router.get("/tags", summary="🔶 REST: List Tags")
async def get_nautobot_tags(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get Nautobot tags."""
    try:
        result = await nautobot_service.rest_request("extras/tags/?limit=0")
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch tags: {str(e)}",
        )


@router.get("/software-versions", summary="🔷 GraphQL: List Software Versions")
async def get_software_versions(
    platform: str = None,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get list of software versions from Nautobot.

    **🔷 This endpoint uses GraphQL** to fetch software versions.

    Args:
        platform: Optional platform name to filter software versions
    """
    try:
        # Try in-memory cache first
        from services.settings.cache import cache_service
        from settings_manager import settings_manager

        cache_key = f"nautobot:software_versions:list:{platform or 'all'}"
        cached = cache_service.get(cache_key)
        if cached is not None:
            return cached

        # Cache miss; fetch from Nautobot and populate cache
        query = """
        query (
            $get_id: Boolean = true,
            $get_tags: Boolean = true,
            $get_platform: Boolean = true,
            $platform_filter: [String]
        ) {
            software_versions(platform: $platform_filter) {
                id @include(if: $get_id)
                version
                alias
                release_date
                end_of_support_date
                documentation_url
                long_term_support
                pre_release
                tags @include(if: $get_tags) {
                    id @include(if: $get_id)
                    name
                }
                platform @include(if: $get_platform) {
                    id @include(if: $get_id)
                    name
                }
            }
        }
        """
        variables = {
            "get_id": True,
            "get_tags": True,
            "get_platform": True,
            "platform_filter": [platform] if platform else None,
        }
        result = await nautobot_service.graphql_query(query, variables)

        if "errors" in result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"GraphQL errors: {result['errors']}",
            )

        software_versions = result["data"]["software_versions"]
        ttl = int(settings_manager.get_cache_settings().get("ttl_seconds", 600))
        cache_service.set(cache_key, software_versions, ttl)
        return software_versions
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch software versions: {str(e)}",
        )


@router.get("/vlans", summary="🔷 GraphQL: List VLANs")
async def get_vlans(
    location: str = None,
    get_global_vlans: bool = False,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get list of VLANs from Nautobot.

    **🔷 This endpoint uses GraphQL** to fetch VLANs.

    Args:
        location: Optional location name to filter VLANs
        get_global_vlans: If true and location is set, also include VLANs with no location (global VLANs)
    """
    try:
        # Try in-memory cache first
        from services.settings.cache import cache_service
        from settings_manager import settings_manager

        cache_key = f"nautobot:vlans:list:{location or 'all'}:global_{get_global_vlans}"
        cached = cache_service.get(cache_key)
        if cached is not None:
            return cached

        # Cache miss; fetch from Nautobot and populate cache
        query = """
        query (
            $get_id: Boolean = true,
            $get_tags: Boolean = true,
            $get_vlan_groups: Boolean = false,
            $get_location: Boolean = true,
            $location_filter: [String]
        ) {
            vlans(location: $location_filter) {
                id @include(if: $get_id)
                name
                description
                vid
                role {
                    id @include(if: $get_id)
                    name
                }
                tags @include(if: $get_tags) {
                    id @include(if: $get_id)
                    name
                }
                location @include(if: $get_location) {
                    id @include(if: $get_id)
                    name
                }
                vlan_group @include(if: $get_vlan_groups) {
                    id @include(if: $get_id)
                    name
                }
            }
        }
        """

        # If get_global_vlans is true and location is set, fetch all VLANs and filter manually
        if get_global_vlans and location:
            variables = {
                "get_id": True,
                "get_tags": True,
                "get_vlan_groups": False,
                "get_location": True,
                "location_filter": None,  # Get all VLANs
            }
            result = await nautobot_service.graphql_query(query, variables)

            if "errors" in result:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"GraphQL errors: {result['errors']}",
                )

            all_vlans = result["data"]["vlans"]
            # Filter to keep: global VLANs (no location) OR VLANs matching the specified location
            vlans = [
                vlan
                for vlan in all_vlans
                if vlan.get("location") is None
                or vlan.get("location", {}).get("name") == location
            ]
        else:
            # Standard behavior: use GraphQL filter
            variables = {
                "get_id": True,
                "get_tags": True,
                "get_vlan_groups": False,
                "get_location": True,
                "location_filter": [location] if location else None,
            }
            result = await nautobot_service.graphql_query(query, variables)

            if "errors" in result:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"GraphQL errors: {result['errors']}",
                )

            vlans = result["data"]["vlans"]

        ttl = int(settings_manager.get_cache_settings().get("ttl_seconds", 600))
        cache_service.set(cache_key, vlans, ttl)
        return vlans
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch VLANs: {str(e)}",
        )


@router.get("/interface-types", summary="🔶 REST: List Interface Types")
async def get_interface_types(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get list of interface type choices from Nautobot.

    **🔶 This endpoint uses REST API** (OPTIONS method) to fetch interface type choices.

    Uses OPTIONS request to get field choices from the interfaces endpoint.
    """
    try:
        # Try in-memory cache first
        from services.settings.cache import cache_service
        from settings_manager import settings_manager

        cache_key = "nautobot:interface_types:list"
        cached = cache_service.get(cache_key)
        if cached is not None:
            return cached

        # Cache miss; fetch from Nautobot using OPTIONS request
        result = await nautobot_service.rest_request(
            endpoint="dcim/interfaces/", method="OPTIONS"
        )

        # Debug: log the full response structure
        logger.info(f"OPTIONS response keys: {result.keys() if result else 'None'}")
        if result and "actions" in result:
            actions = result.get("actions", {})
            logger.info(f"actions keys: {actions.keys()}")
            post_actions = actions.get("POST", {})
            logger.info(
                f"POST actions keys: {post_actions.keys() if post_actions else 'None'}"
            )
            if "type" in post_actions:
                type_field = post_actions.get("type", {})
                logger.info(
                    f"type field keys: {type_field.keys() if isinstance(type_field, dict) else type(type_field)}"
                )
                choices = type_field.get("choices", [])
                logger.info(
                    f"choices type: {type(choices)}, length: {len(choices) if choices else 0}"
                )
                if choices and len(choices) > 0:
                    logger.info(f"first choice: {choices[0]}, type: {type(choices[0])}")

        # Extract type choices from the OPTIONS response
        interface_types = []
        if result and "actions" in result:
            actions = result.get("actions", {})
            post_actions = actions.get("POST", {})
            type_field = post_actions.get("type", {})
            choices = type_field.get("choices", [])

            # Format choices as list of {value, display_name}
            # Filter out empty values and handle different choice structures
            for choice in choices:
                if isinstance(choice, dict):
                    value = choice.get("value", "")
                    # Nautobot uses 'display' not 'display_name'
                    display_name = choice.get("display") or choice.get(
                        "display_name", ""
                    )
                elif isinstance(choice, (list, tuple)) and len(choice) >= 2:
                    # Some APIs return choices as [value, display_name] tuples
                    value = choice[0]
                    display_name = choice[1]
                else:
                    continue

                if value and display_name:
                    interface_types.append(
                        {"value": value, "display_name": display_name}
                    )

        ttl = int(settings_manager.get_cache_settings().get("ttl_seconds", 600))
        cache_service.set(cache_key, interface_types, ttl)
        return interface_types
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch interface types: {str(e)}",
        )


@router.get("/tags/devices", summary="🔶 REST: List Device Tags")
async def get_nautobot_device_tags(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get Nautobot tags specifically for dcim.device content type."""
    try:
        result = await nautobot_service.rest_request(
            "extras/tags/?content_types=dcim.device"
        )
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch device tags: {str(e)}",
        )


@router.get("/custom-fields/devices", summary="🔶 REST: List Device Custom Fields")
async def get_nautobot_device_custom_fields(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get Nautobot custom fields specifically for dcim.device content type."""
    try:
        result = await nautobot_service.rest_request(
            "extras/custom-fields/?content_types=dcim.device"
        )
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch device custom fields: {str(e)}",
        )


@router.get("/custom-fields/prefixes", summary="🔶 REST: List Prefix Custom Fields")
async def get_nautobot_prefix_custom_fields(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get Nautobot custom fields specifically for ipam.prefix content type."""
    try:
        result = await nautobot_service.rest_request(
            "extras/custom-fields/?content_types=ipam.prefix"
        )
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch prefix custom fields: {str(e)}",
        )


@router.get("/custom-field-choices/{custom_field_name}")
async def get_nautobot_custom_field_choices(
    custom_field_name: str,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get Nautobot custom field choices for a specific custom field."""
    try:
        result = await nautobot_service.rest_request(
            f"extras/custom-field-choices/?custom_field={custom_field_name}"
        )
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch custom field choices for {custom_field_name}: {str(e)}",
        )


@router.get("/jobs/{job_id}/results", summary="🔶 REST: Get Job Results")
async def get_job_results(
    job_id: str,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get job results from Nautobot.

    **🔶 This endpoint uses REST API** to fetch job execution results.
    """
    try:
        result = await nautobot_service.rest_request(f"extras/job-results/{job_id}/")

        # Extract the status value from the response
        status_value = result.get("status", {}).get("value")

        return {"status": status_value}
    except Exception as e:
        error_msg = str(e)

        # Check if it's a 404 Not Found error from Nautobot
        if "404" in error_msg or "Not Found" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job result not found: {job_id}",
            )

        logger.error(f"Error fetching job result {job_id}: {error_msg}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch job result: {error_msg}",
        )


@router.get("/health-check", summary="🔶 REST: Health Check")
async def nautobot_health_check(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Simple health check to verify Nautobot connectivity.

    **🔶 This endpoint uses REST API** to verify connection.
    """
    try:
        # Use the same test approach as the nautobot service - query devices with limit 1
        result = await nautobot_service.rest_request("dcim/devices/?limit=1")
        return {
            "status": "connected",
            "message": "Nautobot is accessible",
            "devices_count": result.get("count", 0),
        }
    except Exception as e:
        # Log the full exception details for debugging
        logger.error(f"Nautobot health check failed: {str(e)}", exc_info=True)

        error_msg = str(e)
        error_type = type(e).__name__

        # Include detailed error information in the response
        detailed_error = {
            "error_message": error_msg,
            "error_type": error_type,
            "error_details": str(e.__dict__) if hasattr(e, "__dict__") else None,
        }

        if "403" in error_msg or "Invalid token" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Nautobot connection failed: Invalid or missing API token. Please check Nautobot settings. Details: {detailed_error}",
            )
        elif "ConnectionError" in error_msg or "timeout" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Nautobot connection failed: Cannot reach Nautobot server. Please check Nautobot URL and connectivity. Details: {detailed_error}",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Nautobot connection failed: {error_msg}. Error type: {error_type}. Details: {detailed_error}",
            )


@router.get(
    "/devices/{device_id}/details", summary="🔷 GraphQL: Get Detailed Device Info"
)
async def get_device_details(
    device_id: str,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get detailed device information using the comprehensive devices.md query.

    **🔷 This endpoint uses GraphQL** to fetch comprehensive device details.
    """
    try:
        # Start with a simplified query based on the working get_device method, then add more fields
        query = """
        query DeviceDetails($deviceId: ID!) {
            device(id: $deviceId) {
                id
                name
                hostname: name
                asset_tag
                serial
                position
                face
                config_context
                local_config_context_data
                _custom_field_data
                primary_ip4 {
                    id
                    address
                    description
                    ip_version
                    host
                    mask_length
                    dns_name
                    status {
                        id
                        name
                    }
                    parent {
                        id
                        prefix
                    }
                }
                role {
                    id
                    name
                }
                device_type {
                    id
                    model
                    manufacturer {
                        id
                        name
                    }
                }
                platform {
                    id
                    name
                    network_driver
                    manufacturer {
                        id
                        name
                    }
                }
                location {
                    id
                    name
                    description
                    parent {
                        id
                        name
                    }
                }
                status {
                    id
                    name
                }
                interfaces {
                    id
                    name
                    type
                    enabled
                    mtu
                    mac_address
                    description
                    status {
                        id
                        name
                    }
                    ip_addresses {
                        id
                        address
                        ip_version
                        status {
                            id
                            name
                        }
                    }
                    connected_interface {
                        id
                        name
                        device {
                            id
                            name
                        }
                    }
                    cable {
                        id
                        status {
                            id
                            name
                        }
                    }
                    tagged_vlans {
                        id
                        name
                        vid
                    }
                    untagged_vlan {
                        id
                        name
                        vid
                    }
                }
                console_ports {
                    id
                    name
                    type
                    description
                }
                console_server_ports {
                    id
                    name
                    type
                    description
                }
                power_ports {
                    id
                    name
                    type
                    description
                }
                power_outlets {
                    id
                    name
                    type
                    description
                }
                secrets_group {
                    id
                    name
                }
                tags {
                    id
                    name
                    color
                }
            }
        }
        """
        variables = {"deviceId": device_id}
        result = await nautobot_service.graphql_query(query, variables)

        if "errors" in result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"GraphQL errors: {result['errors']}",
            )

        device = result["data"]["device"]
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Device {device_id} not found",
            )

        # Cache the device details
        cache_key = f"nautobot:device_details:{device_id}"
        cache_service.set(cache_key, device, DEVICE_CACHE_TTL)

        return device
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching device details for {device_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch device details: {str(e)}",
        )


@router.delete("/devices/{device_id}", summary="🔶 REST: Delete Device")
async def delete_device(
    device_id: str,
    current_user: dict = Depends(require_permission("nautobot.devices", "delete")),
):
    """Delete a device from Nautobot."""
    try:
        # Use REST API to delete the device
        await nautobot_service.rest_request(
            f"dcim/devices/{device_id}/", method="DELETE"
        )

        # Clear device from cache
        cache_key = f"nautobot:devices:{device_id}"
        cache_service.delete(cache_key)

        # Clear device details cache
        details_cache_key = f"nautobot:device_details:{device_id}"
        cache_service.delete(details_cache_key)

        # Clear device list caches to force refresh
        cache_keys_to_clear = [
            "nautobot:devices:list:all",
        ]
        for key in cache_keys_to_clear:
            cache_service.delete(key)

        return {
            "success": True,
            "message": f"Device {device_id} deleted successfully",
            "device_id": device_id,
        }

    except Exception as e:
        logger.error(f"Error deleting device {device_id}: {str(e)}")
        if "404" in str(e) or "Not Found" in str(e):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Device {device_id} not found",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete device: {str(e)}",
        )


@router.post("/offboard/{device_id}", summary="🟠 Mixed API: Offboard Device")
async def offboard_device(
    device_id: str,
    request: OffboardDeviceRequest,
    current_user: dict = Depends(require_permission("devices.offboard", "execute")),
):
    """Offboard a device by removing it or applying configured offboarding values.

    **🟠 This endpoint uses multiple APIs** including GraphQL and REST for device offboarding.
    """
    try:
        return await offboarding_service.offboard_device(
            device_id=device_id,
            request=request,
            current_user=current_user,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Unexpected error during offboard process for device %s: %s",
            device_id,
            str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Offboarding failed: {str(e)}",
        )
