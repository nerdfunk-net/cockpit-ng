"""
DEPRECATED Legacy task.
Use new job system (dispatch_job) instead.
Will be removed in future version.
"""

from celery import shared_task
import logging
from typing import Optional

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="tasks.sync_checkmk")
def sync_checkmk_task(self, job_schedule_id: Optional[int] = None) -> dict:
    """
    Task: Synchronize devices to CheckMK.

    This task syncs device information from Nautobot to CheckMK monitoring system.

    Args:
        job_schedule_id: Optional ID of the job schedule that triggered this task

    Returns:
        dict: Task execution results
    """
    try:
        logger.info(f"Starting sync_checkmk task (job_schedule_id: {job_schedule_id})")

        self.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": 100, "status": "Starting CheckMK sync..."},
        )

        # Import here to avoid circular imports
        from services.nb2cmk_background_service import background_service
        import asyncio

        # Create event loop for async operations
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            self.update_state(
                state="PROGRESS",
                meta={"current": 30, "total": 100, "status": "Syncing to CheckMK..."},
            )

            # Trigger the sync - this is a placeholder
            # You'll need to adapt this to your actual CheckMK sync implementation
            result = loop.run_until_complete(background_service.trigger_sync())

            self.update_state(
                state="PROGRESS",
                meta={"current": 100, "total": 100, "status": "Complete"},
            )

            logger.info("CheckMK sync completed successfully")

            return {
                "success": True,
                "message": "CheckMK sync completed",
                "result": result,
                "job_schedule_id": job_schedule_id,
            }

        finally:
            loop.close()

    except Exception as e:
        logger.error(f"sync_checkmk task failed: {e}", exc_info=True)
        return {"success": False, "error": str(e), "job_schedule_id": job_schedule_id}
