"""
Celery task for updating Nautobot devices from JSON list.

This task accepts a list of rich JSON objects instead of CSV format.

This task is a thin wrapper that:
1. Receives list of device update objects
2. Tracks Celery progress
3. Calls DeviceUpdateService for each device
4. Aggregates results
"""

from celery_app import celery_app
import logging
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime

from services.nautobot import NautobotService
from services.nautobot.devices.update import DeviceUpdateService

logger = logging.getLogger(__name__)


@celery_app.task(name="tasks.update_devices", bind=True)
def update_devices_task(
    self,
    devices: List[Dict[str, Any]],
    dry_run: bool = False,
) -> dict:
    """
    Task: Update Nautobot devices from list of JSON objects.

    This task:
    1. Receives a list of device update objects
    2. For each device, calls DeviceUpdateService
    3. Tracks successes and failures
    4. Returns summary of operations

    Args:
        devices: List of device update objects. Each object should contain:
            - Device identifier (one or more of):
                - id: Device UUID
                - name: Device name
                - ip_address: Device IP address
            - Update data (any device fields to update):
                - role: Role UUID
                - status: Status UUID
                - location: Location UUID
                - device_type: Device type UUID
                - platform: Platform UUID
                - serial: Serial number
                - asset_tag: Asset tag
                - primary_ip4: Primary IPv4 address (creates interface if needed)
                - tags: List of tag UUIDs
                - custom_fields: Dict of custom field values
                - ... (any other device fields)
            - Optional interface configuration (for primary_ip4):
                - mgmt_interface_name: Interface name
                - mgmt_interface_type: Interface type ID
                - mgmt_interface_status: Interface status ID
                - namespace: Namespace UUID

            Example:
            {
                "id": "device-uuid",
                "name": "switch-01",
                "primary_ip4": "10.0.0.1/24",
                "mgmt_interface_name": "eth0",
                "mgmt_interface_type": "1000base-t",
                "mgmt_interface_status": "active",
                "namespace": "namespace-uuid",
                "role": "role-uuid",
                "status": "status-uuid"
            }

        dry_run: If True, validate without making changes (default: False)

    Returns:
        dict: Update results including success/failure counts and details
    """
    try:
        logger.info("=" * 80)
        logger.info("UPDATE DEVICES TASK STARTED (JSON MODE)")
        logger.info("=" * 80)
        logger.info(f"Dry run: {dry_run}")
        logger.info(f"Number of devices: {len(devices)}")

        self.update_state(
            state="PROGRESS",
            meta={
                "current": 0,
                "total": 100,
                "status": "Initializing...",
            },
        )

        # STEP 1: Validate input
        logger.info("-" * 80)
        logger.info("STEP 1: VALIDATING INPUT")
        logger.info("-" * 80)

        if not devices:
            return {
                "success": False,
                "error": "No devices provided",
            }

        if not isinstance(devices, list):
            return {
                "success": False,
                "error": "Devices must be a list",
            }

        total_devices = len(devices)
        logger.info(f"Total devices to process: {total_devices}")

        # STEP 2: Initialize service
        logger.info("-" * 80)
        logger.info("STEP 2: INITIALIZING UPDATE SERVICE")
        logger.info("-" * 80)

        nautobot_service = NautobotService()
        update_service = DeviceUpdateService(nautobot_service)

        # STEP 3: Update devices
        logger.info("-" * 80)
        logger.info(f"STEP 3: UPDATING {total_devices} DEVICES")
        logger.info(f"Dry run mode: {dry_run}")
        logger.info(f"First device data received: {devices[0] if devices else 'NONE'}")
        logger.info("-" * 80)

        successes = []
        failures = []
        skipped = []

        for idx, device_data in enumerate(devices, 1):
            if not isinstance(device_data, dict):
                logger.warning(f"Device {idx} is not a dict, skipping")
                skipped.append(
                    {
                        "device_index": idx,
                        "reason": "Invalid data type (expected dict)",
                    }
                )
                continue

            # Extract identifier
            device_id = device_data.get("id")
            device_name = device_data.get("name")
            ip_address = device_data.get("ip_address")

            # Determine identifier for logging
            identifier = device_id or device_name or ip_address or f"device-{idx}"

            try:
                logger.info(f"Processing device {idx}/{total_devices}: {identifier}")

                # Update progress
                progress = 10 + int((idx / total_devices) * 80)
                self.update_state(
                    state="PROGRESS",
                    meta={
                        "current": progress,
                        "total": 100,
                        "status": f"Updating device {idx}/{total_devices}: {identifier}",
                        "successes": len(successes),
                        "failures": len(failures),
                        "skipped": len(skipped),
                    },
                )

                # Prepare data for service
                logger.info(f"Raw device_data before prepare: {device_data}")
                device_identifier, update_data, interface_config, interfaces = _prepare_device_data(
                    device_data
                )
                logger.info(f"After prepare - interfaces ({len(interfaces) if interfaces else 0} total):")
                if interfaces:
                    for idx, iface in enumerate(interfaces):
                        logger.info(f"  Interface {idx+1}: name={iface.get('name')}, ip={iface.get('ip_address')}, role={iface.get('ip_role', 'NOT SET')}")

                if not update_data and not interfaces:
                    logger.info(f"No update data or interfaces for device {identifier}, skipping")
                    skipped.append(
                        {
                            "device_identifier": device_identifier,
                            "reason": "No fields to update",
                        }
                    )
                    continue

                # Dry run - just validate without updating
                if dry_run:
                    logger.info(
                        f"[DRY RUN] Would update device {identifier} with: {update_data}"
                    )
                    if interface_config:
                        logger.info(f"[DRY RUN] Interface config: {interface_config}")
                    if interfaces:
                        logger.info(f"[DRY RUN] Interfaces: {len(interfaces)} interface(s)")

                    successes.append(
                        {
                            "device_identifier": device_identifier,
                            "updates": update_data,
                            "interfaces": len(interfaces) if interfaces else 0,
                            "dry_run": True,
                        }
                    )
                else:
                    # Actually update the device using service
                    logger.info(f"Updating device {identifier}")
                    logger.debug(f"Update data: {update_data}")
                    if interface_config:
                        logger.debug(f"Interface config: {interface_config}")
                    if interfaces:
                        logger.debug(f"Interfaces: {len(interfaces)} interface(s)")

                    result = asyncio.run(
                        update_service.update_device(
                            device_identifier=device_identifier,
                            update_data=update_data,
                            interface_config=interface_config,
                            interfaces=interfaces,
                        )
                    )

                    if result["success"]:
                        successes.append(
                            {
                                "device_id": result["device_id"],
                                "device_name": result["device_name"],
                                "updated_fields": result["updated_fields"],
                                "warnings": result["warnings"],
                            }
                        )
                        logger.info(
                            f"Successfully updated device {result['device_name']}: "
                            f"{len(result['updated_fields'])} fields"
                        )
                    else:
                        # Service returned failure
                        failures.append(
                            {
                                "device_identifier": device_identifier,
                                "error": result["message"],
                            }
                        )
                        logger.error(
                            f"Service failed to update device: {result['message']}"
                        )

            except Exception as e:
                error_msg = str(e)
                logger.error(
                    f"Failed to update device {identifier}: {error_msg}", exc_info=True
                )
                failures.append(
                    {
                        "device_identifier": {"name": identifier},
                        "error": error_msg,
                    }
                )

        # STEP 4: Prepare results
        logger.info("-" * 80)
        logger.info("STEP 4: PREPARING RESULTS")
        logger.info("-" * 80)

        result_summary = {
            "success": True,
            "devices_processed": total_devices,
            "successful_updates": len(successes),
            "failed_updates": len(failures),
            "skipped_updates": len(skipped),
            "dry_run": dry_run,
            "timestamp": datetime.utcnow().isoformat(),
            "results": {
                "successes": successes,
                "failures": failures,
                "skipped": skipped,
            },
        }

        logger.info("Update complete:")
        logger.info(f"  - Total: {total_devices}")
        logger.info(f"  - Success: {len(successes)}")
        logger.info(f"  - Failed: {len(failures)}")
        logger.info(f"  - Skipped: {len(skipped)}")

        # Update final state
        self.update_state(
            state="SUCCESS",
            meta={
                "current": 100,
                "total": 100,
                "status": "Complete",
                "successes": len(successes),
                "failures": len(failures),
                "skipped": len(skipped),
            },
        )

        logger.info("=" * 80)
        logger.info("UPDATE DEVICES TASK COMPLETED")
        logger.info("=" * 80)

        # Update job run status to completed
        try:
            import job_run_manager

            job_run = job_run_manager.get_job_run_by_celery_id(self.request.id)
            if job_run:
                job_run_manager.mark_completed(job_run["id"], result=result_summary)
                logger.info(f"✓ Updated job run {job_run['id']} status to completed")
        except Exception as job_error:
            logger.warning(f"Failed to update job run status: {job_error}")

        return result_summary

    except Exception as e:
        logger.error(f"Task failed with error: {e}", exc_info=True)

        # Update job run status to failed
        try:
            import job_run_manager

            job_run = job_run_manager.get_job_run_by_celery_id(self.request.id)
            if job_run:
                job_run_manager.mark_failed(job_run["id"], str(e))
                logger.info(f"✓ Updated job run {job_run['id']} status to failed")
        except Exception as job_error:
            logger.warning(f"Failed to update job run status: {job_error}")

        self.update_state(
            state="FAILURE",
            meta={
                "error": str(e),
            },
        )
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat(),
        }


def _prepare_device_data(
    device_data: Dict[str, Any],
) -> tuple[Dict[str, Any], Dict[str, Any], Optional[Dict[str, str]], Optional[List[Dict[str, Any]]]]:
    """
    Prepare device data for DeviceUpdateService.

    Args:
        device_data: Raw device data object

    Returns:
        Tuple of (device_identifier, update_data, interface_config, interfaces)
    """
    # Fields used for device identification
    identifier_fields = ["id", "name", "ip_address"]

    # Fields used for interface configuration (when updating primary_ip4)
    interface_fields = [
        "mgmt_interface_name",
        "mgmt_interface_type",
        "mgmt_interface_status",
        "mgmt_interface_create_on_ip_change",
        "namespace",
        "add_prefixes_automatically",
        "use_assigned_ip_if_exists",
    ]

    # Build device identifier
    device_identifier = {}
    for field in identifier_fields:
        value = device_data.get(field)
        if value:
            device_identifier[field] = value

    # Extract interfaces array if present
    interfaces = device_data.get("interfaces")
    if interfaces and not isinstance(interfaces, list):
        logger.warning(f"interfaces field is not a list, ignoring: {type(interfaces)}")
        interfaces = None

    # Build update data (exclude identifier, interface fields, and interfaces array)
    excluded_fields = set(identifier_fields + interface_fields + ["interfaces"])
    update_data = {
        k: v
        for k, v in device_data.items()
        if k not in excluded_fields and v is not None
    }

    # Build interface config if present (for legacy primary_ip4 updates)
    interface_config = None
    if device_data.get("primary_ip4"):
        # Only include interface config if we're updating primary IP
        interface_config = {}
        for field in interface_fields:
            value = device_data.get(field)
            if value:
                interface_config[field] = value

    return device_identifier, update_data, interface_config, interfaces
