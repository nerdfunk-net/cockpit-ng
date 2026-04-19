"""Advanced render and execute-and-sync endpoints."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from dependencies import get_template_render_orchestrator
from models.templates import (
    AdvancedTemplateRenderRequest,
    AdvancedTemplateRenderResponse,
    TemplateExecuteAndSyncRequest,
    TemplateExecuteAndSyncResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/advanced-render", response_model=AdvancedTemplateRenderResponse)
async def advanced_render_template(
    render_request: AdvancedTemplateRenderRequest,
    current_user: dict = Depends(require_permission("network.templates", "read")),
    orchestrator=Depends(get_template_render_orchestrator),
) -> AdvancedTemplateRenderResponse:
    """Advanced unified template rendering for netmiko and agent templates."""
    try:
        return await orchestrator.advanced_render(render_request)
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        logger.error("Error in advanced template rendering: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to render template: {exc}",
        )


@router.post("/execute-and-sync", response_model=TemplateExecuteAndSyncResponse)
async def execute_template_and_sync_to_nautobot(
    request: TemplateExecuteAndSyncRequest,
    current_user: dict = Depends(require_permission("network.templates", "write")),
    orchestrator=Depends(get_template_render_orchestrator),
) -> TemplateExecuteAndSyncResponse:
    """Execute template and sync results to Nautobot."""
    try:
        username = current_user.get("username")
        return await orchestrator.execute_and_sync(request, username)
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Error in execute-and-sync: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute template and sync: {exc}",
        )
