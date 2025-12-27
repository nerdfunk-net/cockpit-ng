"""
Celery task for importing new Nautobot devices from CSV data.

This task is a thin wrapper that:
1. Parses CSV content
2. Tracks Celery progress
3. Calls DeviceImportService for each device
4. Aggregates results
"""

from celery_app import celery_app
import logging
import csv
import io
import asyncio
from typing import Optional, Dict, Any, List
from datetime import datetime

from services.nautobot import NautobotService
from services.device_import_service import DeviceImportService

logger = logging.getLogger(__name__)


@celery_app.task(name="tasks.import_devices_from_csv", bind=True)
def import_devices_from_csv_task(
    self,
    csv_content: str,
    csv_options: Optional[Dict[str, Any]] = None,
    import_options: Optional[Dict[str, Any]] = None,
) -> dict:
    """
    Task: Import new Nautobot devices from CSV data.

    This task:
    1. Parses the CSV content
    2. For each device row, calls DeviceImportService
    3. Tracks successes and failures
    4. Returns summary of operations

    Args:
        csv_content: CSV file content as string
        csv_options: Optional CSV parsing options:
            - delimiter: Field delimiter (default: ",")
            - quoteChar: Quote character (default: '"')
        import_options: Optional import behavior options:
            - skip_duplicates: If True, skip devices that already exist (default: False)
            - create_interfaces: If True, create interfaces from CSV (default: True)

    Returns:
        dict: Import results including success/failure counts and details
    """
    try:
        logger.info("=" * 80)
        logger.info("IMPORT DEVICES FROM CSV TASK STARTED")
        logger.info("=" * 80)
        logger.info(f"CSV Options: {csv_options}")
        logger.info(f"Import Options: {import_options}")

        self.update_state(
            state="PROGRESS",
            meta={
                "current": 0,
                "total": 100,
                "status": "Parsing CSV...",
            },
        )

        # Parse options
        csv_opts = csv_options or {}
        delimiter = csv_opts.get("delimiter", ",")
        quotechar = csv_opts.get("quoteChar", '"')

        import_opts = import_options or {}
        skip_duplicates = import_opts.get("skip_duplicates", False)
        create_interfaces = import_opts.get("create_interfaces", True)

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
        logger.info(f"Total devices to import: {total_devices}")

        # Get CSV headers
        headers = list(rows[0].keys()) if rows else []
        logger.info(f"CSV columns: {headers}")

        # STEP 2: Validate CSV structure
        logger.info("-" * 80)
        logger.info("STEP 2: VALIDATING CSV STRUCTURE")
        logger.info("-" * 80)

        # Check for required fields
        required_fields = ["name", "device_type", "role", "location"]
        missing_fields = [f for f in required_fields if f not in headers]

        if missing_fields:
            return {
                "success": False,
                "error": f"CSV is missing required columns: {missing_fields}. Required: {required_fields}",
            }

        logger.info("All required fields present")

        # STEP 3: Initialize service
        logger.info("-" * 80)
        logger.info("STEP 3: INITIALIZING IMPORT SERVICE")
        logger.info("-" * 80)

        nautobot_service = NautobotService()
        import_service = DeviceImportService(nautobot_service)

        # STEP 4: Import devices
        logger.info("-" * 80)
        logger.info(f"STEP 4: IMPORTING {total_devices} DEVICES")
        logger.info(f"Skip duplicates: {skip_duplicates}")
        logger.info(f"Create interfaces: {create_interfaces}")
        logger.info("-" * 80)

        successes = []
        failures = []
        skipped = []

        for idx, row in enumerate(rows, 1):
            device_name = row.get("name", f"row-{idx}")

            try:
                logger.info(f"Processing device {idx}/{total_devices}: {device_name}")

                # Update progress
                progress = 10 + int((idx / total_devices) * 80)
                self.update_state(
                    state="PROGRESS",
                    meta={
                        "current": progress,
                        "total": 100,
                        "status": f"Importing device {idx}/{total_devices}: {device_name}",
                        "successes": len(successes),
                        "failures": len(failures),
                        "skipped": len(skipped),
                    },
                )

                # Prepare data for service
                device_data, interface_config = _prepare_device_data(
                    row, headers, create_interfaces
                )

                # Import device using service
                logger.info(f"Importing device {device_name}")
                logger.debug(f"Device data: {device_data}")
                if interface_config:
                    logger.debug(
                        f"Interface config: {len(interface_config)} interface(s)"
                    )

                result = asyncio.run(
                    import_service.import_device(
                        device_data=device_data,
                        interface_config=interface_config,
                        skip_if_exists=skip_duplicates,
                    )
                )

                if result["success"]:
                    if result["created"]:
                        successes.append(
                            {
                                "device_id": result["device_id"],
                                "device_name": result["device_name"],
                                "created": True,
                                "warnings": result["warnings"],
                                "interfaces_created": len(
                                    result["details"]["interfaces"]
                                ),
                            }
                        )
                        logger.info(
                            f"Successfully imported device {result['device_name']}: "
                            f"{len(result['details']['interfaces'])} interface(s)"
                        )
                    else:
                        # Device already existed and was skipped
                        skipped.append(
                            {
                                "device_id": result["device_id"],
                                "device_name": result["device_name"],
                                "reason": "Device already exists",
                            }
                        )
                        logger.info(
                            f"Device {result['device_name']} already exists, skipped"
                        )
                else:
                    # Service returned failure
                    failures.append(
                        {
                            "device_name": device_name,
                            "error": result["message"],
                        }
                    )
                    logger.error(
                        f"Service failed to import device: {result['message']}"
                    )

            except Exception as e:
                error_msg = str(e)
                logger.error(
                    f"Failed to import device {device_name}: {error_msg}", exc_info=True
                )
                failures.append(
                    {
                        "device_name": device_name,
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

        logger.info("Import complete:")
        logger.info(f"  - Successful: {success_count}")
        logger.info(f"  - Failed: {failure_count}")
        logger.info(f"  - Skipped: {skipped_count}")
        logger.info("=" * 80)

        result = {
            "success": True,
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
        error_msg = f"Import devices task failed: {str(e)}"
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


def _prepare_device_data(
    row: Dict[str, str], headers: List[str], create_interfaces: bool
) -> tuple[Dict[str, Any], Optional[List[Dict[str, Any]]]]:
    """
    Prepare device data for DeviceImportService.

    Extracts:
    1. Device data (name, device_type, role, location, etc.)
    2. Interface config (if interface fields present and create_interfaces=True)

    Args:
        row: CSV row as dictionary
        headers: List of column headers
        create_interfaces: Whether to extract interface configuration

    Returns:
        Tuple of (device_data, interface_config)
    """
    # Device-level fields
    device_fields = {
        "name",
        "device_type",
        "role",
        "location",
        "status",
        "platform",
        "serial",
        "asset_tag",
        "software_version",
        "description",
        "tags",
        "manufacturer",
    }

    # Custom fields (cf_*)
    custom_field_prefix = "cf_"

    # Interface fields
    interface_fields = {
        "interface_name",
        "interface_type",
        "interface_status",
        "interface_ip_address",
        "interface_description",
        "interface_enabled",
        "interface_mgmt_only",
        "interface_mac_address",
        "interface_mtu",
        "ip_namespace",
    }

    # Build device data
    device_data = {}

    for field in headers:
        if field in interface_fields:
            continue  # Handle separately

        value = row.get(field, "").strip()

        # Skip empty values
        if not value:
            continue

        # Handle custom fields
        if field.startswith(custom_field_prefix):
            if "custom_fields" not in device_data:
                device_data["custom_fields"] = {}
            # Remove cf_ prefix
            cf_name = field[len(custom_field_prefix) :]
            device_data["custom_fields"][cf_name] = value
        # Handle device fields
        elif field in device_fields:
            device_data[field] = value
        else:
            # Unknown field, add to device data anyway (service will handle)
            device_data[field] = value

    # Build interface configuration (if requested and fields present)
    interface_config = None

    if create_interfaces and any(f in headers for f in interface_fields):
        # Check if we have at least an IP address or interface name
        interface_ip = row.get("interface_ip_address", "").strip()
        interface_name = row.get("interface_name", "").strip()

        if interface_ip or interface_name:
            interface_config = [
                {
                    "name": interface_name or "Loopback0",
                    "type": row.get("interface_type", "").strip() or "virtual",
                    "status": row.get("interface_status", "").strip() or "active",
                    "ip_address": interface_ip,
                    "namespace": row.get("ip_namespace", "").strip() or "Global",
                    "is_primary_ipv4": True,  # First interface is primary
                    "enabled": row.get("interface_enabled", "").strip().lower()
                    not in ["false", "0", "no"],
                    "mgmt_only": row.get("interface_mgmt_only", "").strip().lower()
                    in ["true", "1", "yes"],
                    "description": row.get("interface_description", "").strip(),
                    "mac_address": row.get("interface_mac_address", "").strip(),
                    "mtu": int(row.get("interface_mtu"))
                    if row.get("interface_mtu", "").strip().isdigit()
                    else None,
                }
            ]

            # Remove None values and empty strings
            interface_config[0] = {
                k: v
                for k, v in interface_config[0].items()
                if v is not None and v != ""
            }

    return device_data, interface_config
