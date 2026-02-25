from __future__ import annotations

import logging
import ipaddress
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, validator

from core.auth import require_permission
from services.network.scanning.scan import scan_service

"""API router for network scanning operations."""

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/scan", tags=["scan"])


# Request/Response Models
class ScanStartRequest(BaseModel):
    cidrs: List[str] = Field(
        ..., max_items=10, description="List of CIDR networks to scan"
    )
    credential_ids: Optional[List[int]] = Field(
        default=None,
        description="List of credential IDs to try (optional for ping-only mode)",
    )
    discovery_mode: str = Field(
        default="netmiko", description="Discovery mode: napalm, ssh-login, or netmiko"
    )
    ping_mode: str = Field(default="fping", description="Ping mode: ping or fping")
    parser_template_ids: Optional[List[int]] = Field(
        default=None,
        description="Template IDs to use for parsing 'show version' output (textfsm)",
    )

    @validator("cidrs")
    def validate_cidrs(cls, v: List[str]):
        if not v:
            raise ValueError("At least one CIDR required")

        cleaned = []
        seen = set()

        for cidr in v:
            try:
                network = ipaddress.ip_network(cidr, strict=False)
            except Exception:
                raise ValueError(f"Invalid CIDR format: {cidr}")

            # Enforce /22 minimum (max ~1024 hosts per spec)
            if network.prefixlen < 22:
                raise ValueError(f"CIDR too large (minimum /22): {cidr}")

            # Deduplicate
            if cidr not in seen:
                seen.add(cidr)
                cleaned.append(cidr)

        return cleaned

    @validator("credential_ids")
    def validate_credentials(cls, v: Optional[List[int]]):
        # Allow None or empty list for ping-only mode
        if v is None or len(v) == 0:
            return []
        return v

    @validator("discovery_mode")
    def validate_discovery_mode(cls, v: str):
        if v not in ["napalm", "ssh-login", "netmiko"]:
            raise ValueError(
                "discovery_mode must be 'napalm', 'ssh-login', or 'netmiko'"
            )
        return v

    @validator("ping_mode")
    def validate_ping_mode_for_no_credentials(cls, v: str, values: dict):
        # Validate ping_mode value
        if v not in ["ping", "fping"]:
            raise ValueError("ping_mode must be 'ping' or 'fping'")

        # If no credentials provided, enforce fping mode
        credential_ids = values.get("credential_ids")
        if (credential_ids is None or len(credential_ids) == 0) and v != "fping":
            # Auto-correct to fping for ping-only mode
            return "fping"
        return v


class ScanStartResponse(BaseModel):
    job_id: str
    total_targets: int
    state: str


class ScanProgress(BaseModel):
    total: int
    scanned: int
    alive: int
    authenticated: int
    unreachable: int
    auth_failed: int
    driver_not_supported: int


class ScanStatusResponse(BaseModel):
    job_id: str
    state: str
    progress: ScanProgress
    results: List[Dict[str, Any]]


# API Endpoints
@router.post("/start", response_model=ScanStartResponse)
async def start_scan(
    request: ScanStartRequest,
    current_user: dict = Depends(require_permission("scan", "execute")),
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
            f"Starting scan job with CIDRs: {request.cidrs}, credentials: {credential_ids}, mode: {request.discovery_mode}, ping_mode: {request.ping_mode}, template id: {request.parser_template_ids}, debug: {debug_enabled}"
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
        logger.error(f"Failed to start scan: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start scan: {str(e)}",
        )


@router.get("/{job_id}/status", response_model=ScanStatusResponse)
async def get_scan_status(job_id: str):
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
async def delete_scan_job(job_id: str):
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
async def list_scan_jobs():
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
