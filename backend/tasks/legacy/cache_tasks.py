"""
DEPRECATED Legacy task.
Use new job system (dispatch_job) instead.
Will be removed in future version.
"""

from celery import shared_task
import logging
from typing import Optional

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="tasks.cache_devices")
def cache_devices_task(self, job_schedule_id: Optional[int] = None) -> dict:
    """
    Task: Cache all devices from Nautobot.

    This task fetches device data from Nautobot and stores it in the cache
    for faster access throughout the application.

    Args:
        job_schedule_id: Optional ID of the job schedule that triggered this task

    Returns:
        dict: Task execution results
    """
    try:
        logger.info(f"Starting cache_devices task (job_schedule_id: {job_schedule_id})")

        # Update task state to show progress
        self.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": 100, "status": "Connecting to Nautobot..."},
        )

        # Import here to avoid circular imports
        from services.nautobot import nautobot_service
        from services.cache_service import cache_service
        import asyncio

        # Create event loop for async operations
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            # Fetch all devices from Nautobot
            self.update_state(
                state="PROGRESS",
                meta={"current": 30, "total": 100, "status": "Fetching devices..."},
            )

            # Use the existing get-all-devices job functionality
            # This is a placeholder - you'll need to adapt this to your actual implementation
            query = """
            query getAllDevices {
              devices {
                id
                name
                role {
                  name
                }
                location {
                  name
                }
                primary_ip4 {
                  address
                }
                status {
                  name
                }
                device_type {
                  model
                }
              }
            }
            """

            result = loop.run_until_complete(nautobot_service.graphql_query(query))

            self.update_state(
                state="PROGRESS",
                meta={"current": 70, "total": 100, "status": "Caching device data..."},
            )

            if "errors" in result:
                logger.error(f"GraphQL errors: {result['errors']}")
                return {
                    "success": False,
                    "error": f"GraphQL errors: {result['errors']}",
                    "job_schedule_id": job_schedule_id,
                }

            devices = result.get("data", {}).get("devices", [])

            # Cache each device
            for device in devices:
                device_id = device.get("id")
                if device_id:
                    cache_key = f"nautobot:devices:{device_id}"
                    cache_service.set(cache_key, device, 30 * 60)  # 30 minutes TTL

            self.update_state(
                state="PROGRESS",
                meta={"current": 100, "total": 100, "status": "Complete"},
            )

            logger.info(f"Successfully cached {len(devices)} devices")

            return {
                "success": True,
                "devices_cached": len(devices),
                "message": f"Cached {len(devices)} devices from Nautobot",
                "job_schedule_id": job_schedule_id,
            }

        finally:
            loop.close()

    except Exception as e:
        logger.error(f"cache_devices task failed: {e}", exc_info=True)
        return {"success": False, "error": str(e), "job_schedule_id": job_schedule_id}
