"""Business logic for onboarding devices into Nautobot.

Worker-only module. The ``asyncio.run`` call below is reachable only from
``tasks/onboard_device_task.py`` (Celery). It MUST NOT be invoked from any
``async def`` FastAPI route — that would raise ``RuntimeError: asyncio.run()
cannot be called from a running event loop``. See
``doc/refactoring/CURSOR_ASYNC_PLAN.md`` §5.5.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Dict, List, Optional

import requests

logger = logging.getLogger(__name__)


class DeviceOnboardingService:
    """Orchestrates Nautobot onboarding API calls and post-onboarding configuration.

    Celery-only: invoked exclusively from ``tasks.onboard_device_task``.
    """

    def onboard(
        self,
        task_instance,
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
        username: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> dict:
        """
        Orchestrate: trigger Nautobot job, wait, post-process each device.

        Moves the entire body of onboard_device_task() here.
        """
        from utils.task_progress import ProgressUpdater

        try:
            ip_list = [ip.strip() for ip in ip_address.split(",") if ip.strip()]
            device_count = len(ip_list)
            is_multi_device = device_count > 1

            logger.info(
                "Starting device onboarding for %s IP(s): %s",
                device_count,
                ", ".join(ip_list),
            )
            logger.info("Audit logging info: username=%s, user_id=%s", username, user_id)

            updater = ProgressUpdater(task_instance)

            updater.update(
                "onboarding",
                "Initiating onboarding for %s device(s)" % device_count,
                5,
                device_count=device_count,
                ip_addresses=ip_list,
            )

            job_id, job_url = self._trigger_nautobot_onboarding(
                ip_address=ip_address,
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

            logger.info("Nautobot onboarding job started: %s", job_id)
            updater.update(
                "waiting",
                "Waiting for onboarding job to complete (%s devices)" % device_count,
                10,
                job_id=job_id,
                job_url=job_url,
                device_count=device_count,
            )

            job_success, job_result = self._wait_for_job_completion(task_instance, job_id, max_wait=onboarding_timeout)

            if not job_success:
                error_msg = "Onboarding job failed or timed out: %s" % job_result
                logger.error(error_msg)
                return {
                    "success": False,
                    "error": error_msg,
                    "job_id": job_id,
                    "job_url": job_url,
                    "stage": "onboarding_failed",
                    "device_count": device_count,
                }

            logger.info("Onboarding job completed successfully: %s", job_id)

            device_results = []
            successful_devices = 0
            failed_devices = 0

            for idx, single_ip in enumerate(ip_list):
                device_num = idx + 1
                base_progress = 50
                progress_per_device = 45 / device_count
                current_progress = int(base_progress + (idx * progress_per_device))

                updater.update(
                    "processing_devices",
                    "Processing device %s/%s: %s" % (device_num, device_count, single_ip),
                    current_progress,
                    job_id=job_id,
                    job_url=job_url,
                    current_device=device_num,
                    device_count=device_count,
                    current_ip=single_ip,
                )

                device_result = self._process_single_device(
                    task_instance=task_instance,
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
                    username=username,
                    user_id=user_id,
                )

                device_results.append(device_result)

                if device_result.get("success"):
                    successful_devices += 1
                else:
                    failed_devices += 1

            all_success = failed_devices == 0
            partial_success = successful_devices > 0 and failed_devices > 0

            if is_multi_device:
                if all_success:
                    message = "All %s devices successfully onboarded, configured, and synced" % device_count
                    stage = "completed"
                elif partial_success:
                    message = "%s/%s devices onboarded successfully, %s failed" % (
                        successful_devices,
                        device_count,
                        failed_devices,
                    )
                    stage = "partial_success"
                else:
                    message = "All %s devices failed to complete post-onboarding steps" % device_count
                    stage = "all_failed"
            else:
                result = device_results[0]
                if result.get("success"):
                    message = "Device %s successfully onboarded, configured, and synced" % result.get(
                        "device_name", "unknown"
                    )
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
            error_msg = "Unexpected error during device onboarding: %s" % str(e)
            logger.error(error_msg, exc_info=True)
            return {"success": False, "error": error_msg, "stage": "exception"}

    def _trigger_nautobot_onboarding(
        self,
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
        """POST to Nautobot onboarding API; return (job_id, job_url)."""
        from utils.nautobot_helpers import get_nautobot_config, get_nautobot_headers

        nautobot_url, nautobot_token = get_nautobot_config()

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

        job_url = "%s/api/extras/jobs/Sync%%20Devices%%20From%%20Network/run/" % nautobot_url
        headers = get_nautobot_headers(nautobot_token)

        response = requests.post(job_url, json=job_data, headers=headers, timeout=30)
        response.raise_for_status()

        result = response.json()
        job_id = result.get("job_result", {}).get("id")

        if not job_id:
            raise Exception("No job ID returned from Nautobot: %s" % result)

        return job_id, "%s/extras/job-results/%s/" % (nautobot_url, job_id)

    def _wait_for_job_completion(
        self,
        task_instance,
        job_id: str,
        max_wait: int = 90,
    ) -> tuple:
        """Poll Nautobot job status until terminal state or timeout."""
        from utils.nautobot_helpers import get_nautobot_config

        nautobot_url, nautobot_token = get_nautobot_config()

        headers = {
            "Authorization": "Token %s" % nautobot_token,
        }

        check_url = "%s/api/extras/job-results/%s/" % (nautobot_url, job_id)

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
                    "Job %s status check #%s (after %ss): %s",
                    job_id,
                    check_count,
                    elapsed,
                    status,
                )

                progress_percentage = min(30 + int((elapsed / max_wait) * 30), 59)
                task_instance.update_state(
                    state="PROGRESS",
                    meta={
                        "stage": "waiting",
                        "status": "Waiting for onboarding job (check #%s, %ss elapsed, status: %s)"
                        % (check_count, elapsed, status),
                        "progress": progress_percentage,
                        "job_id": job_id,
                    },
                )

                status_lower = status.lower()
                if status_lower in ["completed", "success"]:
                    logger.info("Job %s completed successfully", job_id)
                    return True, "Job completed successfully"
                elif status_lower in ["failed", "errored", "failure"]:
                    logger.error("Job %s failed with status: %s", job_id, status)
                    return False, "Job failed with status: %s" % status

                time.sleep(2)

            except Exception as e:
                logger.warning("Error checking job status (attempt %s): %s", check_count, e)
                check_count += 1
                elapsed = int(time.time() - start_time)

                progress_percentage = min(30 + int((elapsed / max_wait) * 30), 59)
                task_instance.update_state(
                    state="PROGRESS",
                    meta={
                        "stage": "waiting",
                        "status": "Checking onboarding job status (attempt #%s, %ss elapsed)" % (check_count, elapsed),
                        "progress": progress_percentage,
                        "job_id": job_id,
                    },
                )

                time.sleep(2)

        return (
            False,
            "Job timeout - exceeded %s seconds after %s status checks" % (max_wait, check_count),
        )

    def _get_device_id_from_ip(self, ip_address: str) -> tuple:
        """GraphQL lookup: return (device_id, device_name) for an IP address.

        Celery-only sync bridge to the async NautobotService. Must NOT be called
        from any running event loop (FastAPI routes); enforced by the parent
        class being marked Celery-only.
        """
        return asyncio.run(self._async_get_device_id(ip_address))

    async def _async_get_device_id(self, ip_address: str) -> tuple:
        """Async helper to get device ID from IP."""
        import service_factory

        nautobot_service = service_factory.build_nautobot_service()

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
            logger.error("GraphQL errors: %s", result["errors"])
            return None, None

        ip_addresses = result.get("data", {}).get("ip_addresses", [])

        if not ip_addresses:
            logger.error("No IP address found for %s", ip_address)
            return None, None

        ip_data = ip_addresses[0]
        primary_devices = ip_data.get("primary_ip4_for", [])

        if not primary_devices:
            logger.error("IP %s is not a primary IP for any device", ip_address)
            return None, None

        device = primary_devices[0]
        return device.get("id"), device.get("name")

    def _update_device_tags(self, device_id: str, tag_ids: List[str]) -> dict:
        """PATCH device tag list via Nautobot REST API."""
        from utils.nautobot_helpers import get_nautobot_config, get_nautobot_headers

        try:
            nautobot_url, nautobot_token = get_nautobot_config()

            url = "%s/api/dcim/devices/%s/" % (nautobot_url, device_id)
            headers = get_nautobot_headers(nautobot_token)

            data = {"tags": tag_ids}

            response = requests.patch(url, json=data, headers=headers, timeout=30)
            response.raise_for_status()

            return {
                "success": True,
                "type": "tags",
                "count": len(tag_ids),
                "message": "Applied %s tags" % len(tag_ids),
            }

        except Exception as e:
            logger.error("Failed to update device tags: %s", e)
            return {"success": False, "type": "tags", "error": str(e)}

    def _update_device_custom_fields(self, device_id: str, custom_fields: Dict[str, str]) -> dict:
        """PATCH device custom fields via Nautobot REST API."""
        from utils.nautobot_helpers import get_nautobot_config, get_nautobot_headers

        try:
            nautobot_url, nautobot_token = get_nautobot_config()

            url = "%s/api/dcim/devices/%s/" % (nautobot_url, device_id)
            headers = get_nautobot_headers(nautobot_token)

            data = {"custom_fields": custom_fields}

            response = requests.patch(url, json=data, headers=headers, timeout=30)
            response.raise_for_status()

            return {
                "success": True,
                "type": "custom_fields",
                "count": len(custom_fields),
                "message": "Applied %s custom fields" % len(custom_fields),
            }

        except Exception as e:
            logger.error("Failed to update device custom fields: %s", e)
            return {"success": False, "type": "custom_fields", "error": str(e)}

    def _sync_network_data(
        self,
        device_id: str,
        namespace_id: str,
        prefix_status_id: str,
        interface_status_id: str,
        ip_address_status_id: str,
        sync_options: Optional[List[str]] = None,
    ) -> dict:
        """Trigger Nautobot sync job for a device."""
        from utils.nautobot_helpers import get_nautobot_config, get_nautobot_headers

        if sync_options is None:
            sync_options = ["cables", "software", "vlans", "vrfs"]

        try:
            nautobot_url, nautobot_token = get_nautobot_config()

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

            job_url = "%s/api/extras/jobs/Sync%%20Network%%20Data%%20From%%20Network/run/" % nautobot_url
            headers = get_nautobot_headers(nautobot_token)

            logger.info("Triggering network data sync job for device %s", device_id)
            response = requests.post(job_url, json=job_data, headers=headers, timeout=30)

            if response.status_code in [200, 201, 202]:
                result = response.json()
                sync_job_id = result.get("job_result", {}).get("id") or result.get("id")
                logger.info("Network data sync job started: %s", sync_job_id)

                return {
                    "success": True,
                    "message": "Network data sync job started successfully",
                    "job_id": sync_job_id,
                    "job_url": "%s/extras/job-results/%s/" % (nautobot_url, sync_job_id),
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
                    error_detail = error_response.get("detail", error_response.get("message", str(error_response)))
                except (ValueError, KeyError, TypeError):
                    error_detail = response.text or "HTTP %s" % response.status_code

                logger.error("Failed to start sync job: %s", error_detail)
                return {
                    "success": False,
                    "message": "Failed to start sync job: %s" % error_detail,
                    "status_code": response.status_code,
                }

        except Exception as e:
            logger.error("Failed to sync network data: %s", e)
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to sync network data: %s" % str(e),
            }

    def _process_single_device(
        self,
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
        username: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> dict:
        """Lookup, update, and sync one device after Nautobot onboarding completes."""
        from utils.audit_logger import log_device_onboarding

        try:
            logger.info(
                "Processing device %s/%s: looking up %s",
                device_num,
                device_count,
                ip_address,
            )

            device_id, device_name = self._get_device_id_from_ip(ip_address)

            if not device_id:
                error_msg = "Failed to retrieve device ID for IP %s" % ip_address
                logger.error(error_msg)

                if username:
                    log_device_onboarding(
                        username=username or "unknown",
                        device_name=ip_address,
                        device_id=None,
                        user_id=user_id,
                        success=False,
                        error_message=error_msg,
                    )

                return {
                    "success": False,
                    "ip_address": ip_address,
                    "error": error_msg,
                    "stage": "device_lookup_failed",
                }

            logger.info(
                "Found device %s/%s: %s (ID: %s)",
                device_num,
                device_count,
                device_name,
                device_id,
            )

            update_results = []

            if tags and len(tags) > 0:
                logger.info("Updating device %s with %s tags", device_name, len(tags))
                tag_result = self._update_device_tags(device_id, tags)
                update_results.append(tag_result)

            if custom_fields and len(custom_fields) > 0:
                logger.info(
                    "Updating device %s with %s custom fields",
                    device_name,
                    len(custom_fields),
                )
                cf_result = self._update_device_custom_fields(device_id, custom_fields)
                update_results.append(cf_result)

            all_updates_success = all(r.get("success", False) for r in update_results)

            if update_results and not all_updates_success:
                failed_updates = [r for r in update_results if not r.get("success", False)]
                logger.warning("Some updates failed for %s: %s", device_name, failed_updates)

            logger.info("Starting network data sync for device %s", device_name)
            sync_result = self._sync_network_data(
                device_id=device_id,
                namespace_id=namespace_id,
                prefix_status_id=prefix_status_id,
                interface_status_id=interface_status_id,
                ip_address_status_id=ip_address_status_id,
                sync_options=sync_options,
            )

            logger.info("Device %s (%s) processing complete", device_name, ip_address)

            logger.info(
                "Attempting to log audit entry: username=%s, device_name=%s",
                username,
                device_name,
            )
            if username:
                log_device_onboarding(
                    username=username or "unknown",
                    device_name=device_name,
                    device_id=device_id,
                    user_id=user_id,
                    success=True,
                )
                logger.info("Audit log created for device %s", device_name)
            else:
                logger.warning(
                    "No username provided, skipping audit log for device %s",
                    device_name,
                )

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
            error_msg = "Error processing device %s: %s" % (ip_address, str(e))
            logger.error(error_msg, exc_info=True)

            from utils.audit_logger import log_device_onboarding

            if username:
                log_device_onboarding(
                    username=username or "unknown",
                    device_name=ip_address,
                    device_id=None,
                    user_id=user_id,
                    success=False,
                    error_message=error_msg,
                )

            return {
                "success": False,
                "ip_address": ip_address,
                "error": error_msg,
                "stage": "exception",
            }
