"""Unit tests for tasks/execution/compare_executor.py."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tasks.execution.compare_executor import execute_compare_devices

_PATCH_CONFIG = "service_factory.build_checkmk_config_service"
_PATCH_NB2CMK = "service_factory.build_nb2cmk_service"
_PATCH_DB = "service_factory.build_nb2cmk_db_service"


def _comparison(
    result: str = "diff",
    hostname: str = "router1",
    filename: str = "rule.yaml",
) -> SimpleNamespace:
    return SimpleNamespace(
        result=result,
        diff="- hostname: old\n+ hostname: new",
        normalized_config={
            "internal": {
                "hostname": hostname,
                "matched_rule": {"filename": filename, "is_default": False},
            }
        },
        checkmk_config={"host_name": hostname},
        ignored_attributes=["site"],
    )


def _call(target_devices=None):
    task_ctx = MagicMock()
    task_ctx.request.id = "celery-task-99"
    return execute_compare_devices(
        schedule_id=1,
        credential_id=None,
        job_parameters=None,
        target_devices=target_devices,
        task_context=task_ctx,
    )


@pytest.mark.unit
def test_execute_compare_devices_no_devices_to_compare() -> None:
    mock_nb2cmk = MagicMock()
    mock_nb2cmk.get_devices_for_sync = AsyncMock(
        return_value=SimpleNamespace(devices=[])
    )

    with patch(_PATCH_CONFIG, return_value=MagicMock()):
        with patch(_PATCH_NB2CMK, return_value=mock_nb2cmk):
            with patch(_PATCH_DB, return_value=MagicMock()):
                result = _call(target_devices=None)

    assert result["success"] is True
    assert result["total"] == 0


@pytest.mark.unit
def test_execute_compare_devices_compares_and_stores_results() -> None:
    task_ctx = MagicMock()
    task_ctx.request.id = "task-abc"
    mock_config = MagicMock()
    mock_nb2cmk = MagicMock()
    mock_nb2cmk.compare_device_config = AsyncMock(return_value=_comparison())
    mock_nb2cmk.filter_diff_by_ignored_attributes.return_value = "filtered diff"
    mock_db = MagicMock()

    with patch(_PATCH_CONFIG, return_value=mock_config):
        with patch(_PATCH_NB2CMK, return_value=mock_nb2cmk):
            with patch(_PATCH_DB, return_value=mock_db):
                result = execute_compare_devices(
                    schedule_id=1,
                    credential_id=None,
                    job_parameters=None,
                    target_devices=["dev-1"],
                    task_context=task_ctx,
                )

    assert result["success"] is True
    assert result["completed"] == 1
    assert result["differences_found"] == 1
    assert result["job_id"] == "scheduled_compare_task-abc"
    mock_db.create_job.assert_called_once()
    mock_db.add_device_result.assert_called_once()
    mock_config.reload_config.assert_called_once()


@pytest.mark.unit
def test_execute_compare_devices_handles_per_device_error() -> None:
    task_ctx = MagicMock()
    task_ctx.request.id = "task-err"
    mock_nb2cmk = MagicMock()
    mock_nb2cmk.compare_device_config = AsyncMock(
        side_effect=RuntimeError("compare failed")
    )

    with patch(_PATCH_CONFIG, return_value=MagicMock()):
        with patch(_PATCH_NB2CMK, return_value=mock_nb2cmk):
            with patch(_PATCH_DB, return_value=MagicMock()):
                result = execute_compare_devices(
                    schedule_id=None,
                    credential_id=None,
                    job_parameters=None,
                    target_devices=["dev-1"],
                    task_context=task_ctx,
                )

    assert result["success"] is True
    assert result["failed"] == 1
    assert result["results"][0]["checkmk_status"] == "error"


@pytest.mark.unit
def test_execute_compare_devices_equal_result_not_counted_as_diff() -> None:
    task_ctx = MagicMock()
    task_ctx.request.id = "task-eq"
    mock_nb2cmk = MagicMock()
    mock_nb2cmk.compare_device_config = AsyncMock(
        return_value=_comparison(result="equal")
    )
    mock_nb2cmk.filter_diff_by_ignored_attributes.return_value = ""

    with patch(_PATCH_CONFIG, return_value=MagicMock()):
        with patch(_PATCH_NB2CMK, return_value=mock_nb2cmk):
            with patch(_PATCH_DB, return_value=MagicMock()):
                result = execute_compare_devices(
                    schedule_id=None,
                    credential_id=None,
                    job_parameters=None,
                    target_devices=["dev-1"],
                    task_context=task_ctx,
                )

    assert result["differences_found"] == 0


@pytest.mark.unit
def test_execute_compare_devices_top_level_failure() -> None:
    with patch(_PATCH_CONFIG, side_effect=RuntimeError("config reload failed")):
        result = _call(target_devices=["dev-1"])

    assert result["success"] is False
    assert "config reload failed" in result["error"]
