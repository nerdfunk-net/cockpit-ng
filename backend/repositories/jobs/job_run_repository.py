"""
JobRun Repository
Handles database operations for job run tracking.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy import desc
from core.models import JobRun
from repositories.base import BaseRepository


def _to_dict(job_run: JobRun) -> Dict[str, Any]:
    """Convert JobRun to dictionary while session is still active"""
    return {
        "id": job_run.id,
        "job_schedule_id": job_run.job_schedule_id,
        "job_template_id": job_run.job_template_id,
        "celery_task_id": job_run.celery_task_id,
        "job_name": job_run.job_name,
        "job_type": job_run.job_type,
        "status": job_run.status,
        "triggered_by": job_run.triggered_by,
        "queued_at": job_run.queued_at,
        "started_at": job_run.started_at,
        "completed_at": job_run.completed_at,
        "error_message": job_run.error_message,
        "result": job_run.result,
        "target_devices": job_run.target_devices,
        "executed_by": job_run.executed_by,
    }


class JobRunRepository(BaseRepository[JobRun]):
    """Repository for job run operations"""

    def __init__(self):
        super().__init__(JobRun)

    def create(self, **kwargs) -> Dict[str, Any]:
        """Create a new job run and return as dict"""
        from core.database import get_db_session

        session = get_db_session()
        try:
            instance = self.model(**kwargs)
            session.add(instance)
            session.commit()
            session.refresh(instance)
            return _to_dict(instance)
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def get_by_id(self, id: int) -> Optional[Dict[str, Any]]:
        """Get job run by ID and return as dict"""
        from core.database import get_db_session

        session = get_db_session()
        try:
            job_run = session.query(self.model).filter(self.model.id == id).first()
            return _to_dict(job_run) if job_run else None
        finally:
            session.close()

    def get_by_celery_task_id(self, celery_task_id: str) -> Optional[Dict[str, Any]]:
        """Get job run by Celery task ID"""
        from core.database import get_db_session

        session = get_db_session()
        try:
            job_run = (
                session.query(self.model)
                .filter(self.model.celery_task_id == celery_task_id)
                .first()
            )
            return _to_dict(job_run) if job_run else None
        finally:
            session.close()

    def get_by_celery_task_ids(
        self, celery_task_ids: List[str]
    ) -> List[Dict[str, Any]]:
        """Get job runs by multiple Celery task IDs"""
        from core.database import get_db_session

        if not celery_task_ids:
            return []

        session = get_db_session()
        try:
            job_runs = (
                session.query(self.model)
                .filter(self.model.celery_task_id.in_(celery_task_ids))
                .all()
            )
            return [_to_dict(job_run) for job_run in job_runs]
        finally:
            session.close()

    def get_by_schedule(
        self, schedule_id: int, limit: int = 50, status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get job runs for a specific schedule"""
        from core.database import get_db_session

        session = get_db_session()
        try:
            query = session.query(self.model).filter(
                self.model.job_schedule_id == schedule_id
            )

            if status:
                query = query.filter(self.model.status == status)

            items = query.order_by(desc(self.model.queued_at)).limit(limit).all()
            return [_to_dict(item) for item in items]
        finally:
            session.close()

    def get_recent_runs(
        self,
        limit: int = 50,
        status: Optional[str] = None,
        job_type: Optional[str] = None,
        triggered_by: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Get recent job runs with optional filters"""
        from core.database import get_db_session

        session = get_db_session()
        try:
            query = session.query(self.model)

            if status:
                query = query.filter(self.model.status == status)
            if job_type:
                query = query.filter(self.model.job_type == job_type)
            if triggered_by:
                query = query.filter(self.model.triggered_by == triggered_by)

            items = query.order_by(desc(self.model.queued_at)).limit(limit).all()
            return [_to_dict(item) for item in items]
        finally:
            session.close()

    def get_runs_since(
        self,
        since: datetime,
        status: Optional[str] = None,
        job_type: Optional[str] = None,
        triggered_by: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Get job runs since a specific datetime with optional filters"""
        from core.database import get_db_session

        session = get_db_session()
        try:
            query = session.query(self.model).filter(self.model.queued_at >= since)

            if status:
                query = query.filter(self.model.status == status)
            if job_type:
                query = query.filter(self.model.job_type == job_type)
            if triggered_by:
                query = query.filter(self.model.triggered_by == triggered_by)

            items = query.order_by(desc(self.model.queued_at)).all()
            return [_to_dict(item) for item in items]
        finally:
            session.close()

    def get_paginated(
        self,
        page: int = 1,
        page_size: int = 25,
        status: Optional[List[str]] = None,
        job_type: Optional[List[str]] = None,
        triggered_by: Optional[List[str]] = None,
        schedule_id: Optional[int] = None,
        template_id: Optional[List[int]] = None,
    ) -> tuple[List[Dict[str, Any]], int]:
        """Get paginated job runs with filters. Supports multiple values for filtering. Returns (items, total_count)"""
        from core.database import get_db_session

        session = get_db_session()
        try:
            query = session.query(self.model)

            if status:
                if len(status) == 1:
                    query = query.filter(self.model.status == status[0])
                else:
                    query = query.filter(self.model.status.in_(status))
            if job_type:
                if len(job_type) == 1:
                    query = query.filter(self.model.job_type == job_type[0])
                else:
                    query = query.filter(self.model.job_type.in_(job_type))
            if triggered_by:
                if len(triggered_by) == 1:
                    query = query.filter(self.model.triggered_by == triggered_by[0])
                else:
                    query = query.filter(self.model.triggered_by.in_(triggered_by))
            if schedule_id:
                query = query.filter(self.model.job_schedule_id == schedule_id)
            if template_id:
                if len(template_id) == 1:
                    query = query.filter(self.model.job_template_id == template_id[0])
                else:
                    query = query.filter(self.model.job_template_id.in_(template_id))

            total = query.count()

            offset = (page - 1) * page_size
            items = (
                query.order_by(desc(self.model.queued_at))
                .offset(offset)
                .limit(page_size)
                .all()
            )

            return [_to_dict(item) for item in items], total
        finally:
            session.close()

    def get_running_count(self) -> int:
        """Get count of currently running jobs"""
        from core.database import get_db_session

        session = get_db_session()
        try:
            return (
                session.query(self.model).filter(self.model.status == "running").count()
            )
        finally:
            session.close()

    def get_pending_count(self) -> int:
        """Get count of pending jobs"""
        from core.database import get_db_session

        session = get_db_session()
        try:
            return (
                session.query(self.model).filter(self.model.status == "pending").count()
            )
        finally:
            session.close()

    def mark_started(
        self, job_run_id: int, celery_task_id: str
    ) -> Optional[Dict[str, Any]]:
        """Mark a job run as started"""
        from core.database import get_db_session

        session = get_db_session()
        try:
            job_run = (
                session.query(self.model).filter(self.model.id == job_run_id).first()
            )
            if job_run:
                job_run.status = "running"
                job_run.started_at = datetime.utcnow()
                job_run.celery_task_id = celery_task_id
                session.commit()
                session.refresh(job_run)
                return _to_dict(job_run)
            return None
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def mark_completed(
        self, job_run_id: int, result: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Mark a job run as completed"""
        from core.database import get_db_session

        session = get_db_session()
        try:
            job_run = (
                session.query(self.model).filter(self.model.id == job_run_id).first()
            )
            if job_run:
                job_run.status = "completed"
                job_run.completed_at = datetime.utcnow()
                if result:
                    job_run.result = result
                session.commit()
                session.refresh(job_run)
                return _to_dict(job_run)
            return None
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def mark_failed(
        self, job_run_id: int, error_message: str
    ) -> Optional[Dict[str, Any]]:
        """Mark a job run as failed"""
        from core.database import get_db_session

        session = get_db_session()
        try:
            job_run = (
                session.query(self.model).filter(self.model.id == job_run_id).first()
            )
            if job_run:
                job_run.status = "failed"
                job_run.completed_at = datetime.utcnow()
                job_run.error_message = error_message
                session.commit()
                session.refresh(job_run)
                return _to_dict(job_run)
            return None
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def mark_cancelled(self, job_run_id: int) -> Optional[Dict[str, Any]]:
        """Mark a job run as cancelled"""
        from core.database import get_db_session

        session = get_db_session()
        try:
            job_run = (
                session.query(self.model).filter(self.model.id == job_run_id).first()
            )
            if job_run:
                job_run.status = "cancelled"
                job_run.completed_at = datetime.utcnow()
                session.commit()
                session.refresh(job_run)
                return _to_dict(job_run)
            return None
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def cleanup_old_runs(self, days: int = 30) -> int:
        """Delete job runs older than specified days. Returns count deleted."""
        from core.database import get_db_session
        from datetime import timedelta

        session = get_db_session()
        try:
            cutoff = datetime.utcnow() - timedelta(days=days)
            result = (
                session.query(self.model).filter(self.model.queued_at < cutoff).delete()
            )
            session.commit()
            return result
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def cleanup_old_runs_hours(self, hours: int = 24) -> int:
        """Delete job runs older than specified hours. Returns count deleted."""
        from core.database import get_db_session
        from datetime import timedelta

        session = get_db_session()
        try:
            cutoff = datetime.utcnow() - timedelta(hours=hours)
            result = (
                session.query(self.model)
                .filter(
                    self.model.queued_at < cutoff,
                    # Only delete completed/failed runs, not running ones
                    self.model.status.in_(["completed", "failed", "cancelled"]),
                )
                .delete(synchronize_session=False)
            )
            session.commit()
            return result
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def clear_all(self) -> int:
        """Delete all job runs. Returns count deleted."""
        from core.database import get_db_session

        session = get_db_session()
        try:
            result = session.query(self.model).delete()
            session.commit()
            return result
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def clear_filtered(
        self,
        status: Optional[List[str]] = None,
        job_type: Optional[List[str]] = None,
        triggered_by: Optional[List[str]] = None,
        template_id: Optional[List[int]] = None,
    ) -> int:
        """Delete job runs matching filters. Supports multiple values. Returns count deleted."""
        from core.database import get_db_session

        session = get_db_session()
        try:
            query = session.query(self.model)

            # Don't delete running or pending jobs
            query = query.filter(self.model.status.notin_(["pending", "running"]))

            if status:
                if len(status) == 1:
                    query = query.filter(self.model.status == status[0])
                else:
                    query = query.filter(self.model.status.in_(status))
            if job_type:
                if len(job_type) == 1:
                    query = query.filter(self.model.job_type == job_type[0])
                else:
                    query = query.filter(self.model.job_type.in_(job_type))
            if triggered_by:
                if len(triggered_by) == 1:
                    query = query.filter(self.model.triggered_by == triggered_by[0])
                else:
                    query = query.filter(self.model.triggered_by.in_(triggered_by))
            if template_id:
                if len(template_id) == 1:
                    query = query.filter(self.model.job_template_id == template_id[0])
                else:
                    query = query.filter(self.model.job_template_id.in_(template_id))

            result = query.delete(synchronize_session="fetch")
            session.commit()
            return result
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def get_distinct_templates(self) -> List[Dict[str, Any]]:
        """Get distinct templates used in job runs."""
        from core.database import get_db_session
        from sqlalchemy import func

        session = get_db_session()
        try:
            # Get distinct template_id and job_name combinations
            results = (
                session.query(
                    self.model.job_template_id,
                    func.max(self.model.job_name).label("template_name"),
                )
                .filter(self.model.job_template_id.isnot(None))
                .group_by(self.model.job_template_id)
                .order_by(func.max(self.model.job_name))
                .all()
            )

            return [
                {
                    "id": r.job_template_id,
                    "name": r.template_name or f"Template {r.job_template_id}",
                }
                for r in results
            ]
        finally:
            session.close()


# Singleton instance
job_run_repository = JobRunRepository()
