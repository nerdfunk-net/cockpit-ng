"""
Celery task for updating Nautobot devices from CSV data.

This task handles CSV-formatted device updates and:
1. Parses CSV content
2. Tracks Celery progress
3. Calls DeviceUpdateService for each device
4. Aggregates results

Custom Fields:
- CSV columns starting with "cf_" are treated as custom fields
- The "cf_" prefix is automatically removed and fields are grouped under "custom_fields"
- Example: Column "cf_net" with value "netA" becomes {"custom_fields": {"net": "netA"}}

Note: For JSON-based updates with full interface array support,
use update_devices_task.py instead.
"""

from celery_app import celery_app
import logging
import csv
import io
import asyncio
from typing import Optional, Dict, Any
from datetime import datetime

import service_factory
from services.nautobot.devices.update import DeviceUpdateService

logger = logging.getLogger(__name__)


@celery_app.task(name="tasks.update_devices_from_csv", bind=True)
def update_devices_from_csv_task(
    self,
    csv_content: str,
    csv_options: Optional[Dict[str, Any]] = None,
    dry_run: bool = False,
    tags_mode: str = "replace",
    column_mapping: Optional[Dict[str, str]] = None,
    selected_columns: Optional[list] = None,
    primary_key_column: Optional[str] = None,
    matching_strategy: str = "exact",
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
        tags_mode: How to handle tags - "replace" or "merge" (default: "replace")
        column_mapping: Maps CSV column names to Nautobot field names. Only mapped
            columns are included in the update. Example:
            {"hostname": "name", "rack_name": "rack"}
        selected_columns: List of CSV column names to update. If provided, ONLY these
            columns are processed (after column_mapping is applied). Columns absent
            from this list are skipped even if present in the CSV.
        primary_key_column: CSV column used to look up devices (default: "name").
        matching_strategy: How to match devices by name - "exact" (default),
            "contains", or "starts_with". Only applies when looking up by name.

    Returns:
        dict: Update results including success/failure counts and details
    """
    try:
        logger.info("=" * 80)
        logger.info("UPDATE DEVICES FROM CSV TASK STARTED")
        logger.info("=" * 80)
        logger.info("Dry run: %s", dry_run)
        logger.info("Tags mode: %s", tags_mode)
        logger.info("Column mapping: %s", column_mapping)
        logger.info("Selected columns: %s", selected_columns)
        logger.info("Primary key column: %s", primary_key_column)
        logger.info("Matching strategy: %s", matching_strategy)
        logger.info("CSV Options: %s", csv_options)

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
            logger.info("Parsed %s rows from CSV", len(rows))
        except Exception as e:
            logger.error("CSV parsing failed: %s", e)
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
        logger.info("Total devices to process: %s", total_devices)

        # Get CSV headers
        headers = list(rows[0].keys()) if rows else []
        logger.info("CSV columns: %s", headers)

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
            "Identifier fields found: %s",
            [f for f in identifier_fields if f in headers],
        )

        # STEP 3: Initialize service
        logger.info("-" * 80)
        logger.info("STEP 3: INITIALIZING UPDATE SERVICE")
        logger.info("-" * 80)

        nautobot_service = service_factory.build_nautobot_service()
        update_service = DeviceUpdateService(nautobot_service)

        # STEP 4: Update devices
        logger.info("-" * 80)
        logger.info("STEP 4: UPDATING %s DEVICES", total_devices)
        logger.info("Dry run mode: %s", dry_run)
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
                logger.info(
                    "Processing device %s/%s: %s", idx, total_devices, identifier
                )

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
                    row, headers, column_mapping, selected_columns, primary_key_column
                )

                if not update_data:
                    logger.info("No update data for device %s, skipping", identifier)
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
                        "[DRY RUN] Would update device %s with: %s",
                        identifier,
                        update_data,
                    )
                    if interface_config:
                        logger.info("[DRY RUN] Interface config: %s", interface_config)

                    successes.append(
                        {
                            "device_identifier": device_identifier,
                            "updates": update_data,
                            "dry_run": True,
                        }
                    )
                else:
                    # Actually update the device using service
                    logger.info("Updating device %s", identifier)
                    logger.debug("Update data: %s", update_data)
                    if interface_config:
                        logger.debug("Interface config: %s", interface_config)

                    # Service now raises exceptions on failure instead of returning error dict
                    result = asyncio.run(
                        update_service.update_device(
                            device_identifier=device_identifier,
                            update_data=update_data,
                            interface_config=interface_config,
                            matching_strategy=matching_strategy,
                        )
                    )

                    # If we got here, the update succeeded
                    successes.append(
                        {
                            "device_id": result["device_id"],
                            "device_name": result["device_name"],
                            "updated_fields": result["updated_fields"],
                            "warnings": result["warnings"],
                        }
                    )
                    logger.info(
                        "Successfully updated device %s: %s fields",
                        result["device_name"],
                        len(result["updated_fields"]),
                    )

            except Exception as e:
                error_msg = str(e)
                logger.error(
                    "Failed to update device %s: %s",
                    identifier,
                    error_msg,
                    exc_info=True,
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
        logger.info("  - Successful: %s", success_count)
        logger.info("  - Failed: %s", failure_count)
        logger.info("  - Skipped: %s", skipped_count)
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
                logger.info("✓ Updated job run %s status to completed", job_run["id"])
        except Exception as job_error:
            logger.warning("Failed to update job run status: %s", job_error)

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
                logger.info("✓ Updated job run %s status to failed", job_run["id"])
        except Exception as job_error:
            logger.warning("Failed to update job run status: %s", job_error)

        return error_result


def _prepare_row_data(
    row: Dict[str, str],
    headers: list,
    column_mapping: Optional[Dict[str, str]] = None,
    selected_columns: Optional[list] = None,
    primary_key_column: Optional[str] = None,
) -> tuple[Dict[str, Any], Dict[str, Any], Optional[Dict[str, str]]]:
    """
    Prepare row data for DeviceUpdateService.

    Extracts:
    1. Device identifier (id, name, or ip_address)
    2. Update data (mapped/selected columns only, excluding identifier and interface fields)
    3. Interface config (if interface_name/type/status present)

    Column mapping and selection:
    - column_mapping: maps CSV column names to Nautobot field names
    - selected_columns: list of CSV columns to include; columns absent from this list are skipped
    - primary_key_column: CSV column used as device lookup key (default: "name")

    Custom fields handling:
    - Fields starting with "cf_" (after mapping) are treated as custom fields
    - The "cf_" prefix is removed and they're grouped under "custom_fields"

    Tags handling:
    - The "tags" field accepts comma-separated tag names
    - Whitespace around tag names is automatically trimmed

    Args:
        row: CSV row as dictionary
        headers: List of column headers
        column_mapping: Optional dict mapping CSV column → Nautobot field name
        selected_columns: Optional list of CSV columns to include in updates
        primary_key_column: CSV column used for device lookup (default: "name")

    Returns:
        Tuple of (device_identifier, update_data, interface_config)
    """
    mapping = column_mapping or {}
    pk_col = primary_key_column or "name"

    # Build set of CSV columns that should be processed for updates.
    # If selected_columns is provided, only those columns are eligible.
    if selected_columns is not None:
        allowed_csv_cols = set(selected_columns)
    else:
        allowed_csv_cols = set(headers)

    def nautobot_field(csv_col: str) -> str:
        """Return the Nautobot field name for a CSV column (using mapping if provided)."""
        return mapping.get(csv_col, csv_col)

    # Extract device identifier using the primary key column (plus id/ip_address fall-backs)
    device_identifier = {}
    pk_nb_field = nautobot_field(pk_col)

    for id_csv_col, id_nb_field in [
        ("id", "id"),
        (pk_col, pk_nb_field),
        ("ip_address", "ip_address"),
    ]:
        val = row.get(id_csv_col, "").strip()
        if val:
            device_identifier[id_nb_field] = val

    # Nautobot identifier field names — never sent as update fields
    identifier_nautobot_fields = {"id", "name", "ip_address"}

    # Interface configuration CSV columns
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

    # Build update data — respecting selected_columns and column_mapping
    update_data = {}
    custom_fields = {}

    for csv_col in headers:
        # Skip CSV columns not in the allowed set
        if csv_col not in allowed_csv_cols:
            continue

        # Resolve to Nautobot field name
        nb_field = nautobot_field(csv_col)

        # Skip identifier fields and interface configuration fields
        if nb_field in identifier_nautobot_fields:
            continue
        if csv_col in interface_fields or nb_field in interface_fields:
            continue

        value = row.get(csv_col, "").strip()

        # Skip empty values
        if not value:
            continue

        # Handle custom fields (Nautobot field names starting with "cf_")
        if nb_field.startswith("cf_"):
            custom_field_name = nb_field[3:]
            if value.upper() in ("NULL", "NOOBJECT"):
                custom_fields[custom_field_name] = None
            elif value.lower() in ("true", "false"):
                custom_fields[custom_field_name] = value.lower() == "true"
            else:
                custom_fields[custom_field_name] = value
            continue

        # Handle tags field — convert comma-separated string to list
        if nb_field == "tags":
            update_data[nb_field] = [
                tag.strip() for tag in value.split(",") if tag.strip()
            ]
            continue

        # Add to update data (service handles validation/resolution)
        update_data[nb_field] = value

    # Add custom fields to update data if any were found
    if custom_fields:
        update_data["custom_fields"] = custom_fields

    # Add ip_namespace to update_data if present (service expects it there)
    if "ip_namespace" in row and row["ip_namespace"].strip():
        update_data["ip_namespace"] = row["ip_namespace"].strip()

    return device_identifier, update_data, interface_config
