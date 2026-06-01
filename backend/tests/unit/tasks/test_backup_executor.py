"""Unit tests for tasks/execution/backup_executor.py.

All tests run offline - no Git repository, Nautobot, database, or Celery broker required.
"""

from __future__ import annotations

from contextlib import ExitStack
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
        patch("service_factory.build_job_schedule_service", return_value=schedule_service),
        patch("service_factory.build_job_template_service", return_value=template_service),
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
