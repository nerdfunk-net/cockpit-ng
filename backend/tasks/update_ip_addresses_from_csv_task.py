"""
Celery task for updating Nautobot IP addresses from CSV data.

This task handles CSV-formatted IP address updates and:
1. Parses CSV content
2. Looks up IP addresses by address + namespace combination
3. Updates IP addresses using the Nautobot REST API
4. Tracks Celery progress
5. Aggregates results

Strategy:
- Primary identifier: address (e.g., "192.168.1.1/24") + namespace (via parent prefix)
- If namespace not in CSV, defaults to "Global"
- Queries Nautobot to find the IP address UUID, then updates it

Custom Fields:
- CSV columns starting with "cf_" are treated as custom fields
- The "cf_" prefix is automatically removed and fields are grouped under "custom_fields"
- Example: Column "cf_vlan_id" with value "100" becomes {"custom_fields": {"vlan_id": "100"}}
"""

from celery_app import celery_app
import logging
import csv
import io
import asyncio
from typing import Optional, Dict, Any, Tuple
from datetime import datetime

from services.nautobot import NautobotService

logger = logging.getLogger(__name__)


@celery_app.task(name="tasks.update_ip_addresses_from_csv", bind=True)
def update_ip_addresses_from_csv_task(
    self,
    csv_content: str,
    csv_options: Optional[Dict[str, Any]] = None,
    dry_run: bool = False,
    ignore_uuid: bool = True,
    tags_mode: str = "replace",
    column_mapping: Optional[Dict[str, str]] = None,
    selected_columns: Optional[list[str]] = None,
) -> dict:
    """
    Task: Update Nautobot IP addresses from CSV data.

    Args:
        csv_content: CSV file content as string
        csv_options: Optional CSV parsing options
        dry_run: If True, validate without making changes
        ignore_uuid: If True, use address+namespace lookup; if False, use UUID from CSV
        tags_mode: How to handle tags - "replace" or "merge"
        column_mapping: Maps lookup field names to CSV column names
        selected_columns: List of CSV column names that should be updated

    Returns:
        dict: Update results including success/failure counts and details
    """
    try:
        logger.info("=" * 80)
        logger.info("UPDATE IP ADDRESSES FROM CSV TASK STARTED")
        logger.info("=" * 80)
        logger.info(f"Dry run: {dry_run}")
        logger.info(f"Ignore UUID: {ignore_uuid}")
        logger.info(f"Tags mode: {tags_mode}")
        logger.info(f"Column mapping: {column_mapping}")
        logger.info(f"Selected columns for update: {selected_columns}")

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

        total_ip_addresses = len(rows)
        headers = list(rows[0].keys()) if rows else []
        logger.info(f"Total IP addresses to process: {total_ip_addresses}")
        logger.info(f"CSV columns: {headers}")

        # STEP 2: Apply column mapping and validate CSV structure
        logger.info("-" * 80)
        logger.info("STEP 2: VALIDATING CSV STRUCTURE")
        logger.info("-" * 80)

        mapping = column_mapping or {}

        def get_csv_column(lookup_field: str) -> str:
            return mapping.get(lookup_field, lookup_field)

        address_col = get_csv_column("address")
        namespace_col = get_csv_column("parent__namespace__name")
        id_col = get_csv_column("id") if not ignore_uuid else None

        logger.info("Column name mapping:")
        logger.info(f"  - Lookup field 'address' → CSV column '{address_col}'")
        logger.info(f"  - Lookup field 'parent__namespace__name' → CSV column '{namespace_col}'")
        if id_col:
            logger.info(f"  - Lookup field 'id' → CSV column '{id_col}'")

        # Check for required address column
        if address_col not in headers:
            return {
                "success": False,
                "error": f"CSV is missing required column '{address_col}' (mapped from 'address')",
            }

        logger.info(f"✓ Required column '{address_col}' found")

        # STEP 3: Initialize Nautobot service
        logger.info("-" * 80)
        logger.info("STEP 3: INITIALIZING NAUTOBOT SERVICE")
        logger.info("-" * 80)

        nautobot_service = NautobotService()

        # STEP 4: Update IP addresses
        logger.info("-" * 80)
        logger.info(f"STEP 4: UPDATING {total_ip_addresses} IP ADDRESSES")
        logger.info(f"Dry run mode: {dry_run}")
        logger.info(
            f"Lookup strategy: {'address+namespace' if ignore_uuid else 'UUID from CSV'}"
        )
        logger.info("-" * 80)

        successes = []
        failures = []
        skipped = []

        for idx, row in enumerate(rows, 1):
            # Extract values using mapped column names
            address_value = row.get(address_col, "").strip()
            namespace_value = row.get(namespace_col, "").strip() or "Global"
            csv_uuid = (
                row.get(id_col, "").strip() if (not ignore_uuid and id_col) else None
            )

            # Identifier for logging
            if ignore_uuid or not csv_uuid:
                identifier = f"{address_value} (namespace: {namespace_value})"
            else:
                identifier = f"{address_value} (UUID: {csv_uuid})"

            try:
                logger.info(f"Processing IP address {idx}/{total_ip_addresses}: {identifier}")

                # Update progress
                progress = 10 + int((idx / total_ip_addresses) * 80)
                self.update_state(
                    state="PROGRESS",
                    meta={
                        "current": progress,
                        "total": 100,
                        "status": f"Updating IP address {idx}/{total_ip_addresses}: {address_value}",
                        "successes": len(successes),
                        "failures": len(failures),
                        "skipped": len(skipped),
                    },
                )

                # Validate address value
                if not address_value:
                    logger.warning(f"Row {idx}: Empty address value, skipping")
                    skipped.append(
                        {
                            "row": idx,
                            "address": address_value,
                            "namespace": namespace_value,
                            "reason": "Empty address value",
                        }
                    )
                    continue

                # Step 1: Determine the IP address UUID
                ip_address_uuid = None
                existing_ip_address = None

                if ignore_uuid or not csv_uuid:
                    # Use address + namespace lookup via GraphQL
                    logger.info(
                        f"Looking up IP address '{address_value}' in namespace '{namespace_value}'"
                    )

                    ip_address_uuid, existing_ip_address = asyncio.run(
                        _find_ip_address_by_address_and_namespace_graphql(
                            nautobot_service, address_value, namespace_value
                        )
                    )

                    if not ip_address_uuid:
                        logger.warning(
                            f"IP address '{address_value}' not found in namespace '{namespace_value}'"
                        )
                        failures.append(
                            {
                                "row": idx,
                                "address": address_value,
                                "namespace": namespace_value,
                                "error": f"IP address not found in namespace '{namespace_value}'",
                            }
                        )
                        continue

                    logger.info(f"✓ Found IP address with UUID: {ip_address_uuid}")
                else:
                    # Use UUID from CSV directly
                    logger.info(f"Using UUID from CSV: {csv_uuid}")
                    ip_address_uuid = csv_uuid

                    # Verify the IP address exists
                    try:
                        existing_ip_address = asyncio.run(
                            _get_ip_address_by_uuid(nautobot_service, ip_address_uuid)
                        )
                        if not existing_ip_address:
                            logger.warning(
                                f"IP address with UUID '{ip_address_uuid}' not found"
                            )
                            failures.append(
                                {
                                    "row": idx,
                                    "address": address_value,
                                    "uuid": ip_address_uuid,
                                    "error": f"IP address with UUID '{ip_address_uuid}' not found",
                                }
                            )
                            continue
                        logger.info(f"✓ Verified IP address exists: {ip_address_uuid}")
                    except Exception as e:
                        logger.error(f"Failed to verify IP address UUID: {e}")
                        failures.append(
                            {
                                "row": idx,
                                "address": address_value,
                                "uuid": ip_address_uuid,
                                "error": f"Failed to verify IP address: {str(e)}",
                            }
                        )
                        continue

                # Step 2: Prepare update data
                update_data = _prepare_ip_address_update_data(
                    row, headers, existing_ip_address, tags_mode, selected_columns
                )

                if not update_data:
                    logger.info(f"No update data for IP address {identifier}, skipping")
                    skipped.append(
                        {
                            "row": idx,
                            "address": address_value,
                            "namespace": namespace_value,
                            "uuid": ip_address_uuid,
                            "reason": "No fields to update",
                        }
                    )
                    continue

                logger.info(f"Update data prepared for IP address {identifier}:")
                logger.info(f"  - Fields to update: {list(update_data.keys())}")
                logger.info(f"  - Complete update payload: {update_data}")

                # Step 3: Update the IP address
                if dry_run:
                    logger.info(f"[DRY RUN] Would update IP address {identifier}")
                    logger.info(f"  Update data: {update_data}")

                    successes.append(
                        {
                            "row": idx,
                            "address": address_value,
                            "namespace": namespace_value,
                            "uuid": ip_address_uuid,
                            "updates": update_data,
                            "dry_run": True,
                        }
                    )
                else:
                    logger.info(f"Updating IP address {identifier}")
                    logger.info(f"  - Endpoint: ipam/ip-addresses/{ip_address_uuid}/")
                    logger.info("  - Method: PATCH")
                    logger.info(f"  - Payload: {update_data}")

                    result = asyncio.run(
                        _update_ip_address(nautobot_service, ip_address_uuid, update_data)
                    )

                    if result["success"]:
                        successes.append(
                            {
                                "row": idx,
                                "address": address_value,
                                "namespace": namespace_value,
                                "uuid": ip_address_uuid,
                                "updated_fields": list(update_data.keys()),
                            }
                        )
                        logger.info(
                            f"✓ Successfully updated IP address {identifier}: "
                            f"{len(update_data)} fields"
                        )
                    else:
                        failures.append(
                            {
                                "row": idx,
                                "address": address_value,
                                "namespace": namespace_value,
                                "uuid": ip_address_uuid,
                                "error": result["error"],
                            }
                        )
                        logger.error(f"Failed to update IP address: {result['error']}")

            except Exception as e:
                error_msg = str(e)
                logger.error(
                    f"Failed to process IP address {identifier}: {error_msg}", exc_info=True
                )
                failures.append(
                    {
                        "row": idx,
                        "address": address_value,
                        "namespace": namespace_value,
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
                "total": total_ip_addresses,
                "successful": success_count,
                "failed": failure_count,
                "skipped": skipped_count,
            },
            "successes": successes,
            "failures": failures,
            "skipped": skipped,
            "timestamp": datetime.utcnow().isoformat(),
        }

        # Update job run status if tracked
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
        error_msg = f"Update IP addresses task failed: {str(e)}"
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


async def _get_ip_address_by_uuid(
    nautobot_service: NautobotService, ip_address_uuid: str
) -> Optional[Dict[str, Any]]:
    """Get an IP address from Nautobot by UUID using the REST API."""
    try:
        endpoint = f"ipam/ip-addresses/{ip_address_uuid}/"
        result = await nautobot_service.rest_request(endpoint, method="GET")
        return result
    except Exception as e:
        logger.error(f"Error getting IP address by UUID {ip_address_uuid}: {e}", exc_info=True)
        return None


async def _find_ip_address_by_address_and_namespace_graphql(
    nautobot_service: NautobotService, address: str, namespace: str
) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
    """
    Find an IP address in Nautobot by address value and namespace using GraphQL.

    Args:
        nautobot_service: NautobotService instance
        address: IP address value (e.g., "192.168.1.1/24")
        namespace: Namespace name (e.g., "Global")

    Returns:
        Tuple of (ip_address_uuid, ip_address_data) or (None, None) if not found
    """
    try:
        # GraphQL query to find IP address by address and namespace
        query = """
        query (
          $address: [String],
          $namespace: [String]
        ) {
          ip_addresses(address: $address, namespace: $namespace) {
            id
            address
            host
            mask_length
            parent {
              namespace {
                id
                name
              }
            }
          }
        }
        """

        variables = {
            "address": [address],
            "namespace": [namespace],
        }

        logger.debug(f"GraphQL query variables: {variables}")

        # Execute GraphQL query
        result = await nautobot_service.graphql_query(query, variables)

        if not result or "data" not in result:
            logger.warning(f"No data returned from GraphQL query for address: {address}")
            return None, None

        ip_addresses = result.get("data", {}).get("ip_addresses", [])

        if not ip_addresses:
            logger.warning(f"IP address '{address}' not found in namespace '{namespace}'")
            return None, None

        if len(ip_addresses) > 1:
            logger.warning(
                f"Multiple IP addresses found for '{address}' in namespace '{namespace}', "
                f"using first one"
            )

        # Use the first result
        ip_address_data = ip_addresses[0]
        ip_address_uuid = ip_address_data.get("id")

        logger.debug(f"Found IP address: {ip_address_data}")

        return ip_address_uuid, ip_address_data

    except Exception as e:
        logger.error(f"Error finding IP address via GraphQL: {e}", exc_info=True)
        return None, None


async def _update_ip_address(
    nautobot_service: NautobotService, ip_address_uuid: str, update_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Update an IP address in Nautobot using the REST API.

    This uses the nautobot_service.rest_request method directly,
    which is the same underlying method used by the REST endpoint.

    Args:
        nautobot_service: NautobotService instance
        ip_address_uuid: UUID of the IP address to update
        update_data: Data to update

    Returns:
        dict with 'success' and 'error' keys
    """
    try:
        endpoint = f"ipam/ip-addresses/{ip_address_uuid}/"

        logger.info("[API CALL] Updating IP address via REST API")
        logger.info(f"[API CALL]   - Endpoint: {endpoint}")
        logger.info("[API CALL]   - Method: PATCH")
        logger.info(f"[API CALL]   - Data: {update_data}")

        await nautobot_service.rest_request(endpoint, method="PATCH", data=update_data)

        logger.info(f"[API CALL] ✓ Update successful for IP address {ip_address_uuid}")
        return {"success": True}

    except Exception as e:
        error_msg = str(e)
        logger.error(f"[API CALL] ✗ Failed to update IP address {ip_address_uuid}: {error_msg}")
        logger.error(f"[API CALL]   - Update data that caused error: {update_data}")
        return {"success": False, "error": error_msg}


def _prepare_ip_address_update_data(
    row: Dict[str, str],
    headers: list,
    existing_ip_address: Dict[str, Any],
    tags_mode: str = "replace",
    selected_columns: Optional[list[str]] = None,
) -> Dict[str, Any]:
    """
    Prepare update data for an IP address from CSV row.

    Excludes:
    - id (used for lookup, not update)
    - address (primary key, should not change)
    - parent__namespace__name (used for lookup, should not change)
    - Read-only fields (display, object_type, created, etc.)

    Args:
        row: CSV row as dictionary
        headers: List of column headers
        existing_ip_address: Existing IP address data from Nautobot
        tags_mode: How to handle tags - "replace" or "merge"
        selected_columns: List of column names to update

    Returns:
        Dictionary of fields to update
    """
    # Fields to exclude from updates
    excluded_fields = {
        "id",
        "address",
        "parent__namespace__name",
        "parent__network",
        "parent__prefix_length",
        "parent__prefix",
        "object_type",
        "natural_slug",
        "display",
        "created",
        "last_updated",
        "url",
        # IP-derived fields (read-only)
        "host",
        "mask_length",
        "ip_version",
        "network",
        "broadcast",
        # Lookup fields (need IDs, not names)
        "status__name",
        "role__name",
        "tenant__name",
        "namespace__name",
        # NAT fields (should be IDs if updating)
        "nat_inside__parent__namespace__name",
        "nat_inside__host",
        "nat_inside__address",
        "nat_outside__parent__namespace__name",
        "nat_outside__host",
        "nat_outside__address",
        # Interface assignment fields (complex, should be excluded)
        "assigned_object",
        "assigned_object_type",
        "assigned_object_id",
    }

    update_data = {}
    custom_fields = {}

    columns_to_process = selected_columns if selected_columns is not None else headers

    logger.info(f"[_prepare_ip_address_update_data] Columns to process: {columns_to_process}")

    for field in columns_to_process:
        if field in excluded_fields:
            continue

        value = row.get(field, "").strip()

        # Handle tags field
        if field == "tags":
            if not value:
                if tags_mode == "replace":
                    update_data[field] = []
                    logger.debug("Replace mode: clearing all tags (empty value in CSV)")
                continue

            csv_tags = [tag.strip() for tag in value.split(",") if tag.strip()]

            if tags_mode == "merge":
                existing_tags = []
                if existing_ip_address and "tags" in existing_ip_address:
                    for tag in existing_ip_address["tags"]:
                        if isinstance(tag, dict) and "name" in tag:
                            existing_tags.append(tag["name"])
                        elif isinstance(tag, str):
                            existing_tags.append(tag)

                merged_tags = list(set(existing_tags + csv_tags))
                update_data[field] = merged_tags
                logger.debug(
                    f"Merging tags: existing={existing_tags}, csv={csv_tags}, merged={merged_tags}"
                )
            else:
                update_data[field] = csv_tags
                logger.debug(f"Replacing tags with: {csv_tags}")

            continue

        # Skip empty values for all other fields
        if not value:
            continue

        # Handle custom fields (fields starting with "cf_")
        if field.startswith("cf_"):
            custom_field_name = field[3:]

            if value.upper() == "NULL" or value.upper() == "NOOBJECT":
                custom_fields[custom_field_name] = None
            elif value.lower() in ["true", "false"]:
                custom_fields[custom_field_name] = value.lower() == "true"
            else:
                custom_fields[custom_field_name] = value

            continue

        # Handle special values
        if value.upper() == "NULL" or value.upper() == "NOOBJECT":
            update_data[field] = None
            continue

        # Handle boolean fields
        if value.lower() in ["true", "false"]:
            update_data[field] = value.lower() == "true"
            continue

        # Skip nested fields (e.g., status__name, parent__namespace__name)
        # These are lookup fields from CSV export and should not be sent to API
        if "__" in field:
            logger.debug(f"Skipping nested field '{field}' - lookup fields not supported for updates")
            continue

        # Regular field
        update_data[field] = value

    # Add custom fields to update data if any were found
    if custom_fields:
        update_data["custom_fields"] = custom_fields

    return update_data
