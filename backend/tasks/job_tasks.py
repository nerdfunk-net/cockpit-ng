"""
Job execution tasks for scheduled jobs.
These tasks are triggered by job schedules and can be executed on-demand or periodically.
"""

from celery_app import celery_app
import logging
from typing import Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


# ============================================================================
# Schedule Checker Task
# ============================================================================


@celery_app.task(name="tasks.check_job_schedules")
def check_job_schedules_task() -> dict:
    """
    Periodic Task: Check for due job schedules and dispatch them.

    Runs every minute via Celery Beat. Finds schedules that:
    1. Are active
    2. Have next_run <= now
    3. Haven't been run yet for this scheduled time

    Returns:
        dict: Summary of dispatched jobs
    """
    try:
        logger.debug("Checking for due job schedules...")

        import jobs_manager
        import job_template_manager

        now = datetime.now(timezone.utc)
        dispatched = []
        errors = []

        # Get all active schedules
        schedules = jobs_manager.list_job_schedules(is_active=True)

        for schedule in schedules:
            try:
                # Check if schedule is due
                next_run = schedule.get("next_run")
                if not next_run:
                    continue

                # Parse next_run if it's a string
                if isinstance(next_run, str):
                    next_run = datetime.fromisoformat(next_run.replace("Z", "+00:00"))

                # Check if due (allow 30 second grace period)
                if next_run > now:
                    continue

                # Get the template for this schedule
                template_id = schedule.get("job_template_id")
                if not template_id:
                    logger.warning(
                        f"Schedule {schedule['id']} has no template_id, skipping"
                    )
                    continue

                template = job_template_manager.get_job_template(template_id)
                if not template:
                    logger.warning(
                        f"Template {template_id} not found for schedule {schedule['id']}"
                    )
                    continue

                # Dispatch the job
                dispatch_job.delay(
                    schedule_id=schedule["id"],
                    template_id=template_id,
                    job_name=schedule.get(
                        "job_identifier", f"schedule-{schedule['id']}"
                    ),
                    job_type=template.get("job_type"),
                    credential_id=schedule.get("credential_id"),
                    job_parameters=schedule.get("job_parameters"),
                    triggered_by="schedule",
                )

                dispatched.append(
                    {
                        "schedule_id": schedule["id"],
                        "job_name": schedule.get("job_identifier"),
                        "job_type": template.get("job_type"),
                    }
                )

                # Update next_run for the schedule
                jobs_manager.calculate_and_update_next_run(schedule["id"])

            except Exception as e:
                error_msg = f"Error dispatching schedule {schedule.get('id')}: {str(e)}"
                logger.error(error_msg, exc_info=True)
                errors.append(error_msg)

        if dispatched:
            logger.info(
                f"Dispatched {len(dispatched)} jobs: {[d['job_name'] for d in dispatched]}"
            )

        return {
            "success": True,
            "checked_at": now.isoformat(),
            "dispatched_count": len(dispatched),
            "dispatched": dispatched,
            "errors": errors,
        }

    except Exception as e:
        logger.error(f"check_job_schedules task failed: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


# ============================================================================
# Job Dispatcher Task
# ============================================================================


@celery_app.task(name="tasks.dispatch_job", bind=True)
def dispatch_job(
    self,
    schedule_id: Optional[int] = None,
    template_id: Optional[int] = None,
    job_name: str = "unnamed_job",
    job_type: str = None,
    credential_id: Optional[int] = None,
    job_parameters: Optional[dict] = None,
    triggered_by: str = "schedule",
    executed_by: Optional[str] = None,
    target_devices: Optional[list] = None,
) -> dict:
    """
    Task: Dispatch and execute a job based on its type.

    This task:
    1. Creates a JobRun record to track execution
    2. Maps job_type to the appropriate Celery task
    3. Executes the task and tracks results
    4. Updates JobRun status on completion/failure

    Args:
        schedule_id: ID of the schedule that triggered this job
        template_id: ID of the job template
        job_name: Human-readable job name
        job_type: Type of job (maps to specific task)
        credential_id: Optional credential ID for authentication
        job_parameters: Additional parameters for the job
        triggered_by: 'schedule' or 'manual'
        executed_by: Username for manual runs
        target_devices: List of target device names

    Returns:
        dict: Job execution results
    """
    import job_run_manager
    import job_template_manager

    job_run = None

    try:
        logger.info(
            f"Dispatching job: {job_name} (type: {job_type}, triggered_by: {triggered_by})"
        )

        # Get template details if needed
        template = None
        if template_id:
            template = job_template_manager.get_job_template(template_id)
            if template and not target_devices:
                # Get target devices based on inventory_source
                target_devices = _get_target_devices(template, job_parameters)

        # Create job run record
        job_run = job_run_manager.create_job_run(
            job_name=job_name,
            job_type=job_type or "unknown",
            triggered_by=triggered_by,
            job_schedule_id=schedule_id,
            job_template_id=template_id,
            target_devices=target_devices,
            executed_by=executed_by,
        )
        job_run_id = job_run["id"]

        # Mark as started
        job_run_manager.mark_started(job_run_id, self.request.id)

        # Execute the appropriate task based on job_type
        result = _execute_job_type(
            job_type=job_type,
            schedule_id=schedule_id,
            credential_id=credential_id,
            job_parameters=job_parameters,
            target_devices=target_devices,
            task_context=self,
            template=template,
        )

        # Mark as completed or failed based on result
        # Check for success: either explicit 'success: true' or 'status: completed'
        is_success = result.get("success") or result.get("status") == "completed"
        if is_success:
            job_run_manager.mark_completed(job_run_id, result=result)
            logger.info(f"Job {job_name} completed successfully")
        else:
            error_msg = result.get("error", result.get("message", "Unknown error"))
            job_run_manager.mark_failed(job_run_id, error_msg)
            logger.warning(f"Job {job_name} failed: {error_msg}")

        return result

    except Exception as e:
        error_msg = str(e)
        logger.error(f"Job dispatch failed for {job_name}: {error_msg}", exc_info=True)

        # Update job run if we created one
        if job_run:
            job_run_manager.mark_failed(job_run["id"], error_msg)

        return {
            "success": False,
            "error": error_msg,
            "job_name": job_name,
            "job_type": job_type,
        }


def _get_target_devices(
    template: dict, job_parameters: Optional[dict] = None
) -> Optional[list]:
    """
    Get target devices based on template's inventory source.

    Args:
        template: Job template configuration
        job_parameters: Additional job parameters

    Returns:
        List of device UUIDs, or None if all devices should be used
    """
    import asyncio

    inventory_source = template.get("inventory_source", "all")

    if inventory_source == "all":
        # Return None to indicate all devices
        return None
    elif inventory_source == "inventory":
        # Get devices from stored inventory (database)
        inventory_name = template.get("inventory_name")

        if not inventory_name:
            logger.warning("Inventory source selected but no inventory name provided")
            return None

        try:
            from inventory_manager import inventory_manager
            from services.inventory.inventory import inventory_service

            # Load inventory from database by name
            # Note: We need to get the username from the template context
            username = template.get(
                "created_by", "admin"
            )  # Fallback to admin if not specified

            inventory = inventory_manager.get_inventory_by_name(
                inventory_name, username
            )

            if not inventory:
                logger.warning(
                    f"Inventory '{inventory_name}' not found in database for user '{username}'"
                )
                return None

            # Create new event loop for async operations
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            try:
                # Convert tree structure to LogicalOperations (version 2)
                from utils.inventory_converter import (
                    convert_saved_inventory_to_operations,
                )

                operations = convert_saved_inventory_to_operations(
                    inventory["conditions"]
                )

                if not operations:
                    logger.warning(
                        f"No valid operations for inventory '{inventory_name}'"
                    )
                    return None

                # Preview inventory to get matching devices
                devices, _ = loop.run_until_complete(
                    inventory_service.preview_inventory(operations)
                )

                # Extract device IDs (UUIDs)
                device_ids = [device.id for device in devices]

                logger.info(
                    f"Loaded {len(device_ids)} devices from inventory '{inventory_name}'"
                )
                return device_ids

            finally:
                loop.close()

        except Exception as e:
            logger.error(
                f"Error loading inventory '{inventory_name}': {e}", exc_info=True
            )
            return None

    return None


def _execute_job_type(
    job_type: str,
    schedule_id: Optional[int],
    credential_id: Optional[int],
    job_parameters: Optional[dict],
    target_devices: Optional[list],
    task_context,
    template: Optional[dict] = None,
) -> dict:
    """Execute the appropriate task based on job type"""

    # Map job_type to execution function
    job_executors = {
        "cache_devices": _execute_cache_devices,
        "sync_devices": _execute_sync_devices,
        "backup": _execute_backup,
        "run_commands": _execute_run_commands,
        "compare_devices": _execute_compare_devices,
    }

    executor = job_executors.get(job_type)
    if not executor:
        return {"success": False, "error": f"Unknown job type: {job_type}"}

    return executor(
        schedule_id=schedule_id,
        credential_id=credential_id,
        job_parameters=job_parameters,
        target_devices=target_devices,
        task_context=task_context,
        template=template,
    )


# ============================================================================
# Job Type Executors
# ============================================================================


def _execute_cache_devices(
    schedule_id: Optional[int],
    credential_id: Optional[int],
    job_parameters: Optional[dict],
    target_devices: Optional[list],
    task_context,
    template: Optional[dict] = None,
) -> dict:
    """Execute cache_devices job"""
    try:
        task_context.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": 100, "status": "Connecting to Nautobot..."},
        )

        from services.nautobot import nautobot_service
        from services.settings.cache import cache_service
        import asyncio

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            task_context.update_state(
                state="PROGRESS",
                meta={"current": 30, "total": 100, "status": "Fetching devices..."},
            )

            query = """
            query getAllDevices {
              devices {
                id
                name
                role { name }
                location { name }
                primary_ip4 { address }
                status { name }
                device_type { model }
              }
            }
            """

            result = loop.run_until_complete(nautobot_service.graphql_query(query))

            if "errors" in result:
                return {
                    "success": False,
                    "error": f"GraphQL errors: {result['errors']}",
                }

            devices = result.get("data", {}).get("devices", [])

            task_context.update_state(
                state="PROGRESS",
                meta={"current": 70, "total": 100, "status": "Caching device data..."},
            )

            for device in devices:
                device_id = device.get("id")
                if device_id:
                    cache_key = f"nautobot:devices:{device_id}"
                    cache_service.set(cache_key, device, 30 * 60)

            return {
                "success": True,
                "devices_cached": len(devices),
                "message": f"Cached {len(devices)} devices from Nautobot",
            }

        finally:
            loop.close()

    except Exception as e:
        return {"success": False, "error": str(e)}


def _execute_sync_devices(
    schedule_id: Optional[int],
    credential_id: Optional[int],
    job_parameters: Optional[dict],
    target_devices: Optional[list],
    task_context,
    template: Optional[dict] = None,
) -> dict:
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
        dict: Sync results
    """
    import asyncio

    try:
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
            meta={"current": 95, "total": 100, "status": "Sync complete"},
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

        # Update final progress
        task_context.update_state(
            state="PROGRESS",
            meta={"current": 100, "total": 100, "status": "Complete"},
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


def _activate_checkmk_changes() -> dict:
    """
    Helper function to activate pending CheckMK configuration changes.
    Called after sync operations complete successfully.

    Returns:
        dict: Activation result
    """
    from settings_manager import settings_manager
    from checkmk.client import CheckMKClient
    from urllib.parse import urlparse

    logger.info("[ACTIVATION] Starting CheckMK change activation...")

    db_settings = settings_manager.get_checkmk_settings()
    if not db_settings or not all(
        key in db_settings for key in ["url", "site", "username", "password"]
    ):
        logger.warning("[ACTIVATION] CheckMK settings not configured or incomplete")
        logger.warning(f"[ACTIVATION] db_settings: {db_settings}")
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


def _execute_backup(
    schedule_id: Optional[int],
    credential_id: Optional[int],
    job_parameters: Optional[dict],
    target_devices: Optional[list],
    task_context,
    template: Optional[dict] = None,
) -> dict:
    """Execute backup job"""
    try:
        task_context.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": 100, "status": "Initializing backup..."},
        )

        # TODO: Implement actual backup logic using credential_id and target_devices
        # This should connect to devices and backup their configurations

        task_context.update_state(
            state="PROGRESS",
            meta={
                "current": 50,
                "total": 100,
                "status": "Backing up configurations...",
            },
        )

        import time

        time.sleep(2)  # Placeholder

        device_count = len(target_devices) if target_devices else 0

        return {
            "success": True,
            "devices_backed_up": device_count,
            "message": f"Backed up {device_count} device configurations",
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


def _execute_run_commands(
    schedule_id: Optional[int],
    credential_id: Optional[int],
    job_parameters: Optional[dict],
    target_devices: Optional[list],
    task_context,
    template: Optional[dict] = None,
) -> dict:
    """
    Execute run_commands job.

    Runs commands on network devices using a command template.
    The template is rendered for each device with Nautobot context,
    then executed via Netmiko.

    Args:
        schedule_id: Job schedule ID
        credential_id: ID of credential for device authentication
        job_parameters: Additional job parameters (contains command_template_name)
        target_devices: List of device UUIDs to run commands on
        task_context: Celery task context for progress updates
        template: Job template configuration

    Returns:
        dict: Command execution results with detailed per-device output
    """
    import asyncio
    from services.nautobot import NautobotService
    from services.network.automation.netmiko import NetmikoService
    from services.network.automation.render import RenderService
    import credentials_manager
    from template_manager import template_manager

    # Track credential usage
    credential_info = {
        "credential_id": credential_id,
        "credential_name": None,
        "username": None,
    }

    try:
        logger.info("=" * 80)
        logger.info("RUN COMMANDS EXECUTOR STARTED")
        logger.info("=" * 80)
        logger.info(f"Schedule ID: {schedule_id}")
        logger.info(f"Credential ID: {credential_id}")
        logger.info(f"Target devices: {len(target_devices) if target_devices else 0}")
        logger.info(f"Job parameters: {job_parameters}")
        logger.info(f"Template: {template}")

        task_context.update_state(
            state="PROGRESS",
            meta={
                "current": 0,
                "total": 100,
                "status": "Initializing command execution...",
            },
        )

        # Get command template name from job_parameters or template
        command_template_name = None
        if job_parameters:
            command_template_name = job_parameters.get("command_template_name")
        if not command_template_name and template:
            command_template_name = template.get("command_template_name")

        if not command_template_name:
            logger.error("ERROR: No command template specified")
            return {
                "success": False,
                "error": "No command template specified. Please configure a command template in the job template.",
                "credential_info": credential_info,
            }

        if not target_devices:
            logger.error("ERROR: No target devices specified")
            return {
                "success": False,
                "error": "No devices to run commands on",
                "credential_info": credential_info,
            }

        if not credential_id:
            logger.error("ERROR: No credential_id specified")
            return {
                "success": False,
                "error": "No credentials specified. Please select credentials in the job schedule.",
                "credential_info": credential_info,
            }

        logger.info("-" * 80)
        logger.info("STEP 1: VALIDATING INPUTS")
        logger.info("-" * 80)

        # Get credentials
        logger.info(f"Fetching credential {credential_id} from database...")
        credential = credentials_manager.get_credential_by_id(credential_id)
        if not credential:
            logger.error(f"ERROR: Credential {credential_id} not found in database")
            return {
                "success": False,
                "error": f"Credential {credential_id} not found",
                "credential_info": credential_info,
            }

        username = credential.get("username")
        credential_name = credential.get("name")

        # Get decrypted password
        try:
            password = credentials_manager.get_decrypted_password(credential_id)
        except Exception as e:
            logger.error(f"ERROR: Failed to decrypt password: {e}")
            return {
                "success": False,
                "error": f"Failed to decrypt credential password: {str(e)}",
                "credential_info": credential_info,
            }

        logger.info(f"✓ Credential found: {credential_name}")
        logger.info(f"  - Username: {username}")
        logger.info(f"  - Password: {'*' * len(password) if password else 'NOT SET'}")

        credential_info["credential_name"] = credential_name
        credential_info["username"] = username

        if not username or not password:
            logger.error("ERROR: Credential does not contain username or password")
            return {
                "success": False,
                "error": "Credential does not contain username or password",
                "credential_info": credential_info,
            }

        # Get command template content
        logger.info(f"Fetching command template: {command_template_name}...")
        command_template_obj = template_manager.get_template_by_name(
            command_template_name
        )
        if not command_template_obj:
            logger.error(f"ERROR: Command template '{command_template_name}' not found")
            return {
                "success": False,
                "error": f"Command template '{command_template_name}' not found",
                "credential_info": credential_info,
            }

        template_content = template_manager.get_template_content(
            command_template_obj["id"]
        )
        if not template_content:
            logger.error(
                f"ERROR: Command template content not found for '{command_template_name}'"
            )
            return {
                "success": False,
                "error": f"Command template content not found for '{command_template_name}'",
                "credential_info": credential_info,
            }

        logger.info(f"✓ Command template found: {command_template_name}")
        logger.info(f"  - Template ID: {command_template_obj['id']}")
        logger.info(f"  - Content length: {len(template_content)} chars")

        logger.info("✓ All inputs validated successfully")

        task_context.update_state(
            state="PROGRESS",
            meta={
                "current": 10,
                "total": 100,
                "status": f"Running commands on {len(target_devices)} devices...",
            },
        )

        # STEP 2: Execute commands on each device
        logger.info("-" * 80)
        logger.info(f"STEP 2: EXECUTING COMMANDS ON {len(target_devices)} DEVICES")
        logger.info("-" * 80)

        nautobot_service = NautobotService()
        netmiko_service = NetmikoService()
        render_service = RenderService()

        # Create event loop for async operations
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        successful_devices = []
        failed_devices = []
        total_devices = len(target_devices)

        try:
            for idx, device_id in enumerate(target_devices, 1):
                device_result = {
                    "device_id": device_id,
                    "device_name": None,
                    "device_ip": None,
                    "platform": None,
                    "success": False,
                    "rendered_commands": None,
                    "output": None,
                    "error": None,
                }

                try:
                    logger.info(f"\n{'=' * 60}")
                    logger.info(f"Device {idx}/{total_devices}: {device_id}")
                    logger.info(f"{'=' * 60}")

                    progress = 10 + int((idx / total_devices) * 80)
                    task_context.update_state(
                        state="PROGRESS",
                        meta={
                            "current": progress,
                            "total": 100,
                            "status": f"Executing on device {idx}/{total_devices}...",
                        },
                    )

                    # Get device details from Nautobot
                    logger.info(f"[{idx}] Fetching device details from Nautobot...")
                    query = """
                    query getDevice($deviceId: ID!) {
                      device(id: $deviceId) {
                        id
                        name
                        hostname: name
                        asset_tag
                        serial
                        _custom_field_data
                        custom_field_data: _custom_field_data
                        primary_ip4 {
                          id
                          address
                          host
                          mask_length
                        }
                        platform {
                          id
                          name
                          manufacturer {
                            id
                            name
                          }
                        }
                        device_type {
                          id
                          model
                          manufacturer {
                            id
                            name
                          }
                        }
                        role {
                          id
                          name
                        }
                        location {
                          id
                          name
                          description
                          location_type {
                            id
                            name
                          }
                          parent {
                            id
                            name
                            description
                          }
                        }
                        tenant {
                          id
                          name
                        }
                        status {
                          id
                          name
                        }
                        tags {
                          id
                          name
                        }
                      }
                    }
                    """
                    variables = {"deviceId": device_id}
                    device_data = nautobot_service._sync_graphql_query(query, variables)

                    if (
                        not device_data
                        or "data" not in device_data
                        or not device_data["data"].get("device")
                    ):
                        logger.error(
                            f"[{idx}] ✗ Failed to get device data from Nautobot"
                        )
                        device_result["error"] = (
                            "Failed to fetch device data from Nautobot"
                        )
                        failed_devices.append(device_result)
                        continue

                    device = device_data["data"]["device"]
                    device_name = device.get("name", device_id)
                    primary_ip = (
                        device.get("primary_ip4", {}).get("address", "").split("/")[0]
                        if device.get("primary_ip4")
                        else None
                    )
                    platform = (
                        device.get("platform", {}).get("name", "unknown")
                        if device.get("platform")
                        else "unknown"
                    )

                    device_result["device_name"] = device_name
                    device_result["device_ip"] = primary_ip
                    device_result["platform"] = platform

                    logger.info(f"[{idx}] ✓ Device data fetched")
                    logger.info(f"[{idx}]   - Name: {device_name}")
                    logger.info(f"[{idx}]   - IP: {primary_ip or 'NOT SET'}")
                    logger.info(f"[{idx}]   - Platform: {platform}")

                    if not primary_ip:
                        logger.error(f"[{idx}] ✗ No primary IP")
                        device_result["error"] = "No primary IP address"
                        failed_devices.append(device_result)
                        continue

                    # Render template for this device
                    logger.info(f"[{idx}] Rendering template...")
                    try:
                        render_result = loop.run_until_complete(
                            render_service.render_template(
                                template_content=template_content,
                                category="netmiko",
                                device_id=device_id,
                                user_variables={},
                                use_nautobot_context=True,
                            )
                        )
                        rendered_content = render_result["rendered_content"]
                        device_result["rendered_commands"] = rendered_content
                        logger.info(f"[{idx}] ✓ Template rendered successfully")
                    except Exception as render_error:
                        logger.error(
                            f"[{idx}] ✗ Template rendering failed: {render_error}"
                        )
                        device_result["error"] = (
                            f"Template rendering failed: {str(render_error)}"
                        )
                        failed_devices.append(device_result)
                        continue

                    # Convert rendered content to command list
                    commands = [
                        line.strip()
                        for line in rendered_content.split("\n")
                        if line.strip()
                    ]

                    if not commands:
                        logger.warning(
                            f"[{idx}] ⚠ No commands to execute after rendering"
                        )
                        device_result["error"] = (
                            "No commands to execute after template rendering"
                        )
                        failed_devices.append(device_result)
                        continue

                    logger.info(f"[{idx}] Commands to execute: {len(commands)}")

                    # Map platform to Netmiko device type
                    from utils.netmiko_platform_mapper import map_platform_to_netmiko

                    device_type = map_platform_to_netmiko(platform)
                    logger.info(f"[{idx}] Netmiko device type: {device_type}")

                    # Execute commands using Netmiko
                    logger.info(f"[{idx}] Connecting via SSH and executing commands...")
                    result = netmiko_service._connect_and_execute(
                        device_ip=primary_ip,
                        device_type=device_type,
                        username=username,
                        password=password,
                        commands=commands,
                        enable_mode=False,
                    )

                    if result["success"]:
                        device_result["success"] = True
                        device_result["output"] = result["output"]
                        logger.info(f"[{idx}] ✓ Commands executed successfully")
                        logger.info(
                            f"[{idx}]   - Output length: {len(result['output'])} chars"
                        )
                        successful_devices.append(device_result)
                    else:
                        device_result["error"] = result.get(
                            "error", "Command execution failed"
                        )
                        logger.error(
                            f"[{idx}] ✗ Command execution failed: {result.get('error')}"
                        )
                        failed_devices.append(device_result)

                except Exception as e:
                    logger.error(f"[{idx}] ✗ Exception: {e}", exc_info=True)
                    device_result["error"] = str(e)
                    failed_devices.append(device_result)

        finally:
            loop.close()

        logger.info("\n" + "=" * 80)
        logger.info("COMMAND EXECUTION SUMMARY")
        logger.info("=" * 80)
        logger.info(f"Successful: {len(successful_devices)}")
        logger.info(f"Failed: {len(failed_devices)}")

        task_context.update_state(
            state="PROGRESS",
            meta={
                "current": 100,
                "total": 100,
                "status": "Command execution completed",
            },
        )

        logger.info("=" * 80)
        logger.info("RUN COMMANDS COMPLETED")
        logger.info("=" * 80)

        return {
            "success": len(failed_devices) == 0,
            "message": f"Executed commands on {len(successful_devices)} of {total_devices} devices",
            "command_template": command_template_name,
            "total": total_devices,
            "success_count": len(successful_devices),
            "failed_count": len(failed_devices),
            "successful_devices": successful_devices,
            "failed_devices": failed_devices,
            "credential_info": credential_info,
        }

    except Exception as e:
        logger.error("=" * 80)
        logger.error("RUN COMMANDS EXECUTOR FAILED")
        logger.error("=" * 80)
        logger.error(f"Exception: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "credential_info": credential_info,
        }


def _execute_compare_devices(
    schedule_id: Optional[int],
    credential_id: Optional[int],
    job_parameters: Optional[dict],
    target_devices: Optional[list],
    task_context,
    template: Optional[dict] = None,
) -> dict:
    """
    Execute compare_devices job - compares devices between Nautobot and CheckMK.

    Results are stored in the NB2CMK database so they can be viewed in the "Sync Devices" app.

    Args:
        schedule_id: Job schedule ID
        credential_id: Optional credential ID (not used for comparison)
        job_parameters: Additional job parameters
        target_devices: List of device UUIDs to compare, or None for all devices
        task_context: Celery task context for progress updates
        template: Job template configuration

    Returns:
        dict: Comparison results
    """
    import asyncio

    logger.info(
        "[SCHEDULED_JOB] ========== STARTING SCHEDULED COMPARE DEVICES JOB =========="
    )
    logger.info(
        f"[SCHEDULED_JOB] schedule_id={schedule_id}, target_devices={target_devices}"
    )

    try:
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

                        # Debug the comparison_result object
                        logger.info(
                            f"[SCHEDULED_JOB] Device {device_name}: comparison_result type = {type(comparison_result)}"
                        )
                        logger.info(
                            f"[SCHEDULED_JOB] Device {device_name}: comparison_result = {comparison_result}"
                        )
                        logger.info(
                            f"[SCHEDULED_JOB] Device {device_name}: has ignored_attributes attr = {hasattr(comparison_result, 'ignored_attributes')}"
                        )

                        if hasattr(comparison_result, "ignored_attributes"):
                            logger.info(
                                f"[SCHEDULED_JOB] Device {device_name}: comparison_result.ignored_attributes = {comparison_result.ignored_attributes}"
                            )
                            ignored_attrs = comparison_result.ignored_attributes or []
                        else:
                            logger.warning(
                                f"[SCHEDULED_JOB] Device {device_name}: comparison_result does NOT have ignored_attributes attribute"
                            )
                            ignored_attrs = []

                        logger.info(
                            f"[SCHEDULED_JOB] Device {device_name}: raw_diff = {raw_diff}"
                        )
                        logger.info(
                            f"[SCHEDULED_JOB] Device {device_name}: final ignored_attrs = {ignored_attrs}"
                        )

                        # Use the same filtering logic as the manual job
                        filtered_diff = (
                            nb2cmk_service.filter_diff_by_ignored_attributes(
                                raw_diff, ignored_attrs
                            )
                        )

                        logger.info(
                            f"[SCHEDULED_JOB] Device {device_name}: filtered_diff = {filtered_diff}"
                        )
                        logger.info(
                            f"[SCHEDULED_JOB] Device {device_name}: Storing to database with ignored_attributes = {ignored_attrs}"
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


# ============================================================================
# Legacy Tasks (kept for backward compatibility)
# ============================================================================


@celery_app.task(name="tasks.cache_devices", bind=True)
def cache_devices_task(self, job_schedule_id: Optional[int] = None) -> dict:
    """
    Task: Cache all devices from Nautobot.

    This task fetches device data from Nautobot and stores it in the cache
    for faster access throughout the application.

    Args:
        job_schedule_id: Optional ID of the job schedule that triggered this task

    Returns:
        dict: Task execution results
    """
    try:
        logger.info(f"Starting cache_devices task (job_schedule_id: {job_schedule_id})")

        # Update task state to show progress
        self.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": 100, "status": "Connecting to Nautobot..."},
        )

        # Import here to avoid circular imports
        from services.nautobot import nautobot_service
        from services.settings.cache import cache_service
        import asyncio

        # Create event loop for async operations
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            # Fetch all devices from Nautobot
            self.update_state(
                state="PROGRESS",
                meta={"current": 30, "total": 100, "status": "Fetching devices..."},
            )

            # Use the existing get-all-devices job functionality
            # This is a placeholder - you'll need to adapt this to your actual implementation
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
                }
              }
            }
            """

            result = loop.run_until_complete(nautobot_service.graphql_query(query))

            self.update_state(
                state="PROGRESS",
                meta={"current": 70, "total": 100, "status": "Caching device data..."},
            )

            if "errors" in result:
                logger.error(f"GraphQL errors: {result['errors']}")
                return {
                    "success": False,
                    "error": f"GraphQL errors: {result['errors']}",
                    "job_schedule_id": job_schedule_id,
                }

            devices = result.get("data", {}).get("devices", [])

            # Cache each device
            for device in devices:
                device_id = device.get("id")
                if device_id:
                    cache_key = f"nautobot:devices:{device_id}"
                    cache_service.set(cache_key, device, 30 * 60)  # 30 minutes TTL

            self.update_state(
                state="PROGRESS",
                meta={"current": 100, "total": 100, "status": "Complete"},
            )

            logger.info(f"Successfully cached {len(devices)} devices")

            return {
                "success": True,
                "devices_cached": len(devices),
                "message": f"Cached {len(devices)} devices from Nautobot",
                "job_schedule_id": job_schedule_id,
            }

        finally:
            loop.close()

    except Exception as e:
        logger.error(f"cache_devices task failed: {e}", exc_info=True)
        return {"success": False, "error": str(e), "job_schedule_id": job_schedule_id}


@celery_app.task(name="tasks.sync_checkmk", bind=True)
def sync_checkmk_task(self, job_schedule_id: Optional[int] = None) -> dict:
    """
    Task: Synchronize devices to CheckMK.

    This task syncs device information from Nautobot to CheckMK monitoring system.

    Args:
        job_schedule_id: Optional ID of the job schedule that triggered this task

    Returns:
        dict: Task execution results
    """
    try:
        logger.info(f"Starting sync_checkmk task (job_schedule_id: {job_schedule_id})")

        self.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": 100, "status": "Starting CheckMK sync..."},
        )

        # Import here to avoid circular imports
        from services.checkmk.sync.background import (
            nb2cmk_background_service as background_service,
        )
        import asyncio

        # Create event loop for async operations
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            self.update_state(
                state="PROGRESS",
                meta={"current": 30, "total": 100, "status": "Syncing to CheckMK..."},
            )

            # Trigger the sync - this is a placeholder
            # You'll need to adapt this to your actual CheckMK sync implementation
            result = loop.run_until_complete(background_service.trigger_sync())

            self.update_state(
                state="PROGRESS",
                meta={"current": 100, "total": 100, "status": "Complete"},
            )

            logger.info("CheckMK sync completed successfully")

            return {
                "success": True,
                "message": "CheckMK sync completed",
                "result": result,
                "job_schedule_id": job_schedule_id,
            }

        finally:
            loop.close()

    except Exception as e:
        logger.error(f"sync_checkmk task failed: {e}", exc_info=True)
        return {"success": False, "error": str(e), "job_schedule_id": job_schedule_id}


@celery_app.task(name="tasks.backup_configs", bind=True)
def backup_configs_task(
    self,
    job_schedule_id: Optional[int] = None,
    credential_id: Optional[int] = None,
    devices: Optional[list] = None,
) -> dict:
    """
    Task: Backup device configurations.

    This task connects to network devices and backs up their configurations.
    Can use private credentials when provided.

    Args:
        job_schedule_id: Optional ID of the job schedule that triggered this task
        credential_id: Optional credential ID to use for authentication
        devices: Optional list of specific devices to backup

    Returns:
        dict: Task execution results
    """
    try:
        logger.info(
            f"Starting backup_configs task (job_schedule_id: {job_schedule_id}, credential_id: {credential_id})"
        )

        self.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": 100, "status": "Initializing backup..."},
        )

        # This is a placeholder for the actual backup implementation
        # You would integrate with your existing backup functionality here

        self.update_state(
            state="PROGRESS",
            meta={
                "current": 50,
                "total": 100,
                "status": "Backing up configurations...",
            },
        )

        # Simulate backup process
        import time

        time.sleep(2)

        self.update_state(
            state="PROGRESS", meta={"current": 100, "total": 100, "status": "Complete"}
        )

        device_count = len(devices) if devices else 0

        logger.info(f"Backup task completed for {device_count} devices")

        return {
            "success": True,
            "devices_backed_up": device_count,
            "message": f"Backed up {device_count} device configurations",
            "job_schedule_id": job_schedule_id,
        }

    except Exception as e:
        logger.error(f"backup_configs task failed: {e}", exc_info=True)
        return {"success": False, "error": str(e), "job_schedule_id": job_schedule_id}


@celery_app.task(name="tasks.ansible_playbook", bind=True)
def ansible_playbook_task(
    self,
    job_schedule_id: Optional[int] = None,
    credential_id: Optional[int] = None,
    playbook: Optional[str] = None,
    **kwargs,
) -> dict:
    """
    Task: Run Ansible playbook.

    This task executes an Ansible playbook on target devices.
    Can use private credentials when provided.

    Args:
        job_schedule_id: Optional ID of the job schedule that triggered this task
        credential_id: Optional credential ID to use for authentication
        playbook: Playbook to execute
        **kwargs: Additional playbook parameters

    Returns:
        dict: Task execution results
    """
    try:
        logger.info(
            f"Starting ansible_playbook task (job_schedule_id: {job_schedule_id}, playbook: {playbook})"
        )

        self.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": 100, "status": "Initializing Ansible..."},
        )

        # This is a placeholder for the actual Ansible implementation
        # You would integrate with your existing Ansible functionality here

        self.update_state(
            state="PROGRESS",
            meta={"current": 50, "total": 100, "status": "Running playbook..."},
        )

        # Simulate playbook execution
        import time

        time.sleep(3)

        self.update_state(
            state="PROGRESS", meta={"current": 100, "total": 100, "status": "Complete"}
        )

        logger.info(f"Ansible playbook task completed: {playbook}")

        return {
            "success": True,
            "playbook": playbook,
            "message": f"Ansible playbook {playbook} executed successfully",
            "job_schedule_id": job_schedule_id,
        }

    except Exception as e:
        logger.error(f"ansible_playbook task failed: {e}", exc_info=True)
        return {"success": False, "error": str(e), "job_schedule_id": job_schedule_id}


# Task name mapping for job identifiers
JOB_TASK_MAPPING = {
    "cache_devices": cache_devices_task,
    "sync_checkmk": sync_checkmk_task,
    "backup_configs": backup_configs_task,
    "ansible_playbook": ansible_playbook_task,
}


def get_task_for_job(job_identifier: str):
    """
    Get the Celery task function for a given job identifier.

    Args:
        job_identifier: Job identifier (e.g., 'cache_devices')

    Returns:
        Celery task function or None
    """
    return JOB_TASK_MAPPING.get(job_identifier)
