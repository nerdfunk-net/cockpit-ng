"""
Device export task endpoints.

Covers: preview-export, trigger export, download, csv-export to Git.
"""

import logging
import os

from celery.result import AsyncResult
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse

import job_run_manager
from celery_app import celery_app
from core.auth import require_permission
from core.celery_error_handler import handle_celery_errors
from dependencies import get_nautobot_service
from models.celery import (
    CsvExportRequest,
    ExportDevicesRequest,
    PreviewExportRequest,
    PreviewExportResponse,
    TaskWithJobResponse,
)
from services.nautobot.client import NautobotService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/celery", tags=["celery-device-tasks"])


@router.post("/preview-export-devices", response_model=PreviewExportResponse)
async def preview_export_devices(
    request: PreviewExportRequest,
    current_user: dict = Depends(require_permission("nautobot.export", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
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

        variables = {"id_filter": preview_device_ids}
        result = await nautobot_service.graphql_query(query, variables)

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
            preview_content = _export_to_csv(
                filtered_devices, request.csv_options or {}
            )
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
            "includeHeaders": request.csv_options.get("includeHeaders", "true").lower()
            == "true",
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
    result = AsyncResult(task_id, app=celery_app)

    if result.state != "SUCCESS":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task {task_id} is not completed. Current status: {result.state}",
        )

    task_result = result.result
    if not task_result or not task_result.get("success"):
        error_msg = (
            task_result.get("error", "Unknown error")
            if task_result
            else "No result available"
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


@router.post("/tasks/csv-export", response_model=TaskWithJobResponse)
@handle_celery_errors("export devices to CSV")
async def trigger_csv_export(
    request: CsvExportRequest,
    current_user: dict = Depends(require_permission("nautobot.export", "execute")),
):
    from tasks.csv_export_task import csv_export_task

    job_run = job_run_manager.create_job_run(
        job_name="CSV Export",
        job_type="csv_export",
        triggered_by="manual",
        executed_by=current_user.get("username"),
        job_template_id=request.template_id,
    )

    task = csv_export_task.delay(
        device_ids=request.device_ids,
        properties=request.properties,
        repo_id=request.repo_id,
        file_path=request.file_path,
        delimiter=request.delimiter,
        quote_char=request.quote_char,
        include_headers=request.include_headers,
        job_run_id=job_run["id"],
    )

    job_run_manager.mark_started(job_run["id"], task.id)

    return TaskWithJobResponse(
        task_id=task.id,
        job_id=str(job_run["id"]),
        status="queued",
        message=f"CSV export task queued for {len(request.device_ids)} devices: {task.id}",
    )
