"""
Per-user, per-app field mapping Pydantic models.
"""

from __future__ import annotations

from typing import Dict, Optional

from pydantic import BaseModel


class FieldMappingResponse(BaseModel):
    """Current user's saved field mapping for an app, or null if none saved."""

    success: bool = True
    data: Optional[Dict[str, Optional[str]]] = None


class FieldMappingUpdateRequest(BaseModel):
    """Field mapping to persist for the current user and app."""

    mapping: Dict[str, Optional[str]]
