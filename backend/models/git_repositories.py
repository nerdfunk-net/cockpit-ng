"""
Git repository management models.
"""

from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class GitCategory(str, Enum):
    """Git repository categories."""

    CONFIGS = "device_configs"
    COCKPIT_CONFIGS = "cockpit_configs"
    TEMPLATES = "templates"
    AGENT = "agent"


class GitAuthType(str, Enum):
    """Git authentication types."""

    NONE = "none"
    TOKEN = "token"
    SSH_KEY = "ssh_key"
    GENERIC = "generic"


class GitRepositoryRequest(BaseModel):
    """Git repository creation/update request model."""

    name: str = Field(..., description="Unique repository name")
    category: GitCategory = Field(..., description="Repository category")
    url: str = Field(..., description="Git repository URL")
    branch: str = Field(default="main", description="Default branch")
    auth_type: GitAuthType = Field(
        default=GitAuthType.TOKEN,
        description="Authentication type (none, token, ssh_key, generic)",
    )
    credential_name: Optional[str] = Field(
        None, description="Name of stored credential to use (token or ssh_key)"
    )
    path: Optional[str] = Field(None, description="Path within repository")
    verify_ssl: bool = Field(default=True, description="Verify SSL certificates")
    git_author_name: Optional[str] = Field(
        None, description="Git author name for commits"
    )
    git_author_email: Optional[str] = Field(
        None, description="Git author email for commits"
    )
    description: Optional[str] = Field(None, description="Repository description")
    is_active: bool = Field(default=True, description="Repository is active")


class GitRepositoryResponse(BaseModel):
    """Git repository response model."""

    id: int
    name: str
    category: GitCategory
    url: str
    branch: str
    auth_type: Optional[str] = "token"
    credential_name: Optional[str] = None
    path: Optional[str] = None
    verify_ssl: bool
    git_author_name: Optional[str] = None
    git_author_email: Optional[str] = None
    description: Optional[str] = None
    is_active: bool

    # Timestamps
    created_at: str
    updated_at: str
    last_sync: Optional[str] = None

    # Sync status
    sync_status: Optional[str] = None


class GitRepositoryListResponse(BaseModel):
    """Git repository list response model."""

    repositories: List[GitRepositoryResponse]
    total: int


class GitRepositoryUpdateRequest(BaseModel):
    """Git repository update request model for partial updates."""

    name: Optional[str] = Field(None, description="Repository name")
    category: Optional[GitCategory] = Field(None, description="Repository category")
    url: Optional[str] = Field(None, description="Repository URL")
    branch: Optional[str] = Field(None, description="Default branch")
    auth_type: Optional[GitAuthType] = Field(
        None, description="Authentication type (none, token, ssh_key, generic)"
    )
    credential_name: Optional[str] = Field(
        None, description="Name of stored credential to use (token or ssh_key)"
    )
    path: Optional[str] = Field(None, description="Path within repository")
    verify_ssl: Optional[bool] = Field(None, description="Verify SSL certificates")
    git_author_name: Optional[str] = Field(
        None, description="Git author name for commits"
    )
    git_author_email: Optional[str] = Field(
        None, description="Git author email for commits"
    )
    description: Optional[str] = Field(None, description="Repository description")
    is_active: Optional[bool] = Field(None, description="Repository is active")


class GitConnectionTestRequest(BaseModel):
    """Git connection test request model."""

    url: str
    branch: str = "main"
    auth_type: GitAuthType = GitAuthType.TOKEN
    username: Optional[str] = None
    token: Optional[str] = None
    credential_name: Optional[str] = None
    verify_ssl: bool = True


class GitConnectionTestResponse(BaseModel):
    """Git connection test response model."""

    success: bool
    message: str
    details: Optional[dict] = None


class GitSyncRequest(BaseModel):
    """Git repository sync request model."""

    repository_id: Optional[int] = Field(
        None, description="Specific repository ID to sync, or None for all"
    )


class GitSyncResponse(BaseModel):
    """Git repository sync response model."""

    synced_repositories: List[int]
    failed_repositories: List[int]
    errors: dict
    message: str
