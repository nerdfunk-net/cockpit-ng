"""Stateful in-memory job repository fakes for unit testing.

Drop-in replacements for JobTemplateRepository, JobScheduleRepository, and
JobRunRepository. All data lives in plain dicts keyed by integer IDs. Methods
mirror the real repository interfaces so services under test require no changes.

Usage::

    from tests.mocks.fake_job_repositories import (
        FakeJobTemplateRepository,
        FakeJobScheduleRepository,
        FakeJobRunRepository,
    )

    tmpl_repo = FakeJobTemplateRepository()
    tmpl = tmpl_repo.create(name="backup", job_type="backup", ...)
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# Lightweight stand-in objects mirroring SQLAlchemy model attribute access
# ---------------------------------------------------------------------------


class _FakeJobTemplate:
    _counter = 0

    def __init__(self, **kwargs: Any) -> None:
        _FakeJobTemplate._counter += 1
        self.id: int = _FakeJobTemplate._counter
        self.name: str = kwargs.get("name", "")
        self.job_type: str = kwargs.get("job_type", "backup")
        self.description: Optional[str] = kwargs.get("description")
        self.config_repository_id: Optional[int] = kwargs.get("config_repository_id")
        self.inventory_source: str = kwargs.get("inventory_source", "all")
        self.inventory_repository_id: Optional[int] = kwargs.get(
            "inventory_repository_id"
        )
        self.inventory_name: Optional[str] = kwargs.get("inventory_name")
        self.command_template_name: Optional[str] = kwargs.get("command_template_name")
        self.backup_running_config_path: Optional[str] = kwargs.get(
            "backup_running_config_path"
        )
        self.backup_startup_config_path: Optional[str] = kwargs.get(
            "backup_startup_config_path"
        )
        self.write_timestamp_to_custom_field: bool = kwargs.get(
            "write_timestamp_to_custom_field", False
        )
        self.timestamp_custom_field_name: Optional[str] = kwargs.get(
            "timestamp_custom_field_name"
        )
        self.activate_changes_after_sync: bool = kwargs.get(
            "activate_changes_after_sync", True
        )
        self.use_last_compare_run: bool = kwargs.get("use_last_compare_run", True)
        self.sync_not_found_devices: bool = kwargs.get("sync_not_found_devices", False)
        self.scan_resolve_dns: bool = kwargs.get("scan_resolve_dns", False)
        self.scan_ping_count: Optional[int] = kwargs.get("scan_ping_count")
        self.scan_timeout_ms: Optional[int] = kwargs.get("scan_timeout_ms")
        self.scan_retries: Optional[int] = kwargs.get("scan_retries")
        self.scan_interval_ms: Optional[int] = kwargs.get("scan_interval_ms")
        self.scan_custom_field_name: Optional[str] = kwargs.get(
            "scan_custom_field_name"
        )
        self.scan_custom_field_value: Optional[str] = kwargs.get(
            "scan_custom_field_value"
        )
        self.scan_response_custom_field_name: Optional[str] = kwargs.get(
            "scan_response_custom_field_name"
        )
        self.scan_set_reachable_ip_active: bool = kwargs.get(
            "scan_set_reachable_ip_active", True
        )
        self.scan_max_ips: Optional[int] = kwargs.get("scan_max_ips")
        self.parallel_tasks: int = kwargs.get("parallel_tasks", 1)
        self.deploy_template_id: Optional[int] = kwargs.get("deploy_template_id")
        self.deploy_agent_id: Optional[str] = kwargs.get("deploy_agent_id")
        self.deploy_path: Optional[str] = kwargs.get("deploy_path")
        self.deploy_custom_variables: Optional[str] = kwargs.get(
            "deploy_custom_variables"
        )
        self.activate_after_deploy: bool = kwargs.get("activate_after_deploy", True)
        self.deploy_templates: Optional[str] = kwargs.get("deploy_templates")
        self.ip_action: Optional[str] = kwargs.get("ip_action")
        self.ip_filter_field: Optional[str] = kwargs.get("ip_filter_field")
        self.ip_filter_type: Optional[str] = kwargs.get("ip_filter_type")
        self.ip_filter_value: Optional[str] = kwargs.get("ip_filter_value")
        self.ip_include_null: bool = kwargs.get("ip_include_null", False)
        self.ip_mark_status: Optional[str] = kwargs.get("ip_mark_status")
        self.ip_mark_tag: Optional[str] = kwargs.get("ip_mark_tag")
        self.ip_mark_description: Optional[str] = kwargs.get("ip_mark_description")
        self.csv_import_repo_id: Optional[int] = kwargs.get("csv_import_repo_id")
        self.csv_import_file_path: Optional[str] = kwargs.get("csv_import_file_path")
        self.csv_import_type: Optional[str] = kwargs.get("csv_import_type")
        self.csv_import_primary_key: Optional[str] = kwargs.get(
            "csv_import_primary_key"
        )
        self.csv_import_update_existing: bool = kwargs.get(
            "csv_import_update_existing", True
        )
        self.csv_import_delimiter: Optional[str] = kwargs.get("csv_import_delimiter")
        self.csv_import_quote_char: Optional[str] = kwargs.get("csv_import_quote_char")
        self.csv_import_column_mapping: Optional[str] = kwargs.get(
            "csv_import_column_mapping"
        )
        self.csv_import_file_filter: Optional[str] = kwargs.get(
            "csv_import_file_filter"
        )
        self.csv_import_defaults: Optional[str] = kwargs.get("csv_import_defaults")
        self.csv_import_format: Optional[str] = kwargs.get("csv_import_format")
        self.csv_import_add_prefixes: bool = kwargs.get(
            "csv_import_add_prefixes", False
        )
        self.csv_import_default_prefix_length: Optional[str] = kwargs.get(
            "csv_import_default_prefix_length"
        )
        self.csv_export_repo_id: Optional[int] = kwargs.get("csv_export_repo_id")
        self.csv_export_file_path: Optional[str] = kwargs.get("csv_export_file_path")
        self.csv_export_properties: Optional[str] = kwargs.get("csv_export_properties")
        self.csv_export_delimiter: Optional[str] = kwargs.get("csv_export_delimiter")
        self.csv_export_quote_char: Optional[str] = kwargs.get("csv_export_quote_char")
        self.csv_export_include_headers: bool = kwargs.get(
            "csv_export_include_headers", True
        )
        self.ping_agent_id: Optional[str] = kwargs.get("ping_agent_id")
        self.set_primary_ip_strategy: Optional[str] = kwargs.get(
            "set_primary_ip_strategy"
        )
        self.set_primary_ip_agent_id: Optional[str] = kwargs.get(
            "set_primary_ip_agent_id"
        )
        self.collect_ip_address: bool = kwargs.get("collect_ip_address", True)
        self.collect_mac_address: bool = kwargs.get("collect_mac_address", True)
        self.collect_hostname: bool = kwargs.get("collect_hostname", True)
        self.is_global: bool = kwargs.get("is_global", False)
        self.user_id: Optional[int] = kwargs.get("user_id")
        self.created_by: Optional[str] = kwargs.get("created_by")
        self.created_at: datetime = datetime.now(timezone.utc)
        self.updated_at: datetime = datetime.now(timezone.utc)


class _FakeJobSchedule:
    _counter = 0

    def __init__(self, **kwargs: Any) -> None:
        _FakeJobSchedule._counter += 1
        self.id: int = _FakeJobSchedule._counter
        self.job_identifier: str = kwargs.get("job_identifier", "")
        self.job_template_id: Optional[int] = kwargs.get("job_template_id")
        self.schedule_type: str = kwargs.get("schedule_type", "interval")
        self.cron_expression: Optional[str] = kwargs.get("cron_expression")
        self.interval_minutes: Optional[int] = kwargs.get("interval_minutes")
        self.start_time: Optional[str] = kwargs.get("start_time")
        self.start_date: Optional[str] = kwargs.get("start_date")
        self.is_active: bool = kwargs.get("is_active", True)
        self.is_global: bool = kwargs.get("is_global", True)
        self.user_id: Optional[int] = kwargs.get("user_id")
        self.credential_id: Optional[int] = kwargs.get("credential_id")
        self.job_parameters: Optional[str] = kwargs.get("job_parameters")
        self.next_run: Optional[datetime] = kwargs.get("next_run")
        self.last_run: Optional[datetime] = kwargs.get("last_run")
        self.created_at: datetime = datetime.now(timezone.utc)
        self.updated_at: datetime = datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# FakeJobTemplateRepository
# ---------------------------------------------------------------------------


class FakeJobTemplateRepository:
    """In-memory replacement for JobTemplateRepository."""

    def __init__(self) -> None:
        _FakeJobTemplate._counter = 0
        self._templates: Dict[int, _FakeJobTemplate] = {}

    def get_by_id(self, id: int, db: Any = None) -> Optional[_FakeJobTemplate]:
        return self._templates.get(id)

    def get_all(self, db: Any = None) -> List[_FakeJobTemplate]:
        return list(self._templates.values())

    def create(self, db: Any = None, **kwargs: Any) -> _FakeJobTemplate:
        tmpl = _FakeJobTemplate(**kwargs)
        self._templates[tmpl.id] = tmpl
        return tmpl

    def update(
        self, id: int, db: Any = None, **kwargs: Any
    ) -> Optional[_FakeJobTemplate]:
        tmpl = self._templates.get(id)
        if tmpl is None:
            return None
        for key, value in kwargs.items():
            if hasattr(tmpl, key):
                setattr(tmpl, key, value)
        tmpl.updated_at = datetime.now(timezone.utc)
        return tmpl

    def delete(self, id: int, db: Any = None) -> bool:
        if id in self._templates:
            del self._templates[id]
            return True
        return False

    def get_by_name(
        self, name: str, user_id: Optional[int] = None
    ) -> Optional[_FakeJobTemplate]:
        for tmpl in self._templates.values():
            if tmpl.name == name:
                if user_id is None or tmpl.is_global or tmpl.user_id == user_id:
                    return tmpl
        return None

    def get_user_templates(
        self, user_id: int, job_type: Optional[str] = None
    ) -> List[_FakeJobTemplate]:
        results = [
            t for t in self._templates.values() if t.is_global or t.user_id == user_id
        ]
        if job_type is not None:
            results = [t for t in results if t.job_type == job_type]
        return sorted(results, key=lambda t: t.name)

    def get_global_templates(
        self, job_type: Optional[str] = None
    ) -> List[_FakeJobTemplate]:
        results = [t for t in self._templates.values() if t.is_global]
        if job_type is not None:
            results = [t for t in results if t.job_type == job_type]
        return sorted(results, key=lambda t: t.name)

    def get_by_type(
        self, job_type: str, user_id: Optional[int] = None
    ) -> List[_FakeJobTemplate]:
        results = [t for t in self._templates.values() if t.job_type == job_type]
        if user_id is not None:
            results = [t for t in results if t.is_global or t.user_id == user_id]
        return sorted(results, key=lambda t: t.name)

    def check_name_exists(
        self, name: str, user_id: Optional[int] = None, exclude_id: Optional[int] = None
    ) -> bool:
        for tmpl in self._templates.values():
            if tmpl.name != name:
                continue
            if exclude_id is not None and tmpl.id == exclude_id:
                continue
            if user_id is None or tmpl.is_global or tmpl.user_id == user_id:
                return True
        return False


# ---------------------------------------------------------------------------
# FakeJobScheduleRepository
# ---------------------------------------------------------------------------


class FakeJobScheduleRepository:
    """In-memory replacement for JobScheduleRepository."""

    def __init__(self) -> None:
        _FakeJobSchedule._counter = 0
        self._schedules: Dict[int, _FakeJobSchedule] = {}

    def get_by_id(self, id: int, db: Any = None) -> Optional[_FakeJobSchedule]:
        return self._schedules.get(id)

    def get_all(self, db: Any = None) -> List[_FakeJobSchedule]:
        return list(self._schedules.values())

    def create(self, db: Any = None, **kwargs: Any) -> _FakeJobSchedule:
        sched = _FakeJobSchedule(**kwargs)
        self._schedules[sched.id] = sched
        return sched

    def update(
        self, id: int, db: Any = None, **kwargs: Any
    ) -> Optional[_FakeJobSchedule]:
        sched = self._schedules.get(id)
        if sched is None:
            return None
        for key, value in kwargs.items():
            if hasattr(sched, key):
                setattr(sched, key, value)
        sched.updated_at = datetime.now(timezone.utc)
        return sched

    def delete(self, id: int, db: Any = None) -> bool:
        if id in self._schedules:
            del self._schedules[id]
            return True
        return False

    def get_by_identifier(self, job_identifier: str) -> Optional[_FakeJobSchedule]:
        for sched in self._schedules.values():
            if sched.job_identifier == job_identifier:
                return sched
        return None

    def get_user_schedules(
        self, user_id: int, is_active: Optional[bool] = None
    ) -> List[_FakeJobSchedule]:
        results = [
            s for s in self._schedules.values() if s.is_global or s.user_id == user_id
        ]
        if is_active is not None:
            results = [s for s in results if s.is_active == is_active]
        return sorted(results, key=lambda s: s.created_at, reverse=True)

    def get_global_schedules(
        self, is_active: Optional[bool] = None
    ) -> List[_FakeJobSchedule]:
        results = [s for s in self._schedules.values() if s.is_global]
        if is_active is not None:
            results = [s for s in results if s.is_active == is_active]
        return sorted(results, key=lambda s: s.created_at, reverse=True)

    def get_active_schedules(self) -> List[_FakeJobSchedule]:
        return [s for s in self._schedules.values() if s.is_active]

    def get_with_filters(
        self,
        user_id: Optional[int] = None,
        is_global: Optional[bool] = None,
        is_active: Optional[bool] = None,
    ) -> List[_FakeJobSchedule]:
        results = list(self._schedules.values())
        if user_id is not None:
            results = [s for s in results if s.is_global or s.user_id == user_id]
        if is_global is not None:
            results = [s for s in results if s.is_global == is_global]
        if is_active is not None:
            results = [s for s in results if s.is_active == is_active]
        return sorted(results, key=lambda s: s.created_at, reverse=True)


# ---------------------------------------------------------------------------
# FakeJobRunRepository  (returns plain dicts, same as real implementation)
# ---------------------------------------------------------------------------


class FakeJobRunRepository:
    """In-memory replacement for JobRunRepository.

    The real repository returns plain dicts from every method (not model
    instances), so this fake does the same.
    """

    _counter = 0

    def __init__(self) -> None:
        FakeJobRunRepository._counter = 0
        self._runs: Dict[int, Dict[str, Any]] = {}

    # -- helpers ---------------------------------------------------------------

    def _new_id(self) -> int:
        FakeJobRunRepository._counter += 1
        return FakeJobRunRepository._counter

    # -- write methods ---------------------------------------------------------

    def create(self, **kwargs: Any) -> Dict[str, Any]:
        run_id = self._new_id()
        record: Dict[str, Any] = {
            "id": run_id,
            "job_schedule_id": kwargs.get("job_schedule_id"),
            "job_template_id": kwargs.get("job_template_id"),
            "celery_task_id": kwargs.get("celery_task_id"),
            "job_name": kwargs.get("job_name", ""),
            "job_type": kwargs.get("job_type", ""),
            "status": kwargs.get("status", "pending"),
            "triggered_by": kwargs.get("triggered_by", "schedule"),
            "queued_at": datetime.now(timezone.utc),
            "started_at": None,
            "completed_at": None,
            "error_message": None,
            "result": None,
            "target_devices": kwargs.get("target_devices"),
            "executed_by": kwargs.get("executed_by"),
        }
        self._runs[run_id] = record
        return record

    def get_by_id(self, id: int) -> Optional[Dict[str, Any]]:
        return self._runs.get(id)

    def get_by_celery_task_id(self, celery_task_id: str) -> Optional[Dict[str, Any]]:
        for run in self._runs.values():
            if run.get("celery_task_id") == celery_task_id:
                return run
        return None

    def get_by_celery_task_ids(
        self, celery_task_ids: List[str]
    ) -> List[Dict[str, Any]]:
        return [
            r for r in self._runs.values() if r.get("celery_task_id") in celery_task_ids
        ]

    def get_by_schedule(
        self, schedule_id: int, limit: int = 50, status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        results = [
            r for r in self._runs.values() if r.get("job_schedule_id") == schedule_id
        ]
        if status:
            results = [r for r in results if r.get("status") == status]
        return results[:limit]

    def get_recent_runs(
        self,
        limit: int = 50,
        status: Optional[str] = None,
        job_type: Optional[str] = None,
        triggered_by: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        results = list(self._runs.values())
        if status:
            results = [r for r in results if r.get("status") == status]
        if job_type:
            results = [r for r in results if r.get("job_type") == job_type]
        if triggered_by:
            results = [r for r in results if r.get("triggered_by") == triggered_by]
        return results[:limit]

    def get_runs_since(
        self,
        since: datetime,
        status: Optional[str] = None,
        job_type: Optional[str] = None,
        triggered_by: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        results = [
            r
            for r in self._runs.values()
            if r.get("queued_at") and r["queued_at"] >= since
        ]
        if status:
            results = [r for r in results if r.get("status") == status]
        if job_type:
            results = [r for r in results if r.get("job_type") == job_type]
        if triggered_by:
            results = [r for r in results if r.get("triggered_by") == triggered_by]
        return results

    def get_paginated(
        self,
        page: int = 1,
        page_size: int = 25,
        status: Optional[List[str]] = None,
        job_type: Optional[List[str]] = None,
        exclude_job_type: Optional[List[str]] = None,
        triggered_by: Optional[List[str]] = None,
        schedule_id: Optional[int] = None,
        template_id: Optional[List[int]] = None,
    ) -> tuple:
        results = list(self._runs.values())
        if status:
            results = [r for r in results if r.get("status") in status]
        if job_type:
            results = [r for r in results if r.get("job_type") in job_type]
        if exclude_job_type:
            results = [r for r in results if r.get("job_type") not in exclude_job_type]
        if triggered_by:
            results = [r for r in results if r.get("triggered_by") in triggered_by]
        if schedule_id is not None:
            results = [r for r in results if r.get("job_schedule_id") == schedule_id]
        if template_id:
            results = [r for r in results if r.get("job_template_id") in template_id]
        total = len(results)
        offset = (page - 1) * page_size
        return results[offset : offset + page_size], total

    def mark_started(
        self, job_run_id: int, celery_task_id: str
    ) -> Optional[Dict[str, Any]]:
        run = self._runs.get(job_run_id)
        if run:
            run["status"] = "running"
            run["celery_task_id"] = celery_task_id
            run["started_at"] = datetime.now(timezone.utc)
        return run

    def mark_completed(
        self, job_run_id: int, result: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        run = self._runs.get(job_run_id)
        if run:
            run["status"] = "completed"
            run["completed_at"] = datetime.now(timezone.utc)
            run["result"] = result
        return run

    def mark_failed(
        self, job_run_id: int, error_message: str
    ) -> Optional[Dict[str, Any]]:
        run = self._runs.get(job_run_id)
        if run:
            run["status"] = "failed"
            run["completed_at"] = datetime.now(timezone.utc)
            run["error_message"] = error_message
        return run

    def mark_cancelled(self, job_run_id: int) -> Optional[Dict[str, Any]]:
        run = self._runs.get(job_run_id)
        if run:
            run["status"] = "cancelled"
            run["completed_at"] = datetime.now(timezone.utc)
        return run

    def get_running_count(self) -> int:
        return sum(1 for r in self._runs.values() if r.get("status") == "running")

    def get_pending_count(self) -> int:
        return sum(1 for r in self._runs.values() if r.get("status") == "pending")

    def cleanup_old_runs(self, days: int = 30) -> int:
        from datetime import timedelta

        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        to_delete = [
            rid
            for rid, r in self._runs.items()
            if r.get("queued_at") and r["queued_at"] < cutoff
        ]
        for rid in to_delete:
            del self._runs[rid]
        return len(to_delete)

    def cleanup_old_runs_hours(self, hours: int = 24) -> int:
        from datetime import timedelta

        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        terminal = {"completed", "failed", "cancelled"}
        to_delete = [
            rid
            for rid, r in self._runs.items()
            if r.get("queued_at")
            and r["queued_at"] < cutoff
            and r.get("status") in terminal
        ]
        for rid in to_delete:
            del self._runs[rid]
        return len(to_delete)

    def clear_all(self) -> int:
        count = len(self._runs)
        self._runs.clear()
        return count

    def clear_filtered(
        self,
        status: Optional[List[str]] = None,
        job_type: Optional[List[str]] = None,
        triggered_by: Optional[List[str]] = None,
        template_id: Optional[List[int]] = None,
    ) -> int:
        non_terminal = {"pending", "running"}
        to_delete = []
        for rid, r in self._runs.items():
            if r.get("status") in non_terminal:
                continue
            if status and r.get("status") not in status:
                continue
            if job_type and r.get("job_type") not in job_type:
                continue
            if triggered_by and r.get("triggered_by") not in triggered_by:
                continue
            if template_id and r.get("job_template_id") not in template_id:
                continue
            to_delete.append(rid)
        for rid in to_delete:
            del self._runs[rid]
        return len(to_delete)

    def get_all_by_type_and_statuses(
        self, job_type: str, statuses: List[str]
    ) -> List[Dict[str, Any]]:
        return [
            r
            for r in self._runs.values()
            if r.get("job_type") == job_type and r.get("status") in statuses
        ]

    def get_distinct_templates(self) -> List[Dict[str, Any]]:
        seen: Dict[int, str] = {}
        for r in self._runs.values():
            tid = r.get("job_template_id")
            if tid is not None:
                seen.setdefault(tid, r.get("job_name") or f"Template {tid}")
        return [{"id": tid, "name": name} for tid, name in sorted(seen.items())]

    def delete(self, id: int) -> bool:
        if id in self._runs:
            del self._runs[id]
            return True
        return False
