"""
IPAM Prefix router for Nautobot prefix management.
"""

from __future__ import annotations
import logging
from urllib.parse import urlencode
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from services.nautobot.common.exceptions import NautobotNotFoundError
from dependencies import get_nautobot_service
from services.nautobot.client import NautobotService
from repositories.audit_log_repository import audit_log_repo

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ipam/prefixes", tags=["nautobot-ipam-prefixes"])


# =============================================================================
# IPAM Prefix Endpoints
# =============================================================================


@router.get("", summary="🔶 REST: List IP Prefixes")
async def get_ipam_prefixes(
    prefix: str | None = None,
    namespace: str | None = None,
    location: str | None = None,
    status: str | None = None,
    limit: int | None = None,
    offset: int | None = None,
    current_user: dict = Depends(require_permission("nautobot.locations", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """
    Get IP prefixes from Nautobot IPAM.

    **🔶 This endpoint uses REST API** to query Nautobot IPAM prefixes.

    Query parameters:
    - prefix: Filter by prefix (e.g., "10.0.0.0/8")
    - namespace: Filter by namespace name
    - location: Filter by location name
    - status: Filter by status (e.g., "active", "reserved", "deprecated")
    - limit: Maximum number of results
    - offset: Pagination offset
    """
    try:
        # Build query parameters
        params = {}
        if prefix:
            params["prefix"] = prefix
        if namespace:
            params["namespace"] = namespace
        if location:
            params["location"] = location
        if status:
            params["status"] = status
        if limit:
            params["limit"] = limit
        if offset:
            params["offset"] = offset

        # Build endpoint URL with query parameters
        endpoint = "ipam/prefixes/"
        if params:
            endpoint = f"{endpoint}?{urlencode(params)}"

        result = await nautobot_service.rest_request(endpoint, method="GET")

        logger.info("Retrieved %s prefixes from Nautobot IPAM", result.get("count", 0))
        return result

    except Exception as e:
        logger.error("Failed to get IPAM prefixes: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve IPAM prefixes: {str(e)}",
        )


@router.get("/{prefix_id}", summary="🔶 REST: Get IP Prefix")
async def get_ipam_prefix(
    prefix_id: str,
    current_user: dict = Depends(require_permission("nautobot.locations", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """
    Get a specific IP prefix by ID from Nautobot IPAM.

    Parameters:
    - prefix_id: The UUID of the prefix
    """
    try:
        endpoint = f"ipam/prefixes/{prefix_id}/"
        result = await nautobot_service.rest_request(endpoint, method="GET")

        logger.info("Retrieved prefix %s from Nautobot IPAM", prefix_id)
        return result

    except NautobotNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"IPAM prefix not found: {prefix_id}",
        )
    except Exception as e:
        logger.error("Failed to get IPAM prefix %s: %s", prefix_id, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve IPAM prefix: {str(e)}",
        )


@router.post("", summary="🔶 REST: Create IP Prefix")
async def create_ipam_prefix(
    prefix_data: dict,
    current_user: dict = Depends(require_permission("nautobot.locations", "write")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """
    Create a new IP prefix in Nautobot IPAM.

    Request body should contain:
    - prefix: The IP prefix (e.g., "10.0.0.0/24")
    - namespace: Namespace ID or name
    - status: Status ID or name (e.g., "active")
    - type: Prefix type (e.g., "network", "pool")
    - location: (optional) Location ID
    - description: (optional) Description
    - tags: (optional) List of tag IDs

    Example:
    {
        "prefix": "10.0.0.0/24",
        "namespace": "global",
        "status": "active",
        "type": "network",
        "description": "Management network"
    }
    """
    try:
        # Validate required fields
        if "prefix" not in prefix_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required field: prefix",
            )
        if "namespace" not in prefix_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required field: namespace",
            )

        endpoint = "ipam/prefixes/"
        result = await nautobot_service.rest_request(
            endpoint, method="POST", data=prefix_data
        )

        logger.info("Created prefix %s in Nautobot IPAM", prefix_data.get("prefix"))

        audit_log_repo.create_log(
            username=current_user.get("sub"),
            user_id=current_user.get("user_id"),
            event_type="nautobot-prefix-created",
            message=f"Prefix '{prefix_data.get('prefix')}' created in Nautobot",
            resource_type="prefix",
            resource_id=result.get("id"),
            resource_name=prefix_data.get("prefix"),
            severity="info",
            extra_data={
                "namespace": prefix_data.get("namespace"),
                "status": prefix_data.get("status"),
            },
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to create IPAM prefix: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create IPAM prefix: {str(e)}",
        )


@router.put("/{prefix_id}", summary="🔶 REST: Update IP Prefix (Full)")
@router.patch("/{prefix_id}", summary="🔶 REST: Update IP Prefix (Partial)")
async def update_ipam_prefix(
    prefix_id: str,
    prefix_data: dict,
    current_user: dict = Depends(require_permission("nautobot.locations", "write")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """
    Update an existing IP prefix in Nautobot IPAM.

    Parameters:
    - prefix_id: The UUID of the prefix to update

    Request body can contain any updatable fields:
    - prefix: The IP prefix
    - namespace: Namespace ID
    - status: Status ID
    - type: Prefix type
    - location: Location ID
    - description: Description
    - tags: List of tag IDs
    """
    try:
        endpoint = f"ipam/prefixes/{prefix_id}/"

        # Use PATCH for partial updates (from @router.patch), PUT for full replacement
        # Both decorators point to the same function, so we always use PATCH internally
        result = await nautobot_service.rest_request(
            endpoint,
            method="PATCH",  # Use PATCH for partial updates
            data=prefix_data,
        )

        logger.info("Updated prefix %s in Nautobot IPAM", prefix_id)

        audit_log_repo.create_log(
            username=current_user.get("sub"),
            user_id=current_user.get("user_id"),
            event_type="nautobot-prefix-updated",
            message=f"Prefix '{prefix_id}' updated in Nautobot",
            resource_type="prefix",
            resource_id=prefix_id,
            resource_name=prefix_data.get("prefix", prefix_id),
            severity="info",
        )

        return result

    except NautobotNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"IPAM prefix not found: {prefix_id}",
        )
    except Exception as e:
        logger.error("Failed to update IPAM prefix %s: %s", prefix_id, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update IPAM prefix: {str(e)}",
        )


@router.delete("/{prefix_id}", summary="🔶 REST: Delete IP Prefix")
async def delete_ipam_prefix(
    prefix_id: str,
    current_user: dict = Depends(require_permission("nautobot.locations", "delete")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """
    Delete an IP prefix from Nautobot IPAM.

    Parameters:
    - prefix_id: The UUID of the prefix to delete
    """
    try:
        endpoint = f"ipam/prefixes/{prefix_id}/"
        result = await nautobot_service.rest_request(endpoint, method="DELETE")

        logger.info("Deleted prefix %s from Nautobot IPAM", prefix_id)

        audit_log_repo.create_log(
            username=current_user.get("sub"),
            user_id=current_user.get("user_id"),
            event_type="nautobot-prefix-deleted",
            message=f"Prefix '{prefix_id}' deleted from Nautobot",
            resource_type="prefix",
            resource_id=prefix_id,
            resource_name=prefix_id,
            severity="info",
        )

        return result

    except NautobotNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"IPAM prefix not found: {prefix_id}",
        )
    except Exception as e:
        logger.error("Failed to delete IPAM prefix %s: %s", prefix_id, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete IPAM prefix: {str(e)}",
        )
