"""
NB2CMK Database Service for job tracking and results storage.
Manages a separate SQLite database for nb2cmk background job operations.
"""

from __future__ import annotations
import sqlite3
import os
import json
import uuid
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, asdict
from enum import Enum

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
    processed_at: datetime


class NB2CMKDatabaseService:
    """Database service for NB2CMK background job operations."""

    def __init__(self, db_path: str = None):
        if db_path is None:
            # Use data directory from configuration
            from config import settings as config_settings
            settings_dir = os.path.join(config_settings.data_directory, "settings")
            os.makedirs(settings_dir, exist_ok=True)
            self.db_path = os.path.join(settings_dir, "nb2cmk.db")
        else:
            self.db_path = db_path
        
        # Initialize database
        self.init_database()

    def init_database(self) -> bool:
        """Initialize the nb2cmk database with required tables."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Create jobs table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS nb2cmk_jobs (
                        job_id TEXT PRIMARY KEY,
                        status TEXT NOT NULL,
                        created_at TIMESTAMP NOT NULL,
                        started_at TIMESTAMP,
                        completed_at TIMESTAMP,
                        total_devices INTEGER DEFAULT 0,
                        processed_devices INTEGER DEFAULT 0,
                        progress_message TEXT DEFAULT '',
                        user_id TEXT,
                        error_message TEXT
                    )
                """)
                
                # Create job results table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS nb2cmk_job_results (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        job_id TEXT NOT NULL,
                        device_id TEXT NOT NULL,
                        device_name TEXT NOT NULL,
                        checkmk_status TEXT NOT NULL,
                        diff TEXT,
                        normalized_config TEXT,
                        checkmk_config TEXT,
                        processed_at TIMESTAMP NOT NULL,
                        FOREIGN KEY (job_id) REFERENCES nb2cmk_jobs (job_id)
                    )
                """)
                
                # Create indexes for better performance
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_job_results_job_id 
                    ON nb2cmk_job_results(job_id)
                """)
                
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_jobs_created_at 
                    ON nb2cmk_jobs(created_at)
                """)
                
                conn.commit()
                logger.info(f"NB2CMK database initialized at {self.db_path}")
                return True
                
        except sqlite3.Error as e:
            logger.error(f"NB2CMK database initialization failed: {e}")
            return False

    def create_job(self, user_id: Optional[str] = None) -> str:
        """Create a new background job and return job_id."""
        job_id = str(uuid.uuid4())
        now = datetime.now()
        
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO nb2cmk_jobs 
                    (job_id, status, created_at, user_id)
                    VALUES (?, ?, ?, ?)
                """, (job_id, JobStatus.PENDING.value, now, user_id))
                conn.commit()
                
            logger.info(f"Created NB2CMK job {job_id}")
            return job_id
            
        except sqlite3.Error as e:
            logger.error(f"Error creating NB2CMK job: {e}")
            raise

    def get_job(self, job_id: str) -> Optional[NB2CMKJob]:
        """Get job by ID."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT * FROM nb2cmk_jobs WHERE job_id = ?
                """, (job_id,))
                row = cursor.fetchone()
                
                if row:
                    return NB2CMKJob(
                        job_id=row["job_id"],
                        status=JobStatus(row["status"]),
                        created_at=datetime.fromisoformat(row["created_at"]),
                        started_at=datetime.fromisoformat(row["started_at"]) if row["started_at"] else None,
                        completed_at=datetime.fromisoformat(row["completed_at"]) if row["completed_at"] else None,
                        total_devices=row["total_devices"],
                        processed_devices=row["processed_devices"],
                        progress_message=row["progress_message"],
                        user_id=row["user_id"],
                        error_message=row["error_message"]
                    )
                return None
                
        except sqlite3.Error as e:
            logger.error(f"Error getting job {job_id}: {e}")
            return None

    def update_job_status(self, job_id: str, status: JobStatus, 
                         error_message: Optional[str] = None) -> bool:
        """Update job status."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                now = datetime.now()
                
                if status == JobStatus.RUNNING:
                    cursor.execute("""
                        UPDATE nb2cmk_jobs 
                        SET status = ?, started_at = ?, error_message = ?
                        WHERE job_id = ?
                    """, (status.value, now, error_message, job_id))
                elif status in [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED]:
                    cursor.execute("""
                        UPDATE nb2cmk_jobs 
                        SET status = ?, completed_at = ?, error_message = ?
                        WHERE job_id = ?
                    """, (status.value, now, error_message, job_id))
                else:
                    cursor.execute("""
                        UPDATE nb2cmk_jobs 
                        SET status = ?, error_message = ?
                        WHERE job_id = ?
                    """, (status.value, error_message, job_id))
                    
                conn.commit()
                return True
                
        except sqlite3.Error as e:
            logger.error(f"Error updating job {job_id} status: {e}")
            return False

    def update_job_progress(self, job_id: str, processed_devices: int, 
                           total_devices: int, message: str = "") -> bool:
        """Update job progress."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE nb2cmk_jobs 
                    SET processed_devices = ?, total_devices = ?, progress_message = ?
                    WHERE job_id = ?
                """, (processed_devices, total_devices, message, job_id))
                conn.commit()
                return True
                
        except sqlite3.Error as e:
            logger.error(f"Error updating job {job_id} progress: {e}")
            return False

    def add_device_result(self, job_id: str, device_id: str, device_name: str,
                         checkmk_status: str, diff: str,
                         normalized_config: Dict[str, Any],
                         checkmk_config: Optional[Dict[str, Any]]) -> bool:
        """Add a device result to the job."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO nb2cmk_job_results 
                    (job_id, device_id, device_name, checkmk_status, diff,
                     normalized_config, checkmk_config, processed_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    job_id, device_id, device_name, checkmk_status, diff,
                    json.dumps(normalized_config),
                    json.dumps(checkmk_config) if checkmk_config else None,
                    datetime.now()
                ))
                conn.commit()
                return True
                
        except sqlite3.Error as e:
            logger.error(f"Error adding device result for job {job_id}: {e}")
            return False

    def get_job_results(self, job_id: str) -> List[DeviceJobResult]:
        """Get all device results for a job."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT * FROM nb2cmk_job_results 
                    WHERE job_id = ? 
                    ORDER BY processed_at
                """, (job_id,))
                rows = cursor.fetchall()
                
                results = []
                for row in rows:
                    results.append(DeviceJobResult(
                        job_id=row["job_id"],
                        device_id=row["device_id"],
                        device_name=row["device_name"],
                        checkmk_status=row["checkmk_status"],
                        diff=row["diff"] or "",
                        normalized_config=json.loads(row["normalized_config"]) if row["normalized_config"] else {},
                        checkmk_config=json.loads(row["checkmk_config"]) if row["checkmk_config"] else None,
                        processed_at=datetime.fromisoformat(row["processed_at"])
                    ))
                return results
                
        except sqlite3.Error as e:
            logger.error(f"Error getting job results for {job_id}: {e}")
            return []

    def get_recent_jobs(self, limit: int = 10) -> List[NB2CMKJob]:
        """Get recent jobs ordered by creation date."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT * FROM nb2cmk_jobs 
                    ORDER BY created_at DESC 
                    LIMIT ?
                """, (limit,))
                rows = cursor.fetchall()
                
                jobs = []
                for row in rows:
                    jobs.append(NB2CMKJob(
                        job_id=row["job_id"],
                        status=JobStatus(row["status"]),
                        created_at=datetime.fromisoformat(row["created_at"]),
                        started_at=datetime.fromisoformat(row["started_at"]) if row["started_at"] else None,
                        completed_at=datetime.fromisoformat(row["completed_at"]) if row["completed_at"] else None,
                        total_devices=row["total_devices"],
                        processed_devices=row["processed_devices"],
                        progress_message=row["progress_message"],
                        user_id=row["user_id"],
                        error_message=row["error_message"]
                    ))
                return jobs
                
        except sqlite3.Error as e:
            logger.error(f"Error getting recent jobs: {e}")
            return []

    def cleanup_old_jobs(self, days_old: int = 7) -> int:
        """Clean up old completed jobs and their results."""
        try:
            cutoff_date = datetime.now() - timedelta(days=days_old)
            
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Get job IDs to clean up
                cursor.execute("""
                    SELECT job_id FROM nb2cmk_jobs 
                    WHERE completed_at < ? 
                    AND status IN (?, ?, ?)
                """, (cutoff_date, JobStatus.COMPLETED.value, JobStatus.FAILED.value, JobStatus.CANCELLED.value))
                
                job_ids = [row[0] for row in cursor.fetchall()]
                
                if job_ids:
                    # Delete job results
                    placeholders = ','.join('?' * len(job_ids))
                    cursor.execute(f"""
                        DELETE FROM nb2cmk_job_results 
                        WHERE job_id IN ({placeholders})
                    """, job_ids)
                    
                    # Delete jobs
                    cursor.execute(f"""
                        DELETE FROM nb2cmk_jobs 
                        WHERE job_id IN ({placeholders})
                    """, job_ids)
                    
                    conn.commit()
                    logger.info(f"Cleaned up {len(job_ids)} old NB2CMK jobs")
                    return len(job_ids)
                
                return 0
                
        except sqlite3.Error as e:
            logger.error(f"Error cleaning up old jobs: {e}")
            return 0

    def get_active_job(self) -> Optional[NB2CMKJob]:
        """Get currently active (running or pending) job."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT * FROM nb2cmk_jobs 
                    WHERE status IN (?, ?) 
                    ORDER BY created_at DESC 
                    LIMIT 1
                """, (JobStatus.PENDING.value, JobStatus.RUNNING.value))
                row = cursor.fetchone()
                
                if row:
                    return NB2CMKJob(
                        job_id=row["job_id"],
                        status=JobStatus(row["status"]),
                        created_at=datetime.fromisoformat(row["created_at"]),
                        started_at=datetime.fromisoformat(row["started_at"]) if row["started_at"] else None,
                        completed_at=datetime.fromisoformat(row["completed_at"]) if row["completed_at"] else None,
                        total_devices=row["total_devices"],
                        processed_devices=row["processed_devices"],
                        progress_message=row["progress_message"],
                        user_id=row["user_id"],
                        error_message=row["error_message"]
                    )
                return None
                
        except sqlite3.Error as e:
            logger.error(f"Error getting active job: {e}")
            return None


# Global instance
nb2cmk_db_service = NB2CMKDatabaseService()