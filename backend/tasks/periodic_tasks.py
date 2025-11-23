"""
Periodic tasks executed by Celery Beat.
These tasks run on a schedule defined in beat_schedule.py
"""
from celery_app import celery_app
import logging

logger = logging.getLogger(__name__)


@celery_app.task(name='tasks.worker_health_check')
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
        active = inspect.active()
        stats = inspect.stats()

        active_workers = len(stats) if stats else 0

        logger.info(f"Health check: {active_workers} workers active")

        return {
            'success': True,
            'active_workers': active_workers,
            'message': f'{active_workers} workers active'
        }

    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            'success': False,
            'error': str(e)
        }
