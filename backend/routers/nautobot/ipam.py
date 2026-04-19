"""
Nautobot IPAM metadata endpoints: namespaces, VLANs, software versions and image files.
"""

from __future__ import annotations
import logging
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from services.nautobot.client import NautobotService
from dependencies import get_nautobot_service, get_cache_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["nautobot-ipam"])


@router.get("/namespaces", summary="🔷 GraphQL: List Namespaces")
async def get_namespaces(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
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


@router.get("/software-versions", summary="🔷 GraphQL: List Software Versions")
async def get_software_versions(
    platform: str = None,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
    cache_service=Depends(get_cache_service),
):
    """Get list of software versions from Nautobot.

    **🔷 This endpoint uses GraphQL** to fetch software versions.

    Args:
        platform: Optional platform name to filter software versions
    """
    try:
        from settings_manager import settings_manager

        cache_key = f"nautobot:software_versions:list:{platform or 'all'}"
        cached = cache_service.get(cache_key)
        if cached is not None:
            return cached

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


@router.get("/software-image-files", summary="🔷 GraphQL: List Software Image Files")
async def get_software_image_files(
    software_version: str = None,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
    cache_service=Depends(get_cache_service),
):
    """Get list of software image files from Nautobot.

    **🔷 This endpoint uses GraphQL** to fetch software image files.

    Args:
        software_version: Optional software version string to filter image files
    """
    try:
        from settings_manager import settings_manager

        cache_key = f"nautobot:software_image_files:list:{software_version or 'all'}"
        cached = cache_service.get(cache_key)
        if cached is not None:
            return cached

        query = """
        query ($software_version_filter: [String]) {
            software_image_files(software_version: $software_version_filter) {
                id
                image_file_name
            }
        }
        """
        variables = {
            "software_version_filter": [software_version] if software_version else None,
        }
        result = await nautobot_service.graphql_query(query, variables)

        if "errors" in result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"GraphQL errors: {result['errors']}",
            )

        image_files = result["data"]["software_image_files"]
        ttl = int(settings_manager.get_cache_settings().get("ttl_seconds", 600))
        cache_service.set(cache_key, image_files, ttl)
        return image_files
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch software image files: {str(e)}",
        )


@router.get("/vlans", summary="🔷 GraphQL: List VLANs")
async def get_vlans(
    location: str = None,
    get_global_vlans: bool = False,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
    cache_service=Depends(get_cache_service),
):
    """Get list of VLANs from Nautobot.

    **🔷 This endpoint uses GraphQL** to fetch VLANs.

    Args:
        location: Optional location name to filter VLANs
        get_global_vlans: If true and location is set, also include VLANs with no location (global VLANs)
    """
    try:
        from settings_manager import settings_manager

        cache_key = f"nautobot:vlans:list:{location or 'all'}:global_{get_global_vlans}"
        cached = cache_service.get(cache_key)
        if cached is not None:
            return cached

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
