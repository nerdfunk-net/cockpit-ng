"""
Git-related Pydantic models.
"""

from __future__ import annotations
from pydantic import BaseModel
from typing import List, Optional


class GitCommitRequest(BaseModel):
    """Git commit request model."""
    message: str
    files: Optional[List[str]] = None  # If None, commit all changes


class GitBranchRequest(BaseModel):
    """Git branch management request model."""
    branch_name: str
    create: bool = False
