"""Unit tests for tasks/scheduling/schedule_checker.py."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest

from tasks.scheduling.schedule_checker import check_job_schedules_task

_PATCH_SCHEDULE = "service_factory.build_job_schedule_service"
_PATCH_TEMPLATE = "service_factory.build_job_template_service"
_PATCH_DISPATCH = "tasks.scheduling.job_dispatcher.dispatch_job"


@pytest.mark.unit
def test_check_job_schedules_dispatches_due_schedule() -> None:
    now = datetime.now(timezone.utc)
    due = (now - timedelta(seconds=60)).isoformat()

    schedule_svc = MagicMock()
    schedule_svc.list_job_schedules.return_value = [
        {
            "id": 1,
            "job_template_id": 10,
            "job_identifier": "nightly-sync",
            "credential_id": 5,
            "job_parameters": {"k": "v"},
            "next_run": due,
        }
    ]
    template_svc = MagicMock()
    template_svc.get_job_template.return_value = {"job_type": "sync"}

    with patch(_PATCH_SCHEDULE, return_value=schedule_svc):
        with patch(_PATCH_TEMPLATE, return_value=template_svc):
            with patch(_PATCH_DISPATCH) as dispatch:
                result = check_job_schedules_task.run()

    assert result["success"] is True
    assert result["dispatched_count"] == 1
    dispatch.delay.assert_called_once()
    schedule_svc.calculate_and_update_next_run.assert_called_once_with(1)


@pytest.mark.unit
def test_check_job_schedules_skips_future_schedules() -> None:
    future = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    schedule_svc = MagicMock()
    schedule_svc.list_job_schedules.return_value = [
        {"id": 2, "job_template_id": 10, "next_run": future}
    ]

    with patch(_PATCH_SCHEDULE, return_value=schedule_svc):
        with patch(_PATCH_TEMPLATE, return_value=MagicMock()):
            with patch(_PATCH_DISPATCH) as dispatch:
                result = check_job_schedules_task.run()

    assert result["dispatched_count"] == 0
    dispatch.delay.assert_not_called()


@pytest.mark.unit
def test_check_job_schedules_skips_missing_template() -> None:
    due = datetime.now(timezone.utc).isoformat()
    schedule_svc = MagicMock()
    schedule_svc.list_job_schedules.return_value = [
        {"id": 3, "job_template_id": 99, "next_run": due}
    ]
    template_svc = MagicMock()
    template_svc.get_job_template.return_value = None

    with patch(_PATCH_SCHEDULE, return_value=schedule_svc):
        with patch(_PATCH_TEMPLATE, return_value=template_svc):
            with patch(_PATCH_DISPATCH) as dispatch:
                result = check_job_schedules_task.run()

    assert result["dispatched_count"] == 0
    dispatch.delay.assert_not_called()


@pytest.mark.unit
def test_check_job_schedules_records_per_schedule_errors() -> None:
    due = datetime.now(timezone.utc).isoformat()
    schedule_svc = MagicMock()
    schedule_svc.list_job_schedules.return_value = [
        {"id": 4, "job_template_id": 10, "next_run": due}
    ]
    template_svc = MagicMock()
    template_svc.get_job_template.return_value = {"job_type": "sync"}

    with patch(_PATCH_SCHEDULE, return_value=schedule_svc):
        with patch(_PATCH_TEMPLATE, return_value=template_svc):
            with patch(_PATCH_DISPATCH) as dispatch:
                dispatch.delay.side_effect = RuntimeError("broker down")
                result = check_job_schedules_task.run()

    assert result["success"] is True
    assert len(result["errors"]) == 1
    assert "broker down" in result["errors"][0]


@pytest.mark.unit
def test_check_job_schedules_top_level_failure() -> None:
    with patch(_PATCH_SCHEDULE, side_effect=RuntimeError("db unavailable")):
        result = check_job_schedules_task.run()

    assert result["success"] is False
    assert "db unavailable" in result["error"]
