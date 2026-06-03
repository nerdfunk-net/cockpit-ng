"""Unit tests for services/checkmk/sync/background.py."""

from __future__ import annotations

from collections.abc import Coroutine
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from services.checkmk.sync.background import NB2CMKBackgroundService
from services.checkmk.sync.database import JobStatus

_PATCH_DB = "service_factory.build_nb2cmk_db_service"
_PATCH_SYNC = "service_factory.build_nb2cmk_service"


def _job(**kwargs: object) -> SimpleNamespace:
    defaults: dict = {
        "job_id": "job-1",
        "status": JobStatus.PENDING,
        "processed_devices": 0,
        "total_devices": 0,
        "progress_message": "",
        "created_at": datetime.now(timezone.utc),
        "started_at": None,
        "completed_at": None,
        "error_message": None,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def _mock_create_task(coro: Coroutine[Any, Any, Any]) -> MagicMock:
    """Mock asyncio.create_task without leaving the coroutine unawaited."""
    coro.close()
    return MagicMock()


def _service(
    mock_db: MagicMock, mock_sync: MagicMock | None = None
) -> NB2CMKBackgroundService:
    with patch(_PATCH_DB, return_value=mock_db):
        with patch(_PATCH_SYNC, return_value=mock_sync or MagicMock()):
            return NB2CMKBackgroundService()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_start_devices_diff_job_returns_existing_active_job() -> None:
    mock_db = MagicMock()
    mock_db.get_active_job.return_value = _job(status=JobStatus.RUNNING)
    svc = _service(mock_db)

    result = await svc.start_devices_diff_job(username="alice")

    assert result.job_id == "job-1"
    assert "already" in result.message
    mock_db.create_job.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_start_devices_diff_job_creates_new_job() -> None:
    mock_db = MagicMock()
    mock_db.get_active_job.return_value = None
    mock_db.create_job.return_value = "new-job-id"
    svc = _service(mock_db)

    with patch("asyncio.create_task", side_effect=_mock_create_task):
        result = await svc.start_devices_diff_job()

    assert result.job_id == "new-job-id"
    assert result.status == JobStatus.PENDING
    mock_db.create_job.assert_called_once()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_get_job_progress_raises_404_when_missing() -> None:
    mock_db = MagicMock()
    mock_db.get_job.return_value = None
    svc = _service(mock_db)

    with pytest.raises(HTTPException) as exc:
        await svc.get_job_progress("missing")

    assert exc.value.status_code == 404


@pytest.mark.asyncio
@pytest.mark.unit
async def test_get_job_progress_returns_response() -> None:
    mock_db = MagicMock()
    mock_db.get_job.return_value = _job(
        processed_devices=2,
        total_devices=10,
        progress_message="working",
    )
    svc = _service(mock_db)

    result = await svc.get_job_progress("job-1")

    assert result.total_devices == 10
    assert result.progress_message == "working"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_get_job_results_raises_when_not_finished() -> None:
    mock_db = MagicMock()
    mock_db.get_job.return_value = _job(status=JobStatus.RUNNING)
    svc = _service(mock_db)

    with pytest.raises(HTTPException) as exc:
        await svc.get_job_results("job-1")

    assert exc.value.status_code == 400


@pytest.mark.asyncio
@pytest.mark.unit
async def test_get_job_results_returns_devices() -> None:
    mock_db = MagicMock()
    mock_db.get_job.return_value = _job(status=JobStatus.COMPLETED)
    mock_db.get_job_results.return_value = [
        SimpleNamespace(
            device_id="uuid-1",
            device_name="router1",
            checkmk_status="ok",
            diff={},
            normalized_config={},
            checkmk_config={},
        )
    ]
    svc = _service(mock_db)

    result = await svc.get_job_results("job-1")

    assert result.total == 1
    assert result.devices[0]["name"] == "router1"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_get_job_results_includes_failure_message() -> None:
    mock_db = MagicMock()
    mock_db.get_job.return_value = _job(
        status=JobStatus.FAILED,
        error_message="timeout",
    )
    mock_db.get_job_results.return_value = []
    svc = _service(mock_db)

    result = await svc.get_job_results("job-1")

    assert result.status == JobStatus.FAILED
    assert "failed" in result.message.lower()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_cancel_job_cancels_running_task() -> None:
    mock_db = MagicMock()
    mock_db.update_job_status.return_value = True
    mock_task = MagicMock()
    svc = _service(mock_db)
    svc._running_jobs["job-1"] = mock_task

    result = await svc.cancel_job("job-1")

    assert result is True
    mock_task.cancel.assert_called_once()
    assert "job-1" not in svc._running_jobs
