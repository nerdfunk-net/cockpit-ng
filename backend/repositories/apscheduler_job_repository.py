"""
Repository for APScheduler job tracking operations.
"""

from typing import List, Optional
from datetime import datetime, timedelta
from sqlalchemy import desc
from core.models import APSchedulerJob, APSchedulerJobResult
from core.database import get_db_session
from .base import BaseRepository


class APSchedulerJobRepository(BaseRepository[APSchedulerJob]):
    """Repository for APScheduler job operations."""

    def __init__(self):
        super().__init__(APSchedulerJob)

    def get_by_job_id(self, job_id: str) -> Optional[APSchedulerJob]:
        """Get job by job_id (primary key)."""
        db = get_db_session()
        try:
            return db.query(self.model).filter(self.model.id == job_id).first()
        finally:
            db.close()
    
    def update(self, job_id: str, **kwargs) -> Optional[APSchedulerJob]:
        """Update job by job_id."""
        db = get_db_session()
        try:
            job = db.query(self.model).filter(self.model.id == job_id).first()
            if job:
                for key, value in kwargs.items():
                    if hasattr(job, key):
                        setattr(job, key, value)
                db.commit()
                db.refresh(job)
                return job
            return None
        finally:
            db.close()
    
    def delete(self, job_id: str) -> bool:
        """Delete job by job_id."""
        db = get_db_session()
        try:
            obj = db.query(self.model).filter(self.model.id == job_id).first()
            if obj:
                db.delete(obj)
                db.commit()
                return True
            return False
        finally:
            db.close()

    def get_recent_jobs(self, limit: int = 100) -> List[APSchedulerJob]:
        """Get recent jobs ordered by started_at descending."""
        db = get_db_session()
        try:
            return db.query(self.model).order_by(desc(self.model.started_at)).limit(limit).all()
        finally:
            db.close()

    def get_jobs_older_than(self, days: int) -> List[APSchedulerJob]:
        """Get jobs older than specified days."""
        cutoff_date = datetime.now() - timedelta(days=days)
        db = get_db_session()
        try:
            return db.query(self.model).filter(self.model.started_at < cutoff_date).all()
        finally:
            db.close()

    def get_completed_jobs(self) -> List[APSchedulerJob]:
        """Get all completed jobs."""
        db = get_db_session()
        try:
            return db.query(self.model).filter(
                self.model.status.in_(['completed', 'failed', 'cancelled'])
            ).all()
        finally:
            db.close()


class APSchedulerJobResultRepository(BaseRepository[APSchedulerJobResult]):
    """Repository for APScheduler job result operations."""

    def __init__(self):
        super().__init__(APSchedulerJobResult)

    def get_by_job_id(self, job_id: str) -> List[APSchedulerJobResult]:
        """Get all results for a specific job."""
        db = get_db_session()
        try:
            return db.query(self.model).filter(self.model.job_id == job_id).all()
        finally:
            db.close()

    def delete_by_job_id(self, job_id: str) -> int:
        """Delete all results for a specific job. Returns count of deleted results."""
        db = get_db_session()
        try:
            count = db.query(self.model).filter(self.model.job_id == job_id).delete()
            db.commit()
            return count
        finally:
            db.close()
