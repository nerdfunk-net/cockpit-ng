"""
Background job service for NB2CMK device synchronization operations.
Handles async processing of device comparisons to prevent HTTP timeouts.
"""

from __future__ import annotations
import asyncio
import logging
from typing import Dict, Optional
from fastapi import HTTPException, status

from services.nb2cmk_database_service import nb2cmk_db_service, JobStatus
from services.nb2cmk_base_service import nb2cmk_service
from models.nb2cmk import JobStartResponse, JobProgressResponse, JobResultsResponse

logger = logging.getLogger(__name__)


class NB2CMKBackgroundService:
    """Service for managing background NB2CMK jobs."""

    def __init__(self):
        self._running_jobs: Dict[str, asyncio.Task] = {}
        self._shutdown = False

    async def start_devices_diff_job(
        self, username: Optional[str] = None
    ) -> JobStartResponse:
        """Start a background job to get device differences."""

        # Check if there's already an active job
        active_job = nb2cmk_db_service.get_active_job()
        if active_job:
            return JobStartResponse(
                job_id=active_job.job_id,
                status=active_job.status,
                message=f"Job {active_job.job_id} is already {active_job.status.value}",
            )

        # Create new job
        job_id = nb2cmk_db_service.create_job(username)

        # Start background task
        task = asyncio.create_task(self._process_devices_diff(job_id))
        self._running_jobs[job_id] = task

        # Don't await the task - let it run in background
        logger.info(f"Started background NB2CMK job {job_id}")

        return JobStartResponse(
            job_id=job_id,
            status=JobStatus.PENDING,
            message=f"Background device comparison job started with ID {job_id}",
        )

    async def get_job_progress(self, job_id: str) -> JobProgressResponse:
        """Get progress information for a job."""
        job = nb2cmk_db_service.get_job(job_id)

        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Job {job_id} not found"
            )

        return JobProgressResponse(
            job_id=job.job_id,
            status=job.status,
            processed_devices=job.processed_devices,
            total_devices=job.total_devices,
            progress_message=job.progress_message,
            created_at=job.created_at,
            started_at=job.started_at,
            completed_at=job.completed_at,
            error_message=job.error_message,
        )

    async def get_job_results(self, job_id: str) -> JobResultsResponse:
        """Get complete results for a completed job."""
        job = nb2cmk_db_service.get_job(job_id)

        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Job {job_id} not found"
            )

        if job.status not in [JobStatus.COMPLETED, JobStatus.FAILED]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Job {job_id} is {job.status.value}, results not available yet",
            )

        # Get device results from database
        device_results = nb2cmk_db_service.get_job_results(job_id)

        # Transform to frontend format (same as DeviceListWithStatus)
        devices = []
        for result in device_results:
            device_info = {
                "id": result.device_id,
                "name": result.device_name,
                "checkmk_status": result.checkmk_status,
                "diff": result.diff,
                "normalized_config": result.normalized_config,
                "checkmk_config": result.checkmk_config,
                # Add any additional fields that might be needed by frontend
                "role": "",  # These would need to be stored if needed
                "location": "",
                "status": "",
            }
            devices.append(device_info)

        message = (
            f"Retrieved {len(devices)} device comparison results from job {job_id}"
        )
        if job.status == JobStatus.FAILED:
            message = f"Job {job_id} failed: {job.error_message}"

        return JobResultsResponse(
            job_id=job_id,
            status=job.status,
            devices=devices,
            total=len(devices),
            message=message,
        )

    async def cancel_job(self, job_id: str) -> bool:
        """Cancel a running job."""
        # Cancel the background task if it's running
        if job_id in self._running_jobs:
            task = self._running_jobs[job_id]
            task.cancel()
            del self._running_jobs[job_id]

        # Update job status in database
        return nb2cmk_db_service.update_job_status(job_id, JobStatus.CANCELLED)

    async def _process_devices_diff(self, job_id: str) -> None:
        """Background task to process all device differences."""
        try:
            logger.info(f"Starting device comparison processing for job {job_id}")

            # Update job to running
            nb2cmk_db_service.update_job_status(job_id, JobStatus.RUNNING)

            # Get all devices from Nautobot first
            logger.info(f"Job {job_id}: Fetching devices from Nautobot")
            nb2cmk_db_service.update_job_progress(
                job_id, 0, 0, "Fetching devices from Nautobot..."
            )

            # Use the existing service to get devices
            from services.nautobot import nautobot_service

            query = """
            query all_devices {
              devices {
                id
                name
                role {
                  name
                }
                location {
                  name
                }
                status {
                  name
                }
              }
            }
            """

            result = await nautobot_service.graphql_query(query, {})
            if "errors" in result:
                error_msg = f"GraphQL errors: {result['errors']}"
                logger.error(f"Job {job_id}: {error_msg}")
                nb2cmk_db_service.update_job_status(job_id, JobStatus.FAILED, error_msg)
                return

            nautobot_devices = result["data"]["devices"]
            total_devices = len(nautobot_devices)

            logger.info(f"Job {job_id}: Processing {total_devices} devices")
            nb2cmk_db_service.update_job_progress(
                job_id,
                0,
                total_devices,
                f"Starting comparison of {total_devices} devices",
            )

            processed_count = 0

            # Process each device
            for device in nautobot_devices:
                try:
                    # Check if job was cancelled
                    if self._shutdown:
                        logger.info(f"Job {job_id}: Cancelled during processing")
                        nb2cmk_db_service.update_job_status(job_id, JobStatus.CANCELLED)
                        return

                    device_id = str(device.get("id", ""))
                    device_name = device.get("name", "")

                    if not device_id:
                        processed_count += 1
                        continue

                    logger.debug(
                        f"Job {job_id}: Processing device {device_name} ({device_id})"
                    )

                    # Build device info
                    device_info = {
                        "id": device_id,
                        "name": device_name,
                        "role": device.get("role", {}).get("name", "")
                        if device.get("role")
                        else "",
                        "status": device.get("status", {}).get("name", "")
                        if device.get("status")
                        else "",
                        "location": device.get("location", {}).get("name", "")
                        if device.get("location")
                        else "",
                        "checkmk_status": "unknown",
                    }

                    # Try to get comparison for this device
                    try:
                        comparison_result = await nb2cmk_service.compare_device_config(
                            device_id
                        )
                        device_info["checkmk_status"] = comparison_result.result
                        device_info["diff"] = comparison_result.diff
                        device_info["normalized_config"] = (
                            comparison_result.normalized_config
                        )
                        device_info["checkmk_config"] = comparison_result.checkmk_config

                        # Map host_not_found to missing for frontend consistency
                        if device_info["checkmk_status"] == "host_not_found":
                            device_info["checkmk_status"] = "missing"

                    except HTTPException as http_exc:
                        if http_exc.status_code == 404:
                            logger.debug(
                                f"Job {job_id}: Device {device_name} not found in CheckMK"
                            )
                            device_info["checkmk_status"] = "missing"
                            device_info["diff"] = (
                                f"Host '{device_name}' not found in CheckMK"
                            )
                            device_info["normalized_config"] = {}
                            device_info["checkmk_config"] = None
                        else:
                            logger.warning(
                                f"Job {job_id}: HTTP error comparing device {device_name}: {http_exc}"
                            )
                            device_info["checkmk_status"] = "error"
                            device_info["diff"] = f"Error: {http_exc.detail}"
                            device_info["normalized_config"] = {}
                            device_info["checkmk_config"] = None

                    except Exception as e:
                        logger.warning(
                            f"Job {job_id}: Error comparing device {device_name}: {e}"
                        )
                        device_info["checkmk_status"] = "error"
                        device_info["diff"] = f"Comparison error: {str(e)}"
                        device_info["normalized_config"] = {}
                        device_info["checkmk_config"] = None

                    # Store result in database
                    nb2cmk_db_service.add_device_result(
                        job_id=job_id,
                        device_id=device_id,
                        device_name=device_name,
                        checkmk_status=device_info["checkmk_status"],
                        diff=device_info.get("diff", ""),
                        normalized_config=device_info.get("normalized_config", {}),
                        checkmk_config=device_info.get("checkmk_config"),
                    )

                    processed_count += 1

                    # Update progress more frequently for better UX
                    # For small device counts (<=20), update every device
                    # For larger counts, update every 5 devices or at the end
                    update_frequency = 1 if total_devices <= 20 else 5
                    if (
                        processed_count % update_frequency == 0
                        or processed_count == total_devices
                    ):
                        progress_msg = (
                            f"Processed {processed_count} of {total_devices} devices"
                        )
                        logger.info(f"Job {job_id}: {progress_msg}")
                        nb2cmk_db_service.update_job_progress(
                            job_id, processed_count, total_devices, progress_msg
                        )

                    # Small delay to prevent overwhelming the system
                    await asyncio.sleep(0.1)

                except Exception as e:
                    logger.error(
                        f"Job {job_id}: Error processing device {device.get('name', 'unknown')}: {e}"
                    )
                    processed_count += 1
                    # Update progress even on errors to show we're still working
                    update_frequency = 1 if total_devices <= 20 else 5
                    if (
                        processed_count % update_frequency == 0
                        or processed_count == total_devices
                    ):
                        progress_msg = f"Processed {processed_count} of {total_devices} devices (with errors)"
                        logger.info(f"Job {job_id}: {progress_msg}")
                        nb2cmk_db_service.update_job_progress(
                            job_id, processed_count, total_devices, progress_msg
                        )
                    continue

            # Mark job as completed with final progress update
            completion_msg = (
                f"Completed device comparison for {processed_count} devices"
            )
            logger.info(f"Job {job_id}: {completion_msg}")

            # Ensure final progress is updated
            nb2cmk_db_service.update_job_progress(
                job_id, processed_count, total_devices, completion_msg
            )
            nb2cmk_db_service.update_job_status(job_id, JobStatus.COMPLETED)

        except asyncio.CancelledError:
            logger.info(f"Job {job_id}: Cancelled")
            nb2cmk_db_service.update_job_status(job_id, JobStatus.CANCELLED)
            raise

        except Exception as e:
            error_msg = f"Unexpected error in background job: {str(e)}"
            logger.error(f"Job {job_id}: {error_msg}")
            # Try to preserve progress information even on failure
            try:
                if "processed_count" in locals() and "total_devices" in locals():
                    nb2cmk_db_service.update_job_progress(
                        job_id,
                        processed_count,
                        total_devices,
                        f"Failed after processing {processed_count} devices: {error_msg}",
                    )
            except Exception:
                pass  # Don't let progress update failures mask the original error
            nb2cmk_db_service.update_job_status(job_id, JobStatus.FAILED, error_msg)

        finally:
            # Clean up task from running jobs
            if job_id in self._running_jobs:
                del self._running_jobs[job_id]

    async def cleanup_old_jobs(self, days_old: int = 7) -> int:
        """Clean up old completed jobs."""
        return nb2cmk_db_service.cleanup_old_jobs(days_old)

    async def shutdown(self):
        """Gracefully shutdown background service."""
        self._shutdown = True

        # Cancel all running jobs
        for job_id, task in self._running_jobs.items():
            logger.info(f"Cancelling job {job_id} during shutdown")
            task.cancel()

        # Wait for tasks to complete
        if self._running_jobs:
            await asyncio.gather(*self._running_jobs.values(), return_exceptions=True)

        self._running_jobs.clear()


# Global instance
nb2cmk_background_service = NB2CMKBackgroundService()
