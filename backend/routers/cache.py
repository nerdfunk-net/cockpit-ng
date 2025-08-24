"""
Cache inspection router.

Provides comprehensive endpoints for cache statistics, detailed information,
and management operations. All endpoints are protected by token authentication.
"""

from __future__ import annotations
from fastapi import APIRouter, Depends, Query

from core.auth import verify_token
from services.cache_service import cache_service

router = APIRouter(prefix="/api/cache", tags=["cache"])


@router.get("/stats")
async def cache_stats(current_user: str = Depends(verify_token)):
    """Return comprehensive cache statistics including performance metrics."""
    try:
        stats = cache_service.stats()
        return {"success": True, "data": stats}
    except Exception as exc:
        return {"success": False, "message": str(exc)}


@router.get("/entries")
async def cache_entries(
    include_expired: bool = Query(False, description="Include expired entries in the response"),
    current_user: str = Depends(verify_token)
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
    current_user: str = Depends(verify_token)
):
    """Return detailed information about a specific cache namespace."""
    try:
        info = cache_service.get_namespace_info(namespace)
        return {"success": True, "data": info}
    except Exception as exc:
        return {"success": False, "message": str(exc)}


@router.get("/performance")
async def cache_performance(current_user: str = Depends(verify_token)):
    """Return detailed cache performance metrics."""
    try:
        metrics = cache_service.get_performance_metrics()
        return {"success": True, "data": metrics}
    except Exception as exc:
        return {"success": False, "message": str(exc)}


@router.post("/clear")
async def clear_cache(payload: dict = None, current_user: str = Depends(verify_token)):
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
                "cleared_count": cleared_count
            }

        cleared_count = cache_service.clear_namespace(namespace)
        return {
            "success": True, 
            "message": f"Cleared cache namespace '{namespace}' ({cleared_count} items)",
            "cleared_count": cleared_count
        }
    except Exception as exc:
        return {"success": False, "message": str(exc)}


@router.post("/cleanup")
async def cleanup_expired(current_user: str = Depends(verify_token)):
    """Remove expired cache entries and return count of removed items."""
    try:
        removed_count = cache_service.cleanup_expired()
        return {
            "success": True,
            "message": f"Removed {removed_count} expired entries",
            "removed_count": removed_count
        }
    except Exception as exc:
        return {"success": False, "message": str(exc)}
