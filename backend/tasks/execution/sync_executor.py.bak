"""
Sync devices to CheckMK job executor.
Syncs devices from Nautobot to CheckMK monitoring system.

Moved from job_tasks.py to improve code organization.
"""

import logging
import asyncio
from typing import Dict, Any, Optional
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


def execute_sync_devices(
    schedule_id: Optional[int],
    credential_id: Optional[int],
    job_parameters: Optional[dict],
    target_devices: Optional[list],
    task_context,
    template: Optional[dict] = None,
    job_run_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Execute sync_devices job (Nautobot to CheckMK).

    Syncs devices from Nautobot to CheckMK. If target_devices is provided (from inventory),
    only those devices are synced. Otherwise, all devices are synced.

    Args:
        schedule_id: Job schedule ID
        credential_id: Optional credential ID (not used for sync)
        job_parameters: Additional job parameters
        target_devices: List of device UUIDs to sync, or None for all devices
        task_context: Celery task context for progress updates
        template: Job template configuration (contains activate_changes_after_sync setting)

    Returns:
        dict: Sync results with counts and per-device details
    """
    try:
        # Force reload configuration files to ensure we use the latest SNMP mapping
        # and other config changes without requiring Celery worker restart
        from services.checkmk.config import config_service

        config_service.reload_config()
        logger.info("Reloaded configuration files for device sync task")

        task_context.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": 100, "status": "Initializing CheckMK sync..."},
        )

        from services.checkmk.sync.base import nb2cmk_service

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
                "message": "No devices to sync",
                "total": 0,
                "success_count": 0,
                "failed_count": 0,
            }

        total_devices = len(device_ids)
        success_count = 0
        failed_count = 0
        results = []

        logger.info(f"Starting sync of {total_devices} devices to CheckMK")

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
                        "status": f"Syncing device {i + 1}/{total_devices}",
                        "success": success_count,
                        "failed": failed_count,
                    },
                )

                # Sync device - try update first, then add if not found
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    try:
                        result = loop.run_until_complete(
                            nb2cmk_service.update_device_in_checkmk(device_id)
                        )
                        success_count += 1
                        results.append(
                            {
                                "device_id": device_id,
                                "hostname": result.hostname
                                if hasattr(result, "hostname")
                                else device_id,
                                "operation": "update",
                                "success": True,
                                "message": result.message
                                if hasattr(result, "message")
                                else "Updated",
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
                            result = loop.run_until_complete(
                                nb2cmk_service.add_device_to_checkmk(device_id)
                            )
                            success_count += 1
                            results.append(
                                {
                                    "device_id": device_id,
                                    "hostname": result.hostname
                                    if hasattr(result, "hostname")
                                    else device_id,
                                    "operation": "add",
                                    "success": True,
                                    "message": result.message
                                    if hasattr(result, "message")
                                    else "Added",
                                }
                            )
                        else:
                            raise
                finally:
                    loop.close()

            except Exception as e:
                failed_count += 1
                error_msg = str(e)
                logger.error(f"Error syncing device {device_id}: {error_msg}")
                results.append(
                    {
                        "device_id": device_id,
                        "operation": "sync",
                        "success": False,
                        "error": error_msg,
                    }
                )

        # Update final progress
        task_context.update_state(
            state="PROGRESS",
            meta={"current": 100, "total": 100, "status": "Sync complete"},
        )

        logger.info(
            f"Sync completed: {success_count}/{total_devices} devices synced, "
            f"{failed_count} failed"
        )

        # Activate CheckMK changes if configured and at least one device synced successfully
        activation_result = None
        # Get activate_changes_after_sync from template (default True if not specified)
        activate_changes = True

        # Log template details for debugging
        logger.info(f"[ACTIVATION DEBUG] Template provided: {template is not None}")
        if template:
            logger.info(f"[ACTIVATION DEBUG] Template keys: {list(template.keys())}")
            logger.info(
                f"[ACTIVATION DEBUG] activate_changes_after_sync in template: {'activate_changes_after_sync' in template}"
            )
            activate_changes = template.get("activate_changes_after_sync", True)
            logger.info(
                f"[ACTIVATION DEBUG] activate_changes_after_sync value from template: {template.get('activate_changes_after_sync')}"
            )

        logger.info(
            f"[ACTIVATION DEBUG] Final activate_changes value: {activate_changes}"
        )
        logger.info(f"[ACTIVATION DEBUG] success_count: {success_count}")
        logger.info(
            f"[ACTIVATION DEBUG] Will activate changes: {activate_changes and success_count > 0}"
        )

        if activate_changes and success_count > 0:
            try:
                logger.info("Activating CheckMK changes after sync...")
                task_context.update_state(
                    state="PROGRESS",
                    meta={
                        "current": 97,
                        "total": 100,
                        "status": "Activating CheckMK changes...",
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
        else:
            if not activate_changes:
                logger.info(
                    "[ACTIVATION] Skipping activation - activate_changes_after_sync is disabled"
                )
            elif success_count == 0:
                logger.info(
                    "[ACTIVATION] Skipping activation - no devices were synced successfully"
                )

        # Update final progress
        task_context.update_state(
            state="PROGRESS",
            meta={"current": 100, "total": 100, "status": "Sync complete"},
        )

        return {
            "success": True,
            "message": f"Synced {success_count}/{total_devices} devices",
            "total": total_devices,
            "success_count": success_count,
            "failed_count": failed_count,
            "results": results,
            "activation": activation_result,
        }

    except Exception as e:
        error_msg = str(e)
        logger.error(f"Sync devices job failed: {error_msg}", exc_info=True)
        return {"success": False, "error": error_msg}


def _activate_checkmk_changes() -> Dict[str, Any]:
    """
    Helper function to activate pending CheckMK configuration changes.
    Called after sync operations complete successfully.

    Returns:
        dict: Activation result
    """
    from settings_manager import settings_manager
    from checkmk.client import CheckMKClient

    logger.info("[ACTIVATION] Starting CheckMK change activation...")

    db_settings = settings_manager.get_checkmk_settings()
    if not db_settings or not all(
        key in db_settings for key in ["url", "site", "username", "password"]
    ):
        logger.warning("[ACTIVATION] CheckMK settings not configured or incomplete")
        logger.warning(
            f"[ACTIVATION] db_settings keys: {list(db_settings.keys()) if db_settings else 'None'}"
        )
        return {
            "success": False,
            "message": "CheckMK settings not configured",
        }

    logger.info(
        f"[ACTIVATION] CheckMK settings loaded - URL: {db_settings.get('url')}, Site: {db_settings.get('site')}"
    )

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
    logger.info(
        f"[ACTIVATION] Connecting to CheckMK - Host: {host}, Protocol: {protocol}, Site: {effective_site}"
    )

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
    logger.info(
        f"[ACTIVATION] Calling client.activate_changes(sites=[{effective_site}], force_foreign_changes=True, redirect=False)"
    )
    try:
        result = client.activate_changes(
            sites=[effective_site],
            force_foreign_changes=True,
            redirect=False,
        )
        logger.info(f"[ACTIVATION] activate_changes returned: {result}")
    except Exception as e:
        logger.error(
            f"[ACTIVATION] activate_changes raised exception: {e}", exc_info=True
        )
        return {
            "success": False,
            "message": f"activate_changes failed: {str(e)}",
            "error": str(e),
        }

    return {
        "success": True,
        "message": "Changes activated successfully",
        "data": result,
    }
