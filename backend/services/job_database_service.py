"""
Job database service for APScheduler-based job management.
This is a completely new system independent of nb2cmk.
"""

from __future__ import annotations
import sqlite3
import logging
import json
import os
from typing import List, Dict, Any, Optional
from enum import Enum

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


class JobDatabaseService:
    """Database service for managing job data"""

    def __init__(self, db_path: str = "../data/jobs/jobs.db"):
        self.db_path = db_path
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self._init_database()

    def _init_database(self):
        """Initialize the database with required tables"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    status TEXT NOT NULL,
                    started_by TEXT,
                    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    completed_at TIMESTAMP,
                    progress_current INTEGER DEFAULT 0,
                    progress_total INTEGER DEFAULT 0,
                    progress_message TEXT,
                    result_summary TEXT,
                    error_message TEXT,
                    metadata TEXT  -- JSON field for additional data
                )
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS job_results (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    job_id TEXT NOT NULL,
                    device_name TEXT NOT NULL,
                    status TEXT NOT NULL,
                    result_data TEXT,  -- JSON field for device-specific results
                    error_message TEXT,
                    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (job_id) REFERENCES jobs (id)
                )
            """)

            conn.commit()
            logger.info(f"Job database initialized at {self.db_path}")

    def create_job(
        self,
        job_id: str,
        job_type: JobType,
        started_by: str = None,
        metadata: Dict[str, Any] = None,
    ) -> bool:
        """Create a new job"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute(
                    """
                    INSERT INTO jobs (id, type, status, started_by, metadata)
                    VALUES (?, ?, ?, ?, ?)
                """,
                    (
                        job_id,
                        job_type.value,
                        JobStatus.PENDING.value,
                        started_by,
                        json.dumps(metadata or {}),
                    ),
                )
                conn.commit()
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
            with sqlite3.connect(self.db_path) as conn:
                if status in [
                    JobStatus.COMPLETED,
                    JobStatus.FAILED,
                    JobStatus.CANCELLED,
                ]:
                    conn.execute(
                        """
                        UPDATE jobs 
                        SET status = ?, completed_at = CURRENT_TIMESTAMP, error_message = ?
                        WHERE id = ?
                    """,
                        (status.value, error_message, job_id),
                    )
                else:
                    conn.execute(
                        """
                        UPDATE jobs 
                        SET status = ?, error_message = ?
                        WHERE id = ?
                    """,
                        (status.value, error_message, job_id),
                    )
                conn.commit()
                logger.debug(f"Updated job {job_id} status to {status}")
                return True
        except Exception as e:
            logger.error(f"Error updating job {job_id} status: {e}")
            return False

    def update_job_progress(
        self, job_id: str, current: int, total: int, message: str = None
    ) -> bool:
        """Update job progress"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute(
                    """
                    UPDATE jobs 
                    SET progress_current = ?, progress_total = ?, progress_message = ?
                    WHERE id = ?
                """,
                    (current, total, message, job_id),
                )
                conn.commit()
                logger.debug(f"Updated job {job_id} progress: {current}/{total}")
                return True
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
            with sqlite3.connect(self.db_path) as conn:
                conn.execute(
                    """
                    INSERT INTO job_results (job_id, device_name, status, result_data, error_message)
                    VALUES (?, ?, ?, ?, ?)
                """,
                    (
                        job_id,
                        device_name,
                        status,
                        json.dumps(result_data or {}),
                        error_message,
                    ),
                )
                conn.commit()
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
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute(
                    """
                    SELECT * FROM jobs 
                    ORDER BY started_at DESC 
                    LIMIT ?
                """,
                    (limit,),
                )

                jobs = []
                for row in cursor.fetchall():
                    job = dict(row)
                    job["metadata"] = json.loads(job["metadata"] or "{}")

                    # Get progress info if available
                    if job["progress_total"] > 0:
                        job["progress"] = {
                            "processed": job["progress_current"],
                            "total": job["progress_total"],
                            "message": job["progress_message"],
                        }
                    else:
                        job["progress"] = None

                    jobs.append(job)

                return jobs
        except Exception as e:
            logger.error(f"Error fetching jobs: {e}")
            return []

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific job"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
                row = cursor.fetchone()

                if row:
                    job = dict(row)
                    job["metadata"] = json.loads(job["metadata"] or "{}")

                    # Get device results
                    cursor = conn.execute(
                        """
                        SELECT * FROM job_results WHERE job_id = ? 
                        ORDER BY processed_at
                    """,
                        (job_id,),
                    )

                    job["device_results"] = []
                    for result_row in cursor.fetchall():
                        result = dict(result_row)
                        result["result_data"] = json.loads(
                            result["result_data"] or "{}"
                        )
                        job["device_results"].append(result)

                    return job
                return None
        except Exception as e:
            logger.error(f"Error fetching job {job_id}: {e}")
            return None

    def delete_job(self, job_id: str) -> bool:
        """Delete a job and its results"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("DELETE FROM job_results WHERE job_id = ?", (job_id,))
                conn.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
                conn.commit()
                logger.info(f"Deleted job {job_id}")
                return True
        except Exception as e:
            logger.error(f"Error deleting job {job_id}: {e}")
            return False

    def cleanup_old_jobs(self, days: int = 7) -> int:
        """Clean up completed jobs older than specified days"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute(
                    """
                    DELETE FROM job_results 
                    WHERE job_id IN (
                        SELECT id FROM jobs 
                        WHERE status IN ('completed', 'failed', 'cancelled') 
                        AND datetime(completed_at) < datetime('now', '-{} days')
                    )
                """.format(days)
                )

                cursor = conn.execute(
                    """
                    DELETE FROM jobs 
                    WHERE status IN ('completed', 'failed', 'cancelled') 
                    AND datetime(completed_at) < datetime('now', '-{} days')
                """.format(days)
                )

                deleted_count = cursor.rowcount
                conn.commit()
                logger.info(f"Cleaned up {deleted_count} old jobs")
                return deleted_count
        except Exception as e:
            logger.error(f"Error cleaning up old jobs: {e}")
            return 0


# Global instance
job_db_service = JobDatabaseService()
