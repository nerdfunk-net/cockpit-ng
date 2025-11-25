"""
Pydantic models for job management
"""
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class JobScheduleBase(BaseModel):
    """Base model for job scheduling"""
    job_identifier: str = Field(..., description="Unique identifier for the job type (e.g., 'cache_devices', 'sync_checkmk')")
    job_name: str = Field(..., description="Human-readable name for the job")
    schedule_type: Literal["now", "interval", "hourly", "daily", "weekly", "monthly", "custom"] = Field(..., description="Schedule frequency")
    cron_expression: Optional[str] = Field(None, description="Cron expression for custom schedules")
    interval_minutes: Optional[int] = Field(None, description="Interval in minutes for interval-based schedules")
    start_time: Optional[str] = Field(None, description="Start time in HH:MM format (24-hour) for time-based schedules")
    start_date: Optional[str] = Field(None, description="Start date in YYYY-MM-DD format for one-time or initial scheduled runs")
    is_active: bool = Field(True, description="Whether the job is active")
    is_global: bool = Field(True, description="Whether the job is global (all users) or private (user-specific)")
    credential_id: Optional[int] = Field(None, description="ID of credential to use (if any)")
    job_parameters: Optional[dict] = Field(None, description="Additional parameters for the job")


class JobScheduleCreate(JobScheduleBase):
    """Model for creating a new scheduled job"""
    user_id: Optional[int] = Field(None, description="User ID for private jobs")


class JobScheduleUpdate(BaseModel):
    """Model for updating a scheduled job"""
    job_name: Optional[str] = None
    schedule_type: Optional[Literal["now", "interval", "hourly", "daily", "weekly", "monthly", "custom"]] = None
    cron_expression: Optional[str] = None
    interval_minutes: Optional[int] = None
    start_time: Optional[str] = None
    start_date: Optional[str] = None
    is_active: Optional[bool] = None
    credential_id: Optional[int] = None
    job_parameters: Optional[dict] = None


class JobScheduleResponse(JobScheduleBase):
    """Model for job schedule response"""
    id: int
    user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None

    class Config:
        from_attributes = True


class JobExecutionRequest(BaseModel):
    """Model for executing a job immediately"""
    job_schedule_id: int
    override_parameters: Optional[dict] = None
