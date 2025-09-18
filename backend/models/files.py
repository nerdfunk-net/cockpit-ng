"""
File management-related Pydantic models.
"""

from __future__ import annotations
from pydantic import BaseModel
from typing import Optional


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
