"""
Celery task for updating Nautobot devices from CSV data.

REFACTORED VERSION - Uses DeviceUpdateService for all business logic.

This task is a thin wrapper that:
1. Parses CSV content
2. Tracks Celery progress
3. Calls DeviceUpdateService for each device
4. Aggregates results
"""

from celery_app import celery_app
import logging
import csv
import io
import asyncio
from typing import Optional, Dict, Any
from datetime import datetime

from services.nautobot import NautobotService
from services.device_update_service import DeviceUpdateService

logger = logging.getLogger(__name__)


@celery_app.task(name="tasks.update_devices_from_csv", bind=True)
def update_devices_from_csv_task(
    self,
    csv_content: str,
    csv_options: Optional[Dict[str, Any]] = None,
    dry_run: bool = False,
) -> dict:
    """
    Task: Update Nautobot devices from CSV data.

    This task:
    1. Parses the CSV content
    2. For each device row, calls DeviceUpdateService
    3. Tracks successes and failures
    4. Returns summary of operations

    Args:
        csv_content: CSV file content as string
        csv_options: Optional CSV parsing options:
            - delimiter: Field delimiter (default: ",")
            - quoteChar: Quote character (default: '"')
        dry_run: If True, validate without making changes (default: False)

    Returns:
        dict: Update results including success/failure counts and details
    """
    try:
        logger.info("=" * 80)
        logger.info("UPDATE DEVICES FROM CSV TASK STARTED")
        logger.info("=" * 80)
        logger.info(f"Dry run: {dry_run}")
        logger.info(f"CSV Options: {csv_options}")

        self.update_state(
            state="PROGRESS",
            meta={
                "current": 0,
                "total": 100,
                "status": "Parsing CSV...",
            },
        )

        # Parse CSV options
        csv_opts = csv_options or {}
        delimiter = csv_opts.get("delimiter", ",")
        quotechar = csv_opts.get("quoteChar", '"')

        # STEP 1: Parse CSV
        logger.info("-" * 80)
        logger.info("STEP 1: PARSING CSV")
        logger.info("-" * 80)

        try:
            csv_reader = csv.DictReader(
                io.StringIO(csv_content),
                delimiter=delimiter,
                quotechar=quotechar,
            )
            rows = list(csv_reader)
            logger.info(f"Parsed {len(rows)} rows from CSV")
        except Exception as e:
            logger.error(f"CSV parsing failed: {e}")
            return {
                "success": False,
                "error": f"Failed to parse CSV: {str(e)}",
            }

        if not rows:
            return {
                "success": False,
                "error": "CSV file is empty or invalid",
            }

        total_devices = len(rows)
        logger.info(f"Total devices to process: {total_devices}")

        # Get CSV headers
        headers = list(rows[0].keys()) if rows else []
        logger.info(f"CSV columns: {headers}")

        # STEP 2: Validate CSV structure
        logger.info("-" * 80)
        logger.info("STEP 2: VALIDATING CSV STRUCTURE")
        logger.info("-" * 80)

        # Check for at least one identifier field
        identifier_fields = ["id", "name", "ip_address"]
        has_identifier = any(f in headers for f in identifier_fields)

        if not has_identifier:
            return {
                "success": False,
                "error": f"CSV is missing identifier columns. At least one of {identifier_fields} is required.",
            }

        logger.info(
            f"Identifier fields found: {[f for f in identifier_fields if f in headers]}"
        )

        # STEP 3: Initialize service
        logger.info("-" * 80)
        logger.info("STEP 3: INITIALIZING UPDATE SERVICE")
        logger.info("-" * 80)

        nautobot_service = NautobotService()
        update_service = DeviceUpdateService(nautobot_service)

        # STEP 4: Update devices
        logger.info("-" * 80)
        logger.info(f"STEP 4: UPDATING {total_devices} DEVICES")
        logger.info(f"Dry run mode: {dry_run}")
        logger.info("-" * 80)

        successes = []
        failures = []
        skipped = []

        for idx, row in enumerate(rows, 1):
            device_id = row.get("id")
            device_name = row.get("name")
            ip_address = row.get("ip_address")

            # Determine identifier for logging
            identifier = device_id or device_name or ip_address or f"row-{idx}"

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
                device_identifier, update_data, interface_config = _prepare_row_data(
                    row, headers
                )

                if not update_data:
                    logger.info(f"No update data for device {identifier}, skipping")
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

                    successes.append(
                        {
                            "device_identifier": device_identifier,
                            "updates": update_data,
                            "dry_run": True,
                        }
                    )
                else:
                    # Actually update the device using service
                    logger.info(f"Updating device {identifier}")
                    logger.debug(f"Update data: {update_data}")
                    if interface_config:
                        logger.debug(f"Interface config: {interface_config}")

                    result = asyncio.run(
                        update_service.update_device(
                            device_identifier=device_identifier,
                            update_data=update_data,
                            interface_config=interface_config,
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

        # STEP 5: Prepare results
        logger.info("-" * 80)
        logger.info("STEP 5: PREPARING RESULTS")
        logger.info("-" * 80)

        self.update_state(
            state="PROGRESS",
            meta={
                "current": 95,
                "total": 100,
                "status": "Finalizing results...",
            },
        )

        success_count = len(successes)
        failure_count = len(failures)
        skipped_count = len(skipped)

        logger.info("Update complete:")
        logger.info(f"  - Successful: {success_count}")
        logger.info(f"  - Failed: {failure_count}")
        logger.info(f"  - Skipped: {skipped_count}")
        logger.info("=" * 80)

        result = {
            "success": True,
            "dry_run": dry_run,
            "summary": {
                "total": total_devices,
                "successful": success_count,
                "failed": failure_count,
                "skipped": skipped_count,
            },
            "successes": successes,
            "failures": failures,
            "skipped": skipped,
            "timestamp": datetime.utcnow().isoformat(),
        }

        # Update job run status if this task is tracked
        try:
            import job_run_manager

            job_run = job_run_manager.get_job_run_by_celery_id(self.request.id)
            if job_run:
                job_run_manager.mark_completed(job_run["id"], result=result)
                logger.info(f"✓ Updated job run {job_run['id']} status to completed")
        except Exception as job_error:
            logger.warning(f"Failed to update job run status: {job_error}")

        return result

    except Exception as e:
        error_msg = f"Update devices task failed: {str(e)}"
        logger.error(error_msg, exc_info=True)

        error_result = {
            "success": False,
            "error": error_msg,
        }

        # Update job run status to failed if tracked
        try:
            import job_run_manager

            job_run = job_run_manager.get_job_run_by_celery_id(self.request.id)
            if job_run:
                job_run_manager.mark_failed(job_run["id"], error_msg)
                logger.info(f"✓ Updated job run {job_run['id']} status to failed")
        except Exception as job_error:
            logger.warning(f"Failed to update job run status: {job_error}")

        return error_result


def _prepare_row_data(
    row: Dict[str, str], headers: list
) -> tuple[Dict[str, Any], Dict[str, Any], Optional[Dict[str, str]]]:
    """
    Prepare row data for DeviceUpdateService.

    Extracts:
    1. Device identifier (id, name, or ip_address)
    2. Update data (all other fields except identifier and interface fields)
    3. Interface config (if interface_name/type/status present)

    Args:
        row: CSV row as dictionary
        headers: List of column headers

    Returns:
        Tuple of (device_identifier, update_data, interface_config)
    """
    # Extract device identifier
    device_identifier = {}
    if "id" in row and row["id"].strip():
        device_identifier["id"] = row["id"].strip()
    if "name" in row and row["name"].strip():
        device_identifier["name"] = row["name"].strip()
    if "ip_address" in row and row["ip_address"].strip():
        device_identifier["ip_address"] = row["ip_address"].strip()

    # Fields to exclude from updates (identifiers)
    excluded_fields = {"id", "name", "ip_address"}

    # Interface configuration fields
    interface_fields = {
        "interface_name",
        "interface_type",
        "interface_status",
        "ip_namespace",
    }

    # Extract interface configuration if present
    interface_config = None
    if any(
        f in headers for f in ["interface_name", "interface_type", "interface_status"]
    ):
        interface_config = {
            "name": row.get("interface_name", "").strip() or "Loopback",
            "type": row.get("interface_type", "").strip() or "virtual",
            "status": row.get("interface_status", "").strip() or "active",
        }

    # Build update data (all fields except identifiers and interface fields)
    update_data = {}

    for field in headers:
        if field in excluded_fields or field in interface_fields:
            continue

        value = row.get(field, "").strip()

        # Skip empty values
        if not value:
            continue

        # Add to update data as-is (service will handle validation/resolution)
        update_data[field] = value

    # Add ip_namespace to update_data if present (service expects it there)
    if "ip_namespace" in row and row["ip_namespace"].strip():
        update_data["ip_namespace"] = row["ip_namespace"].strip()

    return device_identifier, update_data, interface_config
