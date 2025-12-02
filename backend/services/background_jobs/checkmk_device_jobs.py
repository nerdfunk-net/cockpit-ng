"""
CheckMK device management Celery tasks.
Background jobs for adding and updating devices in CheckMK from Nautobot.
"""

import asyncio
import logging
from typing import Dict, Any, List
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
            meta={"status": f"Adding device {device_id} to CheckMK..."},
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
            "folder": result.folder,
            "folder_changed": result.folder_changed,
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
def sync_devices_to_checkmk_task(
    self, device_ids: list[str], activate_changes_after_sync: bool = True
) -> Dict[str, Any]:
    """
    Celery task to sync multiple devices from Nautobot to CheckMK.

    This task processes multiple devices in sequence, attempting to update
    existing devices or add new ones as needed.

    Args:
        device_ids: List of Nautobot device IDs to sync
        activate_changes_after_sync: Whether to activate CheckMK changes after sync completes

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
                    if (
                        "404" in str(update_error)
                        or "not found" in str(update_error).lower()
                    ):
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

        # Activate CheckMK changes if requested and at least one device was synced successfully
        activation_result = None
        if activate_changes_after_sync and success_count > 0:
            try:
                logger.info("Activating CheckMK changes after sync...")
                self.update_state(
                    state="PROGRESS",
                    meta={
                        "current": total_devices,
                        "total": total_devices,
                        "status": "Activating CheckMK changes...",
                        "success": success_count,
                        "failed": failed_count,
                    },
                )
                activation_result = _activate_checkmk_changes()
                if activation_result.get("success"):
                    logger.info("CheckMK changes activated successfully")
                else:
                    logger.warning(
                        f"CheckMK activation completed with issues: {activation_result.get('message')}"
                    )
            except Exception as activation_error:
                logger.error(f"Failed to activate CheckMK changes: {activation_error}")
                activation_result = {
                    "success": False,
                    "error": str(activation_error),
                    "message": f"Failed to activate changes: {activation_error}",
                }

        return {
            "status": "completed",
            "total": total_devices,
            "success_count": success_count,
            "failed_count": failed_count,
            "results": results,
            "message": f"Synced {success_count}/{total_devices} devices successfully",
            "activation": activation_result,
        }

    except Exception as e:
        logger.error(f"Sync task failed: {e}", exc_info=True)
        return {
            "status": "failed",
            "error": str(e),
            "success_count": 0,
            "failed_count": len(device_ids),
        }


def _activate_checkmk_changes() -> Dict[str, Any]:
    """
    Helper function to activate pending CheckMK configuration changes.
    Called after sync operations complete successfully.

    Returns:
        Dictionary with activation result
    """
    from settings_manager import settings_manager
    from checkmk.client import CheckMKClient
    from urllib.parse import urlparse

    db_settings = settings_manager.get_checkmk_settings()
    if not db_settings or not all(
        key in db_settings for key in ["url", "site", "username", "password"]
    ):
        return {
            "success": False,
            "message": "CheckMK settings not configured",
        }

    # Parse URL
    url = db_settings["url"].rstrip("/")
    if url.startswith(("http://", "https://")):
        parsed_url = urlparse(url)
        protocol = parsed_url.scheme
        host = parsed_url.netloc
    else:
        protocol = "https"
        host = url

    effective_site = db_settings["site"]

    # Create client
    client = CheckMKClient(
        host=host,
        site_name=effective_site,
        username=db_settings["username"],
        password=db_settings["password"],
        protocol=protocol,
        verify_ssl=db_settings.get("verify_ssl", True),
    )

    # Activate changes
    result = client.activate_changes(
        sites=[effective_site],
        force_foreign_changes=False,
        redirect=False,
    )

    return {
        "success": True,
        "message": "Changes activated successfully",
        "data": result,
    }


@shared_task(bind=True, name="compare_nautobot_and_checkmk")
def compare_nautobot_and_checkmk_task(
    self, device_ids: List[str] = None
) -> Dict[str, Any]:
    """
    Celery task to compare all devices between Nautobot and CheckMK.

    This task:
    1. Fetches all devices from Nautobot (or uses provided device_ids)
    2. For each device, compares Nautobot config with CheckMK config
    3. Stores comparison results in NB2CMK database for later retrieval
    4. Provides progress updates during execution

    Args:
        device_ids: Optional list of device IDs to compare. If None, compares all devices.

    Returns:
        Dictionary with task results (total, completed, failed, etc.)
    """
    try:
        from services.nb2cmk_base_service import nb2cmk_service
        from services.nb2cmk_database_service import nb2cmk_db_service, JobStatus
        import job_run_manager

        logger.info("Starting compare_nautobot_and_checkmk task")

        # Create job run record for Jobs/View app
        job_run = job_run_manager.create_job_run(
            job_name="Device Comparison (Manual)",
            job_type="compare_devices",
            triggered_by="manual",
            target_devices=device_ids,
            executed_by="system",
        )
        job_run_id = job_run["id"]

        # Mark job as started
        job_run_manager.mark_started(job_run_id, self.request.id)

        # If no device IDs provided, fetch all devices from Nautobot
        if not device_ids:
            logger.info("No device IDs provided, fetching all devices from Nautobot")
            try:
                devices_result = asyncio.run(nb2cmk_service.get_devices_for_sync())
                if devices_result and hasattr(devices_result, "devices"):
                    device_ids = [device.get("id") for device in devices_result.devices]
                    logger.info(f"Fetched {len(device_ids)} devices from Nautobot")
                else:
                    logger.warning("No devices found in Nautobot")
                    device_ids = []
            except Exception as e:
                logger.error(f"Failed to fetch devices from Nautobot: {e}")
                job_run_manager.mark_failed(job_run_id, f"Failed to fetch devices: {str(e)}")
                return {
                    "status": "failed",
                    "error": f"Failed to fetch devices: {str(e)}",
                    "total": 0,
                    "completed": 0,
                    "failed": 0,
                }

        if not device_ids:
            job_run_manager.mark_completed(
                job_run_id,
                result={"message": "No devices to compare", "total": 0, "completed": 0, "failed": 0}
            )
            return {
                "status": "completed",
                "message": "No devices to compare",
                "total": 0,
                "completed": 0,
                "failed": 0,
            }

        total_devices = len(device_ids)
        completed_count = 0
        failed_count = 0

        # Create a job ID for storing results in NB2CMK database
        job_id = f"celery_compare_{self.request.id}"

        # Create job in NB2CMK database
        nb2cmk_db_service.create_job(username="celery", job_id=job_id)
        nb2cmk_db_service.update_job_status(job_id, JobStatus.RUNNING)
        nb2cmk_db_service.update_job_progress(
            job_id, 0, total_devices, "Starting comparison..."
        )

        logger.info(f"Starting comparison of {total_devices} devices, job_id: {job_id}")

        # Process each device
        for i, device_id in enumerate(device_ids):
            try:
                # Update progress
                self.update_state(
                    state="PROGRESS",
                    meta={
                        "current": i + 1,
                        "total": total_devices,
                        "status": f"Comparing device {i + 1}/{total_devices}",
                        "completed": completed_count,
                        "failed": failed_count,
                    },
                )

                # Update job progress in NB2CMK database
                nb2cmk_db_service.update_job_progress(
                    job_id,
                    processed_devices=i + 1,
                    total_devices=total_devices,
                    message=f"Comparing device {i + 1}/{total_devices}",
                )

                # Compare device configuration
                try:
                    comparison_result = asyncio.run(
                        nb2cmk_service.compare_device_config(device_id)
                    )
                except RuntimeError:
                    # If already in event loop
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    try:
                        comparison_result = loop.run_until_complete(
                            nb2cmk_service.compare_device_config(device_id)
                        )
                    finally:
                        loop.close()

                # Extract device name from comparison result or fetch it
                device_name = f"device_{i + 1}"  # Default fallback
                if hasattr(comparison_result, "model_dump"):
                    comp_data = comparison_result.model_dump()
                    # Try to get hostname from normalized config
                    if "normalized_config" in comp_data:
                        internal = comp_data["normalized_config"].get("internal", {})
                        device_name = internal.get("hostname", device_name)

                # Store result in NB2CMK database using add_device_result
                nb2cmk_db_service.add_device_result(
                    job_id=job_id,
                    device_id=device_id,
                    device_name=device_name,
                    checkmk_status=comparison_result.result
                    if hasattr(comparison_result, "result")
                    else "unknown",
                    diff=comparison_result.diff
                    if hasattr(comparison_result, "diff")
                    else "",
                    normalized_config=comparison_result.normalized_config
                    if hasattr(comparison_result, "normalized_config")
                    else {},
                    checkmk_config=comparison_result.checkmk_config
                    if hasattr(comparison_result, "checkmk_config")
                    else None,
                )

                completed_count += 1
                logger.info(f"Successfully compared device {device_name} ({device_id})")

            except Exception as e:
                failed_count += 1
                error_msg = str(e)
                logger.error(f"Failed to compare device {device_id}: {error_msg}")

                # Store failure in NB2CMK database
                nb2cmk_db_service.add_device_result(
                    job_id=job_id,
                    device_id=device_id,
                    device_name=device_id,
                    checkmk_status="error",
                    diff=f"Error: {error_msg}",
                    normalized_config={},
                    checkmk_config=None,
                )

        # Update final job status
        if failed_count == 0:
            job_status = JobStatus.COMPLETED
            error_message = None
        elif completed_count > 0:
            job_status = JobStatus.COMPLETED  # Partial success
            error_message = f"{failed_count} devices failed"
        else:
            job_status = JobStatus.FAILED
            error_message = f"All {failed_count} devices failed"

        nb2cmk_db_service.update_job_status(job_id, job_status, error_message)

        logger.info(
            f"Comparison task completed: {completed_count} succeeded, {failed_count} failed"
        )

        # Mark job run as completed in Jobs/View database
        result_message = f"Compared {completed_count}/{total_devices} devices successfully"
        if failed_count > 0:
            result_message += f" ({failed_count} failed)"

        # If all devices failed, mark as failed; otherwise mark as completed
        if failed_count > 0 and completed_count == 0:
            job_run_manager.mark_failed(job_run_id, error_message)
        else:
            job_run_manager.mark_completed(
                job_run_id,
                result={
                    "success": True,
                    "message": result_message,
                    "total": total_devices,
                    "completed": completed_count,
                    "failed": failed_count,
                    "job_id": job_id
                }
            )

        return {
            "status": "completed",
            "total": total_devices,
            "completed": completed_count,
            "failed": failed_count,
            "job_id": job_id,  # Return job_id so frontend can fetch detailed results
            "message": result_message,
        }

    except Exception as e:
        logger.error(f"Comparison task failed: {e}", exc_info=True)

        # Mark job run as failed
        try:
            if 'job_run_id' in locals():
                job_run_manager.mark_failed(job_run_id, str(e))
        except Exception as mark_error:
            logger.error(f"Failed to mark job as failed: {mark_error}")

        return {
            "status": "failed",
            "error": str(e),
            "total": len(device_ids) if device_ids else 0,
            "completed": 0,
            "failed": len(device_ids) if device_ids else 0,
        }
