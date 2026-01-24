"""
Job Run Manager
Handles business logic for job run tracking using PostgreSQL and repository pattern.
"""

import json
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime

from repositories.jobs.job_run_repository import job_run_repository as repo
import jobs_manager
import job_template_manager

logger = logging.getLogger(__name__)


def create_job_run(
    job_name: str,
    job_type: str,
    triggered_by: str = "schedule",
    job_schedule_id: Optional[int] = None,
    job_template_id: Optional[int] = None,
    target_devices: Optional[List[str]] = None,
    executed_by: Optional[str] = None,
) -> Dict[str, Any]:
    """Create a new job run record"""

    job_run_data = repo.create(
        job_schedule_id=job_schedule_id,
        job_template_id=job_template_id,
        job_name=job_name,
        job_type=job_type,
        status="pending",
        triggered_by=triggered_by,
        target_devices=json.dumps(target_devices) if target_devices else None,
        executed_by=executed_by,
    )

    logger.info(
        f"Created job run: {job_name} (ID: {job_run_data.get('id')}, triggered_by: {triggered_by})"
    )
    return _model_to_dict(job_run_data)


def get_job_run(run_id: int) -> Optional[Dict[str, Any]]:
    """Get a job run by ID"""
    job_run = repo.get_by_id(run_id)
    if job_run:
        return _model_to_dict(job_run)
    return None


def get_job_run_by_celery_id(celery_task_id: str) -> Optional[Dict[str, Any]]:
    """Get a job run by Celery task ID"""
    job_run = repo.get_by_celery_task_id(celery_task_id)
    if job_run:
        return _model_to_dict(job_run)
    return None


def get_job_runs_by_celery_ids(celery_task_ids: List[str]) -> List[Dict[str, Any]]:
    """Get job runs by multiple Celery task IDs"""
    job_runs = repo.get_by_celery_task_ids(celery_task_ids)
    return [_model_to_dict(job_run) for job_run in job_runs]


def list_job_runs(
    page: int = 1,
    page_size: int = 25,
    status: Optional[List[str]] = None,
    job_type: Optional[List[str]] = None,
    triggered_by: Optional[List[str]] = None,
    schedule_id: Optional[int] = None,
    template_id: Optional[List[int]] = None,
) -> Dict[str, Any]:
    """List job runs with pagination and filters (supports multiple values)"""
    items, total = repo.get_paginated(
        page=page,
        page_size=page_size,
        status=status,
        job_type=job_type,
        triggered_by=triggered_by,
        schedule_id=schedule_id,
        template_id=template_id,
    )

    total_pages = (total + page_size - 1) // page_size  # Ceiling division

    return {
        "items": [_model_to_dict(item) for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


def get_recent_runs(
    limit: int = 50, status: Optional[str] = None, job_type: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Get recent job runs"""
    runs = repo.get_recent_runs(limit=limit, status=status, job_type=job_type)
    return [_model_to_dict(run) for run in runs]


def get_runs_since(
    since: datetime, status: Optional[str] = None, job_type: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Get job runs since a specific datetime"""
    runs = repo.get_runs_since(since=since, status=status, job_type=job_type)
    return [_model_to_dict(run) for run in runs]


def get_schedule_runs(schedule_id: int, limit: int = 50) -> List[Dict[str, Any]]:
    """Get job runs for a specific schedule"""
    runs = repo.get_by_schedule(schedule_id, limit=limit)
    return [_model_to_dict(run) for run in runs]


def mark_started(run_id: int, celery_task_id: str) -> Optional[Dict[str, Any]]:
    """Mark a job run as started"""
    job_run = repo.mark_started(run_id, celery_task_id)
    if job_run:
        logger.info(f"Job run {run_id} started (task: {celery_task_id})")
        return _model_to_dict(job_run)
    return None


def mark_completed(
    run_id: int, result: Optional[Dict] = None
) -> Optional[Dict[str, Any]]:
    """Mark a job run as completed"""
    result_json = json.dumps(result) if result else None
    job_run = repo.mark_completed(run_id, result=result_json)
    if job_run:
        logger.info(f"Job run {run_id} completed")
        return _model_to_dict(job_run)
    return None


def mark_failed(run_id: int, error_message: str) -> Optional[Dict[str, Any]]:
    """Mark a job run as failed"""
    job_run = repo.mark_failed(run_id, error_message)
    if job_run:
        logger.warning(f"Job run {run_id} failed: {error_message}")
        return _model_to_dict(job_run)
    return None


def mark_cancelled(run_id: int) -> Optional[Dict[str, Any]]:
    """Mark a job run as cancelled"""
    job_run = repo.mark_cancelled(run_id)
    if job_run:
        logger.info(f"Job run {run_id} cancelled")
        return _model_to_dict(job_run)
    return None


def get_running_count() -> int:
    """Get count of currently running jobs"""
    return repo.get_running_count()


def get_pending_count() -> int:
    """Get count of pending jobs"""
    return repo.get_pending_count()


def get_queue_stats() -> Dict[str, Any]:
    """Get job queue statistics"""
    return {"running": repo.get_running_count(), "pending": repo.get_pending_count()}


def get_dashboard_stats() -> Dict[str, Any]:
    """
    Get dashboard statistics for job runs and backup devices.

    Returns:
        dict: Statistics including:
            - job_runs: total, success, failed, running counts
            - backup_devices: total_devices, successful_devices, failed_devices
    """
    import json
    from core.database import get_db_session
    from sqlalchemy import text

    session = get_db_session()

    try:
        # Get job run statistics
        job_stats = session.execute(
            text("""
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running
            FROM job_runs
        """)
        ).fetchone()

        # Get backup device statistics from the last 30 days
        backup_stats = session.execute(
            text("""
            SELECT
                result
            FROM job_runs
            WHERE job_type = 'backup'
                AND status = 'completed'
                AND queued_at >= NOW() - INTERVAL '30 days'
        """)
        ).fetchall()

        # Parse backup results to count devices
        total_backed_up = 0
        total_failed = 0

        for row in backup_stats:
            if row[0]:  # result exists
                try:
                    result = json.loads(row[0])
                    total_backed_up += result.get("devices_backed_up", 0)
                    total_failed += result.get("devices_failed", 0)
                except (json.JSONDecodeError, AttributeError):
                    pass

        return {
            "job_runs": {
                "total": job_stats[0] or 0,
                "completed": job_stats[1] or 0,
                "failed": job_stats[2] or 0,
                "running": job_stats[3] or 0,
            },
            "backup_devices": {
                "total_devices": total_backed_up + total_failed,
                "successful_devices": total_backed_up,
                "failed_devices": total_failed,
            },
        }

    finally:
        session.close()


def cleanup_old_runs(days: int = 30) -> int:
    """Delete job runs older than specified days"""
    count = repo.cleanup_old_runs(days)
    logger.info(f"Cleaned up {count} old job runs (older than {days} days)")
    return count


def cleanup_old_runs_hours(hours: int = 24) -> int:
    """Delete job runs older than specified hours"""
    # Convert hours to days (fractional)
    hours / 24.0
    count = repo.cleanup_old_runs_hours(hours)
    logger.info(f"Cleaned up {count} old job runs (older than {hours} hours)")
    return count


def clear_all_runs() -> int:
    """Delete all job runs"""
    count = repo.clear_all()
    logger.info(f"Cleared all job runs ({count} deleted)")
    return count


def clear_filtered_runs(
    status: Optional[List[str]] = None,
    job_type: Optional[List[str]] = None,
    triggered_by: Optional[List[str]] = None,
    template_id: Optional[List[int]] = None,
) -> int:
    """Delete job runs matching filters (excludes pending/running jobs). Supports multiple values."""
    count = repo.clear_filtered(
        status=status,
        job_type=job_type,
        triggered_by=triggered_by,
        template_id=template_id,
    )
    filters = []
    if status:
        filters.append(f"status={','.join(status)}")
    if job_type:
        filters.append(f"job_type={','.join(job_type)}")
    if triggered_by:
        filters.append(f"triggered_by={','.join(triggered_by)}")
    if template_id:
        filters.append(f"template_id={','.join(map(str, template_id))}")
    filter_desc = ", ".join(filters) if filters else "all"
    logger.info(f"Cleared {count} job runs (filter: {filter_desc})")
    return count


def get_distinct_templates() -> List[Dict[str, Any]]:
    """Get distinct templates used in job runs"""
    return repo.get_distinct_templates()


def delete_job_run(run_id: int) -> bool:
    """Delete a single job run by ID"""
    deleted = repo.delete(run_id)
    if deleted:
        logger.info(f"Deleted job run {run_id}")
    return deleted


def _model_to_dict(job_run_data) -> Dict[str, Any]:
    """Convert JobRun data (dict from repository) to response dictionary"""

    # Repository now returns dicts, so access via dictionary notation
    started_at = job_run_data.get("started_at")
    completed_at = job_run_data.get("completed_at")

    # Calculate duration if job has completed
    duration_seconds = None
    if started_at and completed_at:
        # Handle both datetime objects and strings
        if isinstance(started_at, str):
            started_at = datetime.fromisoformat(started_at)
        if isinstance(completed_at, str):
            completed_at = datetime.fromisoformat(completed_at)
        if isinstance(started_at, datetime) and isinstance(completed_at, datetime):
            duration = completed_at - started_at
            duration_seconds = duration.total_seconds()

    # Parse target_devices JSON
    target_devices = None
    raw_target_devices = job_run_data.get("target_devices")
    if raw_target_devices:
        if isinstance(raw_target_devices, list):
            target_devices = raw_target_devices
        else:
            try:
                target_devices = json.loads(raw_target_devices)
            except (json.JSONDecodeError, TypeError):
                target_devices = None

    # Parse result JSON
    result = None
    raw_result = job_run_data.get("result")
    if raw_result:
        if isinstance(raw_result, dict):
            result = raw_result
        else:
            try:
                result = json.loads(raw_result)
            except (json.JSONDecodeError, TypeError):
                result = None

    # Get schedule and template names using ID lookups
    schedule_name = None
    template_name = None

    job_schedule_id = job_run_data.get("job_schedule_id")
    job_template_id = job_run_data.get("job_template_id")

    if job_schedule_id:
        schedule = jobs_manager.get_job_schedule(job_schedule_id)
        if schedule:
            schedule_name = schedule.get("job_identifier")

    if job_template_id:
        template = job_template_manager.get_job_template(job_template_id)
        if template:
            template_name = template.get("name")

    # Format datetime fields
    queued_at = job_run_data.get("queued_at")
    if isinstance(queued_at, datetime):
        queued_at = queued_at.isoformat()
    if isinstance(started_at, datetime):
        started_at = started_at.isoformat()
    if isinstance(completed_at, datetime):
        completed_at = completed_at.isoformat()

    return {
        "id": job_run_data.get("id"),
        "job_schedule_id": job_schedule_id,
        "job_template_id": job_template_id,
        "celery_task_id": job_run_data.get("celery_task_id"),
        "job_name": job_run_data.get("job_name"),
        "job_type": job_run_data.get("job_type"),
        "status": job_run_data.get("status"),
        "triggered_by": job_run_data.get("triggered_by"),
        "queued_at": queued_at,
        "started_at": started_at,
        "completed_at": completed_at,
        "duration_seconds": duration_seconds,
        "error_message": job_run_data.get("error_message"),
        "result": result,
        "target_devices": target_devices,
        "executed_by": job_run_data.get("executed_by"),
        "schedule_name": schedule_name,
        "template_name": template_name,
    }
