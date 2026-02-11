"""
Periodic tasks executed by Celery Beat.
These tasks run on a schedule defined in beat_schedule.py
"""

from celery import shared_task
from celery_app import celery_app
import logging
from datetime import datetime, timezone
from typing import Dict

logger = logging.getLogger(__name__)

# Track last run times for cache tasks (in-memory, reset on worker restart)
_last_cache_runs: Dict[str, datetime] = {}


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

        # Get active workers
        inspect.active()
        stats = inspect.stats()

        active_workers = len(stats) if stats else 0

        logger.info(f"Health check: {active_workers} workers active")

        return {
            "success": True,
            "active_workers": active_workers,
            "message": f"{active_workers} workers active",
        }

    except Exception as e:
        logger.error(f"Health check failed: {e}")
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
    global _last_cache_runs

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
            last_run = _last_cache_runs.get("devices")
            if (
                last_run is None
                or (now - last_run).total_seconds() >= devices_interval * 60
            ):
                # Dispatch devices cache task with tracking
                dispatch_cache_task.delay(
                    cache_type="devices", task_name="cache_all_devices"
                )
                _last_cache_runs["devices"] = now
                dispatched.append("devices")
                logger.info(
                    f"Dispatched devices cache task (interval: {devices_interval}m)"
                )

        # Check locations cache
        locations_interval = cache_settings.get("locations_cache_interval_minutes", 10)
        if locations_interval > 0:
            last_run = _last_cache_runs.get("locations")
            if (
                last_run is None
                or (now - last_run).total_seconds() >= locations_interval * 60
            ):
                # Dispatch locations cache task with tracking
                dispatch_cache_task.delay(
                    cache_type="locations", task_name="cache_all_locations"
                )
                _last_cache_runs["locations"] = now
                dispatched.append("locations")
                logger.info(
                    f"Dispatched locations cache task (interval: {locations_interval}m)"
                )

        # Check git commits cache (placeholder for future implementation)
        git_interval = cache_settings.get("git_commits_cache_interval_minutes", 15)
        if git_interval > 0:
            last_run = _last_cache_runs.get("git_commits")
            if (
                last_run is None
                or (now - last_run).total_seconds() >= git_interval * 60
            ):
                # TODO: Dispatch git commits cache task when implemented
                # dispatch_cache_task.delay(
                #     cache_type='git_commits',
                #     task_name='cache_git_commits'
                # )
                _last_cache_runs["git_commits"] = now
                # dispatched.append('git_commits')
                logger.debug(
                    f"Git commits cache task not yet implemented (interval: {git_interval}m)"
                )

        return {
            "success": True,
            "checked_at": now.isoformat(),
            "dispatched": dispatched,
            "intervals": {
                "devices": devices_interval,
                "locations": locations_interval,
                "git_commits": git_interval,
            },
        }

    except Exception as e:
        logger.error(f"Error in load_cache_schedules: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


@shared_task(bind=True, name="tasks.dispatch_cache_task")
def dispatch_cache_task(self, cache_type: str, task_name: str) -> dict:
    """
    Dispatch a cache task and track it in job_runs.

    Args:
        cache_type: Type of cache (devices, locations, git_commits)
        task_name: Celery task name to execute
    """
    try:
        import job_run_manager

        # Create job run record
        job_run = job_run_manager.create_job_run(
            job_name=f"Cache {cache_type.replace('_', ' ').title()}",
            job_type=f"cache_{cache_type}",
            triggered_by="system",
        )
        job_run_id = job_run["id"]

        # Mark as started
        job_run_manager.mark_started(job_run_id, self.request.id)

        try:
            # Execute the actual cache task using .apply() to get a proper task context
            # This runs synchronously but gives the task access to self.request.id
            if task_name == "cache_all_devices":
                from services.background_jobs import cache_all_devices_task

                async_result = cache_all_devices_task.apply()
                result = (
                    async_result.result
                    if async_result.successful()
                    else {"status": "failed", "error": str(async_result.result)}
                )
            elif task_name == "cache_all_locations":
                from services.background_jobs import cache_all_locations_task

                async_result = cache_all_locations_task.apply()
                result = (
                    async_result.result
                    if async_result.successful()
                    else {"status": "failed", "error": str(async_result.result)}
                )
            elif task_name == "cache_git_commits":
                # Placeholder for git commits cache
                result = {
                    "status": "not_implemented",
                    "message": "Git commits cache not yet implemented",
                }
            else:
                result = {"status": "error", "message": f"Unknown task: {task_name}"}

            # Check result status
            status = result.get("status", "completed")
            if status in ["completed", "success"]:
                job_run_manager.mark_completed(job_run_id, result=result)
                return {"success": True, "job_run_id": job_run_id, "result": result}
            else:
                error_msg = (
                    result.get("error") or result.get("message") or "Unknown error"
                )
                job_run_manager.mark_failed(job_run_id, error_msg)
                return {"success": False, "job_run_id": job_run_id, "error": error_msg}

        except Exception as e:
            job_run_manager.mark_failed(job_run_id, str(e))
            raise

    except Exception as e:
        logger.error(f"Error dispatching cache task {cache_type}: {e}", exc_info=True)
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
            f"Starting Celery cleanup: removing data older than {cleanup_age_hours} hours"
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
                logger.debug(f"Error processing key {key}: {e}")
                continue

        # Remove old job runs from database
        removed_job_runs = 0
        try:
            import job_run_manager

            # Use the hours-based cleanup function
            removed_job_runs = job_run_manager.cleanup_old_runs_hours(cleanup_age_hours)
        except Exception as e:
            logger.warning(f"Error cleaning up job runs: {e}")

        logger.info(
            f"Cleanup completed: {removed_results} results, {removed_job_runs} job runs removed"
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
        logger.error(f"Cleanup task failed: {e}")
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
                        f"Marked stale job {job['id']} ({job['job_name']}) as failed - running for {int(running_duration / 60)} minutes"
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
                    f"Marked pending job {job['id']} ({job['job_name']}) as failed - pending for {int(pending_duration / 60)} minutes"
                )

        if marked_failed:
            logger.info(
                f"Stale job check: marked {len(marked_failed)} job(s) as failed"
            )

        return {
            "success": True,
            "stale_jobs_found": len(marked_failed),
            "marked_failed": marked_failed,
        }

    except Exception as e:
        logger.error(f"Error checking stale jobs: {e}", exc_info=True)
        return {"success": False, "error": str(e)}
