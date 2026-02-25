"""
Nautobot to CheckMK comparison router for device synchronization and comparison.
"""

from __future__ import annotations
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.auth import require_permission
from services.checkmk.sync.base import nb2cmk_service
from services.checkmk.sync.database import nb2cmk_db_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/nb2cmk", tags=["nb2cmk"])


# Device Sync Endpoints


@router.get("/get_default_site")
async def get_default_site(
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
):
    """Get the default site from CheckMK configuration."""
    try:
        result = nb2cmk_service.get_default_site()
        return result.model_dump()
    except Exception as e:
        logger.error("Error getting default site: %s", str(e))
        # Return default value even if config reading fails
        return {"default_site": "cmk"}


@router.get("/device/{device_id}/compare")
async def compare_device_config(
    device_id: str,
    current_user: dict = Depends(require_permission("checkmk.devices", "read")),
):
    """Compare normalized Nautobot device config with CheckMK host config."""
    try:
        logger.info("[ROUTER] Compare request for device ID: %s", device_id)
        result = await nb2cmk_service.compare_device_config(device_id)
        logger.info("[ROUTER] Compare successful for device ID: %s", device_id)
        return result.model_dump()
    except HTTPException as http_exc:
        # Re-raise HTTP exceptions with additional logging
        logger.error(
            "[ROUTER] HTTP %s error comparing device %s: %s", http_exc.status_code, device_id, http_exc.detail
        )
        raise
    except ValueError as val_err:
        # Catch validation errors from normalization/comparison
        error_msg = f"Validation error for device {device_id}: {str(val_err)}"
        logger.error("[ROUTER] %s", error_msg, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg,
        )
    except Exception as e:
        error_msg = f"Unexpected error comparing device {device_id}: {str(e)}"
        logger.error("[ROUTER] %s", error_msg, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg,
        )


@router.post("/device/{device_id}/add")
async def add_device_to_checkmk(
    device_id: str,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
):
    """Add a device from Nautobot to CheckMK using normalized config."""
    try:
        logger.info("[ROUTER] Add device request for device ID: %s", device_id)
        result = await nb2cmk_service.add_device_to_checkmk(device_id)
        logger.info("[ROUTER] Device %s added successfully to CheckMK", device_id)
        return result.model_dump()
    except HTTPException as http_exc:
        logger.error(
            "[ROUTER] HTTP %s error adding device %s: %s", http_exc.status_code, device_id, http_exc.detail
        )
        raise
    except ValueError as val_err:
        error_msg = f"Validation error adding device {device_id}: {str(val_err)}"
        logger.error("[ROUTER] %s", error_msg, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg,
        )
    except Exception as e:
        error_msg = f"Unexpected error adding device {device_id} to CheckMK: {str(e)}"
        logger.error("[ROUTER] %s", error_msg, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg,
        )


@router.post("/device/{device_id}/update")
async def update_device_in_checkmk(
    device_id: str,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
):
    """Update/sync a device from Nautobot to CheckMK using normalized config."""
    try:
        logger.info("[ROUTER] Update device request for device ID: %s", device_id)
        result = await nb2cmk_service.update_device_in_checkmk(device_id)
        logger.info("[ROUTER] Device %s updated successfully in CheckMK", device_id)
        return result.model_dump()
    except HTTPException as http_exc:
        logger.error(
            "[ROUTER] HTTP %s error updating device %s: %s", http_exc.status_code, device_id, http_exc.detail
        )
        raise
    except ValueError as val_err:
        error_msg = f"Validation error updating device {device_id}: {str(val_err)}"
        logger.error("[ROUTER] %s", error_msg, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg,
        )
    except Exception as e:
        error_msg = f"Unexpected error updating device {device_id} in CheckMK: {str(e)}"
        logger.error("[ROUTER] %s", error_msg, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg,
        )


# Job Management Endpoints


@router.get("/jobs")
async def list_comparison_jobs(
    limit: int = Query(
        20, ge=1, le=100, description="Maximum number of jobs to return"
    ),
    current_user: dict = Depends(require_permission("checkmk.devices", "read")),
):
    """
    List recent device comparison jobs from the NB2CMK database.

    These jobs are created by scheduled "Compare Devices" tasks and store
    the comparison results for viewing in the Sync Devices page.
    """
    try:
        jobs = nb2cmk_db_service.get_recent_jobs(limit=limit)

        # Convert to dict format expected by frontend
        job_list = []
        for job in jobs:
            job_list.append(
                {
                    "id": job.job_id,
                    "status": job.status.value
                    if hasattr(job.status, "value")
                    else job.status,
                    "created_at": job.created_at.isoformat()
                    if job.created_at
                    else None,
                    "started_at": job.started_at.isoformat()
                    if job.started_at
                    else None,
                    "completed_at": job.completed_at.isoformat()
                    if job.completed_at
                    else None,
                    "total_devices": job.total_devices,
                    "processed_devices": job.processed_devices,
                    "progress_message": job.progress_message,
                    "user_id": job.user_id,
                    "error_message": job.error_message,
                }
            )

        return {"jobs": job_list, "total": len(job_list)}

    except Exception as e:
        logger.error("Error listing comparison jobs: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list comparison jobs: {str(e)}",
        )


@router.get("/jobs/{job_id}")
async def get_comparison_job_details(
    job_id: str,
    current_user: dict = Depends(require_permission("checkmk.devices", "read")),
):
    """
    Get detailed information about a comparison job including device results.

    Returns the job status and all device comparison results stored in the
    NB2CMK database, formatted for display in the Sync Devices page.
    """
    try:
        # Get job info
        job = nb2cmk_db_service.get_job(job_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job {job_id} not found",
            )

        # Get device results
        device_results = nb2cmk_db_service.get_job_results(job_id)

        # Format device results for frontend
        formatted_results = []
        for result in device_results:
            formatted_results.append(
                {
                    "device_id": result.device_id,
                    "device_name": result.device_name,
                    "device": result.device_name,  # Alias for compatibility
                    "checkmk_status": result.checkmk_status,
                    "diff": result.diff,
                    "normalized_config": result.normalized_config,
                    "checkmk_config": result.checkmk_config,
                    "ignored_attributes": result.ignored_attributes,  # Include ignored attributes
                    "processed_at": result.processed_at.isoformat()
                    if result.processed_at
                    else None,
                }
            )

        return {
            "job": {
                "id": job.job_id,
                "status": job.status.value
                if hasattr(job.status, "value")
                else job.status,
                "created_at": job.created_at.isoformat() if job.created_at else None,
                "started_at": job.started_at.isoformat() if job.started_at else None,
                "completed_at": job.completed_at.isoformat()
                if job.completed_at
                else None,
                "total_devices": job.total_devices,
                "processed_devices": job.processed_devices,
                "progress_message": job.progress_message,
                "user_id": job.user_id,
                "error_message": job.error_message,
                "device_results": formatted_results,
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting comparison job %s: %s", job_id, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get comparison job: {str(e)}",
        )


@router.delete("/jobs/{job_id}")
async def delete_comparison_job(
    job_id: str,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
):
    """
    Delete a comparison job and its results.

    Only completed, failed, or cancelled jobs can be deleted.
    Running or pending jobs must be cancelled first.
    """
    try:
        # Check if job exists
        job = nb2cmk_db_service.get_job(job_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job {job_id} not found",
            )

        # Check if job can be deleted
        status_value = job.status.value if hasattr(job.status, "value") else job.status
        if status_value in ["running", "pending"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete job {job_id} - job is {status_value}. Cancel it first.",
            )

        # Delete the job
        deleted = nb2cmk_db_service.delete_job(job_id)

        if deleted:
            return {"message": f"Job {job_id} deleted successfully"}
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete job {job_id}",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting comparison job %s: %s", job_id, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete comparison job: {str(e)}",
        )


@router.post("/jobs/clear")
async def clear_all_comparison_jobs(
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
):
    """
    Delete all completed, failed, and cancelled comparison jobs.

    Running or pending jobs are preserved.
    Returns the count of deleted jobs.
    """
    try:
        # Get all jobs
        jobs = nb2cmk_db_service.get_recent_jobs(limit=1000)

        deleted_count = 0
        skipped_count = 0

        for job in jobs:
            status_value = (
                job.status.value if hasattr(job.status, "value") else job.status
            )

            # Skip running or pending jobs
            if status_value in ["running", "pending"]:
                skipped_count += 1
                continue

            # Delete the job
            if nb2cmk_db_service.delete_job(job.job_id):
                deleted_count += 1

        message = f"Deleted {deleted_count} comparison job(s)"
        if skipped_count > 0:
            message += f", skipped {skipped_count} running/pending job(s)"

        return {"message": message, "deleted": deleted_count, "skipped": skipped_count}

    except Exception as e:
        logger.error("Error clearing comparison jobs: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clear comparison jobs: {str(e)}",
        )
