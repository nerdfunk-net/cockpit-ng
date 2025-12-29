"""
Job Schedule Management Router
API endpoints for managing scheduled jobs via Celery Beat
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from datetime import datetime, timezone
from core.auth import verify_token, require_permission
import jobs_manager
from models.jobs import (
    JobScheduleCreate,
    JobScheduleUpdate,
    JobScheduleResponse,
    JobExecutionRequest,
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/job-schedules", tags=["job-schedules"])


@router.post("", response_model=JobScheduleResponse)
async def create_job_schedule(
    job_data: JobScheduleCreate, current_user: dict = Depends(verify_token)
):
    """
    Create a new job schedule

    - Global jobs require 'jobs:write' permission
    - Private jobs can be created by any authenticated user
    """
    try:
        # Check permissions for global jobs
        if job_data.is_global:
            # For global jobs, require admin role or jobs:write permission
            import rbac_manager

            has_permission = rbac_manager.has_permission(
                current_user["user_id"], "jobs", "write"
            )
            if not has_permission and current_user.get("role") != "admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Permission denied: jobs:write required for global jobs",
                )
        else:
            # For private jobs, set the user_id to current user
            job_data.user_id = current_user["user_id"]

        # Create the job schedule
        job_schedule = jobs_manager.create_job_schedule(
            job_identifier=job_data.job_identifier,
            job_template_id=job_data.job_template_id,
            schedule_type=job_data.schedule_type,
            cron_expression=job_data.cron_expression,
            interval_minutes=job_data.interval_minutes,
            start_time=job_data.start_time,
            start_date=job_data.start_date,
            is_active=job_data.is_active,
            is_global=job_data.is_global,
            user_id=job_data.user_id,
            credential_id=job_data.credential_id,
            job_parameters=job_data.job_parameters,
        )

        return JobScheduleResponse(**job_schedule)

    except Exception as e:
        logger.error(f"Error creating job schedule: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create job schedule: {str(e)}",
        )


@router.get("", response_model=List[JobScheduleResponse])
async def list_job_schedules(
    is_global: Optional[bool] = None,
    is_active: Optional[bool] = None,
    current_user: dict = Depends(verify_token),
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
            detail=f"Failed to list job schedules: {str(e)}",
        )


@router.get("/{job_id}", response_model=JobScheduleResponse)
async def get_job_schedule(job_id: int, current_user: dict = Depends(verify_token)):
    """Get a specific job schedule by ID"""
    try:
        job = jobs_manager.get_job_schedule(job_id)

        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Job schedule not found"
            )

        # Check access permissions
        if not job.get("is_global") and job.get("user_id") != current_user["user_id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: This is a private job belonging to another user",
            )

        return JobScheduleResponse(**job)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting job schedule: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get job schedule: {str(e)}",
        )


@router.put("/{job_id}", response_model=JobScheduleResponse)
async def update_job_schedule(
    job_id: int,
    job_update: JobScheduleUpdate,
    current_user: dict = Depends(verify_token),
):
    """Update a job schedule"""
    try:
        # Get existing job
        job = jobs_manager.get_job_schedule(job_id)

        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Job schedule not found"
            )

        # Check permissions
        if job.get("is_global"):
            # Global jobs require write permission
            import rbac_manager

            has_permission = rbac_manager.has_permission(
                current_user["user_id"], "jobs", "write"
            )
            if not has_permission and current_user.get("role") != "admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Permission denied: jobs:write required for global jobs",
                )
        else:
            # Private jobs can only be edited by owner
            if job.get("user_id") != current_user["user_id"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You can only edit your own private jobs",
                )

        # Update the job
        updated_job = jobs_manager.update_job_schedule(
            job_id=job_id,
            job_identifier=job_update.job_identifier,
            schedule_type=job_update.schedule_type,
            cron_expression=job_update.cron_expression,
            interval_minutes=job_update.interval_minutes,
            start_time=job_update.start_time,
            start_date=job_update.start_date,
            is_active=job_update.is_active,
            credential_id=job_update.credential_id,
            job_parameters=job_update.job_parameters,
        )

        return JobScheduleResponse(**updated_job)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating job schedule: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update job schedule: {str(e)}",
        )


@router.delete("/{job_id}")
async def delete_job_schedule(job_id: int, current_user: dict = Depends(verify_token)):
    """Delete a job schedule"""
    try:
        # Get existing job
        job = jobs_manager.get_job_schedule(job_id)

        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Job schedule not found"
            )

        # Check permissions
        if job.get("is_global"):
            # Global jobs require write permission
            import rbac_manager

            has_permission = rbac_manager.has_permission(
                current_user["user_id"], "jobs", "write"
            )
            if not has_permission and current_user.get("role") != "admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Permission denied: jobs:write required for global jobs",
                )
        else:
            # Private jobs can only be deleted by owner
            if job.get("user_id") != current_user["user_id"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You can only delete your own private jobs",
                )

        # Delete the job
        deleted = jobs_manager.delete_job_schedule(job_id)

        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete job schedule",
            )

        return {"message": "Job schedule deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting job schedule: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete job schedule: {str(e)}",
        )


@router.post("/execute")
async def execute_job(
    execution_request: JobExecutionRequest, current_user: dict = Depends(verify_token)
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
                status_code=status.HTTP_404_NOT_FOUND, detail="Job schedule not found"
            )

        # Check permissions
        if not job.get("is_global") and job.get("user_id") != current_user["user_id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You cannot execute this private job",
            )

        # Get the task for this job type
        from tasks.job_tasks import get_task_for_job

        task_func = get_task_for_job(job.get("job_identifier"))

        if not task_func:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No task implementation found for job type: {job.get('job_identifier')}",
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
            execution_request.job_schedule_id, last_run=datetime.now()
        )

        return {
            "message": "Job execution started",
            "job_id": execution_request.job_schedule_id,
            "job_name": job.get("job_name"),
            "celery_task_id": celery_task.id,
            "status": "queued",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing job: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute job: {str(e)}",
        )


@router.get("/debug/scheduler-status")
async def get_scheduler_debug_status(current_user: dict = Depends(verify_token)):
    """
    Get detailed scheduler debug information.

    Returns:
    - Current server time (UTC and local)
    - All schedules with their next_run times
    - Whether Celery Beat is running
    - Recent schedule check results
    """
    try:
        now_utc = datetime.now(timezone.utc)
        now_local = datetime.now()

        # Get all schedules
        all_schedules = jobs_manager.list_job_schedules()
        active_schedules = [s for s in all_schedules if s.get("is_active")]

        # Check which schedules are due
        due_schedules = []
        upcoming_schedules = []

        for schedule in active_schedules:
            next_run = schedule.get("next_run")
            if next_run:
                # Parse next_run if it's a string
                if isinstance(next_run, str):
                    next_run_dt = datetime.fromisoformat(
                        next_run.replace("Z", "+00:00")
                    )
                else:
                    next_run_dt = next_run

                # Calculate time until next run
                if next_run_dt.tzinfo is None:
                    next_run_dt = next_run_dt.replace(tzinfo=timezone.utc)

                time_diff = (next_run_dt - now_utc).total_seconds()

                schedule_info = {
                    "id": schedule["id"],
                    "job_identifier": schedule["job_identifier"],
                    "schedule_type": schedule["schedule_type"],
                    "start_time": schedule.get("start_time"),
                    "next_run": schedule.get("next_run"),
                    "next_run_local": next_run_dt.astimezone().isoformat()
                    if next_run_dt
                    else None,
                    "last_run": schedule.get("last_run"),
                    "seconds_until_next_run": int(time_diff),
                    "is_due": time_diff <= 0,
                    "template_name": schedule.get("template_name"),
                }

                if time_diff <= 0:
                    due_schedules.append(schedule_info)
                else:
                    upcoming_schedules.append(schedule_info)

        # Sort upcoming by next_run
        upcoming_schedules.sort(key=lambda x: x["seconds_until_next_run"])

        # Check Celery Beat status
        celery_beat_status = "unknown"
        try:
            from celery_app import celery_app

            inspect = celery_app.control.inspect()

            # Check if there are any active workers
            active_workers = inspect.active()
            if active_workers:
                celery_beat_status = "workers_active"
            else:
                celery_beat_status = "no_workers_detected"
        except Exception as e:
            celery_beat_status = f"error: {str(e)}"

        return {
            "server_time": {
                "utc": now_utc.isoformat(),
                "local": now_local.isoformat(),
                "timezone_offset_hours": (
                    now_local.astimezone().utcoffset().total_seconds() / 3600
                )
                if now_local.astimezone().utcoffset()
                else 0,
            },
            "schedule_summary": {
                "total_schedules": len(all_schedules),
                "active_schedules": len(active_schedules),
                "due_now": len(due_schedules),
                "upcoming": len(upcoming_schedules),
            },
            "due_schedules": due_schedules,
            "upcoming_schedules": upcoming_schedules[:10],  # Next 10 upcoming
            "celery_status": celery_beat_status,
            "note": "Times are displayed in UTC. 'start_time' is interpreted as UTC, not local time. For European time (UTC+1), subtract 1 hour from start_time.",
        }

    except Exception as e:
        logger.error(f"Error getting scheduler debug status: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get scheduler status: {str(e)}",
        )


@router.post("/debug/recalculate-next-runs")
async def recalculate_all_next_runs(
    current_user: dict = Depends(require_permission("jobs", "write")),
):
    """
    Recalculate next_run for all active schedules.
    Useful when schedules seem stuck or out of sync.
    """
    try:
        result = jobs_manager.initialize_schedule_next_runs()

        return {
            "success": True,
            "message": f"Recalculated next_run for {result['initialized_count']} schedules",
            "details": result,
        }

    except Exception as e:
        logger.error(f"Error recalculating next runs: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to recalculate next runs: {str(e)}",
        )
