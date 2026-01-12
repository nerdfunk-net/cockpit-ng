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

        # STEP 2: Validate CSV structure
        logger.info("-" * 80)
        logger.info("STEP 2: VALIDATING CSV STRUCTURE")
        logger.info("-" * 80)

        # Check for prefix column (required)
        if "prefix" not in headers:
            return {
                "success": False,
                "error": "CSV is missing required 'prefix' column",
            }

        logger.info("✓ Required 'prefix' column found")

        # Check for namespace column (optional, defaults to "Global")
        has_namespace = "namespace__name" in headers
        if has_namespace:
            logger.info("✓ 'namespace__name' column found")
        else:
            logger.info("⚠ 'namespace__name' column not found, will default to 'Global'")

        # STEP 3: Initialize Nautobot service
        logger.info("-" * 80)
        logger.info("STEP 3: INITIALIZING NAUTOBOT SERVICE")
        logger.info("-" * 80)

        nautobot_service = NautobotService()

        # STEP 4: Update IP prefixes
        logger.info("-" * 80)
        logger.info(f"STEP 4: UPDATING {total_prefixes} IP PREFIXES")
        logger.info(f"Dry run mode: {dry_run}")
        logger.info(f"Lookup strategy: {'prefix+namespace' if ignore_uuid else 'UUID from CSV'}")
        logger.info("-" * 80)

        successes = []
        failures = []
        skipped = []

        for idx, row in enumerate(rows, 1):
            prefix_value = row.get("prefix", "").strip()
            namespace_name = row.get("namespace__name", "").strip() or "Global"
            csv_uuid = row.get("id", "").strip() if not ignore_uuid else None

            # Identifier for logging
            if ignore_uuid or not csv_uuid:
                identifier = f"{prefix_value} (namespace: {namespace_name})"
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
                            "namespace": namespace_name,
                            "reason": "Empty prefix value",
                        }
                    )
                    continue

                # Step 1: Determine the prefix UUID
                prefix_uuid = None
                existing_prefix = None

                if ignore_uuid or not csv_uuid:
                    # Use prefix + namespace lookup
                    logger.info(
                        f"Looking up prefix '{prefix_value}' in namespace '{namespace_name}'"
                    )

                    prefix_uuid, existing_prefix = asyncio.run(
                        _find_prefix_by_prefix_and_namespace(
                            nautobot_service, prefix_value, namespace_name
                        )
                    )

                    if not prefix_uuid:
                        logger.warning(
                            f"Prefix '{prefix_value}' not found in namespace '{namespace_name}'"
                        )
                        failures.append(
                            {
                                "row": idx,
                                "prefix": prefix_value,
                                "namespace": namespace_name,
                                "error": f"Prefix not found in namespace '{namespace_name}'",
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
                            logger.warning(f"Prefix with UUID '{prefix_uuid}' not found")
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
                    row, headers, existing_prefix, tags_mode
                )

                if not update_data:
                    logger.info(f"No update data for prefix {identifier}, skipping")
                    skipped.append(
                        {
                            "row": idx,
                            "prefix": prefix_value,
                            "namespace": namespace_name,
                            "uuid": prefix_uuid,
                            "reason": "No fields to update",
                        }
                    )
                    continue

                # Log custom fields if present
                if "custom_fields" in update_data:
                    custom_field_count = len(update_data["custom_fields"])
                    logger.info(
                        f"  - Custom fields to update: {custom_field_count} "
                        f"({list(update_data['custom_fields'].keys())})"
                    )

                # Step 3: Update the prefix
                if dry_run:
                    logger.info(
                        f"[DRY RUN] Would update prefix {identifier} with: {update_data}"
                    )
                    successes.append(
                        {
                            "row": idx,
                            "prefix": prefix_value,
                            "namespace": namespace_name,
                            "uuid": prefix_uuid,
                            "updates": update_data,
                            "dry_run": True,
                        }
                    )
                else:
                    logger.info(f"Updating prefix {identifier}")
                    logger.debug(f"Update data: {update_data}")

                    result = asyncio.run(
                        _update_prefix(nautobot_service, prefix_uuid, update_data)
                    )

                    if result["success"]:
                        successes.append(
                            {
                                "row": idx,
                                "prefix": prefix_value,
                                "namespace": namespace_name,
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
                                "namespace": namespace_name,
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
                        "namespace": namespace_name,
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


async def _find_prefix_by_prefix_and_namespace(
    nautobot_service: NautobotService, prefix: str, namespace_name: str
) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
    """
    Find a prefix in Nautobot by prefix value and namespace name.

    Args:
        nautobot_service: NautobotService instance
        prefix: Prefix value (e.g., "192.168.178.0/24")
        namespace_name: Namespace name (e.g., "Global")

    Returns:
        Tuple of (prefix_uuid, prefix_data) or (None, None) if not found
    """
    try:
        # Query Nautobot for prefixes matching prefix + namespace
        endpoint = f"ipam/prefixes/?prefix={prefix}&namespace={namespace_name}"
        result = await nautobot_service.rest_request(endpoint, method="GET")

        if not result or "results" not in result:
            logger.warning(f"No results returned for prefix query: {prefix}")
            return None, None

        results = result["results"]

        if not results:
            logger.warning(
                f"Prefix '{prefix}' not found in namespace '{namespace_name}'"
            )
            return None, None

        if len(results) > 1:
            logger.warning(
                f"Multiple prefixes found for '{prefix}' in namespace '{namespace_name}', "
                f"using first one"
            )

        # Use the first result
        prefix_data = results[0]
        prefix_uuid = prefix_data.get("id")

        return prefix_uuid, prefix_data

    except Exception as e:
        logger.error(f"Error finding prefix: {e}", exc_info=True)
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
        await nautobot_service.rest_request(endpoint, method="PATCH", data=update_data)

        return {"success": True}

    except Exception as e:
        error_msg = str(e)
        logger.error(f"Failed to update prefix {prefix_uuid}: {error_msg}")
        return {"success": False, "error": error_msg}


def _prepare_prefix_update_data(
    row: Dict[str, str],
    headers: list,
    existing_prefix: Dict[str, Any],
    tags_mode: str = "replace",
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

    update_data = {}
    custom_fields = {}

    for field in headers:
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
