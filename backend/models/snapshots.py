"""
Pydantic models for network snapshots API.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# ============================================================================
# Command Template Models
# ============================================================================


class SnapshotCommandBase(BaseModel):
    """Base model for snapshot commands."""

    command: str = Field(..., description="Command to execute on device")
    use_textfsm: bool = Field(True, description="Whether to parse output with TextFSM")
    order: int = Field(0, description="Order of command execution")


class SnapshotCommandCreate(SnapshotCommandBase):
    """Model for creating a snapshot command."""

    pass


class SnapshotCommandResponse(SnapshotCommandBase):
    """Model for snapshot command response."""

    id: int
    template_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Command Template Models
# ============================================================================


class SnapshotCommandTemplateBase(BaseModel):
    """Base model for snapshot command templates."""

    name: str = Field(..., min_length=1, max_length=255, description="Template name")
    description: Optional[str] = Field(None, description="Template description")
    scope: str = Field("global", description="Template scope: 'global' or 'private'")


class SnapshotCommandTemplateCreate(SnapshotCommandTemplateBase):
    """Model for creating a snapshot command template."""

    commands: List[SnapshotCommandCreate] = Field(
        default_factory=list, description="List of commands in template"
    )


class SnapshotCommandTemplateUpdate(BaseModel):
    """Model for updating a snapshot command template."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    scope: Optional[str] = None
    commands: Optional[List[SnapshotCommandCreate]] = None


class SnapshotCommandTemplateResponse(SnapshotCommandTemplateBase):
    """Model for snapshot command template response."""

    id: int
    created_by: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    commands: List[SnapshotCommandResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


# ============================================================================
# Snapshot Execution Models
# ============================================================================


class SnapshotExecuteRequest(BaseModel):
    """Model for executing a snapshot."""

    name: str = Field(
        ..., description="Snapshot name (supports placeholders like {device})"
    )
    description: Optional[str] = Field(None, description="Snapshot description")
    commands: List[SnapshotCommandCreate] = Field(
        ...,
        description="List of commands to execute with use_textfsm flags",
        min_items=1,
    )
    git_repository_id: int = Field(..., description="Git repository to store results")
    snapshot_path: str = Field(
        ...,
        description="Path template with placeholders: {device_name}, {timestamp}, {template_name}, {custom_field.*}. MUST include filename with .json extension",
    )
    devices: List[Dict[str, Any]] = Field(
        ..., description="List of devices to snapshot", min_items=1
    )
    credential_id: Optional[int] = Field(
        None, description="ID of stored credential to use (optional)"
    )
    username: Optional[str] = Field(
        None, description="SSH username (required if credential_id not provided)"
    )
    password: Optional[str] = Field(
        None, description="SSH password (required if credential_id not provided)"
    )
    template_id: Optional[int] = Field(
        None, description="Optional template ID to associate snapshot with"
    )
    template_name: Optional[str] = Field(
        None, description="Template name for path placeholder replacement"
    )


class SnapshotResultResponse(BaseModel):
    """Model for snapshot result response."""

    id: int
    snapshot_id: int
    device_name: str
    device_ip: Optional[str]
    status: str
    git_file_path: Optional[str]
    git_commit_hash: Optional[str]
    parsed_data: Optional[str]  # JSON string
    error_message: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SnapshotResponse(BaseModel):
    """Model for snapshot response."""

    id: int
    name: str
    description: Optional[str]
    template_id: Optional[int]
    template_name: Optional[str]
    git_repository_id: Optional[int]
    snapshot_path: str
    executed_by: str
    status: str
    device_count: int
    success_count: int
    failed_count: int
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    results: List[SnapshotResultResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class SnapshotListResponse(BaseModel):
    """Model for snapshot list response (without results)."""

    id: int
    name: str
    description: Optional[str]
    template_id: Optional[int]
    template_name: Optional[str]
    git_repository_id: Optional[int]
    snapshot_path: str
    executed_by: str
    status: str
    device_count: int
    success_count: int
    failed_count: int
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Snapshot Comparison Models
# ============================================================================


class SnapshotCompareRequest(BaseModel):
    """Model for comparing two snapshots."""

    snapshot_id_1: int = Field(..., description="First snapshot ID")
    snapshot_id_2: int = Field(..., description="Second snapshot ID")
    device_filter: Optional[List[str]] = Field(
        None, description="Optional list of device names to compare"
    )


class CommandDiff(BaseModel):
    """Model for command-level differences."""

    command: str
    status: str  # 'added', 'removed', 'modified', 'unchanged'
    diff: Optional[Dict[str, Any]] = None  # Detailed diff for modified commands


class DeviceComparisonResult(BaseModel):
    """Model for device-level comparison result."""

    device_name: str
    status: str  # 'same', 'different', 'missing_in_snapshot1', 'missing_in_snapshot2'
    snapshot1_status: Optional[str]
    snapshot2_status: Optional[str]
    commands: List[CommandDiff] = Field(default_factory=list)


class SnapshotCompareResponse(BaseModel):
    """Model for snapshot comparison response."""

    snapshot1: SnapshotListResponse
    snapshot2: SnapshotListResponse
    devices: List[DeviceComparisonResult] = Field(default_factory=list)
    summary: Dict[str, int] = Field(
        default_factory=dict,
        description="Summary stats: same_count, different_count, etc.",
    )
