"""
Check IP task endpoint — compares a CSV device list against Nautobot.
"""

import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

import job_run_manager
from celery_app import celery_app
from core.auth import require_permission
from models.celery import TaskResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/celery", tags=["celery-device-tasks"])


@router.post("/tasks/check-ip", response_model=TaskResponse)
async def check_ip_task_endpoint(
    csv_file: UploadFile = File(...),
    delimiter: str = Form(","),
    quote_char: str = Form('"'),
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """
    Compare CSV device list with Nautobot devices.

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
