"""Template CRUD endpoints."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from core.safe_http_errors import raise_internal_server_error
from models.templates import (
    TemplateListResponse,
    TemplateRequest,
    TemplateResponse,
    TemplateUpdateRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/", response_model=TemplateListResponse)
async def list_templates(
    category: Optional[str] = None,
    source: Optional[str] = None,
    search: Optional[str] = None,
    active_only: bool = True,
    current_user: dict = Depends(require_permission("network.templates", "read")),
) -> TemplateListResponse:
    """List all templates with optional filtering."""
    try:
        import service_factory

        template_manager = service_factory.build_template_service()

        username = current_user.get("username")

        if search:
            templates = template_manager.search_templates(
                search, search_content=True, username=username
            )
        else:
            templates = template_manager.list_templates(
                category=category,
                source=source,
                active_only=active_only,
                username=username,
            )

        template_responses = [TemplateResponse(**t) for t in templates]
        return TemplateListResponse(
            templates=template_responses, total=len(template_responses)
        )

    except Exception as exc:
        raise_internal_server_error(logger, "Failed to list templates", exc)


@router.post("/", response_model=TemplateResponse)
async def create_template(
    template_request: TemplateRequest,
    current_user: dict = Depends(require_permission("network.templates", "write")),
) -> TemplateResponse:
    """Create a new template."""
    try:
        import service_factory

        template_manager = service_factory.build_template_service()

        username = current_user.get("username")
        template_data = template_request.dict(exclude_unset=True)
        template_data["created_by"] = username

        template_id = template_manager.create_template(template_data)
        if template_id:
            return TemplateResponse(**template_manager.get_template(template_id))

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create template",
        )

    except ValueError as exc:
        logger.warning("Template create validation error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid template parameters",
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise_internal_server_error(logger, "Failed to create template", exc)


@router.get("/categories")
async def get_template_categories(
    current_user: dict = Depends(require_permission("network.templates", "read")),
):
    """Get all template categories."""
    try:
        import service_factory

        template_manager = service_factory.build_template_service()

        return template_manager.get_categories()

    except Exception as exc:
        raise_internal_server_error(logger, "Failed to get template categories", exc)


@router.get("/name/{template_name}", response_model=TemplateResponse)
async def get_template_by_name(
    template_name: str,
    current_user: dict = Depends(require_permission("network.templates", "read")),
) -> TemplateResponse:
    """Get a template by name."""
    try:
        import service_factory

        template_manager = service_factory.build_template_service()

        template = template_manager.get_template_by_name(template_name)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with name '{template_name}' not found",
            )
        return TemplateResponse(**template)

    except HTTPException:
        raise
    except Exception as exc:
        raise_internal_server_error(
            logger,
            "Failed to get template by name",
            exc,
            extra={"template_name": template_name},
        )


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: int,
    current_user: dict = Depends(require_permission("network.templates", "read")),
) -> TemplateResponse:
    """Get a specific template by ID."""
    try:
        import service_factory

        template_manager = service_factory.build_template_service()

        template = template_manager.get_template(template_id)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID {template_id} not found",
            )
        return TemplateResponse(**template)

    except HTTPException:
        raise
    except Exception as exc:
        raise_internal_server_error(
            logger,
            "Failed to get template",
            exc,
            extra={"template_id": template_id},
        )


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: int,
    template_request: TemplateUpdateRequest,
    current_user: dict = Depends(require_permission("network.templates", "write")),
) -> TemplateResponse:
    """Update an existing template."""
    try:
        import service_factory

        template_manager = service_factory.build_template_service()

        existing = template_manager.get_template(template_id)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID {template_id} not found",
            )

        username = current_user.get("username")
        is_admin = current_user.get("permissions", 0) & 16
        if not is_admin and existing.get("created_by") != username:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only edit your own templates",
            )

        template_data = template_request.dict(exclude_unset=True)
        if template_manager.update_template(template_id, template_data):
            return TemplateResponse(**template_manager.get_template(template_id))

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update template",
        )

    except ValueError as exc:
        logger.warning("Template update validation error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid template parameters",
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise_internal_server_error(
            logger,
            "Failed to update template",
            exc,
            extra={"template_id": template_id},
        )


@router.delete("/{template_id}")
async def delete_template(
    template_id: int,
    hard_delete: bool = True,
    current_user: dict = Depends(require_permission("network.templates", "delete")),
):
    """Delete a template."""
    try:
        import service_factory

        template_manager = service_factory.build_template_service()

        if template_manager.delete_template(template_id, hard_delete=hard_delete):
            action = "deleted" if hard_delete else "deactivated"
            return {"message": f"Template {template_id} {action} successfully"}

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete template",
        )

    except HTTPException:
        raise
    except Exception as exc:
        raise_internal_server_error(
            logger,
            "Failed to delete template",
            exc,
            extra={"template_id": template_id},
        )
