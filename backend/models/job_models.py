"""
Pydantic models for the new job system.
"""

from __future__ import annotations
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime
from services.job_database_service import JobStatus, JobType


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