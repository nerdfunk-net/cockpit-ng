"""
Device import and update task endpoints.

Covers: update-devices-from-csv, update-ip-prefixes-from-csv,
update-ip-addresses-from-csv, update-devices (JSON), import-devices-from-csv,
import-or-update-from-csv (Git-based).
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status

import job_run_manager
from core.auth import require_permission
from core.celery_error_handler import handle_celery_errors
from models.celery import (
    CsvImportRequest,
    ImportDevicesRequest,
    TaskWithJobResponse,
    UpdateDevicesJSONRequest,
    UpdateDevicesRequest,
    UpdateIPAddressesRequest,
    UpdateIPPrefixesRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/celery", tags=["celery-device-tasks"])


@router.post("/tasks/update-devices-from-csv", response_model=TaskWithJobResponse)
@handle_celery_errors("update devices from CSV")
async def trigger_update_devices_from_csv(
    request: UpdateDevicesRequest,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
):
    from tasks.update_devices_from_csv_task import update_devices_from_csv_task

    if not request.csv_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="csv_content cannot be empty",
        )

    csv_options = None
    if request.csv_options:
        csv_options = {
            "delimiter": request.csv_options.get("delimiter", ","),
            "quoteChar": request.csv_options.get("quoteChar", '"'),
        }

    task = update_devices_from_csv_task.delay(
        csv_content=request.csv_content,
        csv_options=csv_options,
        dry_run=request.dry_run,
        tags_mode=request.tags_mode,
        column_mapping=request.column_mapping,
        selected_columns=request.selected_columns,
        primary_key_column=request.primary_key_column,
        matching_strategy=request.matching_strategy,
        name_transform=request.name_transform.model_dump()
        if request.name_transform
        else None,
        rack_location_column=request.rack_location_column,
    )

    job_name = f"Update devices from CSV{'(DRY RUN)' if request.dry_run else ''}"
    job_run = job_run_manager.create_job_run(
        job_name=job_name,
        job_type="update_devices_from_csv",
        triggered_by="manual",
        executed_by=current_user.get("username"),
    )
    job_run_manager.mark_started(job_run["id"], task.id)

    return TaskWithJobResponse(
        task_id=task.id,
        job_id=str(job_run["id"]),
        status="queued",
        message=f"Update devices task queued{' (dry run mode)' if request.dry_run else ''}: {task.id}",
    )


@router.post("/tasks/update-ip-prefixes-from-csv", response_model=TaskWithJobResponse)
@handle_celery_errors("update IP prefixes from CSV")
async def trigger_update_ip_prefixes_from_csv(
    request: UpdateIPPrefixesRequest,
    current_user: dict = Depends(require_permission("nautobot.locations", "write")),
):
    from tasks.update_ip_prefixes_from_csv_task import update_ip_prefixes_from_csv_task

    logger.info("=" * 80)
    logger.info("RECEIVED UPDATE IP PREFIXES REQUEST")
    logger.info("=" * 80)
    logger.info("  - dry_run: %s", request.dry_run)
    logger.info("  - ignore_uuid: %s", request.ignore_uuid)
    logger.info("  - tags_mode: %s", request.tags_mode)
    logger.info("  - column_mapping: %s", request.column_mapping)
    logger.info("  - selected_columns: %s", request.selected_columns)
    logger.info("  - csv_options: %s", request.csv_options)

    if not request.csv_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="csv_content cannot be empty",
        )

    csv_options = None
    if request.csv_options:
        csv_options = {
            "delimiter": request.csv_options.get("delimiter", ","),
            "quoteChar": request.csv_options.get("quoteChar", '"'),
        }

    task = update_ip_prefixes_from_csv_task.delay(
        csv_content=request.csv_content,
        csv_options=csv_options,
        dry_run=request.dry_run,
        ignore_uuid=request.ignore_uuid,
        tags_mode=request.tags_mode,
        column_mapping=request.column_mapping,
        selected_columns=request.selected_columns,
    )

    job_name = f"Update IP Prefixes from CSV{' (DRY RUN)' if request.dry_run else ''}"
    job_run = job_run_manager.create_job_run(
        job_name=job_name,
        job_type="update_ip_prefixes_from_csv",
        triggered_by="manual",
        executed_by=current_user.get("username"),
    )
    job_run_manager.mark_started(job_run["id"], task.id)

    return TaskWithJobResponse(
        task_id=task.id,
        job_id=str(job_run["id"]),
        status="queued",
        message=f"Update IP prefixes task queued{' (dry run mode)' if request.dry_run else ''}: {task.id}",
    )


@router.post("/tasks/update-ip-addresses-from-csv", response_model=TaskWithJobResponse)
@handle_celery_errors("update IP addresses from CSV")
async def trigger_update_ip_addresses_from_csv(
    request: UpdateIPAddressesRequest,
    current_user: dict = Depends(require_permission("nautobot.locations", "write")),
):
    from tasks.update_ip_addresses_from_csv_task import (
        update_ip_addresses_from_csv_task,
    )

    logger.info("=" * 80)
    logger.info("RECEIVED UPDATE IP ADDRESSES REQUEST")
    logger.info("=" * 80)
    logger.info("  - dry_run: %s", request.dry_run)
    logger.info("  - ignore_uuid: %s", request.ignore_uuid)
    logger.info("  - tags_mode: %s", request.tags_mode)
    logger.info("  - column_mapping: %s", request.column_mapping)
    logger.info("  - selected_columns: %s", request.selected_columns)

    if not request.csv_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="csv_content cannot be empty",
        )

    csv_options = None
    if request.csv_options:
        csv_options = {
            "delimiter": request.csv_options.get("delimiter", ","),
            "quoteChar": request.csv_options.get("quoteChar", '"'),
        }

    task = update_ip_addresses_from_csv_task.delay(
        csv_content=request.csv_content,
        csv_options=csv_options,
        dry_run=request.dry_run,
        ignore_uuid=request.ignore_uuid,
        tags_mode=request.tags_mode,
        column_mapping=request.column_mapping,
        selected_columns=request.selected_columns,
    )

    job_name = f"Update IP Addresses from CSV{' (DRY RUN)' if request.dry_run else ''}"
    job_run = job_run_manager.create_job_run(
        job_name=job_name,
        job_type="update_ip_addresses_from_csv",
        triggered_by="manual",
        executed_by=current_user.get("username"),
    )
    job_run_manager.mark_started(job_run["id"], task.id)

    return TaskWithJobResponse(
        task_id=task.id,
        job_id=str(job_run["id"]),
        status="queued",
        message=f"Update IP addresses task queued{' (dry run mode)' if request.dry_run else ''}: {task.id}",
    )


@router.post("/tasks/update-devices", response_model=TaskWithJobResponse)
@handle_celery_errors("update devices")
async def trigger_update_devices(
    request: UpdateDevicesJSONRequest,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
):
    from tasks.update_devices_task import update_devices_task

    if not request.devices:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="devices list cannot be empty",
        )

    task = update_devices_task.delay(
        devices=request.devices,
        dry_run=request.dry_run,
        username=current_user.get("username"),
        user_id=current_user.get("user_id"),
    )

    job_name = f"Update devices{' (DRY RUN)' if request.dry_run else ''}"
    job_run = job_run_manager.create_job_run(
        job_name=job_name,
        job_type="update_devices",
        triggered_by="manual",
        executed_by=current_user.get("username"),
    )
    job_run_manager.mark_started(job_run["id"], task.id)

    return TaskWithJobResponse(
        task_id=task.id,
        job_id=str(job_run["id"]),
        status="queued",
        message=(
            f"Update devices task queued ({len(request.devices)} device(s))"
            f"{' (dry run mode)' if request.dry_run else ''}: {task.id}"
        ),
    )


@router.post("/tasks/import-devices-from-csv", response_model=TaskWithJobResponse)
@handle_celery_errors("import devices from CSV")
async def trigger_import_devices_from_csv(
    request: ImportDevicesRequest,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
):
    from tasks.import_devices_task import import_devices_from_csv_task

    if not request.csv_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="csv_content cannot be empty",
        )

    csv_options = None
    if request.csv_options:
        csv_options = {
            "delimiter": request.csv_options.get("delimiter", ","),
            "quoteChar": request.csv_options.get("quoteChar", '"'),
        }

    import_options = None
    if request.import_options:
        import_options = {
            "skip_duplicates": request.import_options.get("skip_duplicates", False),
            "create_interfaces": request.import_options.get("create_interfaces", True),
        }

    task = import_devices_from_csv_task.delay(
        csv_content=request.csv_content,
        csv_options=csv_options,
        import_options=import_options,
    )

    skip_duplicates = (
        import_options.get("skip_duplicates", False) if import_options else False
    )
    job_name = (
        f"Import devices from CSV{' (skip duplicates)' if skip_duplicates else ''}"
    )
    job_run = job_run_manager.create_job_run(
        job_name=job_name,
        job_type="import_devices_from_csv",
        triggered_by="manual",
        executed_by=current_user.get("username"),
    )
    job_run_manager.mark_started(job_run["id"], task.id)

    return TaskWithJobResponse(
        task_id=task.id,
        job_id=str(job_run["id"]),
        status="queued",
        message=f"Import devices task queued{' (skip duplicates mode)' if skip_duplicates else ''}: {task.id}",
    )


@router.post("/tasks/import-or-update-from-csv", response_model=TaskWithJobResponse)
@handle_celery_errors("import or update from CSV")
async def trigger_import_or_update_from_csv(
    request: CsvImportRequest,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
):
    from tasks.import_or_update_from_csv_task import import_or_update_from_csv_task

    task = import_or_update_from_csv_task.delay(
        repo_id=request.repo_id,
        file_path=request.file_path,
        import_type=request.import_type,
        primary_key=request.primary_key,
        update_existing=request.update_existing,
        delimiter=request.delimiter,
        quote_char=request.quote_char,
        column_mapping=request.column_mapping,
        dry_run=request.dry_run,
        template_id=request.template_id,
        file_filter=request.file_filter,
    )

    job_name = (
        f"CSV Import ({request.import_type}){' (DRY RUN)' if request.dry_run else ''}"
    )
    job_run = job_run_manager.create_job_run(
        job_name=job_name,
        job_type="csv_import",
        triggered_by="manual",
        executed_by=current_user.get("username"),
        job_template_id=request.template_id,
    )
    job_run_manager.mark_started(job_run["id"], task.id)

    return TaskWithJobResponse(
        task_id=task.id,
        job_id=str(job_run["id"]),
        status="queued",
        message=(
            f"CSV import task queued for {request.import_type}"
            f"{' (dry run mode)' if request.dry_run else ''}: {task.id}"
        ),
    )
