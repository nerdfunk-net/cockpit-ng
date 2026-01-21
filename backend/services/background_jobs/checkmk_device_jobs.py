"""
CheckMK device management Celery tasks.
Background jobs for adding and updating devices in CheckMK from Nautobot.
"""

import asyncio
import json
import logging
from typing import Dict, Any
from celery import shared_task
from fastapi import HTTPException

from services.checkmk.sync.database import (
    nb2cmk_db_service,
    JobStatus as NB2CMKJobStatus,
)
from checkmk.client import CheckMKAPIError

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

        # Force reload configuration files to ensure we use the latest SNMP mapping
        # and other config changes without requiring Celery worker restart
        from services.checkmk.config import config_service

        config_service.reload_config()
        logger.info("Reloaded configuration files for add device task")

        # Import here to avoid circular dependencies
        from services.checkmk.sync.base import nb2cmk_service

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

        # Force reload configuration files to ensure we use the latest SNMP mapping
        # and other config changes without requiring Celery worker restart
        from services.checkmk.config import config_service

        config_service.reload_config()
        logger.info("Reloaded configuration files for update device task")

        # Import here to avoid circular dependencies
        from services.checkmk.sync.base import nb2cmk_service

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
    existing devices or add new ones as needed. The job is tracked in both
    the NB2CMK database and the job_runs table for visibility in Jobs/Views app.

    Args:
        device_ids: List of Nautobot device IDs to sync
        activate_changes_after_sync: Whether to activate CheckMK changes after sync completes

    Returns:
        Dictionary with task results (success count, failed count, details, job_id)
    """
    # Create job ID for database tracking
    job_id = f"sync_devices_{self.request.id}"
    job_run_id = None

    try:
        logger.info(
            f"Starting sync_devices_to_checkmk task for {len(device_ids)} devices"
        )

        # Force reload configuration files to ensure we use the latest SNMP mapping
        # and other config changes without requiring Celery worker restart
        from services.checkmk.config import config_service

        config_service.reload_config()
        logger.info("Reloaded configuration files for sync devices task")

        # Import here to avoid circular dependencies
        from services.checkmk.sync.base import nb2cmk_service
        import job_run_manager

        total_devices = len(device_ids)
        success_count = 0
        failed_count = 0
        results = []

        # Create job in NB2CMK database for tracking device results
        nb2cmk_db_service.create_job(username="manual_sync", job_id=job_id)
        nb2cmk_db_service.update_job_status(job_id, NB2CMKJobStatus.RUNNING)
        nb2cmk_db_service.update_job_progress(
            job_id, 0, total_devices, "Starting device sync..."
        )

        # Also create job run entry for Jobs/Views app visibility
        job_run = job_run_manager.create_job_run(
            job_name=f"Sync {total_devices} devices to CheckMK",
            job_type="sync_devices",
            triggered_by="manual",
            target_devices=device_ids,
            executed_by="manual_sync",
        )
        job_run_id = job_run.get("id")
        if job_run_id:
            job_run_manager.mark_started(job_run_id, self.request.id)

        logger.info(
            f"Created sync job {job_id} (run_id: {job_run_id}) for {total_devices} devices"
        )

        for i, device_id in enumerate(device_ids):
            try:
                # Update Celery state (keep for compatibility with Active Tasks Panel)
                self.update_state(
                    state="PROGRESS",
                    meta={
                        "current": i + 1,
                        "total": total_devices,
                        "status": f"Processing device {i + 1}/{total_devices}",
                        "success": success_count,
                        "failed": failed_count,
                        "job_id": job_id,
                    },
                )

                # Update database progress for Jobs/Views
                nb2cmk_db_service.update_job_progress(
                    job_id,
                    processed_devices=i,
                    total_devices=total_devices,
                    message=f"Syncing device {i + 1}/{total_devices}",
                )

                # Try to update device first (most common case)
                try:
                    result = asyncio.run(
                        nb2cmk_service.update_device_in_checkmk(device_id)
                    )
                    success_count += 1

                    # Get device name for result tracking
                    device_name = (
                        result.hostname if hasattr(result, "hostname") else device_id
                    )

                    # Store success result in database
                    nb2cmk_db_service.add_device_result(
                        job_id=job_id,
                        device_id=device_id,
                        device_name=device_name,
                        checkmk_status="synced",
                        diff="",
                        normalized_config={},
                        checkmk_config=None,
                        ignored_attributes=[],
                    )

                    results.append(
                        {
                            "device_id": device_id,
                            "hostname": device_name,
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

                        # Get device name for result tracking
                        device_name = (
                            result.hostname
                            if hasattr(result, "hostname")
                            else device_id
                        )

                        # Store success result in database
                        nb2cmk_db_service.add_device_result(
                            job_id=job_id,
                            device_id=device_id,
                            device_name=device_name,
                            checkmk_status="added",
                            diff="",
                            normalized_config={},
                            checkmk_config=None,
                            ignored_attributes=[],
                        )

                        results.append(
                            {
                                "device_id": device_id,
                                "hostname": device_name,
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

                # Debug: Log the exception type and attributes
                logger.info(f"Exception type: {type(e).__name__}")
                if isinstance(e, HTTPException):
                    logger.info(f"HTTPException status_code: {e.status_code}")
                    logger.info(f"HTTPException detail type: {type(e.detail)}")
                    logger.info(f"HTTPException detail: {e.detail}")
                if isinstance(e, CheckMKAPIError):
                    logger.info(f"CheckMKAPIError response_data: {e.response_data}")

                # Try to get device name even when error occurs
                device_name = device_id  # Default fallback to UUID
                try:
                    # Attempt to fetch device name from Nautobot
                    normalized_data = asyncio.run(
                        nb2cmk_service.get_device_normalized(device_id)
                    )
                    internal_data = normalized_data.get("internal", {})
                    hostname = internal_data.get("hostname")
                    if hostname:
                        device_name = hostname
                except Exception as name_error:
                    logger.warning(
                        f"Could not fetch device name for {device_id}: {name_error}"
                    )

                # Extract detailed error information if available
                error_detail = str(e)

                # Try to extract JSON error details from HTTPException or CheckMKAPIError
                if isinstance(e, CheckMKAPIError) and e.response_data:
                    # Direct CheckMKAPIError - extract detailed error
                    error_info = {
                        "error": str(e),
                        "status_code": e.status_code,
                    }

                    # Include the full response data for detailed error analysis
                    if "detail" in e.response_data:
                        error_info["detail"] = e.response_data["detail"]
                    if "fields" in e.response_data:
                        error_info["fields"] = e.response_data["fields"]
                    if "title" in e.response_data:
                        error_info["title"] = e.response_data["title"]

                    # Keep as dict - will be properly serialized when results are returned
                    error_detail = error_info
                elif isinstance(e, HTTPException):
                    # HTTPException - the detail field may already be properly formatted JSON
                    detail = e.detail
                    if isinstance(detail, str):
                        try:
                            # Try to parse as JSON - if it's already a properly formatted error dict, use it
                            detail_dict = json.loads(detail)
                            # Check if it already has structured error information (from base.py)
                            if any(
                                key in detail_dict
                                for key in ["fields", "title", "error"]
                            ):
                                # Already properly structured, use it directly as dict
                                error_detail = detail_dict
                            else:
                                # Not structured, wrap it
                                error_detail = {
                                    "error": f"HTTP {e.status_code}",
                                    "status_code": e.status_code,
                                    "detail": detail,
                                }
                        except (json.JSONDecodeError, ValueError):
                            # Not JSON, wrap it in a structure
                            error_detail = {
                                "error": f"HTTP {e.status_code}",
                                "status_code": e.status_code,
                                "detail": detail,
                            }
                    else:
                        # detail is not a string, wrap it
                        error_detail = {
                            "error": f"HTTP {e.status_code}",
                            "status_code": e.status_code,
                            "detail": detail,
                        }
                else:
                    # Generic exception - keep as string
                    error_detail = str(e)

                # Store failure result in database with detailed error
                # Convert to JSON string for database storage
                nb2cmk_db_service.add_device_result(
                    job_id=job_id,
                    device_id=device_id,
                    device_name=device_name,  # Use fetched name or UUID as fallback
                    checkmk_status="error",
                    diff=json.dumps(error_detail, indent=2)
                    if isinstance(error_detail, dict)
                    else error_detail,  # Store as JSON string in DB
                    normalized_config={},
                    checkmk_config=None,
                    ignored_attributes=[],
                )

                results.append(
                    {
                        "device_id": device_id,
                        "hostname": device_name,  # Include device name in error result
                        "operation": "sync",
                        "success": False,
                        "error": error_detail,  # Keep as dict for proper serialization in API response
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
                        "job_id": job_id,
                    },
                )

                # Update database progress
                nb2cmk_db_service.update_job_progress(
                    job_id,
                    processed_devices=total_devices,
                    total_devices=total_devices,
                    message="Activating CheckMK changes...",
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

        # Mark job as completed in database
        if failed_count > 0:
            nb2cmk_db_service.update_job_status(
                job_id,
                NB2CMKJobStatus.COMPLETED,
                error_message=f"{failed_count} devices failed to sync",
            )
        else:
            nb2cmk_db_service.update_job_status(job_id, NB2CMKJobStatus.COMPLETED)

        # Also mark job run as completed for Jobs/Views app
        if job_run_id:
            # Determine overall success - job is successful if no devices failed
            overall_success = failed_count == 0
            result_summary = {
                "success": overall_success,
                "message": f"Synced {success_count}/{total_devices} devices successfully",
                "total": total_devices,
                "success_count": success_count,
                "failed_count": failed_count,
                "results": results,
                "activation": activation_result,
            }
            job_run_manager.mark_completed(job_run_id, result=result_summary)

        # Update final progress
        nb2cmk_db_service.update_job_progress(
            job_id,
            processed_devices=total_devices,
            total_devices=total_devices,
            message=f"Completed: {success_count} succeeded, {failed_count} failed",
        )

        return {
            "status": "completed",
            "success": failed_count == 0,
            "job_id": job_id,
            "total": total_devices,
            "success_count": success_count,
            "failed_count": failed_count,
            "results": results,
            "message": f"Synced {success_count}/{total_devices} devices successfully",
            "activation": activation_result,
        }

    except Exception as e:
        logger.error(f"Sync task failed: {e}", exc_info=True)

        # Mark job as failed in NB2CMK database
        try:
            nb2cmk_db_service.update_job_status(
                job_id, NB2CMKJobStatus.FAILED, error_message=str(e)
            )
        except Exception as db_error:
            logger.error(f"Failed to update job status in database: {db_error}")

        # Also mark job run as failed for Jobs/Views app
        if job_run_id:
            try:
                import job_run_manager

                job_run_manager.mark_failed(job_run_id, str(e))
            except Exception as run_error:
                logger.error(f"Failed to update job run status: {run_error}")

        return {
            "status": "failed",
            "job_id": job_id,
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
        force_foreign_changes=True,
        redirect=False,
    )

    return {
        "success": True,
        "message": "Changes activated successfully",
        "data": result,
    }
