"""
Git operations models - Consistent data structures for commits, diffs, and operations.

This module provides standardized Pydantic models for all git operations to ensure
consistent data structures across all endpoints and eliminate inconsistencies where
commit author is sometimes a string and sometimes a dict.
"""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

# ============================================================================
# Commit Models
# ============================================================================


class GitAuthor(BaseModel):
    """Git commit author information."""

    name: str = Field(..., description="Author name")
    email: str = Field(..., description="Author email address")


class GitCommit(BaseModel):
    """Standard git commit representation used across all endpoints."""

    hash: str = Field(..., description="Full commit SHA hash")
    short_hash: str = Field(..., description="Short commit SHA (8 chars)")
    message: str = Field(..., description="Commit message")
    author: GitAuthor = Field(..., description="Commit author information")
    date: str = Field(..., description="Commit date in ISO format")
    files_changed: int = Field(
        default=0, description="Number of files changed in commit"
    )


# ============================================================================
# Diff Models
# ============================================================================


class DiffStats(BaseModel):
    """Statistics for a diff operation."""

    additions: int = Field(default=0, description="Lines added")
    deletions: int = Field(default=0, description="Lines deleted")


class DiffLine(BaseModel):
    """Single line in a diff with metadata."""

    line_number: int = Field(..., description="Line number in the file")
    type: Literal["add", "remove", "context"] = Field(
        ..., description="Type of diff line"
    )
    content: str = Field(..., description="Line content")


class DiffResult(BaseModel):
    """Result of a diff operation between two versions."""

    diff_lines: List[str] = Field(
        default_factory=list, description="Unified diff format lines"
    )
    line_by_line: List[DiffLine] = Field(
        default_factory=list, description="Parsed diff lines with metadata"
    )
    stats: DiffStats = Field(..., description="Diff statistics")


# ============================================================================
# Operation Result Models
# ============================================================================


class SyncResult(BaseModel):
    """Result of a repository sync operation."""

    success: bool = Field(..., description="Whether sync was successful")
    message: str = Field(..., description="Human-readable result message")
    commits_behind: int = Field(
        default=0, description="Number of commits behind remote before sync"
    )
    commits_ahead: int = Field(
        default=0, description="Number of commits ahead of remote after sync"
    )
    repository_path: Optional[str] = Field(None, description="Local path to repository")


class CloneResult(BaseModel):
    """Result of a repository clone operation."""

    success: bool = Field(..., description="Whether clone was successful")
    message: str = Field(..., description="Human-readable result message")
    repo_path: str = Field(..., description="Local path to cloned repository")


# ============================================================================
# Helper Functions
# ============================================================================


def commit_to_dict(commit) -> dict:
    """Convert a GitPython commit object to a dictionary matching GitCommit model.

    Args:
        commit: GitPython Commit object

    Returns:
        Dictionary with standardized commit fields
    """
    return {
        "hash": commit.hexsha,
        "short_hash": commit.hexsha[:8],
        "message": commit.message.strip(),
        "author": {
            "name": commit.author.name,
            "email": commit.author.email,
        },
        "date": commit.committed_datetime.isoformat(),
        "files_changed": len(commit.stats.files) if hasattr(commit, "stats") else 0,
    }
