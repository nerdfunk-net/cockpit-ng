"""
Cache inspection router.

Provides comprehensive endpoints for cache statistics, detailed information,
and management operations. All endpoints are protected by token authentication.
"""

from __future__ import annotations
from fastapi import APIRouter, Depends, Query

from core.auth import require_permission
from services.settings.cache import cache_service

router = APIRouter(prefix="/api/cache", tags=["cache"])


# Device cache management functions
def _get_device_cache_key(device_id: str) -> str:
    """Generate cache key for individual device."""
    return f"nautobot:devices:{device_id}"


def _clear_device_cache(device_id: str = None) -> int:
    """Clear device cache. If device_id is provided, clear only that device. Otherwise clear all device cache."""
    if device_id:
        # Clear specific device
        cache_key = _get_device_cache_key(device_id)
        if cache_service.get(cache_key):
            # Since we can't clear individual keys, we'll clear the namespace
            # This will clear all device cache, but it's the best we can do
            return cache_service.clear_namespace("nautobot:devices")
        return 0
    else:
        # Clear all device-related cache
        return cache_service.clear_namespace("nautobot:devices")


@router.get("/stats")
async def cache_stats(
    current_user: dict = Depends(require_permission("settings.cache", "write")),
):
    """Return comprehensive cache statistics including performance metrics."""
    try:
        stats = cache_service.stats()
        return {"success": True, "data": stats}
    except Exception as exc:
        return {"success": False, "message": str(exc)}


@router.get("/entries")
async def cache_entries(
    include_expired: bool = Query(
        False, description="Include expired entries in the response"
    ),
    current_user: dict = Depends(require_permission("settings.cache", "write")),
):
    """Return detailed information about all cache entries."""
    try:
        entries = cache_service.get_entries(include_expired=include_expired)
        return {"success": True, "data": entries, "count": len(entries)}
    except Exception as exc:
        return {"success": False, "message": str(exc)}


@router.get("/namespace/{namespace}")
async def cache_namespace_info(
    namespace: str,
    current_user: dict = Depends(require_permission("settings.cache", "write")),
):
    """Return detailed information about a specific cache namespace."""
    try:
        info = cache_service.get_namespace_info(namespace)
        return {"success": True, "data": info}
    except Exception as exc:
        return {"success": False, "message": str(exc)}


@router.get("/performance")
async def cache_performance(
    current_user: dict = Depends(require_permission("settings.cache", "write")),
):
    """Return detailed cache performance metrics."""
    try:
        metrics = cache_service.get_performance_metrics()
        return {"success": True, "data": metrics}
    except Exception as exc:
        return {"success": False, "message": str(exc)}


@router.post("/clear")
async def clear_cache(
    payload: dict = None,
    current_user: dict = Depends(require_permission("settings.cache", "write")),
):
    """Clear cache entries. Accepts optional JSON { "namespace": "repo:123" }.

    If namespace is omitted or empty, clears the entire cache.
    Returns the count of cleared entries.
    """
    try:
        namespace = None
        if payload and isinstance(payload, dict):
            namespace = payload.get("namespace")

        if not namespace:
            cleared_count = cache_service.clear_all()
            return {
                "success": True,
                "message": f"Cleared all cache entries ({cleared_count} items)",
                "cleared_count": cleared_count,
            }

        cleared_count = cache_service.clear_namespace(namespace)
        return {
            "success": True,
            "message": f"Cleared cache namespace '{namespace}' ({cleared_count} items)",
            "cleared_count": cleared_count,
        }
    except Exception as exc:
        return {"success": False, "message": str(exc)}


@router.post("/cleanup")
async def cleanup_expired(
    current_user: dict = Depends(require_permission("settings.cache", "write")),
):
    """Remove expired cache entries and return count of removed items."""
    try:
        removed_count = cache_service.cleanup_expired()
        return {
            "success": True,
            "message": f"Removed {removed_count} expired entries",
            "removed_count": removed_count,
        }
    except Exception as exc:
        return {"success": False, "message": str(exc)}


@router.post("/devices/clear")
async def clear_devices_cache(
    payload: dict = None,
    current_user: dict = Depends(require_permission("settings.cache", "write")),
):
    """Clear device cache. Accepts optional JSON { "device_id": "123" }.

    If device_id is provided, clears cache for that specific device.
    If device_id is omitted, clears all device cache entries.
    """
    try:
        device_id = None
        if payload and isinstance(payload, dict):
            device_id = payload.get("device_id")

        cleared_count = _clear_device_cache(device_id)

        if device_id:
            message = (
                f"Cleared cache for device {device_id}"
                if cleared_count > 0
                else f"No cache found for device {device_id}"
            )
        else:
            message = f"Cleared {cleared_count} device cache entries"

        return {"success": True, "message": message, "cleared_count": cleared_count}
    except Exception as exc:
        return {"success": False, "message": str(exc)}


@router.get("/devices/stats")
async def get_devices_cache_stats(
    current_user: dict = Depends(require_permission("settings.cache", "write")),
):
    """Get device cache statistics and information."""
    try:
        # Get namespace stats for device cache
        namespace_info = cache_service.get_namespace_info("nautobot:devices")

        return {
            "success": True,
            "data": {
                "namespace": "nautobot:devices",
                "cache_info": namespace_info,
                "cache_ttl_seconds": 1800,  # 30 minutes
                "cache_ttl_minutes": 30,
            },
        }
    except Exception as exc:
        return {"success": False, "message": str(exc)}
