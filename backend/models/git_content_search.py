"""Pydantic models for git repository content search."""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field, model_validator

MatchSource = Literal["current", "history", "diff"]
ChangeType = Literal["add", "remove", "replace"]
SearchMode = Literal["current", "history", "diff"]


class GitContentSearchRequest(BaseModel):
    """Request body for searching file content in a git repository."""

    query: str = Field(..., min_length=2, description="Search string (min 2 chars)")
    path_filter: str = Field(
        default="",
        description="Optional glob or path prefix filter, e.g. site-a/* or *.cfg",
    )
    include_history: bool = Field(
        default=False,
        description="Search historical versions of files (not default)",
    )
    diff_mode: bool = Field(
        default=False,
        description="Search only in diff between two commits",
    )
    commit1: Optional[str] = Field(
        default=None,
        description="Older/base commit hash (required when diff_mode)",
    )
    commit2: Optional[str] = Field(
        default=None,
        description="Newer/target commit hash (required when diff_mode)",
    )
    case_sensitive: bool = Field(default=False)
    limit: int = Field(default=100, ge=1, le=500)
    offset: int = Field(default=0, ge=0)

    @model_validator(mode="after")
    def validate_diff_mode(self) -> GitContentSearchRequest:
        if self.diff_mode and (not self.commit1 or not self.commit2):
            raise ValueError("commit1 and commit2 are required when diff_mode is true")
        if self.diff_mode and self.include_history:
            raise ValueError("include_history cannot be used with diff_mode")
        return self


class GitContentSearchMatch(BaseModel):
    """Single content search match."""

    file_path: str
    line_number: int
    line_content: str
    context_before: Optional[str] = None
    context_after: Optional[str] = None
    commit: Optional[str] = None
    commit_message: Optional[str] = None
    commit_date: Optional[str] = None
    match_source: MatchSource
    change_type: Optional[ChangeType] = None


class GitContentSearchData(BaseModel):
    """Search result payload."""

    matches: List[GitContentSearchMatch]
    total_matches: int
    files_scanned: int
    truncated: bool
    search_mode: SearchMode


class GitContentSearchResponse(BaseModel):
    """Top-level content search response."""

    success: bool = True
    data: GitContentSearchData
