"""
Job Schedule Database Manager
Handles CRUD operations for scheduled jobs using PostgreSQL and repository pattern.
"""

import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta, timezone
import json

from croniter import croniter

from repositories.jobs.job_schedule_repository import JobScheduleRepository
from job_template_manager import get_job_template

logger = logging.getLogger(__name__)

# Initialize repository
repo = JobScheduleRepository()


def create_job_schedule(
    job_identifier: str,
    job_template_id: int,
    schedule_type: str,
    is_active: bool = True,
    is_global: bool = True,
    user_id: Optional[int] = None,
    cron_expression: Optional[str] = None,
    interval_minutes: Optional[int] = None,
    start_time: Optional[str] = None,
    start_date: Optional[str] = None,
    credential_id: Optional[int] = None,
    job_parameters: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Create a new job schedule"""
    # Convert job_parameters to JSON string
    params_json = json.dumps(job_parameters) if job_parameters else None

    # Calculate initial next_run
    temp_schedule = {
        "schedule_type": schedule_type,
        "cron_expression": cron_expression,
        "interval_minutes": interval_minutes,
        "start_time": start_time,
        "start_date": start_date,
    }
    initial_next_run = calculate_next_run(temp_schedule) if is_active else None

    schedule = repo.create(
        job_identifier=job_identifier,
        job_template_id=job_template_id,
        schedule_type=schedule_type,
        cron_expression=cron_expression,
        interval_minutes=interval_minutes,
        start_time=start_time,
        start_date=start_date,
        is_active=is_active,
        is_global=is_global,
        user_id=user_id,
        credential_id=credential_id,
        job_parameters=params_json,
        next_run=initial_next_run,
    )

    logger.info(
        f"Created job schedule: {job_identifier} (ID: {schedule.id}, next_run: {initial_next_run})"
    )
    return _model_to_dict(schedule)


def get_job_schedule(job_id: int) -> Optional[Dict[str, Any]]:
    """Get a job schedule by ID"""
    schedule = repo.get_by_id(job_id)
    if schedule:
        return _model_to_dict(schedule)
    return None


def list_job_schedules(
    user_id: Optional[int] = None,
    is_global: Optional[bool] = None,
    is_active: Optional[bool] = None,
) -> List[Dict[str, Any]]:
    """List job schedules with optional filters"""
    schedules = repo.get_with_filters(
        user_id=user_id, is_global=is_global, is_active=is_active
    )
    return [_model_to_dict(s) for s in schedules]


def update_job_schedule(
    job_id: int,
    job_identifier: Optional[str] = None,
    schedule_type: Optional[str] = None,
    cron_expression: Optional[str] = None,
    interval_minutes: Optional[int] = None,
    start_time: Optional[str] = None,
    start_date: Optional[str] = None,
    is_active: Optional[bool] = None,
    credential_id: Optional[int] = None,
    job_parameters: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """Update a job schedule"""
    # Get current schedule to check for schedule changes
    current = get_job_schedule(job_id)
    if not current:
        return None

    # Build update kwargs
    update_data = {}

    if job_identifier is not None:
        update_data["job_identifier"] = job_identifier
    if schedule_type is not None:
        update_data["schedule_type"] = schedule_type
    if cron_expression is not None:
        update_data["cron_expression"] = cron_expression
    if interval_minutes is not None:
        update_data["interval_minutes"] = interval_minutes
    if start_time is not None:
        update_data["start_time"] = start_time
    if start_date is not None:
        update_data["start_date"] = start_date
    if is_active is not None:
        update_data["is_active"] = is_active
    if credential_id is not None:
        update_data["credential_id"] = credential_id
    if job_parameters is not None:
        update_data["job_parameters"] = json.dumps(job_parameters)

    if not update_data:
        return get_job_schedule(job_id)

    # Check if schedule timing parameters changed - recalculate next_run
    schedule_changed = any(
        k in update_data
        for k in [
            "schedule_type",
            "cron_expression",
            "interval_minutes",
            "start_time",
            "start_date",
        ]
    )
    active_changed = "is_active" in update_data

    if schedule_changed or active_changed:
        # Build merged schedule to calculate next_run
        merged = {
            "schedule_type": update_data.get(
                "schedule_type", current.get("schedule_type")
            ),
            "cron_expression": update_data.get(
                "cron_expression", current.get("cron_expression")
            ),
            "interval_minutes": update_data.get(
                "interval_minutes", current.get("interval_minutes")
            ),
            "start_time": update_data.get("start_time", current.get("start_time")),
            "start_date": update_data.get("start_date", current.get("start_date")),
        }
        is_now_active = update_data.get("is_active", current.get("is_active"))

        if is_now_active:
            update_data["next_run"] = calculate_next_run(merged)
        else:
            update_data["next_run"] = None

    schedule = repo.update(job_id, **update_data)
    if schedule:
        logger.info(f"Updated job schedule ID: {job_id}")
        return _model_to_dict(schedule)
    return None


def delete_job_schedule(job_id: int) -> bool:
    """Delete a job schedule"""
    deleted = repo.delete(job_id)
    if deleted:
        logger.info(f"Deleted job schedule ID: {job_id}")
    return deleted


def update_job_run_times(
    job_id: int,
    last_run: Optional[datetime] = None,
    next_run: Optional[datetime] = None,
) -> bool:
    """Update last_run and next_run times for a job"""
    update_data = {}

    if last_run is not None:
        update_data["last_run"] = last_run

    if next_run is not None:
        update_data["next_run"] = next_run

    if not update_data:
        return False

    schedule = repo.update(job_id, **update_data)
    return schedule is not None


def get_user_job_schedules(user_id: int) -> List[Dict[str, Any]]:
    """Get all job schedules accessible by a user (global + their private jobs)"""
    schedules = repo.get_user_schedules(user_id)
    return [_model_to_dict(s) for s in schedules]


def get_global_job_schedules() -> List[Dict[str, Any]]:
    """Get all global job schedules"""
    schedules = repo.get_global_schedules()
    return [_model_to_dict(s) for s in schedules]


def initialize_schedule_next_runs() -> Dict[str, Any]:
    """
    Initialize next_run for all active schedules that don't have one set.
    Called on startup or manually to fix schedules.

    Returns:
        Dict with count of initialized schedules
    """
    schedules = list_job_schedules(is_active=True)
    initialized = 0

    for schedule in schedules:
        if schedule.get("next_run") is None:
            next_run = calculate_next_run(schedule)
            if next_run:
                update_job_run_times(schedule["id"], next_run=next_run)
                logger.info(
                    f"Initialized next_run for schedule {schedule['id']}: {next_run.isoformat()}"
                )
                initialized += 1

    return {"initialized_count": initialized, "total_active": len(schedules)}


def _model_to_dict(schedule) -> Dict[str, Any]:
    """Convert JobSchedule model to dictionary"""
    # Get template info if available
    template_name = None
    template_job_type = None
    if schedule.job_template_id:
        template = get_job_template(schedule.job_template_id)
        if template:
            template_name = template.get("name")
            template_job_type = template.get("job_type")

    result = {
        "id": schedule.id,
        "job_identifier": schedule.job_identifier,
        "job_template_id": schedule.job_template_id,
        "template_name": template_name,
        "template_job_type": template_job_type,
        "schedule_type": schedule.schedule_type,
        "cron_expression": schedule.cron_expression,
        "interval_minutes": schedule.interval_minutes,
        "start_time": schedule.start_time,
        "start_date": schedule.start_date,
        "is_active": schedule.is_active,
        "is_global": schedule.is_global,
        "user_id": schedule.user_id,
        "credential_id": schedule.credential_id,
        "job_parameters": json.loads(schedule.job_parameters)
        if schedule.job_parameters
        else None,
        "created_at": schedule.created_at.isoformat() if schedule.created_at else None,
        "updated_at": schedule.updated_at.isoformat() if schedule.updated_at else None,
        "last_run": schedule.last_run.isoformat() if schedule.last_run else None,
        "next_run": schedule.next_run.isoformat() if schedule.next_run else None,
    }
    return result


def calculate_next_run(
    schedule: Dict[str, Any], base_time: Optional[datetime] = None
) -> Optional[datetime]:
    """
    Calculate the next run time for a schedule.

    Args:
        schedule: Schedule dictionary with schedule_type, cron_expression, etc.
        base_time: Base time to calculate from (defaults to now)

    Returns:
        Next run datetime or None for 'now' schedule_type
    """
    if base_time is None:
        base_time = datetime.now(timezone.utc)

    schedule_type = schedule.get("schedule_type")

    if schedule_type == "now":
        # One-time immediate execution - no next run
        return None

    elif schedule_type == "custom" and schedule.get("cron_expression"):
        # Use croniter to calculate next run from cron expression
        try:
            cron = croniter(schedule["cron_expression"], base_time)
            return cron.get_next(datetime)
        except (ValueError, KeyError) as e:
            logger.error(f"Invalid cron expression: {schedule['cron_expression']}: {e}")
            return None

    elif schedule_type == "interval":
        # Interval in minutes
        interval_minutes = schedule.get("interval_minutes", 60)
        return base_time + timedelta(minutes=interval_minutes)

    elif schedule_type == "hourly":
        # Next hour at the specified minute (or :00)
        next_run = base_time.replace(minute=0, second=0, microsecond=0) + timedelta(
            hours=1
        )
        return next_run

    elif schedule_type == "daily":
        # Next occurrence at the specified time
        start_time = schedule.get("start_time", "00:00")
        try:
            hour, minute = map(int, start_time.split(":"))
            next_run = base_time.replace(
                hour=hour, minute=minute, second=0, microsecond=0
            )
            if next_run <= base_time:
                next_run += timedelta(days=1)
            return next_run
        except (ValueError, AttributeError):
            return base_time + timedelta(days=1)

    elif schedule_type == "weekly":
        # Next week at the same time
        start_time = schedule.get("start_time", "00:00")
        try:
            hour, minute = map(int, start_time.split(":"))
            next_run = base_time.replace(
                hour=hour, minute=minute, second=0, microsecond=0
            )
            next_run += timedelta(days=7)
            return next_run
        except (ValueError, AttributeError):
            return base_time + timedelta(days=7)

    elif schedule_type == "monthly":
        # Next month at the same day and time
        start_time = schedule.get("start_time", "00:00")
        try:
            hour, minute = map(int, start_time.split(":"))
            # Move to next month
            if base_time.month == 12:
                next_run = base_time.replace(
                    year=base_time.year + 1,
                    month=1,
                    day=base_time.day,
                    hour=hour,
                    minute=minute,
                    second=0,
                    microsecond=0,
                )
            else:
                next_run = base_time.replace(
                    month=base_time.month + 1,
                    hour=hour,
                    minute=minute,
                    second=0,
                    microsecond=0,
                )
            return next_run
        except (ValueError, AttributeError):
            return base_time + timedelta(days=30)

    return None


def calculate_and_update_next_run(job_id: int) -> Optional[Dict[str, Any]]:
    """
    Calculate and update the next run time for a schedule.
    Also updates last_run to now.

    Args:
        job_id: ID of the job schedule

    Returns:
        Updated schedule dict or None if not found
    """
    schedule = get_job_schedule(job_id)
    if not schedule:
        logger.warning(f"Schedule {job_id} not found for next_run calculation")
        return None

    now = datetime.now(timezone.utc)
    next_run = calculate_next_run(schedule, base_time=now)

    # Update the schedule with new times
    update_job_run_times(job_id, last_run=now, next_run=next_run)

    logger.debug(
        f"Updated schedule {job_id}: last_run={now.isoformat()}, next_run={next_run.isoformat() if next_run else None}"
    )

    return get_job_schedule(job_id)
