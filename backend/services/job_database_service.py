"""
Job database service for APScheduler-based job management.
Uses PostgreSQL via repositories.
"""

from __future__ import annotations
import logging
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from enum import Enum
from repositories.apscheduler_job_repository import APSchedulerJobRepository, APSchedulerJobResultRepository

logger = logging.getLogger(__name__)


class JobStatus(str, Enum):
    """Job status enumeration"""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobType(str, Enum):
    """Job type enumeration"""

    DEVICE_COMPARISON = "device-comparison"
    DEVICE_SYNC = "device-sync"
    DEVICE_CACHE = "device-cache"
    BACKUP = "backup"
    NETWORK_SCAN = "network-scan"


class JobDatabaseService:
    """Database service for managing job data"""

    def __init__(self, db_path: str = "../data/jobs/jobs.db"):
        # db_path kept for backward compatibility but not used
        self.job_repo = APSchedulerJobRepository()
        self.result_repo = APSchedulerJobResultRepository()
        logger.info("Job database service initialized with PostgreSQL repositories")

    def _init_database(self):
        """Database tables are auto-created by SQLAlchemy migrations."""
        # No-op for backward compatibility
        pass

    def create_job(
        self,
        job_id: str,
        job_type: JobType,
        started_by: str = None,
        metadata: Dict[str, Any] = None,
    ) -> bool:
        """Create a new job"""
        try:
            self.job_repo.create(
                id=job_id,
                type=job_type.value,
                status=JobStatus.PENDING.value,
                started_by=started_by,
                job_metadata=json.dumps(metadata or {}),
                progress_current=0,
                progress_total=0
            )
            logger.info(f"Created job {job_id} of type {job_type}")
            return True
        except Exception as e:
            logger.error(f"Error creating job {job_id}: {e}")
            return False

    def update_job_status(
        self, job_id: str, status: JobStatus, error_message: str = None
    ) -> bool:
        """Update job status"""
        try:
            update_data = {'status': status.value}
            
            if status in [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED]:
                update_data['completed_at'] = datetime.now()
            
            if error_message is not None:
                update_data['error_message'] = error_message
            
            updated = self.job_repo.update(job_id, **update_data)
            if updated:
                logger.debug(f"Updated job {job_id} status to {status}")
                return True
            return False
        except Exception as e:
            logger.error(f"Error updating job {job_id} status: {e}")
            return False

    def update_job_progress(
        self, job_id: str, current: int, total: int, message: str = None
    ) -> bool:
        """Update job progress"""
        try:
            updated = self.job_repo.update(
                job_id,
                progress_current=current,
                progress_total=total,
                progress_message=message
            )
            if updated:
                logger.debug(f"Updated job {job_id} progress: {current}/{total}")
                return True
            return False
        except Exception as e:
            logger.error(f"Error updating job {job_id} progress: {e}")
            return False

    def add_device_result(
        self,
        job_id: str,
        device_name: str,
        status: str,
        result_data: Dict[str, Any] = None,
        error_message: str = None,
    ) -> bool:
        """Add a device processing result"""
        try:
            self.result_repo.create(
                job_id=job_id,
                device_name=device_name,
                status=status,
                result_data=json.dumps(result_data or {}),
                error_message=error_message
            )
            logger.debug(f"Added device result for {device_name} in job {job_id}")
            return True
        except Exception as e:
            logger.error(
                f"Error adding device result for {device_name} in job {job_id}: {e}"
            )
            return False

    def get_jobs(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get all jobs with latest first"""
        try:
            job_models = self.job_repo.get_recent_jobs(limit)
            
            jobs = []
            for row in job_models:
                job = {
                    'id': row.id,
                    'type': row.type,
                    'status': row.status,
                    'started_by': row.started_by,
                    'started_at': row.started_at.isoformat() if row.started_at else None,
                    'completed_at': row.completed_at.isoformat() if row.completed_at else None,
                    'progress_current': row.progress_current,
                    'progress_total': row.progress_total,
                    'progress_message': row.progress_message,
                    'result_summary': row.result_summary,
                    'error_message': row.error_message,
                    'metadata': json.loads(row.job_metadata or '{}')
                }
                
                # Get progress info if available
                if job['progress_total'] > 0:
                    job['progress'] = {
                        'processed': job['progress_current'],
                        'total': job['progress_total'],
                        'message': job['progress_message'],
                    }
                else:
                    job['progress'] = None
                
                jobs.append(job)
            
            return jobs
        except Exception as e:
            logger.error(f"Error fetching jobs: {e}")
            return []

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific job"""
        try:
            job_model = self.job_repo.get_by_job_id(job_id)
            if not job_model:
                return None
            
            job = {
                'id': job_model.id,
                'type': job_model.type,
                'status': job_model.status,
                'started_by': job_model.started_by,
                'started_at': job_model.started_at.isoformat() if job_model.started_at else None,
                'completed_at': job_model.completed_at.isoformat() if job_model.completed_at else None,
                'progress_current': job_model.progress_current,
                'progress_total': job_model.progress_total,
                'progress_message': job_model.progress_message,
                'result_summary': job_model.result_summary,
                'error_message': job_model.error_message,
                'metadata': json.loads(job_model.job_metadata or '{}')
            }
            
            # Get device results
            result_models = self.result_repo.get_by_job_id(job_id)
            job['device_results'] = []
            for result in result_models:
                job['device_results'].append({
                    'id': result.id,
                    'job_id': result.job_id,
                    'device_name': result.device_name,
                    'status': result.status,
                    'result_data': json.loads(result.result_data or '{}'),
                    'error_message': result.error_message,
                    'processed_at': result.processed_at.isoformat() if result.processed_at else None
                })
            
            return job
        except Exception as e:
            logger.error(f"Error fetching job {job_id}: {e}")
            return None

    def delete_job(self, job_id: str) -> bool:
        """Delete a job and its results"""
        try:
            # Delete results (CASCADE will handle this, but explicit is better)
            self.result_repo.delete_by_job_id(job_id)
            # Delete job
            deleted = self.job_repo.delete(job_id)
            if deleted:
                logger.info(f"Deleted job {job_id}")
            return deleted
        except Exception as e:
            logger.error(f"Error deleting job {job_id}: {e}")
            return False

    def cleanup_old_jobs(self, days: int = 7) -> int:
        """Clean up completed jobs older than specified days"""
        try:
            old_jobs = self.job_repo.get_jobs_older_than(days)
            
            # Filter to only completed/failed/cancelled jobs
            job_ids_to_delete = [
                job.id for job in old_jobs
                if job.status in ['completed', 'failed', 'cancelled']
            ]
            
            if job_ids_to_delete:
                for job_id in job_ids_to_delete:
                    self.result_repo.delete_by_job_id(job_id)
                    self.job_repo.delete(job_id)
                
                logger.info(f"Cleaned up {len(job_ids_to_delete)} old jobs")
                return len(job_ids_to_delete)
            
            return 0
        except Exception as e:
            logger.error(f"Error cleaning up old jobs: {e}")
            return 0

    def clear_completed_jobs(self) -> Dict[str, Any]:
        """Clear ALL completed, failed, and cancelled jobs regardless of age"""
        try:
            completed_jobs = self.job_repo.get_completed_jobs()
            
            jobs_deleted = 0
            device_results_deleted = 0
            
            for job in completed_jobs:
                # Delete device results
                count = self.result_repo.delete_by_job_id(job.id)
                device_results_deleted += count
                
                # Delete job
                if self.job_repo.delete(job.id):
                    jobs_deleted += 1
            
            logger.info(
                f"Cleared {jobs_deleted} completed jobs and {device_results_deleted} device results"
            )
            
            return {
                'jobs_deleted': jobs_deleted,
                'device_results_deleted': device_results_deleted,
                'success': True
            }
        except Exception as e:
            logger.error(f"Error clearing completed jobs: {e}")
            return {'jobs_deleted': 0, 'device_results_deleted': 0, 'success': False, 'error': str(e)}


# Global instance
job_db_service = JobDatabaseService()
