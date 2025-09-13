"""
APScheduler-based job service for testing parallel job execution.
This runs alongside the existing nb2cmk_background_service for comparison.
"""

from __future__ import annotations
import asyncio
import logging
import uuid
import os
from datetime import datetime
from typing import Dict, Any, Optional, List
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.executors.asyncio import AsyncIOExecutor
from apscheduler.events import EVENT_JOB_EXECUTED, EVENT_JOB_ERROR, EVENT_JOB_REMOVED

from services.job_database_service import job_db_service, JobStatus, JobType
from services.nb2cmk_base_service import nb2cmk_service
from models.job_models import JobStartResponse

logger = logging.getLogger(__name__)


# Standalone function to cleanup old jobs - avoid scheduler serialization issues
async def cleanup_old_jobs_standalone(service_id: str, cleanup_after_days: int):
    """
    Standalone function to clean up old completed jobs.
    This function runs outside the class to avoid serialization issues.
    """
    try:
        from main import apscheduler_service

        if not apscheduler_service:
            logger.warning("APScheduler service not available for cleanup")
            return


        # Get all jobs from scheduler
        all_jobs = apscheduler_service.scheduler.get_jobs()
        cleaned_count = 0

        for job in all_jobs:
            # Skip the cleanup job itself
            if job.id == "cleanup_jobs":
                continue

            # Check if job is old enough to clean up
            try:
                # This is a simple cleanup - remove completed jobs that are not recent
                # In a production system, you might want to check the database for job status
                if (
                    job.next_run_time is None
                ):  # Job has no scheduled next run (likely completed)
                    apscheduler_service.scheduler.remove_job(job.id)
                    cleaned_count += 1
                    logger.debug(f"Cleaned up old job: {job.id}")
            except Exception as job_error:
                logger.error(f"Error cleaning up job {job.id}: {job_error}")

        if cleaned_count > 0:
            logger.info(f"Cleaned up {cleaned_count} old jobs")

    except Exception as e:
        logger.error(f"Error during job cleanup: {e}")


# Standalone function to avoid scheduler serialization issues
async def execute_devices_compare_standalone(
    job_id: str, devices: List[Dict[str, str]], max_concurrent: int, username: str
):
    """
    Standalone function to execute parallel device diff jobs.
    This function runs outside the class to avoid serialization issues.
    """
    # Get fresh service instances
    from services.job_database_service import job_db_service
    from services.nb2cmk_base_service import nb2cmk_service

    # Validate and sanitize inputs
    max_concurrent = max(1, min(max_concurrent, 10))  # Limit between 1-10
    devices = devices or []

    # If no devices provided, complete the job successfully
    if not devices:
        logger.info(f"Job {job_id}: No devices provided, completing job successfully")
        job_db_service.update_job_status(
            job_id, JobStatus.COMPLETED, "No devices to process"
        )
        return

    try:
        logger.info(
            f"Starting parallel device diff job {job_id} with {len(devices)} devices, max_concurrent={max_concurrent}"
        )

        # Update job status to running
        job_db_service.update_job_status(job_id, JobStatus.RUNNING)

        # Use semaphore for concurrency control with proper resource management
        semaphore = asyncio.Semaphore(max_concurrent)
        processed_count = 0

        async def process_single_device(device: Dict[str, str]) -> Dict[str, Any]:
            nonlocal processed_count

            async with semaphore:
                try:
                    device_id = device.get("id", "unknown")
                    device_name = device.get("name", "unknown")
                    
                    logger.info(
                        f"Job {job_id}: Processing device {device_name} (ID: {device_id}) ({processed_count + 1}/{len(devices)})"
                    )

                    # Update progress
                    processed_count += 1
                    job_db_service.update_job_progress(
                        job_id,
                        processed_count,
                        len(devices),
                        f"Processing device {device_name} ({processed_count}/{len(devices)})",
                    )

                    # Call actual device config comparison logic with device ID
                    comparison_result = await asyncio.wait_for(
                        nb2cmk_service.compare_device_config(device_id), 
                        timeout=30.0
                    )  # 30s timeout

                    # Extract comparison status and details
                    comparison_status = comparison_result.status if hasattr(comparison_result, 'status') else 'unknown'
                    
                    return {
                        "device": device_id,  # Keep device ID for compatibility
                        "device_name": device_name,  # Add device name for frontend display
                        "status": "completed",
                        "timestamp": datetime.now().isoformat(),
                        "comparison_result": comparison_status,  # This will be used for CheckMK Status column
                        "data": comparison_result.model_dump() if hasattr(comparison_result, 'model_dump') else str(comparison_result),
                    }

                except asyncio.TimeoutError:
                    device_id = device.get("id", "unknown")
                    device_name = device.get("name", "unknown")
                    logger.error(f"Job {job_id}: Device {device_name} (ID: {device_id}) processing timed out")
                    return {
                        "device": device_id,
                        "device_name": device_name,
                        "status": "timeout",
                        "timestamp": datetime.now().isoformat(),
                        "comparison_result": "timeout",
                        "error": "Processing timeout",
                    }
                except Exception as e:
                    device_id = device.get("id", "unknown")
                    device_name = device.get("name", "unknown")
                    logger.error(
                        f"Job {job_id}: Device {device_name} (ID: {device_id}) processing failed: {e}"
                    )
                    return {
                        "device": device_id,
                        "device_name": device_name,
                        "status": "error",
                        "timestamp": datetime.now().isoformat(),
                        "comparison_result": "error",
                        "error": str(e),
                    }

        # Process all devices in parallel with proper exception handling
        device_results = await asyncio.gather(
            *[process_single_device(device) for device in devices],
            return_exceptions=True,
        )

        # Collect and categorize results
        successful_results = []
        failed_results = []
        timeout_results = []

        for i, result in enumerate(device_results):
            if isinstance(result, Exception):
                device = devices[i] if i < len(devices) else {"id": "unknown", "name": "unknown"}
                failed_results.append(
                    {"device": device.get("id", "unknown"), "device_name": device.get("name", "unknown"), "error": str(result), "type": "exception"}
                )
                logger.error(
                    f"Job {job_id}: Device {device.get('name', 'unknown')} (ID: {device.get('id', 'unknown')}) failed with exception: {result}"
                )
            elif isinstance(result, dict):
                if result.get("status") == "completed":
                    successful_results.append(result)
                    logger.info(
                        f"Job {job_id}: Device {result.get('device_name', result.get('device', 'unknown'))} completed successfully"
                    )
                elif result.get("status") == "timeout":
                    timeout_results.append(result)
                    logger.warning(f"Job {job_id}: Device {result.get('device_name', result.get('device', 'unknown'))} timed out")
                else:
                    failed_results.append(result)
                    logger.error(
                        f"Job {job_id}: Device {result.get('device_name', result.get('device', 'unknown'))} failed: {result.get('error', 'Unknown error')}"
                    )
            else:
                device = devices[i] if i < len(devices) else {"id": "unknown", "name": "unknown"}
                failed_results.append(
                    {
                        "device": device.get("id", "unknown"),
                        "device_name": device.get("name", "unknown"),
                        "error": "Unexpected result format",
                        "type": "format_error",
                    }
                )

        # Determine final job status
        total_failed = len(failed_results) + len(timeout_results)
        if total_failed == 0:
            final_status = JobStatus.COMPLETED
        elif len(successful_results) > 0:
            final_status = (
                JobStatus.COMPLETED
            )  # Partial success still counts as completed
        else:
            final_status = JobStatus.FAILED

        # Store device results in database
        for result in successful_results + failed_results + timeout_results:
            job_db_service.add_device_result(
                job_id=job_id,
                device_name=result.get("device_name", result["device"]),  # Use device_name if available, fallback to device ID
                status=result.get("status", "unknown"),
                result_data={
                    "data": result.get("data", ""),
                    "timestamp": result.get("timestamp"),
                    "type": result.get("type", "device_comparison"),
                },
                error_message=result.get("error"),
            )

        # Update final job progress and status
        summary_message = f"Completed: {len(successful_results)}, Failed: {len(failed_results)}, Timeout: {len(timeout_results)}"
        job_db_service.update_job_progress(
            job_id, len(devices), len(devices), summary_message
        )

        error_message = None
        if total_failed > 0:
            error_message = f"{total_failed} devices failed/timed out"

        job_db_service.update_job_status(job_id, final_status, error_message)

        logger.info(f"Job {job_id} completed: {summary_message}")

    except Exception as e:
        logger.error(f"Job {job_id} failed with exception: {e}")
        job_db_service.update_job_status(job_id, JobStatus.FAILED, str(e))
        raise


# Standalone function to fetch and cache all devices
async def execute_get_all_devices_standalone(job_id: str, username: str):
    """
    Standalone function to fetch all device properties from Nautobot and cache them.
    This function runs outside the class to avoid serialization issues.
    """
    try:
        logger.info(f"Starting device caching job {job_id}")
        
        # Get fresh service instances
        from services.job_database_service import job_db_service
        from services.nautobot import nautobot_service
        from services.cache_service import cache_service
        
        # Update job status to running
        job_db_service.update_job_status(job_id, JobStatus.RUNNING)
        
        # GraphQL query to fetch all devices with essential properties
        query = """
        query getAllDevices {
          devices {
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
              manufacturer {
                name
              }
            }
            platform {
              name
            }
            serial
            asset_tag
            comments
          }
        }
        """
        
        # Execute the GraphQL query
        logger.info(f"Job {job_id}: Fetching all devices from Nautobot...")
        result = await nautobot_service.graphql_query(query, {})
        
        if "errors" in result:
            error_msg = f"GraphQL errors: {result['errors']}"
            logger.error(f"Job {job_id}: {error_msg}")
            job_db_service.update_job_status(job_id, JobStatus.FAILED, error_msg)
            return
            
        devices = result.get("data", {}).get("devices", [])
        total_devices = len(devices)
        
        if total_devices == 0:
            logger.warning(f"Job {job_id}: No devices found in Nautobot")
            job_db_service.update_job_status(job_id, JobStatus.COMPLETED, "No devices found to cache")
            return
            
        logger.info(f"Job {job_id}: Processing {total_devices} devices for caching")
        
        # Update job progress
        job_db_service.update_job_progress(job_id, 0, total_devices, "Starting device caching...")
        
        # Cache each device individually with a unique key
        cached_count = 0
        failed_count = 0
        
        for i, device in enumerate(devices):
            try:
                device_id = device.get("id")
                device_name = device.get("name", f"device_{i}")
                
                if not device_id:
                    logger.warning(f"Job {job_id}: Device {device_name} has no ID, skipping")
                    failed_count += 1
                    continue
                
                # Cache the device with a 1-hour TTL (3600 seconds)
                cache_key = f"nautobot:devices:{device_id}"
                cache_service.set(cache_key, device, 3600)
                cached_count += 1
                
                # Update progress periodically
                if (i + 1) % 50 == 0 or i == total_devices - 1:
                    progress_msg = f"Cached {cached_count} devices, failed {failed_count}"
                    job_db_service.update_job_progress(job_id, i + 1, total_devices, progress_msg)
                    logger.info(f"Job {job_id}: {progress_msg} ({i + 1}/{total_devices})")
                    
            except Exception as e:
                failed_count += 1
                logger.error(f"Job {job_id}: Failed to cache device {device.get('name', 'unknown')}: {e}")
        
        # Also cache devices as a bulk collection for quick access
        try:
            bulk_cache_key = "nautobot:devices:all"
            # Store a lightweight version with just essential info
            lightweight_devices = [
                {
                    "id": device.get("id"),
                    "name": device.get("name"),
                    "role": device.get("role", {}).get("name") if device.get("role") else None,
                    "location": device.get("location", {}).get("name") if device.get("location") else None,
                    "status": device.get("status", {}).get("name") if device.get("status") else None,
                    "primary_ip4": device.get("primary_ip4", {}).get("address") if device.get("primary_ip4") else None,
                    "device_type": device.get("device_type", {}).get("model") if device.get("device_type") else None
                }
                for device in devices
            ]
            cache_service.set(bulk_cache_key, lightweight_devices, 3600)
            logger.info(f"Job {job_id}: Cached bulk device collection with {len(lightweight_devices)} devices")
        except Exception as e:
            logger.error(f"Job {job_id}: Failed to cache bulk device collection: {e}")
        
        # Determine final status
        if failed_count == 0:
            final_status = JobStatus.COMPLETED
            summary = f"Successfully cached all {cached_count} devices"
        elif cached_count > 0:
            final_status = JobStatus.COMPLETED  # Partial success
            summary = f"Cached {cached_count} devices, {failed_count} failed"
        else:
            final_status = JobStatus.FAILED
            summary = f"Failed to cache any devices ({failed_count} failures)"
        
        # Final progress update
        job_db_service.update_job_progress(job_id, total_devices, total_devices, summary)
        job_db_service.update_job_status(job_id, final_status, None if final_status == JobStatus.COMPLETED else f"{failed_count} devices failed to cache")
        
        logger.info(f"Job {job_id} completed: {summary}")
        
    except Exception as e:
        logger.error(f"Job {job_id} failed with exception: {e}")
        job_db_service.update_job_status(job_id, JobStatus.FAILED, str(e))
        raise


class APSchedulerJobService:
    """APScheduler-based job service for parallel job execution."""

    def __init__(
        self,
        max_workers: int = 10,
        max_parallel_jobs: int = 5,
        data_dir: str = "./data/jobs",
        cleanup_after_days: int = 7,
    ):
        """
        Initialize APScheduler service.

        Args:
            max_workers: Maximum concurrent job instances
            max_parallel_jobs: Maximum parallel comparison jobs allowed
            data_dir: Directory for job database storage
            cleanup_after_days: Days after which to clean up old jobs
        """
        self.max_workers = max_workers
        self.max_parallel_jobs = max_parallel_jobs
        self.data_dir = data_dir
        self.cleanup_after_days = cleanup_after_days

        # Ensure data directory exists
        os.makedirs(data_dir, exist_ok=True)

        # Database path in data directory
        db_path = os.path.join(data_dir, "apscheduler_jobs.db")
        db_url = f"sqlite:///{db_path}"

        jobstores = {"default": SQLAlchemyJobStore(url=db_url)}
        executors = {"default": AsyncIOExecutor()}
        job_defaults = {
            "coalesce": False,
            "max_instances": max_workers,
            "misfire_grace_time": 60,
        }

        self.scheduler = AsyncIOScheduler(
            jobstores=jobstores, executors=executors, job_defaults=job_defaults
        )

        # Add event listeners
        self.scheduler.add_listener(
            self._job_listener, EVENT_JOB_EXECUTED | EVENT_JOB_ERROR | EVENT_JOB_REMOVED
        )

    async def start(self):
        """Start the scheduler and schedule cleanup job."""
        if not self.scheduler.running:
            self.scheduler.start()
            logger.info("APScheduler started")

            # Schedule daily cleanup job using standalone function
            self.scheduler.add_job(
                cleanup_old_jobs_standalone,
                "interval",
                hours=24,
                id="cleanup_jobs",
                args=["apscheduler", self.cleanup_after_days],
                replace_existing=True,
                max_instances=1,
            )
            logger.info("Scheduled daily job cleanup task")

    async def shutdown(self):
        """Shutdown the scheduler."""
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)
            logger.info("APScheduler shutdown")

    def _job_listener(self, event):
        """Handle APScheduler job events."""
        job_id = event.job_id

        # Check if this is an error event (different event types have different attributes)
        if hasattr(event, "exception") and event.exception:
            logger.error(f"APScheduler job {job_id} failed: {event.exception}")
            # Update database status if needed
            try:
                job_db_service.update_job_status(
                    job_id, JobStatus.FAILED, str(event.exception)
                )
            except Exception as e:
                logger.error(f"Failed to update job status for {job_id}: {e}")
        elif event.code == EVENT_JOB_ERROR:
            logger.error(f"APScheduler job {job_id} encountered an error")
            try:
                job_db_service.update_job_status(
                    job_id, JobStatus.FAILED, "Job execution error"
                )
            except Exception as e:
                logger.error(f"Failed to update job status for {job_id}: {e}")
        elif event.code == EVENT_JOB_EXECUTED:
            logger.info(f"APScheduler job {job_id} completed successfully")
        elif event.code == EVENT_JOB_REMOVED:
            logger.info(f"APScheduler job {job_id} was removed from scheduler")

    async def start_devices_compare_job(
        self,
        username: Optional[str] = None,
        devices: Optional[List[str]] = None,
        max_concurrent: int = 2,
        job_prefix: str = "aps",
    ) -> JobStartResponse:
        """Start multiple parallel device comparison jobs using APScheduler."""

        # Check current running jobs (use configurable limit)
        running_jobs = len(
            [job for job in self.scheduler.get_jobs() if job.id.startswith(job_prefix)]
        )
        if running_jobs >= self.max_parallel_jobs:
            return JobStartResponse(
                job_id="",
                status=JobStatus.FAILED,
                message=f"Too many parallel jobs running ({running_jobs}/{self.max_parallel_jobs}). Please wait.",
            )

        # Handle empty devices list - fetch all devices from Nautobot
        if not devices:
            try:
                logger.info(
                    "No devices specified, fetching all devices from Nautobot..."
                )
                devices_result = await nb2cmk_service.get_devices_for_sync()
                if devices_result and hasattr(devices_result, "devices"):
                    # Create device mapping with both ID and name for processing
                    devices = [
                        {
                            "id": device.get("id", device.get("name", str(i))),
                            "name": device.get("name", device.get("id", f"device_{i}"))
                        }
                        for i, device in enumerate(devices_result.devices)
                    ]
                    logger.info(
                        f"Fetched {len(devices)} devices from Nautobot for processing"
                    )
                else:
                    devices = []
                    logger.warning(
                        "Could not fetch devices from Nautobot, using empty devices list"
                    )
            except Exception as e:
                logger.error(f"Error fetching devices from Nautobot: {e}")
                devices = []

        # Create job ID
        job_id = f"{job_prefix}_{uuid.uuid4().hex[:8]}"

        # Create job in database
        job_db_service.create_job(
            job_id=job_id,
            job_type=JobType.DEVICE_COMPARISON,
            started_by=username,
            metadata={"devices": devices, "max_concurrent": max_concurrent},
        )

        # Schedule the job
        self.scheduler.add_job(
            execute_devices_compare_standalone,
            "date",
            run_date=datetime.now(),
            id=job_id,
            args=[job_id, devices, max_concurrent, username],
            max_instances=1,
        )

        logger.info(f"Started APScheduler job {job_id} for {len(devices)} devices")

        return JobStartResponse(
            job_id=job_id,
            status=JobStatus.PENDING,
            message=f"APScheduler job started with ID {job_id} for {len(devices)} devices",
        )

    async def start_get_all_devices_job(
        self,
        username: Optional[str] = None,
        job_prefix: str = "dev_cache",
    ) -> JobStartResponse:
        """Start a background job to fetch and cache all device properties from Nautobot."""
        
        # Check if there's already a device caching job running
        running_jobs = [
            job for job in self.scheduler.get_jobs() 
            if job.id.startswith(job_prefix) or job.id.startswith("device_cache")
        ]
        
        if running_jobs:
            return JobStartResponse(
                job_id="",
                status=JobStatus.FAILED,
                message="Device caching job already running. Please wait for it to complete.",
            )
        
        # Create job ID
        job_id = f"{job_prefix}_{uuid.uuid4().hex[:8]}"
        
        # Create job in database
        job_db_service.create_job(
            job_id=job_id,
            job_type=JobType.DEVICE_CACHE,
            started_by=username,
            metadata={"operation": "cache_all_devices"},
        )
        
        # Schedule the job
        self.scheduler.add_job(
            execute_get_all_devices_standalone,
            "date",
            run_date=datetime.now(),
            id=job_id,
            args=[job_id, username],
            max_instances=1,
        )
        
        logger.info(f"Started device caching job {job_id}")
        
        return JobStartResponse(
            job_id=job_id,
            status=JobStatus.PENDING,
            message=f"Device caching job started with ID {job_id}",
        )

    def cleanup_jobs_now(self) -> Dict[str, Any]:
        """Manually trigger job cleanup and return results."""
        try:
            all_jobs = self.scheduler.get_jobs()
            initial_count = len(all_jobs)

            cleaned_count = 0
            for job in all_jobs:
                if job.id == "cleanup_jobs":
                    continue

                if job.next_run_time is None:
                    try:
                        self.scheduler.remove_job(job.id)
                        cleaned_count += 1
                    except Exception as job_error:
                        logger.error(f"Error cleaning up job {job.id}: {job_error}")

            return {
                "initial_jobs": initial_count,
                "cleaned_jobs": cleaned_count,
                "remaining_jobs": len(self.scheduler.get_jobs()),
                "cleanup_date": datetime.now().isoformat(),
            }

        except Exception as e:
            logger.error(f"Manual cleanup failed: {e}")
            return {"error": str(e), "cleanup_date": datetime.now().isoformat()}

    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get APScheduler job status."""
        try:
            job = self.scheduler.get_job(job_id)
            if job:
                return {
                    "id": job.id,
                    "name": job.name or job.func.__name__ if job.func else "unknown",
                    "next_run": job.next_run_time.isoformat()
                    if job.next_run_time
                    else None,
                    "trigger": str(job.trigger),
                }
            return None
        except Exception as e:
            logger.error(f"Error getting job status for {job_id}: {e}")
            return None

    def cancel_job(self, job_id: str) -> bool:
        """Cancel an APScheduler job."""
        try:
            self.scheduler.remove_job(job_id)
            # Update database status
            job_db_service.update_job_status(job_id, JobStatus.CANCELLED)
            logger.info(f"Cancelled APScheduler job {job_id}")
            return True
        except Exception as e:
            logger.error(f"Error cancelling job {job_id}: {e}")
            return False

    def get_scheduler_status(self) -> Dict[str, Any]:
        """Get overall scheduler status and running jobs."""
        try:
            running_jobs = self.scheduler.get_jobs()

            return {
                "scheduler_running": self.scheduler.running,
                "total_jobs": len(running_jobs),
                "jobs": [
                    {
                        "id": job.id,
                        "name": job.name or job.func.__name__
                        if job.func
                        else "unknown",
                        "next_run": job.next_run_time.isoformat()
                        if job.next_run_time
                        else None,
                        "trigger": str(job.trigger),
                    }
                    for job in running_jobs
                ],
            }
        except Exception as e:
            logger.error(f"Error getting scheduler status: {e}")
            return {
                "scheduler_running": False,
                "total_jobs": 0,
                "jobs": [],
                "error": str(e),
            }


# Global instance (will be initialized in main.py)
apscheduler_service: Optional[APSchedulerJobService] = None
