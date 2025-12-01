"""
Pydantic models for job management
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class JobScheduleBase(BaseModel):
    """Base model for job scheduling"""

    job_identifier: str = Field(
        ..., description="Unique identifier for this schedule (user-defined)"
    )
    job_template_id: int = Field(..., description="ID of the job template to use")
    schedule_type: Literal[
        "now", "interval", "hourly", "daily", "weekly", "monthly", "custom"
    ] = Field(..., description="Schedule frequency")
    cron_expression: Optional[str] = Field(
        None, description="Cron expression for custom schedules"
    )
    interval_minutes: Optional[int] = Field(
        None, description="Interval in minutes for interval-based schedules"
    )
    start_time: Optional[str] = Field(
        None,
        description="Start time in HH:MM format (24-hour) for time-based schedules",
    )
    start_date: Optional[str] = Field(
        None,
        description="Start date in YYYY-MM-DD format for one-time or initial scheduled runs",
    )
    is_active: bool = Field(True, description="Whether the job is active")
    is_global: bool = Field(
        True,
        description="Whether the job is global (all users) or private (user-specific)",
    )
    credential_id: Optional[int] = Field(
        None, description="ID of credential to use (if any)"
    )
    job_parameters: Optional[dict] = Field(
        None, description="Additional parameters for the job"
    )


class JobScheduleCreate(JobScheduleBase):
    """Model for creating a new scheduled job"""

    user_id: Optional[int] = Field(None, description="User ID for private jobs")


class JobScheduleUpdate(BaseModel):
    """Model for updating a scheduled job"""

    job_identifier: Optional[str] = None
    schedule_type: Optional[
        Literal["now", "interval", "hourly", "daily", "weekly", "monthly", "custom"]
    ] = None
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
    job_template_id: Optional[int] = Field(
        None, description="ID of the job template to use"
    )
    user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None
    # Additional fields for display (populated from template)
    template_name: Optional[str] = Field(
        None, description="Name of the associated job template"
    )
    template_job_type: Optional[str] = Field(
        None, description="Job type from the template"
    )

    class Config:
        from_attributes = True


class JobExecutionRequest(BaseModel):
    """Model for executing a job immediately"""

    job_schedule_id: int
    override_parameters: Optional[dict] = None


# ============================================================================
# Job Run Models
# ============================================================================


class JobRunBase(BaseModel):
    """Base model for job runs"""

    job_schedule_id: Optional[int] = Field(
        None, description="ID of the schedule that triggered this run"
    )
    job_template_id: Optional[int] = Field(None, description="ID of the job template")
    job_name: str = Field(..., description="Name of the job (snapshot)")
    job_type: str = Field(..., description="Type of job (snapshot)")
    triggered_by: Literal["schedule", "manual"] = Field(
        "schedule", description="How the job was triggered"
    )
    target_devices: Optional[list[str]] = Field(
        None, description="List of target device names"
    )
    executed_by: Optional[str] = Field(
        None, description="Username who triggered manual run"
    )


class JobRunCreate(JobRunBase):
    """Model for creating a new job run"""

    celery_task_id: Optional[str] = Field(None, description="Celery task UUID")


class JobRunUpdate(BaseModel):
    """Model for updating a job run"""

    status: Optional[
        Literal["pending", "running", "completed", "failed", "cancelled"]
    ] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    result: Optional[dict] = None
    celery_task_id: Optional[str] = None


class JobRunResponse(BaseModel):
    """Model for job run response"""

    id: int
    job_schedule_id: Optional[int] = None
    job_template_id: Optional[int] = None
    celery_task_id: Optional[str] = None
    job_name: str
    job_type: str
    status: str
    triggered_by: str
    queued_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[float] = Field(
        None, description="Duration in seconds (computed)"
    )
    error_message: Optional[str] = None
    result: Optional[dict] = None
    target_devices: Optional[list[str]] = None
    executed_by: Optional[str] = None
    # Additional fields from relationships
    schedule_name: Optional[str] = Field(
        None, description="Name of the schedule (if still exists)"
    )
    template_name: Optional[str] = Field(
        None, description="Name of the template (if still exists)"
    )

    class Config:
        from_attributes = True


class JobRunListResponse(BaseModel):
    """Paginated list of job runs"""

    items: list[JobRunResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
