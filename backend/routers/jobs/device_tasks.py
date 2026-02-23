"""
Device lifecycle task endpoints.

Covers: onboard, bulk-onboard, backup, export/download/preview,
update (CSV & JSON), import, import-from-CSV, device-backup-status, check-ip.
All endpoints are under /api/celery/*.
"""

import json
import logging
import math
import os

import redis
from celery.result import AsyncResult
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

import job_run_manager
from celery_app import celery_app
from core.auth import require_permission
from core.celery_error_handler import handle_celery_errors
from config import settings
from models.celery import (
    BackupCheckResponse,
    BackupDevicesRequest,
    BulkOnboardDevicesRequest,
    DeployAgentRequest,
    DeviceBackupStatus,
    ExportDevicesRequest,
    ImportDevicesRequest,
    OnboardDeviceRequest,
    PreviewExportRequest,
    PreviewExportResponse,
    TaskResponse,
    TaskWithJobResponse,
    UpdateDevicesJSONRequest,
    UpdateDevicesRequest,
    UpdateIPAddressesRequest,
    UpdateIPPrefixesRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/celery", tags=["celery-device-tasks"])


# ============================================================================
# Device onboarding
# ============================================================================


@router.post("/tasks/onboard-device", response_model=TaskResponse)
@handle_celery_errors("onboard device")
async def trigger_onboard_device(
    request: OnboardDeviceRequest,
    current_user: dict = Depends(require_permission("devices.onboard", "execute")),
):
    """
    Onboard a device to Nautobot with tags and custom fields using Celery.

    This endpoint triggers a background task that:
    1. Calls Nautobot onboarding job
    2. Waits for job completion (configurable timeout)
    3. Retrieves the device UUID from the IP address
    4. Updates the device with tags and custom fields

    Request Body:
        ip_address: Device IP address
        location_id: Nautobot location ID
        role_id: Nautobot role ID
        namespace_id: Nautobot namespace ID
        status_id: Device status ID
        interface_status_id: Interface status ID
        ip_address_status_id: IP address status ID
        prefix_status_id: Prefix status ID
        secret_groups_id: Secret group ID
        platform_id: Platform ID or "detect"
        port: SSH port (default: 22)
        timeout: SSH connection timeout (default: 30)
        onboarding_timeout: Max time to wait for onboarding job (default: 120)
        sync_options: List of sync options (cables, software, vlans, vrfs)
        tags: List of tag IDs to apply (optional)
        custom_fields: Dict of custom field key-value pairs (optional)

    Returns:
        TaskResponse with task_id for tracking progress via /tasks/{task_id}
    """
    from tasks.onboard_device_task import onboard_device_task

    task = onboard_device_task.delay(
        ip_address=request.ip_address,
        location_id=request.location_id,
        role_id=request.role_id,
        namespace_id=request.namespace_id,
        status_id=request.status_id,
        interface_status_id=request.interface_status_id,
        ip_address_status_id=request.ip_address_status_id,
        prefix_status_id=request.prefix_status_id,
        secret_groups_id=request.secret_groups_id,
        platform_id=request.platform_id,
        port=request.port,
        timeout=request.timeout,
        onboarding_timeout=request.onboarding_timeout,
        sync_options=request.sync_options,
        tags=request.tags,
        custom_fields=request.custom_fields,
        username=current_user.get("username"),
        user_id=current_user.get("user_id"),
    )

    return TaskResponse(
        task_id=task.id,
        status="queued",
        message=f"Device onboarding task queued for {request.ip_address}: {task.id}",
    )


@router.post("/tasks/bulk-onboard-devices", response_model=TaskResponse)
@handle_celery_errors("bulk onboard devices")
async def trigger_bulk_onboard_devices(
    request: BulkOnboardDevicesRequest,
    current_user: dict = Depends(require_permission("devices.onboard", "execute")),
):
    """
    Bulk onboard multiple devices from CSV data using one or more Celery tasks.

    This endpoint triggers background task(s) that process multiple devices.
    If parallel_jobs > 1, devices are split into batches and processed concurrently.

    Request Body:
        devices: List of device configurations
        default_config: Default configuration to use when device-specific values are missing
        parallel_jobs: Number of parallel jobs to create (default: 1)

    Returns:
        TaskResponse with task_id(s) for tracking progress via /tasks/{task_id}
    """
    from tasks.bulk_onboard_task import bulk_onboard_devices_task

    devices_data = [device.model_dump() for device in request.devices]
    device_count = len(devices_data)
    username = current_user.get("username", "unknown")

    if device_count == 0:
        return TaskResponse(
            task_id="",
            status="error",
            message="No devices provided for bulk onboarding",
        )

    parallel_jobs = max(1, min(request.parallel_jobs or 1, device_count))

    if parallel_jobs == 1:
        task = bulk_onboard_devices_task.delay(
            devices=devices_data,
            default_config=request.default_config,
            username=current_user.get("username"),
            user_id=current_user.get("user_id"),
        )

        ip_addresses = [d.get("ip_address", "unknown") for d in devices_data]
        try:
            job_run = job_run_manager.create_job_run(
                job_name=f"Bulk Onboard {device_count} Devices (CSV)",
                job_type="bulk_onboard",
                triggered_by="manual",
                target_devices=ip_addresses,
                executed_by=username,
            )
            job_run_id = job_run.get("id")
            if job_run_id:
                job_run_manager.mark_started(job_run_id, task.id)
                logger.info("Created job run %s for bulk onboard task %s", job_run_id, task.id)
        except Exception as exc:
            logger.warning("Failed to create job run entry: %s", exc)

        return TaskResponse(
            task_id=task.id,
            status="queued",
            message=f"Bulk onboarding task queued for {device_count} devices: {task.id}",
        )

    # Parallel mode – split into batches
    batch_size = math.ceil(device_count / parallel_jobs)
    task_ids = []

    for batch_num in range(parallel_jobs):
        start_idx = batch_num * batch_size
        end_idx = min(start_idx + batch_size, device_count)
        batch_devices = devices_data[start_idx:end_idx]

        if not batch_devices:
            continue

        task = bulk_onboard_devices_task.delay(
            devices=batch_devices,
            default_config=request.default_config,
            username=current_user.get("username"),
            user_id=current_user.get("user_id"),
        )
        task_ids.append(task.id)

        ip_addresses = [d.get("ip_address", "unknown") for d in batch_devices]
        try:
            job_run = job_run_manager.create_job_run(
                job_name=f"Bulk Onboard Batch {batch_num + 1}/{parallel_jobs} ({len(batch_devices)} devices)",
                job_type="bulk_onboard",
                triggered_by="manual",
                target_devices=ip_addresses,
                executed_by=username,
            )
            job_run_id = job_run.get("id")
            if job_run_id:
                job_run_manager.mark_started(job_run_id, task.id)
                logger.info(
                    "Created job run %s for batch %s task %s",
                    job_run_id, batch_num + 1, task.id,
                )
        except Exception as exc:
            logger.warning("Failed to create job run entry for batch %s: %s", batch_num + 1, exc)

    return TaskResponse(
        task_id=",".join(task_ids),
        status="queued",
        message=f"Created {len(task_ids)} parallel jobs for {device_count} devices ({batch_size} devices per job)",
    )


# ============================================================================
# Device backup
# ============================================================================


@router.post("/tasks/backup-devices", response_model=TaskResponse)
@handle_celery_errors("backup devices")
async def trigger_backup_devices(
    request: BackupDevicesRequest,
    current_user: dict = Depends(require_permission("jobs", "write")),
):
    """
    Backup device configurations to Git repository.

    This task:
    1. Converts inventory to device list
    2. Checks/clones/pulls Git repository
    3. Connects to each device via Netmiko
    4. Executes 'show running-config' and 'show startup-config'
    5. Saves configs to Git repository
    6. Commits and pushes changes

    Request Body:
        inventory: List of device IDs to backup
        config_repository_id: ID of Git repository for configs (category=device_configs)
        credential_id: Optional ID of credential for device authentication

    Returns:
        TaskResponse with task_id for tracking progress
    """
    from tasks.backup_tasks import backup_devices_task

    if not request.inventory:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="inventory list cannot be empty",
        )

    if not request.config_repository_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="config_repository_id is required",
        )

    task = backup_devices_task.delay(
        inventory=request.inventory,
        config_repository_id=request.config_repository_id,
        credential_id=request.credential_id,
        write_timestamp_to_custom_field=request.write_timestamp_to_custom_field,
        timestamp_custom_field_name=request.timestamp_custom_field_name,
        parallel_tasks=request.parallel_tasks,
    )

    return TaskResponse(
        task_id=task.id,
        status="queued",
        message=f"Backup task queued for {len(request.inventory)} devices: {task.id}",
    )


# ============================================================================
# Deploy agent
# ============================================================================


@router.post("/tasks/deploy-agent", response_model=TaskResponse)
@handle_celery_errors("deploy agent")
async def trigger_deploy_agent(
    request: DeployAgentRequest,
    current_user: dict = Depends(require_permission("network.templates", "write")),
):
    """
    Deploy agent configuration to Git repository.

    This task:
    1. Loads template and agent configuration
    2. Renders the template with variables and inventory context
    3. Opens/clones the Git repository
    4. Writes rendered configuration to file
    5. Commits and pushes changes to Git
    6. Optionally activates agent (docker restart via cockpit agent)

    Request Body:
        template_id: ID of template to render
        custom_variables: User-provided custom variables (optional)
        agent_id: Agent ID for deployment configuration
        path: Deployment file path (optional, uses template default)
        inventory_id: Inventory ID for rendering (optional, uses template default)
        activate_after_deploy: Whether to activate agent after deployment (optional)

    Returns:
        TaskResponse with task_id for tracking progress
    """
    from tasks.agent_deploy_tasks import deploy_agent_task

    if not request.template_id and not request.template_entries:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either template_id or template_entries is required",
        )

    if not request.agent_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="agent_id is required",
        )

    activate_after_deploy = request.activate_after_deploy
    if activate_after_deploy is None:
        activate_after_deploy = True

    task_kwargs = {
        "agent_id": request.agent_id,
        "activate_after_deploy": activate_after_deploy,
    }

    if request.template_entries:
        task_kwargs["template_entries"] = [e.model_dump() for e in request.template_entries]
        task_description = f"{len(request.template_entries)} templates"
    else:
        task_kwargs["template_id"] = request.template_id
        task_kwargs["custom_variables"] = request.custom_variables or {}
        task_kwargs["path"] = request.path
        task_kwargs["inventory_id"] = request.inventory_id
        task_description = f"template {request.template_id}"

    task = deploy_agent_task.delay(**task_kwargs)

    return TaskResponse(
        task_id=task.id,
        status="queued",
        message=f"Agent deployment task queued for {task_description}: {task.id}",
    )


# ============================================================================
# Export devices  (preview → trigger → download)
# ============================================================================


@router.post("/preview-export-devices", response_model=PreviewExportResponse)
async def preview_export_devices(
    request: PreviewExportRequest,
    current_user: dict = Depends(require_permission("nautobot.export", "read")),
):
    """
    Preview export data by fetching full device information from Nautobot.

    Fetches complete device data for a limited number of devices (default 5)
    to provide an accurate preview using the same GraphQL query as the actual export.

    Request Body:
        device_ids: List of Nautobot device IDs
        properties: List of properties to include in preview
        max_devices: Maximum number of devices to preview (default: 5)

    Returns:
        PreviewExportResponse with full device data for preview
    """
    from services.nautobot import NautobotService
    from tasks.export_devices_task import (
        _build_graphql_query,
        _export_to_csv,
        _export_to_yaml,
        _filter_device_properties,
    )

    try:
        if not request.device_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="device_ids list cannot be empty",
            )

        if not request.properties:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="properties list cannot be empty",
            )

        preview_device_ids = request.device_ids[: request.max_devices]
        query = _build_graphql_query(request.properties)

        nautobot_service = NautobotService()
        variables = {"id_filter": preview_device_ids}
        result = nautobot_service._sync_graphql_query(query, variables)

        if not result or "data" not in result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch device data from Nautobot",
            )

        devices = result.get("data", {}).get("devices", [])

        if not devices:
            return PreviewExportResponse(
                success=True,
                preview_content="",
                total_devices=len(request.device_ids),
                previewed_devices=0,
                message="No devices found in Nautobot",
            )

        if "primary_ip4" in request.properties:
            devices = [
                device
                for device in devices
                if device.get("primary_ip4") and device["primary_ip4"].get("address")
            ]

        filtered_devices = _filter_device_properties(devices, request.properties)

        export_format = request.export_format.strip().rstrip("_")
        if export_format == "yaml":
            preview_content = _export_to_yaml(filtered_devices)
        elif export_format == "csv":
            preview_content = _export_to_csv(filtered_devices, request.csv_options or {})
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported export format: {export_format}",
            )

        if len(request.device_ids) > request.max_devices:
            additional_count = len(request.device_ids) - len(filtered_devices)
            preview_content += f"\n# ... and {additional_count} more device(s)"

        return PreviewExportResponse(
            success=True,
            preview_content=preview_content,
            total_devices=len(request.device_ids),
            previewed_devices=len(filtered_devices),
            message=f"Successfully previewed {len(filtered_devices)} of {len(request.device_ids)} devices",
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error previewing export: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to preview export: {str(exc)}",
        )


@router.post("/tasks/export-devices", response_model=TaskWithJobResponse)
@handle_celery_errors("export devices")
async def trigger_export_devices(
    request: ExportDevicesRequest,
    current_user: dict = Depends(require_permission("nautobot.export", "execute")),
):
    """
    Export Nautobot device data to YAML or CSV format.

    The task is tracked in the job database and can be viewed in the Jobs/Views app.
    Once complete, the exported file can be downloaded via the download endpoint.

    Request Body:
        device_ids: List of Nautobot device IDs to export
        properties: List of properties to include (e.g., name, asset_tag, primary_ip4)
        export_format: "yaml" or "csv" (default: "yaml")
        csv_options: Optional CSV formatting options

    Returns:
        TaskWithJobResponse with task_id (for Celery) and job_id (for Jobs/Views tracking)
    """
    from tasks.export_devices_task import export_devices_task

    if not request.device_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="device_ids list cannot be empty",
        )

    if not request.properties:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="properties list cannot be empty",
        )

    if request.export_format not in ["yaml", "csv"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid export_format: {request.export_format}. Must be 'yaml' or 'csv'",
        )

    csv_options = None
    if request.csv_options:
        csv_options = {
            "delimiter": request.csv_options.get("delimiter", ","),
            "quoteChar": request.csv_options.get("quoteChar", '"'),
            "includeHeaders": request.csv_options.get("includeHeaders", "true").lower() == "true",
        }

    task = export_devices_task.delay(
        device_ids=request.device_ids,
        properties=request.properties,
        export_format=request.export_format,
        csv_options=csv_options,
    )

    job_run = job_run_manager.create_job_run(
        job_name=f"Export {len(request.device_ids)} devices to {request.export_format.upper()}",
        job_type="export_devices",
        triggered_by="manual",
        target_devices=request.device_ids,
        executed_by=current_user.get("username"),
    )
    job_run_manager.mark_started(job_run["id"], task.id)

    return TaskWithJobResponse(
        task_id=task.id,
        job_id=str(job_run["id"]),
        status="queued",
        message=(
            f"Export task queued for {len(request.device_ids)} devices "
            f"with {len(request.properties)} properties: {task.id}"
        ),
    )


@router.get("/tasks/export-devices/{task_id}/download")
@handle_celery_errors("download export file")
async def download_export_file(
    task_id: str,
    current_user: dict = Depends(require_permission("nautobot.export", "read")),
):
    """
    Download the exported device file for a completed export task.

    Path Parameters:
        task_id: Celery task ID from the export task

    Returns:
        FileResponse: The exported file (YAML or CSV)

    Raises:
        404: Task not completed or export file not found
    """
    result = AsyncResult(task_id, app=celery_app)

    if result.state != "SUCCESS":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task {task_id} is not completed. Current status: {result.state}",
        )

    task_result = result.result
    if not task_result or not task_result.get("success"):
        error_msg = (
            task_result.get("error", "Unknown error") if task_result else "No result available"
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Export task failed: {error_msg}",
        )

    file_path = task_result.get("file_path")
    if not file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Export file path not found in task result",
        )

    logger.info("Download endpoint - checking file: %s", file_path)
    logger.info("  - File exists: %s", os.path.exists(file_path))
    logger.info("  - Current working directory: %s", os.getcwd())
    logger.info("  - Absolute path: %s", os.path.abspath(file_path))

    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Export file not found at path: {file_path}",
        )

    filename = task_result.get("filename", os.path.basename(file_path))
    export_format = task_result.get("export_format", "yaml")

    logger.info("Download endpoint - RAW values from task_result:")
    logger.info("  - filename: '%s'", filename)
    logger.info("  - export_format: '%s'", export_format)
    logger.info("  - file_path: '%s'", file_path)

    # Sanitize (remove trailing underscores)
    export_format = export_format.strip().rstrip("_")
    filename = filename.strip().rstrip("_")

    logger.info("Download endpoint - SANITIZED values:")
    logger.info("  - filename: '%s'", filename)
    logger.info("  - export_format: '%s'", export_format)

    media_type = "application/x-yaml" if export_format == "yaml" else "text/csv"

    response = FileResponse(path=file_path, media_type=media_type)
    # Don't quote the filename – some browsers (Safari) include quotes in the saved filename
    response.headers["Content-Disposition"] = f"attachment; filename={filename}"

    logger.info(
        "Download endpoint - Content-Disposition header: %s",
        response.headers["Content-Disposition"],
    )

    return response


# ============================================================================
# Update / import devices
# ============================================================================


@router.post("/tasks/update-devices-from-csv", response_model=TaskWithJobResponse)
@handle_celery_errors("update devices from CSV")
async def trigger_update_devices_from_csv(
    request: UpdateDevicesRequest,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
):
    """
    Update Nautobot devices from CSV data.

    Request Body:
        csv_content: CSV file content as string
        csv_options: Optional CSV parsing options
        dry_run: If True, validate without making changes (default: False)

    Returns:
        TaskWithJobResponse with task_id (for Celery) and job_id (for Jobs/Views tracking)
    """
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
    """
    Update Nautobot IP prefixes from CSV data.

    Strategy:
    - Primary identifier: prefix (e.g., "192.168.178.0/24") + namespace__name
    - If namespace__name is not in CSV, defaults to "Global"

    Request Body:
        csv_content: CSV file content as string
        csv_options: Optional CSV parsing options
        dry_run: If True, validate without making changes (default: False)
        ignore_uuid: If True, use prefix+namespace lookup; if False, use UUID (default: True)
        tags_mode: How to handle tags - "replace" or "merge" (default: "replace")
        column_mapping: Maps lookup field names to CSV column names (optional)
        selected_columns: List of CSV columns to update (optional)

    Returns:
        TaskWithJobResponse with task_id (for Celery) and job_id (for Jobs/Views tracking)
    """
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
    """
    Update Nautobot IP addresses from CSV data.

    Strategy:
    - Primary identifier: address (e.g., "192.168.1.1/24") + parent__namespace__name
    - If parent__namespace__name is not in CSV, defaults to "Global"

    Request Body:
        csv_content: CSV file content as string
        csv_options: Optional CSV parsing options
        dry_run: If True, validate without making changes (default: False)
        ignore_uuid: If True, use address+namespace lookup; if False, use UUID (default: True)
        tags_mode: How to handle tags - "replace" or "merge" (default: "replace")
        column_mapping: Maps lookup field names to CSV column names (optional)
        selected_columns: List of CSV columns to update (optional)

    Returns:
        TaskWithJobResponse with task_id (for Celery) and job_id (for Jobs/Views tracking)
    """
    from tasks.update_ip_addresses_from_csv_task import update_ip_addresses_from_csv_task

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
    """
    Update Nautobot devices from JSON list.

    Request Body:
        devices: List of device update objects. Each object should contain:
            - Device identifier (id, name, or ip_address)
            - Update data (any device fields to update)
        dry_run: If True, validate without making changes (default: False)

    Returns:
        TaskWithJobResponse with task_id (for Celery) and job_id (for Jobs/Views tracking)
    """
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
    """
    Import new Nautobot devices from CSV data.

    Request Body:
        csv_content: CSV file content as string
        csv_options: Optional CSV parsing options
        import_options: Optional import behavior options:
            - skip_duplicates: If True, skip devices that already exist (default: False)
            - create_interfaces: If True, create interfaces from CSV (default: True)

    Returns:
        TaskWithJobResponse with task_id (for Celery) and job_id (for Jobs/Views tracking)
    """
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
    job_name = f"Import devices from CSV{' (skip duplicates)' if skip_duplicates else ''}"
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


# ============================================================================
# Device backup status
# ============================================================================


@router.get("/device-backup-status", response_model=BackupCheckResponse)
async def check_device_backups(
    force_refresh: bool = False,
    current_user: dict = Depends(require_permission("jobs", "read")),
):
    """
    Analyze device-level backup status with caching.

    This endpoint provides critical operational visibility by analyzing
    which specific devices have successful backups and which don't.

    Args:
        force_refresh: If True, bypass cache and recalculate

    Returns:
        - Total devices that have been backed up
        - Devices with successful last backup
        - Devices with failed last backup
        - Detailed per-device backup history

    Cache: Results are cached for 5 minutes to improve dashboard performance
    """
    from core.database import get_db_session
    from sqlalchemy import text

    CACHE_KEY = "backup_check_devices"
    CACHE_DURATION_SECONDS = 300  # 5 minutes

    if not force_refresh:
        try:
            r = redis.Redis.from_url(settings.redis_url, decode_responses=True)
            cached = r.get(CACHE_KEY)
            if cached:
                logger.info("Returning cached device backup status")
                return BackupCheckResponse(**json.loads(cached))
        except Exception as exc:
            logger.warning("Cache read failed, proceeding with fresh data: %s", exc)

    session = get_db_session()

    try:
        backup_jobs = session.execute(
            text("""
            SELECT
                result,
                completed_at,
                status
            FROM job_runs
            WHERE job_type = 'backup'
                AND status IN ('completed', 'failed')
            ORDER BY completed_at DESC
        """)
        ).fetchall()

        device_status = {}

        for row in backup_jobs:
            result_json = row[0]
            completed_at = row[1]

            if not result_json:
                continue

            try:
                result = json.loads(result_json)

                for device in result.get("backed_up_devices", []):
                    device_id = device.get("device_id")
                    device_name = device.get("device_name", device_id)

                    if device_id not in device_status:
                        device_status[device_id] = {
                            "device_id": device_id,
                            "device_name": device_name,
                            "last_backup_success": True,
                            "last_backup_time": completed_at.isoformat() if completed_at else None,
                            "total_successful_backups": 1,
                            "total_failed_backups": 0,
                            "last_error": None,
                        }
                    else:
                        existing_time = device_status[device_id].get("last_backup_time")
                        new_time = completed_at.isoformat() if completed_at else None
                        if not existing_time or (new_time and new_time > existing_time):
                            device_status[device_id]["last_backup_success"] = True
                            device_status[device_id]["last_backup_time"] = new_time
                            device_status[device_id]["last_error"] = None
                        device_status[device_id]["total_successful_backups"] += 1

                for device in result.get("failed_devices", []):
                    device_id = device.get("device_id")
                    device_name = device.get("device_name", device_id)
                    error = device.get("error", "Unknown error")

                    if device_id not in device_status:
                        device_status[device_id] = {
                            "device_id": device_id,
                            "device_name": device_name,
                            "last_backup_success": False,
                            "last_backup_time": completed_at.isoformat() if completed_at else None,
                            "total_successful_backups": 0,
                            "total_failed_backups": 1,
                            "last_error": error,
                        }
                    else:
                        existing_time = device_status[device_id].get("last_backup_time")
                        new_time = completed_at.isoformat() if completed_at else None
                        if not existing_time or (new_time and new_time > existing_time):
                            device_status[device_id]["last_backup_success"] = False
                            device_status[device_id]["last_backup_time"] = new_time
                            device_status[device_id]["last_error"] = error
                        device_status[device_id]["total_failed_backups"] += 1

            except (json.JSONDecodeError, KeyError, AttributeError) as exc:
                logger.warning("Failed to parse backup job result: %s", exc)
                continue

        devices_list = list(device_status.values())
        devices_with_success = sum(1 for d in devices_list if d["last_backup_success"])
        devices_with_failure = sum(1 for d in devices_list if not d["last_backup_success"])

        response = BackupCheckResponse(
            total_devices=len(devices_list),
            devices_with_successful_backup=devices_with_success,
            devices_with_failed_backup=devices_with_failure,
            devices_never_backed_up=0,
            devices=devices_list,
        )

        try:
            r = redis.Redis.from_url(settings.redis_url, decode_responses=True)
            r.setex(CACHE_KEY, CACHE_DURATION_SECONDS, response.model_dump_json())
            logger.info("Cached device backup status for %s seconds", CACHE_DURATION_SECONDS)
        except Exception as exc:
            logger.warning("Failed to cache device backup status: %s", exc)

        return response

    finally:
        session.close()


# ============================================================================
# Check IP (multipart upload)
# ============================================================================


@router.post("/tasks/check-ip", response_model=TaskResponse)
async def check_ip_task_endpoint(
    csv_file: UploadFile = File(...),
    delimiter: str = Form(","),
    quote_char: str = Form('"'),
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """
    Compare CSV device list with Nautobot devices.

    Uploads a CSV file containing device information and compares it with
    devices in Nautobot to check for IP address matches and name consistency.

    Required CSV columns: ip_address, name
    """
    try:
        logger.info(
            "Received check IP request with delimiter='%s', quote_char='%s'",
            delimiter,
            quote_char,
        )

        if not csv_file.filename or not csv_file.filename.endswith(".csv"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File must be a CSV file",
            )

        csv_content = await csv_file.read()
        csv_string = csv_content.decode("utf-8")

        if not csv_string.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CSV file is empty",
            )

        task = celery_app.send_task(
            "tasks.check_ip_task.check_ip_task",
            args=[csv_string, delimiter, quote_char],
        )

        job_run = job_run_manager.create_job_run(
            job_name="Check IP Addresses",
            job_type="check_ip",
            triggered_by="manual",
            executed_by=current_user["username"],
        )

        if job_run:
            job_run_manager.mark_started(job_run["id"], task.id)

        logger.info("Started check IP task %s for file %s", task.id, csv_file.filename)

        return TaskResponse(
            task_id=task.id,
            status="started",
            message=f"IP check task started for {csv_file.filename}",
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error starting check IP task: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start check IP task: {str(exc)}",
        )
