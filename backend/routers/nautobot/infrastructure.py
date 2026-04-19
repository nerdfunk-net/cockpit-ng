"""
Nautobot infrastructure endpoints: racks, rack groups, interface types, secret groups.
"""

from __future__ import annotations
import logging
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from services.nautobot.client import NautobotService
from dependencies import get_nautobot_service, get_cache_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["nautobot-infrastructure"])


@router.get("/secret-groups", summary="🔷 GraphQL: List Secret Groups")
async def get_nautobot_secret_groups(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
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
            logger.warning(
                "GraphQL errors fetching secret groups: %s", result["errors"]
            )
            return []

        return result["data"]["secrets_groups"]
    except Exception as e:
        # Return empty list if secret groups don't exist
        logger.warning("Secret groups endpoint not available: %s", str(e))
        return []


@router.get("/racks", summary="🔶 REST: List Racks")
async def get_racks(
    location: str = None,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
    cache_service=Depends(get_cache_service),
):
    """Get list of racks from Nautobot, optionally filtered by location.

    **🔶 This endpoint uses REST API** to fetch rack data.

    Args:
        location: Optional location ID or name to filter racks
    """
    try:
        from settings_manager import settings_manager

        cache_key = f"nautobot:racks:list:{location or 'all'}"
        cached = cache_service.get(cache_key)
        if cached is not None:
            return cached

        endpoint = "dcim/racks/"
        if location:
            endpoint = f"dcim/racks/?location={location}"

        result = await nautobot_service.rest_request(endpoint=endpoint, method="GET")
        racks = result.get("results", [])

        ttl = int(settings_manager.get_cache_settings().get("ttl_seconds", 600))
        cache_service.set(cache_key, racks, ttl)
        return racks
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch racks: {str(e)}",
        )


@router.get("/rack-groups", summary="🔶 REST: List Rack Groups")
async def get_rack_groups(
    location: str = None,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
    cache_service=Depends(get_cache_service),
):
    """Get list of rack groups from Nautobot, optionally filtered by location.

    **🔶 This endpoint uses REST API** to fetch rack group data.

    Args:
        location: Optional location ID or name to filter rack groups
    """
    try:
        from settings_manager import settings_manager

        cache_key = f"nautobot:rack-groups:list:{location or 'all'}"
        cached = cache_service.get(cache_key)
        if cached is not None:
            return cached

        endpoint = "dcim/rack-groups/"
        if location:
            endpoint = f"dcim/rack-groups/?location={location}"

        result = await nautobot_service.rest_request(endpoint=endpoint, method="GET")
        rack_groups = result.get("results", [])

        ttl = int(settings_manager.get_cache_settings().get("ttl_seconds", 600))
        cache_service.set(cache_key, rack_groups, ttl)
        return rack_groups
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch rack groups: {str(e)}",
        )


@router.get("/interface-types", summary="🔶 REST: List Interface Types")
async def get_interface_types(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
    cache_service=Depends(get_cache_service),
):
    """Get list of interface type choices from Nautobot.

    **🔶 This endpoint uses REST API** (OPTIONS method) to fetch interface type choices.

    Uses OPTIONS request to get field choices from the interfaces endpoint.
    """
    try:
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
        logger.info("OPTIONS response keys: %s", result.keys() if result else "None")
        if result and "actions" in result:
            actions = result.get("actions", {})
            logger.info("actions keys: %s", actions.keys())
            post_actions = actions.get("POST", {})
            logger.info(
                "POST actions keys: %s", post_actions.keys() if post_actions else "None"
            )
            if "type" in post_actions:
                type_field = post_actions.get("type", {})
                logger.info(
                    "type field keys: %s",
                    type_field.keys()
                    if isinstance(type_field, dict)
                    else type(type_field),
                )
                choices = type_field.get("choices", [])
                logger.info(
                    "choices type: %s, length: %s",
                    type(choices),
                    len(choices) if choices else 0,
                )
                if choices and len(choices) > 0:
                    logger.info(
                        "first choice: %s, type: %s", choices[0], type(choices[0])
                    )

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
