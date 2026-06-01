"""Unit tests for JobRunService using FakeJobRunRepository.

All tests run offline — no database required.
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock

import pytest

from services.jobs.job_run_service import JobRunService
from tests.mocks.fake_job_repositories import FakeJobRunRepository

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def run_repo() -> FakeJobRunRepository:
    return FakeJobRunRepository()


@pytest.fixture
def schedule_service() -> MagicMock:
    mock = MagicMock()
    mock.get_job_schedule.return_value = None
    return mock


@pytest.fixture
def template_service() -> MagicMock:
    mock = MagicMock()
    mock.get_job_template.return_value = None
    return mock


@pytest.fixture
def svc(
    run_repo: FakeJobRunRepository,
    schedule_service: MagicMock,
    template_service: MagicMock,
) -> JobRunService:
    service = JobRunService.__new__(JobRunService)
    service._repo = run_repo
    service._schedule_service = schedule_service
    service._template_service = template_service
    return service


def _create_run(
    svc: JobRunService,
    job_name: str = "backup-run",
    job_type: str = "backup",
    triggered_by: str = "schedule",
) -> dict:
    return svc.create_job_run(
        job_name=job_name,
        job_type=job_type,
        triggered_by=triggered_by,
    )


# ===========================================================================
# create_job_run
# ===========================================================================


@pytest.mark.unit
class TestCreateJobRun:
    def test_creates_with_pending_status(self, svc: JobRunService) -> None:
        result = _create_run(svc)

        assert result["id"] is not None
        assert result["status"] == "pending"
        assert result["job_name"] == "backup-run"
        assert result["job_type"] == "backup"
        assert result["triggered_by"] == "schedule"

    def test_target_devices_serialised(self, svc: JobRunService) -> None:
        devices = ["router1", "switch2"]
        result = svc.create_job_run(
            job_name="targeted-run",
            job_type="backup",
            target_devices=devices,
        )
        assert result["target_devices"] == devices

    def test_executed_by_stored(self, svc: JobRunService) -> None:
        result = svc.create_job_run(
            job_name="manual-run",
            job_type="backup",
            triggered_by="manual",
            executed_by="alice",
        )
        assert result["executed_by"] == "alice"

    def test_ids_are_unique(self, svc: JobRunService) -> None:
        r1 = _create_run(svc, "run-1")
        r2 = _create_run(svc, "run-2")
        assert r1["id"] != r2["id"]

    def test_enriched_with_schedule_and_template_names(
        self,
        svc: JobRunService,
        schedule_service: MagicMock,
        template_service: MagicMock,
    ) -> None:
        schedule_service.get_job_schedule.return_value = {"job_identifier": "daily-backup"}
        template_service.get_job_template.return_value = {"name": "backup-tmpl"}

        result = svc.create_job_run(
            job_name="enriched",
            job_type="backup",
            job_schedule_id=1,
            job_template_id=1,
        )
        assert result["schedule_name"] == "daily-backup"
        assert result["template_name"] == "backup-tmpl"


# ===========================================================================
# get_job_run
# ===========================================================================


@pytest.mark.unit
class TestGetJobRun:
    def test_found(self, svc: JobRunService) -> None:
        created = _create_run(svc)
        found = svc.get_job_run(created["id"])
        assert found is not None
        assert found["id"] == created["id"]

    def test_not_found(self, svc: JobRunService) -> None:
        assert svc.get_job_run(9999) is None

    def test_get_by_celery_id(self, svc: JobRunService, run_repo: FakeJobRunRepository) -> None:
        run_repo.create(job_name="x", job_type="backup", celery_task_id="abc-123")
        found = svc.get_job_run_by_celery_id("abc-123")
        assert found is not None
        assert found["celery_task_id"] == "abc-123"


# ===========================================================================
# list_job_runs (pagination)
# ===========================================================================


@pytest.mark.unit
class TestListJobRuns:
    def test_returns_paginated_dict(self, svc: JobRunService) -> None:
        for i in range(5):
            _create_run(svc, f"run-{i}")

        result = svc.list_job_runs(page=1, page_size=3)
        assert "items" in result
        assert "total" in result
        assert "page" in result
        assert "page_size" in result
        assert "total_pages" in result
        assert len(result["items"]) == 3
        assert result["total"] == 5

    def test_second_page(self, svc: JobRunService) -> None:
        for i in range(5):
            _create_run(svc, f"run-{i}")

        result = svc.list_job_runs(page=2, page_size=3)
        assert len(result["items"]) == 2

    def test_filter_by_status(self, svc: JobRunService) -> None:
        r = _create_run(svc, "pending-run")
        svc.mark_completed(r["id"])
        _create_run(svc, "still-pending")

        result = svc.list_job_runs(status=["pending"])
        assert all(i["status"] == "pending" for i in result["items"])

    def test_filter_by_job_type(self, svc: JobRunService) -> None:
        _create_run(svc, "backup-job", "backup")
        _create_run(svc, "compare-job", "compare_devices")

        result = svc.list_job_runs(job_type=["backup"])
        assert all(i["job_type"] == "backup" for i in result["items"])


# ===========================================================================
# mark_started / mark_completed / mark_failed / mark_cancelled
# ===========================================================================


@pytest.mark.unit
class TestStatusTransitions:
    def test_mark_started(self, svc: JobRunService) -> None:
        run = _create_run(svc)
        result = svc.mark_started(run["id"], "celery-task-abc")
        assert result is not None
        assert result["status"] == "running"
        assert result["celery_task_id"] == "celery-task-abc"
        assert result["started_at"] is not None

    def test_mark_completed(self, svc: JobRunService) -> None:
        run = _create_run(svc)
        svc.mark_started(run["id"], "task-1")
        result = svc.mark_completed(run["id"], result={"devices_backed_up": 3})
        assert result is not None
        assert result["status"] == "completed"
        assert result["result"] == {"devices_backed_up": 3}
        assert result["completed_at"] is not None

    def test_mark_failed(self, svc: JobRunService) -> None:
        run = _create_run(svc)
        result = svc.mark_failed(run["id"], "Connection timed out")
        assert result is not None
        assert result["status"] == "failed"
        assert result["error_message"] == "Connection timed out"

    def test_mark_cancelled(self, svc: JobRunService) -> None:
        run = _create_run(svc)
        result = svc.mark_cancelled(run["id"])
        assert result is not None
        assert result["status"] == "cancelled"

    def test_mark_started_nonexistent_returns_none(self, svc: JobRunService) -> None:
        assert svc.mark_started(9999, "task-x") is None

    def test_completed_has_duration(self, svc: JobRunService) -> None:
        run = _create_run(svc)
        svc.mark_started(run["id"], "task-1")
        result = svc.mark_completed(run["id"])
        assert result is not None
        assert result.get("duration_seconds") is not None


# ===========================================================================
# Queue stats
# ===========================================================================


@pytest.mark.unit
class TestQueueStats:
    def test_initial_stats_are_zero(self, svc: JobRunService) -> None:
        stats = svc.get_queue_stats()
        assert stats["running"] == 0
        assert stats["pending"] == 0

    def test_pending_counted(self, svc: JobRunService) -> None:
        _create_run(svc)
        _create_run(svc)
        stats = svc.get_queue_stats()
        assert stats["pending"] == 2
        assert stats["running"] == 0

    def test_running_counted_after_start(self, svc: JobRunService) -> None:
        run = _create_run(svc)
        svc.mark_started(run["id"], "task-1")
        stats = svc.get_queue_stats()
        assert stats["running"] == 1
        assert stats["pending"] == 0

    def test_completed_not_in_stats(self, svc: JobRunService) -> None:
        run = _create_run(svc)
        svc.mark_completed(run["id"])
        stats = svc.get_queue_stats()
        assert stats["pending"] == 0
        assert stats["running"] == 0


# ===========================================================================
# Cleanup operations
# ===========================================================================


@pytest.mark.unit
class TestCleanup:
    def test_delete_job_run(self, svc: JobRunService) -> None:
        run = _create_run(svc)
        assert svc.delete_job_run(run["id"]) is True
        assert svc.get_job_run(run["id"]) is None

    def test_delete_nonexistent(self, svc: JobRunService) -> None:
        assert svc.delete_job_run(9999) is False

    def test_clear_all_runs(self, svc: JobRunService) -> None:
        _create_run(svc)
        _create_run(svc)
        count = svc.clear_all_runs()
        assert count == 2
        result = svc.list_job_runs()
        assert result["total"] == 0

    def test_clear_filtered_by_status(self, svc: JobRunService) -> None:
        r1 = _create_run(svc, "failed-run")
        r2 = _create_run(svc, "pending-run")
        svc.mark_failed(r1["id"], "error")

        deleted = svc.clear_filtered_runs(status=["failed"])
        assert deleted == 1
        assert svc.get_job_run(r1["id"]) is None
        assert svc.get_job_run(r2["id"]) is not None

    def test_get_distinct_templates(self, svc: JobRunService, run_repo: FakeJobRunRepository) -> None:
        run_repo.create(job_name="a", job_type="backup", job_template_id=1)
        run_repo.create(job_name="b", job_type="backup", job_template_id=1)
        run_repo.create(job_name="c", job_type="compare_devices", job_template_id=2)

        result = svc.get_distinct_templates()
        ids = [t["id"] for t in result]
        assert 1 in ids
        assert 2 in ids
        assert len(result) == 2


# ===========================================================================
# get_dashboard_stats (repository-backed aggregates)
# ===========================================================================


@pytest.mark.unit
class TestGetDashboardStats:
    def test_aggregates_job_counts_and_backup_payloads(
        self,
        svc: JobRunService,
        run_repo: FakeJobRunRepository,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setattr(
            run_repo,
            "aggregate_status_counts",
            lambda: {
                "total": 12,
                "completed": 7,
                "failed": 2,
                "running": 1,
            },
        )
        monkeypatch.setattr(
            run_repo,
            "recent_backup_results",
            lambda days=30: [
                json.dumps({"devices_backed_up": 10, "devices_failed": 2}),
                '{"devices_backed_up": 3, "devices_failed": 1}',
            ],
        )

        out = svc.get_dashboard_stats()

        assert out["job_runs"] == {
            "total": 12,
            "completed": 7,
            "failed": 2,
            "running": 1,
        }
        assert out["backup_devices"] == {
            "total_devices": 16,
            "successful_devices": 13,
            "failed_devices": 3,
        }

    def test_null_sums_treated_as_zero(
        self,
        svc: JobRunService,
        run_repo: FakeJobRunRepository,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setattr(
            run_repo,
            "aggregate_status_counts",
            lambda: {"total": 0, "completed": 0, "failed": 0, "running": 0},
        )
        monkeypatch.setattr(run_repo, "recent_backup_results", lambda days=30: [])

        out = svc.get_dashboard_stats()

        assert out["job_runs"]["total"] == 0
        assert out["job_runs"]["completed"] == 0
        assert out["backup_devices"]["total_devices"] == 0

    def test_skips_invalid_json_and_none_results(
        self,
        svc: JobRunService,
        run_repo: FakeJobRunRepository,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setattr(
            run_repo,
            "aggregate_status_counts",
            lambda: {"total": 1, "completed": 1, "failed": 0, "running": 0},
        )
        monkeypatch.setattr(
            run_repo,
            "recent_backup_results",
            lambda days=30: [
                None,
                "not-json",
                json.dumps({"devices_backed_up": 4, "devices_failed": 0}),
            ],
        )

        out = svc.get_dashboard_stats()

        assert out["backup_devices"]["successful_devices"] == 4
        assert out["backup_devices"]["failed_devices"] == 0

    def test_accepts_dict_backup_payload(
        self,
        svc: JobRunService,
        run_repo: FakeJobRunRepository,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setattr(
            run_repo,
            "aggregate_status_counts",
            lambda: {"total": 1, "completed": 1, "failed": 0, "running": 0},
        )
        monkeypatch.setattr(
            run_repo,
            "recent_backup_results",
            lambda days=30: [{"devices_backed_up": 2, "devices_failed": 1}],
        )

        out = svc.get_dashboard_stats()

        assert out["backup_devices"]["successful_devices"] == 2
        assert out["backup_devices"]["failed_devices"] == 1
