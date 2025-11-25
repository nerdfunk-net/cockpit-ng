"""
Job Schedule Management Router
API endpoints for managing scheduled jobs (different from APScheduler jobs router)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from core.auth import verify_token, require_permission
import jobs_manager
from models.jobs import (
    JobScheduleCreate,
    JobScheduleUpdate,
    JobScheduleResponse,
    JobExecutionRequest
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/job-schedules", tags=["job-schedules"])


@router.post("", response_model=JobScheduleResponse)
async def create_job_schedule(
    job_data: JobScheduleCreate,
    current_user: dict = Depends(verify_token)
):
    """
    Create a new job schedule

    - Global jobs require 'jobs:write' permission
    - Private jobs can be created by any authenticated user
    """
    try:
        # Check permissions for global jobs
        if job_data.is_global:
            # For global jobs, require permission
            from core.auth import require_permission
            user_check = await require_permission("jobs", "write")(current_user)
            if not user_check:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Permission denied: jobs:write required for global jobs"
                )
        else:
            # For private jobs, set the user_id to current user
            job_data.user_id = current_user["user_id"]

        # Create the job schedule
        job_schedule = jobs_manager.create_job_schedule(
            job_identifier=job_data.job_identifier,
            job_name=job_data.job_name,
            schedule_type=job_data.schedule_type,
            cron_expression=job_data.cron_expression,
            interval_minutes=job_data.interval_minutes,
            start_time=job_data.start_time,
            start_date=job_data.start_date,
            is_active=job_data.is_active,
            is_global=job_data.is_global,
            user_id=job_data.user_id,
            credential_id=job_data.credential_id,
            job_parameters=job_data.job_parameters
        )

        return JobScheduleResponse(**job_schedule)

    except Exception as e:
        logger.error(f"Error creating job schedule: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create job schedule: {str(e)}"
        )


@router.get("", response_model=List[JobScheduleResponse])
async def list_job_schedules(
    is_global: Optional[bool] = None,
    is_active: Optional[bool] = None,
    current_user: dict = Depends(verify_token)
):
    """
    List all job schedules accessible to the current user

    Returns:
    - Global jobs (visible to all)
    - User's private jobs
    """
    try:
        # Get jobs accessible to this user
        jobs = jobs_manager.get_user_job_schedules(current_user["user_id"])

        # Apply additional filters if provided
        if is_global is not None:
            jobs = [j for j in jobs if j.get("is_global") == is_global]

        if is_active is not None:
            jobs = [j for j in jobs if j.get("is_active") == is_active]

        return [JobScheduleResponse(**job) for job in jobs]

    except Exception as e:
        logger.error(f"Error listing job schedules: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list job schedules: {str(e)}"
        )


@router.get("/{job_id}", response_model=JobScheduleResponse)
async def get_job_schedule(
    job_id: int,
    current_user: dict = Depends(verify_token)
):
    """Get a specific job schedule by ID"""
    try:
        job = jobs_manager.get_job_schedule(job_id)

        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job schedule not found"
            )

        # Check access permissions
        if not job.get("is_global") and job.get("user_id") != current_user["user_id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: This is a private job belonging to another user"
            )

        return JobScheduleResponse(**job)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting job schedule: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get job schedule: {str(e)}"
        )


@router.put("/{job_id}", response_model=JobScheduleResponse)
async def update_job_schedule(
    job_id: int,
    job_update: JobScheduleUpdate,
    current_user: dict = Depends(verify_token)
):
    """Update a job schedule"""
    try:
        # Get existing job
        job = jobs_manager.get_job_schedule(job_id)

        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job schedule not found"
            )

        # Check permissions
        if job.get("is_global"):
            # Global jobs require write permission
            from core.auth import require_permission
            user_check = await require_permission("jobs", "write")(current_user)
            if not user_check:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Permission denied: jobs:write required for global jobs"
                )
        else:
            # Private jobs can only be edited by owner
            if job.get("user_id") != current_user["user_id"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You can only edit your own private jobs"
                )

        # Update the job
        updated_job = jobs_manager.update_job_schedule(
            job_id=job_id,
            job_name=job_update.job_name,
            schedule_type=job_update.schedule_type,
            cron_expression=job_update.cron_expression,
            interval_minutes=job_update.interval_minutes,
            start_time=job_update.start_time,
            start_date=job_update.start_date,
            is_active=job_update.is_active,
            credential_id=job_update.credential_id,
            job_parameters=job_update.job_parameters
        )

        return JobScheduleResponse(**updated_job)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating job schedule: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update job schedule: {str(e)}"
        )


@router.delete("/{job_id}")
async def delete_job_schedule(
    job_id: int,
    current_user: dict = Depends(verify_token)
):
    """Delete a job schedule"""
    try:
        # Get existing job
        job = jobs_manager.get_job_schedule(job_id)

        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job schedule not found"
            )

        # Check permissions
        if job.get("is_global"):
            # Global jobs require write permission
            from core.auth import require_permission
            user_check = await require_permission("jobs", "write")(current_user)
            if not user_check:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Permission denied: jobs:write required for global jobs"
                )
        else:
            # Private jobs can only be deleted by owner
            if job.get("user_id") != current_user["user_id"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You can only delete your own private jobs"
                )

        # Delete the job
        deleted = jobs_manager.delete_job_schedule(job_id)

        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete job schedule"
            )

        return {"message": "Job schedule deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting job schedule: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete job schedule: {str(e)}"
        )


@router.post("/execute")
async def execute_job(
    execution_request: JobExecutionRequest,
    current_user: dict = Depends(verify_token)
):
    """
    Execute a job immediately

    This endpoint triggers an immediate execution of a scheduled job.
    The actual Celery task execution will be implemented separately.
    """
    try:
        # Get the job schedule
        job = jobs_manager.get_job_schedule(execution_request.job_schedule_id)

        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job schedule not found"
            )

        # Check permissions
        if not job.get("is_global") and job.get("user_id") != current_user["user_id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You cannot execute this private job"
            )

        # Get the task for this job type
        from tasks.job_tasks import get_task_for_job

        task_func = get_task_for_job(job.get("job_identifier"))

        if not task_func:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No task implementation found for job type: {job.get('job_identifier')}"
            )

        # Prepare task parameters
        task_kwargs = {
            "job_schedule_id": execution_request.job_schedule_id,
        }

        # Add credential_id if present
        if job.get("credential_id"):
            task_kwargs["credential_id"] = job.get("credential_id")

        # Add any additional job parameters
        if job.get("job_parameters"):
            task_kwargs.update(job.get("job_parameters"))

        # Override with execution request parameters if provided
        if execution_request.override_parameters:
            task_kwargs.update(execution_request.override_parameters)

        # Execute the Celery task
        celery_task = task_func.delay(**task_kwargs)

        logger.info(
            f"Job execution started: {job.get('job_name')} "
            f"(Celery task ID: {celery_task.id}) by user {current_user['username']}"
        )

        # Update last_run timestamp
        from datetime import datetime
        jobs_manager.update_job_run_times(
            execution_request.job_schedule_id,
            last_run=datetime.now()
        )

        return {
            "message": "Job execution started",
            "job_id": execution_request.job_schedule_id,
            "job_name": job.get("job_name"),
            "celery_task_id": celery_task.id,
            "status": "queued"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing job: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute job: {str(e)}"
        )


@router.get("/available/types")
async def get_available_job_types(current_user: dict = Depends(verify_token)):
    """
    Get list of available job types that can be scheduled

    Returns predefined job types with their identifiers and descriptions
    """
    job_types = [
        {
            "identifier": "cache_devices",
            "name": "Cache Devices",
            "description": "Update device cache from Nautobot",
            "requires_credentials": False,
            "is_global_only": True
        },
        {
            "identifier": "sync_checkmk",
            "name": "Sync CheckMK",
            "description": "Synchronize devices to CheckMK",
            "requires_credentials": False,
            "is_global_only": True
        },
        {
            "identifier": "backup_configs",
            "name": "Backup Configurations",
            "description": "Backup device configurations",
            "requires_credentials": True,
            "is_global_only": False
        },
        {
            "identifier": "ansible_playbook",
            "name": "Run Ansible Playbook",
            "description": "Execute Ansible playbook",
            "requires_credentials": True,
            "is_global_only": False
        }
    ]

    return {"job_types": job_types}
