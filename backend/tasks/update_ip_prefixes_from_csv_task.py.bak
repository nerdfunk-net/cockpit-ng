"""
Celery task for updating Nautobot IP prefixes from CSV data.

This task handles CSV-formatted IP prefix updates and:
1. Parses CSV content
2. Looks up prefixes by prefix + namespace combination
3. Updates prefixes using the Nautobot REST API
4. Tracks Celery progress
5. Aggregates results

Strategy:
- Primary identifier: prefix (e.g., "192.168.178.0/24") + namespace__name
- If namespace__name is not in CSV, defaults to "Global"
- Queries Nautobot to find the prefix UUID, then updates it

Custom Fields:
- CSV columns starting with "cf_" are treated as custom fields
- The "cf_" prefix is automatically removed and fields are grouped under "custom_fields"
- Example: Column "cf_vlan_id" with value "100" becomes {"custom_fields": {"vlan_id": "100"}}
- Multiple custom fields: "cf_vlan_id", "cf_network_type" -> {"custom_fields": {"vlan_id": "...", "network_type": "..."}}
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


@celery_app.task(name="tasks.update_ip_prefixes_from_csv", bind=True)
def update_ip_prefixes_from_csv_task(
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
    Task: Update Nautobot IP prefixes from CSV data.

    This task:
    1. Parses the CSV content
    2. For each prefix row:
       - If ignore_uuid=True: Extracts prefix and namespace, queries Nautobot to find the prefix
       - If ignore_uuid=False: Uses the UUID from the 'id' column directly
       - Updates the prefix with CSV data
    3. Tracks successes and failures
    4. Returns summary of operations

    Args:
        csv_content: CSV file content as string
        csv_options: Optional CSV parsing options:
            - delimiter: Field delimiter (default: ",")
            - quoteChar: Quote character (default: '"')
        dry_run: If True, validate without making changes (default: False)
        ignore_uuid: If True, use prefix+namespace lookup; if False, use UUID from CSV (default: True)
        tags_mode: How to handle tags - "replace" to overwrite or "merge" to add (default: "replace")
        column_mapping: Maps lookup field names to CSV column names. Example:
            {"prefix": "network", "namespace__name": "ns_name", "namespace": "namespace"}
            If not provided, uses default column names (prefix, namespace__name, namespace)
        selected_columns: List of CSV column names that should be updated. If not provided, all columns
            (except excluded ones) will be updated. Example: ["description", "status", "cf_vlan_id"]

    Returns:
        dict: Update results including success/failure counts and details
    """
    try:
        logger.info("=" * 80)
        logger.info("UPDATE IP PREFIXES FROM CSV TASK STARTED")
        logger.info("=" * 80)
        logger.info(f"Dry run: {dry_run}")
        logger.info(f"Ignore UUID: {ignore_uuid}")
        logger.info(f"Tags mode: {tags_mode}")
        logger.info(f"Column mapping: {column_mapping}")
        logger.info(f"Selected columns for update: {selected_columns}")
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

        total_prefixes = len(rows)
        logger.info(f"Total prefixes to process: {total_prefixes}")

        # Get CSV headers
        headers = list(rows[0].keys()) if rows else []
        logger.info(f"CSV columns: {headers}")

        # STEP 2: Apply column mapping and validate CSV structure
        logger.info("-" * 80)
        logger.info("STEP 2: APPLYING COLUMN MAPPING & VALIDATING CSV STRUCTURE")
        logger.info("-" * 80)

        # Initialize column mapping with defaults
        mapping = column_mapping or {}

        # Helper function to get actual CSV column name from lookup field name
        def get_csv_column(lookup_field: str) -> str:
            """Get the CSV column name for a lookup field, using mapping if provided."""
            return mapping.get(lookup_field, lookup_field)

        # Get mapped column names (only 2 lookup fields)
        prefix_col = get_csv_column("prefix")
        namespace_col = get_csv_column("namespace")
        id_col = get_csv_column("id") if not ignore_uuid else None

        logger.info("Column name mapping:")
        logger.info(f"  - Lookup field 'prefix' → CSV column '{prefix_col}'")
        logger.info(f"  - Lookup field 'namespace' → CSV column '{namespace_col}'")
        if id_col:
            logger.info(f"  - Lookup field 'id' → CSV column '{id_col}'")

        # Check for prefix column (required)
        if prefix_col not in headers:
            return {
                "success": False,
                "error": f"CSV is missing required column '{prefix_col}' (mapped from 'prefix')",
            }

        logger.info(f"✓ Required column '{prefix_col}' found")

        # Check for namespace column (required)
        if namespace_col not in headers:
            return {
                "success": False,
                "error": f"CSV is missing required column '{namespace_col}' (mapped from 'namespace')",
            }

        logger.info(f"✓ Required column '{namespace_col}' found")

        # STEP 3: Initialize Nautobot service
        logger.info("-" * 80)
        logger.info("STEP 3: INITIALIZING NAUTOBOT SERVICE")
        logger.info("-" * 80)

        nautobot_service = NautobotService()

        # STEP 4: Update IP prefixes
        logger.info("-" * 80)
        logger.info(f"STEP 4: UPDATING {total_prefixes} IP PREFIXES")
        logger.info(f"Dry run mode: {dry_run}")
        logger.info(
            f"Lookup strategy: {'prefix+namespace' if ignore_uuid else 'UUID from CSV'}"
        )
        logger.info("-" * 80)

        successes = []
        failures = []
        skipped = []

        for idx, row in enumerate(rows, 1):
            # Extract values using mapped column names
            prefix_value = row.get(prefix_col, "").strip()
            namespace_value = row.get(namespace_col, "").strip()
            csv_uuid = (
                row.get(id_col, "").strip() if (not ignore_uuid and id_col) else None
            )

            # Validate namespace value
            if not namespace_value:
                logger.warning(
                    f"Row {idx}: Empty namespace value for prefix '{prefix_value}', skipping"
                )
                skipped.append(
                    {
                        "row": idx,
                        "prefix": prefix_value,
                        "namespace": "",
                        "reason": "Empty namespace value",
                    }
                )
                continue

            # Identifier for logging
            if ignore_uuid or not csv_uuid:
                identifier = f"{prefix_value} (namespace: {namespace_value})"
            else:
                identifier = f"{prefix_value} (UUID: {csv_uuid})"

            try:
                logger.info(f"Processing prefix {idx}/{total_prefixes}: {identifier}")

                # Update progress
                progress = 10 + int((idx / total_prefixes) * 80)
                self.update_state(
                    state="PROGRESS",
                    meta={
                        "current": progress,
                        "total": 100,
                        "status": f"Updating prefix {idx}/{total_prefixes}: {prefix_value}",
                        "successes": len(successes),
                        "failures": len(failures),
                        "skipped": len(skipped),
                    },
                )

                # Validate prefix value
                if not prefix_value:
                    logger.warning(f"Row {idx}: Empty prefix value, skipping")
                    skipped.append(
                        {
                            "row": idx,
                            "prefix": prefix_value,
                            "namespace": namespace_value,
                            "reason": "Empty prefix value",
                        }
                    )
                    continue

                # Step 1: Determine the prefix UUID
                prefix_uuid = None
                existing_prefix = None

                if ignore_uuid or not csv_uuid:
                    # Use prefix + namespace lookup via GraphQL
                    logger.info(
                        f"Looking up prefix '{prefix_value}' in namespace '{namespace_value}'"
                    )

                    prefix_uuid, existing_prefix = asyncio.run(
                        _find_prefix_by_prefix_and_namespace_graphql(
                            nautobot_service, prefix_value, namespace_value
                        )
                    )

                    if not prefix_uuid:
                        logger.warning(
                            f"Prefix '{prefix_value}' not found in namespace '{namespace_value}'"
                        )
                        failures.append(
                            {
                                "row": idx,
                                "prefix": prefix_value,
                                "namespace": namespace_value,
                                "error": f"Prefix not found in namespace '{namespace_value}'",
                            }
                        )
                        continue

                    logger.info(f"✓ Found prefix with UUID: {prefix_uuid}")
                else:
                    # Use UUID from CSV directly
                    logger.info(f"Using UUID from CSV: {csv_uuid}")
                    prefix_uuid = csv_uuid

                    # Optionally verify the prefix exists
                    try:
                        existing_prefix = asyncio.run(
                            _get_prefix_by_uuid(nautobot_service, prefix_uuid)
                        )
                        if not existing_prefix:
                            logger.warning(
                                f"Prefix with UUID '{prefix_uuid}' not found"
                            )
                            failures.append(
                                {
                                    "row": idx,
                                    "prefix": prefix_value,
                                    "uuid": prefix_uuid,
                                    "error": f"Prefix with UUID '{prefix_uuid}' not found",
                                }
                            )
                            continue
                        logger.info(f"✓ Verified prefix exists: {prefix_uuid}")
                    except Exception as e:
                        logger.error(f"Failed to verify prefix UUID: {e}")
                        failures.append(
                            {
                                "row": idx,
                                "prefix": prefix_value,
                                "uuid": prefix_uuid,
                                "error": f"Failed to verify prefix: {str(e)}",
                            }
                        )
                        continue

                # Step 2: Prepare update data
                update_data = _prepare_prefix_update_data(
                    row, headers, existing_prefix, tags_mode, selected_columns
                )

                if not update_data:
                    logger.info(f"No update data for prefix {identifier}, skipping")
                    skipped.append(
                        {
                            "row": idx,
                            "prefix": prefix_value,
                            "namespace": namespace_value,
                            "uuid": prefix_uuid,
                            "reason": "No fields to update",
                        }
                    )
                    continue

                # Log the complete update data that will be sent to Nautobot
                logger.info(f"Update data prepared for prefix {identifier}:")
                logger.info(f"  - Fields to update: {list(update_data.keys())}")
                logger.info(f"  - Complete update payload: {update_data}")

                # Log custom fields if present
                if "custom_fields" in update_data:
                    custom_field_count = len(update_data["custom_fields"])
                    logger.info(
                        f"  - Custom fields to update: {custom_field_count} "
                        f"({list(update_data['custom_fields'].keys())})"
                    )

                # Step 3: Update the prefix
                if dry_run:
                    # Fetch current prefix data for detailed comparison
                    if not existing_prefix:
                        existing_prefix = asyncio.run(
                            _get_prefix_by_uuid(nautobot_service, prefix_uuid)
                        )

                    # Generate detailed comparison
                    comparison = _generate_field_comparison(
                        existing_prefix, update_data
                    )

                    logger.info(f"[DRY RUN] Would update prefix {identifier}")
                    logger.info("  Changes to apply:")
                    for field, diff in comparison["changes"].items():
                        if field == "custom_fields":
                            # Custom fields have nested structure
                            logger.info(f"    • {field}:")
                            for cf_key, cf_diff in diff.items():
                                logger.info(f"        {cf_key}:")
                                logger.info(f"          Current: {cf_diff['current']}")
                                logger.info(f"          New:     {cf_diff['new']}")
                        elif field == "tags":
                            # Tags have special structure with added/removed
                            logger.info(f"    • {field}:")
                            logger.info(f"        Current: {diff.get('current', [])}")
                            logger.info(f"        New:     {diff.get('new', [])}")
                            if "added" in diff and diff["added"]:
                                logger.info(f"        Added:   {diff['added']}")
                            if "removed" in diff and diff["removed"]:
                                logger.info(f"        Removed: {diff['removed']}")
                        else:
                            # Regular fields
                            logger.info(f"    • {field}:")
                            logger.info(f"        Current: {diff.get('current')}")
                            logger.info(f"        New:     {diff.get('new')}")

                    if comparison["unchanged"]:
                        logger.info(
                            f"  Unchanged fields: {', '.join(comparison['unchanged'])}"
                        )

                    logger.info(f"  Summary: {comparison['summary']}")

                    successes.append(
                        {
                            "row": idx,
                            "prefix": prefix_value,
                            "namespace": namespace_value,
                            "uuid": prefix_uuid,
                            "updates": update_data,
                            "comparison": comparison,  # Add detailed comparison
                            "dry_run": True,
                        }
                    )
                else:
                    logger.info(f"Updating prefix {identifier}")
                    logger.info("  - Sending to Nautobot API:")
                    logger.info(f"    Endpoint: ipam/prefixes/{prefix_uuid}/")
                    logger.info("    Method: PATCH")
                    logger.info(f"    Payload: {update_data}")

                    result = asyncio.run(
                        _update_prefix(nautobot_service, prefix_uuid, update_data)
                    )

                    if result["success"]:
                        successes.append(
                            {
                                "row": idx,
                                "prefix": prefix_value,
                                "namespace": namespace_value,
                                "uuid": prefix_uuid,
                                "updated_fields": list(update_data.keys()),
                            }
                        )
                        logger.info(
                            f"✓ Successfully updated prefix {identifier}: "
                            f"{len(update_data)} fields"
                        )
                    else:
                        failures.append(
                            {
                                "row": idx,
                                "prefix": prefix_value,
                                "namespace": namespace_value,
                                "uuid": prefix_uuid,
                                "error": result["error"],
                            }
                        )
                        logger.error(f"Failed to update prefix: {result['error']}")

            except Exception as e:
                error_msg = str(e)
                logger.error(
                    f"Failed to process prefix {identifier}: {error_msg}", exc_info=True
                )
                failures.append(
                    {
                        "row": idx,
                        "prefix": prefix_value,
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
                "total": total_prefixes,
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
        error_msg = f"Update IP prefixes task failed: {str(e)}"
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


async def _get_prefix_by_uuid(
    nautobot_service: NautobotService, prefix_uuid: str
) -> Optional[Dict[str, Any]]:
    """
    Get a prefix from Nautobot by UUID.

    Args:
        nautobot_service: NautobotService instance
        prefix_uuid: UUID of the prefix

    Returns:
        Prefix data dict or None if not found
    """
    try:
        endpoint = f"ipam/prefixes/{prefix_uuid}/"
        result = await nautobot_service.rest_request(endpoint, method="GET")
        return result
    except Exception as e:
        logger.error(f"Error getting prefix by UUID {prefix_uuid}: {e}", exc_info=True)
        return None


async def _find_prefix_by_prefix_and_namespace_graphql(
    nautobot_service: NautobotService, prefix: str, namespace: str
) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
    """
    Find a prefix in Nautobot by prefix value and namespace using GraphQL.

    Args:
        nautobot_service: NautobotService instance
        prefix: Prefix value (e.g., "192.168.178.0/24")
        namespace: Namespace name or UUID (e.g., "Global" or UUID)

    Returns:
        Tuple of (prefix_uuid, prefix_data) or (None, None) if not found
    """
    try:
        # GraphQL query to find prefix by prefix and namespace
        query = """
        query (
          $ip_prefix: [String],
          $namespace: [String]
        ) {
          prefixes(prefix: $ip_prefix, namespace: $namespace) {
            id
            prefix
            prefix_length
            namespace {
              id
              name
            }
          }
        }
        """

        variables = {
            "ip_prefix": [prefix],
            "namespace": [namespace],
        }

        logger.debug(f"GraphQL query variables: {variables}")

        # Execute GraphQL query
        result = await nautobot_service.graphql_query(query, variables)

        if not result or "data" not in result:
            logger.warning(f"No data returned from GraphQL query for prefix: {prefix}")
            return None, None

        prefixes = result.get("data", {}).get("prefixes", [])

        if not prefixes:
            logger.warning(f"Prefix '{prefix}' not found in namespace '{namespace}'")
            return None, None

        if len(prefixes) > 1:
            logger.warning(
                f"Multiple prefixes found for '{prefix}' in namespace '{namespace}', "
                f"using first one"
            )

        # Use the first result
        prefix_data = prefixes[0]
        prefix_uuid = prefix_data.get("id")

        logger.debug(f"Found prefix: {prefix_data}")

        return prefix_uuid, prefix_data

    except Exception as e:
        logger.error(f"Error finding prefix via GraphQL: {e}", exc_info=True)
        return None, None


async def _update_prefix(
    nautobot_service: NautobotService, prefix_uuid: str, update_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Update a prefix in Nautobot.

    Args:
        nautobot_service: NautobotService instance
        prefix_uuid: UUID of the prefix to update
        update_data: Data to update

    Returns:
        dict with 'success' and 'error' keys
    """
    try:
        endpoint = f"ipam/prefixes/{prefix_uuid}/"

        logger.info("[API CALL] Updating prefix via REST API")
        logger.info(f"[API CALL]   - Endpoint: {endpoint}")
        logger.info("[API CALL]   - Method: PATCH")
        logger.info(f"[API CALL]   - Data: {update_data}")

        await nautobot_service.rest_request(endpoint, method="PATCH", data=update_data)

        logger.info(f"[API CALL] ✓ Update successful for prefix {prefix_uuid}")
        return {"success": True}

    except Exception as e:
        error_msg = str(e)
        logger.error(f"[API CALL] ✗ Failed to update prefix {prefix_uuid}: {error_msg}")
        logger.error(f"[API CALL]   - Update data that caused error: {update_data}")
        return {"success": False, "error": error_msg}


def _prepare_prefix_update_data(
    row: Dict[str, str],
    headers: list,
    existing_prefix: Dict[str, Any],
    tags_mode: str = "replace",
    selected_columns: Optional[list[str]] = None,
) -> Dict[str, Any]:
    """
    Prepare update data for a prefix from CSV row.

    Excludes:
    - id (used for lookup, not update)
    - prefix (primary key, should not change)
    - namespace__name (used for lookup, should not change)
    - Any fields that are empty in the CSV

    Custom fields handling:
    - Fields starting with "cf_" are treated as custom fields
    - The "cf_" prefix is removed and they're grouped under "custom_fields" key
    - Example: "cf_vlan_id" becomes {"custom_fields": {"vlan_id": "..."}}

    Tags handling:
    - The "tags" field accepts comma-separated tag names
    - Example: "production,core,monitored" becomes ["production", "core", "monitored"]
    - Whitespace around tag names is automatically trimmed
    - tags_mode "replace": CSV tags replace all existing tags
    - tags_mode "merge": CSV tags are added to existing tags (no duplicates)

    Args:
        row: CSV row as dictionary
        headers: List of column headers
        existing_prefix: Existing prefix data from Nautobot
        tags_mode: How to handle tags - "replace" or "merge" (default: "replace")
        selected_columns: List of column names to update. If None, all non-excluded columns are updated.
            If provided, ONLY these columns will be included in the update.

    Returns:
        Dictionary of fields to update
    """
    # Fields to exclude from updates
    excluded_fields = {
        "id",
        "prefix",
        "namespace__name",
        "namespace",  # Also exclude direct namespace field
        "object_type",
        "natural_slug",
        "display",
        "created",
        "last_updated",
        "url",
        # Network-derived fields (read-only)
        "network",
        "broadcast",
        "prefix_length",
        "ip_version",
    }

    # Start with empty dict - only add selected columns
    update_data = {}
    custom_fields = {}

    # Determine which columns to process
    # If selected_columns is provided, ONLY process those columns
    # Otherwise, process all headers except excluded ones
    logger.info(
        f"[_prepare_prefix_update_data] selected_columns parameter: {selected_columns}"
    )
    logger.info(f"[_prepare_prefix_update_data] CSV headers: {headers}")

    columns_to_process = selected_columns if selected_columns is not None else headers

    logger.info(
        f"[_prepare_prefix_update_data] Columns to process for update: {columns_to_process}"
    )

    for field in columns_to_process:
        if field in excluded_fields:
            continue

        value = row.get(field, "").strip()

        # Handle tags field specially - even if empty in replace mode
        if field == "tags":
            if not value:
                # Empty tags value
                if tags_mode == "replace":
                    # Replace mode with empty value: clear all tags
                    update_data[field] = []
                    logger.debug("Replace mode: clearing all tags (empty value in CSV)")
                # For merge mode with empty value: skip (don't modify existing tags)
                continue

            # Non-empty tags value - process normally
            csv_tags = [tag.strip() for tag in value.split(",") if tag.strip()]

            if tags_mode == "merge":
                # Merge mode: combine CSV tags with existing tags
                existing_tags = []
                if existing_prefix and "tags" in existing_prefix:
                    # Extract tag names from existing tags
                    for tag in existing_prefix["tags"]:
                        if isinstance(tag, dict) and "name" in tag:
                            existing_tags.append(tag["name"])
                        elif isinstance(tag, str):
                            existing_tags.append(tag)

                # Combine and deduplicate tags
                merged_tags = list(set(existing_tags + csv_tags))
                update_data[field] = merged_tags
                logger.debug(
                    f"Merging tags: existing={existing_tags}, csv={csv_tags}, merged={merged_tags}"
                )
            else:
                # Replace mode: use only CSV tags
                update_data[field] = csv_tags
                logger.debug(f"Replacing tags with: {csv_tags}")

            continue

        # Skip empty values for all other fields
        if not value:
            continue

        # Handle custom fields (fields starting with "cf_")
        if field.startswith("cf_"):
            # Extract custom field name by removing "cf_" prefix
            custom_field_name = field[3:]  # Remove first 3 characters ("cf_")

            # Handle special values for custom fields
            if value.upper() == "NULL" or value.upper() == "NOOBJECT":
                custom_fields[custom_field_name] = None
            elif value.lower() in ["true", "false"]:
                custom_fields[custom_field_name] = value.lower() == "true"
            else:
                custom_fields[custom_field_name] = value

            continue

        # Handle special values
        if value.upper() == "NULL" or value.upper() == "NOOBJECT":
            # Treat as null/empty
            update_data[field] = None
            continue

        # Handle boolean fields
        if value.lower() in ["true", "false"]:
            update_data[field] = value.lower() == "true"
            continue

        # Handle nested fields (e.g., status__name -> resolve to status ID)
        if "__" in field:
            # For now, keep as-is - service layer should handle resolution
            # In the future, we could resolve these to IDs here
            base_field = field.split("__")[0]
            update_data[base_field] = value
        else:
            # Regular field
            update_data[field] = value

    # Add custom fields to update data if any were found
    if custom_fields:
        update_data["custom_fields"] = custom_fields

    return update_data


def _generate_field_comparison(
    existing_prefix: Optional[Dict[str, Any]], update_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Generate a detailed field-by-field comparison for dry run mode.

    Compares the current values in Nautobot with the new values from CSV
    and categorizes fields as changed or unchanged.

    Args:
        existing_prefix: Current prefix data from Nautobot
        update_data: New data to apply from CSV

    Returns:
        Dictionary with:
        - changes: Dict of field -> {current, new} for fields that will change
        - unchanged: List of field names that will stay the same
        - summary: Human-readable summary of changes
    """
    if not existing_prefix:
        # No existing data to compare
        return {
            "changes": {
                field: {"current": None, "new": value}
                for field, value in update_data.items()
            },
            "unchanged": [],
            "summary": f"{len(update_data)} fields will be updated (no current data available)",
        }

    changes = {}
    unchanged = []

    for field, new_value in update_data.items():
        # Get current value
        if field == "custom_fields":
            # Handle custom fields specially - compare nested dict
            current_custom_fields = existing_prefix.get("custom_fields", {})
            changed_custom_fields = {}
            unchanged_custom_fields = []

            for cf_key, cf_new_value in new_value.items():
                cf_current_value = current_custom_fields.get(cf_key)
                if cf_current_value != cf_new_value:
                    changed_custom_fields[cf_key] = {
                        "current": cf_current_value,
                        "new": cf_new_value,
                    }
                else:
                    unchanged_custom_fields.append(cf_key)

            if changed_custom_fields:
                changes["custom_fields"] = changed_custom_fields
            if unchanged_custom_fields:
                unchanged.append(f"custom_fields.{','.join(unchanged_custom_fields)}")

        elif field == "tags":
            # Handle tags specially - compare as lists
            current_tags = existing_prefix.get("tags", [])
            # Convert tag objects to names if needed
            if current_tags and isinstance(current_tags[0], dict):
                current_tags = [tag.get("name", tag) for tag in current_tags]

            new_tags = new_value if isinstance(new_value, list) else []

            # Compare sets for tags
            current_set = set(current_tags)
            new_set = set(new_tags)

            if current_set != new_set:
                changes[field] = {
                    "current": sorted(current_tags),
                    "new": sorted(new_tags),
                    "added": sorted(new_set - current_set),
                    "removed": sorted(current_set - new_set),
                }
            else:
                unchanged.append(field)

        else:
            # Regular field comparison
            current_value = existing_prefix.get(field)

            # Handle nested objects (e.g., status, location)
            if isinstance(current_value, dict):
                # Extract the relevant field (usually 'name' or 'id')
                if "name" in current_value:
                    current_value = current_value.get("name")
                elif "id" in current_value:
                    current_value = current_value.get("id")

            # Compare values
            if str(current_value) != str(new_value):
                changes[field] = {
                    "current": current_value,
                    "new": new_value,
                }
            else:
                unchanged.append(field)

    # Generate summary
    change_count = len(changes)
    unchanged_count = len(unchanged)

    if change_count == 0:
        summary = "No changes (all values match current data)"
    else:
        summary = f"{change_count} field(s) will change, {unchanged_count} will remain unchanged"

    return {
        "changes": changes,
        "unchanged": unchanged,
        "summary": summary,
    }
