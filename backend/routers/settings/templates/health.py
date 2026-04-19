"""Template health check endpoint."""

from __future__ import annotations

import logging
from typing import Any, Dict

from fastapi import APIRouter, Depends

from core.auth import require_permission

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/health")
async def template_health_check(
    current_user: dict = Depends(require_permission("network.templates", "read")),
) -> Dict[str, Any]:
    """Check template system health."""
    try:
        from template_manager import template_manager

        return template_manager.health_check()

    except Exception as exc:
        logger.error("Template health check failed: %s", exc)
        return {"status": "unhealthy", "error": str(exc)}
