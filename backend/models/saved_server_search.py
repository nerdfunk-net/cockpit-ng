"""Pydantic models for saved server search configurations."""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field

from models.servers import SearchGroup


class CreateSavedSearchRequest(BaseModel):
    """Request for saving a new server search."""

    name: str = Field(..., description="Search name")
    description: Optional[str] = Field(None, description="Search description")
    query: SearchGroup = Field(..., description="Nested boolean search query")
    scope: str = Field(default="global", description="Scope: 'global' or 'private'")
    group_path: Optional[str] = Field(
        None, description="Slash-separated group path, e.g. 'group_a/sub_b'"
    )


class UpdateSavedSearchRequest(BaseModel):
    """Request for updating a saved server search."""

    name: Optional[str] = Field(None, description="Search name")
    description: Optional[str] = Field(None, description="Search description")
    query: Optional[SearchGroup] = Field(
        None, description="Nested boolean search query"
    )
    scope: Optional[str] = Field(None, description="Scope: 'global' or 'private'")
    group_path: Optional[str] = Field(
        None, description="Slash-separated group path; null moves to root"
    )


class SavedSearchResponse(BaseModel):
    """Response model for a single saved server search."""

    id: int
    name: str
    description: Optional[str]
    query: dict
    scope: str
    group_path: Optional[str] = None
    created_by: str
    is_active: bool
    created_at: Optional[str]
    updated_at: Optional[str]


class ListSavedSearchesResponse(BaseModel):
    """Response with list of saved server searches."""

    searches: List[SavedSearchResponse]
    total: int


class SavedSearchGroupsResponse(BaseModel):
    """Response with all unique saved-search group paths."""

    groups: List[str]


class SavedSearchDeleteResponse(BaseModel):
    """Response after deleting a saved search."""

    success: bool
    message: str


class RenameSavedSearchGroupRequest(BaseModel):
    """Request body for bulk-renaming a saved-search group path."""

    old_path: str = Field(
        ..., description="Current group path to rename (must not be empty/root)"
    )
    new_name: str = Field(..., description="New name for the last segment only")


class RenameSavedSearchGroupResponse(BaseModel):
    """Response after bulk-renaming a saved-search group path."""

    updated_count: int = Field(..., description="Number of saved-search rows updated")
    new_path: str = Field(..., description="Resulting full group path after rename")
