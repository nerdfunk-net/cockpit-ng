"""Business logic for updating Nautobot IP prefixes from CSV data."""

from __future__ import annotations

import asyncio
import csv
import io
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import service_factory

logger = logging.getLogger(__name__)


class PrefixUpdateService:
    """Parses CSV content and applies updates to Nautobot IP prefixes."""

    def run_update(
        self,
        task_context,
        csv_content: str,
        csv_options: Optional[Dict[str, Any]] = None,
        dry_run: bool = False,
        ignore_uuid: bool = True,
        tags_mode: str = "replace",
        column_mapping: Optional[Dict[str, str]] = None,
        selected_columns: Optional[list[str]] = None,
    ) -> dict:
        """Update Nautobot IP prefixes from CSV data."""
        try:
            logger.info("=" * 80)
            logger.info("UPDATE IP PREFIXES FROM CSV TASK STARTED")
            logger.info("=" * 80)
            logger.info("Dry run: %s", dry_run)
            logger.info("Ignore UUID: %s", ignore_uuid)
            logger.info("Tags mode: %s", tags_mode)
            logger.info("Column mapping: %s", column_mapping)
            logger.info("Selected columns for update: %s", selected_columns)
            logger.info("CSV Options: %s", csv_options)

            task_context.update_state(
                state="PROGRESS",
                meta={
                    "current": 0,
                    "total": 100,
                    "status": "Parsing CSV...",
                },
            )

            csv_opts = csv_options or {}
            delimiter = csv_opts.get("delimiter", ",")
            quotechar = csv_opts.get("quoteChar", '"')

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
                    "error": "Failed to parse CSV: %s" % str(e),
                }

            if not rows:
                return {
                    "success": False,
                    "error": "CSV file is empty or invalid",
                }

            total_prefixes = len(rows)
            logger.info("Total prefixes to process: %s", total_prefixes)

            headers = list(rows[0].keys()) if rows else []
            logger.info("CSV columns: %s", headers)

            logger.info("-" * 80)
            logger.info("STEP 2: APPLYING COLUMN MAPPING & VALIDATING CSV STRUCTURE")
            logger.info("-" * 80)

            mapping = column_mapping or {}

            def get_csv_column(lookup_field: str) -> str:
                return mapping.get(lookup_field, lookup_field)

            prefix_col = get_csv_column("prefix")
            namespace_col = get_csv_column("namespace")
            id_col = get_csv_column("id") if not ignore_uuid else None

            logger.info("Column name mapping:")
            logger.info("  - Lookup field 'prefix' → CSV column '%s'", prefix_col)
            logger.info("  - Lookup field 'namespace' → CSV column '%s'", namespace_col)
            if id_col:
                logger.info("  - Lookup field 'id' → CSV column '%s'", id_col)

            if prefix_col not in headers:
                return {
                    "success": False,
                    "error": "CSV is missing required column '%s' (mapped from 'prefix')" % prefix_col,
                }

            logger.info("✓ Required column '%s' found", prefix_col)

            if namespace_col not in headers:
                return {
                    "success": False,
                    "error": "CSV is missing required column '%s' (mapped from 'namespace')" % namespace_col,
                }

            logger.info("✓ Required column '%s' found", namespace_col)

            logger.info("-" * 80)
            logger.info("STEP 3: INITIALIZING NAUTOBOT CLIENT")
            logger.info("-" * 80)

            nautobot_client = service_factory.build_nautobot_service()

            logger.info("-" * 80)
            logger.info("STEP 4: UPDATING %s IP PREFIXES", total_prefixes)
            logger.info("Dry run mode: %s", dry_run)
            logger.info(
                "Lookup strategy: %s",
                "prefix+namespace" if ignore_uuid else "UUID from CSV",
            )
            logger.info("-" * 80)

            successes = []
            failures = []
            skipped = []

            for idx, row in enumerate(rows, 1):
                prefix_value = row.get(prefix_col, "").strip()
                namespace_value = row.get(namespace_col, "").strip()
                csv_uuid = (
                    row.get(id_col, "").strip() if (not ignore_uuid and id_col) else None
                )

                if not namespace_value:
                    logger.warning(
                        "Row %s: Empty namespace value for prefix '%s', skipping",
                        idx,
                        prefix_value,
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

                if ignore_uuid or not csv_uuid:
                    identifier = "%s (namespace: %s)" % (prefix_value, namespace_value)
                else:
                    identifier = "%s (UUID: %s)" % (prefix_value, csv_uuid)

                try:
                    logger.info(
                        "Processing prefix %s/%s: %s", idx, total_prefixes, identifier
                    )

                    progress = 10 + int((idx / total_prefixes) * 80)
                    task_context.update_state(
                        state="PROGRESS",
                        meta={
                            "current": progress,
                            "total": 100,
                            "status": "Updating prefix %s/%s: %s" % (idx, total_prefixes, prefix_value),
                            "successes": len(successes),
                            "failures": len(failures),
                            "skipped": len(skipped),
                        },
                    )

                    if not prefix_value:
                        logger.warning("Row %s: Empty prefix value, skipping", idx)
                        skipped.append(
                            {
                                "row": idx,
                                "prefix": prefix_value,
                                "namespace": namespace_value,
                                "reason": "Empty prefix value",
                            }
                        )
                        continue

                    prefix_uuid = None
                    existing_prefix = None

                    if ignore_uuid or not csv_uuid:
                        logger.info(
                            "Looking up prefix '%s' in namespace '%s'",
                            prefix_value,
                            namespace_value,
                        )

                        prefix_uuid, existing_prefix = (
                            self._find_prefix_by_prefix_and_namespace_graphql(
                                nautobot_client, prefix_value, namespace_value
                            )
                        )

                        if not prefix_uuid:
                            logger.warning(
                                "Prefix '%s' not found in namespace '%s'",
                                prefix_value,
                                namespace_value,
                            )
                            failures.append(
                                {
                                    "row": idx,
                                    "prefix": prefix_value,
                                    "namespace": namespace_value,
                                    "error": "Prefix not found in namespace '%s'" % namespace_value,
                                }
                            )
                            continue

                        logger.info("✓ Found prefix with UUID: %s", prefix_uuid)
                    else:
                        logger.info("Using UUID from CSV: %s", csv_uuid)
                        prefix_uuid = csv_uuid

                        try:
                            existing_prefix = self._get_prefix_by_uuid(
                                nautobot_client, prefix_uuid
                            )
                            if not existing_prefix:
                                logger.warning(
                                    "Prefix with UUID '%s' not found", prefix_uuid
                                )
                                failures.append(
                                    {
                                        "row": idx,
                                        "prefix": prefix_value,
                                        "uuid": prefix_uuid,
                                        "error": "Prefix with UUID '%s' not found" % prefix_uuid,
                                    }
                                )
                                continue
                            logger.info("✓ Verified prefix exists: %s", prefix_uuid)
                        except Exception as e:
                            logger.error("Failed to verify prefix UUID: %s", e)
                            failures.append(
                                {
                                    "row": idx,
                                    "prefix": prefix_value,
                                    "uuid": prefix_uuid,
                                    "error": "Failed to verify prefix: %s" % str(e),
                                }
                            )
                            continue

                    update_data = self._prepare_prefix_update_data(
                        row, headers, existing_prefix, tags_mode, selected_columns
                    )

                    if not update_data:
                        logger.info("No update data for prefix %s, skipping", identifier)
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

                    logger.info("Update data prepared for prefix %s:", identifier)
                    logger.info("  - Fields to update: %s", list(update_data.keys()))
                    logger.info("  - Complete update payload: %s", update_data)

                    if "custom_fields" in update_data:
                        custom_field_count = len(update_data["custom_fields"])
                        logger.info(
                            "  - Custom fields to update: %s (%s)",
                            custom_field_count,
                            list(update_data["custom_fields"].keys()),
                        )

                    if dry_run:
                        if not existing_prefix:
                            existing_prefix = self._get_prefix_by_uuid(
                                nautobot_client, prefix_uuid
                            )

                        comparison = self._generate_field_comparison(
                            existing_prefix, update_data
                        )

                        logger.info("[DRY RUN] Would update prefix %s", identifier)
                        logger.info("  Changes to apply:")
                        for field, diff in comparison["changes"].items():
                            if field == "custom_fields":
                                logger.info("    • %s:", field)
                                for cf_key, cf_diff in diff.items():
                                    logger.info("        %s:", cf_key)
                                    logger.info("          Current: %s", cf_diff["current"])
                                    logger.info("          New:     %s", cf_diff["new"])
                            elif field == "tags":
                                logger.info("    • %s:", field)
                                logger.info("        Current: %s", diff.get("current", []))
                                logger.info("        New:     %s", diff.get("new", []))
                                if "added" in diff and diff["added"]:
                                    logger.info("        Added:   %s", diff["added"])
                                if "removed" in diff and diff["removed"]:
                                    logger.info("        Removed: %s", diff["removed"])
                            else:
                                logger.info("    • %s:", field)
                                logger.info("        Current: %s", diff.get("current"))
                                logger.info("        New:     %s", diff.get("new"))

                        if comparison["unchanged"]:
                            logger.info(
                                "  Unchanged fields: %s", ", ".join(comparison["unchanged"])
                            )

                        logger.info("  Summary: %s", comparison["summary"])

                        successes.append(
                            {
                                "row": idx,
                                "prefix": prefix_value,
                                "namespace": namespace_value,
                                "uuid": prefix_uuid,
                                "updates": update_data,
                                "comparison": comparison,
                                "dry_run": True,
                            }
                        )
                    else:
                        logger.info("Updating prefix %s", identifier)
                        logger.info("  - Sending to Nautobot API:")
                        logger.info("    Endpoint: ipam/prefixes/%s/", prefix_uuid)
                        logger.info("    Method: PATCH")
                        logger.info("    Payload: %s", update_data)

                        result = self._update_prefix(nautobot_client, prefix_uuid, update_data)

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
                                "✓ Successfully updated prefix %s: %s fields",
                                identifier,
                                len(update_data),
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
                            logger.error("Failed to update prefix: %s", result["error"])

                except Exception as e:
                    error_msg = str(e)
                    logger.error(
                        "Failed to process prefix %s: %s",
                        identifier,
                        error_msg,
                        exc_info=True,
                    )
                    failures.append(
                        {
                            "row": idx,
                            "prefix": prefix_value,
                            "namespace": namespace_value,
                            "error": error_msg,
                        }
                    )

            logger.info("-" * 80)
            logger.info("STEP 5: PREPARING RESULTS")
            logger.info("-" * 80)

            task_context.update_state(
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

            try:
                import job_run_manager

                job_run = job_run_manager.get_job_run_by_celery_id(task_context.request.id)
                if job_run:
                    job_run_manager.mark_completed(job_run["id"], result=result)
                    logger.info("✓ Updated job run %s status to completed", job_run["id"])
            except Exception as job_error:
                logger.warning("Failed to update job run status: %s", job_error)

            return result

        except Exception as e:
            error_msg = "Update IP prefixes task failed: %s" % str(e)
            logger.error(error_msg, exc_info=True)

            error_result = {
                "success": False,
                "error": error_msg,
            }

            try:
                import job_run_manager

                job_run = job_run_manager.get_job_run_by_celery_id(task_context.request.id)
                if job_run:
                    job_run_manager.mark_failed(job_run["id"], error_msg)
                    logger.info("✓ Updated job run %s status to failed", job_run["id"])
            except Exception as job_error:
                logger.warning("Failed to update job run status: %s", job_error)

            return error_result

    def _get_prefix_by_uuid(
        self,
        nautobot_client,
        prefix_uuid: str,
    ) -> Optional[Dict[str, Any]]:
        """GET /api/ipam/prefixes/{id}/ → return prefix dict or None."""
        try:
            endpoint = "ipam/prefixes/%s/" % prefix_uuid
            result = asyncio.run(nautobot_client.rest_request(endpoint, method="GET"))
            return result
        except Exception as e:
            logger.error(
                "Error getting prefix by UUID %s: %s", prefix_uuid, e, exc_info=True
            )
            return None

    def _find_prefix_by_prefix_and_namespace_graphql(
        self,
        nautobot_client,
        prefix: str,
        namespace: str,
    ) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
        """GraphQL lookup: return (prefix_uuid, prefix_data) or (None, None) if not found."""
        try:
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

            logger.debug("GraphQL query variables: %s", variables)

            result = asyncio.run(nautobot_client.graphql_query(query, variables))

            if not result or "data" not in result:
                logger.warning("No data returned from GraphQL query for prefix: %s", prefix)
                return None, None

            prefixes = result.get("data", {}).get("prefixes", [])

            if not prefixes:
                logger.warning("Prefix '%s' not found in namespace '%s'", prefix, namespace)
                return None, None

            if len(prefixes) > 1:
                logger.warning(
                    "Multiple prefixes found for '%s' in namespace '%s', using first one",
                    prefix,
                    namespace,
                )

            prefix_data = prefixes[0]
            prefix_uuid = prefix_data.get("id")

            logger.debug("Found prefix: %s", prefix_data)

            return prefix_uuid, prefix_data

        except Exception as e:
            logger.error("Error finding prefix via GraphQL: %s", e, exc_info=True)
            return None, None

    def _update_prefix(
        self,
        nautobot_client,
        prefix_uuid: str,
        update_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """PATCH the prefix; return dict with 'success' and optional 'error'."""
        try:
            endpoint = "ipam/prefixes/%s/" % prefix_uuid

            logger.info("[API CALL] Updating prefix via REST API")
            logger.info("[API CALL]   - Endpoint: %s", endpoint)
            logger.info("[API CALL]   - Method: PATCH")
            logger.info("[API CALL]   - Data: %s", update_data)

            asyncio.run(
                nautobot_client.rest_request(endpoint, method="PATCH", data=update_data)
            )

            logger.info("[API CALL] ✓ Update successful for prefix %s", prefix_uuid)
            return {"success": True}

        except Exception as e:
            error_msg = str(e)
            logger.error(
                "[API CALL] ✗ Failed to update prefix %s: %s", prefix_uuid, error_msg
            )
            logger.error("[API CALL]   - Update data that caused error: %s", update_data)
            return {"success": False, "error": error_msg}

    @staticmethod
    def _prepare_prefix_update_data(
        row: Dict[str, str],
        headers: list,
        existing_prefix: Dict[str, Any],
        tags_mode: str = "replace",
        selected_columns: Optional[list[str]] = None,
    ) -> Dict[str, Any]:
        """Build the PATCH payload from a CSV row and the existing Nautobot object."""
        excluded_fields = {
            "id",
            "prefix",
            "namespace__name",
            "namespace",
            "object_type",
            "natural_slug",
            "display",
            "created",
            "last_updated",
            "url",
            "network",
            "broadcast",
            "prefix_length",
            "ip_version",
        }

        update_data = {}
        custom_fields = {}

        logger.info(
            "[_prepare_prefix_update_data] selected_columns parameter: %s", selected_columns
        )
        logger.info("[_prepare_prefix_update_data] CSV headers: %s", headers)

        columns_to_process = selected_columns if selected_columns is not None else headers

        logger.info(
            "[_prepare_prefix_update_data] Columns to process for update: %s",
            columns_to_process,
        )

        for field in columns_to_process:
            if field in excluded_fields:
                continue

            value = row.get(field, "").strip()

            if field == "tags":
                if not value:
                    if tags_mode == "replace":
                        update_data[field] = []
                        logger.debug("Replace mode: clearing all tags (empty value in CSV)")
                    continue

                csv_tags = [tag.strip() for tag in value.split(",") if tag.strip()]

                if tags_mode == "merge":
                    existing_tags = []
                    if existing_prefix and "tags" in existing_prefix:
                        for tag in existing_prefix["tags"]:
                            if isinstance(tag, dict) and "name" in tag:
                                existing_tags.append(tag["name"])
                            elif isinstance(tag, str):
                                existing_tags.append(tag)

                    merged_tags = list(set(existing_tags + csv_tags))
                    update_data[field] = merged_tags
                    logger.debug(
                        "Merging tags: existing=%s, csv=%s, merged=%s",
                        existing_tags,
                        csv_tags,
                        merged_tags,
                    )
                else:
                    update_data[field] = csv_tags
                    logger.debug("Replacing tags with: %s", csv_tags)

                continue

            if not value:
                continue

            if field.startswith("cf_"):
                custom_field_name = field[3:]

                if value.upper() == "NULL" or value.upper() == "NOOBJECT":
                    custom_fields[custom_field_name] = None
                elif value.lower() in ["true", "false"]:
                    custom_fields[custom_field_name] = value.lower() == "true"
                else:
                    custom_fields[custom_field_name] = value

                continue

            if value.upper() == "NULL" or value.upper() == "NOOBJECT":
                update_data[field] = None
                continue

            if value.lower() in ["true", "false"]:
                update_data[field] = value.lower() == "true"
                continue

            if "__" in field:
                base_field = field.split("__")[0]
                update_data[base_field] = value
            else:
                update_data[field] = value

        if custom_fields:
            update_data["custom_fields"] = custom_fields

        return update_data

    @staticmethod
    def _generate_field_comparison(
        existing_prefix: Optional[Dict[str, Any]], update_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Return a human-readable diff dict for logging in dry-run mode."""
        if not existing_prefix:
            return {
                "changes": {
                    field: {"current": None, "new": value}
                    for field, value in update_data.items()
                },
                "unchanged": [],
                "summary": "%s fields will be updated (no current data available)" % len(update_data),
            }

        changes = {}
        unchanged = []

        for field, new_value in update_data.items():
            if field == "custom_fields":
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
                    unchanged.append("custom_fields.%s" % ",".join(unchanged_custom_fields))

            elif field == "tags":
                current_tags = existing_prefix.get("tags", [])
                if current_tags and isinstance(current_tags[0], dict):
                    current_tags = [tag.get("name", tag) for tag in current_tags]

                new_tags = new_value if isinstance(new_value, list) else []

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
                current_value = existing_prefix.get(field)

                if isinstance(current_value, dict):
                    if "name" in current_value:
                        current_value = current_value.get("name")
                    elif "id" in current_value:
                        current_value = current_value.get("id")

                if str(current_value) != str(new_value):
                    changes[field] = {
                        "current": current_value,
                        "new": new_value,
                    }
                else:
                    unchanged.append(field)

        change_count = len(changes)
        unchanged_count = len(unchanged)

        if change_count == 0:
            summary = "No changes (all values match current data)"
        else:
            summary = "%s field(s) will change, %s will remain unchanged" % (
                change_count, unchanged_count
            )

        return {
            "changes": changes,
            "unchanged": unchanged,
            "summary": summary,
        }
