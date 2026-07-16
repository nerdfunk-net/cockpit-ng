"""Business logic for importing and updating Nautobot objects from CSV files."""

from __future__ import annotations

import asyncio
import csv
import fnmatch
import io
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import service_factory
from models.nautobot import AddDeviceRequest, InterfaceData, IpAddressData
from services.git.paths import repo_path as git_repo_path
from services.git.shared_utils import git_repo_manager
from services.nautobot import NautobotService
from services.nautobot.devices.creation import DeviceCreationService
from services.nautobot.devices.update import DeviceUpdateService

logger = logging.getLogger(__name__)

# Nautobot REST endpoints per import type
_ENDPOINT_MAP = {
    "devices": "dcim/devices/",
    "ip-prefixes": "ipam/prefixes/",
    "ip-addresses": "ipam/ip-addresses/",
}

_GRAPHQL_QUERY_DEVICES = """
query ($name: [String]) {
  devices(name: $name) { id name }
}
"""

_GRAPHQL_QUERY_PREFIXES = """
query ($prefix: [String], $namespace: [String]) {
  prefixes(prefix: $prefix, namespace: $namespace) { id prefix }
}
"""

_GRAPHQL_QUERY_IP_ADDRESSES = """
query ($address: [String]) {
  ip_addresses(address: $address) { id address }
}
"""

_NAUTOBOT_NULL_SENTINELS = {"NULL", "NoObject", "null", ""}

_INTERFACE_FIELD_MAP: dict[str, str] = {
    "interface_name": "name",
    "interface_type": "type",
    "interface_status": "status",
    "interface_ip_address": "ip_address",
    "interface_namespace": "namespace",
    "interface_description": "description",
}

# Profile field → Nautobot payload field, per import type. Profile values only
# fill fields the CSV leaves blank (same semantics as the CSV Updates tool's
# "Use Default Properties" / DEFAULTS_FIELD_MAP on the frontend).
_PROFILE_FIELD_MAP: dict[str, dict[str, str]] = {
    "devices": {
        "device_status": "status",
        "device_role": "role",
        "location": "location",
        "device_type": "device_type",
        "platform": "platform",
        "interface_status": "interface_status",
        "interface_type": "interface_type",
        "namespace": "interface_namespace",
    },
    "ip-addresses": {
        "ip_address_status": "status",
        "namespace": "namespace",
    },
    "ip-prefixes": {
        "ip_prefix_status": "status",
        "namespace": "namespace",
    },
}

# Fields AddDeviceRequest requires to create a device.
_DEVICE_REQUIRED_FIELDS = ("name", "role", "status", "location", "device_type")

# Device-level CSV/profile fields forwarded into AddDeviceRequest on creation.
_DEVICE_CREATE_FIELDS = (
    "name",
    "role",
    "status",
    "location",
    "device_type",
    "platform",
    "software_version",
    "serial",
    "asset_tag",
    "rack",
    "face",
    "position",
)


@dataclass
class ImportContext:
    """Bundles services and accumulator lists for CSV import processing."""

    nautobot_service: Any
    device_creation_service: Any
    device_update_service: Any
    created: list[dict]
    updated: list[dict]
    skipped: list[dict]
    failures: list[dict]
    dry_run: bool
    add_prefixes: bool
    default_prefix_length: str | None


class CsvImportService:
    """Imports or updates Nautobot objects from CSV files in a Git repository."""

    def run_import(
        self,
        task_context,
        import_type: str,
        primary_key: str,
        source: str = "git",
        repo_id: int | None = None,
        file_path: str = "",
        agent_id: str | None = None,
        agent_flows: list[str] | None = None,
        update_existing: bool = True,
        import_unknown: bool = True,
        delimiter: str = ",",
        quote_char: str = '"',
        column_mapping: dict[str, str | None] | None = None,
        dry_run: bool = False,
        template_id: int | None = None,
        file_filter: str | None = None,
        profile_id: int | None = None,
        import_format: str = "generic",
        add_prefixes: bool = False,
        default_prefix_length: str | None = None,
    ) -> dict:
        """Import or update Nautobot objects from CSV data.

        The CSV data comes either from files in a Git repository
        (source="git") or from the text blocks a Get Data agent returns
        for the configured flows (source="agent").
        """
        try:
            logger.info("=" * 80)
            logger.info("IMPORT OR UPDATE FROM CSV TASK STARTED")
            logger.info("=" * 80)
            logger.info("Source: %s", source)
            logger.info("Repo ID: %s", repo_id)
            logger.info("File path: %s", file_path)
            logger.info("File filter: %s", file_filter)
            logger.info("Agent ID: %s", agent_id)
            logger.info("Agent flows: %s", agent_flows)
            logger.info("Import type: %s", import_type)
            logger.info("Import format: %s", import_format)
            logger.info("Primary key: %s", primary_key)
            logger.info("Update existing: %s", update_existing)
            logger.info("Import unknown: %s", import_unknown)
            logger.info("Dry run: %s", dry_run)
            logger.info("Column mapping: %s", column_mapping)
            logger.info("Profile ID: %s", profile_id)

            if import_type not in _ENDPOINT_MAP:
                return {
                    "success": False,
                    "error": "Unsupported import type '%s'. Must be one of: %s"
                    % (import_type, list(_ENDPOINT_MAP.keys())),
                }

            task_context.update_state(
                state="PROGRESS",
                meta={"current": 0, "total": 100, "status": "Collecting CSV data..."},
            )

            created: list[dict] = []
            updated: list[dict] = []
            skipped: list[dict] = []
            failures: list[dict] = []

            if source == "agent":
                sources = self._fetch_agent_sources(
                    agent_id or "", agent_flows or [], failures
                )
            else:
                sources, fatal_error = self._collect_git_sources(
                    repo_id, file_path, file_filter, failures
                )
                if fatal_error:
                    return {"success": False, "error": fatal_error}

            if not sources:
                return {
                    "success": False,
                    "error": "No CSV data to process",
                    "failures": failures,
                }

            defaults = self._profile_defaults(profile_id, import_type)

            primary_key = primary_key.strip().lstrip("﻿").strip()

            col_map = column_mapping or {}

            inverse_map: dict[str, str] = {}
            for csv_col, nb_field in col_map.items():
                if nb_field is not None:
                    inverse_map[nb_field] = csv_col
            pk_csv_col = inverse_map.get(primary_key, primary_key)
            logger.info(
                "Primary key '%s' resolved to CSV column '%s' (inverse_map=%s)",
                primary_key,
                pk_csv_col,
                inverse_map,
            )

            nautobot_service = service_factory.build_nautobot_service()
            device_creation_service = DeviceCreationService()
            device_update_service = DeviceUpdateService(nautobot_service)
            total_files = len(sources)

            ctx = ImportContext(
                nautobot_service=nautobot_service,
                device_creation_service=device_creation_service,
                device_update_service=device_update_service,
                created=created,
                updated=updated,
                skipped=skipped,
                failures=failures,
                dry_run=dry_run,
                add_prefixes=add_prefixes,
                default_prefix_length=default_prefix_length,
            )

            for file_idx, (fp, content) in enumerate(sources, 1):
                logger.info("Processing source %s/%s: %s", file_idx, total_files, fp)

                task_context.update_state(
                    state="PROGRESS",
                    meta={
                        "current": int((file_idx - 1) / total_files * 90),
                        "total": 100,
                        "status": "Parsing source %s/%s: %s"
                        % (file_idx, total_files, fp),
                    },
                )

                try:
                    reader = csv.DictReader(
                        io.StringIO(content),
                        delimiter=delimiter,
                        quotechar=quote_char,
                    )
                    rows = list(reader)
                except Exception as e:
                    failures.append(
                        {"file": fp, "error": "Failed to parse CSV: %s" % str(e)}
                    )
                    continue

                if not rows:
                    logger.warning("File %s is empty or has no data rows, skipping", fp)
                    skipped.append({"file": fp, "reason": "Empty or no data rows"})
                    continue

                csv_headers = list(rows[0].keys())
                logger.info(
                    "File %s: headers=%s rows=%s format=%s",
                    fp,
                    csv_headers,
                    len(rows),
                    import_format,
                )

                if pk_csv_col not in csv_headers:
                    failures.append(
                        {
                            "file": fp,
                            "error": (
                                "Primary key column '%s' not found in CSV headers. "
                                "Available headers: %s" % (pk_csv_col, csv_headers)
                            ),
                        }
                    )
                    continue

                if import_format == "cockpit":
                    self._process_cockpit_rows(
                        ctx=ctx,
                        rows=rows,
                        pk_csv_col=pk_csv_col,
                        col_map=col_map,
                        defaults=defaults,
                        import_type=import_type,
                        primary_key=primary_key,
                        update_existing=update_existing,
                        import_unknown=import_unknown,
                        fp=fp,
                        file_idx=file_idx,
                        total_files=total_files,
                        task_context=task_context,
                    )
                else:
                    total_rows = len(rows)
                    for idx, raw_row in enumerate(rows, 1):
                        if import_format == "nautobot":
                            raw_row = self._filter_nautobot_nulls(raw_row)

                        pk_value = raw_row.get(pk_csv_col, "").strip()
                        identifier = pk_value or "row-%s" % idx

                        try:
                            progress = int((file_idx - 1) / total_files * 90) + int(
                                (idx / total_rows) * (90 / total_files)
                            )
                            task_context.update_state(
                                state="PROGRESS",
                                meta={
                                    "current": progress,
                                    "total": 100,
                                    "status": "File %s/%s: row %s/%s: %s"
                                    % (
                                        file_idx,
                                        total_files,
                                        idx,
                                        total_rows,
                                        identifier,
                                    ),
                                    "created": len(created),
                                    "updated": len(updated),
                                    "skipped": len(skipped),
                                    "failures": len(failures),
                                },
                            )

                            if not pk_value:
                                logger.warning(
                                    "File %s row %s: empty primary key value, skipping",
                                    fp,
                                    idx,
                                )
                                skipped.append(
                                    {
                                        "file": fp,
                                        "row": idx,
                                        "reason": "Empty primary key value",
                                    }
                                )
                                continue

                            csv_data = self._apply_column_mapping(raw_row, col_map)
                            nautobot_data = self._merge_defaults(csv_data, defaults)

                            existing_id = asyncio.run(
                                self._lookup_object(
                                    nautobot_service,
                                    import_type,
                                    primary_key,
                                    pk_value,
                                    raw_row,
                                    col_map,
                                )
                            )

                            self._process_single_object(
                                ctx=ctx,
                                nautobot_data=nautobot_data,
                                existing_id=existing_id,
                                import_type=import_type,
                                update_existing=update_existing,
                                import_unknown=import_unknown,
                                fp=fp,
                                idx=idx,
                                identifier=identifier,
                            )

                        except Exception as e:
                            error_msg = str(e)
                            logger.error(
                                "File %s row %s (%s) failed: %s",
                                fp,
                                idx,
                                identifier,
                                error_msg,
                                exc_info=True,
                            )
                            failures.append(
                                {
                                    "file": fp,
                                    "row": idx,
                                    "identifier": identifier,
                                    "error": error_msg,
                                }
                            )

            task_context.update_state(
                state="PROGRESS",
                meta={"current": 95, "total": 100, "status": "Finalizing results..."},
            )

            logger.info("Import complete:")
            logger.info("  Files processed: %s", total_files)
            logger.info("  Created:  %s", len(created))
            logger.info("  Updated:  %s", len(updated))
            logger.info("  Skipped:  %s", len(skipped))
            logger.info("  Failures: %s", len(failures))
            logger.info("=" * 80)

            result = {
                "success": True,
                "dry_run": dry_run,
                "import_type": import_type,
                "summary": {
                    "files_processed": total_files,
                    "total": len(created) + len(updated) + len(skipped) + len(failures),
                    "created": len(created),
                    "updated": len(updated),
                    "skipped": len(skipped),
                    "failed": len(failures),
                },
                "created": created,
                "updated": updated,
                "skipped": skipped,
                "failures": failures,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

            try:
                _jrs = service_factory.build_job_run_service()
                job_run = _jrs.get_job_run_by_celery_id(task_context.request.id)
                if job_run:
                    _jrs.mark_completed(job_run["id"], result=result)
            except Exception as job_error:
                logger.warning("Failed to update job run status: %s", job_error)

            return result

        except Exception as e:
            error_msg = "CSV import task failed: %s" % str(e)
            logger.error(error_msg, exc_info=True)

            error_result = {"success": False, "error": error_msg}

            try:
                _jrs = service_factory.build_job_run_service()
                job_run = _jrs.get_job_run_by_celery_id(task_context.request.id)
                if job_run:
                    _jrs.mark_failed(job_run["id"], error_msg)
            except Exception as job_error:
                logger.warning("Failed to update job run status: %s", job_error)

            return error_result

    def _process_single_object(
        self,
        ctx: ImportContext,
        nautobot_data: dict[str, Any],
        existing_id: str | None,
        import_type: str,
        update_existing: bool,
        import_unknown: bool,
        fp: str,
        idx: int,
        identifier: str,
        iface_config: list[dict] | None = None,
    ) -> None:
        """Create or update a single Nautobot object based on whether it already exists."""
        if import_type == "devices":
            if iface_config is None:
                nautobot_data, iface_config = self._extract_interface_config(
                    nautobot_data
                )

            if ctx.add_prefixes and ctx.default_prefix_length:
                iface_config = self._apply_default_prefix_length(
                    iface_config, ctx.default_prefix_length
                )

            if existing_id:
                if not update_existing:
                    logger.info(
                        "File %s row %s: %s already exists, skipping",
                        fp,
                        idx,
                        identifier,
                    )
                    ctx.skipped.append(
                        {
                            "file": fp,
                            "row": idx,
                            "identifier": identifier,
                            "id": existing_id,
                            "reason": "Already exists",
                        }
                    )
                    return

                if ctx.dry_run:
                    logger.info("[DRY RUN] Would update device %s", identifier)
                    ctx.updated.append(
                        {
                            "file": fp,
                            "row": idx,
                            "identifier": identifier,
                            "id": existing_id,
                            "dry_run": True,
                        }
                    )
                else:
                    asyncio.run(
                        ctx.device_update_service.update_device(
                            device_identifier={"id": existing_id},
                            update_data=nautobot_data,
                            interfaces=iface_config,
                            add_prefix=ctx.add_prefixes,
                        )
                    )
                    logger.info("Updated device %s", identifier)
                    ctx.updated.append(
                        {
                            "file": fp,
                            "row": idx,
                            "identifier": identifier,
                            "id": existing_id,
                            "updated_fields": list(nautobot_data.keys()),
                        }
                    )
            else:
                if not import_unknown:
                    logger.info(
                        "File %s row %s: %s not found in Nautobot, "
                        "skipping (import unknown disabled)",
                        fp,
                        idx,
                        identifier,
                    )
                    ctx.skipped.append(
                        {
                            "file": fp,
                            "row": idx,
                            "identifier": identifier,
                            "reason": "Unknown object (import unknown disabled)",
                        }
                    )
                    return

                if ctx.dry_run:
                    logger.info("[DRY RUN] Would create device %s", identifier)
                    ctx.created.append(
                        {
                            "file": fp,
                            "row": idx,
                            "identifier": identifier,
                            "dry_run": True,
                        }
                    )
                else:
                    self._create_device(
                        ctx, nautobot_data, iface_config, fp, idx, identifier
                    )
        else:
            if existing_id:
                if not update_existing:
                    logger.info(
                        "File %s row %s: %s already exists, skipping",
                        fp,
                        idx,
                        identifier,
                    )
                    ctx.skipped.append(
                        {
                            "file": fp,
                            "row": idx,
                            "identifier": identifier,
                            "id": existing_id,
                            "reason": "Already exists",
                        }
                    )
                    return

                if ctx.dry_run:
                    logger.info("[DRY RUN] Would update %s %s", import_type, identifier)
                    ctx.updated.append(
                        {
                            "file": fp,
                            "row": idx,
                            "identifier": identifier,
                            "id": existing_id,
                            "dry_run": True,
                        }
                    )
                else:
                    endpoint = "%s%s/" % (_ENDPOINT_MAP[import_type], existing_id)
                    asyncio.run(
                        ctx.nautobot_service.rest_request(
                            endpoint, method="PATCH", data=nautobot_data
                        )
                    )
                    logger.info("Updated %s %s", import_type, identifier)
                    ctx.updated.append(
                        {
                            "file": fp,
                            "row": idx,
                            "identifier": identifier,
                            "id": existing_id,
                            "updated_fields": list(nautobot_data.keys()),
                        }
                    )
            else:
                if not import_unknown:
                    logger.info(
                        "File %s row %s: %s not found in Nautobot, "
                        "skipping (import unknown disabled)",
                        fp,
                        idx,
                        identifier,
                    )
                    ctx.skipped.append(
                        {
                            "file": fp,
                            "row": idx,
                            "identifier": identifier,
                            "reason": "Unknown object (import unknown disabled)",
                        }
                    )
                    return

                if ctx.dry_run:
                    logger.info("[DRY RUN] Would create %s %s", import_type, identifier)
                    ctx.created.append(
                        {
                            "file": fp,
                            "row": idx,
                            "identifier": identifier,
                            "dry_run": True,
                        }
                    )
                else:
                    result = asyncio.run(
                        ctx.nautobot_service.rest_request(
                            _ENDPOINT_MAP[import_type],
                            method="POST",
                            data=nautobot_data,
                        )
                    )
                    new_id = result.get("id") if isinstance(result, dict) else None
                    logger.info(
                        "Created %s %s (id=%s)", import_type, identifier, new_id
                    )
                    ctx.created.append(
                        {"file": fp, "row": idx, "identifier": identifier, "id": new_id}
                    )

    def _process_cockpit_rows(
        self,
        ctx: ImportContext,
        rows: list[dict[str, str]],
        pk_csv_col: str,
        col_map: dict[str, str | None],
        defaults: dict[str, str] | None,
        import_type: str,
        primary_key: str,
        update_existing: bool,
        import_unknown: bool,
        fp: str,
        file_idx: int,
        total_files: int,
        task_context,
    ) -> None:
        """Process Cockpit-format CSV rows (multiple rows per device, one per interface)."""
        from collections import OrderedDict

        groups: OrderedDict[str, list[dict[str, str]]] = OrderedDict()
        for row in rows:
            pk_val = row.get(pk_csv_col, "").strip()
            if pk_val:
                groups.setdefault(pk_val, []).append(row)

        total_devices = len(groups)
        for dev_idx, (pk_value, device_rows) in enumerate(groups.items(), 1):
            identifier = pk_value
            try:
                progress = int((file_idx - 1) / total_files * 90) + int(
                    (dev_idx / max(total_devices, 1)) * (90 / total_files)
                )
                task_context.update_state(
                    state="PROGRESS",
                    meta={
                        "current": progress,
                        "total": 100,
                        "status": "File %s/%s: device %s/%s: %s"
                        % (file_idx, total_files, dev_idx, total_devices, identifier),
                        "created": len(ctx.created),
                        "updated": len(ctx.updated),
                        "skipped": len(ctx.skipped),
                        "failures": len(ctx.failures),
                    },
                )

                first_row = device_rows[0]
                csv_data = self._apply_column_mapping(first_row, col_map)
                device_data_merged = self._merge_defaults(csv_data, defaults)

                device_only_data, _ = self._extract_interface_config(device_data_merged)

                iface_list: list[dict[str, Any]] = []
                for row in device_rows:
                    row_data = self._merge_defaults(
                        self._apply_column_mapping(row, col_map), defaults
                    )
                    _, iface = self._extract_interface_config(row_data)
                    if iface:
                        iface_entry = iface[0].copy()
                        set_primary = row.get("set_primary_ipv4", "").strip().lower()
                        if "ip_address" in iface_entry:
                            iface_entry["is_primary_ipv4"] = set_primary == "true"
                        iface_list.append(iface_entry)

                iface_config = iface_list if iface_list else None

                existing_id = asyncio.run(
                    self._lookup_object(
                        ctx.nautobot_service,
                        import_type,
                        primary_key,
                        pk_value,
                        first_row,
                        col_map,
                    )
                )

                self._process_single_object(
                    ctx=ctx,
                    nautobot_data=device_only_data,
                    existing_id=existing_id,
                    import_type=import_type,
                    update_existing=update_existing,
                    import_unknown=import_unknown,
                    fp=fp,
                    idx=dev_idx,
                    identifier=identifier,
                    iface_config=iface_config,
                )

            except Exception as e:
                error_msg = str(e)
                logger.error(
                    "File %s device %s (%s) failed: %s",
                    fp,
                    dev_idx,
                    identifier,
                    error_msg,
                    exc_info=True,
                )
                ctx.failures.append(
                    {
                        "file": fp,
                        "row": dev_idx,
                        "identifier": identifier,
                        "error": error_msg,
                    }
                )

    @staticmethod
    def _extract_interface_config(
        nautobot_data: dict[str, Any],
    ) -> tuple[dict[str, Any], list[dict[str, Any]] | None]:
        """Separate interface_* fields from device-level fields."""
        device_data: dict[str, Any] = {}
        iface_fields: dict[str, Any] = {}

        for key, value in nautobot_data.items():
            if not value:
                device_data[key] = value
                continue

            if key in _INTERFACE_FIELD_MAP:
                iface_fields[_INTERFACE_FIELD_MAP[key]] = value
            elif key.startswith("interface_"):
                iface_fields[key[len("interface_") :]] = value
            else:
                device_data[key] = value

        if not iface_fields or not iface_fields.get("name"):
            return nautobot_data, None

        iface: dict[str, Any] = {
            "name": iface_fields["name"],
            "type": iface_fields.get("type", "virtual"),
            "status": iface_fields.get("status", "active"),
            "enabled": True,
        }

        if iface_fields.get("description"):
            iface["description"] = iface_fields["description"]

        if iface_fields.get("ip_address"):
            iface["ip_address"] = iface_fields["ip_address"]
            iface["namespace"] = iface_fields.get("namespace", "Global")
            iface["is_primary_ipv4"] = True

        return device_data, [iface]

    @staticmethod
    def _apply_column_mapping(
        row: dict[str, str], col_map: dict[str, str | None]
    ) -> dict[str, Any]:
        """Build Nautobot payload from a CSV row by applying column_mapping."""
        nautobot_data: dict[str, Any] = {}
        custom_fields: dict[str, Any] = {}

        for csv_col, value in row.items():
            if csv_col in col_map:
                nb_field = col_map[csv_col]
                if nb_field is None:
                    continue
            else:
                nb_field = csv_col

            if nb_field.startswith("cf_"):
                cf_key = nb_field[3:]
                custom_fields[cf_key] = value
            else:
                nautobot_data[nb_field] = value

        if custom_fields:
            nautobot_data["custom_fields"] = custom_fields

        return nautobot_data

    @staticmethod
    def _filter_nautobot_nulls(row: dict[str, str]) -> dict[str, str]:
        """Remove Nautobot export sentinel values (NULL, NoObject) from a CSV row."""
        return {k: v for k, v in row.items() if v not in _NAUTOBOT_NULL_SENTINELS}

    @staticmethod
    def _apply_default_prefix_length(
        iface_config: list[dict[str, Any]] | None,
        default_prefix_length: str | None,
    ) -> list[dict[str, Any]] | None:
        """Append default_prefix_length to interface IP addresses that have no CIDR mask."""
        if not iface_config or not default_prefix_length:
            return iface_config

        suffix = "/%s" % default_prefix_length.lstrip("/")
        patched = []
        for iface in iface_config:
            iface = iface.copy()
            if "ip_addresses" in iface:
                iface["ip_addresses"] = [
                    {**ip, "address": ip["address"] + suffix}
                    if ip.get("address") and "/" not in ip["address"]
                    else ip
                    for ip in iface["ip_addresses"]
                ]
            elif (
                "ip_address" in iface
                and iface["ip_address"]
                and "/" not in iface["ip_address"]
            ):
                iface["ip_address"] = iface["ip_address"] + suffix
            patched.append(iface)
        return patched

    @staticmethod
    def _collect_git_sources(
        repo_id: int | None,
        file_path: str,
        file_filter: str | None,
        failures: list[dict],
    ) -> tuple[list[tuple[str, str]], str | None]:
        """Read CSV file contents from a Git repository.

        Returns (sources, fatal_error) where sources is a list of
        (relative_path, file_content) tuples. Per-file problems are recorded
        in failures; fatal_error is set only when nothing can be processed.
        """
        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            return [], "Repository not found: %s" % repo_id

        repo_dir = str(git_repo_path(repository))
        if not os.path.exists(repo_dir):
            return [], "Repository directory not found: %s" % repo_dir

        repo_dir_resolved = os.path.realpath(repo_dir)

        if file_filter and file_filter.strip():
            files_to_process = []
            for root, dirs, files in os.walk(repo_dir_resolved):
                dirs[:] = [d for d in dirs if d != ".git"]
                for f in files:
                    rel = os.path.relpath(os.path.join(root, f), repo_dir_resolved)
                    if fnmatch.fnmatch(f, file_filter) or fnmatch.fnmatch(
                        rel, file_filter
                    ):
                        files_to_process.append(rel)
            files_to_process.sort()
            if not files_to_process:
                return [], "No files matched filter '%s'" % file_filter
            logger.info(
                "File filter '%s' matched %s file(s): %s",
                file_filter,
                len(files_to_process),
                files_to_process,
            )
        else:
            files_to_process = [file_path]

        sources: list[tuple[str, str]] = []
        for fp in files_to_process:
            abs_file = os.path.join(repo_dir_resolved, fp)
            abs_file_resolved = os.path.realpath(abs_file)

            if not abs_file_resolved.startswith(repo_dir_resolved):
                logger.error("Security error: file path is outside repository: %s", fp)
                failures.append(
                    {
                        "file": fp,
                        "error": "Security error: file path is outside repository",
                    }
                )
                continue

            if not os.path.exists(abs_file_resolved):
                logger.error("CSV file not found: %s", fp)
                failures.append({"file": fp, "error": "CSV file not found: %s" % fp})
                continue

            try:
                with open(abs_file_resolved, encoding="utf-8-sig") as f:
                    sources.append((fp, f.read()))
            except UnicodeDecodeError:
                failures.append(
                    {
                        "file": fp,
                        "error": "File is not a valid UTF-8 text file: %s" % fp,
                    }
                )
        return sources, None

    @staticmethod
    def _fetch_agent_sources(
        agent_id: str,
        flow_ids: list[str],
        failures: list[dict],
    ) -> list[tuple[str, str]]:
        """Fetch CSV text blocks from a Get Data agent.

        Each flow returns a result dict of key → CSV text; every non-empty key
        becomes its own source named "flow::key" and is parsed independently
        with the configured delimiter/quote settings.
        """
        from core.database import SessionLocal
        from services.cockpit_agent.cockpit_agent_service import CockpitAgentService

        sources: list[tuple[str, str]] = []
        db = SessionLocal()
        try:
            service = CockpitAgentService(db)
            for flow_id in flow_ids:
                response = service.send_get_data(
                    agent_id=agent_id,
                    flow_id=flow_id,
                    sent_by="scheduler",
                )
                if response.get("status") != "success":
                    failures.append(
                        {
                            "file": "%s::%s" % (agent_id, flow_id),
                            "error": response.get("error") or "Agent returned no data",
                        }
                    )
                    continue

                output = response.get("output") or {}
                result = output.get("result") or {}
                if not result:
                    failures.append(
                        {
                            "file": "%s::%s" % (agent_id, flow_id),
                            "error": "Agent flow returned an empty result",
                        }
                    )
                    continue

                for key, text in result.items():
                    if text and str(text).strip():
                        sources.append(("%s::%s" % (flow_id, key), str(text)))
                    else:
                        failures.append(
                            {
                                "file": "%s::%s" % (flow_id, key),
                                "error": "Agent key returned no data",
                            }
                        )
        finally:
            db.close()
        return sources

    @staticmethod
    def _profile_defaults(profile_id: int | None, import_type: str) -> dict[str, str]:
        """Resolve a profile's field values into fill-in defaults for the import type."""
        if not profile_id:
            return {}

        from services.settings.profile_service import ProfileService

        profile = ProfileService().get(profile_id)
        if not profile:
            logger.warning("Profile %s not found; no defaults applied", profile_id)
            return {}

        field_map = _PROFILE_FIELD_MAP.get(import_type, {})
        defaults = {
            target: profile[key]
            for key, target in field_map.items()
            if profile.get(key)
        }
        logger.info("Profile %s (%s) defaults: %s", profile_id, import_type, defaults)
        return defaults

    @staticmethod
    def _merge_defaults(
        csv_data: dict[str, Any], defaults: dict[str, str] | None
    ) -> dict[str, Any]:
        """Fill fields the CSV left blank with default values (the CSV value wins)."""
        if not defaults:
            return csv_data
        merged = dict(csv_data)
        for key, value in defaults.items():
            if value and not merged.get(key):
                merged[key] = value
        return merged

    def _create_device(
        self,
        ctx: ImportContext,
        nautobot_data: dict[str, Any],
        iface_config: list[dict[str, Any]] | None,
        fp: str,
        idx: int,
        identifier: str,
    ) -> None:
        """Create a device via DeviceCreationService — the same code path as the
        Add Device form and the CSV Updates tool's "Add Missing Devices"."""
        missing = [f for f in _DEVICE_REQUIRED_FIELDS if not nautobot_data.get(f)]
        if missing:
            logger.info(
                "File %s row %s: cannot create %s, missing field(s): %s",
                fp,
                idx,
                identifier,
                missing,
            )
            ctx.skipped.append(
                {
                    "file": fp,
                    "row": idx,
                    "identifier": identifier,
                    "reason": "Missing required field(s) for creation: %s"
                    % ", ".join(missing),
                }
            )
            return

        request = self._build_add_device_request(ctx, nautobot_data, iface_config)
        result = asyncio.run(
            ctx.device_creation_service.create_device_with_interfaces(request)
        )
        if not result.get("success"):
            ctx.failures.append(
                {
                    "file": fp,
                    "row": idx,
                    "identifier": identifier,
                    "error": result.get("error") or "Device creation failed",
                }
            )
            return

        new_id = result.get("device_id")
        logger.info("Created device %s (id=%s)", identifier, new_id)
        ctx.created.append(
            {"file": fp, "row": idx, "identifier": identifier, "id": new_id}
        )

    @staticmethod
    def _build_add_device_request(
        ctx: ImportContext,
        nautobot_data: dict[str, Any],
        iface_config: list[dict[str, Any]] | None,
    ) -> AddDeviceRequest:
        """Translate CSV-derived device data into an AddDeviceRequest."""
        device_fields = {
            key: nautobot_data[key]
            for key in _DEVICE_CREATE_FIELDS
            if nautobot_data.get(key)
        }

        dropped = [
            key
            for key in nautobot_data
            if key not in _DEVICE_CREATE_FIELDS
            and key not in ("tags", "custom_fields")
            and nautobot_data.get(key)
        ]
        if dropped:
            logger.warning("Device creation ignores unsupported field(s): %s", dropped)

        tags_value = nautobot_data.get("tags")
        if isinstance(tags_value, str):
            tags = [t.strip() for t in tags_value.split(",") if t.strip()] or None
        elif isinstance(tags_value, list):
            tags = tags_value or None
        else:
            tags = None

        interfaces: list[InterfaceData] = []
        for iface in iface_config or []:
            ip_addresses = []
            if iface.get("ip_address"):
                ip_addresses.append(
                    IpAddressData(
                        address=iface["ip_address"],
                        namespace=iface.get("namespace") or "Global",
                        is_primary=bool(iface.get("is_primary_ipv4")),
                    )
                )
            interfaces.append(
                InterfaceData(
                    name=iface.get("name"),
                    type=iface.get("type"),
                    status=iface.get("status"),
                    enabled=iface.get("enabled", True),
                    description=iface.get("description"),
                    ip_addresses=ip_addresses,
                )
            )

        prefix_length = (ctx.default_prefix_length or "24").lstrip("/")

        return AddDeviceRequest(
            **device_fields,
            tags=tags,
            custom_fields=nautobot_data.get("custom_fields"),
            interfaces=interfaces,
            add_prefix=ctx.add_prefixes,
            default_prefix_length="/%s" % prefix_length,
            dry_run=False,
        )

    async def _lookup_object(
        self,
        nautobot_service: NautobotService,
        import_type: str,
        primary_key: str,
        pk_value: str,
        row: dict[str, str],
        col_map: dict[str, str | None],
    ) -> str | None:
        """Look up an existing Nautobot object by primary key value."""
        try:
            if import_type == "devices":
                result = await nautobot_service.graphql_query(
                    _GRAPHQL_QUERY_DEVICES, {"name": [pk_value]}
                )
                devices = result.get("data", {}).get("devices", [])
                if devices:
                    return devices[0]["id"]
                return None

            elif import_type == "ip-prefixes":
                namespace_col = col_map.get("namespace", "namespace") or "namespace"
                for csv_col, nb_field in col_map.items():
                    if nb_field == "namespace":
                        namespace_col = csv_col
                        break
                namespace_value = row.get(namespace_col, "Global").strip() or "Global"

                result = await nautobot_service.graphql_query(
                    _GRAPHQL_QUERY_PREFIXES,
                    {"prefix": [pk_value], "namespace": [namespace_value]},
                )
                prefixes = result.get("data", {}).get("prefixes", [])
                if prefixes:
                    return prefixes[0]["id"]
                return None

            elif import_type == "ip-addresses":
                result = await nautobot_service.graphql_query(
                    _GRAPHQL_QUERY_IP_ADDRESSES, {"address": [pk_value]}
                )
                addresses = result.get("data", {}).get("ip_addresses", [])
                if addresses:
                    return addresses[0]["id"]
                return None

        except Exception as e:
            logger.warning("Lookup failed for %s '%s': %s", import_type, pk_value, e)
            return None
