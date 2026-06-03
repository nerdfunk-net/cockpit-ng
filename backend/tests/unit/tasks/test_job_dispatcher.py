"""Unit tests for tasks/scheduling/job_dispatcher.py."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from tasks.scheduling.job_dispatcher import dispatch_job

_PATCH_JRS = "service_factory.build_job_run_service"
_PATCH_TEMPLATE = "service_factory.build_job_template_service"
_PATCH_EXECUTE = "tasks.execution.base_executor.execute_job_type"
_PATCH_DEVICES = "tasks.utils.device_helpers.get_target_devices"


@pytest.mark.unit
def test_dispatch_job_marks_completed_on_success() -> None:
    mock_jrs = MagicMock()
    mock_jrs.create_job_run.return_value = {"id": 10}
    mock_template_svc = MagicMock()

    with patch(_PATCH_JRS, return_value=mock_jrs):
        with patch(_PATCH_TEMPLATE, return_value=mock_template_svc):
            with patch(
                _PATCH_EXECUTE,
                return_value={"success": True, "message": "done"},
            ):
                result = dispatch_job.run(
                    schedule_id=5,
                    template_id=None,
                    job_name="nightly",
                    job_type="cache_devices",
                    triggered_by="schedule",
                )

    assert result["success"] is True
    mock_jrs.mark_started.assert_called_once_with(10, None)
    mock_jrs.mark_completed.assert_called_once()


@pytest.mark.unit
def test_dispatch_job_marks_failed_when_executor_returns_error() -> None:
    mock_jrs = MagicMock()
    mock_jrs.create_job_run.return_value = {"id": 11}

    with patch(_PATCH_JRS, return_value=mock_jrs):
        with patch(_PATCH_TEMPLATE, return_value=MagicMock()):
            with patch(
                _PATCH_EXECUTE,
                return_value={"success": False, "error": "boom"},
            ):
                result = dispatch_job.run(
                    job_name="bad",
                    job_type="unknown",
                )

    assert result["success"] is False
    mock_jrs.mark_failed.assert_called_once_with(11, "boom")


@pytest.mark.unit
def test_dispatch_job_leaves_running_jobs_for_async_executors() -> None:
    mock_jrs = MagicMock()
    mock_jrs.create_job_run.return_value = {"id": 12}

    with patch(_PATCH_JRS, return_value=mock_jrs):
        with patch(_PATCH_TEMPLATE, return_value=MagicMock()):
            with patch(
                _PATCH_EXECUTE,
                return_value={"success": True, "status": "running"},
            ):
                dispatch_job.run(
                    job_name="parallel-backup",
                    job_type="backup",
                )

    mock_jrs.mark_completed.assert_not_called()
    mock_jrs.mark_failed.assert_not_called()


@pytest.mark.unit
def test_dispatch_job_loads_template_and_target_devices() -> None:
    mock_jrs = MagicMock()
    mock_jrs.create_job_run.return_value = {"id": 13}
    template_svc = MagicMock()
    template_svc.get_job_template.return_value = {
        "name": "sync",
        "inventory_source": "inventory",
    }

    with patch(_PATCH_JRS, return_value=mock_jrs):
        with patch(_PATCH_TEMPLATE, return_value=template_svc):
            with patch(_PATCH_DEVICES, return_value=["dev-1"]) as get_devices:
                with patch(_PATCH_EXECUTE, return_value={"success": True}) as execute:
                    dispatch_job.run(
                        template_id=7,
                        job_name="sync",
                        job_type="sync",
                        job_parameters={"inventory_id": 3},
                    )

    template_svc.get_job_template.assert_called_once_with(7)
    get_devices.assert_called_once()
    assert execute.call_args.kwargs["target_devices"] == ["dev-1"]


@pytest.mark.unit
def test_dispatch_job_marks_failed_on_exception() -> None:
    mock_jrs = MagicMock()
    mock_jrs.create_job_run.return_value = {"id": 14}

    with patch(_PATCH_JRS, return_value=mock_jrs):
        with patch(_PATCH_TEMPLATE, return_value=MagicMock()):
            with patch(_PATCH_EXECUTE, side_effect=RuntimeError("dispatch broke")):
                result = dispatch_job.run(
                    job_name="crash",
                    job_type="backup",
                )

    assert result["success"] is False
    mock_jrs.mark_failed.assert_called_with(14, "dispatch broke")
