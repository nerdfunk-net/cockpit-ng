"""
Pydantic models for the new job system.
"""

from __future__ import annotations
from pydantic import BaseModel, Field, validator
from typing import List, Dict, Any, Optional
from datetime import datetime
from enum import Enum


class JobStatus(str, Enum):
    """Job status enumeration"""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobType(str, Enum):
    """Job type enumeration"""

    DEVICE_COMPARISON = "device-comparison"
    DEVICE_SYNC = "device-sync"
    DEVICE_CACHE = "device-cache"
    BACKUP = "backup"
    NETWORK_SCAN = "network-scan"


class JobProgress(BaseModel):
    """Job progress information"""

    processed: int
    total: int
    message: Optional[str] = None


class DeviceResult(BaseModel):
    """Device processing result"""

    id: int
    job_id: str
    device_name: str
    status: str
    result_data: Dict[str, Any] = {}
    error_message: Optional[str] = None
    processed_at: datetime

    # Enhanced device data from Nautobot (added for device enrichment)
    device_id: Optional[str] = None
    role: Optional[Dict[str, Any]] = None
    location: Optional[Dict[str, Any]] = None
    device_type: Optional[Dict[str, Any]] = None
    primary_ip4: Optional[Dict[str, Any]] = None
    device_status: Optional[Dict[str, Any]] = None


class Job(BaseModel):
    """Job information"""

    id: str
    type: JobType
    status: JobStatus
    started_by: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    progress: Optional[JobProgress] = None
    result_summary: Optional[str] = None
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = {}
    device_results: List[DeviceResult] = []


class JobStartResponse(BaseModel):
    """Response when starting a job"""

    job_id: str
    status: JobStatus
    message: str


class JobListResponse(BaseModel):
    """Response for job list"""

    jobs: List[Job]
    total: int


class JobDetailResponse(BaseModel):
    """Response for job details"""

    job: Job


class NetworkScanRequest(BaseModel):
    """Request model for network scan job"""

    ping_mode: str = Field(default="fping", description="Ping mode: 'ping' or 'fping'")
    timeout: float = Field(
        default=1.5, ge=0.1, le=10.0, description="Ping timeout in seconds"
    )
    max_concurrent: int = Field(
        default=10, ge=1, le=100, description="Maximum concurrent ping operations"
    )

    @validator("ping_mode")
    def validate_ping_mode(cls, v):
        if v not in ["ping", "fping"]:
            raise ValueError("ping_mode must be either 'ping' or 'fping'")
        return v


class NetworkScanResponse(BaseModel):
    """Response model for network scan results"""

    cidr: str
    ping_mode: str
    total_targets: int
    alive_hosts: List[str]
    unreachable_count: int
    scan_duration: float
    started_at: datetime
    completed_at: Optional[datetime] = None
