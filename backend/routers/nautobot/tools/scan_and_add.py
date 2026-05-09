from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from dependencies import get_scan_service
from models.nautobot import (
    ScanStartRequest,
    ScanStartResponse,
    ScanProgress,
    ScanStatusResponse,
)

"""API router for network scanning operations."""

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/scan", tags=["scan"])


# API Endpoints
@router.post("/start", response_model=ScanStartResponse)
async def start_scan(
    request: ScanStartRequest,
    current_user: dict = Depends(require_permission("scan", "execute")),
    scan_service=Depends(get_scan_service),
):
    """Start a new network scan job."""
    try:
        # Get user's debug setting
        from services.auth.user_management import get_user_by_username

        username = current_user.get("username") or current_user.get("sub")
        user = get_user_by_username(username) if username else None
        debug_enabled = user.get("debug", False) if user else False

        # Normalize credential_ids to empty list if None
        credential_ids = request.credential_ids or []

        logger.info(
            "Starting scan job with CIDRs: %s, credentials: %s, mode: %s, ping_mode: %s, template id: %s, debug: %s",
            request.cidrs,
            credential_ids,
            request.discovery_mode,
            request.ping_mode,
            request.parser_template_ids,
            debug_enabled,
        )
        job = await scan_service.start_job(
            request.cidrs,
            credential_ids,
            request.discovery_mode,
            request.ping_mode,
            parser_template_ids=request.parser_template_ids,
            debug_enabled=debug_enabled,
        )

        return ScanStartResponse(
            job_id=job.job_id, total_targets=job.total_targets, state=job.state
        )
    except Exception as e:
        logger.error("Failed to start scan: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start scan: {str(e)}",
        )


@router.get("/{job_id}/status", response_model=ScanStatusResponse)
async def get_scan_status(job_id: str, scan_service=Depends(get_scan_service)):
    """Get status and results of a scan job."""
    job = await scan_service.get_job(job_id)

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Scan job not found"
        )

    return ScanStatusResponse(
        job_id=job.job_id,
        state=job.state,
        progress=ScanProgress(
            total=job.total_targets,
            scanned=job.scanned,
            alive=job.alive,
            authenticated=job.authenticated,
            unreachable=job.unreachable,
            auth_failed=job.auth_failed,
            driver_not_supported=job.driver_not_supported,
        ),
        results=[
            {
                "ip": result.ip,
                "credential_id": result.credential_id,
                "device_type": result.device_type,
                "hostname": result.hostname,
                "platform": result.platform,
                "debug_info": result.debug_info,
            }
            for result in job.results
        ],
    )


@router.delete("/{job_id}")
async def delete_scan_job(job_id: str, scan_service=Depends(get_scan_service)):
    """Delete a scan job (cleanup endpoint)."""
    job = await scan_service.get_job(job_id)

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Scan job not found"
        )

    # Remove job from service
    scan_service._jobs.pop(job_id, None)

    return {"message": f"Scan job {job_id} deleted successfully"}


@router.get("/jobs")
async def list_scan_jobs(scan_service=Depends(get_scan_service)):
    """List all active scan jobs."""
    scan_service._purge_expired()

    jobs = []
    for job in scan_service._jobs.values():
        jobs.append(
            {
                "job_id": job.job_id,
                "state": job.state,
                "created": job.created,
                "total_targets": job.total_targets,
                "authenticated": job.authenticated,
            }
        )

    return {"jobs": jobs}
