"""Unit tests for tasks/execution/backup_executor.py.

All tests run offline - no Git repository, Nautobot, database, or Celery broker required.
"""

from __future__ import annotations

from contextlib import ExitStack
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from tasks.execution.backup_executor import execute_backup


def _patch_executor_services():
    return [
        patch("service_factory.build_git_service", return_value=MagicMock()),
        patch("service_factory.build_git_auth_service", return_value=MagicMock()),
        patch("service_factory.build_credentials_service", return_value=MagicMock()),
        patch("service_factory.build_job_schedule_service", return_value=MagicMock()),
        patch("service_factory.build_job_template_service", return_value=MagicMock()),
    ]


@pytest.mark.unit
def test_execute_backup_requires_config_repository() -> None:
    """Missing repository configuration returns a clear validation error."""
    with ExitStack() as stack:
        for patcher in _patch_executor_services():
            stack.enter_context(patcher)
        result = execute_backup(
            schedule_id=None,
            credential_id=10,
            job_parameters={},
            target_devices=["dev-1"],
            task_context=MagicMock(),
        )

    assert result["success"] is False
    assert "No config repository specified" in result["error"]


@pytest.mark.unit
def test_execute_backup_fetches_repository_from_template_schedule() -> None:
    """Schedule templates can supply the config repository and backup options."""
    schedule_service = MagicMock()
    schedule_service.get_job_schedule.return_value = {"job_template_id": 44}
    template_service = MagicMock()
    template_service.get_job_template.return_value = {"config_repository_id": 123}
    git_repo_manager = MagicMock()
    git_repo_manager.get_repository.return_value = None

    with (
        patch("service_factory.build_git_service", return_value=MagicMock()),
        patch("service_factory.build_git_auth_service", return_value=MagicMock()),
        patch("service_factory.build_credentials_service", return_value=MagicMock()),
        patch(
            "service_factory.build_job_schedule_service", return_value=schedule_service
        ),
        patch(
            "service_factory.build_job_template_service", return_value=template_service
        ),
        patch("services.git.shared_utils.git_repo_manager", git_repo_manager),
    ):
        result = execute_backup(
            schedule_id=5,
            credential_id=10,
            job_parameters=None,
            target_devices=["dev-1"],
            task_context=MagicMock(),
        )

    assert result["success"] is False
    assert result["error"] == "Repository 123 not found"
    schedule_service.get_job_schedule.assert_called_once_with(5)
    template_service.get_job_template.assert_called_once_with(44)
    git_repo_manager.get_repository.assert_called_once_with(123)


@pytest.mark.unit
def test_execute_backup_requires_credentials() -> None:
    """Credential selection is validated before repository access."""
    with ExitStack() as stack:
        for patcher in _patch_executor_services():
            stack.enter_context(patcher)
        result = execute_backup(
            schedule_id=None,
            credential_id=None,
            job_parameters={"config_repository_id": 123},
            target_devices=["dev-1"],
            task_context=MagicMock(),
        )

    assert result["success"] is False
    assert "No credentials specified" in result["error"]


@pytest.mark.unit
def test_execute_backup_sequential_success(tmp_path) -> None:
    """Sequential backup path backs up devices and commits to Git."""
    repo_dir = tmp_path / "config-repo"
    repo_dir.mkdir()
    (repo_dir / ".git").mkdir()

    credentials = MagicMock()
    credentials.get_credential_by_id.return_value = {
        "id": 10,
        "name": "ssh-admin",
        "username": "admin",
    }
    credentials.get_decrypted_password.return_value = "secret"

    repository = {
        "id": 123,
        "name": "configs",
        "url": "https://example.com/repo.git",
        "branch": "main",
        "auth_type": "token",
    }

    backup_info = MagicMock()
    backup_info.is_successful.return_value = True
    backup_info.to_dict.return_value = {"device_id": "dev-1", "hostname": "r1"}

    pull_result = SimpleNamespace(success=True, message="pulled")
    commit_result = SimpleNamespace(
        success=True,
        message="pushed",
        commit_sha="deadbeef12345678",
        pushed=True,
        files_changed=2,
    )

    mock_git = MagicMock()
    mock_git.get_repo_path.return_value = repo_dir
    mock_git.open_or_clone.return_value = MagicMock(
        active_branch="main", head=MagicMock(commit=MagicMock(hexsha="abcdef12"))
    )
    mock_git.pull.return_value = pull_result
    mock_git.commit_and_push.return_value = commit_result

    git_repo_manager = MagicMock()
    git_repo_manager.get_repository.return_value = repository

    backup_service = MagicMock()
    backup_service.backup_single_device.return_value = backup_info

    mock_git_auth = MagicMock()
    mock_git_auth.resolve_credentials.return_value = ("git-user", "token", None)

    with (
        patch("service_factory.build_git_service", return_value=mock_git),
        patch("service_factory.build_git_auth_service", return_value=mock_git_auth),
        patch("service_factory.build_credentials_service", return_value=credentials),
        patch("service_factory.build_job_schedule_service", return_value=MagicMock()),
        patch("service_factory.build_job_template_service", return_value=MagicMock()),
        patch("services.git.shared_utils.git_repo_manager", git_repo_manager),
        patch(
            "services.nautobot.configs.backup.DeviceBackupService",
            return_value=backup_service,
        ),
    ):
        result = execute_backup(
            schedule_id=None,
            credential_id=10,
            job_parameters={"config_repository_id": 123},
            target_devices=["dev-1"],
            task_context=MagicMock(),
            template={"parallel_tasks": 1},
            job_run_id=99,
        )

    assert result["success"] is True
    assert result["devices_backed_up"] == 1
    backup_service.backup_single_device.assert_called_once()
    mock_git.commit_and_push.assert_called_once()


@pytest.mark.unit
def test_execute_backup_parallel_returns_running_status() -> None:
    """parallel_tasks > 1 launches a chord and returns status=running."""
    credentials = MagicMock()
    credentials.get_credential_by_id.return_value = {
        "id": 10,
        "name": "ssh",
        "username": "admin",
    }
    credentials.get_decrypted_password.return_value = "secret"

    repository = {
        "id": 123,
        "name": "configs",
        "url": "https://x.git",
        "branch": "main",
    }
    repo_dir = MagicMock()
    repo_dir.exists.return_value = True
    repo_dir.parent = MagicMock()

    mock_git = MagicMock()
    mock_git.get_repo_path.return_value = repo_dir
    mock_git.open_or_clone.return_value = MagicMock(
        active_branch="main",
        head=MagicMock(commit=MagicMock(hexsha="abcdef12")),
    )
    mock_git.pull.return_value = SimpleNamespace(success=True, message="ok")

    mock_git_auth = MagicMock()
    mock_git_auth.resolve_credentials.return_value = ("git-user", "token", None)

    schedule_service = MagicMock()
    schedule_service.get_job_schedule.return_value = {"job_template_id": 44}
    template_service = MagicMock()
    template_service.get_job_template.return_value = {
        "config_repository_id": 123,
        "parallel_tasks": 4,
    }

    mock_chord_result = MagicMock()
    mock_chord_result.id = "chord-123"
    mock_chord_builder = MagicMock(
        return_value=MagicMock(return_value=mock_chord_result)
    )

    with (
        patch("service_factory.build_git_service", return_value=mock_git),
        patch("service_factory.build_git_auth_service", return_value=mock_git_auth),
        patch("service_factory.build_credentials_service", return_value=credentials),
        patch(
            "service_factory.build_job_schedule_service", return_value=schedule_service
        ),
        patch(
            "service_factory.build_job_template_service", return_value=template_service
        ),
        patch(
            "services.git.shared_utils.git_repo_manager",
            MagicMock(get_repository=MagicMock(return_value=repository)),
        ),
        patch("celery.chord", mock_chord_builder),
        patch("tasks.backup_tasks.backup_single_device_task", MagicMock()),
        patch("tasks.backup_tasks.finalize_backup_task", MagicMock()),
    ):
        result = execute_backup(
            schedule_id=5,
            credential_id=10,
            job_parameters=None,
            target_devices=["dev-1", "dev-2"],
            task_context=MagicMock(),
        )

    assert result["success"] is True
    assert result["status"] == "running"
    assert result["chord_id"] == "chord-123"
