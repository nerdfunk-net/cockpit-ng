"""
Pydantic models for Celery task management API.
"""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any


# ============================================================================
# Shared Task Response Models
# ============================================================================


class TaskResponse(BaseModel):
    task_id: str
    status: str
    message: str


class TaskWithJobResponse(BaseModel):
    """Response model for tasks that are tracked in the job database."""

    task_id: str
    job_id: Optional[str] = None  # Job ID for tracking in Jobs/Views
    status: str
    message: str


class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    result: Optional[dict] = None
    error: Optional[str] = None
    progress: Optional[dict] = None


# ============================================================================
# Celery Admin / Test Models
# ============================================================================


class TestTaskRequest(BaseModel):
    message: str = "Hello from Celery!"


class ProgressTaskRequest(BaseModel):
    duration: int = 10


class CeleryQueue(BaseModel):
    """
    Celery queue configuration.

    Fields:
        name: Queue name (e.g., "default", "backup", "network", "heavy")
        description: Human-readable description of queue purpose
        built_in: True for hardcoded queues (cannot be deleted), False for custom queues
    """

    name: str
    description: str = ""
    built_in: bool = False  # Built-in queues are hardcoded in celery_app.py


class CelerySettingsRequest(BaseModel):
    max_workers: Optional[int] = None
    cleanup_enabled: Optional[bool] = None
    cleanup_interval_hours: Optional[int] = None
    cleanup_age_hours: Optional[int] = None
    result_expires_hours: Optional[int] = None
    queues: Optional[List[CeleryQueue]] = None


# ============================================================================
# Device Onboarding Models
# ============================================================================


class OnboardDeviceRequest(BaseModel):
    ip_address: str
    location_id: str
    role_id: str
    namespace_id: str
    status_id: str
    interface_status_id: str
    ip_address_status_id: str
    prefix_status_id: str
    secret_groups_id: str
    platform_id: str
    port: int = 22
    timeout: int = 30
    onboarding_timeout: int = 120
    sync_options: List[str] = ["cables", "software", "vlans", "vrfs"]
    tags: Optional[List[str]] = None
    custom_fields: Optional[Dict[str, str]] = None


class BulkOnboardDeviceConfig(BaseModel):
    """Configuration for a single device in bulk onboarding."""

    ip_address: str
    location_id: Optional[str] = None
    namespace_id: Optional[str] = None
    role_id: Optional[str] = None
    status_id: Optional[str] = None
    interface_status_id: Optional[str] = None
    ip_address_status_id: Optional[str] = None
    prefix_status_id: Optional[str] = None
    secret_groups_id: Optional[str] = None
    platform_id: Optional[str] = None
    port: Optional[int] = None
    timeout: Optional[int] = None
    tags: Optional[List[str]] = None
    custom_fields: Optional[Dict[str, str]] = None


class BulkOnboardDevicesRequest(BaseModel):
    """Request model for bulk device onboarding from CSV."""

    devices: List[BulkOnboardDeviceConfig]
    default_config: Dict  # Default values for missing device-specific fields
    parallel_jobs: Optional[int] = (
        1  # Number of parallel jobs to create (default: 1 = sequential)
    )


# ============================================================================
# Device Export / Import / Update Models
# ============================================================================


class ExportDevicesRequest(BaseModel):
    device_ids: List[str]
    properties: List[str]
    export_format: str = "yaml"  # "yaml" or "csv"
    csv_options: Optional[Dict[str, str]] = None


class PreviewExportRequest(BaseModel):
    """Request model for previewing export data."""

    device_ids: List[str]
    properties: List[str]
    max_devices: int = 5
    export_format: str = "yaml"  # "yaml" or "csv"
    csv_options: Optional[Dict[str, str]] = None


class PreviewExportResponse(BaseModel):
    """Response model for preview data."""

    success: bool
    preview_content: str  # The actual CSV/YAML preview content
    total_devices: int
    previewed_devices: int
    message: Optional[str] = None


class UpdateDevicesRequest(BaseModel):
    """Request model for updating devices from CSV."""

    csv_content: str
    csv_options: Optional[Dict[str, str]] = None
    dry_run: bool = False


class UpdateDevicesJSONRequest(BaseModel):
    """Request model for updating devices from JSON list."""

    devices: List[Dict[str, Any]]
    dry_run: bool = False


class ImportDevicesRequest(BaseModel):
    """Request model for importing devices from CSV."""

    csv_content: str
    csv_options: Optional[Dict[str, str]] = None
    import_options: Optional[Dict[str, Any]] = None


class UpdateIPPrefixesRequest(BaseModel):
    """Request model for updating IP prefixes from CSV."""

    csv_content: str
    csv_options: Optional[Dict[str, str]] = None
    dry_run: bool = False
    ignore_uuid: bool = True  # Default: use prefix+namespace lookup instead of UUID
    tags_mode: str = "replace"  # How to handle tags: "replace" or "merge"
    column_mapping: Optional[Dict[str, str]] = (
        None  # Maps lookup fields to CSV column names
    )
    selected_columns: Optional[List[str]] = (
        None  # List of CSV columns to update (if None, all non-excluded columns are updated)
    )


class UpdateIPAddressesRequest(BaseModel):
    """Request model for updating IP addresses from CSV."""

    csv_content: str
    csv_options: Optional[Dict[str, str]] = None
    dry_run: bool = False
    ignore_uuid: bool = True  # Default: use address+namespace lookup instead of UUID
    tags_mode: str = "replace"  # How to handle tags: "replace" or "merge"
    column_mapping: Optional[Dict[str, str]] = (
        None  # Maps lookup fields to CSV column names
    )
    selected_columns: Optional[List[str]] = (
        None  # List of CSV columns to update (if None, all non-excluded columns are updated)
    )


# ============================================================================
# Device Backup Status Models
# ============================================================================


class DeviceBackupStatus(BaseModel):
    device_id: str
    device_name: str
    last_backup_success: bool
    last_backup_time: Optional[str] = None
    total_successful_backups: int
    total_failed_backups: int
    last_error: Optional[str] = None


class BackupCheckResponse(BaseModel):
    total_devices: int
    devices_with_successful_backup: int
    devices_with_failed_backup: int
    devices_never_backed_up: int
    devices: List[DeviceBackupStatus]


# ============================================================================
# Backup / Deploy Agent Models
# ============================================================================


class BackupDevicesRequest(BaseModel):
    inventory: List[str]
    config_repository_id: Optional[int] = None
    credential_id: Optional[int] = None
    write_timestamp_to_custom_field: Optional[bool] = False
    timestamp_custom_field_name: Optional[str] = None
    parallel_tasks: int = 1


class DeployTemplateEntryRequest(BaseModel):
    """A single template entry in a multi-template deployment request."""

    template_id: int
    inventory_id: Optional[int] = None
    path: Optional[str] = None
    custom_variables: Optional[Dict[str, Any]] = None


class DeployAgentRequest(BaseModel):
    """Request model for agent deployment to git."""

    template_id: Optional[int] = None  # Legacy single-template field
    custom_variables: Optional[Dict[str, Any]] = None
    agent_id: str
    path: Optional[str] = None
    inventory_id: Optional[int] = None
    activate_after_deploy: Optional[bool] = None  # If None, read from template
    template_entries: Optional[List[DeployTemplateEntryRequest]] = None  # Multi-template entries


# ============================================================================
# CheckMK Sync Models
# ============================================================================


class SyncDevicesToCheckmkRequest(BaseModel):
    device_ids: List[str]
    activate_changes_after_sync: bool = True


# ============================================================================
# Network Scan Models
# ============================================================================


class PingNetworkRequest(BaseModel):
    cidrs: List[str]
    resolve_dns: bool = False
    count: int = 3
    timeout: int = 500
    retry: int = 3
    interval: int = 10


class ScanPrefixesRequest(BaseModel):
    custom_field_name: str
    custom_field_value: str
    response_custom_field_name: Optional[str] = None
    resolve_dns: bool = False
    ping_count: int = 3
    timeout_ms: int = 500
    retries: int = 3
    interval_ms: int = 10


class IPAddressesTaskRequest(BaseModel):
    action: str  # "list" or "delete"
    filter_field: str  # e.g. "cf_last_scan", "address", "status"
    filter_value: str  # e.g. "2026-02-19"
    filter_type: Optional[str] = None  # e.g. "lte", "lt", "gte", "gt", "contains", or None for equality
    include_null: bool = False  # When True, also include IPs where filter_field is null (never set)
