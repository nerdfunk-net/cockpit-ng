"""
Pydantic models for job templates management
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal, Dict, Any, List
from datetime import datetime


# Valid job template types (cache_devices removed - now handled by system tasks)
JobTemplateType = Literal[
    "backup",
    "compare_devices",
    "run_commands",
    "sync_devices",
    "scan_prefixes",
    "deploy_agent",
    "ip_addresses",
    "csv_import",
    "csv_export",
    "ping_agent",
    "set_primary_ip",
]

# Inventory source options
InventorySource = Literal["all", "inventory"]


class DeployTemplateEntry(BaseModel):
    """A single template entry in a multi-template deployment."""

    template_id: int = Field(..., description="ID of the agent template to deploy")
    inventory_id: Optional[int] = Field(
        None, description="Inventory ID for this template's rendering context"
    )
    path: Optional[str] = Field(
        None,
        max_length=500,
        description="Deployment file path (overrides template default)",
    )
    custom_variables: Optional[Dict[str, Any]] = Field(
        None, description="User variable overrides for this template"
    )


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
    deploy_template_id: Optional[int] = Field(
        None,
        description="ID of the agent template to deploy (only applies to deploy_agent type)",
    )
    deploy_agent_id: Optional[str] = Field(
        None,
        max_length=255,
        description="ID of the agent to deploy to (only applies to deploy_agent type)",
    )
    deploy_path: Optional[str] = Field(
        None,
        max_length=500,
        description="File path for the deployment (only applies to deploy_agent type)",
    )
    deploy_custom_variables: Optional[Dict[str, Any]] = Field(
        None,
        description="User variable overrides for template rendering (only applies to deploy_agent type, stored as JSON)",
    )
    activate_after_deploy: bool = Field(
        True,
        description="Whether to activate (pull and restart) the agent after deployment (only applies to deploy_agent type)",
    )
    deploy_templates: Optional[List[DeployTemplateEntry]] = Field(
        None,
        description="Array of template entries for multi-template deployment (only applies to deploy_agent type)",
    )
    # Maintain IP-Addresses (ip_addresses type)
    ip_action: Optional[str] = Field(
        None,
        max_length=50,
        description="Action to perform: 'list', 'mark', or 'remove' (only applies to ip_addresses type)",
    )
    ip_filter_field: Optional[str] = Field(
        None,
        max_length=255,
        description="Nautobot field name to filter on (e.g. 'cf_last_scan') (only applies to ip_addresses type)",
    )
    ip_filter_type: Optional[str] = Field(
        None,
        max_length=50,
        description="Filter operator suffix (e.g. 'lte', 'lt', 'gte', 'gt', 'contains'). "
        "Omit or null for equality. (only applies to ip_addresses type)",
    )
    ip_filter_value: Optional[str] = Field(
        None,
        max_length=255,
        description="Value to compare against (e.g. '2026-02-19') (only applies to ip_addresses type)",
    )
    ip_include_null: bool = Field(
        False,
        description="When True, also include IPs where filter_field is null (only applies to ip_addresses type)",
    )
    # Mark action options
    ip_mark_status: Optional[str] = Field(
        None,
        max_length=255,
        description="Nautobot status UUID to apply to matching IPs (only applies when ip_action='mark')",
    )
    ip_mark_tag: Optional[str] = Field(
        None,
        max_length=255,
        description="Nautobot tag UUID to add to matching IPs (only applies when ip_action='mark')",
    )
    ip_mark_description: Optional[str] = Field(
        None,
        description="Description text to write to matching IPs (only applies when ip_action='mark')",
    )
    # CSV Import (csv_import type)
    csv_import_repo_id: Optional[int] = Field(
        None, description="Git repository ID for the CSV source (type=csv_imports)"
    )
    csv_import_file_path: Optional[str] = Field(
        None,
        max_length=500,
        description="Relative path of the CSV file in the repository",
    )
    csv_import_type: Optional[str] = Field(
        None,
        max_length=50,
        description="Object type to import: 'devices', 'ip-prefixes', 'ip-addresses'",
    )
    csv_import_primary_key: Optional[str] = Field(
        None, max_length=255, description="CSV column name used as the lookup key"
    )
    csv_import_update_existing: bool = Field(
        True, description="When True, update existing objects; when False, skip them"
    )
    csv_import_delimiter: Optional[str] = Field(
        None,
        max_length=10,
        description="CSV field delimiter (default from Nautobot settings)",
    )
    csv_import_quote_char: Optional[str] = Field(
        None,
        max_length=10,
        description="CSV quote character (default from Nautobot settings)",
    )
    csv_import_column_mapping: Optional[Dict[str, Optional[str]]] = Field(
        None,
        description="Mapping from CSV column names to Nautobot field names (null = Not Used)",
    )
    csv_import_file_filter: Optional[str] = Field(
        None,
        max_length=255,
        description="Glob pattern to select CSV files at runtime (e.g. '*.csv')",
    )
    csv_import_defaults: Optional[Dict[str, str]] = Field(
        None,
        description="Default values for mandatory fields when CSV rows are missing them (e.g. {'location': 'Amsterdam'})",
    )
    csv_import_format: Optional[str] = Field(
        None,
        max_length=50,
        description="CSV format: 'cockpit' (multi-row per device), 'nautobot' (single-row, NULL filtering), 'generic' (single-row)",
    )
    csv_import_add_prefixes: bool = Field(
        False,
        description="Automatically create missing parent IP prefixes during import",
    )
    csv_import_default_prefix_length: Optional[str] = Field(
        None,
        max_length=10,
        description="Default CIDR prefix length (e.g. '24') applied when an interface IP has no mask",
    )
    # CSV Export (csv_export type)
    csv_export_repo_id: Optional[int] = Field(
        None, description="Git repository ID for the CSV export destination (type=csv_exports)"
    )
    csv_export_file_path: Optional[str] = Field(
        None,
        max_length=500,
        description="Relative path of the CSV file in the repository (e.g. exports/devices.csv)",
    )
    csv_export_properties: Optional[List[str]] = Field(
        None,
        description="List of device properties to include in the CSV export",
    )
    csv_export_delimiter: Optional[str] = Field(
        None,
        max_length=10,
        description="CSV field delimiter (default: ',')",
    )
    csv_export_quote_char: Optional[str] = Field(
        None,
        max_length=10,
        description="CSV quote character (default: '\"')",
    )
    csv_export_include_headers: bool = Field(
        True,
        description="Whether to include a header row in the CSV export",
    )
    # Ping Agent (ping_agent type)
    ping_agent_id: Optional[str] = Field(
        None,
        max_length=255,
        description="ID of the cockpit agent to ping through (ping_agent type)",
    )
    # Set Primary IP (set_primary_ip type)
    set_primary_ip_strategy: Optional[str] = Field(
        None,
        max_length=50,
        description="Strategy for selecting primary IP: 'ip_reachable' or 'interface_name'",
    )
    set_primary_ip_agent_id: Optional[str] = Field(
        None,
        max_length=255,
        description="Cockpit agent ID used for reachability ping (set_primary_ip type)",
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
    deploy_template_id: Optional[int] = None
    deploy_agent_id: Optional[str] = Field(None, max_length=255)
    deploy_path: Optional[str] = Field(None, max_length=500)
    deploy_custom_variables: Optional[Dict[str, Any]] = None
    activate_after_deploy: Optional[bool] = None
    deploy_templates: Optional[List[DeployTemplateEntry]] = None
    ip_action: Optional[str] = Field(None, max_length=50)
    ip_filter_field: Optional[str] = Field(None, max_length=255)
    ip_filter_type: Optional[str] = Field(None, max_length=50)
    ip_filter_value: Optional[str] = Field(None, max_length=255)
    ip_include_null: Optional[bool] = None
    ip_mark_status: Optional[str] = Field(None, max_length=255)
    ip_mark_tag: Optional[str] = Field(None, max_length=255)
    ip_mark_description: Optional[str] = None
    # CSV Import
    csv_import_repo_id: Optional[int] = None
    csv_import_file_path: Optional[str] = Field(None, max_length=500)
    csv_import_type: Optional[str] = Field(None, max_length=50)
    csv_import_primary_key: Optional[str] = Field(None, max_length=255)
    csv_import_update_existing: Optional[bool] = None
    csv_import_delimiter: Optional[str] = Field(None, max_length=10)
    csv_import_quote_char: Optional[str] = Field(None, max_length=10)
    csv_import_column_mapping: Optional[Dict[str, Optional[str]]] = None
    csv_import_file_filter: Optional[str] = Field(None, max_length=255)
    csv_import_defaults: Optional[Dict[str, str]] = None
    csv_import_format: Optional[str] = Field(None, max_length=50)
    csv_import_add_prefixes: Optional[bool] = None
    csv_import_default_prefix_length: Optional[str] = Field(None, max_length=10)
    # CSV Export
    csv_export_repo_id: Optional[int] = None
    csv_export_file_path: Optional[str] = Field(None, max_length=500)
    csv_export_properties: Optional[List[str]] = None
    csv_export_delimiter: Optional[str] = Field(None, max_length=10)
    csv_export_quote_char: Optional[str] = Field(None, max_length=10)
    csv_export_include_headers: Optional[bool] = None
    # Ping Agent
    ping_agent_id: Optional[str] = Field(None, max_length=255)
    # Set Primary IP
    set_primary_ip_strategy: Optional[str] = Field(None, max_length=50)
    set_primary_ip_agent_id: Optional[str] = Field(None, max_length=255)
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
