"""
Device caching Celery tasks.
Background jobs for caching device data from Nautobot into Redis.
"""

import asyncio
import logging
from typing import Dict, Any
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="cache_all_devices")
def cache_all_devices_task(self) -> Dict[str, Any]:
    """
    Celery task to fetch all devices from Nautobot and cache them in Redis.

    This task:
    1. Fetches all devices from Nautobot via GraphQL
    2. Caches each device individually with key: nautobot:devices:{device_id}
    3. Caches a lightweight bulk collection with key: nautobot:devices:all
    4. Reports progress via Celery task state updates

    Returns:
        Dictionary with task results (status, cached count, failed count)
    """
    try:
        logger.info(f"Starting cache_all_devices task: {self.request.id}")

        # Import here to avoid circular dependencies
        from services.nautobot import nautobot_service
        from services.settings.cache import cache_service
        from services.background_jobs.base import (
            format_progress_message,
            extract_device_essentials,
            safe_graphql_query,
        )

        # Update task state
        self.update_state(
            state="PROGRESS", meta={"status": "Fetching devices from Nautobot..."}
        )

        # GraphQL query for all devices
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
              manufacturer {
                name
              }
            }
            platform {
              name
            }
            serial
            asset_tag
            comments
          }
        }
        """

        # Execute GraphQL query (need to run in event loop)
        try:
            result = asyncio.run(nautobot_service.graphql_query(query, {}))
        except RuntimeError:
            # If we're already in an event loop, create a new one
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                result = loop.run_until_complete(
                    nautobot_service.graphql_query(query, {})
                )
            finally:
                loop.close()

        # Validate GraphQL result
        success, error_msg, data = safe_graphql_query(result)
        if not success:
            logger.error(f"Task {self.request.id}: {error_msg}")
            return {
                "status": "failed",
                "error": error_msg,
                "cached": 0,
                "failed": 0,
            }

        devices = data.get("devices", [])
        total_devices = len(devices)

        if total_devices == 0:
            logger.warning(f"Task {self.request.id}: No devices found in Nautobot")
            return {
                "status": "completed",
                "message": "No devices found to cache",
                "cached": 0,
                "failed": 0,
            }

        logger.info(f"Task {self.request.id}: Processing {total_devices} devices")

        # Cache configuration
        DEVICE_TTL = 3600  # 1 hour

        # Track progress
        cached_count = 0
        failed_count = 0
        lightweight_devices = []

        # Cache each device individually
        for i, device in enumerate(devices):
            try:
                device_id = device.get("id")
                device_name = device.get("name", f"device_{i}")

                if not device_id:
                    logger.warning(
                        f"Task {self.request.id}: Device {device_name} has no ID, skipping"
                    )
                    failed_count += 1
                    continue

                # Cache full device data
                cache_key = f"nautobot:devices:{device_id}"
                cache_service.set(cache_key, device, DEVICE_TTL)
                cached_count += 1

                # Collect lightweight data for bulk cache
                lightweight_devices.append(extract_device_essentials(device))

                # Update progress every 50 devices or on last device
                if (i + 1) % 50 == 0 or i == total_devices - 1:
                    progress_msg = format_progress_message(
                        cached_count, total_devices, "Cached"
                    )
                    self.update_state(
                        state="PROGRESS",
                        meta={
                            "current": i + 1,
                            "total": total_devices,
                            "cached": cached_count,
                            "failed": failed_count,
                            "status": progress_msg,
                        },
                    )
                    logger.info(f"Task {self.request.id}: {progress_msg}")

            except Exception as e:
                failed_count += 1
                logger.error(
                    f"Task {self.request.id}: Failed to cache device {device.get('name', 'unknown')}: {e}"
                )

        # Cache bulk collection with lightweight device data
        try:
            bulk_cache_key = "nautobot:devices:all"
            cache_service.set(bulk_cache_key, lightweight_devices, DEVICE_TTL)
            logger.info(
                f"Task {self.request.id}: Cached bulk collection with {len(lightweight_devices)} devices"
            )
        except Exception as e:
            logger.error(
                f"Task {self.request.id}: Failed to cache bulk collection: {e}"
            )

        # Determine final status
        if failed_count == 0:
            status = "completed"
            message = f"Successfully cached all {cached_count} devices"
        elif cached_count == 0:
            status = "failed"
            message = f"Failed to cache any devices ({failed_count} failures)"
        else:
            status = "completed_with_errors"
            message = f"Cached {cached_count} devices with {failed_count} failures"

        logger.info(f"Task {self.request.id}: {message}")

        return {
            "status": status,
            "message": message,
            "cached": cached_count,
            "failed": failed_count,
            "total": total_devices,
        }

    except Exception as e:
        logger.error(
            f"Task {self.request.id} failed with exception: {e}", exc_info=True
        )
        return {
            "status": "failed",
            "error": str(e),
            "cached": 0,
            "failed": 0,
        }


@shared_task(bind=True, name="cache_single_device")
def cache_single_device_task(self, device_id: str) -> Dict[str, Any]:
    """
    Celery task to fetch and cache a single device from Nautobot.

    Args:
        device_id: Nautobot device ID

    Returns:
        Dictionary with task results
    """
    try:
        logger.info(f"Starting cache_single_device task for device {device_id}")

        from services.nautobot import nautobot_service
        from services.settings.cache import cache_service
        from services.background_jobs.base import safe_graphql_query

        self.update_state(
            state="PROGRESS", meta={"status": f"Fetching device {device_id}..."}
        )

        # GraphQL query for single device
        query = """
        query getDevice($id: [ID]) {
          devices(id: $id) {
            id
            name
            role { name }
            location { name }
            primary_ip4 { address }
            status { name }
            device_type {
              model
              manufacturer { name }
            }
            platform { name }
            serial
            asset_tag
            comments
          }
        }
        """

        variables = {"id": [device_id]}

        # Execute query
        try:
            result = asyncio.run(nautobot_service.graphql_query(query, variables))
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                result = loop.run_until_complete(
                    nautobot_service.graphql_query(query, variables)
                )
            finally:
                loop.close()

        # Validate result
        success, error_msg, data = safe_graphql_query(result)
        if not success:
            return {"status": "failed", "error": error_msg}

        devices = data.get("devices", [])
        if not devices:
            return {
                "status": "failed",
                "error": f"Device {device_id} not found in Nautobot",
            }

        device = devices[0]

        # Cache device
        cache_key = f"nautobot:devices:{device_id}"
        cache_service.set(cache_key, device, 3600)  # 1 hour TTL

        logger.info(
            f"Successfully cached device {device.get('name')} (ID: {device_id})"
        )

        return {
            "status": "completed",
            "message": f"Cached device {device.get('name')}",
            "device_id": device_id,
            "device_name": device.get("name"),
        }

    except Exception as e:
        logger.error(f"Failed to cache device {device_id}: {e}", exc_info=True)
        return {"status": "failed", "error": str(e)}
