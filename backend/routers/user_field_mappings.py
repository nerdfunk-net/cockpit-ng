"""
Per-user, per-app field mapping router.

Lets any tool (starting with the Nautobot Live Update wizard) save and reuse a
user's CSV/agent-field-to-target-field mapping so it doesn't need to be
reconfigured on every run.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Path

from core.auth import get_current_username
from core.safe_http_errors import raise_internal_server_error
from dependencies import get_user_field_mapping_service
from models.user_field_mappings import FieldMappingResponse, FieldMappingUpdateRequest
from services.user_field_mappings.user_field_mapping_service import (
    UserFieldMappingService,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/field-mappings", tags=["field-mappings"])

APP_NAME_PATTERN = r"^[a-z0-9][a-z0-9-]{0,98}[a-z0-9]$"


@router.get("/{app_name}", response_model=FieldMappingResponse)
async def get_field_mapping(
    app_name: str = Path(..., pattern=APP_NAME_PATTERN),
    current_user: str = Depends(get_current_username),
    service: UserFieldMappingService = Depends(get_user_field_mapping_service),
) -> FieldMappingResponse:
    """Get the current user's saved field mapping for an app, if any."""
    try:
        mapping = service.get_mapping(current_user, app_name)
        return FieldMappingResponse(success=True, data=mapping)
    except Exception as exc:
        raise_internal_server_error(
            logger,
            "Error fetching field mapping",
            exc,
            extra={"username": current_user, "app_name": app_name},
        )


@router.put("/{app_name}", response_model=FieldMappingResponse)
async def save_field_mapping(
    body: FieldMappingUpdateRequest,
    app_name: str = Path(..., pattern=APP_NAME_PATTERN),
    current_user: str = Depends(get_current_username),
    service: UserFieldMappingService = Depends(get_user_field_mapping_service),
) -> FieldMappingResponse:
    """Save (create or replace) the current user's field mapping for an app."""
    try:
        mapping = service.save_mapping(current_user, app_name, body.mapping)
        return FieldMappingResponse(success=True, data=mapping)
    except Exception as exc:
        raise_internal_server_error(
            logger,
            "Error saving field mapping",
            exc,
            extra={"username": current_user, "app_name": app_name},
        )
