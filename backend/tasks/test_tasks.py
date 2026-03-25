"""
Test tasks for Celery functionality verification.
"""

from celery import shared_task
import logging
import time

logger = logging.getLogger(__name__)


@shared_task(name="tasks.test_task")
def test_task(message: str = "Hello from Celery!") -> dict:
    """
    Simple test task to verify Celery is working.

    Args:
        message: Message to return

    Returns:
        dict: Result with success status and message
    """
    try:
        logger.info("Test task received: %s", message)
        time.sleep(2)  # Simulate some work

        return {"success": True, "message": message, "timestamp": time.time()}

    except Exception as e:
        logger.error("Test task failed: %s", e)
        return {"success": False, "error": str(e)}


@shared_task(bind=True, name="tasks.test_progress_task")
def test_progress_task(self, duration: int = 10) -> dict:
    """
    Test task that reports progress updates.

    Args:
        self: Task instance (for updating state)
        duration: Duration in seconds

    Returns:
        dict: Result with success status
    """
    try:
        logger.info("Test progress task started: %s seconds", duration)

        for i in range(duration):
            self.update_state(
                state="PROGRESS",
                meta={
                    "current": i + 1,
                    "total": duration,
                    "status": f"Processing step {i + 1} of {duration}",
                },
            )
            time.sleep(1)

        return {
            "success": True,
            "message": f"Completed {duration} steps",
            "duration": duration,
        }

    except Exception as e:
        logger.error("Test progress task failed: %s", e)
        return {"success": False, "error": str(e)}


@shared_task(bind=True, name="tasks.debug_wait_task")
def debug_wait_task(self, duration: int = 60, job_run_id: int = None) -> dict:
    """
    Debug task that waits for a given duration and tracks itself in job_runs.

    Used to verify that the Job History page polls correctly for running jobs
    and that the Refresh button updates the UI.

    Args:
        self: Task instance (for updating state)
        duration: Duration in seconds (default: 60)
        job_run_id: ID of the job_run record to update

    Returns:
        dict: Result with success status
    """
    import job_run_manager

    logger.info("DEBUG wait task started (duration=%ss, job_run_id=%s)", duration, job_run_id)

    try:
        if job_run_id:
            job_run_manager.mark_started(job_run_id, self.request.id)

        for i in range(duration):
            self.update_state(
                state="PROGRESS",
                meta={
                    "current": i + 1,
                    "total": duration,
                    "status": f"Waiting… {i + 1}/{duration}s",
                },
            )
            time.sleep(1)

        result = {
            "success": True,
            "message": f"Debug wait completed after {duration}s",
            "duration": duration,
        }

        if job_run_id:
            job_run_manager.mark_completed(job_run_id, result=result)

        logger.info("DEBUG wait task finished (job_run_id=%s)", job_run_id)
        return result

    except Exception as e:
        error_msg = str(e)
        logger.error("DEBUG wait task failed: %s", error_msg)

        if job_run_id:
            job_run_manager.mark_failed(job_run_id, error_msg)

        return {"success": False, "error": error_msg}
