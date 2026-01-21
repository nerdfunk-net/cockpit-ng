"""
Compare devices job executor.
Compares device configurations between Nautobot and CheckMK.

Moved from job_tasks.py to improve code organization.
"""

import logging
import asyncio
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


def execute_compare_devices(
    schedule_id: Optional[int],
    credential_id: Optional[int],
    job_parameters: Optional[dict],
    target_devices: Optional[list],
    task_context,
    template: Optional[dict] = None,
    job_run_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Execute compare_devices job - compares devices between Nautobot and CheckMK.

    Results are stored in the NB2CMK database so they can be viewed in the "Sync Devices" app.

    Args:
        schedule_id: Job schedule ID
        credential_id: Optional credential ID (not used for comparison)
        job_parameters: Additional job parameters
        target_devices: List of device UUIDs to compare, or None for all devices
        task_context: Celery task context for progress updates

    Returns:
        dict: Comparison results with counts and job_id for viewing results
    """
    try:
        # Force reload configuration files to ensure we use the latest SNMP mapping
        # and other config changes without requiring Celery worker restart
        from services.checkmk.config import config_service

        config_service.reload_config()
        logger.info("Reloaded configuration files for device comparison task")

        task_context.update_state(
            state="PROGRESS",
            meta={
                "current": 0,
                "total": 100,
                "status": "Initializing device comparison...",
            },
        )

        from services.checkmk.sync.base import nb2cmk_service
        from services.checkmk.sync.database import (
            nb2cmk_db_service,
            JobStatus as NB2CMKJobStatus,
        )

        # If no target devices provided, fetch all from Nautobot
        device_ids = target_devices
        if not device_ids:
            logger.info(
                "No target devices specified, fetching all devices from Nautobot"
            )
            task_context.update_state(
                state="PROGRESS",
                meta={
                    "current": 5,
                    "total": 100,
                    "status": "Fetching devices from Nautobot...",
                },
            )

            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                devices_result = loop.run_until_complete(
                    nb2cmk_service.get_devices_for_sync()
                )
                if devices_result and hasattr(devices_result, "devices"):
                    device_ids = [device.get("id") for device in devices_result.devices]
                    logger.info(f"Fetched {len(device_ids)} devices from Nautobot")
                else:
                    logger.warning("No devices found in Nautobot")
                    device_ids = []
            finally:
                loop.close()

        if not device_ids:
            return {
                "success": True,
                "message": "No devices to compare",
                "total": 0,
                "completed": 0,
                "failed": 0,
                "differences_found": 0,
            }

        total_devices = len(device_ids)
        completed_count = 0
        failed_count = 0
        differences_found = 0
        results = []

        # Create a job ID for storing results in NB2CMK database
        # This allows results to be viewed in the "Sync Devices" app
        job_id = f"scheduled_compare_{task_context.request.id}"

        # Create job in NB2CMK database for result tracking
        nb2cmk_db_service.create_job(username="scheduler", job_id=job_id)
        nb2cmk_db_service.update_job_status(job_id, NB2CMKJobStatus.RUNNING)
        nb2cmk_db_service.update_job_progress(
            job_id, 0, total_devices, "Starting comparison..."
        )

        logger.info(f"Starting comparison of {total_devices} devices, job_id: {job_id}")

        # Process each device
        for i, device_id in enumerate(device_ids):
            try:
                # Update progress
                progress = int(10 + (i / total_devices) * 85)
                task_context.update_state(
                    state="PROGRESS",
                    meta={
                        "current": progress,
                        "total": 100,
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

                # Perform actual comparison
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    comparison_result = loop.run_until_complete(
                        nb2cmk_service.compare_device_config(device_id)
                    )

                    if comparison_result:
                        completed_count += 1
                        # DeviceComparison has 'result' field: 'equal', 'diff', 'host_not_found'
                        has_differences = comparison_result.result not in ["equal"]
                        if has_differences:
                            differences_found += 1

                        # Get device name from normalized config
                        device_name = device_id  # Default to UUID
                        if comparison_result.normalized_config:
                            internal = comparison_result.normalized_config.get(
                                "internal", {}
                            )
                            device_name = internal.get("hostname", device_id)

                        # Filter diff to remove ignored attributes (same as manual job)
                        raw_diff = comparison_result.diff or ""
                        ignored_attrs = (
                            comparison_result.ignored_attributes
                            if hasattr(comparison_result, "ignored_attributes")
                            else []
                        )

                        # Use the same filtering logic as the manual job
                        filtered_diff = (
                            nb2cmk_service.filter_diff_by_ignored_attributes(
                                raw_diff, ignored_attrs
                            )
                        )

                        # Store result in NB2CMK database using add_device_result
                        # This format is expected by the "Sync Devices" app
                        nb2cmk_db_service.add_device_result(
                            job_id=job_id,
                            device_id=device_id,
                            device_name=device_name,
                            checkmk_status=comparison_result.result,  # 'equal', 'diff', 'host_not_found'
                            diff=filtered_diff,  # Use filtered diff instead of raw diff
                            normalized_config=comparison_result.normalized_config or {},
                            checkmk_config=comparison_result.checkmk_config,
                            ignored_attributes=ignored_attrs,  # Pass ignored attributes to database
                        )
                        results.append(
                            {
                                "device_id": device_id,
                                "device_name": device_name,
                                "status": "completed",
                                "checkmk_status": comparison_result.result,
                                "has_differences": has_differences,
                            }
                        )
                    else:
                        failed_count += 1
                        nb2cmk_db_service.add_device_result(
                            job_id=job_id,
                            device_id=device_id,
                            device_name=device_id,
                            checkmk_status="error",
                            diff="No comparison result returned",
                            normalized_config={},
                            checkmk_config=None,
                            ignored_attributes=[],
                        )
                        results.append(
                            {
                                "device_id": device_id,
                                "status": "failed",
                                "error": "No comparison result",
                            }
                        )
                finally:
                    loop.close()

            except Exception as e:
                failed_count += 1
                error_msg = str(e)
                logger.error(f"Error comparing device {device_id}: {error_msg}")
                nb2cmk_db_service.add_device_result(
                    job_id=job_id,
                    device_id=device_id,
                    device_name=device_id,
                    checkmk_status="error",
                    diff=f"Error: {error_msg}",
                    normalized_config={},
                    checkmk_config=None,
                    ignored_attributes=[],
                )
                results.append(
                    {"device_id": device_id, "status": "failed", "error": error_msg}
                )

        # Update final progress
        task_context.update_state(
            state="PROGRESS",
            meta={"current": 100, "total": 100, "status": "Comparison complete"},
        )

        # Mark job as completed in NB2CMK database
        nb2cmk_db_service.update_job_status(job_id, NB2CMKJobStatus.COMPLETED)

        logger.info(
            f"Comparison completed: {completed_count}/{total_devices} devices compared, "
            f"{differences_found} differences found, {failed_count} failed"
        )

        return {
            "success": True,
            "message": f"Compared {completed_count}/{total_devices} devices",
            "total": total_devices,
            "completed": completed_count,
            "failed": failed_count,
            "differences_found": differences_found,
            "job_id": job_id,
        }

    except Exception as e:
        error_msg = str(e)
        logger.error(f"Compare devices job failed: {error_msg}", exc_info=True)
        return {"success": False, "error": error_msg}
