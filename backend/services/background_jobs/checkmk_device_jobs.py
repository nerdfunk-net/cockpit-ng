"""
CheckMK device management Celery tasks.
Background jobs for adding and updating devices in CheckMK from Nautobot.
"""

import asyncio
import logging
from typing import Dict, Any, List
from celery import shared_task
from datetime import datetime

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


@shared_task(bind=True, name="compare_nautobot_and_checkmk")
def compare_nautobot_and_checkmk_task(
    self, device_ids: List[str] = None
) -> Dict[str, Any]:
    """
    Celery task to compare all devices between Nautobot and CheckMK.

    This task:
    1. Fetches all devices from Nautobot (or uses provided device_ids)
    2. For each device, compares Nautobot config with CheckMK config
    3. Stores comparison results in job database for later retrieval
    4. Provides progress updates during execution

    Args:
        device_ids: Optional list of device IDs to compare. If None, compares all devices.

    Returns:
        Dictionary with task results (total, completed, failed, etc.)
    """
    try:
        from services.nb2cmk_base_service import nb2cmk_service
        from services.job_database_service import job_db_service, JobType, JobStatus

        logger.info("Starting compare_nautobot_and_checkmk task")

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
                return {
                    "status": "failed",
                    "error": f"Failed to fetch devices: {str(e)}",
                    "total": 0,
                    "completed": 0,
                    "failed": 0,
                }

        if not device_ids:
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
        results = []

        # Create a job ID for storing results in database
        job_id = f"celery_compare_{self.request.id}"

        # Create job in database
        job_db_service.create_job(
            job_id=job_id,
            job_type=JobType.DEVICE_COMPARISON,
            started_by="celery",
            metadata={"task_id": self.request.id, "total_devices": total_devices},
        )

        # Update job status to running
        job_db_service.update_job_status(job_id, JobStatus.RUNNING)

        logger.info(
            f"Starting comparison of {total_devices} devices, job_id: {job_id}"
        )

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

                # Update job progress in database
                job_db_service.update_job_progress(
                    job_id,
                    current=i + 1,
                    total=total_devices,
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

                # Store result in database
                job_db_service.add_device_result(
                    job_id=job_id,
                    device_name=device_name,
                    status="completed",
                    result_data={
                        "data": comparison_result.model_dump()
                        if hasattr(comparison_result, "model_dump")
                        else str(comparison_result),
                        "timestamp": datetime.now().isoformat(),
                        "comparison_result": comparison_result.result
                        if hasattr(comparison_result, "result")
                        else "unknown",
                    },
                    error_message=None,
                )

                completed_count += 1
                logger.info(f"Successfully compared device {device_name} ({device_id})")

            except Exception as e:
                failed_count += 1
                error_msg = str(e)
                logger.error(f"Failed to compare device {device_id}: {error_msg}")

                # Store failure in database
                job_db_service.add_device_result(
                    job_id=job_id,
                    device_name=f"device_{device_id}",
                    status="error",
                    result_data={
                        "timestamp": datetime.now().isoformat(),
                        "comparison_result": "error",
                    },
                    error_message=error_msg,
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

        job_db_service.update_job_status(job_id, job_status, error_message)

        logger.info(
            f"Comparison task completed: {completed_count} succeeded, {failed_count} failed"
        )

        return {
            "status": "completed",
            "total": total_devices,
            "completed": completed_count,
            "failed": failed_count,
            "job_id": job_id,  # Return job_id so frontend can fetch detailed results
            "message": f"Compared {completed_count}/{total_devices} devices successfully",
        }

    except Exception as e:
        logger.error(f"Comparison task failed: {e}", exc_info=True)
        return {
            "status": "failed",
            "error": str(e),
            "total": len(device_ids) if device_ids else 0,
            "completed": 0,
            "failed": len(device_ids) if device_ids else 0,
        }
