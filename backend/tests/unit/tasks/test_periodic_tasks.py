"""Unit tests for tasks/periodic_tasks.py.

Covers worker_health_check, load_cache_schedules_task, check_stale_jobs_task,
and cleanup_client_data_task. All tests run offline — no Redis, Celery broker,
or database required.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest

from tasks.periodic_tasks import (
    check_stale_jobs_task,
    cleanup_client_data_task,
    load_cache_schedules_task,
    worker_health_check,
)

_PATCH_CELERY_APP = "tasks.periodic_tasks.celery_app"
_PATCH_SETTINGS_MGR = "services.settings.manager.SettingsManager"
_PATCH_GET_LAST = "tasks.periodic_tasks._get_last_cache_run"
_PATCH_SET_LAST = "tasks.periodic_tasks._set_last_cache_run"
_PATCH_DISPATCH_DELAY = "tasks.periodic_tasks.dispatch_cache_task.delay"


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ── worker_health_check ───────────────────────────────────────────────────────


@pytest.mark.unit
def test_worker_health_check_reports_active_workers():
    """Returns the count of workers from celery inspect.stats()."""
    mock_inspect = MagicMock()
    mock_inspect.stats.return_value = {
        "worker1@host": {"total": {}},
        "worker2@host": {"total": {}},
    }

    with patch(_PATCH_CELERY_APP) as mock_app:
        mock_app.control.inspect.return_value = mock_inspect
        result = worker_health_check.run()

    assert result["success"] is True
    assert result["active_workers"] == 2


@pytest.mark.unit
def test_worker_health_check_no_workers():
    """Returns active_workers=0 when inspect.stats() returns None."""
    mock_inspect = MagicMock()
    mock_inspect.stats.return_value = None

    with patch(_PATCH_CELERY_APP) as mock_app:
        mock_app.control.inspect.return_value = mock_inspect
        result = worker_health_check.run()

    assert result["success"] is True
    assert result["active_workers"] == 0


@pytest.mark.unit
def test_worker_health_check_inspect_raises_returns_failure():
    """Exception from celery inspect is caught and returned as success=False."""
    with patch(_PATCH_CELERY_APP) as mock_app:
        mock_app.control.inspect.side_effect = RuntimeError("broker unreachable")
        result = worker_health_check.run()

    assert result["success"] is False
    assert "broker unreachable" in result["error"]


# ── load_cache_schedules_task ─────────────────────────────────────────────────


@pytest.mark.unit
def test_load_cache_schedules_cache_disabled():
    """When cache is disabled the task returns empty dispatched list."""
    fake_settings = MagicMock()
    fake_settings.get_cache_settings.return_value = {"enabled": False}

    with patch(_PATCH_SETTINGS_MGR, return_value=fake_settings):
        with patch(_PATCH_DISPATCH_DELAY) as mock_delay:
            result = load_cache_schedules_task.run()

    assert result["success"] is True
    assert result["dispatched"] == []
    mock_delay.assert_not_called()


@pytest.mark.unit
def test_load_cache_schedules_dispatches_devices_when_never_run():
    """Devices cache task is dispatched when last_run is None."""
    fake_settings = MagicMock()
    fake_settings.get_cache_settings.return_value = {
        "enabled": True,
        "devices_cache_interval_minutes": 60,
        "locations_cache_interval_minutes": 0,
    }

    with patch(_PATCH_SETTINGS_MGR, return_value=fake_settings):
        with patch(_PATCH_GET_LAST, return_value=None):
            with patch(_PATCH_SET_LAST):
                with patch(_PATCH_DISPATCH_DELAY) as mock_delay:
                    result = load_cache_schedules_task.run()

    assert result["success"] is True
    assert "devices" in result["dispatched"]
    mock_delay.assert_called_once_with(
        cache_type="devices", task_name="cache_all_devices"
    )


@pytest.mark.unit
def test_load_cache_schedules_dispatches_locations_when_due():
    """Locations cache task is dispatched when the configured interval has elapsed."""
    fake_settings = MagicMock()
    fake_settings.get_cache_settings.return_value = {
        "enabled": True,
        "devices_cache_interval_minutes": 0,
        "locations_cache_interval_minutes": 10,
    }
    overdue_last_run = _now() - timedelta(minutes=15)

    with patch(_PATCH_SETTINGS_MGR, return_value=fake_settings):
        with patch(_PATCH_GET_LAST, return_value=overdue_last_run):
            with patch(_PATCH_SET_LAST):
                with patch(_PATCH_DISPATCH_DELAY) as mock_delay:
                    result = load_cache_schedules_task.run()

    assert "locations" in result["dispatched"]
    mock_delay.assert_called_once_with(
        cache_type="locations", task_name="cache_all_locations"
    )


@pytest.mark.unit
def test_load_cache_schedules_nothing_dispatched_when_intervals_not_due():
    """Neither cache task is dispatched when both ran recently."""
    fake_settings = MagicMock()
    fake_settings.get_cache_settings.return_value = {
        "enabled": True,
        "devices_cache_interval_minutes": 60,
        "locations_cache_interval_minutes": 10,
    }
    recent_last_run = _now() - timedelta(minutes=1)

    with patch(_PATCH_SETTINGS_MGR, return_value=fake_settings):
        with patch(_PATCH_GET_LAST, return_value=recent_last_run):
            with patch(_PATCH_SET_LAST):
                with patch(_PATCH_DISPATCH_DELAY) as mock_delay:
                    result = load_cache_schedules_task.run()

    assert result["dispatched"] == []
    mock_delay.assert_not_called()


@pytest.mark.unit
def test_load_cache_schedules_settings_error_returns_failure():
    """Exception from SettingsManager is caught and returned as success=False."""
    with patch(_PATCH_SETTINGS_MGR, side_effect=RuntimeError("db error")):
        result = load_cache_schedules_task.run()

    assert result["success"] is False
    assert "db error" in result["error"]


# ── check_stale_jobs_task ─────────────────────────────────────────────────────


def _make_jrs(running: list | None = None, pending: list | None = None) -> MagicMock:
    jrs = MagicMock()
    running = running or []
    pending = pending or []
    jrs.get_recent_runs.side_effect = lambda **kw: (
        running if kw.get("status") == "running" else pending
    )
    return jrs


def _running_job(job_id: int, minutes_ago: int, celery_id: str = "task-abc") -> dict:
    started = _now() - timedelta(minutes=minutes_ago)
    return {
        "id": job_id,
        "job_name": f"job-{job_id}",
        "celery_task_id": celery_id,
        "started_at": started.isoformat(),
    }


def _pending_job(job_id: int, minutes_ago: int) -> dict:
    queued = _now() - timedelta(minutes=minutes_ago)
    return {
        "id": job_id,
        "job_name": f"job-{job_id}",
        "celery_task_id": None,
        "queued_at": queued.isoformat(),
    }


@pytest.mark.unit
def test_check_stale_jobs_marks_long_running_job_as_failed():
    """Running job older than 2h absent from active tasks is marked failed."""
    stale_job = _running_job(job_id=1, minutes_ago=130, celery_id="stale-task")
    mock_jrs = _make_jrs(running=[stale_job])

    mock_inspect = MagicMock()
    mock_inspect.active.return_value = {}
    mock_inspect.reserved.return_value = {}

    with patch("service_factory.build_job_run_service", return_value=mock_jrs):
        with patch("celery_app.celery_app") as mock_app:
            mock_app.control.inspect.return_value = mock_inspect
            result = check_stale_jobs_task.run()

    assert result["success"] is True
    assert result["stale_jobs_found"] == 1
    mock_jrs.mark_failed.assert_called_once()
    assert mock_jrs.mark_failed.call_args[0][0] == 1


@pytest.mark.unit
def test_check_stale_jobs_skips_job_still_in_active_tasks():
    """Running job whose Celery task is still active is not marked failed."""
    active_job = _running_job(job_id=2, minutes_ago=130, celery_id="active-task")
    mock_jrs = _make_jrs(running=[active_job])

    mock_inspect = MagicMock()
    mock_inspect.active.return_value = {"worker@host": [{"id": "active-task"}]}
    mock_inspect.reserved.return_value = {}

    with patch("service_factory.build_job_run_service", return_value=mock_jrs):
        with patch("celery_app.celery_app") as mock_app:
            mock_app.control.inspect.return_value = mock_inspect
            result = check_stale_jobs_task.run()

    assert result["stale_jobs_found"] == 0
    mock_jrs.mark_failed.assert_not_called()


@pytest.mark.unit
def test_check_stale_jobs_marks_pending_job_over_one_hour():
    """Pending job stuck for more than 1h is marked failed."""
    old_pending = _pending_job(job_id=3, minutes_ago=65)
    mock_jrs = _make_jrs(pending=[old_pending])

    mock_inspect = MagicMock()
    mock_inspect.active.return_value = {}
    mock_inspect.reserved.return_value = {}

    with patch("service_factory.build_job_run_service", return_value=mock_jrs):
        with patch("celery_app.celery_app") as mock_app:
            mock_app.control.inspect.return_value = mock_inspect
            result = check_stale_jobs_task.run()

    assert result["stale_jobs_found"] == 1
    mock_jrs.mark_failed.assert_called_once()


@pytest.mark.unit
def test_check_stale_jobs_no_stale_jobs():
    """Returns stale_jobs_found=0 when all jobs are fresh."""
    fresh_running = _running_job(job_id=4, minutes_ago=10)
    fresh_pending = _pending_job(job_id=5, minutes_ago=5)
    mock_jrs = _make_jrs(running=[fresh_running], pending=[fresh_pending])

    mock_inspect = MagicMock()
    mock_inspect.active.return_value = {}
    mock_inspect.reserved.return_value = {}

    with patch("service_factory.build_job_run_service", return_value=mock_jrs):
        with patch("celery_app.celery_app") as mock_app:
            mock_app.control.inspect.return_value = mock_inspect
            result = check_stale_jobs_task.run()

    assert result["success"] is True
    assert result["stale_jobs_found"] == 0
    mock_jrs.mark_failed.assert_not_called()


# ── cleanup_client_data_task ────────────────────────────────────────────────


@pytest.mark.unit
def test_cleanup_client_data_disabled_does_not_open_db():
    with patch(_PATCH_SETTINGS_MGR) as MockSM:
        MockSM.return_value.get_celery_settings.return_value = {
            "client_data_cleanup_enabled": False,
        }
        with patch(
            "repositories.client_data_repository.ClientDataRepository"
        ) as MockRepoCls:
            result = cleanup_client_data_task()

    assert result["success"] is True
    assert result["message"] == "Client data cleanup is disabled"
    MockRepoCls.assert_not_called()


@pytest.mark.unit
def test_cleanup_client_data_delegates_to_repository():
    from repositories.client_data_repository import ClientDataCleanupResult

    settings = {
        "client_data_cleanup_enabled": True,
        "client_data_cleanup_age_hours": 24,
    }
    mock_inst = MagicMock()
    mock_inst.delete_records_older_than.return_value = ClientDataCleanupResult(
        4, 5, 6
    )

    with patch(_PATCH_SETTINGS_MGR) as MockSM:
        MockSM.return_value.get_celery_settings.return_value = settings
        with patch(
            "repositories.client_data_repository.ClientDataRepository",
            return_value=mock_inst,
        ):
            result = cleanup_client_data_task()

    assert result["success"] is True
    assert result["removed_ip_addresses"] == 4
    assert result["removed_mac_addresses"] == 5
    assert result["removed_hostnames"] == 6
    mock_inst.delete_records_older_than.assert_called_once()
    cutoff = mock_inst.delete_records_older_than.call_args[0][0]
    assert cutoff.tzinfo is not None
