"""Unit tests for tasks/backup_tasks.py.

All tests run offline - no Git repository, Nautobot, Redis, or Celery broker required.
"""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from tasks.backup_tasks import (
    backup_devices_task,
    backup_single_device_task,
    finalize_backup_task,
)


def _backup_result(device_id: str = "dev-1", error: str | None = None) -> MagicMock:
    result = MagicMock()
    result.error = error
    result.to_dict.return_value = (
        {"device_id": device_id, "error": error}
        if error
        else {"device_id": device_id, "hostname": "router-01"}
    )
    return result


@pytest.mark.unit
def test_backup_single_device_task_delegates_to_service() -> None:
    """Single-device task delegates all backup details to DeviceBackupService."""
    backup_service = MagicMock()
    backup_service.backup_single_device.return_value = _backup_result()

    with patch(
        "tasks.backup_tasks.DeviceBackupService", return_value=backup_service
    ):
        result = backup_single_device_task.run(
            device_id="dev-1",
            device_index=1,
            total_devices=2,
            repo_dir="/tmp/repo",
            username="admin",
            password="secret",
            current_date="20260516_120000",
        )

    assert result == {"device_id": "dev-1", "hostname": "router-01"}
    backup_service.backup_single_device.assert_called_once()
    assert backup_service.backup_single_device.call_args.kwargs["repo_dir"] == Path(
        "/tmp/repo"
    )


@pytest.mark.unit
def test_backup_devices_task_validation_failure_returns_error() -> None:
    """Input validation errors are returned instead of opening a Git repo."""
    backup_service = MagicMock()
    backup_service.validate_backup_inputs.side_effect = ValueError("No devices")

    with patch("service_factory.build_git_service"), patch(
        "service_factory.build_git_auth_service"
    ), patch("tasks.backup_tasks.DeviceBackupService", return_value=backup_service), patch.object(
        backup_devices_task, "update_state"
    ):
        result = backup_devices_task.run(
            inventory=[],
            config_repository_id=1,
            credential_id=10,
        )

    assert result["success"] is False
    assert result["error"] == "No devices"


@pytest.mark.unit
def test_backup_devices_task_sequential_success_commits_and_prepares_result(
    tmp_path,
) -> None:
    """Sequential backup path backs up devices, commits, and returns service result."""
    repository = {"id": 1, "name": "configs", "url": "git@example/repo.git", "branch": "main"}
    credential = {"name": "ssh", "username": "admin", "password": "secret"}
    git_repo = SimpleNamespace(
        active_branch="main",
        head=SimpleNamespace(commit=SimpleNamespace(hexsha="abcdef123456")),
    )
    git_service = MagicMock()
    git_service.get_repo_path.return_value = tmp_path / "configs"
    git_service.open_or_clone.return_value = git_repo
    git_service.pull.return_value = SimpleNamespace(success=True, message="pulled")
    git_service.commit_and_push.return_value = SimpleNamespace(
        success=True,
        message="committed",
        files_changed=1,
        commit_sha="abcdef123456",
        pushed=True,
    )
    git_auth = MagicMock()
    git_auth.resolve_credentials.return_value = ("git-user", "token", None)
    backup_service = MagicMock()
    backup_service.validate_backup_inputs.return_value = (repository, credential)
    backup_service.backup_single_device.return_value = _backup_result("dev-1")
    backup_service.prepare_backup_result.return_value = {
        "success": True,
        "backed_up_count": 1,
        "failed_count": 0,
    }

    with patch(
        "service_factory.build_git_service", return_value=git_service
    ), patch(
        "service_factory.build_git_auth_service", return_value=git_auth
    ), patch(
        "tasks.backup_tasks.DeviceBackupService", return_value=backup_service
    ), patch.object(
        backup_devices_task, "update_state"
    ):
        result = backup_devices_task.run(
            inventory=["dev-1"],
            config_repository_id=1,
            credential_id=10,
            parallel_tasks=1,
        )

    assert result["success"] is True
    backup_service.backup_single_device.assert_called_once()
    git_service.commit_and_push.assert_called_once()
    backup_service.prepare_backup_result.assert_called_once()


@pytest.mark.unit
def test_finalize_backup_task_commits_successes_and_marks_job_complete(tmp_path) -> None:
    """Finalize task commits backed-up devices and updates the tracked job run."""
    git_service = MagicMock()
    git_service.commit_and_push.return_value = SimpleNamespace(
        success=True,
        message="committed",
        files_changed=2,
        commit_sha="abc123456789",
        pushed=True,
    )
    job_runs = MagicMock()
    backup_service = MagicMock()
    backup_service.update_nautobot_timestamps.return_value = SimpleNamespace(
        model_dump=lambda: {
            "enabled": True,
            "custom_field_name": "last_backup",
            "updated_count": 1,
            "failed_count": 0,
            "errors": [],
        }
    )

    repo_config = {
        "repo_dir": str(tmp_path),
        "repository": {"name": "configs", "branch": "main"},
        "current_date": "20260516_120000",
        "job_run_id": 55,
        "write_timestamp_to_custom_field": True,
        "timestamp_custom_field_name": "last_backup",
    }

    with patch(
        "service_factory.build_git_service", return_value=git_service
    ), patch("service_factory.build_job_run_service", return_value=job_runs), patch(
        "git.Repo", return_value=MagicMock()
    ), patch(
        "tasks.backup_tasks.DeviceBackupService", return_value=backup_service
    ):
        result = finalize_backup_task.run(
            [{"device_id": "dev-1", "hostname": "router-01"}],
            repo_config,
        )

    assert result["success"] is True
    assert result["backed_up_count"] == 1
    assert result["failed_count"] == 0
    git_service.commit_and_push.assert_called_once()
    backup_service.update_nautobot_timestamps.assert_called_once()
    job_runs.mark_completed.assert_called_once()
