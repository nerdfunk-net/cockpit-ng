"""
Repository for NB2CMK job tracking operations.
"""

from typing import List, Optional
from datetime import datetime, timedelta
from sqlalchemy import desc
from core.models import NB2CMKJob, NB2CMKJobResult
from core.database import get_db_session
from repositories.base import BaseRepository


class NB2CMKJobRepository(BaseRepository[NB2CMKJob]):
    """Repository for NB2CMK job operations."""

    def __init__(self):
        super().__init__(NB2CMKJob)

    def get_by_job_id(self, job_id: str) -> Optional[NB2CMKJob]:
        """Get job by job_id (primary key)."""
        db = get_db_session()
        try:
            return db.query(self.model).filter(self.model.job_id == job_id).first()
        finally:
            db.close()

    def update(self, job_id: str, **kwargs) -> Optional[NB2CMKJob]:
        """Update job by job_id."""
        db = get_db_session()
        try:
            job = db.query(self.model).filter(self.model.job_id == job_id).first()
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
        """Delete job by job_id (overrides base to use job_id instead of id)."""
        db = get_db_session()
        try:
            obj = db.query(self.model).filter(self.model.job_id == job_id).first()
            if obj:
                db.delete(obj)
                db.commit()
                return True
            return False
        finally:
            db.close()

    def get_recent_jobs(self, limit: int = 10) -> List[NB2CMKJob]:
        """Get recent jobs ordered by created_at descending."""
        db = get_db_session()
        try:
            return (
                db.query(self.model)
                .order_by(desc(self.model.created_at))
                .limit(limit)
                .all()
            )
        finally:
            db.close()

    def get_active_job(self) -> Optional[NB2CMKJob]:
        """Get the most recent running or pending job."""
        db = get_db_session()
        try:
            return (
                db.query(self.model)
                .filter(self.model.status.in_(["pending", "running"]))
                .order_by(desc(self.model.created_at))
                .first()
            )
        finally:
            db.close()

    def get_jobs_older_than(self, days: int) -> List[NB2CMKJob]:
        """Get jobs older than specified days."""
        cutoff_date = datetime.now() - timedelta(days=days)
        db = get_db_session()
        try:
            return (
                db.query(self.model).filter(self.model.created_at < cutoff_date).all()
            )
        finally:
            db.close()


class NB2CMKJobResultRepository(BaseRepository[NB2CMKJobResult]):
    """Repository for NB2CMK job result operations."""

    def __init__(self):
        super().__init__(NB2CMKJobResult)

    def get_by_job_id(self, job_id: str) -> List[NB2CMKJobResult]:
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
