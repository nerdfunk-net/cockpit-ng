"""
Pydantic models for Nautobot to CheckMK device synchronization.
"""

from __future__ import annotations
from typing import Dict, Any, Optional, List
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum


class JobStatus(str, Enum):
    """Background job status enumeration."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class DeviceExtensions(BaseModel):
    """Device configuration extensions for CheckMK."""

    folder: str = Field(description="CheckMK folder path for the device")
    attributes: Dict[str, Any] = Field(
        default_factory=dict, description="Device attributes for CheckMK"
    )
    internal: Dict[str, Any] = Field(
        default_factory=dict, description="Internal data not used for comparison"
    )


class DeviceComparison(BaseModel):
    """Result of comparing Nautobot and CheckMK device configurations."""

    result: str = Field(
        description="Comparison result: 'equal', 'diff', 'host_not_found', or 'error'"
    )
    diff: str = Field(default="", description="Description of differences found")
    normalized_config: Dict[str, Any] = Field(
        default_factory=dict, description="Normalized Nautobot configuration"
    )
    checkmk_config: Optional[Dict[str, Any]] = Field(
        default=None, description="CheckMK configuration"
    )
    ignored_attributes: List[str] = Field(
        default_factory=list, description="List of ignored attributes during comparison"
    )


class DeviceList(BaseModel):
    """List of devices from Nautobot."""

    devices: List[Dict[str, Any]] = Field(description="List of device data")
    total: int = Field(description="Total number of devices")
    message: str = Field(description="Status message")


class DeviceListWithStatus(BaseModel):
    """List of devices with CheckMK comparison status."""

    devices: List[Dict[str, Any]] = Field(
        description="List of device data with CheckMK status"
    )
    total: int = Field(description="Total number of devices")
    ignored_attributes: List[str] = Field(
        description="List of ignored attributes during comparison"
    )
    message: str = Field(description="Status message")


class DeviceOperationResult(BaseModel):
    """Result of a device operation (add/update) in CheckMK."""

    success: bool = Field(description="Whether the operation was successful")
    message: str = Field(description="Operation result message")
    device_id: str = Field(description="Nautobot device ID")
    hostname: str = Field(description="Device hostname")
    site: str = Field(description="CheckMK site used")
    folder: str = Field(description="CheckMK folder path")
    checkmk_response: Optional[Dict[str, Any]] = Field(
        default=None, description="Response from CheckMK API"
    )


class DeviceUpdateResult(DeviceOperationResult):
    """Result of updating a device in CheckMK."""

    folder_changed: bool = Field(description="Whether the device folder was changed")


class DefaultSiteResponse(BaseModel):
    """Response containing the default CheckMK site."""

    default_site: str = Field(description="Default CheckMK site name")


# Background Job Models


class JobStartResponse(BaseModel):
    """Response when starting a background job."""

    job_id: str = Field(description="Unique job identifier")
    status: JobStatus = Field(description="Current job status")
    message: str = Field(description="Status message")


class JobProgressResponse(BaseModel):
    """Progress information for a background job."""

    job_id: str = Field(description="Job identifier")
    status: JobStatus = Field(description="Current job status")
    processed_devices: int = Field(description="Number of devices processed")
    total_devices: int = Field(description="Total number of devices to process")
    progress_message: str = Field(description="Current progress message")
    created_at: datetime = Field(description="Job creation timestamp")
    started_at: Optional[datetime] = Field(
        default=None, description="Job start timestamp"
    )
    completed_at: Optional[datetime] = Field(
        default=None, description="Job completion timestamp"
    )
    error_message: Optional[str] = Field(
        default=None, description="Error message if job failed"
    )


class JobResultsResponse(BaseModel):
    """Complete job results in the same format as DeviceListWithStatus."""

    job_id: str = Field(description="Job identifier")
    status: JobStatus = Field(description="Job status when results were retrieved")
    devices: List[Dict[str, Any]] = Field(
        description="List of device data with CheckMK status"
    )
    total: int = Field(description="Total number of devices")
    message: str = Field(description="Status message")
