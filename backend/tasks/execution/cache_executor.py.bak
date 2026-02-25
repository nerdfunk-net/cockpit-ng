"""
Cache devices job executor.
Fetches devices from Nautobot and caches them in Redis.

Moved from job_tasks.py to improve code organization.
"""

import logging
import asyncio
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


def execute_cache_devices(
    schedule_id: Optional[int],
    credential_id: Optional[int],
    job_parameters: Optional[dict],
    target_devices: Optional[list],
    task_context,
    template: Optional[dict] = None,
    job_run_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Execute cache_devices job.

    Fetches all devices from Nautobot via GraphQL and caches them in Redis.

    Args:
        schedule_id: ID of schedule if triggered by schedule
        credential_id: ID of credential (not used for caching)
        job_parameters: Additional job parameters
        target_devices: List of target device UUIDs (not used - caches all)
        task_context: Celery task context for progress updates

    Returns:
        dict: Execution results with devices_cached count
    """
    try:
        task_context.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": 100, "status": "Connecting to Nautobot..."},
        )

        from services.nautobot import nautobot_service
        from services.settings.cache import cache_service

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            task_context.update_state(
                state="PROGRESS",
                meta={"current": 30, "total": 100, "status": "Fetching devices..."},
            )

            query = """
            query getAllDevices {
              devices {
                id
                name
                role { name }
                location { name }
                primary_ip4 { address }
                status { name }
                device_type { model }
              }
            }
            """

            result = loop.run_until_complete(nautobot_service.graphql_query(query))

            if "errors" in result:
                return {
                    "success": False,
                    "error": f"GraphQL errors: {result['errors']}",
                }

            devices = result.get("data", {}).get("devices", [])

            task_context.update_state(
                state="PROGRESS",
                meta={"current": 70, "total": 100, "status": "Caching device data..."},
            )

            for device in devices:
                device_id = device.get("id")
                if device_id:
                    cache_key = f"nautobot:devices:{device_id}"
                    cache_service.set(cache_key, device, 30 * 60)

            return {
                "success": True,
                "devices_cached": len(devices),
                "message": f"Cached {len(devices)} devices from Nautobot",
            }

        finally:
            loop.close()

    except Exception as e:
        logger.error(f"Cache devices job failed: {e}", exc_info=True)
        return {"success": False, "error": str(e)}
