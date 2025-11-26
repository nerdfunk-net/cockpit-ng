"""
Job Schedule Database Manager
Handles CRUD operations for scheduled jobs using PostgreSQL and repository pattern.
"""
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
import json

from repositories.job_schedule_repository import JobScheduleRepository

logger = logging.getLogger(__name__)

# Initialize repository
repo = JobScheduleRepository()


def create_job_schedule(
    job_identifier: str,
    job_name: str,
    schedule_type: str,
    is_active: bool = True,
    is_global: bool = True,
    user_id: Optional[int] = None,
    cron_expression: Optional[str] = None,
    interval_minutes: Optional[int] = None,
    start_time: Optional[str] = None,
    start_date: Optional[str] = None,
    credential_id: Optional[int] = None,
    job_parameters: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Create a new job schedule"""
    # Convert job_parameters to JSON string
    params_json = json.dumps(job_parameters) if job_parameters else None

    schedule = repo.create(
        job_identifier=job_identifier,
        job_name=job_name,
        schedule_type=schedule_type,
        cron_expression=cron_expression,
        interval_minutes=interval_minutes,
        start_time=start_time,
        start_date=start_date,
        is_active=is_active,
        is_global=is_global,
        user_id=user_id,
        credential_id=credential_id,
        job_parameters=params_json
    )

    logger.info(f"Created job schedule: {job_name} (ID: {schedule.id})")
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
    is_active: Optional[bool] = None
) -> List[Dict[str, Any]]:
    """List job schedules with optional filters"""
    schedules = repo.get_with_filters(
        user_id=user_id,
        is_global=is_global,
        is_active=is_active
    )
    return [_model_to_dict(s) for s in schedules]


def update_job_schedule(
    job_id: int,
    job_name: Optional[str] = None,
    schedule_type: Optional[str] = None,
    cron_expression: Optional[str] = None,
    interval_minutes: Optional[int] = None,
    start_time: Optional[str] = None,
    start_date: Optional[str] = None,
    is_active: Optional[bool] = None,
    credential_id: Optional[int] = None,
    job_parameters: Optional[Dict[str, Any]] = None
) -> Optional[Dict[str, Any]]:
    """Update a job schedule"""
    # Build update kwargs
    update_data = {}
    
    if job_name is not None:
        update_data['job_name'] = job_name
    if schedule_type is not None:
        update_data['schedule_type'] = schedule_type
    if cron_expression is not None:
        update_data['cron_expression'] = cron_expression
    if interval_minutes is not None:
        update_data['interval_minutes'] = interval_minutes
    if start_time is not None:
        update_data['start_time'] = start_time
    if start_date is not None:
        update_data['start_date'] = start_date
    if is_active is not None:
        update_data['is_active'] = is_active
    if credential_id is not None:
        update_data['credential_id'] = credential_id
    if job_parameters is not None:
        update_data['job_parameters'] = json.dumps(job_parameters)
    
    if not update_data:
        return get_job_schedule(job_id)
    
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
    next_run: Optional[datetime] = None
) -> bool:
    """Update last_run and next_run times for a job"""
    update_data = {}
    
    if last_run is not None:
        update_data['last_run'] = last_run
    
    if next_run is not None:
        update_data['next_run'] = next_run
    
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


def _model_to_dict(schedule) -> Dict[str, Any]:
    """Convert JobSchedule model to dictionary"""
    result = {
        'id': schedule.id,
        'job_identifier': schedule.job_identifier,
        'job_name': schedule.job_name,
        'schedule_type': schedule.schedule_type,
        'cron_expression': schedule.cron_expression,
        'interval_minutes': schedule.interval_minutes,
        'start_time': schedule.start_time,
        'start_date': schedule.start_date,
        'is_active': schedule.is_active,
        'is_global': schedule.is_global,
        'user_id': schedule.user_id,
        'credential_id': schedule.credential_id,
        'job_parameters': json.loads(schedule.job_parameters) if schedule.job_parameters else None,
        'created_at': schedule.created_at.isoformat() if schedule.created_at else None,
        'updated_at': schedule.updated_at.isoformat() if schedule.updated_at else None,
        'last_run': schedule.last_run.isoformat() if schedule.last_run else None,
        'next_run': schedule.next_run.isoformat() if schedule.next_run else None,
    }
    return result
