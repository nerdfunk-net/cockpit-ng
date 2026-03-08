"""
Celery task for importing or updating Nautobot objects from a CSV file in a Git repository.

Supports three import types: devices, ip-prefixes, ip-addresses.
For each row the task:
1. Applies optional column_mapping (CSV col → Nautobot field; null = skip)
2. Looks up the object in Nautobot by the configured primary_key column
3. If not found: creates the object (POST)
4. If found and update_existing=True: updates the object (PATCH)
5. If found and update_existing=False: skips the object

The CSV source is a file on the local filesystem from a cloned Git repository.
"""

import asyncio
import csv
import fnmatch
import io
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import service_factory
from celery_app import celery_app
from services.nautobot import NautobotService
from services.nautobot.devices.import_service import DeviceImportService
from services.nautobot.devices.update import DeviceUpdateService
from services.settings.git.paths import repo_path as git_repo_path
from services.settings.git.shared_utils import git_repo_manager

logger = logging.getLogger(__name__)

# Nautobot REST endpoints per import type
_ENDPOINT_MAP = {
    "devices": "dcim/devices/",
    "ip-prefixes": "ipam/prefixes/",
    "ip-addresses": "ipam/ip-addresses/",
}

# GraphQL lookup queries per import type
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


@celery_app.task(name="tasks.import_or_update_from_csv", bind=True)
def import_or_update_from_csv_task(
    self,
    repo_id: int,
    file_path: str,
    import_type: str,
    primary_key: str,
    update_existing: bool = True,
    delimiter: str = ",",
    quote_char: str = '"',
    column_mapping: Optional[Dict[str, Optional[str]]] = None,
    dry_run: bool = False,
    template_id: Optional[int] = None,
    file_filter: Optional[str] = None,
    defaults: Optional[Dict[str, str]] = None,
    import_format: str = "generic",
    add_prefixes: bool = False,
    default_prefix_length: Optional[str] = None,
) -> dict:
    """Celery task wrapper — delegates to _run_csv_import."""
    return _run_csv_import(
        task_context=self,
        repo_id=repo_id,
        file_path=file_path,
        import_type=import_type,
        primary_key=primary_key,
        update_existing=update_existing,
        delimiter=delimiter,
        quote_char=quote_char,
        column_mapping=column_mapping,
        dry_run=dry_run,
        template_id=template_id,
        file_filter=file_filter,
        defaults=defaults,
        import_format=import_format,
        add_prefixes=add_prefixes,
        default_prefix_length=default_prefix_length,
    )


def _run_csv_import(
    task_context,
    repo_id: int,
    file_path: str,
    import_type: str,
    primary_key: str,
    update_existing: bool = True,
    delimiter: str = ",",
    quote_char: str = '"',
    column_mapping: Optional[Dict[str, Optional[str]]] = None,
    dry_run: bool = False,
    template_id: Optional[int] = None,
    file_filter: Optional[str] = None,
    defaults: Optional[Dict[str, str]] = None,
    import_format: str = "generic",
    add_prefixes: bool = False,
    default_prefix_length: Optional[str] = None,
) -> dict:
    """
    Task: Import or update Nautobot objects from a CSV file in a Git repository.

    Args:
        repo_id: Git repository ID
        file_path: Relative path to the CSV file within the repository (example/fallback file)
        import_type: Object type — "devices", "ip-prefixes", or "ip-addresses"
        primary_key: CSV column name used as the lookup key in Nautobot
        update_existing: When True update found objects, when False skip them
        delimiter: CSV field delimiter
        quote_char: CSV quote character
        column_mapping: Maps CSV column names to Nautobot field names (null = skip)
        dry_run: When True validate without writing to Nautobot
        template_id: Optional job template ID for tracking
        file_filter: Glob pattern to select multiple files (e.g. "*.csv"); overrides file_path

    Returns:
        dict with success, dry_run, summary, and failures
    """
    try:
        logger.info("=" * 80)
        logger.info("IMPORT OR UPDATE FROM CSV TASK STARTED")
        logger.info("=" * 80)
        logger.info("Repo ID: %s", repo_id)
        logger.info("File path: %s", file_path)
        logger.info("File filter: %s", file_filter)
        logger.info("Import type: %s", import_type)
        logger.info("Import format: %s", import_format)
        logger.info("Primary key: %s", primary_key)
        logger.info("Update existing: %s", update_existing)
        logger.info("Dry run: %s", dry_run)
        logger.info("Column mapping: %s", column_mapping)
        logger.info("Defaults: %s", defaults)

        task_context.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": 100, "status": "Resolving repository..."},
        )

        # STEP 1: Resolve repo path
        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            return {"success": False, "error": f"Repository not found: {repo_id}"}

        repo_dir = str(git_repo_path(repository))

        if not os.path.exists(repo_dir):
            return {
                "success": False,
                "error": f"Repository directory not found: {repo_dir}",
            }

        repo_dir_resolved = os.path.realpath(repo_dir)

        # Determine files to process
        if file_filter and file_filter.strip():
            files_to_process = []
            for root, dirs, files in os.walk(repo_dir_resolved):
                # Skip .git directory
                dirs[:] = [d for d in dirs if d != ".git"]
                for f in files:
                    rel = os.path.relpath(os.path.join(root, f), repo_dir_resolved)
                    if fnmatch.fnmatch(f, file_filter) or fnmatch.fnmatch(
                        rel, file_filter
                    ):
                        files_to_process.append(rel)
            files_to_process.sort()
            if not files_to_process:
                return {
                    "success": False,
                    "error": f"No files matched filter '{file_filter}'",
                }
            logger.info(
                "File filter '%s' matched %s file(s): %s",
                file_filter,
                len(files_to_process),
                files_to_process,
            )
        else:
            files_to_process = [file_path]

        if import_type not in _ENDPOINT_MAP:
            return {
                "success": False,
                "error": f"Unsupported import type '{import_type}'. "
                f"Must be one of: {list(_ENDPOINT_MAP.keys())}",
            }

        # Strip BOM and surrounding whitespace from primary_key (can appear when
        # the value is copy-pasted from an editor that saves with UTF-8 BOM).
        primary_key = primary_key.strip().lstrip("\ufeff").strip()

        col_map = column_mapping or {}

        # Build inverse mapping: nautobot_field -> csv_col
        inverse_map: Dict[str, str] = {}
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

        # STEP 2–4: Process each file
        nautobot_service = service_factory.build_nautobot_service()
        device_import_service = DeviceImportService(nautobot_service)
        device_update_service = DeviceUpdateService(nautobot_service)
        created: List[Dict] = []
        updated: List[Dict] = []
        skipped: List[Dict] = []
        failures: List[Dict] = []
        total_files = len(files_to_process)

        for file_idx, fp in enumerate(files_to_process, 1):
            logger.info("Processing file %s/%s: %s", file_idx, total_files, fp)

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
                failures.append({"file": fp, "error": f"CSV file not found: {fp}"})
                continue

            task_context.update_state(
                state="PROGRESS",
                meta={
                    "current": int((file_idx - 1) / total_files * 90),
                    "total": 100,
                    "status": f"Parsing file {file_idx}/{total_files}: {fp}",
                },
            )

            try:
                # utf-8-sig automatically strips a UTF-8 BOM if present
                with open(abs_file_resolved, "r", encoding="utf-8-sig") as f:
                    content = f.read()
            except UnicodeDecodeError:
                failures.append(
                    {"file": fp, "error": f"File is not a valid UTF-8 text file: {fp}"}
                )
                continue

            try:
                reader = csv.DictReader(
                    io.StringIO(content),
                    delimiter=delimiter,
                    quotechar=quote_char,
                )
                rows = list(reader)
            except Exception as e:
                failures.append({"file": fp, "error": f"Failed to parse CSV: {str(e)}"})
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
                            f"Primary key column '{pk_csv_col}' not found in CSV headers. "
                            f"Available headers: {csv_headers}"
                        ),
                    }
                )
                continue

            # Dispatch by import format
            if import_format == "cockpit":
                _process_cockpit_rows(
                    rows=rows,
                    pk_csv_col=pk_csv_col,
                    col_map=col_map,
                    defaults=defaults,
                    import_type=import_type,
                    primary_key=primary_key,
                    update_existing=update_existing,
                    dry_run=dry_run,
                    fp=fp,
                    file_idx=file_idx,
                    total_files=total_files,
                    nautobot_service=nautobot_service,
                    device_import_service=device_import_service,
                    device_update_service=device_update_service,
                    created=created,
                    updated=updated,
                    skipped=skipped,
                    failures=failures,
                    task_context=task_context,
                    add_prefixes=add_prefixes,
                    default_prefix_length=default_prefix_length,
                )
            else:
                # "nautobot" or "generic": single-row-per-object processing
                total_rows = len(rows)
                for idx, raw_row in enumerate(rows, 1):
                    if import_format == "nautobot":
                        raw_row = _filter_nautobot_nulls(raw_row)

                    pk_value = raw_row.get(pk_csv_col, "").strip()
                    identifier = pk_value or f"row-{idx}"

                    try:
                        progress = int((file_idx - 1) / total_files * 90) + int(
                            (idx / total_rows) * (90 / total_files)
                        )
                        task_context.update_state(
                            state="PROGRESS",
                            meta={
                                "current": progress,
                                "total": 100,
                                "status": f"File {file_idx}/{total_files}: row {idx}/{total_rows}: {identifier}",
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

                        csv_data = _apply_column_mapping(raw_row, col_map)
                        # Merge: defaults as base layer, CSV values always take priority
                        if defaults:
                            base = {k: v for k, v in defaults.items() if v}
                            nautobot_data = {**base, **csv_data}
                        else:
                            nautobot_data = csv_data

                        existing_id = asyncio.run(
                            _lookup_object(
                                nautobot_service,
                                import_type,
                                primary_key,
                                pk_value,
                                raw_row,
                                col_map,
                            )
                        )

                        _process_single_object(
                            nautobot_data=nautobot_data,
                            existing_id=existing_id,
                            import_type=import_type,
                            update_existing=update_existing,
                            dry_run=dry_run,
                            fp=fp,
                            idx=idx,
                            identifier=identifier,
                            nautobot_service=nautobot_service,
                            device_import_service=device_import_service,
                            device_update_service=device_update_service,
                            created=created,
                            updated=updated,
                            skipped=skipped,
                            add_prefixes=add_prefixes,
                            default_prefix_length=default_prefix_length,
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

        # STEP 5: Finalize
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

        # Update job run if tracked
        try:
            import job_run_manager

            job_run = job_run_manager.get_job_run_by_celery_id(task_context.request.id)
            if job_run:
                job_run_manager.mark_completed(job_run["id"], result=result)
        except Exception as job_error:
            logger.warning("Failed to update job run status: %s", job_error)

        return result

    except Exception as e:
        error_msg = f"CSV import task failed: {str(e)}"
        logger.error(error_msg, exc_info=True)

        error_result = {"success": False, "error": error_msg}

        try:
            import job_run_manager

            job_run = job_run_manager.get_job_run_by_celery_id(task_context.request.id)
            if job_run:
                job_run_manager.mark_failed(job_run["id"], error_msg)
        except Exception as job_error:
            logger.warning("Failed to update job run status: %s", job_error)

        return error_result


_NAUTOBOT_NULL_SENTINELS = {"NULL", "NoObject", "null", ""}


def _filter_nautobot_nulls(row: Dict[str, str]) -> Dict[str, str]:
    """Remove Nautobot export sentinel values (NULL, NoObject) from a CSV row."""
    return {k: v for k, v in row.items() if v not in _NAUTOBOT_NULL_SENTINELS}


def _apply_default_prefix_length(
    iface_config: Optional[List[Dict[str, Any]]],
    default_prefix_length: Optional[str],
) -> Optional[List[Dict[str, Any]]]:
    """
    Append default_prefix_length to interface IP addresses that have no CIDR mask.

    E.g. "192.168.1.1" + "24" → "192.168.1.1/24"
    Addresses that already contain "/" are left unchanged.
    """
    if not iface_config or not default_prefix_length:
        return iface_config

    suffix = f"/{default_prefix_length.lstrip('/')}"
    patched = []
    for iface in iface_config:
        iface = iface.copy()
        # ip_addresses array format (used after normalization)
        if "ip_addresses" in iface:
            iface["ip_addresses"] = [
                {**ip, "address": ip["address"] + suffix}
                if ip.get("address") and "/" not in ip["address"]
                else ip
                for ip in iface["ip_addresses"]
            ]
        # ip_address string format (pre-normalization)
        elif (
            "ip_address" in iface
            and iface["ip_address"]
            and "/" not in iface["ip_address"]
        ):
            iface["ip_address"] = iface["ip_address"] + suffix
        patched.append(iface)
    return patched


def _process_single_object(
    nautobot_data: Dict[str, Any],
    existing_id: Optional[str],
    import_type: str,
    update_existing: bool,
    dry_run: bool,
    fp: str,
    idx: int,
    identifier: str,
    nautobot_service,
    device_import_service,
    device_update_service,
    created: List[Dict],
    updated: List[Dict],
    skipped: List[Dict],
    iface_config: Optional[List[Dict]] = None,
    add_prefixes: bool = False,
    default_prefix_length: Optional[str] = None,
) -> None:
    """Create or update a single Nautobot object based on whether it already exists."""
    if import_type == "devices":
        # Route through DeviceImportService / DeviceUpdateService so that
        # human-readable names (device_type, location, role, status, tags, …)
        # are resolved to UUIDs before the REST call.
        if iface_config is None:
            nautobot_data, iface_config = _extract_interface_config(nautobot_data)

        # Apply default prefix length to IPs that have no CIDR mask
        if add_prefixes and default_prefix_length:
            iface_config = _apply_default_prefix_length(
                iface_config, default_prefix_length
            )

        if existing_id:
            if not update_existing:
                logger.info(
                    "File %s row %s: %s already exists, skipping", fp, idx, identifier
                )
                skipped.append(
                    {
                        "file": fp,
                        "row": idx,
                        "identifier": identifier,
                        "id": existing_id,
                        "reason": "Already exists",
                    }
                )
                return

            if dry_run:
                logger.info("[DRY RUN] Would update device %s", identifier)
                updated.append(
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
                    device_update_service.update_device(
                        device_identifier={"id": existing_id},
                        update_data=nautobot_data,
                        interfaces=iface_config,
                        add_prefix=add_prefixes,
                    )
                )
                logger.info("Updated device %s", identifier)
                updated.append(
                    {
                        "file": fp,
                        "row": idx,
                        "identifier": identifier,
                        "id": existing_id,
                        "updated_fields": list(nautobot_data.keys()),
                    }
                )
        else:
            if dry_run:
                logger.info("[DRY RUN] Would create device %s", identifier)
                created.append(
                    {"file": fp, "row": idx, "identifier": identifier, "dry_run": True}
                )
            else:
                result = asyncio.run(
                    device_import_service.import_device(
                        nautobot_data,
                        interface_config=iface_config,
                        add_prefixes_automatically=add_prefixes,
                    )
                )
                new_id = result.get("device_id")
                logger.info("Created device %s (id=%s)", identifier, new_id)
                created.append(
                    {"file": fp, "row": idx, "identifier": identifier, "id": new_id}
                )
    else:
        # For ip-prefixes and ip-addresses use direct REST (no complex
        # name resolution needed for these types).
        if existing_id:
            if not update_existing:
                logger.info(
                    "File %s row %s: %s already exists, skipping", fp, idx, identifier
                )
                skipped.append(
                    {
                        "file": fp,
                        "row": idx,
                        "identifier": identifier,
                        "id": existing_id,
                        "reason": "Already exists",
                    }
                )
                return

            if dry_run:
                logger.info("[DRY RUN] Would update %s %s", import_type, identifier)
                updated.append(
                    {
                        "file": fp,
                        "row": idx,
                        "identifier": identifier,
                        "id": existing_id,
                        "dry_run": True,
                    }
                )
            else:
                endpoint = f"{_ENDPOINT_MAP[import_type]}{existing_id}/"
                asyncio.run(
                    nautobot_service.rest_request(
                        endpoint, method="PATCH", data=nautobot_data
                    )
                )
                logger.info("Updated %s %s", import_type, identifier)
                updated.append(
                    {
                        "file": fp,
                        "row": idx,
                        "identifier": identifier,
                        "id": existing_id,
                        "updated_fields": list(nautobot_data.keys()),
                    }
                )
        else:
            if dry_run:
                logger.info("[DRY RUN] Would create %s %s", import_type, identifier)
                created.append(
                    {"file": fp, "row": idx, "identifier": identifier, "dry_run": True}
                )
            else:
                result = asyncio.run(
                    nautobot_service.rest_request(
                        _ENDPOINT_MAP[import_type], method="POST", data=nautobot_data
                    )
                )
                new_id = result.get("id") if isinstance(result, dict) else None
                logger.info("Created %s %s (id=%s)", import_type, identifier, new_id)
                created.append(
                    {"file": fp, "row": idx, "identifier": identifier, "id": new_id}
                )


def _process_cockpit_rows(
    rows: List[Dict[str, str]],
    pk_csv_col: str,
    col_map: Dict[str, Optional[str]],
    defaults: Optional[Dict[str, str]],
    import_type: str,
    primary_key: str,
    update_existing: bool,
    dry_run: bool,
    fp: str,
    file_idx: int,
    total_files: int,
    nautobot_service,
    device_import_service,
    device_update_service,
    created: List[Dict],
    updated: List[Dict],
    skipped: List[Dict],
    failures: List[Dict],
    task_context,
    add_prefixes: bool = False,
    default_prefix_length: Optional[str] = None,
) -> None:
    """
    Process Cockpit-format CSV rows where multiple rows represent one device
    (one row per interface). Groups rows by primary key, collects all interface
    rows, and respects the set_primary_ipv4 column.
    """
    from collections import OrderedDict

    # Group rows by pk value, preserving insertion order
    groups: "OrderedDict[str, List[Dict[str, str]]]" = OrderedDict()
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
                    "status": f"File {file_idx}/{total_files}: device {dev_idx}/{total_devices}: {identifier}",
                    "created": len(created),
                    "updated": len(updated),
                    "skipped": len(skipped),
                    "failures": len(failures),
                },
            )

            # Device-level fields from the first row
            first_row = device_rows[0]
            csv_data = _apply_column_mapping(first_row, col_map)
            if defaults:
                base = {k: v for k, v in defaults.items() if v}
                device_data_merged = {**base, **csv_data}
            else:
                device_data_merged = csv_data

            # Strip interface_ fields from device data; collect interfaces from all rows
            device_only_data, _ = _extract_interface_config(device_data_merged)

            iface_list: List[Dict[str, Any]] = []
            for row in device_rows:
                row_data = _apply_column_mapping(row, col_map)
                _, iface = _extract_interface_config(row_data)
                if iface:
                    iface_entry = iface[0].copy()
                    # set_primary_ipv4 column overrides the default is_primary_ipv4=True
                    # that _extract_interface_config sets when an IP is present.
                    set_primary = row.get("set_primary_ipv4", "").strip().lower()
                    if "ip_address" in iface_entry:
                        iface_entry["is_primary_ipv4"] = set_primary == "true"
                    iface_list.append(iface_entry)

            iface_config = iface_list if iface_list else None

            existing_id = asyncio.run(
                _lookup_object(
                    nautobot_service,
                    import_type,
                    primary_key,
                    pk_value,
                    first_row,
                    col_map,
                )
            )

            _process_single_object(
                nautobot_data=device_only_data,
                existing_id=existing_id,
                import_type=import_type,
                update_existing=update_existing,
                dry_run=dry_run,
                fp=fp,
                idx=dev_idx,
                identifier=identifier,
                nautobot_service=nautobot_service,
                device_import_service=device_import_service,
                device_update_service=device_update_service,
                created=created,
                updated=updated,
                skipped=skipped,
                iface_config=iface_config,
                add_prefixes=add_prefixes,
                default_prefix_length=default_prefix_length,
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
            failures.append(
                {
                    "file": fp,
                    "row": dev_idx,
                    "identifier": identifier,
                    "error": error_msg,
                }
            )


# Maps the canonical interface_* field names used in column mappings/defaults
# to the keys expected inside a single interface_config dict.
_INTERFACE_FIELD_MAP: Dict[str, str] = {
    "interface_name": "name",
    "interface_type": "type",
    "interface_status": "status",
    "interface_ip_address": "ip_address",
    "interface_namespace": "namespace",
    "interface_description": "description",
}


def _extract_interface_config(
    nautobot_data: Dict[str, Any],
) -> Tuple[Dict[str, Any], Optional[List[Dict[str, Any]]]]:
    """
    Separate interface_* fields from device-level fields and return an
    interface_config list ready for DeviceImportService / DeviceUpdateService.

    A single interface is built from the extracted fields.  If no
    ``interface_name`` is present the function returns the original dict
    unchanged and None for the interface list.

    Args:
        nautobot_data: Merged device payload (column-mapped + defaults).

    Returns:
        (device_data, interface_config) where:
        - device_data: nautobot_data without the interface_* keys
        - interface_config: list with one interface dict, or None
    """
    device_data: Dict[str, Any] = {}
    iface_fields: Dict[str, Any] = {}

    for key, value in nautobot_data.items():
        if not value:
            device_data[key] = value
            continue

        if key in _INTERFACE_FIELD_MAP:
            iface_fields[_INTERFACE_FIELD_MAP[key]] = value
        elif key.startswith("interface_"):
            # Unknown interface_* key — strip prefix and include as-is
            iface_fields[key[len("interface_") :]] = value
        else:
            device_data[key] = value

    if not iface_fields or not iface_fields.get("name"):
        # No interface name → nothing to build; return original data intact
        return nautobot_data, None

    iface: Dict[str, Any] = {
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


def _apply_column_mapping(
    row: Dict[str, str], col_map: Dict[str, Optional[str]]
) -> Dict[str, Any]:
    """
    Build Nautobot payload from a CSV row by applying column_mapping.

    For each CSV column:
    - If the column is in col_map with a non-null value: use the mapped Nautobot field name
    - If the column is in col_map with null: skip it (Not Used)
    - If the column is not in col_map: use the CSV column name as the Nautobot field name

    Custom fields (cf_* prefix) are grouped under "custom_fields".
    """
    nautobot_data: Dict[str, Any] = {}
    custom_fields: Dict[str, Any] = {}

    for csv_col, value in row.items():
        if csv_col in col_map:
            nb_field = col_map[csv_col]
            if nb_field is None:
                continue  # Not Used
        else:
            nb_field = csv_col

        # Handle custom fields
        if nb_field.startswith("cf_"):
            cf_key = nb_field[3:]
            custom_fields[cf_key] = value
        else:
            nautobot_data[nb_field] = value

    if custom_fields:
        nautobot_data["custom_fields"] = custom_fields

    return nautobot_data


async def _lookup_object(
    nautobot_service: NautobotService,
    import_type: str,
    primary_key: str,
    pk_value: str,
    row: Dict[str, str],
    col_map: Dict[str, Optional[str]],
) -> Optional[str]:
    """
    Look up an existing Nautobot object by primary key value.

    Returns the object UUID if found, None otherwise.
    """
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
            # For prefixes, try to also get namespace from the row
            namespace_col = col_map.get("namespace", "namespace") or "namespace"
            # inverse lookup: find the csv col that maps to 'namespace'
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

    return None
