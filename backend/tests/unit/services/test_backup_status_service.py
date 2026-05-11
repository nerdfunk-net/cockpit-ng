"""Unit tests for BackupStatusService.

The service uses two external dependencies that are patched:
  - ``job_run_repository`` module-level singleton — provides backup run data
  - ``redis.Redis.from_url`` — used for cache read/write

All tests run offline — no database or Redis required.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List
from unittest.mock import MagicMock, patch

import pytest

from services.jobs.backup_status_service import BackupStatusService

_REPO_PATH = "services.jobs.backup_status_service.job_run_repository"
_REDIS_PATH = "services.jobs.backup_status_service.redis.Redis.from_url"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_run(
    backed_up: List[Dict[str, Any]],
    failed: List[Dict[str, Any]],
    completed_at: datetime | None = None,
) -> Dict[str, Any]:
    """Build a fake job_run dict that backup_status_service understands."""
    if completed_at is None:
        completed_at = datetime.now(timezone.utc)
    return {
        "job_type": "backup",
        "status": "completed",
        "completed_at": completed_at,
        "result": json.dumps(
            {"backed_up_devices": backed_up, "failed_devices": failed}
        ),
    }


def _no_cache(mock_redis: MagicMock) -> None:
    """Configure Redis mock so cache reads return nothing (cache miss)."""
    redis_instance = MagicMock()
    redis_instance.get.return_value = None
    mock_redis.return_value = redis_instance


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def svc() -> BackupStatusService:
    return BackupStatusService()


# ===========================================================================
# _build_response — tested via get_backup_status(force_refresh=True)
# ===========================================================================


@pytest.mark.unit
class TestBuildResponse:
    @patch(_REDIS_PATH)
    @patch(_REPO_PATH)
    def test_empty_runs_returns_empty_response(
        self, mock_repo: MagicMock, mock_redis: MagicMock, svc: BackupStatusService
    ) -> None:
        mock_repo.get_all_by_type_and_statuses.return_value = []
        _no_cache(mock_redis)

        response = svc.get_backup_status(force_refresh=True)

        assert response.total_devices == 0
        assert response.devices_with_successful_backup == 0
        assert response.devices_with_failed_backup == 0
        assert response.devices == []

    @patch(_REDIS_PATH)
    @patch(_REPO_PATH)
    def test_successful_device_tracked(
        self, mock_repo: MagicMock, mock_redis: MagicMock, svc: BackupStatusService
    ) -> None:
        run = _make_run(
            backed_up=[{"device_id": "dev-1", "device_name": "Router 1"}],
            failed=[],
        )
        mock_repo.get_all_by_type_and_statuses.return_value = [run]
        _no_cache(mock_redis)

        response = svc.get_backup_status(force_refresh=True)

        assert response.total_devices == 1
        assert response.devices_with_successful_backup == 1
        assert response.devices_with_failed_backup == 0
        assert response.devices[0].device_id == "dev-1"
        assert response.devices[0].last_backup_success is True

    @patch(_REDIS_PATH)
    @patch(_REPO_PATH)
    def test_failed_device_tracked(
        self, mock_repo: MagicMock, mock_redis: MagicMock, svc: BackupStatusService
    ) -> None:
        run = _make_run(
            backed_up=[],
            failed=[
                {"device_id": "dev-2", "device_name": "Switch 2", "error": "Timeout"}
            ],
        )
        mock_repo.get_all_by_type_and_statuses.return_value = [run]
        _no_cache(mock_redis)

        response = svc.get_backup_status(force_refresh=True)

        assert response.total_devices == 1
        assert response.devices_with_failed_backup == 1
        assert response.devices[0].device_id == "dev-2"
        assert response.devices[0].last_backup_success is False
        assert response.devices[0].last_error == "Timeout"

    @patch(_REDIS_PATH)
    @patch(_REPO_PATH)
    def test_multiple_devices_counted_correctly(
        self, mock_repo: MagicMock, mock_redis: MagicMock, svc: BackupStatusService
    ) -> None:
        run = _make_run(
            backed_up=[
                {"device_id": "d1", "device_name": "D1"},
                {"device_id": "d2", "device_name": "D2"},
            ],
            failed=[{"device_id": "d3", "device_name": "D3", "error": "Refused"}],
        )
        mock_repo.get_all_by_type_and_statuses.return_value = [run]
        _no_cache(mock_redis)

        response = svc.get_backup_status(force_refresh=True)

        assert response.total_devices == 3
        assert response.devices_with_successful_backup == 2
        assert response.devices_with_failed_backup == 1

    @patch(_REDIS_PATH)
    @patch(_REPO_PATH)
    def test_latest_run_determines_device_status(
        self, mock_repo: MagicMock, mock_redis: MagicMock, svc: BackupStatusService
    ) -> None:
        """If a device succeeded in a newer run after failing in an older one,
        its last_backup_success should be True."""
        older = datetime(2025, 1, 1, 10, 0, 0, tzinfo=timezone.utc)
        newer = datetime(2025, 1, 2, 10, 0, 0, tzinfo=timezone.utc)

        old_run = _make_run(
            backed_up=[],
            failed=[{"device_id": "dev-x", "device_name": "X", "error": "Timeout"}],
            completed_at=older,
        )
        new_run = _make_run(
            backed_up=[{"device_id": "dev-x", "device_name": "X"}],
            failed=[],
            completed_at=newer,
        )
        mock_repo.get_all_by_type_and_statuses.return_value = [old_run, new_run]
        _no_cache(mock_redis)

        response = svc.get_backup_status(force_refresh=True)

        device = next(d for d in response.devices if d.device_id == "dev-x")
        assert device.last_backup_success is True
        assert device.total_successful_backups == 1
        assert device.total_failed_backups == 1

    @patch(_REDIS_PATH)
    @patch(_REPO_PATH)
    def test_run_with_missing_result_is_skipped(
        self, mock_repo: MagicMock, mock_redis: MagicMock, svc: BackupStatusService
    ) -> None:
        run = {
            "job_type": "backup",
            "status": "completed",
            "completed_at": datetime.now(timezone.utc),
            "result": None,
        }
        mock_repo.get_all_by_type_and_statuses.return_value = [run]
        _no_cache(mock_redis)

        response = svc.get_backup_status(force_refresh=True)
        assert response.total_devices == 0

    @patch(_REDIS_PATH)
    @patch(_REPO_PATH)
    def test_run_with_invalid_json_result_is_skipped(
        self, mock_repo: MagicMock, mock_redis: MagicMock, svc: BackupStatusService
    ) -> None:
        run = {
            "job_type": "backup",
            "status": "completed",
            "completed_at": datetime.now(timezone.utc),
            "result": "not-json",
        }
        mock_repo.get_all_by_type_and_statuses.return_value = [run]
        _no_cache(mock_redis)

        response = svc.get_backup_status(force_refresh=True)
        assert response.total_devices == 0


# ===========================================================================
# Caching behaviour
# ===========================================================================


@pytest.mark.unit
class TestCaching:
    @patch(_REDIS_PATH)
    @patch(_REPO_PATH)
    def test_cache_hit_skips_repo(
        self, mock_repo: MagicMock, mock_redis: MagicMock, svc: BackupStatusService
    ) -> None:
        cached_data = {
            "total_devices": 3,
            "devices_with_successful_backup": 2,
            "devices_with_failed_backup": 1,
            "devices_never_backed_up": 0,
            "devices": [],
        }
        redis_instance = MagicMock()
        redis_instance.get.return_value = json.dumps(cached_data)
        mock_redis.return_value = redis_instance

        response = svc.get_backup_status(force_refresh=False)

        assert response.total_devices == 3
        mock_repo.get_all_by_type_and_statuses.assert_not_called()

    @patch(_REDIS_PATH)
    @patch(_REPO_PATH)
    def test_force_refresh_bypasses_cache(
        self, mock_repo: MagicMock, mock_redis: MagicMock, svc: BackupStatusService
    ) -> None:
        redis_instance = MagicMock()
        mock_redis.return_value = redis_instance
        mock_repo.get_all_by_type_and_statuses.return_value = []

        svc.get_backup_status(force_refresh=True)

        mock_repo.get_all_by_type_and_statuses.assert_called_once()

    @patch(_REDIS_PATH)
    @patch(_REPO_PATH)
    def test_cache_miss_calls_repo(
        self, mock_repo: MagicMock, mock_redis: MagicMock, svc: BackupStatusService
    ) -> None:
        _no_cache(mock_redis)
        mock_repo.get_all_by_type_and_statuses.return_value = []

        svc.get_backup_status(force_refresh=False)

        mock_repo.get_all_by_type_and_statuses.assert_called_once()

    @patch(_REDIS_PATH)
    @patch(_REPO_PATH)
    def test_result_is_written_to_cache_after_build(
        self, mock_repo: MagicMock, mock_redis: MagicMock, svc: BackupStatusService
    ) -> None:
        redis_instance = MagicMock()
        redis_instance.get.return_value = None
        mock_redis.return_value = redis_instance
        mock_repo.get_all_by_type_and_statuses.return_value = []

        svc.get_backup_status(force_refresh=False)

        redis_instance.setex.assert_called_once()

    @patch(_REDIS_PATH)
    @patch(_REPO_PATH)
    def test_redis_read_failure_falls_through(
        self, mock_repo: MagicMock, mock_redis: MagicMock, svc: BackupStatusService
    ) -> None:
        redis_instance = MagicMock()
        redis_instance.get.side_effect = Exception("Redis unavailable")
        mock_redis.return_value = redis_instance
        mock_repo.get_all_by_type_and_statuses.return_value = []

        response = svc.get_backup_status(force_refresh=False)

        assert response is not None
        mock_repo.get_all_by_type_and_statuses.assert_called_once()
