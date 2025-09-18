"""
Job management router for APScheduler-based parallel job execution.
Provides endpoints for creating, monitoring, and managing background jobs.
"""

from __future__ import annotations
import logging
import time
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, validator

from core.auth import verify_token
from models.job_models import JobStartResponse, Job, JobListResponse, JobDetailResponse, NetworkScanRequest, NetworkScanResponse
from services.apscheduler_job_service import APSchedulerJobService
from services.job_database_service import job_db_service, JobType, JobStatus
from services.cache_service import cache_service
from services.network_scan_service import network_scan_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/jobs", tags=["jobs"])


# Helper functions for device data enrichment
def _get_device_cache_key(device_id: str) -> str:
    """Generate cache key for individual device."""
    return f"nautobot:devices:{device_id}"


async def _get_device_data_from_cache_or_nautobot(device_name: str) -> Optional[dict]:
    """Fetch device data using device name, preferring cache over GraphQL query.
    
    This first tries to find the device in the cache by searching through all 
    cached devices, then falls back to GraphQL query if not found in cache.
    """
    try:
        # First, try to find the device in the main device cache
        # We need to check cache keys that might contain this device
        cache_stats = cache_service.get_namespace_info("nautobot:devices")
        
        if cache_stats.get("valid_entries", 0) > 0:
            # Look through cached devices for a name match
            for entry in cache_stats.get("entries", []):
                if not entry.get("is_expired", False):
                    cached_device = cache_service.get(entry["key"])
                    if cached_device and cached_device.get("name") == device_name:
                        logger.debug(f"Found cached device data for {device_name}")
                        return cached_device
        
        # If not in cache, query Nautobot and cache the result
        logger.debug(f"Device {device_name} not in cache, querying Nautobot")
        
        from services.nautobot import nautobot_service
        
        # Query Nautobot for the device
        query = """
        query findDeviceByName($name: [String]) {
          devices(name: $name) {
            id
            name
            role {
              name
            }
            location {
              name
            }
            primary_ip4 {
              address
            }
            status {
              name
            }
            device_type {
              model
            }
          }
        }
        """
        variables = {"name": [device_name]}
        result = await nautobot_service.graphql_query(query, variables)
        
        if "errors" in result:
            logger.warning(f"GraphQL errors fetching device {device_name}: {result['errors']}")
            return None
            
        devices = result.get("data", {}).get("devices", [])
        if not devices:
            logger.warning(f"Device {device_name} not found in Nautobot")
            return None
            
        # Get the first matching device and cache it
        device = devices[0]
        device_id = device.get("id")
        if device_id:
            cache_key = _get_device_cache_key(device_id)
            cache_service.set(cache_key, device, 30 * 60)  # 30 minutes TTL
            logger.debug(f"Cached device data for {device_name} (ID: {device_id})")
        
        logger.debug(f"Found device data for {device_name}: role={device.get('role', {}).get('name')}, location={device.get('location', {}).get('name')}")
        return device
        
    except Exception as e:
        logger.error(f"Error fetching device data for {device_name}: {str(e)}")
        return None


async def _enrich_device_results_with_nautobot_data(device_results: List[dict]) -> List[dict]:
    """Enrich device results with additional data from Nautobot.
    
    For each device result, try to get additional device data (role, location, status)
    from the cache first, then from Nautobot if not cached.
    """
    enriched_results = []
    
    for result in device_results:
        device_name = result.get("device_name")
        if not device_name:
            enriched_results.append(result)
            continue
            
        # Try to get additional device data (preferring cache)
        device_data = await _get_device_data_from_cache_or_nautobot(device_name)
        
        # Create enriched result
        enriched_result = result.copy()
        
        if device_data:
            # Add the additional fields the frontend expects
            enriched_result.update({
                "device_id": device_data.get("id"),
                "role": device_data.get("role"),
                "location": device_data.get("location"), 
                "device_type": device_data.get("device_type"),
                "primary_ip4": device_data.get("primary_ip4"),
                "device_status": device_data.get("status")  # Use device_status to avoid conflict with job result status
            })
            logger.debug(f"Enriched device result for {device_name} with role, location, and status")
        else:
            # Add empty placeholders so frontend doesn't break
            enriched_result.update({
                "device_id": None,
                "role": None,
                "location": None,
                "device_type": None, 
                "primary_ip4": None,
                "device_status": None
            })
            logger.debug(f"Could not enrich device result for {device_name} - using placeholders")
            
        enriched_results.append(enriched_result)
    
    return enriched_results


# Dependency to get the scheduler service
def get_scheduler_service() -> APSchedulerJobService:
    from main import apscheduler_service
    if not apscheduler_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="APScheduler service is not available"
        )
    return apscheduler_service


# Request Models
class ParallelJobRequest(BaseModel):
    devices: List[str] = Field(default=[], max_items=50, description="List of devices to process (empty = all devices)")
    max_concurrent: int = Field(default=3, ge=1, le=10, description="Maximum concurrent device processing")
    
    @validator('devices')
    def validate_devices(cls, v):
        # Empty list is allowed - means "process all devices"
        if not v:
            return []
        # Remove duplicates while preserving order
        seen = set()
        unique_devices = []
        for device in v:
            if device not in seen:
                seen.add(device)
                unique_devices.append(device)
        return unique_devices


# APScheduler Job Management Endpoints

@router.post("/compare-devices", response_model=JobStartResponse)
async def start_devices_compare_job(
    request: ParallelJobRequest,
    current_user: dict = Depends(verify_token),
    scheduler_service: APSchedulerJobService = Depends(get_scheduler_service),
):
    """Start a parallel device comparison job using APScheduler"""
    try:
        username = current_user.get("sub", "unknown")
        result = await scheduler_service.start_devices_compare_job(
            username=username, 
            devices=request.devices, 
            max_concurrent=request.max_concurrent
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting APScheduler job: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start APScheduler job: {str(e)}",
        )


@router.get("/scheduler-status")
async def get_scheduler_status(
    _: dict = Depends(verify_token),
    scheduler_service: APSchedulerJobService = Depends(get_scheduler_service),
):
    """Get APScheduler status and running jobs"""
    try:
        return scheduler_service.get_scheduler_status()
    except Exception as e:
        logger.error(f"Error getting scheduler status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get scheduler status: {str(e)}",
        )


@router.delete("/{job_id}/cancel")
async def cancel_scheduler_job(
    job_id: str,
    _: dict = Depends(verify_token),
    scheduler_service: APSchedulerJobService = Depends(get_scheduler_service),
):
    """Cancel an APScheduler job"""
    try:
        # First check if job exists in database and its current status
        job = job_db_service.get_job(job_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job {job_id} not found"
            )
        
        # Check if job can be cancelled (must be running or pending)
        job_status = JobStatus(job["status"])
        if job_status not in [JobStatus.PENDING, JobStatus.RUNNING]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot cancel job {job_id} - job is {job_status.value}. Only pending or running jobs can be cancelled."
            )
        
        # Attempt to cancel in scheduler
        success = scheduler_service.cancel_job(job_id)
        if success:
            return {"message": f"APScheduler job {job_id} cancelled successfully"}
        else:
            # Job exists in database but not in scheduler - this is an orphaned job
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job {job_id} not found in scheduler. This job appears to be orphaned - it exists in the database but not in the scheduler. Something may have gone wrong in the background."
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling job {job_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel job {job_id}: {str(e)}",
        )


@router.post("/cleanup")
async def cleanup_old_jobs(
    _: dict = Depends(verify_token),
):
    """Clear all completed, failed, and cancelled jobs from the database"""
    try:
        result = job_db_service.clear_completed_jobs()
        return result
    except Exception as e:
        logger.error(f"Error during manual cleanup: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cleanup jobs: {str(e)}",
        )


# Job Database Endpoints (Independent of nb2cmk)

@router.get("/", response_model=JobListResponse)
async def get_jobs(
    limit: int = 100,
    _: dict = Depends(verify_token)
):
    """Get all jobs from the new job database"""
    try:
        jobs_data = job_db_service.get_jobs(limit=limit)
        
        # Convert to Pydantic models
        jobs = []
        for job_data in jobs_data:
            # Convert database format to Pydantic model format
            job_dict = {
                "id": job_data["id"],
                "type": job_data["type"],
                "status": job_data["status"],
                "started_by": job_data["started_by"],
                "started_at": job_data["started_at"],
                "completed_at": job_data["completed_at"],
                "progress": job_data.get("progress"),
                "result_summary": job_data["result_summary"],
                "error_message": job_data["error_message"],
                "metadata": job_data["metadata"],
                "device_results": []  # Will be populated in detail view
            }
            
            jobs.append(Job(**job_dict))
        
        return JobListResponse(jobs=jobs, total=len(jobs))
        
    except Exception as e:
        logger.error(f"Error fetching jobs: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch jobs: {str(e)}",
        )


@router.get("/{job_id}", response_model=JobDetailResponse)
async def get_job_details(
    job_id: str,
    _: dict = Depends(verify_token)
):
    """Get detailed job information including device results"""
    logger.info(f"=== JOB DETAILS REQUEST for job_id: {job_id} ===")
    try:
        job_data = job_db_service.get_job(job_id)
        
        if not job_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job {job_id} not found"
            )
        
        # Prepare basic device results from database
        basic_device_results = [
            {
                "id": result["id"],
                "job_id": result["job_id"],
                "device_name": result["device_name"],
                "status": result["status"],
                "result_data": result["result_data"],
                "error_message": result["error_message"],
                "processed_at": result["processed_at"]
            }
            for result in job_data["device_results"]
        ]
        
        # Enrich device results with additional data from Nautobot
        logger.info(f"=== STARTING ENRICHMENT: {len(basic_device_results)} device results ===")
        logger.info(f"Basic device results sample: {basic_device_results[0] if basic_device_results else 'No results'}")
        enriched_device_results = await _enrich_device_results_with_nautobot_data(basic_device_results)
        logger.info("=== ENRICHMENT COMPLETED ===")
        logger.info(f"Enriched device results sample: {enriched_device_results[0] if enriched_device_results else 'No results'}")
        logger.info(f"Enhanced fields added: {set(enriched_device_results[0].keys()) - set(basic_device_results[0].keys()) if enriched_device_results and basic_device_results else 'No comparison'}")
        
        # Convert database format to Pydantic model format
        job_dict = {
            "id": job_data["id"],
            "type": job_data["type"],
            "status": job_data["status"],
            "started_by": job_data["started_by"],
            "started_at": job_data["started_at"],
            "completed_at": job_data["completed_at"],
            "progress": {
                "processed": job_data.get("progress_current", 0),
                "total": job_data.get("progress_total", 0),
                "message": job_data.get("progress_message")
            } if job_data.get("progress_total", 0) > 0 else None,
            "result_summary": job_data["result_summary"],
            "error_message": job_data["error_message"],
            "metadata": job_data["metadata"],
            "device_results": enriched_device_results
        }
        
        job = Job(**job_dict)
        return JobDetailResponse(job=job)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching job {job_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch job {job_id}: {str(e)}",
        )


@router.delete("/{job_id}")
async def delete_job(
    job_id: str,
    _: dict = Depends(verify_token)
):
    """Delete a job and its results from the database"""
    try:
        success = job_db_service.delete_job(job_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job {job_id} not found or could not be deleted"
            )
        
        return {"message": f"Job {job_id} deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting job {job_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete job {job_id}: {str(e)}",
        )


@router.post("/get-all-devices", response_model=JobStartResponse)
async def start_get_all_devices_job(
    current_user: dict = Depends(verify_token),
    scheduler_service: APSchedulerJobService = Depends(get_scheduler_service),
):
    """Start a background job to fetch and cache all device properties from Nautobot"""
    try:
        username = current_user.get("sub", "unknown")
        result = await scheduler_service.start_get_all_devices_job(username=username)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting get-all-devices job: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start get-all-devices job: {str(e)}",
        )


@router.post("/scan-network/{cidr:path}", response_model=JobStartResponse)
async def start_network_scan_job(
    cidr: str,
    request: NetworkScanRequest,
    current_user: dict = Depends(verify_token),
    scheduler_service: APSchedulerJobService = Depends(get_scheduler_service),
):
    """Start a network scan job using ping or fping"""
    try:
        # Decode URL-encoded CIDR (e.g., %2F becomes /)
        import urllib.parse
        decoded_cidr = urllib.parse.unquote(cidr)
        
        # Validate CIDR format
        import ipaddress
        try:
            ipaddress.ip_network(decoded_cidr, strict=False)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid CIDR notation: {str(e)}"
            )
        
        username = current_user.get("sub", "unknown")
        
        logger.info(
            f"Starting network scan job for {decoded_cidr} with ping_mode={request.ping_mode}, "
            f"timeout={request.timeout}, max_concurrent={request.max_concurrent}"
        )
        
        # Create job in database
        job_id = f"network_scan_{int(time.time() * 1000)}"
        
        job_db_service.create_job(
            job_id=job_id,
            job_type=JobType.NETWORK_SCAN,
            started_by=username,
            metadata={
                "cidr": decoded_cidr,
                "ping_mode": request.ping_mode,
                "timeout": request.timeout,
                "max_concurrent": request.max_concurrent
            }
        )
        
        # Start the scan job
        scheduler_service.scheduler.add_job(
            func=_execute_network_scan,
            args=[job_id, decoded_cidr, request, username],
            id=job_id,
            name=f"Network Scan: {decoded_cidr}",
            misfire_grace_time=30
        )
        
        return JobStartResponse(
            job_id=job_id,
            status=JobStatus.PENDING,
            message=f"Network scan started for {decoded_cidr}"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting network scan job: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start network scan job: {str(e)}",
        )


async def _execute_network_scan(job_id: str, cidr: str, request: NetworkScanRequest, username: str):
    """Execute the network scan job"""
    try:
        logger.info(f"Executing network scan job {job_id} for {cidr}")
        
        # Update job status to running
        job_db_service.update_job_status(job_id, JobStatus.RUNNING)
        
        # Progress callback to update job progress
        async def progress_callback(progress):
            job_db_service.update_job_progress(
                job_id, 
                processed=progress.scanned, 
                total=progress.total,
                message=f"Scanning... {progress.alive} alive, {progress.unreachable} unreachable"
            )
        
        # Execute the network scan
        result = await network_scan_service.scan_network(
            cidr=cidr,
            ping_mode=request.ping_mode,
            max_concurrent=request.max_concurrent,
            timeout=request.timeout,
            progress_callback=progress_callback,
            scan_id=job_id
        )
        
        # Prepare result data
        result_data = {
            "cidr": result.cidr,
            "ping_mode": result.ping_mode,
            "total_targets": result.total_targets,
            "alive_hosts": result.alive_hosts,
            "unreachable_count": len(result.unreachable_hosts),
            "scan_duration": result.scan_duration,
            "started_at": result.started_at.isoformat(),
            "completed_at": result.completed_at.isoformat() if result.completed_at else None
        }
        
        if result.error_message:
            # Job failed
            job_db_service.update_job_status(
                job_id, 
                JobStatus.FAILED, 
                error_message=result.error_message
            )
            logger.error(f"Network scan job {job_id} failed: {result.error_message}")
        else:
            # Job completed successfully
            job_db_service.update_job_status(
                job_id, 
                JobStatus.COMPLETED
            )
            logger.info(
                f"Network scan job {job_id} completed: {len(result.alive_hosts)} alive, "
                f"{len(result.unreachable_hosts)} unreachable, {result.scan_duration:.2f}s"
            )
            
    except Exception as e:
        logger.error(f"Network scan job {job_id} failed with exception: {e}")
        job_db_service.update_job_status(
            job_id, 
            JobStatus.FAILED, 
            error_message=str(e)
        )
