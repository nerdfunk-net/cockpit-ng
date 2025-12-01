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
        logger.info(f"Test task received: {message}")
        time.sleep(2)  # Simulate some work

        return {"success": True, "message": message, "timestamp": time.time()}

    except Exception as e:
        logger.error(f"Test task failed: {e}")
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
        logger.info(f"Test progress task started: {duration} seconds")

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
        logger.error(f"Test progress task failed: {e}")
        return {"success": False, "error": str(e)}
