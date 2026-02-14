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


class TemplateScope(str, Enum):
    """Template scope types."""

    GLOBAL = "global"
    PRIVATE = "private"


class TemplateRequest(BaseModel):
    """Template creation/update request model."""

    name: str = Field(..., description="Unique template name")
    source: TemplateSource = Field(..., description="Template source type")
    template_type: TemplateType = Field(
        default=TemplateType.JINJA2, description="Template content type"
    )
    category: Optional[str] = Field(
        None, description="Template category for organization"
    )
    description: Optional[str] = Field(None, description="Template description")

    # File/WebEditor-specific fields
    content: Optional[str] = Field(None, description="Template content")
    filename: Optional[str] = Field(
        None, description="Original filename for uploaded files"
    )

    # Ownership and scope
    scope: TemplateScope = Field(
        default=TemplateScope.GLOBAL, description="Template scope (global or private)"
    )

    # Metadata
    variables: Optional[Dict[str, Any]] = Field(
        default_factory=dict, description="Template variables"
    )
    tags: Optional[List[str]] = Field(default_factory=list, description="Template tags")
    use_nautobot_context: Optional[bool] = Field(
        default=False, description="Whether to use Nautobot context when rendering"
    )
    pass_snmp_mapping: Optional[bool] = Field(
        default=False, description="Whether to include SNMP mapping in context (agent templates)"
    )
    inventory_id: Optional[int] = Field(
        None, description="ID of saved inventory to use for agent templates"
    )
    pre_run_command: Optional[str] = Field(
        None,
        description="Command to execute on device before rendering. Output is parsed with TextFSM and available as context.",
    )
    credential_id: Optional[int] = Field(
        None, description="ID of stored credential to use for pre-run command execution"
    )
    execution_mode: Optional[str] = Field(
        default="run_on_device",
        description="Execution mode: 'run_on_device', 'write_to_file', 'sync_to_nautobot'",
    )
    file_path: Optional[str] = Field(
        None,
        description="File path when execution_mode is 'write_to_file', supports variables like {device_name}, {template_name}",
    )


class TemplateResponse(BaseModel):
    """Template response model."""

    id: int
    name: str
    source: TemplateSource
    template_type: TemplateType
    category: Optional[str]
    description: Optional[str]

    # File/WebEditor-specific fields
    content: Optional[str]
    filename: Optional[str]

    # Ownership and scope
    created_by: Optional[str]
    scope: TemplateScope

    # Metadata
    variables: Dict[str, Any]
    tags: List[str]
    use_nautobot_context: bool
    pass_snmp_mapping: bool = False
    inventory_id: Optional[int] = None
    pre_run_command: Optional[str] = None
    credential_id: Optional[int] = None
    execution_mode: Optional[str] = None
    file_path: Optional[str] = None

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
    variables: Optional[Dict[str, Any]] = Field(
        default_factory=dict, description="Variables to render template"
    )


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

    template_id: Optional[int] = Field(
        None, description="Specific template ID to sync, or None for all Git templates"
    )


class TemplateSyncResponse(BaseModel):
    """Template sync response model."""

    synced_templates: List[int]
    failed_templates: List[int]
    errors: Dict[str, str]
    message: str


class ImportableTemplateInfo(BaseModel):
    """Information about an importable template file."""

    name: str = Field(..., description="Template name")
    description: str = Field(..., description="Template description")
    category: str = Field(..., description="Template category")
    source: str = Field(..., description="Template source")
    file_path: str = Field(..., description="Path to the template file")
    template_type: str = Field(default="jinja2", description="Template type")


class TemplateScanImportResponse(BaseModel):
    """Response model for template scan import operation."""

    templates: List[ImportableTemplateInfo] = Field(
        ..., description="List of importable templates found"
    )
    total_found: int = Field(..., description="Total number of templates found")
    message: str = Field(..., description="Status message")


class TemplateImportRequest(BaseModel):
    """Template import request model."""

    source_type: str = Field(
        ..., description="Import source type: 'git_bulk', 'file_bulk', 'yaml_bulk'"
    )

    # Git bulk import
    git_repo_url: Optional[str] = None
    git_branch: Optional[str] = "main"
    git_username: Optional[str] = None
    git_token: Optional[str] = None
    git_templates_path: Optional[str] = "templates/"
    git_verify_ssl: Optional[bool] = True

    # File bulk import
    file_contents: Optional[List[Dict[str, str]]] = (
        None  # [{"filename": "...", "content": "..."}]
    )

    # YAML bulk import
    yaml_file_paths: Optional[List[str]] = None  # List of YAML file paths to import

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
    template_type: Optional[TemplateType] = Field(
        None, description="Template content type"
    )
    scope: Optional[TemplateScope] = Field(None, description="Template scope")

    # Metadata
    variables: Optional[Dict[str, Any]] = Field(None, description="Template variables")
    tags: Optional[List[str]] = Field(None, description="Template tags")
    use_nautobot_context: Optional[bool] = Field(
        None, description="Whether to use Nautobot context when rendering"
    )
    pass_snmp_mapping: Optional[bool] = Field(
        None, description="Whether to include SNMP mapping in context (agent templates)"
    )
    inventory_id: Optional[int] = Field(
        None, description="ID of saved inventory to use for agent templates"
    )
    pre_run_command: Optional[str] = Field(
        None,
        description="Command to execute on device before rendering. Output is parsed with TextFSM and available as context.",
    )
    credential_id: Optional[int] = Field(
        None, description="ID of stored credential to use for pre-run command execution"
    )
    execution_mode: Optional[str] = Field(
        None,
        description="Execution mode: 'run_on_device', 'write_to_file', 'sync_to_nautobot'",
    )
    file_path: Optional[str] = Field(
        None,
        description="File path when execution_mode is 'write_to_file', supports variables like {device_name}, {template_name}",
    )


class TemplateExecuteAndSyncRequest(BaseModel):
    """Request model for executing template and syncing to Nautobot."""

    template_id: int = Field(..., description="Template ID to execute")
    device_ids: List[str] = Field(..., description="List of device UUIDs to update")
    user_variables: Optional[Dict[str, Any]] = Field(
        default_factory=dict, description="User-provided variables for template"
    )
    dry_run: bool = Field(
        default=False, description="If True, validate without making changes"
    )
    output_format: str = Field(
        default="json",
        description="Expected output format: 'json', 'yaml', or 'text'",
    )


class TemplateExecuteAndSyncResponse(BaseModel):
    """Response model for execute-and-sync operation."""

    success: bool = Field(..., description="Whether the operation succeeded")
    message: str = Field(..., description="Summary message")
    task_id: Optional[str] = Field(
        None, description="Celery task ID for tracking the update job"
    )
    job_id: Optional[str] = Field(None, description="Job ID for tracking in Jobs/Views")
    rendered_outputs: Optional[Dict[str, str]] = Field(
        None, description="Map of device_id to rendered template output"
    )
    parsed_updates: Optional[List[Dict[str, Any]]] = Field(
        None, description="Parsed device update objects that will be sent to Nautobot"
    )
    errors: Optional[List[str]] = Field(
        default_factory=list, description="List of errors encountered"
    )
    warnings: Optional[List[str]] = Field(
        default_factory=list, description="List of warnings"
    )


class AdvancedTemplateRenderRequest(BaseModel):
    """
    Unified advanced template render request for both netmiko and agent templates.

    This model supports all features needed for both template types:
    - For netmiko: device context, pre-run commands, credentials
    - For agent: inventory context, SNMP mapping, deployment path
    """

    # Template content (required)
    template_content: str = Field(..., description="Template content to render")
    category: str = Field(..., description="Template category (netmiko or agent)")

    # User variables (common to both)
    user_variables: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="User-provided custom variables (should NOT include pre_run.raw or pre_run.parsed)",
    )

    # Netmiko-specific fields
    device_id: Optional[str] = Field(
        None, description="Device UUID for Nautobot context (netmiko templates)"
    )
    use_nautobot_context: bool = Field(
        default=True, description="Whether to include Nautobot device context"
    )
    pre_run_command: Optional[str] = Field(
        None,
        description="Command to execute on device before rendering (netmiko templates). Backend will execute and parse this.",
    )
    credential_id: Optional[int] = Field(
        None, description="Credential ID for device authentication (netmiko templates)"
    )

    # Agent-specific fields
    inventory_id: Optional[int] = Field(
        None, description="Inventory ID to fetch devices from (agent templates)"
    )
    pass_snmp_mapping: bool = Field(
        default=False, description="Whether to include SNMP mapping (agent templates)"
    )
    path: Optional[str] = Field(
        None, description="Deployment file path (agent templates)"
    )


class AdvancedTemplateRenderResponse(BaseModel):
    """Unified response model for advanced template rendering."""

    rendered_content: str = Field(..., description="The rendered template output")
    variables_used: List[str] = Field(
        ..., description="List of variables referenced in the template"
    )
    context_data: Optional[Dict[str, Any]] = Field(
        None, description="Full context used for rendering (for debugging)"
    )
    warnings: Optional[List[str]] = Field(
        default_factory=list, description="Non-fatal warnings during rendering"
    )
    pre_run_output: Optional[str] = Field(
        None, description="Raw output from pre-run command (netmiko only, if executed)"
    )
    pre_run_parsed: Optional[List[Dict[str, Any]]] = Field(
        None,
        description="TextFSM parsed output from pre-run command (netmiko only, if available)",
    )
