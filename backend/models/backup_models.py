"""
Backup Models

Pydantic models for device backup operations.
Provides type safety, validation, and structured data for backup tasks.
"""

from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


class DeviceBackupInfo(BaseModel):
    """
    Information about a device backup operation.

    Tracks the status and results of backing up a single device,
    including success/failure states and configuration details.
    """

    device_id: str = Field(..., description="Device UUID from Nautobot")
    device_name: Optional[str] = Field(None, description="Device hostname")
    device_ip: Optional[str] = Field(None, description="Device primary IP address")
    platform: Optional[str] = Field(
        None, description="Device platform (e.g., 'Cisco IOS')"
    )

    # Success flags
    nautobot_fetch_success: bool = Field(
        default=False,
        description="Whether device data was successfully fetched from Nautobot",
    )
    ssh_connection_success: bool = Field(
        default=False, description="Whether SSH connection to device succeeded"
    )
    running_config_success: bool = Field(
        default=False, description="Whether running config was successfully retrieved"
    )
    startup_config_success: bool = Field(
        default=False, description="Whether startup config was successfully retrieved"
    )

    # Configuration details
    running_config_bytes: int = Field(
        default=0, description="Size of running configuration in bytes"
    )
    startup_config_bytes: int = Field(
        default=0, description="Size of startup configuration in bytes"
    )

    # File paths (relative to repository root)
    running_config_file: Optional[str] = Field(
        None, description="Path to saved running config file"
    )
    startup_config_file: Optional[str] = Field(
        None, description="Path to saved startup config file"
    )

    # Error information
    error: Optional[str] = Field(None, description="Error message if backup failed")

    def is_successful(self) -> bool:
        """Check if backup was successful."""
        return self.error is None and self.running_config_success

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return self.model_dump()


class GitStatus(BaseModel):
    """
    Git repository status and operations tracking.

    Tracks the state of Git operations during backup process.
    """

    repository_existed: bool = Field(
        default=False, description="Whether repository existed locally before operation"
    )
    operation: Optional[str] = Field(
        None,
        description="Git operation performed: 'cloned', 'pulled', 'opened', 'recloned'",
    )
    repository_path: Optional[str] = Field(
        None, description="Local filesystem path to repository"
    )
    repository_url: Optional[str] = Field(None, description="Remote repository URL")
    branch: Optional[str] = Field(None, description="Git branch used for backup")
    commit_error: Optional[str] = Field(
        None, description="Error message if commit/push failed"
    )


class CredentialInfo(BaseModel):
    """
    Credential information for device authentication.

    Tracks which credentials were used for device backup.
    """

    credential_id: Optional[int] = Field(
        None, description="Credential ID from database"
    )
    credential_name: Optional[str] = Field(None, description="Credential name/label")
    username: Optional[str] = Field(
        None, description="SSH username used for device authentication"
    )


class GitCommitStatus(BaseModel):
    """
    Git commit and push status.

    Tracks the results of Git commit and push operations.
    """

    committed: bool = Field(
        default=False, description="Whether changes were committed to Git"
    )
    pushed: bool = Field(
        default=False, description="Whether changes were pushed to remote"
    )
    commit_hash: Optional[str] = Field(
        None, description="Short commit hash (first 8 characters)"
    )
    files_changed: int = Field(
        default=0, description="Number of files changed in commit"
    )


class TimestampUpdateStatus(BaseModel):
    """
    Nautobot custom field timestamp update status.

    Tracks updates to device custom fields with backup timestamps.
    """

    enabled: bool = Field(
        default=False, description="Whether timestamp updates were enabled"
    )
    custom_field_name: Optional[str] = Field(
        None, description="Name of custom field to update"
    )
    updated_count: int = Field(
        default=0, description="Number of devices successfully updated"
    )
    failed_count: int = Field(
        default=0, description="Number of devices that failed to update"
    )
    errors: list[str] = Field(
        default_factory=list, description="List of error messages from failed updates"
    )


class BackupResult(BaseModel):
    """
    Complete backup operation result.

    Aggregates all information about a backup task execution.
    """

    success: bool = Field(..., description="Overall success status of backup operation")
    backed_up_count: int = Field(
        default=0, description="Number of devices successfully backed up"
    )
    failed_count: int = Field(default=0, description="Number of devices that failed")
    backed_up_devices: list[dict] = Field(
        default_factory=list, description="List of successfully backed up devices"
    )
    failed_devices: list[dict] = Field(
        default_factory=list, description="List of failed device backups"
    )
    git_status: GitStatus = Field(
        default_factory=GitStatus, description="Git repository status"
    )
    git_commit_status: GitCommitStatus = Field(
        default_factory=GitCommitStatus, description="Git commit/push status"
    )
    credential_info: CredentialInfo = Field(
        default_factory=CredentialInfo, description="Credential information used"
    )
    timestamp_update_status: TimestampUpdateStatus = Field(
        default_factory=TimestampUpdateStatus,
        description="Nautobot timestamp update status",
    )
    repository: Optional[str] = Field(None, description="Repository name")
    commit_date: Optional[str] = Field(None, description="Backup commit timestamp")
    error: Optional[str] = Field(
        None, description="Overall error message if backup failed"
    )

    # Backward compatibility fields
    devices_backed_up: Optional[int] = Field(
        None, description="Alias for backed_up_count (UI compatibility)"
    )
    devices_failed: Optional[int] = Field(
        None, description="Alias for failed_count (UI compatibility)"
    )

    def model_post_init(self, __context) -> None:
        """Set backward compatibility fields after initialization."""
        if self.devices_backed_up is None:
            self.devices_backed_up = self.backed_up_count
        if self.devices_failed is None:
            self.devices_failed = self.failed_count
