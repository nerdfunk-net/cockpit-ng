"""Unit tests for services/background_jobs/checkmk_device_jobs.py."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.helpers.asyncio_run import (
    mock_asyncio_run_raising,
    mock_asyncio_run_returning,
    mock_asyncio_run_sequence,
)
from services.background_jobs.checkmk_device_jobs import (
    _activate_checkmk_changes,
    _update_or_add_in_checkmk,
    add_device_to_checkmk_task,
    sync_devices_to_checkmk_task,
    update_device_in_checkmk_task,
)
from services.checkmk.exceptions import CheckMKAPIError


def _operation_result(**kwargs: object) -> MagicMock:
    defaults = {
        "success": True,
        "message": "ok",
        "device_id": "dev-1",
        "hostname": "router-01",
        "site": "site1",
        "folder": "/",
        "folder_changed": False,
        "checkmk_response": {},
    }
    defaults.update(kwargs)
    return MagicMock(**defaults)


@pytest.mark.asyncio
@pytest.mark.unit
async def test_update_or_add_returns_update_when_success() -> None:
    nb2cmk = MagicMock()
    expected = _operation_result()
    nb2cmk.update_device_in_checkmk = AsyncMock(return_value=expected)

    op, result = await _update_or_add_in_checkmk(nb2cmk, "dev-1")

    assert op == "update"
    assert result is expected
    nb2cmk.add_device_to_checkmk.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_update_or_add_falls_back_to_add_on_404() -> None:
    nb2cmk = MagicMock()
    nb2cmk.update_device_in_checkmk = AsyncMock(side_effect=Exception("404 not found"))
    added = _operation_result(message="added")
    nb2cmk.add_device_to_checkmk = AsyncMock(return_value=added)

    op, result = await _update_or_add_in_checkmk(nb2cmk, "dev-1")

    assert op == "add"
    assert result is added


@pytest.mark.asyncio
@pytest.mark.unit
async def test_update_or_add_reraises_non_404_errors() -> None:
    nb2cmk = MagicMock()
    nb2cmk.update_device_in_checkmk = AsyncMock(side_effect=RuntimeError("boom"))

    with pytest.raises(RuntimeError, match="boom"):
        await _update_or_add_in_checkmk(nb2cmk, "dev-1")


@pytest.mark.unit
def test_add_device_to_checkmk_task_success() -> None:
    result = _operation_result()
    config_svc = MagicMock()
    with (
        patch(
            "service_factory.build_checkmk_config_service",
            return_value=config_svc,
        ),
        patch("service_factory.build_nb2cmk_service"),
        patch(
            "services.background_jobs.checkmk_device_jobs.asyncio.run",
            side_effect=mock_asyncio_run_returning(result),
        ),
        patch.object(add_device_to_checkmk_task, "update_state"),
    ):
        out = add_device_to_checkmk_task.run("dev-1")

    assert out["status"] == "completed"
    assert out["success"] is True
    assert out["hostname"] == "router-01"
    config_svc.reload_config.assert_called_once()


@pytest.mark.unit
def test_add_device_to_checkmk_task_not_found_message() -> None:
    with (
        patch("service_factory.build_checkmk_config_service"),
        patch("service_factory.build_nb2cmk_service"),
        patch(
            "services.background_jobs.checkmk_device_jobs.asyncio.run",
            side_effect=mock_asyncio_run_raising(Exception("404 Device not found")),
        ),
        patch.object(add_device_to_checkmk_task, "update_state"),
    ):
        out = add_device_to_checkmk_task.run("dev-missing")

    assert out["status"] == "failed"
    assert "Nautobot" in out["message"]


@pytest.mark.unit
def test_update_device_to_checkmk_task_success() -> None:
    result = _operation_result(folder_changed=True)
    with (
        patch("service_factory.build_checkmk_config_service"),
        patch("service_factory.build_nb2cmk_service"),
        patch(
            "services.background_jobs.checkmk_device_jobs.asyncio.run",
            side_effect=mock_asyncio_run_returning(result),
        ),
        patch.object(update_device_in_checkmk_task, "update_state"),
    ):
        out = update_device_in_checkmk_task.run("dev-1")

    assert out["status"] == "completed"
    assert out["folder_changed"] is True


@pytest.mark.unit
def test_sync_devices_to_checkmk_task_success_with_activation() -> None:
    op_result = _operation_result()
    nb2cmk_db = MagicMock()
    job_runs = MagicMock()
    job_runs.create_job_run.return_value = {"id": 99}

    with (
        patch("service_factory.build_checkmk_config_service"),
        patch("service_factory.build_nb2cmk_service"),
        patch("service_factory.build_nb2cmk_db_service", return_value=nb2cmk_db),
        patch("service_factory.build_job_run_service", return_value=job_runs),
        patch(
            "services.background_jobs.checkmk_device_jobs.asyncio.run",
            side_effect=mock_asyncio_run_sequence(
                [("update", op_result), ("add", op_result)]
            ),
        ),
        patch(
            "services.background_jobs.checkmk_device_jobs._activate_checkmk_changes",
            return_value={"success": True, "message": "activated"},
        ),
        patch.object(sync_devices_to_checkmk_task, "update_state"),
    ):
        out = sync_devices_to_checkmk_task.run(["dev-1", "dev-2"])

    assert out["status"] == "completed"
    assert out["success_count"] == 2
    assert out["failed_count"] == 0
    assert out["activation"]["success"] is True
    job_runs.mark_completed.assert_called_once()


@pytest.mark.unit
def test_sync_devices_device_failure_records_checkmk_api_error() -> None:
    api_error = CheckMKAPIError(
        "validation failed",
        status_code=400,
        response_data={
            "title": "Bad request",
            "validation_summary": ["invalid attribute"],
        },
    )
    nb2cmk_db = MagicMock()
    job_runs = MagicMock()
    job_runs.create_job_run.return_value = {"id": 1}

    with (
        patch("service_factory.build_checkmk_config_service"),
        patch("service_factory.build_nb2cmk_service"),
        patch("service_factory.build_nb2cmk_db_service", return_value=nb2cmk_db),
        patch("service_factory.build_job_run_service", return_value=job_runs),
        patch(
            "services.background_jobs.checkmk_device_jobs.asyncio.run",
            side_effect=mock_asyncio_run_raising(api_error),
        ),
        patch.object(sync_devices_to_checkmk_task, "update_state"),
    ):
        out = sync_devices_to_checkmk_task.run(["dev-bad"], activate_changes_after_sync=False)

    assert out["failed_count"] == 1
    assert out["success_count"] == 0
    nb2cmk_db.add_device_result.assert_called_once()


@pytest.mark.unit
def test_activate_checkmk_changes_missing_settings() -> None:
    with patch(
        "services.settings.manager.SettingsManager.get_checkmk_settings",
        return_value=None,
    ):
        result = _activate_checkmk_changes()

    assert result["success"] is False
    assert "not configured" in result["message"].lower()


@pytest.mark.unit
def test_add_device_already_exists_message() -> None:
    with (
        patch("service_factory.build_checkmk_config_service"),
        patch("service_factory.build_nb2cmk_service"),
        patch(
            "services.background_jobs.checkmk_device_jobs.asyncio.run",
            side_effect=mock_asyncio_run_raising(Exception("Host already exists in CheckMK")),
        ),
        patch.object(add_device_to_checkmk_task, "update_state"),
    ):
        out = add_device_to_checkmk_task.run("dev-1")

    assert out["status"] == "failed"
    assert "already exists" in out["message"].lower()
