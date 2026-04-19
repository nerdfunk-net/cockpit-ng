"""Template import and scan-import endpoints."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from dependencies import get_template_import_service, get_template_scan_service
from models.templates import (
    TemplateImportRequest,
    TemplateImportResponse,
    TemplateScanImportResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/scan-import", response_model=TemplateScanImportResponse)
async def scan_import_directory(
    current_user: dict = Depends(require_permission("network.templates", "write")),
    scan_service=Depends(get_template_scan_service),
) -> TemplateScanImportResponse:
    """Scan the import directory for YAML template files."""
    try:
        return scan_service.scan_import_directory()
    except Exception as exc:
        logger.error("Failed to scan import directory: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to scan import directory: {exc}",
        )


@router.post("/import", response_model=TemplateImportResponse)
async def import_templates(
    import_request: TemplateImportRequest,
    current_user: dict = Depends(require_permission("network.templates", "write")),
    import_service=Depends(get_template_import_service),
) -> TemplateImportResponse:
    """Import multiple templates from various sources."""
    try:
        username = current_user.get("username")
        return import_service.import_templates(import_request, username)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        logger.error("Error importing templates: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import templates: {exc}",
        )
