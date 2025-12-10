"""
NB2CMK Database Service for job tracking and results storage.
Uses PostgreSQL via repositories for nb2cmk background job operations.
"""

from __future__ import annotations
import json
import uuid
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from enum import Enum
from repositories.nb2cmk_repository import (
    NB2CMKJobRepository,
    NB2CMKJobResultRepository,
)

logger = logging.getLogger(__name__)


class JobStatus(str, Enum):
    """Job status enumeration."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class NB2CMKJob:
    """NB2CMK background job data."""

    job_id: str
    status: JobStatus
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    total_devices: int = 0
    processed_devices: int = 0
    progress_message: str = ""
    user_id: Optional[str] = None
    error_message: Optional[str] = None


@dataclass
class DeviceJobResult:
    """Individual device comparison result within a job."""

    job_id: str
    device_id: str
    device_name: str
    checkmk_status: str  # equal, diff, missing, error
    diff: str
    normalized_config: Dict[str, Any]
    checkmk_config: Optional[Dict[str, Any]]
    ignored_attributes: List[str]
    processed_at: datetime


class NB2CMKDatabaseService:
    """Database service for NB2CMK background job operations."""

    def __init__(self, db_path: str = None):
        # db_path parameter kept for backward compatibility but not used
        # Initialize repositories
        self.job_repo = NB2CMKJobRepository()
        self.result_repo = NB2CMKJobResultRepository()
        logger.info("NB2CMK database service initialized with PostgreSQL repositories")

    def init_database(self) -> bool:
        """Database tables are auto-created by SQLAlchemy migrations."""
        # No-op for backward compatibility
        return True

    def create_job(
        self, username: Optional[str] = None, job_id: Optional[str] = None
    ) -> str:
        """Create a new background job and return job_id."""
        if job_id is None:
            job_id = str(uuid.uuid4())
        now = datetime.now()

        try:
            self.job_repo.create(
                job_id=job_id,
                status=JobStatus.PENDING.value,
                created_at=now,
                user_id=username,
                total_devices=0,
                processed_devices=0,
                progress_message="",
            )
            logger.info(f"Created NB2CMK job {job_id}")
            return job_id

        except Exception as e:
            logger.error(f"Error creating NB2CMK job: {e}")
            raise

    def get_job(self, job_id: str) -> Optional[NB2CMKJob]:
        """Get job by ID."""
        try:
            job_model = self.job_repo.get_by_job_id(job_id)
            if not job_model:
                return None

            return NB2CMKJob(
                job_id=job_model.job_id,
                status=JobStatus(job_model.status),
                created_at=job_model.created_at,
                started_at=job_model.started_at,
                completed_at=job_model.completed_at,
                total_devices=job_model.total_devices,
                processed_devices=job_model.processed_devices,
                progress_message=job_model.progress_message or "",
                user_id=job_model.user_id,
                error_message=job_model.error_message,
            )

        except Exception as e:
            logger.error(f"Error getting job {job_id}: {e}")
            return None

    def update_job_status(
        self, job_id: str, status: JobStatus, error_message: Optional[str] = None
    ) -> bool:
        """Update job status."""
        try:
            update_data = {"status": status.value}
            now = datetime.now()

            if status == JobStatus.RUNNING:
                update_data["started_at"] = now
            elif status in [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED]:
                update_data["completed_at"] = now

            if error_message is not None:
                update_data["error_message"] = error_message

            updated = self.job_repo.update(job_id, **update_data)
            return updated is not None

        except Exception as e:
            logger.error(f"Error updating job {job_id} status: {e}")
            return False

    def update_job_progress(
        self, job_id: str, processed_devices: int, total_devices: int, message: str = ""
    ) -> bool:
        """Update job progress."""
        try:
            updated = self.job_repo.update(
                job_id,
                processed_devices=processed_devices,
                total_devices=total_devices,
                progress_message=message,
            )
            return updated is not None

        except Exception as e:
            logger.error(f"Error updating job {job_id} progress: {e}")
            return False

    def add_device_result(
        self,
        job_id: str,
        device_id: str,
        device_name: str,
        checkmk_status: str,
        diff: str,
        normalized_config: Dict[str, Any],
        checkmk_config: Optional[Dict[str, Any]],
        ignored_attributes: Optional[List[str]] = None,
    ) -> bool:
        """Add a device result to the job."""
        try:
            logger.info(f"[DB_SERVICE] Device {device_name}: Received ignored_attributes = {ignored_attributes}")
            logger.info(f"[DB_SERVICE] Device {device_name}: Received diff = {diff}")

            ignored_attrs_json = json.dumps(ignored_attributes) if ignored_attributes else json.dumps([])
            logger.info(f"[DB_SERVICE] Device {device_name}: JSON ignored_attributes = {ignored_attrs_json}")

            self.result_repo.create(
                job_id=job_id,
                device_id=device_id,
                device_name=device_name,
                checkmk_status=checkmk_status,
                diff=diff,
                normalized_config=json.dumps(normalized_config),
                checkmk_config=json.dumps(checkmk_config) if checkmk_config else None,
                ignored_attributes=ignored_attrs_json,
                processed_at=datetime.now(),
            )

            logger.info(f"[DB_SERVICE] Device {device_name}: Successfully stored to database")
            return True

        except Exception as e:
            logger.error(f"[DB_SERVICE] Error adding device result for job {job_id}: {e}")
            return False

    def get_job_results(self, job_id: str) -> List[DeviceJobResult]:
        """Get all device results for a job."""
        try:
            result_models = self.result_repo.get_by_job_id(job_id)

            logger.info(f"[DB_SERVICE] Retrieved {len(result_models)} results from database for job {job_id}")

            results = []
            for row in result_models:
                logger.info(f"[DB_SERVICE] Device {row.device_name}: raw ignored_attributes from DB = {row.ignored_attributes}")
                logger.info(f"[DB_SERVICE] Device {row.device_name}: raw diff from DB = {row.diff}")

                ignored_attrs = json.loads(row.ignored_attributes) if row.ignored_attributes else []
                logger.info(f"[DB_SERVICE] Device {row.device_name}: parsed ignored_attributes = {ignored_attrs}")

                results.append(
                    DeviceJobResult(
                        job_id=row.job_id,
                        device_id=row.device_id,
                        device_name=row.device_name,
                        checkmk_status=row.checkmk_status,
                        diff=row.diff or "",
                        normalized_config=json.loads(row.normalized_config)
                        if row.normalized_config
                        else {},
                        checkmk_config=json.loads(row.checkmk_config)
                        if row.checkmk_config
                        else None,
                        ignored_attributes=ignored_attrs,
                        processed_at=row.processed_at,
                    )
                )
            return results

        except Exception as e:
            logger.error(f"[DB_SERVICE] Error getting job results for {job_id}: {e}")
            return []

    def get_recent_jobs(self, limit: int = 10) -> List[NB2CMKJob]:
        """Get recent jobs ordered by creation date."""
        try:
            job_models = self.job_repo.get_recent_jobs(limit)

            jobs = []
            for row in job_models:
                jobs.append(
                    NB2CMKJob(
                        job_id=row.job_id,
                        status=JobStatus(row.status),
                        created_at=row.created_at,
                        started_at=row.started_at,
                        completed_at=row.completed_at,
                        total_devices=row.total_devices,
                        processed_devices=row.processed_devices,
                        progress_message=row.progress_message or "",
                        user_id=row.user_id,
                        error_message=row.error_message,
                    )
                )
            return jobs

        except Exception as e:
            logger.error(f"Error getting recent jobs: {e}")
            return []

    def cleanup_old_jobs(self, days_old: int = 7) -> int:
        """Clean up old completed jobs and their results."""
        try:
            old_jobs = self.job_repo.get_jobs_older_than(days_old)

            # Filter to only completed/failed/cancelled jobs
            job_ids_to_delete = [
                job.job_id
                for job in old_jobs
                if job.status
                in [
                    JobStatus.COMPLETED.value,
                    JobStatus.FAILED.value,
                    JobStatus.CANCELLED.value,
                ]
            ]

            if job_ids_to_delete:
                for job_id in job_ids_to_delete:
                    # Delete results (cascades in PostgreSQL, but explicit is better)
                    self.result_repo.delete_by_job_id(job_id)
                    # Delete job
                    self.job_repo.delete(job_id)

                logger.info(f"Cleaned up {len(job_ids_to_delete)} old NB2CMK jobs")
                return len(job_ids_to_delete)

            return 0

        except Exception as e:
            logger.error(f"Error cleaning up old jobs: {e}")
            return 0

    def get_active_job(self) -> Optional[NB2CMKJob]:
        """Get currently active (running or pending) job."""
        try:
            job_model = self.job_repo.get_active_job()
            if not job_model:
                return None

            return NB2CMKJob(
                job_id=job_model.job_id,
                status=JobStatus(job_model.status),
                created_at=job_model.created_at,
                started_at=job_model.started_at,
                completed_at=job_model.completed_at,
                total_devices=job_model.total_devices,
                processed_devices=job_model.processed_devices,
                progress_message=job_model.progress_message or "",
                user_id=job_model.user_id,
                error_message=job_model.error_message,
            )

        except Exception as e:
            logger.error(f"Error getting active job: {e}")
            return None

    def delete_job(self, job_id: str) -> bool:
        """Delete a specific job and its results."""
        try:
            # Delete job results (CASCADE will handle this, but explicit is better)
            self.result_repo.delete_by_job_id(job_id)

            # Delete the job
            deleted = self.job_repo.delete(job_id)

            if deleted:
                logger.info(f"Deleted NB2CMK job {job_id}")
            return deleted

        except Exception as e:
            logger.error(f"Error deleting job {job_id}: {e}")
            return False


# Global instance
nb2cmk_db_service = NB2CMKDatabaseService()
