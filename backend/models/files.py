"""
File management-related Pydantic models.
"""

from __future__ import annotations
from pydantic import BaseModel


class FileCompareRequest(BaseModel):
    """File comparison request model."""
    left_file: str
    right_file: str


class FileExportRequest(BaseModel):
    """File export request model."""
    left_file: str
    right_file: str
    format: str = "unified"
