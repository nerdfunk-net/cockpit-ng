"""
Periodic tasks executed by Celery Beat.
These tasks run on a schedule defined in beat_schedule.py
"""

from celery import shared_task
from celery_app import celery_app
import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)


def _get_last_cache_run(cache_type: str) -> Optional[datetime]:
    """Read last run timestamp for a cache type from Redis."""
    try:
        import redis
        from config import settings

        r = redis.from_url(settings.redis_url)
        key = "cockpit-ng:cache:last_run:%s" % cache_type
        value = r.get(key)
        if value:
            return datetime.fromisoformat(value.decode())
        return None
    except Exception as e:
        logger.warning("Failed to read last cache run for %s: %s", cache_type, e)
        return None


def _set_last_cache_run(cache_type: str, ts: datetime) -> None:
    """Write last run timestamp for a cache type to Redis (TTL: 7 days)."""
    try:
        import redis
        from config import settings

        r = redis.from_url(settings.redis_url)
        key = "cockpit-ng:cache:last_run:%s" % cache_type
        r.set(key, ts.isoformat(), ex=604800)  # 7 days TTL
    except Exception as e:
        logger.warning("Failed to write last cache run for %s: %s", cache_type, e)


@shared_task(name="tasks.worker_health_check")
def worker_health_check() -> dict:
    """
    Periodic task: Health check for Celery workers.

    Runs every 5 minutes (configured in beat_schedule.py)
    Monitors worker health and logs status.

    Returns:
        dict: Health check results
    """
    try:
        inspect = celery_app.control.inspect()
        stats = inspect.stats()

        active_workers = len(stats) if stats else 0

        logger.info("Health check: %s workers active", active_workers)

        return {
            "success": True,
            "active_workers": active_workers,
            "message": "%d workers active" % active_workers,
        }

    except Exception as e:
        logger.error("Health check failed: %s", e)
        return {"success": False, "error": str(e)}


@shared_task(name="tasks.load_cache_schedules")
def load_cache_schedules_task() -> dict:
    """
    Periodic task: Check cache settings and dispatch cache tasks when due.

    Runs every minute. Checks the configured intervals for:
    - devices_cache_interval_minutes
    - locations_cache_interval_minutes
    - git_commits_cache_interval_minutes

    Dispatches the appropriate cache task with job tracking when due.
    """
    try:
        from settings_manager import settings_manager

        cache_settings = settings_manager.get_cache_settings()

        if not cache_settings.get("enabled", True):
            return {"success": True, "message": "Cache disabled", "dispatched": []}

        now = datetime.now(timezone.utc)
        dispatched = []

        # Check devices cache
        devices_interval = cache_settings.get("devices_cache_interval_minutes", 60)
        if devices_interval > 0:
            last_run = _get_last_cache_run("devices")
            if (
                last_run is None
                or (now - last_run).total_seconds() >= devices_interval * 60
            ):
                dispatch_cache_task.delay(
                    cache_type="devices", task_name="cache_all_devices"
                )
                _set_last_cache_run("devices", now)
                dispatched.append("devices")
                logger.info(
                    "Dispatched devices cache task (interval: %sm)", devices_interval
                )

        # Check locations cache
        locations_interval = cache_settings.get("locations_cache_interval_minutes", 10)
        if locations_interval > 0:
            last_run = _get_last_cache_run("locations")
            if (
                last_run is None
                or (now - last_run).total_seconds() >= locations_interval * 60
            ):
                dispatch_cache_task.delay(
                    cache_type="locations", task_name="cache_all_locations"
                )
                _set_last_cache_run("locations", now)
                dispatched.append("locations")
                logger.info(
                    "Dispatched locations cache task (interval: %sm)",
                    locations_interval,
                )

        return {
            "success": True,
            "checked_at": now.isoformat(),
            "dispatched": dispatched,
            "intervals": {
                "devices": devices_interval,
                "locations": locations_interval,
            },
        }

    except Exception as e:
        logger.error("Error in load_cache_schedules: %s", e, exc_info=True)
        return {"success": False, "error": str(e)}


@shared_task(bind=True, name="tasks.dispatch_cache_task")
def dispatch_cache_task(self, cache_type: str, task_name: str) -> dict:
    """
    Create a job run record and dispatch the named cache task asynchronously.

    The cache task itself is responsible for calling mark_completed / mark_failed
    via the job_run_id kwarg passed here.

    Args:
        cache_type: Human-readable type (devices, locations)
        task_name: Celery task name string (cache_all_devices, cache_all_locations)
    """
    try:
        import job_run_manager
        from services.background_jobs import cache_all_devices_task, cache_all_locations_task

        task_map = {
            "cache_all_devices": cache_all_devices_task,
            "cache_all_locations": cache_all_locations_task,
        }

        celery_task = task_map.get(task_name)
        if not celery_task:
            logger.error("Unknown cache task: %s", task_name)
            return {"success": False, "error": "Unknown task: %s" % task_name}

        # Create job run record before dispatching
        job_run = job_run_manager.create_job_run(
            job_name="Cache %s" % cache_type.replace("_", " ").title(),
            job_type="cache_%s" % cache_type,
            triggered_by="system",
        )
        job_run_id = job_run["id"]

        # Dispatch asynchronously — the cache task marks itself completed/failed
        async_result = celery_task.apply_async(kwargs={"job_run_id": job_run_id})

        # Mark started with the REAL task ID
        job_run_manager.mark_started(job_run_id, async_result.id)

        logger.info(
            "Dispatched %s cache task (job_run=%s, celery_task=%s)",
            cache_type,
            job_run_id,
            async_result.id,
        )

        return {
            "success": True,
            "job_run_id": job_run_id,
            "celery_task_id": async_result.id,
        }

    except Exception as e:
        logger.error(
            "Error dispatching cache task %s: %s", cache_type, e, exc_info=True
        )
        return {"success": False, "error": str(e)}


@shared_task(name="tasks.cleanup_celery_data")
def cleanup_celery_data_task() -> dict:
    """
    Cleanup old Celery task results and job run data.

    This task:
    1. Reads cleanup_age_hours from Celery settings
    2. Removes task results from Redis older than the configured age
    3. Removes old job run records from database

    Returns:
        dict: Cleanup results with counts of removed items
    """
    try:
        from settings_manager import settings_manager
        from datetime import datetime, timezone, timedelta
        from config import settings
        import redis
        import json

        # Get cleanup settings
        celery_settings = settings_manager.get_celery_settings()
        cleanup_age_hours = celery_settings.get("cleanup_age_hours", 24)

        if not celery_settings.get("cleanup_enabled", True):
            return {
                "success": True,
                "message": "Cleanup is disabled",
                "removed_results": 0,
                "removed_job_runs": 0,
            }

        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=cleanup_age_hours)

        logger.info(
            "Starting Celery cleanup: removing data older than %s hours",
            cleanup_age_hours,
        )

        # Connect to Redis
        r = redis.from_url(settings.redis_url)

        # Count and remove old task results
        removed_results = 0
        result_keys = list(r.scan_iter("celery-task-meta-*"))

        for key in result_keys:
            try:
                # Get the result data
                data = r.get(key)
                if data:
                    result_data = json.loads(data)
                    # Check if task has a date_done field
                    date_done = result_data.get("date_done")
                    if date_done:
                        # Parse the date (Celery stores it as ISO format)
                        if isinstance(date_done, str):
                            task_time = datetime.fromisoformat(
                                date_done.replace("Z", "+00:00")
                            )
                            if task_time < cutoff_time:
                                r.delete(key)
                                removed_results += 1
            except Exception as e:
                logger.debug("Error processing key %s: %s", key, e)
                continue

        # Remove old job runs from database
        removed_job_runs = 0
        try:
            import job_run_manager

            # Use the hours-based cleanup function
            removed_job_runs = job_run_manager.cleanup_old_runs_hours(cleanup_age_hours)
        except Exception as e:
            logger.warning("Error cleaning up job runs: %s", e)

        logger.info(
            "Cleanup completed: %s results, %s job runs removed",
            removed_results,
            removed_job_runs,
        )

        return {
            "success": True,
            "message": "Cleanup completed",
            "cleanup_age_hours": cleanup_age_hours,
            "cutoff_time": cutoff_time.isoformat(),
            "removed_results": removed_results,
            "removed_job_runs": removed_job_runs,
        }

    except Exception as e:
        logger.error("Cleanup task failed: %s", e)
        return {"success": False, "error": str(e)}


@shared_task(name="tasks.check_stale_jobs")
def check_stale_jobs_task() -> dict:
    """
    Periodic task: Detect and mark stale/crashed jobs as failed.

    A job is considered stale if:
    - Status is 'running' or 'pending'
    - Started more than 2 hours ago (or pending more than 1 hour)
    - Celery task ID doesn't exist in active/reserved tasks

    Runs every 10 minutes.
    """
    try:
        import job_run_manager
        from celery_app import celery_app

        # Get all running/pending jobs
        running_jobs = job_run_manager.get_recent_runs(limit=500, status="running")
        pending_jobs = job_run_manager.get_recent_runs(limit=500, status="pending")

        # Get active Celery tasks
        inspect = celery_app.control.inspect()
        active_tasks = inspect.active() or {}
        reserved_tasks = inspect.reserved() or {}

        # Collect all active task IDs
        active_task_ids = set()
        for worker_tasks in active_tasks.values():
            active_task_ids.update(task["id"] for task in worker_tasks)
        for worker_tasks in reserved_tasks.values():
            active_task_ids.update(task["id"] for task in worker_tasks)

        now = datetime.now(timezone.utc)
        marked_failed = []

        # Check running jobs
        for job in running_jobs:
            started_at = job.get("started_at")
            celery_task_id = job.get("celery_task_id")

            if not started_at:
                continue

            # Parse datetime
            if isinstance(started_at, str):
                started_at = datetime.fromisoformat(started_at.replace("Z", "+00:00"))

            # Job running for more than 2 hours
            running_duration = (now - started_at).total_seconds()
            if running_duration > 7200:  # 2 hours
                # Check if task still exists in Celery
                if celery_task_id not in active_task_ids:
                    job_run_manager.mark_failed(
                        job["id"],
                        "Job marked as failed - exceeded maximum runtime (2 hours) and not found in active tasks",
                    )
                    marked_failed.append(
                        {
                            "job_id": job["id"],
                            "job_name": job["job_name"],
                            "running_duration": int(running_duration),
                        }
                    )
                    logger.warning(
                        "Marked stale job %s (%s) as failed - running for %s minutes",
                        job["id"],
                        job["job_name"],
                        int(running_duration / 60),
                    )

        # Check pending jobs
        for job in pending_jobs:
            queued_at = job.get("queued_at")
            if not queued_at:
                continue

            # Parse datetime
            if isinstance(queued_at, str):
                queued_at = datetime.fromisoformat(queued_at.replace("Z", "+00:00"))

            # Job pending for more than 1 hour
            pending_duration = (now - queued_at).total_seconds()
            if pending_duration > 3600:  # 1 hour
                job_run_manager.mark_failed(
                    job["id"],
                    "Job marked as failed - stuck in pending state for over 1 hour",
                )
                marked_failed.append(
                    {
                        "job_id": job["id"],
                        "job_name": job["job_name"],
                        "pending_duration": int(pending_duration),
                    }
                )
                logger.warning(
                    "Marked pending job %s (%s) as failed - pending for %s minutes",
                    job["id"],
                    job["job_name"],
                    int(pending_duration / 60),
                )

        if marked_failed:
            logger.info(
                "Stale job check: marked %s job(s) as failed", len(marked_failed)
            )

        return {
            "success": True,
            "stale_jobs_found": len(marked_failed),
            "marked_failed": marked_failed,
        }

    except Exception as e:
        logger.error("Error checking stale jobs: %s", e, exc_info=True)
        return {"success": False, "error": str(e)}


@shared_task(name="tasks.cleanup_audit_logs")
def cleanup_audit_logs_task() -> dict:
    """
    Cleanup old audit log entries based on the PURGE_LOGS environment variable.

    Runs once per day (configured in beat_schedule.py).
    Deletes all audit_logs rows older than PURGE_LOGS days.
    Set PURGE_LOGS=0 (default) to disable cleanup.

    Returns:
        dict: Result with number of deleted rows
    """
    try:
        from config import settings
        from datetime import datetime, timezone, timedelta
        from core.database import db_transaction
        from core.models import AuditLog

        purge_days = settings.purge_logs_days

        if purge_days <= 0:
            logger.info("Audit log cleanup disabled (PURGE_LOGS not set or 0)")
            return {
                "success": True,
                "message": "Audit log cleanup disabled",
                "deleted": 0,
            }

        cutoff = datetime.now(timezone.utc) - timedelta(days=purge_days)

        logger.info(
            "Starting audit log cleanup: removing entries older than %s days (before %s)",
            purge_days,
            cutoff.isoformat(),
        )

        with db_transaction() as db:
            deleted = (
                db.query(AuditLog)
                .filter(AuditLog.created_at < cutoff)
                .delete(synchronize_session=False)
            )

        logger.info("Audit log cleanup completed: %s entries deleted", deleted)

        return {
            "success": True,
            "message": f"Deleted {deleted} audit log entries older than {purge_days} days",
            "purge_days": purge_days,
            "cutoff_time": cutoff.isoformat(),
            "deleted": deleted,
        }

    except Exception as e:
        logger.error("Audit log cleanup task failed: %s", e)
        return {"success": False, "error": str(e)}
