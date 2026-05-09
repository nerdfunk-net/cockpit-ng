"""Job run service — tracking and lifecycle for Celery task runs."""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, TYPE_CHECKING

from repositories.jobs.job_run_repository import job_run_repository as repo

if TYPE_CHECKING:
    from services.jobs.job_schedule_service import JobScheduleService
    from services.jobs.job_template_service import JobTemplateService

logger = logging.getLogger(__name__)


class JobRunService:
    def __init__(
        self,
        schedule_service: "JobScheduleService",
        template_service: "JobTemplateService",
    ) -> None:
        self._repo = repo
        self._schedule_service = schedule_service
        self._template_service = template_service

    def create_job_run(
        self,
        job_name: str,
        job_type: str,
        triggered_by: str = "schedule",
        job_schedule_id: Optional[int] = None,
        job_template_id: Optional[int] = None,
        target_devices: Optional[List[str]] = None,
        executed_by: Optional[str] = None,
    ) -> Dict[str, Any]:
        job_run_data = self._repo.create(
            job_schedule_id=job_schedule_id,
            job_template_id=job_template_id,
            job_name=job_name,
            job_type=job_type,
            status="pending",
            triggered_by=triggered_by,
            target_devices=json.dumps(target_devices) if target_devices else None,
            executed_by=executed_by,
        )

        logger.info(
            "Created job run: %s (ID: %s, triggered_by: %s)",
            job_name,
            job_run_data.get("id"),
            triggered_by,
        )
        return self._to_dict(job_run_data)

    def get_job_run(self, run_id: int) -> Optional[Dict[str, Any]]:
        job_run = self._repo.get_by_id(run_id)
        if job_run:
            return self._to_dict(job_run)
        return None

    def get_job_run_by_celery_id(self, celery_task_id: str) -> Optional[Dict[str, Any]]:
        job_run = self._repo.get_by_celery_task_id(celery_task_id)
        if job_run:
            return self._to_dict(job_run)
        return None

    def get_job_runs_by_celery_ids(self, celery_task_ids: List[str]) -> List[Dict[str, Any]]:
        job_runs = self._repo.get_by_celery_task_ids(celery_task_ids)
        return [self._to_dict(job_run) for job_run in job_runs]

    def list_job_runs(
        self,
        page: int = 1,
        page_size: int = 25,
        status: Optional[List[str]] = None,
        job_type: Optional[List[str]] = None,
        exclude_job_type: Optional[List[str]] = None,
        triggered_by: Optional[List[str]] = None,
        schedule_id: Optional[int] = None,
        template_id: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        items, total = self._repo.get_paginated(
            page=page,
            page_size=page_size,
            status=status,
            job_type=job_type,
            exclude_job_type=exclude_job_type,
            triggered_by=triggered_by,
            schedule_id=schedule_id,
            template_id=template_id,
        )

        total_pages = (total + page_size - 1) // page_size

        return {
            "items": [self._to_dict(item) for item in items],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
        }

    def get_recent_runs(
        self, limit: int = 50, status: Optional[str] = None, job_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        runs = self._repo.get_recent_runs(limit=limit, status=status, job_type=job_type)
        return [self._to_dict(run) for run in runs]

    def get_runs_since(
        self, since: datetime, status: Optional[str] = None, job_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        runs = self._repo.get_runs_since(since=since, status=status, job_type=job_type)
        return [self._to_dict(run) for run in runs]

    def get_schedule_runs(self, schedule_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        runs = self._repo.get_by_schedule(schedule_id, limit=limit)
        return [self._to_dict(run) for run in runs]

    def mark_started(self, run_id: int, celery_task_id: str) -> Optional[Dict[str, Any]]:
        job_run = self._repo.mark_started(run_id, celery_task_id)
        if job_run:
            logger.info("Job run %s started (task: %s)", run_id, celery_task_id)
            return self._to_dict(job_run)
        return None

    def mark_completed(
        self, run_id: int, result: Optional[Dict] = None
    ) -> Optional[Dict[str, Any]]:
        result_json = json.dumps(result) if result else None
        job_run = self._repo.mark_completed(run_id, result=result_json)
        if job_run:
            logger.info("Job run %s completed", run_id)
            return self._to_dict(job_run)
        return None

    def mark_failed(self, run_id: int, error_message: str) -> Optional[Dict[str, Any]]:
        job_run = self._repo.mark_failed(run_id, error_message)
        if job_run:
            logger.warning("Job run %s failed: %s", run_id, error_message)
            return self._to_dict(job_run)
        return None

    def mark_cancelled(self, run_id: int) -> Optional[Dict[str, Any]]:
        job_run = self._repo.mark_cancelled(run_id)
        if job_run:
            logger.info("Job run %s cancelled", run_id)
            return self._to_dict(job_run)
        return None

    def get_running_count(self) -> int:
        return self._repo.get_running_count()

    def get_pending_count(self) -> int:
        return self._repo.get_pending_count()

    def get_queue_stats(self) -> Dict[str, Any]:
        return {"running": self._repo.get_running_count(), "pending": self._repo.get_pending_count()}

    def get_dashboard_stats(self) -> Dict[str, Any]:
        from core.database import get_db_session
        from sqlalchemy import text

        session = get_db_session()

        try:
            job_stats = session.execute(
                text("""
                SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                    SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running
                FROM job_runs
            """)
            ).fetchone()

            backup_stats = session.execute(
                text("""
                SELECT
                    result
                FROM job_runs
                WHERE job_type = 'backup'
                    AND status = 'completed'
                    AND queued_at >= NOW() - INTERVAL '30 days'
            """)
            ).fetchall()

            total_backed_up = 0
            total_failed = 0

            for row in backup_stats:
                if row[0]:
                    try:
                        result = json.loads(row[0])
                        total_backed_up += result.get("devices_backed_up", 0)
                        total_failed += result.get("devices_failed", 0)
                    except (json.JSONDecodeError, AttributeError):
                        pass

            return {
                "job_runs": {
                    "total": job_stats[0] or 0,
                    "completed": job_stats[1] or 0,
                    "failed": job_stats[2] or 0,
                    "running": job_stats[3] or 0,
                },
                "backup_devices": {
                    "total_devices": total_backed_up + total_failed,
                    "successful_devices": total_backed_up,
                    "failed_devices": total_failed,
                },
            }

        finally:
            session.close()

    def cleanup_old_runs(self, days: int = 30) -> int:
        count = self._repo.cleanup_old_runs(days)
        logger.info("Cleaned up %s old job runs (older than %s days)", count, days)
        return count

    def cleanup_old_runs_hours(self, hours: int = 24) -> int:
        count = self._repo.cleanup_old_runs_hours(hours)
        logger.info("Cleaned up %s old job runs (older than %s hours)", count, hours)
        return count

    def clear_all_runs(self) -> int:
        count = self._repo.clear_all()
        logger.info("Cleared all job runs (%s deleted)", count)
        return count

    def clear_filtered_runs(
        self,
        status: Optional[List[str]] = None,
        job_type: Optional[List[str]] = None,
        triggered_by: Optional[List[str]] = None,
        template_id: Optional[List[int]] = None,
    ) -> int:
        count = self._repo.clear_filtered(
            status=status,
            job_type=job_type,
            triggered_by=triggered_by,
            template_id=template_id,
        )
        filters = []
        if status:
            filters.append(f"status={','.join(status)}")
        if job_type:
            filters.append(f"job_type={','.join(job_type)}")
        if triggered_by:
            filters.append(f"triggered_by={','.join(triggered_by)}")
        if template_id:
            filters.append(f"template_id={','.join(map(str, template_id))}")
        filter_desc = ", ".join(filters) if filters else "all"
        logger.info("Cleared %s job runs (filter: %s)", count, filter_desc)
        return count

    def get_distinct_templates(self) -> List[Dict[str, Any]]:
        return self._repo.get_distinct_templates()

    def delete_job_run(self, run_id: int) -> bool:
        deleted = self._repo.delete(run_id)
        if deleted:
            logger.info("Deleted job run %s", run_id)
        return deleted

    def _to_dict(self, job_run_data) -> Dict[str, Any]:
        started_at = job_run_data.get("started_at")
        completed_at = job_run_data.get("completed_at")

        duration_seconds = None
        if started_at and completed_at:
            if isinstance(started_at, str):
                started_at = datetime.fromisoformat(started_at)
            if isinstance(completed_at, str):
                completed_at = datetime.fromisoformat(completed_at)
            if isinstance(started_at, datetime) and isinstance(completed_at, datetime):
                duration = completed_at - started_at
                duration_seconds = duration.total_seconds()

        target_devices = None
        raw_target_devices = job_run_data.get("target_devices")
        if raw_target_devices:
            if isinstance(raw_target_devices, list):
                target_devices = raw_target_devices
            else:
                try:
                    target_devices = json.loads(raw_target_devices)
                except (json.JSONDecodeError, TypeError):
                    target_devices = None

        result = None
        raw_result = job_run_data.get("result")
        if raw_result:
            if isinstance(raw_result, dict):
                result = raw_result
            else:
                try:
                    result = json.loads(raw_result)
                except (json.JSONDecodeError, TypeError):
                    result = None

        schedule_name = None
        template_name = None

        job_schedule_id = job_run_data.get("job_schedule_id")
        job_template_id = job_run_data.get("job_template_id")

        if job_schedule_id:
            schedule = self._schedule_service.get_job_schedule(job_schedule_id)
            if schedule:
                schedule_name = schedule.get("job_identifier")

        if job_template_id:
            template = self._template_service.get_job_template(job_template_id)
            if template:
                template_name = template.get("name")

        queued_at = job_run_data.get("queued_at")
        if isinstance(queued_at, datetime):
            queued_at = queued_at.isoformat()
        if isinstance(started_at, datetime):
            started_at = started_at.isoformat()
        if isinstance(completed_at, datetime):
            completed_at = completed_at.isoformat()

        return {
            "id": job_run_data.get("id"),
            "job_schedule_id": job_schedule_id,
            "job_template_id": job_template_id,
            "celery_task_id": job_run_data.get("celery_task_id"),
            "job_name": job_run_data.get("job_name"),
            "job_type": job_run_data.get("job_type"),
            "status": job_run_data.get("status"),
            "triggered_by": job_run_data.get("triggered_by"),
            "queued_at": queued_at,
            "started_at": started_at,
            "completed_at": completed_at,
            "duration_seconds": duration_seconds,
            "error_message": job_run_data.get("error_message"),
            "result": result,
            "target_devices": target_devices,
            "executed_by": job_run_data.get("executed_by"),
            "schedule_name": schedule_name,
            "template_name": template_name,
        }
