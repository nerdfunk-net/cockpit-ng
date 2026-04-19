"""
Nautobot utility endpoints: stats, health-check, job results.
"""

from __future__ import annotations
import logging
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from services.nautobot.client import NautobotService
from dependencies import get_nautobot_service, get_cache_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["nautobot-utils"])


@router.get("/stats", summary="🔶 REST: Get Nautobot Statistics")
async def get_nautobot_stats(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
    cache_service=Depends(get_cache_service),
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
        logger.error("Error fetching Nautobot stats: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch statistics: {str(e)}",
        )


@router.get("/jobs/{job_id}/results", summary="🔶 REST: Get Job Results")
async def get_job_results(
    job_id: str,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
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

        logger.error("Error fetching job result %s: %s", job_id, error_msg)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch job result: {error_msg}",
        )


@router.get("/health-check", summary="🔶 REST: Health Check")
async def nautobot_health_check(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
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
        logger.error("Nautobot health check failed: %s", str(e), exc_info=True)

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
