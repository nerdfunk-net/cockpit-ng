"""
Pydantic models for job templates management
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


# Valid job template types (cache_devices removed - now handled by system tasks)
JobTemplateType = Literal[
    "backup", "compare_devices", "run_commands", "sync_devices", "scan_prefixes"
]

# Inventory source options
InventorySource = Literal["all", "inventory"]


class JobTemplateBase(BaseModel):
    """Base model for job templates"""

    name: str = Field(
        ..., min_length=1, max_length=255, description="Name of the job template"
    )
    job_type: JobTemplateType = Field(
        ..., description="Type of job this template represents"
    )
    description: Optional[str] = Field(
        None, max_length=1000, description="Description of what this template does"
    )
    config_repository_id: Optional[int] = Field(
        None, description="Git repository ID for configuration (type=config)"
    )
    inventory_source: InventorySource = Field(
        "all", description="Whether to use all devices or a stored inventory"
    )
    inventory_repository_id: Optional[int] = Field(
        None,
        description="Git repository ID for inventory (when inventory_source='inventory')",
    )
    inventory_name: Optional[str] = Field(
        None, description="Name of the stored inventory to use"
    )
    command_template_name: Optional[str] = Field(
        None,
        description="Name of the command template to execute (for run_commands type)",
    )
    backup_running_config_path: Optional[str] = Field(
        None,
        max_length=500,
        description="Path template for running config backups (supports Nautobot variables like {device_name}, {location.name})",
    )
    backup_startup_config_path: Optional[str] = Field(
        None,
        max_length=500,
        description="Path template for startup config backups (supports Nautobot variables like {device_name}, {location.name})",
    )
    write_timestamp_to_custom_field: bool = Field(
        False,
        description="Whether to write backup completion timestamp to a Nautobot custom field (only applies to backup type)",
    )
    timestamp_custom_field_name: Optional[str] = Field(
        None,
        max_length=255,
        description="Name of the Nautobot custom field to write the backup timestamp to",
    )
    activate_changes_after_sync: bool = Field(
        True,
        description="Whether to activate CheckMK changes after sync_devices job completes (only applies to sync_devices type)",
    )
    scan_resolve_dns: bool = Field(
        False,
        description="Whether to resolve DNS names during network scanning (only applies to scan_prefixes type)",
    )
    scan_ping_count: Optional[int] = Field(
        None,
        ge=1,
        le=10,
        description="Number of ping attempts for each host (only applies to scan_prefixes type)",
    )
    scan_timeout_ms: Optional[int] = Field(
        None,
        ge=100,
        le=30000,
        description="Timeout in milliseconds for network operations (only applies to scan_prefixes type)",
    )
    scan_retries: Optional[int] = Field(
        None,
        ge=0,
        le=5,
        description="Number of retry attempts for failed operations (only applies to scan_prefixes type)",
    )
    scan_interval_ms: Optional[int] = Field(
        None,
        ge=0,
        le=10000,
        description="Interval in milliseconds between scan operations (only applies to scan_prefixes type)",
    )
    scan_custom_field_name: Optional[str] = Field(
        None,
        max_length=255,
        description="Name of the custom field to use for prefix selection (only applies to scan_prefixes type)",
    )
    scan_custom_field_value: Optional[str] = Field(
        None,
        max_length=255,
        description="Value of the custom field to filter prefixes (only applies to scan_prefixes type)",
    )
    scan_response_custom_field_name: Optional[str] = Field(
        None,
        max_length=255,
        description="Name of the custom field to write scan results to (only applies to scan_prefixes type)",
    )
    scan_set_reachable_ip_active: Optional[bool] = Field(
        True,
        description="Whether to set reachable IP addresses to Active status (only applies to scan_prefixes type)",
    )
    scan_max_ips: Optional[int] = Field(
        None,
        ge=1,
        description="Maximum number of IPs to scan per job (only applies to scan_prefixes type)",
    )
    parallel_tasks: int = Field(
        1,
        ge=1,
        le=50,
        description="Number of parallel tasks for backup execution (only applies to backup type, default=1 for sequential)",
    )
    is_global: bool = Field(
        False,
        description="Whether this template is global (available to all users) or private",
    )


class JobTemplateCreate(JobTemplateBase):
    """Model for creating a new job template"""

    pass


class JobTemplateUpdate(BaseModel):
    """Model for updating a job template"""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    config_repository_id: Optional[int] = None
    inventory_source: Optional[InventorySource] = None
    inventory_repository_id: Optional[int] = None
    inventory_name: Optional[str] = None
    command_template_name: Optional[str] = None
    backup_running_config_path: Optional[str] = Field(None, max_length=500)
    backup_startup_config_path: Optional[str] = Field(None, max_length=500)
    write_timestamp_to_custom_field: Optional[bool] = None
    timestamp_custom_field_name: Optional[str] = Field(None, max_length=255)
    activate_changes_after_sync: Optional[bool] = None
    scan_resolve_dns: Optional[bool] = None
    scan_ping_count: Optional[int] = Field(None, ge=1, le=10)
    scan_timeout_ms: Optional[int] = Field(None, ge=100, le=30000)
    scan_retries: Optional[int] = Field(None, ge=0, le=5)
    scan_interval_ms: Optional[int] = Field(None, ge=0, le=10000)
    scan_custom_field_name: Optional[str] = Field(None, max_length=255)
    scan_custom_field_value: Optional[str] = Field(None, max_length=255)
    scan_response_custom_field_name: Optional[str] = Field(None, max_length=255)
    scan_set_reachable_ip_active: Optional[bool] = None
    scan_max_ips: Optional[int] = Field(None, ge=1)
    parallel_tasks: Optional[int] = Field(None, ge=1, le=50)
    is_global: Optional[bool] = None


class JobTemplateResponse(JobTemplateBase):
    """Model for job template response"""

    id: int
    user_id: Optional[int] = None
    created_by: Optional[str] = Field(None, description="Username of the creator")
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class JobTemplateListResponse(BaseModel):
    """Response model for listing job templates"""

    templates: list[JobTemplateResponse]
    total: int
