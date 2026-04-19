"""Template content, version history, and file-upload endpoints."""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from core.auth import require_permission
from models.templates import TemplateResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/{template_id}/content")
async def get_template_content(
    template_id: int,
    current_user: dict = Depends(require_permission("network.templates", "read")),
) -> Dict[str, str]:
    """Get template content."""
    try:
        from template_manager import template_manager

        content = template_manager.get_template_content(template_id)
        if content is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template content for ID {template_id} not found",
            )
        return {"content": content}

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error getting template content for %s: %s", template_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get template content: {exc}",
        )


@router.get("/{template_id}/versions")
async def get_template_versions(
    template_id: int,
    current_user: dict = Depends(require_permission("network.templates", "read")),
) -> List[Dict[str, Any]]:
    """Get version history for a template."""
    try:
        from template_manager import template_manager

        return template_manager.get_template_versions(template_id)

    except Exception as exc:
        logger.error("Error getting template versions for %s: %s", template_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get template versions: {exc}",
        )


@router.post("/upload", response_model=TemplateResponse)
async def upload_template_file(
    file: UploadFile = File(...),
    name: str = Form(...),
    category: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    template_type: str = Form("jinja2"),
    scope: str = Form("global"),
    current_user: dict = Depends(require_permission("network.templates", "write")),
) -> TemplateResponse:
    """Upload a template file."""
    try:
        from template_manager import template_manager

        username = current_user.get("username")
        content_bytes = await file.read()
        content_str = content_bytes.decode("utf-8")

        ext = os.path.splitext(file.filename)[1].lower()
        inferred_type = template_type
        inferred_category = category
        if ext == ".textfsm":
            inferred_type = "textfsm"
            inferred_category = category or "parser"

        template_data = {
            "name": name,
            "source": "file",
            "template_type": inferred_type,
            "category": inferred_category,
            "description": description,
            "content": content_str,
            "filename": file.filename,
            "created_by": username,
            "scope": scope,
        }

        template_id = template_manager.create_template(template_data)
        if template_id:
            return TemplateResponse(**template_manager.get_template(template_id))

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create template from uploaded file",
        )

    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error uploading template file: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload template file: {exc}",
        )
