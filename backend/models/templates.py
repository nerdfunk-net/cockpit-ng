"""
Template-related Pydantic models.
"""

from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum


class TemplateSource(str, Enum):
    """Template source types."""
    GIT = "git"
    FILE = "file" 
    WEBEDITOR = "webeditor"


class TemplateType(str, Enum):
    """Template content types."""
    JINJA2 = "jinja2"
    TEXT = "text"
    YAML = "yaml"
    JSON = "json"
    TEXTFSM = "textfsm"


class TemplateRequest(BaseModel):
    """Template creation/update request model."""
    name: str = Field(..., description="Unique template name")
    source: TemplateSource = Field(..., description="Template source type")
    template_type: TemplateType = Field(default=TemplateType.JINJA2, description="Template content type")
    category: Optional[str] = Field(None, description="Template category for organization")
    description: Optional[str] = Field(None, description="Template description")

    # Git-specific fields
    git_repo_url: Optional[str] = Field(None, description="Git repository URL")
    git_branch: Optional[str] = Field(default="main", description="Git branch")
    git_username: Optional[str] = Field(None, description="Git username")
    git_token: Optional[str] = Field(None, description="Git personal access token")
    git_path: Optional[str] = Field(None, description="Path to template file in repository")
    git_verify_ssl: Optional[bool] = Field(default=True, description="Verify SSL certificates")

    # File/WebEditor-specific fields
    content: Optional[str] = Field(None, description="Template content")
    filename: Optional[str] = Field(None, description="Original filename for uploaded files")

    # Metadata
    variables: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Template variables")
    tags: Optional[List[str]] = Field(default_factory=list, description="Template tags")


class TemplateResponse(BaseModel):
    """Template response model."""
    id: int
    name: str
    source: TemplateSource
    template_type: TemplateType
    category: Optional[str]
    description: Optional[str]

    # Git-specific fields
    git_repo_url: Optional[str]
    git_branch: Optional[str]
    git_username: Optional[str]
    git_path: Optional[str]
    git_verify_ssl: Optional[bool]

    # File/WebEditor-specific fields
    content: Optional[str]
    filename: Optional[str]

    # Metadata
    variables: Dict[str, Any]
    tags: List[str]

    # Timestamps
    created_at: str
    updated_at: str

    # Status
    is_active: bool
    last_sync: Optional[str]
    sync_status: Optional[str]


class TemplateListResponse(BaseModel):
    """Template list response model."""
    templates: List[TemplateResponse]
    total: int


class TemplateContentRequest(BaseModel):
    """Template content request model."""
    template_id: int
    variables: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Variables to render template")


class TemplateContentResponse(BaseModel):
    """Template content response model."""
    template_id: int
    template_name: str
    rendered_content: str
    variables_used: List[str]


class TemplateGitTestRequest(BaseModel):
    """Git connection test request for templates."""
    repo_url: str
    branch: str = "main"
    username: Optional[str] = ""
    token: Optional[str] = ""
    verify_ssl: bool = True
    path: Optional[str] = None


class TemplateSyncRequest(BaseModel):
    """Template sync request model."""
    template_id: Optional[int] = Field(None, description="Specific template ID to sync, or None for all Git templates")


class TemplateSyncResponse(BaseModel):
    """Template sync response model."""
    synced_templates: List[int]
    failed_templates: List[int]
    errors: Dict[str, str]
    message: str


class TemplateImportRequest(BaseModel):
    """Template import request model."""
    source_type: str = Field(..., description="Import source type: 'git_bulk', 'file_bulk'")

    # Git bulk import
    git_repo_url: Optional[str] = None
    git_branch: Optional[str] = "main"
    git_username: Optional[str] = None
    git_token: Optional[str] = None
    git_templates_path: Optional[str] = "templates/"
    git_verify_ssl: Optional[bool] = True

    # File bulk import
    file_contents: Optional[List[Dict[str, str]]] = None  # [{"filename": "...", "content": "..."}]

    # Common settings
    default_category: Optional[str] = None
    default_template_type: TemplateType = TemplateType.JINJA2
    overwrite_existing: bool = False


class TemplateImportResponse(BaseModel):
    """Template import response model."""
    imported_templates: List[str]
    skipped_templates: List[str] 
    failed_templates: List[str]
    errors: Dict[str, str]
    total_processed: int
    message: str


class TemplateUpdateRequest(BaseModel):
    """Template update request model for partial updates."""
    name: Optional[str] = Field(None, description="Template name")
    category: Optional[str] = Field(None, description="Template category")
    description: Optional[str] = Field(None, description="Template description")
    content: Optional[str] = Field(None, description="Template content")
    template_type: Optional[TemplateType] = Field(None, description="Template content type")

    # Metadata
    variables: Optional[Dict[str, Any]] = Field(None, description="Template variables")
    tags: Optional[List[str]] = Field(None, description="Template tags")
