"""
Nautobot location hierarchy endpoints.
"""

from __future__ import annotations
import logging
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from services.nautobot.client import NautobotService
from dependencies import get_nautobot_service, get_cache_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["nautobot-locations"])


@router.get("/locations", summary="🔷 GraphQL: List Locations")
async def get_locations(
    current_user: dict = Depends(require_permission("nautobot.locations", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
    cache_service=Depends(get_cache_service),
):
    """Get list of locations from Nautobot with parent and children relationships.

    **🔷 This endpoint uses GraphQL** to fetch hierarchical location data.
    """
    try:
        from settings_manager import settings_manager

        cache_key = "nautobot:locations:list"
        cached = cache_service.get(cache_key)
        if cached is not None:
            return cached

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


@router.get("/location-types", summary="🔷 GraphQL: List Location Types")
async def get_location_types(
    current_user: dict = Depends(require_permission("nautobot.locations", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
    cache_service=Depends(get_cache_service),
):
    """Get all location types from Nautobot with their parent relationships.

    **🔷 This endpoint uses GraphQL** to fetch location type hierarchy data.
    The response is a flat list; the client builds the display hierarchy.
    """
    try:
        cache_key = "nautobot:location-types:list"
        cached = cache_service.get(cache_key)
        if cached is not None:
            return cached

        query = """
        {
          location_types {
            id
            name
            parent {
              id
              name
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

        location_types = result["data"]["location_types"]
        # Cache for 5 minutes (location types are very static)
        cache_service.set(cache_key, location_types, 300)
        return location_types
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch location types: {str(e)}",
        )


@router.get("/parent-locations", summary="🔷 GraphQL: Resolve Parent Location by Type")
async def get_parent_location(
    location_id: str,
    location_type_id: str,
    current_user: dict = Depends(require_permission("nautobot.locations", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """Walk up the location hierarchy from location_id until a location of the
    given location_type_id is found.  Returns that ancestor's id and name.

    If the starting location already matches the type, it is returned immediately.
    If the type is never found before the root, the original location_id is
    returned as a fallback so imports are never broken by a missing hierarchy.

    **🔷 This endpoint uses GraphQL** for each step of the traversal.
    """
    current_id = location_id
    original_location_id = location_id

    for _ in range(10):  # guard against unexpectedly deep hierarchies
        query = (
            """
        {
          locations(id: "%s") {
            id
            name
            location_type {
              id
              name
            }
            parent {
              id
              name
              location_type {
                id
                name
              }
            }
          }
        }
        """
            % current_id
        )

        result = await nautobot_service.graphql_query(query)

        if "errors" in result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"GraphQL errors: {result['errors']}",
            )

        locations = result["data"].get("locations", [])
        if not locations:
            # Location not found — return original as fallback
            break

        loc = locations[0]
        loc_type = loc.get("location_type") or {}

        if loc_type.get("id") == location_type_id:
            return {"location_id": loc["id"], "location_name": loc["name"]}

        parent = loc.get("parent")
        if not parent:
            # Reached the root without finding the target type
            break

        current_id = parent["id"]

    # Fallback: return the original location
    return {"location_id": original_location_id, "location_name": None}
