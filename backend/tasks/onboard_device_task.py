"""
Celery task for device onboarding.
"""

from celery import shared_task
import logging
import time
import asyncio
from typing import Dict, List, Optional
from utils.task_progress import ProgressUpdater

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="tasks.onboard_device_task")
def onboard_device_task(
    self,
    ip_address: str,
    location_id: str,
    role_id: str,
    namespace_id: str,
    status_id: str,
    interface_status_id: str,
    ip_address_status_id: str,
    prefix_status_id: str,
    secret_groups_id: str,
    platform_id: str,
    port: int,
    timeout: int,
    onboarding_timeout: int = 120,
    sync_options: Optional[List[str]] = None,
    tags: Optional[List[str]] = None,
    custom_fields: Optional[Dict[str, str]] = None,
) -> dict:
    """
    Onboard one or more devices to Nautobot with tags and custom fields.

    Process:
    1. Call Nautobot onboarding job (handles multiple IPs)
    2. Wait for job completion (configurable timeout, default 120 seconds)
    3. For each IP address:
       a. Get device UUID from IP address
       b. Update device with tags and custom fields
       c. Sync network data from device

    Args:
        self: Task instance (for updating state)
        ip_address: Device IP address(es) - comma-separated for multiple
        location_id: Nautobot location ID
        role_id: Nautobot role ID
        namespace_id: Nautobot namespace ID
        status_id: Device status ID
        interface_status_id: Interface status ID
        ip_address_status_id: IP address status ID
        prefix_status_id: Prefix status ID
        secret_groups_id: Secret group ID
        platform_id: Platform ID or "detect"
        port: SSH port
        timeout: SSH connection timeout
        onboarding_timeout: Max time to wait for onboarding job completion (default: 120s)
        sync_options: List of sync options (cables, software, vlans, vrfs)
        tags: List of tag IDs to apply
        custom_fields: Dict of custom field key-value pairs

    Returns:
        dict: Result with success status, message, and details for all devices
    """
    try:
        # Parse IP addresses (comma-separated)
        ip_list = [ip.strip() for ip in ip_address.split(",") if ip.strip()]
        device_count = len(ip_list)
        is_multi_device = device_count > 1

        logger.info(
            f"Starting device onboarding for {device_count} IP(s): {', '.join(ip_list)}"
        )

        # Initialize progress updater
        updater = ProgressUpdater(self)

        # Update progress
        updater.update(
            "onboarding",
            f"Initiating onboarding for {device_count} device(s)",
            5,
            device_count=device_count,
            ip_addresses=ip_list,
        )

        # Step 1: Call Nautobot onboarding job (sends all IPs at once)
        job_id, job_url = _trigger_nautobot_onboarding(
            ip_address=ip_address,  # Pass original comma-separated string
            location_id=location_id,
            role_id=role_id,
            namespace_id=namespace_id,
            status_id=status_id,
            interface_status_id=interface_status_id,
            ip_address_status_id=ip_address_status_id,
            secret_groups_id=secret_groups_id,
            platform_id=platform_id,
            port=port,
            timeout=timeout,
        )

        logger.info(f"Nautobot onboarding job started: {job_id}")
        updater.update(
            "waiting",
            f"Waiting for onboarding job to complete ({device_count} devices)",
            10,
            job_id=job_id,
            job_url=job_url,
            device_count=device_count,
        )

        # Step 2: Wait for job completion (use configurable onboarding_timeout)
        # Use the user-configured timeout directly
        job_success, job_result = _wait_for_job_completion(
            self, job_id, max_wait=onboarding_timeout
        )

        if not job_success:
            error_msg = f"Onboarding job failed or timed out: {job_result}"
            logger.error(error_msg)
            return {
                "success": False,
                "error": error_msg,
                "job_id": job_id,
                "job_url": job_url,
                "stage": "onboarding_failed",
                "device_count": device_count,
            }

        logger.info(f"Onboarding job completed successfully: {job_id}")

        # Step 3: Process each device individually
        device_results = []
        successful_devices = 0
        failed_devices = 0

        for idx, single_ip in enumerate(ip_list):
            device_num = idx + 1
            # Calculate progress: 50-95% range divided among devices
            base_progress = 50
            progress_per_device = 45 / device_count
            current_progress = int(base_progress + (idx * progress_per_device))

            updater.update(
                "processing_devices",
                f"Processing device {device_num}/{device_count}: {single_ip}",
                current_progress,
                job_id=job_id,
                job_url=job_url,
                current_device=device_num,
                device_count=device_count,
                current_ip=single_ip,
            )

            # Process single device
            device_result = _process_single_device(
                task_instance=self,
                ip_address=single_ip,
                namespace_id=namespace_id,
                prefix_status_id=prefix_status_id,
                interface_status_id=interface_status_id,
                ip_address_status_id=ip_address_status_id,
                sync_options=sync_options,
                tags=tags,
                custom_fields=custom_fields,
                device_num=device_num,
                device_count=device_count,
            )

            device_results.append(device_result)

            if device_result.get("success"):
                successful_devices += 1
            else:
                failed_devices += 1

        # Build final result
        all_success = failed_devices == 0
        partial_success = successful_devices > 0 and failed_devices > 0

        if is_multi_device:
            if all_success:
                message = f"All {device_count} devices successfully onboarded, configured, and synced"
                stage = "completed"
            elif partial_success:
                message = f"{successful_devices}/{device_count} devices onboarded successfully, {failed_devices} failed"
                stage = "partial_success"
            else:
                message = f"All {device_count} devices failed to complete post-onboarding steps"
                stage = "all_failed"
        else:
            # Single device - use the device result directly
            result = device_results[0]
            if result.get("success"):
                message = f"Device {result.get('device_name', 'unknown')} successfully onboarded, configured, and synced"
                stage = "completed"
            else:
                message = result.get("error", "Device processing failed")
                stage = result.get("stage", "failed")

        return {
            "success": all_success,
            "partial_success": partial_success,
            "message": message,
            "job_id": job_id,
            "job_url": job_url,
            "device_count": device_count,
            "successful_devices": successful_devices,
            "failed_devices": failed_devices,
            "devices": device_results,
            "tags_applied": len(tags) if tags else 0,
            "custom_fields_applied": len(custom_fields) if custom_fields else 0,
            "stage": stage,
        }

    except Exception as e:
        error_msg = f"Unexpected error during device onboarding: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return {"success": False, "error": error_msg, "stage": "exception"}


def _process_single_device(
    task_instance,
    ip_address: str,
    namespace_id: str,
    prefix_status_id: str,
    interface_status_id: str,
    ip_address_status_id: str,
    sync_options: Optional[List[str]],
    tags: Optional[List[str]],
    custom_fields: Optional[Dict[str, str]],
    device_num: int,
    device_count: int,
) -> dict:
    """
    Process a single device after onboarding: lookup, update tags/custom fields, sync.

    Args:
        task_instance: Celery task instance for progress updates
        ip_address: Single IP address
        namespace_id: Namespace ID
        prefix_status_id: Prefix status ID
        interface_status_id: Interface status ID
        ip_address_status_id: IP address status ID
        sync_options: List of sync options
        tags: List of tag IDs
        custom_fields: Dict of custom field values
        device_num: Current device number (1-based)
        device_count: Total number of devices

    Returns:
        dict: Result for this device
    """
    try:
        logger.info(
            f"Processing device {device_num}/{device_count}: looking up {ip_address}"
        )

        # Get device UUID from IP address
        device_id, device_name = _get_device_id_from_ip(ip_address)

        if not device_id:
            error_msg = f"Failed to retrieve device ID for IP {ip_address}"
            logger.error(error_msg)
            return {
                "success": False,
                "ip_address": ip_address,
                "error": error_msg,
                "stage": "device_lookup_failed",
            }

        logger.info(
            f"Found device {device_num}/{device_count}: {device_name} (ID: {device_id})"
        )

        # Update device with tags and custom fields
        update_results = []

        if tags and len(tags) > 0:
            logger.info(f"Updating device {device_name} with {len(tags)} tags")
            tag_result = _update_device_tags(device_id, tags)
            update_results.append(tag_result)

        if custom_fields and len(custom_fields) > 0:
            logger.info(
                f"Updating device {device_name} with {len(custom_fields)} custom fields"
            )
            cf_result = _update_device_custom_fields(device_id, custom_fields)
            update_results.append(cf_result)

        # Check if all updates succeeded
        all_updates_success = all(r.get("success", False) for r in update_results)

        if update_results and not all_updates_success:
            failed_updates = [r for r in update_results if not r.get("success", False)]
            logger.warning(f"Some updates failed for {device_name}: {failed_updates}")

        # Sync network data from device
        logger.info(f"Starting network data sync for device {device_name}")
        sync_result = _sync_network_data(
            device_id=device_id,
            namespace_id=namespace_id,
            prefix_status_id=prefix_status_id,
            interface_status_id=interface_status_id,
            ip_address_status_id=ip_address_status_id,
            sync_options=sync_options,
        )

        logger.info(f"Device {device_name} ({ip_address}) processing complete")

        return {
            "success": True,
            "ip_address": ip_address,
            "device_id": device_id,
            "device_name": device_name,
            "update_results": update_results,
            "sync_result": sync_result,
            "stage": "completed",
        }

    except Exception as e:
        error_msg = f"Error processing device {ip_address}: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return {
            "success": False,
            "ip_address": ip_address,
            "error": error_msg,
            "stage": "exception",
        }


def _trigger_nautobot_onboarding(
    ip_address: str,
    location_id: str,
    role_id: str,
    namespace_id: str,
    status_id: str,
    interface_status_id: str,
    ip_address_status_id: str,
    secret_groups_id: str,
    platform_id: str,
    port: int,
    timeout: int,
) -> tuple:
    """
    Trigger Nautobot onboarding job.

    Returns:
        tuple: (job_id, job_url)
    """
    import requests
    from utils.nautobot_helpers import get_nautobot_config, get_nautobot_headers

    # Get Nautobot config
    nautobot_url, nautobot_token = get_nautobot_config()

    # Prepare job data
    job_data = {
        "data": {
            "location": location_id,
            "ip_addresses": ip_address,
            "secrets_group": secret_groups_id,
            "device_role": role_id,
            "namespace": namespace_id,
            "device_status": status_id,
            "interface_status": interface_status_id,
            "ip_address_status": ip_address_status_id,
            "platform": None if platform_id == "detect" else platform_id,
            "port": port,
            "timeout": timeout,
            "update_devices_without_primary_ip": False,
        }
    }

    # Call Nautobot job API
    job_url = f"{nautobot_url}/api/extras/jobs/Sync%20Devices%20From%20Network/run/"
    headers = get_nautobot_headers(nautobot_token)

    response = requests.post(job_url, json=job_data, headers=headers, timeout=30)
    response.raise_for_status()

    result = response.json()
    job_id = result.get("job_result", {}).get("id")

    if not job_id:
        raise Exception(f"No job ID returned from Nautobot: {result}")

    return job_id, f"{nautobot_url}/extras/job-results/{job_id}/"


def _wait_for_job_completion(task_instance, job_id: str, max_wait: int = 90) -> tuple:
    """
    Wait for Nautobot job to complete with progress updates.

    Args:
        task_instance: Celery task instance (self)
        job_id: Nautobot job ID
        max_wait: Maximum seconds to wait

    Returns:
        tuple: (success: bool, result: str)
    """
    import requests
    from utils.nautobot_helpers import get_nautobot_config

    # Get Nautobot config
    nautobot_url, nautobot_token = get_nautobot_config()

    headers = {
        "Authorization": f"Token {nautobot_token}",
    }

    check_url = f"{nautobot_url}/api/extras/job-results/{job_id}/"

    start_time = time.time()
    check_count = 0

    while time.time() - start_time < max_wait:
        try:
            response = requests.get(check_url, headers=headers, timeout=10)
            response.raise_for_status()
            job_data = response.json()

            status = job_data.get("status", {}).get("value", "")
            check_count += 1
            elapsed = int(time.time() - start_time)

            logger.info(
                f"Job {job_id} status check #{check_count} (after {elapsed}s): {status}"
            )

            # Update task progress with detailed status
            progress_percentage = min(
                30 + int((elapsed / max_wait) * 30), 59
            )  # Stay between 30-59%
            task_instance.update_state(
                state="PROGRESS",
                meta={
                    "stage": "waiting",
                    "status": f"Waiting for onboarding job (check #{check_count}, {elapsed}s elapsed, status: {status})",
                    "progress": progress_percentage,
                    "job_id": job_id,
                },
            )

            # Check for completion (case-insensitive)
            status_lower = status.lower()
            if status_lower in ["completed", "success"]:
                logger.info(f"Job {job_id} completed successfully")
                return True, "Job completed successfully"
            elif status_lower in ["failed", "errored", "failure"]:
                logger.error(f"Job {job_id} failed with status: {status}")
                return False, f"Job failed with status: {status}"

            # Job still running, wait 2 seconds and check again
            time.sleep(2)

        except Exception as e:
            logger.warning(f"Error checking job status (attempt {check_count}): {e}")
            check_count += 1
            elapsed = int(time.time() - start_time)

            # Update progress even on error
            progress_percentage = min(30 + int((elapsed / max_wait) * 30), 59)
            task_instance.update_state(
                state="PROGRESS",
                meta={
                    "stage": "waiting",
                    "status": f"Checking onboarding job status (attempt #{check_count}, {elapsed}s elapsed)",
                    "progress": progress_percentage,
                    "job_id": job_id,
                },
            )

            # Wait 2 seconds before retry
            time.sleep(2)

    return (
        False,
        f"Job timeout - exceeded {max_wait} seconds after {check_count} status checks",
    )


def _get_device_id_from_ip(ip_address: str) -> tuple:
    """
    Get device ID and name from IP address using detailed endpoint.

    Returns:
        tuple: (device_id: str, device_name: str)
    """
    # Use asyncio to call the async service
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(_async_get_device_id(ip_address))
        return result
    finally:
        loop.close()


async def _async_get_device_id(ip_address: str) -> tuple:
    """Async helper to get device ID from IP."""
    from services.nautobot import nautobot_service

    # Build GraphQL query (same as detailed endpoint)
    query = """
    query IPaddresses($address_filter: [String], $get_id: Boolean!, $get_name: Boolean!, $get_primary_ip4_for: Boolean!) {
      ip_addresses(address: $address_filter) {
        id @include(if: $get_id)
        address
        primary_ip4_for @include(if: $get_primary_ip4_for) {
          id @include(if: $get_id)
          name @include(if: $get_name)
        }
      }
    }
    """

    variables = {
        "address_filter": [ip_address],
        "get_id": True,
        "get_name": True,
        "get_primary_ip4_for": True,
    }

    result = await nautobot_service.graphql_query(query, variables)

    if "errors" in result:
        logger.error(f"GraphQL errors: {result['errors']}")
        return None, None

    ip_addresses = result.get("data", {}).get("ip_addresses", [])

    if not ip_addresses:
        logger.error(f"No IP address found for {ip_address}")
        return None, None

    ip_data = ip_addresses[0]
    primary_devices = ip_data.get("primary_ip4_for", [])

    if not primary_devices:
        logger.error(f"IP {ip_address} is not a primary IP for any device")
        return None, None

    device = primary_devices[0]
    return device.get("id"), device.get("name")


def _update_device_tags(device_id: str, tag_ids: List[str]) -> dict:
    """Update device tags in Nautobot."""
    import requests
    from utils.nautobot_helpers import get_nautobot_config, get_nautobot_headers

    try:
        # Get Nautobot config
        nautobot_url, nautobot_token = get_nautobot_config()

        # Update device tags via REST API
        url = f"{nautobot_url}/api/dcim/devices/{device_id}/"
        headers = get_nautobot_headers(nautobot_token)

        # PATCH to update only tags
        data = {"tags": tag_ids}

        response = requests.patch(url, json=data, headers=headers, timeout=30)
        response.raise_for_status()

        return {
            "success": True,
            "type": "tags",
            "count": len(tag_ids),
            "message": f"Applied {len(tag_ids)} tags",
        }

    except Exception as e:
        logger.error(f"Failed to update device tags: {e}")
        return {"success": False, "type": "tags", "error": str(e)}


def _update_device_custom_fields(device_id: str, custom_fields: Dict[str, str]) -> dict:
    """Update device custom fields in Nautobot."""
    import requests
    from utils.nautobot_helpers import get_nautobot_config, get_nautobot_headers

    try:
        # Get Nautobot config
        nautobot_url, nautobot_token = get_nautobot_config()

        # Update device custom fields via REST API
        url = f"{nautobot_url}/api/dcim/devices/{device_id}/"
        headers = get_nautobot_headers(nautobot_token)

        # PATCH to update only custom fields
        data = {"custom_fields": custom_fields}

        response = requests.patch(url, json=data, headers=headers, timeout=30)
        response.raise_for_status()

        return {
            "success": True,
            "type": "custom_fields",
            "count": len(custom_fields),
            "message": f"Applied {len(custom_fields)} custom fields",
        }

    except Exception as e:
        logger.error(f"Failed to update device custom fields: {e}")
        return {"success": False, "type": "custom_fields", "error": str(e)}


def _sync_network_data(
    device_id: str,
    namespace_id: str,
    prefix_status_id: str,
    interface_status_id: str,
    ip_address_status_id: str,
    sync_options: Optional[List[str]] = None,
) -> dict:
    """
    Sync network data from device to Nautobot.

    Triggers the "Sync Network Data From Network" job with user-specified sync options.

    Args:
        device_id: Device ID to sync
        namespace_id: Namespace ID for prefixes
        prefix_status_id: Prefix status ID
        interface_status_id: Interface status ID
        ip_address_status_id: IP address status ID
        sync_options: List of sync options (cables, software, vlans, vrfs)

    Returns:
        dict: Result with success status, job_id, and message
    """
    import requests
    from utils.nautobot_helpers import get_nautobot_config, get_nautobot_headers

    # Default sync options if none provided
    if sync_options is None:
        sync_options = ["cables", "software", "vlans", "vrfs"]

    try:
        # Get Nautobot config
        nautobot_url, nautobot_token = get_nautobot_config()

        # Prepare sync job data with user-specified options
        job_data = {
            "data": {
                "devices": [device_id],
                "default_prefix_status": prefix_status_id,
                "interface_status": interface_status_id,
                "ip_address_status": ip_address_status_id,
                "namespace": namespace_id,
                "sync_cables": "cables" in sync_options,
                "sync_software_version": "software" in sync_options,
                "sync_vlans": "vlans" in sync_options,
                "sync_vrfs": "vrfs" in sync_options,
            }
        }

        # Call Nautobot sync job API
        job_url = f"{nautobot_url}/api/extras/jobs/Sync%20Network%20Data%20From%20Network/run/"
        headers = get_nautobot_headers(nautobot_token)

        logger.info(f"Triggering network data sync job for device {device_id}")
        response = requests.post(job_url, json=job_data, headers=headers, timeout=30)

        if response.status_code in [200, 201, 202]:
            result = response.json()
            sync_job_id = result.get("job_result", {}).get("id") or result.get("id")
            logger.info(f"Network data sync job started: {sync_job_id}")

            return {
                "success": True,
                "message": "Network data sync job started successfully",
                "job_id": sync_job_id,
                "job_url": f"{nautobot_url}/extras/job-results/{sync_job_id}/",
                "sync_options": {
                    "cables": "cables" in sync_options,
                    "software": "software" in sync_options,
                    "vlans": "vlans" in sync_options,
                    "vrfs": "vrfs" in sync_options,
                },
            }
        else:
            error_detail = "Unknown error"
            try:
                error_response = response.json()
                error_detail = error_response.get(
                    "detail", error_response.get("message", str(error_response))
                )
            except (ValueError, KeyError, TypeError):
                error_detail = response.text or f"HTTP {response.status_code}"

            logger.error(f"Failed to start sync job: {error_detail}")
            return {
                "success": False,
                "message": f"Failed to start sync job: {error_detail}",
                "status_code": response.status_code,
            }

    except Exception as e:
        logger.error(f"Failed to sync network data: {e}")
        return {
            "success": False,
            "error": str(e),
            "message": f"Failed to sync network data: {str(e)}",
        }
