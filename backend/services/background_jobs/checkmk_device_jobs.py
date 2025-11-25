"""
CheckMK device management Celery tasks.
Background jobs for adding and updating devices in CheckMK from Nautobot.
"""

import asyncio
import logging
from typing import Dict, Any
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="add_device_to_checkmk")
def add_device_to_checkmk_task(self, device_id: str) -> Dict[str, Any]:
    """
    Celery task to add a device from Nautobot to CheckMK.

    This task:
    1. Fetches device data from Nautobot
    2. Normalizes device configuration for CheckMK
    3. Creates folder structure in CheckMK if needed
    4. Adds the host to CheckMK with proper attributes

    Args:
        device_id: Nautobot device ID

    Returns:
        Dictionary with task results (success, message, device details)
    """
    try:
        logger.info(f"Starting add_device_to_checkmk task for device: {device_id}")

        # Import here to avoid circular dependencies
        from services.nb2cmk_base_service import nb2cmk_service

        # Update task state
        self.update_state(
            state="PROGRESS",
            meta={"status": f"Adding device {device_id} to CheckMK..."}
        )

        # Execute the add operation (need to run in event loop)
        try:
            result = asyncio.run(nb2cmk_service.add_device_to_checkmk(device_id))
        except RuntimeError:
            # If we're already in an event loop, create a new one
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                result = loop.run_until_complete(
                    nb2cmk_service.add_device_to_checkmk(device_id)
                )
            finally:
                loop.close()

        logger.info(
            f"Successfully added device {device_id} ({result.hostname}) to CheckMK"
        )

        return {
            "status": "completed",
            "success": result.success,
            "message": result.message,
            "device_id": result.device_id,
            "hostname": result.hostname,
            "site": result.site,
            "folder": result.folder,
            "checkmk_response": result.checkmk_response,
        }

    except Exception as e:
        error_msg = str(e)
        logger.error(
            f"Task {self.request.id} failed to add device {device_id}: {error_msg}",
            exc_info=True,
        )

        # Check if it's a known error type
        if "404" in error_msg or "not found" in error_msg.lower():
            status_msg = "Device not found in Nautobot"
        elif "already exists" in error_msg.lower():
            status_msg = "Device already exists in CheckMK"
        elif "no hostname" in error_msg.lower():
            status_msg = "Device has no hostname configured"
        else:
            status_msg = f"Failed to add device: {error_msg}"

        return {
            "status": "failed",
            "success": False,
            "error": error_msg,
            "message": status_msg,
            "device_id": device_id,
        }


@shared_task(bind=True, name="update_device_in_checkmk")
def update_device_in_checkmk_task(self, device_id: str) -> Dict[str, Any]:
    """
    Celery task to update/sync a device from Nautobot to CheckMK.

    This task:
    1. Fetches device data from Nautobot
    2. Normalizes device configuration for CheckMK
    3. Retrieves current CheckMK configuration
    4. Updates host attributes in CheckMK
    5. Handles folder moves if location changed

    Args:
        device_id: Nautobot device ID

    Returns:
        Dictionary with task results (success, message, device details)
    """
    try:
        logger.info(f"Starting update_device_in_checkmk task for device: {device_id}")

        # Import here to avoid circular dependencies
        from services.nb2cmk_base_service import nb2cmk_service

        # Update task state
        self.update_state(
            state="PROGRESS",
            meta={"status": f"Updating device {device_id} in CheckMK..."},
        )

        # Execute the update operation (need to run in event loop)
        try:
            result = asyncio.run(nb2cmk_service.update_device_in_checkmk(device_id))
        except RuntimeError:
            # If we're already in an event loop, create a new one
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                result = loop.run_until_complete(
                    nb2cmk_service.update_device_in_checkmk(device_id)
                )
            finally:
                loop.close()

        logger.info(
            f"Successfully updated device {device_id} ({result.hostname}) in CheckMK"
        )

        return {
            "status": "completed",
            "success": result.success,
            "message": result.message,
            "device_id": result.device_id,
            "hostname": result.hostname,
            "site": result.site,
            "folder_changed": result.folder_changed,
            "attributes_updated": result.attributes_updated,
            "old_folder": result.old_folder,
            "new_folder": result.new_folder,
            "checkmk_response": result.checkmk_response,
        }

    except Exception as e:
        error_msg = str(e)
        logger.error(
            f"Task {self.request.id} failed to update device {device_id}: {error_msg}",
            exc_info=True,
        )

        # Check if it's a known error type
        if "404" in error_msg or "not found" in error_msg.lower():
            status_msg = "Device not found in CheckMK - use add instead"
        elif "no hostname" in error_msg.lower():
            status_msg = "Device has no hostname configured"
        else:
            status_msg = f"Failed to update device: {error_msg}"

        return {
            "status": "failed",
            "success": False,
            "error": error_msg,
            "message": status_msg,
            "device_id": device_id,
        }


@shared_task(bind=True, name="sync_devices_to_checkmk")
def sync_devices_to_checkmk_task(self, device_ids: list[str]) -> Dict[str, Any]:
    """
    Celery task to sync multiple devices from Nautobot to CheckMK.

    This task processes multiple devices in sequence, attempting to update
    existing devices or add new ones as needed.

    Args:
        device_ids: List of Nautobot device IDs to sync

    Returns:
        Dictionary with task results (success count, failed count, details)
    """
    try:
        logger.info(
            f"Starting sync_devices_to_checkmk task for {len(device_ids)} devices"
        )

        # Import here to avoid circular dependencies
        from services.nb2cmk_base_service import nb2cmk_service

        total_devices = len(device_ids)
        success_count = 0
        failed_count = 0
        results = []

        for i, device_id in enumerate(device_ids):
            try:
                # Update progress
                self.update_state(
                    state="PROGRESS",
                    meta={
                        "current": i + 1,
                        "total": total_devices,
                        "status": f"Processing device {i + 1}/{total_devices}",
                        "success": success_count,
                        "failed": failed_count,
                    },
                )

                # Try to update device first (most common case)
                try:
                    result = asyncio.run(
                        nb2cmk_service.update_device_in_checkmk(device_id)
                    )
                    success_count += 1
                    results.append(
                        {
                            "device_id": device_id,
                            "hostname": result.hostname,
                            "operation": "update",
                            "success": True,
                            "message": result.message,
                        }
                    )

                except Exception as update_error:
                    # If device not found in CheckMK, try to add it
                    if "404" in str(update_error) or "not found" in str(
                        update_error
                    ).lower():
                        logger.info(
                            f"Device {device_id} not in CheckMK, attempting to add..."
                        )
                        result = asyncio.run(
                            nb2cmk_service.add_device_to_checkmk(device_id)
                        )
                        success_count += 1
                        results.append(
                            {
                                "device_id": device_id,
                                "hostname": result.hostname,
                                "operation": "add",
                                "success": True,
                                "message": result.message,
                            }
                        )
                    else:
                        # Other error, log and continue
                        raise

            except Exception as e:
                failed_count += 1
                logger.error(f"Failed to sync device {device_id}: {e}")
                results.append(
                    {
                        "device_id": device_id,
                        "operation": "sync",
                        "success": False,
                        "error": str(e),
                    }
                )

        logger.info(
            f"Sync task completed: {success_count} succeeded, {failed_count} failed"
        )

        return {
            "status": "completed",
            "total": total_devices,
            "success_count": success_count,
            "failed_count": failed_count,
            "results": results,
            "message": f"Synced {success_count}/{total_devices} devices successfully",
        }

    except Exception as e:
        logger.error(f"Sync task failed: {e}", exc_info=True)
        return {
            "status": "failed",
            "error": str(e),
            "success_count": 0,
            "failed_count": len(device_ids),
        }
