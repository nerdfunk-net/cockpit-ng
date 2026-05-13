"""
File management-related Pydantic models.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class FileCompareRequest(BaseModel):
    """File comparison request model."""

    left_file: str
    right_file: str
    repo_id: Optional[int] = None


class FileExportRequest(BaseModel):
    """File export request model."""

    left_file: str
    right_file: str
    format: str = "unified"
    repo_id: Optional[int] = None
