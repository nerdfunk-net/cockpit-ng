"""
Nautobot to CheckMK comparison router for device synchronization and comparison.
"""

from __future__ import annotations
import logging
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from services.nb2cmk_base_service import nb2cmk_service
from services.nb2cmk_background_service import nb2cmk_background_service
from models.nb2cmk import (
    JobStartResponse,
    JobProgressResponse,
    JobResultsResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/nb2cmk", tags=["nb2cmk"])


# Background Job Endpoints


@router.get("/jobs")
async def get_jobs_list(
    limit: int = 100,
    current_user: dict = Depends(require_permission("checkmk.devices", "read")),
):
    """Get list of recent background jobs"""
    try:
        from services.nb2cmk_database_service import nb2cmk_db_service

        jobs = nb2cmk_db_service.get_recent_jobs(limit)

        # Convert to frontend format
        jobs_data = []
        for job in jobs:
            job_data = {
                "id": job.job_id,
                "type": "device-comparison",  # All current jobs are device comparisons
                "status": job.status.value,
                "started_at": job.created_at.isoformat(),
                "completed_at": job.completed_at.isoformat()
                if job.completed_at
                else None,
                "started_by": job.user_id or "unknown",
                "progress": {
                    "processed": job.processed_devices,
                    "total": job.total_devices,
                    "message": job.progress_message,
                }
                if job.total_devices > 0
                else None,
                "results": {
                    "devices_processed": job.processed_devices,
                    "devices_added": 0,  # Would need tracking for this
                    "devices_updated": 0,  # Would need tracking for this
                    "errors": [job.error_message] if job.error_message else [],
                }
                if job.status.value in ["completed", "failed"]
                else None,
            }
            jobs_data.append(job_data)

        return {"jobs": jobs_data}
    except Exception as e:
        logger.error(f"Error getting jobs list: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get jobs list: {str(e)}",
        )


@router.post("/start-diff-job", response_model=JobStartResponse)
async def start_devices_diff_job(
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
):
    """Start a background job to get all devices from Nautobot with CheckMK comparison status"""
    try:
        username = current_user.get("username")  # Extract username from JWT token
        result = await nb2cmk_background_service.start_devices_diff_job(username)
        return result
    except Exception as e:
        logger.error(f"Error starting devices diff job: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start devices diff job: {str(e)}",
        )


@router.get("/job/{job_id}/progress", response_model=JobProgressResponse)
async def get_job_progress(
    job_id: str,
    current_user: dict = Depends(require_permission("checkmk.devices", "read")),
):
    """Get progress information for a background job"""
    try:
        result = await nb2cmk_background_service.get_job_progress(job_id)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting job progress for {job_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get job progress: {str(e)}",
        )


@router.get("/job/{job_id}/results", response_model=JobResultsResponse)
async def get_job_results(
    job_id: str,
    current_user: dict = Depends(require_permission("checkmk.devices", "read")),
):
    """Get complete results for a completed background job"""
    try:
        result = await nb2cmk_background_service.get_job_results(job_id)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting job results for {job_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get job results: {str(e)}",
        )


@router.post("/job/{job_id}/cancel")
async def cancel_job(
    job_id: str,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
):
    """Cancel a running background job"""
    try:
        success = await nb2cmk_background_service.cancel_job(job_id)
        if success:
            return {"message": f"Job {job_id} cancelled successfully"}
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to cancel job {job_id}",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling job {job_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel job: {str(e)}",
        )


@router.delete("/job/{job_id}")
async def delete_job(
    job_id: str,
    current_user: dict = Depends(require_permission("checkmk.devices", "delete")),
):
    """Delete a completed background job and its results"""
    try:
        from services.nb2cmk_database_service import nb2cmk_db_service

        # Check if job exists and is in a deletable state
        job = nb2cmk_db_service.get_job(job_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Job {job_id} not found"
            )

        if job.status.value in ["running", "pending"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete {job.status.value} job. Cancel it first.",
            )

        # Delete job and its results
        success = nb2cmk_db_service.delete_job(job_id)
        if success:
            return {"message": f"Job {job_id} deleted successfully"}
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete job {job_id}",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting job {job_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete job: {str(e)}",
        )


@router.post("/jobs/clear-completed")
async def clear_completed_jobs(
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
):
    """Clear all completed and failed jobs"""
    try:
        from services.nb2cmk_database_service import nb2cmk_db_service

        # Use cleanup method with 0 days to clear all completed jobs
        deleted_count = nb2cmk_db_service.cleanup_old_jobs(0)
        return {"message": f"Cleared {deleted_count} completed jobs"}
    except Exception as e:
        logger.error(f"Error clearing completed jobs: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clear completed jobs: {str(e)}",
        )


# Device Sync Endpoints


@router.get("/devices", response_model=dict)
async def get_devices_for_sync(
    current_user: dict = Depends(require_permission("checkmk.devices", "read")),
):
    """Get all devices from Nautobot for CheckMK sync"""
    try:
        result = await nb2cmk_service.get_devices_for_sync()
        return result.model_dump()
    except Exception as e:
        logger.error(f"Error getting devices for CheckMK sync: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get devices for CheckMK sync: {str(e)}",
        )


@router.get("/device/{device_id}/normalized")
async def get_device_normalized(
    device_id: str,
    current_user: dict = Depends(require_permission("checkmk.devices", "read")),
):
    """Get normalized device config from Nautobot for CheckMK comparison."""
    try:
        return await nb2cmk_service.get_device_normalized(device_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error getting normalized device config for {device_id}: {str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get normalized device config: {str(e)}",
        )


@router.get("/get_default_site")
async def get_default_site(
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
):
    """Get the default site from CheckMK configuration."""
    try:
        result = nb2cmk_service.get_default_site()
        return result.model_dump()
    except Exception as e:
        logger.error(f"Error getting default site: {str(e)}")
        # Return default value even if config reading fails
        return {"default_site": "cmk"}


@router.get("/get_diff", response_model=dict)
async def get_devices_diff(
    current_user: dict = Depends(require_permission("checkmk.devices", "read")),
):
    """Get all devices from Nautobot with CheckMK comparison status"""
    try:
        result = await nb2cmk_service.get_devices_diff()
        return result.model_dump()
    except Exception as e:
        logger.error(f"Error getting devices diff: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get devices diff: {str(e)}",
        )


@router.get("/device/{device_id}/compare")
async def compare_device_config(
    device_id: str,
    current_user: dict = Depends(require_permission("checkmk.devices", "read")),
):
    """Compare normalized Nautobot device config with CheckMK host config."""
    try:
        result = await nb2cmk_service.compare_device_config(device_id)
        return result.model_dump()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error comparing device configs for {device_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compare device configs: {str(e)}",
        )


@router.post("/device/{device_id}/add")
async def add_device_to_checkmk(
    device_id: str,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
):
    """Add a device from Nautobot to CheckMK using normalized config."""
    try:
        result = await nb2cmk_service.add_device_to_checkmk(device_id)
        return result.model_dump()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding device {device_id} to CheckMK: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add device {device_id} to CheckMK: {str(e)}",
        )


@router.post("/device/{device_id}/update")
async def update_device_in_checkmk(
    device_id: str,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
):
    """Update/sync a device from Nautobot to CheckMK using normalized config."""
    try:
        result = await nb2cmk_service.update_device_in_checkmk(device_id)
        return result.model_dump()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating device {device_id} in CheckMK: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update device {device_id} in CheckMK: {str(e)}",
        )
