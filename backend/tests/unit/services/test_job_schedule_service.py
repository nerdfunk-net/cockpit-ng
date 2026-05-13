"""Unit tests for JobScheduleService using FakeJobScheduleRepository.

All tests run offline — no database required.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest

from services.jobs.job_schedule_service import JobScheduleService
from tests.mocks.fake_job_repositories import FakeJobScheduleRepository

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def sched_repo() -> FakeJobScheduleRepository:
    return FakeJobScheduleRepository()


@pytest.fixture
def template_service() -> MagicMock:
    mock = MagicMock()
    mock.get_job_template.return_value = {
        "id": 1,
        "name": "nightly-backup",
        "job_type": "backup",
    }
    return mock


@pytest.fixture
def svc(
    sched_repo: FakeJobScheduleRepository, template_service: MagicMock
) -> JobScheduleService:
    service = JobScheduleService.__new__(JobScheduleService)
    service._repo = sched_repo
    service._template_service = template_service
    return service


def _create_daily(
    svc: JobScheduleService,
    job_identifier: str = "daily-backup",
    job_template_id: int = 1,
    start_time: str = "02:00",
) -> dict:
    return svc.create_job_schedule(
        job_identifier=job_identifier,
        job_template_id=job_template_id,
        schedule_type="daily",
        start_time=start_time,
    )


# ===========================================================================
# calculate_next_run — static method, tested in isolation
# ===========================================================================


@pytest.mark.unit
class TestCalculateNextRun:
    def _base(self) -> datetime:
        return datetime(2025, 1, 15, 10, 0, 0, tzinfo=timezone.utc)

    def test_now_returns_none(self) -> None:
        assert JobScheduleService.calculate_next_run({"schedule_type": "now"}) is None

    def test_interval_adds_minutes(self) -> None:
        base = self._base()
        result = JobScheduleService.calculate_next_run(
            {"schedule_type": "interval", "interval_minutes": 30}, base_time=base
        )
        assert result == base + timedelta(minutes=30)

    def test_interval_default_60_minutes(self) -> None:
        base = self._base()
        result = JobScheduleService.calculate_next_run(
            {"schedule_type": "interval"}, base_time=base
        )
        assert result == base + timedelta(hours=1)

    def test_hourly_on_next_hour(self) -> None:
        base = datetime(2025, 1, 15, 10, 35, 0, tzinfo=timezone.utc)
        result = JobScheduleService.calculate_next_run(
            {"schedule_type": "hourly"}, base_time=base
        )
        assert result == datetime(2025, 1, 15, 11, 0, 0, tzinfo=timezone.utc)

    def test_daily_future_time_today(self) -> None:
        base = datetime(2025, 1, 15, 8, 0, 0, tzinfo=timezone.utc)
        result = JobScheduleService.calculate_next_run(
            {"schedule_type": "daily", "start_time": "10:00"}, base_time=base
        )
        assert result == datetime(2025, 1, 15, 10, 0, 0, tzinfo=timezone.utc)

    def test_daily_past_time_rolls_to_tomorrow(self) -> None:
        base = datetime(2025, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
        result = JobScheduleService.calculate_next_run(
            {"schedule_type": "daily", "start_time": "10:00"}, base_time=base
        )
        assert result == datetime(2025, 1, 16, 10, 0, 0, tzinfo=timezone.utc)

    def test_weekly_next_occurrence(self) -> None:
        # Wednesday 2025-01-15
        base = datetime(2025, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
        result = JobScheduleService.calculate_next_run(
            {"schedule_type": "weekly", "start_time": "08:00"}, base_time=base
        )
        assert result is not None
        assert result > base

    def test_monthly_next_occurrence(self) -> None:
        base = datetime(2025, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
        result = JobScheduleService.calculate_next_run(
            {"schedule_type": "monthly", "start_time": "09:00"}, base_time=base
        )
        assert result is not None
        assert result > base

    def test_custom_cron_expression(self) -> None:
        base = datetime(2025, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
        result = JobScheduleService.calculate_next_run(
            {"schedule_type": "custom", "cron_expression": "0 6 * * *"}, base_time=base
        )
        assert result is not None
        assert result > base
        assert result.hour == 6
        assert result.minute == 0

    def test_custom_invalid_cron_returns_none(self) -> None:
        result = JobScheduleService.calculate_next_run(
            {"schedule_type": "custom", "cron_expression": "not-a-cron"}
        )
        assert result is None

    def test_unknown_schedule_type_returns_none(self) -> None:
        result = JobScheduleService.calculate_next_run(
            {"schedule_type": "unknown_type"}
        )
        assert result is None


# ===========================================================================
# create_job_schedule
# ===========================================================================


@pytest.mark.unit
class TestCreateJobSchedule:
    def test_creates_returns_dict(self, svc: JobScheduleService) -> None:
        result = _create_daily(svc)

        assert result["job_identifier"] == "daily-backup"
        assert result["schedule_type"] == "daily"
        assert result["id"] is not None

    def test_next_run_is_calculated_when_active(self, svc: JobScheduleService) -> None:
        result = _create_daily(svc, start_time="23:00")
        assert result["next_run"] is not None

    def test_next_run_is_none_when_inactive(self, svc: JobScheduleService) -> None:
        result = svc.create_job_schedule(
            job_identifier="disabled-job",
            job_template_id=1,
            schedule_type="daily",
            is_active=False,
        )
        assert result["next_run"] is None

    def test_interval_schedule_stored(self, svc: JobScheduleService) -> None:
        result = svc.create_job_schedule(
            job_identifier="every-hour",
            job_template_id=1,
            schedule_type="interval",
            interval_minutes=60,
        )
        assert result["interval_minutes"] == 60
        assert result["next_run"] is not None

    def test_cron_schedule_stored(self, svc: JobScheduleService) -> None:
        result = svc.create_job_schedule(
            job_identifier="cron-job",
            job_template_id=1,
            schedule_type="custom",
            cron_expression="0 3 * * *",
        )
        assert result["cron_expression"] == "0 3 * * *"
        assert result["next_run"] is not None

    def test_job_parameters_serialised(self, svc: JobScheduleService) -> None:
        params = {"site": "EU", "timeout": 120}
        result = svc.create_job_schedule(
            job_identifier="parameterised",
            job_template_id=1,
            schedule_type="daily",
            job_parameters=params,
        )
        assert result["job_parameters"] == params

    def test_enriched_with_template_name(
        self, svc: JobScheduleService, template_service: MagicMock
    ) -> None:
        result = _create_daily(svc)
        assert result.get("template_name") == "nightly-backup"


# ===========================================================================
# get_job_schedule
# ===========================================================================


@pytest.mark.unit
class TestGetJobSchedule:
    def test_found(self, svc: JobScheduleService) -> None:
        created = _create_daily(svc)
        found = svc.get_job_schedule(created["id"])
        assert found is not None
        assert found["id"] == created["id"]

    def test_not_found(self, svc: JobScheduleService) -> None:
        assert svc.get_job_schedule(9999) is None


# ===========================================================================
# list_job_schedules / get_user_job_schedules / get_global_job_schedules
# ===========================================================================


@pytest.mark.unit
class TestListJobSchedules:
    def test_list_all(self, svc: JobScheduleService) -> None:
        _create_daily(svc, "job-1")
        _create_daily(svc, "job-2")
        result = svc.list_job_schedules()
        assert len(result) == 2

    def test_filter_active(self, svc: JobScheduleService) -> None:
        _create_daily(svc, "active-job")
        svc.create_job_schedule("inactive-job", 1, "daily", is_active=False)
        active = svc.list_job_schedules(is_active=True)
        identifiers = [s["job_identifier"] for s in active]
        assert "active-job" in identifiers
        assert "inactive-job" not in identifiers

    def test_get_global_job_schedules(self, svc: JobScheduleService) -> None:
        svc.create_job_schedule("global-job", 1, "daily", is_global=True)
        svc.create_job_schedule("user-job", 1, "daily", is_global=False, user_id=5)
        result = svc.get_global_job_schedules()
        ids = [s["job_identifier"] for s in result]
        assert "global-job" in ids
        assert "user-job" not in ids

    def test_get_user_job_schedules_includes_global(
        self, svc: JobScheduleService
    ) -> None:
        svc.create_job_schedule("global-job", 1, "daily", is_global=True)
        svc.create_job_schedule("my-job", 1, "daily", is_global=False, user_id=7)
        result = svc.get_user_job_schedules(7)
        ids = [s["job_identifier"] for s in result]
        assert "global-job" in ids
        assert "my-job" in ids


# ===========================================================================
# update_job_schedule
# ===========================================================================


@pytest.mark.unit
class TestUpdateJobSchedule:
    def test_update_identifier(self, svc: JobScheduleService) -> None:
        created = _create_daily(svc)
        updated = svc.update_job_schedule(created["id"], job_identifier="renamed")
        assert updated is not None
        assert updated["job_identifier"] == "renamed"

    def test_update_returns_none_for_missing(self, svc: JobScheduleService) -> None:
        result = svc.update_job_schedule(9999, job_identifier="ghost")
        assert result is None

    def test_schedule_change_recalculates_next_run(
        self, svc: JobScheduleService
    ) -> None:
        created = _create_daily(svc, start_time="01:00")
        old_next_run = created["next_run"]

        updated = svc.update_job_schedule(created["id"], start_time="03:00")
        assert updated is not None
        assert updated["next_run"] != old_next_run

    def test_deactivating_clears_next_run(self, svc: JobScheduleService) -> None:
        created = _create_daily(svc)
        updated = svc.update_job_schedule(created["id"], is_active=False)
        assert updated is not None
        assert updated["next_run"] is None

    def test_reactivating_sets_next_run(self, svc: JobScheduleService) -> None:
        inactive = svc.create_job_schedule("disabled", 1, "daily", is_active=False)
        assert inactive["next_run"] is None

        activated = svc.update_job_schedule(inactive["id"], is_active=True)
        assert activated is not None
        assert activated["next_run"] is not None

    def test_no_op_update_returns_current(self, svc: JobScheduleService) -> None:
        created = _create_daily(svc)
        result = svc.update_job_schedule(created["id"])
        assert result is not None
        assert result["id"] == created["id"]


# ===========================================================================
# delete_job_schedule
# ===========================================================================


@pytest.mark.unit
class TestDeleteJobSchedule:
    def test_delete_existing(self, svc: JobScheduleService) -> None:
        created = _create_daily(svc)
        assert svc.delete_job_schedule(created["id"]) is True
        assert svc.get_job_schedule(created["id"]) is None

    def test_delete_nonexistent(self, svc: JobScheduleService) -> None:
        assert svc.delete_job_schedule(9999) is False
