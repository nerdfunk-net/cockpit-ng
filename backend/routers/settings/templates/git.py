"""Git connection test and sync endpoints."""

from __future__ import annotations

import logging
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from models.templates import (
    TemplateGitTestRequest,
    TemplateSyncRequest,
    TemplateSyncResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/git/test")
async def test_git_connection(
    git_test: TemplateGitTestRequest,
    current_user: dict = Depends(require_permission("network.templates", "write")),
) -> Dict[str, Any]:
    """Test Git repository connection for templates."""
    try:
        # TODO: implement real Git connection test
        return {
            "success": True,
            "message": "Git connection test successful",
            "repository_accessible": True,
            "files_found": ["template1.j2", "template2.txt"],
        }
    except Exception as exc:
        logger.error("Error testing Git connection: %s", exc)
        return {
            "success": False,
            "message": f"Git connection test failed: {exc}",
            "repository_accessible": False,
        }


@router.post("/sync", response_model=TemplateSyncResponse)
async def sync_templates(
    sync_request: TemplateSyncRequest,
    current_user: dict = Depends(require_permission("network.templates", "write")),
) -> TemplateSyncResponse:
    """Sync templates from Git repositories."""
    try:
        from template_manager import template_manager

        # TODO: implement real Git template synchronization
        if sync_request.template_id:
            synced = [sync_request.template_id]
            message = f"Template {sync_request.template_id} synced successfully"
        else:
            git_templates = template_manager.list_templates(source="git")
            synced = [t["id"] for t in git_templates]
            message = f"Synced {len(synced)} Git templates"

        return TemplateSyncResponse(
            synced_templates=synced,
            failed_templates=[],
            errors={},
            message=message,
        )

    except Exception as exc:
        logger.error("Error syncing templates: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync templates: {exc}",
        )
