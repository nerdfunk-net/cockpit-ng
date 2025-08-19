"""
Cache inspection router.

Provides a simple endpoint to return the in-memory cache statistics
for quick debugging and inspection. Protected by the token dependency.
"""

from __future__ import annotations
from fastapi import APIRouter, Depends

from core.auth import verify_token
from services.cache_service import cache_service

router = APIRouter(prefix="/api/cache", tags=["cache"])


@router.get("/stats")
async def cache_stats(current_user: str = Depends(verify_token)):
    """Return cache statistics from the in-memory cache service."""
    try:
        stats = cache_service.stats()
        return {"success": True, "data": stats}
    except Exception as exc:
        return {"success": False, "message": str(exc)}


@router.post("/clear")
async def clear_cache(payload: dict = None, current_user: str = Depends(verify_token)):
    """Clear cache entries. Accepts optional JSON { "namespace": "repo:123" }.

    If namespace is omitted or empty, clears the entire cache.
    """
    try:
        namespace = None
        if payload and isinstance(payload, dict):
            namespace = payload.get("namespace")

        if not namespace:
            cache_service.clear_all()
            return {"success": True, "message": "Cleared all cache entries"}

        cache_service.clear_namespace(namespace)
        return {"success": True, "message": f"Cleared cache namespace '{namespace}'"}
    except Exception as exc:
        return {"success": False, "message": str(exc)}
