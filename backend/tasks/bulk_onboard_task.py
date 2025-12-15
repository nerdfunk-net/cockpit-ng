"""
Celery task for bulk device onboarding from CSV.

This task processes multiple devices from a CSV upload, creating a single trackable
job in the Jobs/View interface while processing each device individually.
"""

from celery import shared_task
import logging
from typing import Dict, List

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="tasks.bulk_onboard_devices_task")
def bulk_onboard_devices_task(
    self,
    devices: List[Dict],
    default_config: Dict,
) -> dict:
    """
    Bulk onboard multiple devices from CSV data.

    This task creates a single job entry that processes all devices from a CSV upload.
    Each device is processed individually with progress updates.

    Args:
        self: Task instance (for updating state)
        devices: List of device configurations from CSV, each containing:
            - ip_address: Device IP address
            - location_id: Nautobot location ID
            - namespace_id: Nautobot namespace ID
            - role_id: Nautobot role ID
            - status_id: Device status ID
            - interface_status_id: Interface status ID
            - ip_address_status_id: IP address status ID
            - prefix_status_id: Prefix status ID
            - secret_groups_id: Secret group ID
            - platform_id: Platform ID or "detect"
            - port: SSH port (optional)
            - timeout: SSH connection timeout (optional)
            - tags: List of tag IDs (optional)
            - custom_fields: Dict of custom field values (optional)
        default_config: Default configuration to use when device-specific values are missing:
            - location_id, namespace_id, role_id, status_id, etc.
            - onboarding_timeout: Max wait time for each onboarding job
            - sync_options: List of sync options

    Returns:
        dict: Result with success status, message, and details for all devices
    """
    # Import helper functions from onboard_device_task
    from tasks.onboard_device_task import (
        _trigger_nautobot_onboarding,
        _wait_for_job_completion,
        _process_single_device,
    )

    device_count = len(devices)

    if device_count == 0:
        return {
            "success": False,
            "error": "No devices provided for bulk onboarding",
            "stage": "validation_failed",
        }

    logger.info(f"Starting bulk onboarding for {device_count} devices")

    # Initialize tracking
    self.update_state(
        state="PROGRESS",
        meta={
            "stage": "initializing",
            "status": f"Starting bulk onboarding for {device_count} devices",
            "progress": 0,
            "device_count": device_count,
            "processed": 0,
            "successful": 0,
            "failed": 0,
            "devices": [],
        },
    )

    # Default configuration
    onboarding_timeout = default_config.get("onboarding_timeout", 120)
    sync_options = default_config.get(
        "sync_options", ["cables", "software", "vlans", "vrfs"]
    )

    # Process results
    device_results = []
    successful_count = 0
    failed_count = 0

    for idx, device in enumerate(devices):
        device_num = idx + 1
        progress = int(((idx) / device_count) * 100)
        ip_address = device.get("ip_address", "unknown")

        # Update progress
        self.update_state(
            state="PROGRESS",
            meta={
                "stage": "processing",
                "status": f"Processing device {device_num}/{device_count}: {ip_address}",
                "progress": progress,
                "device_count": device_count,
                "processed": idx,
                "successful": successful_count,
                "failed": failed_count,
                "current_device": device_num,
                "current_ip": ip_address,
                "devices": device_results,
            },
        )

        try:
            # Merge device config with defaults (device-specific values take precedence)
            merged_config = {
                "ip_address": ip_address,
                "location_id": device.get("location_id")
                or default_config.get("location_id", ""),
                "namespace_id": device.get("namespace_id")
                or default_config.get("namespace_id", ""),
                "role_id": device.get("role_id") or default_config.get("role_id", ""),
                "status_id": device.get("status_id")
                or default_config.get("status_id", ""),
                "interface_status_id": device.get("interface_status_id")
                or default_config.get("interface_status_id", ""),
                "ip_address_status_id": device.get("ip_address_status_id")
                or default_config.get("ip_address_status_id", ""),
                "prefix_status_id": device.get("prefix_status_id")
                or default_config.get("prefix_status_id", ""),
                "secret_groups_id": device.get("secret_groups_id")
                or default_config.get("secret_groups_id", ""),
                "platform_id": device.get("platform_id")
                or default_config.get("platform_id", "detect"),
                "port": device.get("port") or default_config.get("port", 22),
                "timeout": device.get("timeout") or default_config.get("timeout", 30),
                "tags": device.get("tags"),
                "custom_fields": device.get("custom_fields"),
            }

            # Validate required fields
            missing_fields = []
            for field in [
                "location_id",
                "namespace_id",
                "role_id",
                "status_id",
                "interface_status_id",
                "ip_address_status_id",
                "prefix_status_id",
                "secret_groups_id",
            ]:
                if not merged_config.get(field):
                    missing_fields.append(field)

            if missing_fields:
                raise ValueError(
                    f"Missing required fields: {', '.join(missing_fields)}"
                )

            # Call onboarding directly using helper functions
            logger.info(f"Processing device {device_num}/{device_count}: {ip_address}")

            # Step 1: Trigger Nautobot onboarding job for this single device
            self.update_state(
                state="PROGRESS",
                meta={
                    "stage": "onboarding",
                    "status": f"Triggering onboarding for {ip_address} ({device_num}/{device_count})",
                    "progress": progress,
                    "device_count": device_count,
                    "processed": idx,
                    "successful": successful_count,
                    "failed": failed_count,
                    "current_device": device_num,
                    "current_ip": ip_address,
                    "devices": device_results,
                },
            )

            job_id, job_url = _trigger_nautobot_onboarding(
                ip_address=merged_config["ip_address"],
                location_id=merged_config["location_id"],
                role_id=merged_config["role_id"],
                namespace_id=merged_config["namespace_id"],
                status_id=merged_config["status_id"],
                interface_status_id=merged_config["interface_status_id"],
                ip_address_status_id=merged_config["ip_address_status_id"],
                secret_groups_id=merged_config["secret_groups_id"],
                platform_id=merged_config["platform_id"],
                port=merged_config["port"],
                timeout=merged_config["timeout"],
            )

            logger.info(f"Nautobot onboarding job started for {ip_address}: {job_id}")

            # Step 2: Wait for job completion (pass self for progress updates)
            self.update_state(
                state="PROGRESS",
                meta={
                    "stage": "waiting",
                    "status": f"Waiting for onboarding job for {ip_address} ({device_num}/{device_count})",
                    "progress": progress,
                    "device_count": device_count,
                    "processed": idx,
                    "successful": successful_count,
                    "failed": failed_count,
                    "current_device": device_num,
                    "current_ip": ip_address,
                    "job_id": job_id,
                    "devices": device_results,
                },
            )

            job_success, job_result = _wait_for_job_completion(
                self, job_id, max_wait=onboarding_timeout
            )

            if not job_success:
                error_msg = f"Onboarding job failed or timed out: {job_result}"
                logger.error(f"Device {ip_address}: {error_msg}")
                failed_count += 1
                device_results.append(
                    {
                        "ip_address": ip_address,
                        "status": "error",
                        "message": error_msg,
                        "stage": "onboarding_failed",
                        "job_id": job_id,
                    }
                )
                continue

            # Step 3: Process the device (lookup, tags, custom fields, sync)
            self.update_state(
                state="PROGRESS",
                meta={
                    "stage": "post_processing",
                    "status": f"Post-processing device {ip_address} ({device_num}/{device_count})",
                    "progress": progress,
                    "device_count": device_count,
                    "processed": idx,
                    "successful": successful_count,
                    "failed": failed_count,
                    "current_device": device_num,
                    "current_ip": ip_address,
                    "job_id": job_id,
                    "devices": device_results,
                },
            )

            device_result = _process_single_device(
                task_instance=self,
                ip_address=merged_config["ip_address"],
                namespace_id=merged_config["namespace_id"],
                prefix_status_id=merged_config["prefix_status_id"],
                interface_status_id=merged_config["interface_status_id"],
                ip_address_status_id=merged_config["ip_address_status_id"],
                sync_options=sync_options,
                tags=merged_config.get("tags"),
                custom_fields=merged_config.get("custom_fields"),
                device_num=device_num,
                device_count=device_count,
            )

            if device_result.get("success"):
                successful_count += 1
                device_results.append(
                    {
                        "ip_address": ip_address,
                        "status": "success",
                        "message": f"Device {device_result.get('device_name', ip_address)} onboarded successfully",
                        "device_id": device_result.get("device_id"),
                        "device_name": device_result.get("device_name"),
                        "job_id": job_id,
                    }
                )
            else:
                failed_count += 1
                device_results.append(
                    {
                        "ip_address": ip_address,
                        "status": "error",
                        "message": device_result.get("error", "Post-processing failed"),
                        "stage": device_result.get("stage", "post_processing_failed"),
                        "job_id": job_id,
                    }
                )

        except Exception as e:
            failed_count += 1
            error_msg = str(e)
            logger.error(
                f"Error processing device {ip_address}: {error_msg}", exc_info=True
            )
            device_results.append(
                {
                    "ip_address": ip_address,
                    "status": "error",
                    "message": error_msg,
                    "stage": "exception",
                }
            )

    # Calculate final progress
    all_success = failed_count == 0
    partial_success = successful_count > 0 and failed_count > 0

    if all_success:
        message = f"All {device_count} devices successfully onboarded"
        stage = "completed"
    elif partial_success:
        message = f"{successful_count}/{device_count} devices onboarded successfully, {failed_count} failed"
        stage = "partial_success"
    else:
        message = f"All {device_count} devices failed to onboard"
        stage = "all_failed"

    logger.info(f"Bulk onboarding completed: {message}")

    # Final state update
    self.update_state(
        state="PROGRESS",
        meta={
            "stage": stage,
            "status": message,
            "progress": 100,
            "device_count": device_count,
            "processed": device_count,
            "successful": successful_count,
            "failed": failed_count,
            "devices": device_results,
        },
    )

    # Update job run in database (for Jobs/View)
    try:
        import job_run_manager

        # Find job run by celery task ID
        job_run = job_run_manager.get_job_run_by_celery_id(self.request.id)
        if job_run:
            run_id = job_run.get("id")
            result_data = {
                "device_count": device_count,
                "successful_devices": successful_count,
                "failed_devices": failed_count,
                "devices": device_results,
            }

            if all_success or partial_success:
                job_run_manager.mark_completed(run_id, result=result_data)
                logger.info(f"Marked job run {run_id} as completed")
            else:
                job_run_manager.mark_failed(run_id, message)
                logger.info(f"Marked job run {run_id} as failed")
    except Exception as e:
        logger.warning(f"Failed to update job run status: {e}")

    return {
        "success": all_success,
        "partial_success": partial_success,
        "message": message,
        "device_count": device_count,
        "successful_devices": successful_count,
        "failed_devices": failed_count,
        "devices": device_results,
        "stage": stage,
    }
