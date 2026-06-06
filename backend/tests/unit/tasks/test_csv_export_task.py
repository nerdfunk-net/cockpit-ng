"""Unit tests for tasks/csv_export_task.py."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tasks.csv_export_task import _run_csv_export, csv_export_task

_PATCH_GRAPHQL = "service_factory.build_nautobot_service"
_PATCH_REPO_MGR = "services.git.shared_utils.git_repo_manager"
_PATCH_GIT = "service_factory.build_git_service"
_PATCH_JRS = "service_factory.build_job_run_service"


def _device(name: str = "r1", **extra: object) -> dict:
    base = {
        "name": name,
        "serial": "SN1",
        "role": {"name": "Router"},
        "status": {"name": "active"},
        "location": {"name": "DC"},
        "device_type": {"model": "ISR"},
        "platform": {"name": "ios"},
        "tags": [{"name": "prod"}],
        "primary_ip4": {"address": "10.0.0.1/24"},
    }
    base.update(extra)
    return base


@pytest.mark.unit
def test_run_csv_export_rejects_empty_device_ids() -> None:
    task_ctx = MagicMock()

    result = _run_csv_export(
        task_ctx,
        device_ids=[],
        properties=["name"],
        repo_id=1,
        file_path="out.csv",
    )

    assert result["success"] is False
    assert "No devices" in result["error"]


@pytest.mark.unit
def test_run_csv_export_rejects_empty_properties() -> None:
    result = _run_csv_export(
        MagicMock(),
        device_ids=["dev-1"],
        properties=[],
        repo_id=1,
        file_path="out.csv",
    )

    assert result["success"] is False
    assert "properties" in result["error"]


@pytest.mark.unit
def test_run_csv_export_repository_not_found() -> None:
    mock_nb = MagicMock()
    mock_nb.graphql_query = AsyncMock(return_value={"data": {"devices": [_device()]}})

    with patch(_PATCH_GRAPHQL, return_value=mock_nb):
        with patch(_PATCH_REPO_MGR) as mgr:
            mgr.get_repository.return_value = None
            result = _run_csv_export(
                MagicMock(),
                device_ids=["dev-1"],
                properties=["name"],
                repo_id=99,
                file_path="exports/out.csv",
            )

    assert result["success"] is False
    assert "repository" in result["error"].lower()


@pytest.mark.unit
def test_run_csv_export_success_writes_and_commits(tmp_path: Path) -> None:
    task_ctx = MagicMock()
    repo_dir = tmp_path / "csv-repo"
    repo_dir.mkdir()
    (repo_dir / ".git").mkdir()

    mock_nb = MagicMock()
    mock_nb.graphql_query = AsyncMock(
        return_value={"data": {"devices": [_device("router1")]}}
    )

    pull_result = SimpleNamespace(success=True, message="pulled")
    commit_result = SimpleNamespace(
        success=True,
        message="pushed",
        commit_sha="abcdef1234567890",
        pushed=True,
        files_changed=1,
    )
    mock_git = MagicMock()
    mock_git.pull.return_value = pull_result
    mock_git.commit_and_push.return_value = commit_result

    repository = {
        "id": 1,
        "name": "csv-exports",
        "branch": "main",
        "url": "https://example.com/repo.git",
    }

    mock_jrs = MagicMock()

    mock_git_repo = MagicMock()

    with patch(_PATCH_GRAPHQL, return_value=mock_nb):
        with patch(_PATCH_REPO_MGR) as mgr:
            mgr.get_repository.return_value = repository
            with patch(_PATCH_GIT, return_value=mock_git):
                with patch("services.git.paths.repo_path", return_value=repo_dir):
                    with patch("git.Repo", return_value=mock_git_repo):
                        with patch(_PATCH_JRS, return_value=mock_jrs):
                            result = _run_csv_export(
                                task_ctx,
                                device_ids=["dev-1"],
                                properties=["name", "serial"],
                                repo_id=1,
                                file_path="exports/devices.csv",
                                job_run_id=42,
                            )

    assert result["success"] is True
    assert result["exported_devices"] == 1
    assert (repo_dir / "exports" / "devices.csv").exists()
    mock_jrs.mark_completed.assert_called_once_with(42, result=result)


@pytest.mark.unit
def test_run_csv_export_marks_job_failed_on_exception() -> None:
    task_ctx = MagicMock()
    mock_nb = MagicMock()
    mock_nb.graphql_query = AsyncMock(side_effect=RuntimeError("graphql down"))
    mock_jrs = MagicMock()

    with patch(_PATCH_GRAPHQL, return_value=mock_nb):
        with patch(_PATCH_JRS, return_value=mock_jrs):
            result = _run_csv_export(
                task_ctx,
                device_ids=["dev-1"],
                properties=["name"],
                repo_id=1,
                file_path="out.csv",
                job_run_id=7,
            )

    assert result["success"] is False
    mock_jrs.mark_failed.assert_called_once_with(7, "graphql down")


@pytest.mark.unit
def test_csv_export_task_wrapper_delegates() -> None:
    with patch(
        "tasks.csv_export_task._run_csv_export", return_value={"success": True}
    ) as run:
        result = csv_export_task.run(
            ["dev-1"],
            ["name"],
            1,
            "out.csv",
            job_run_id=1,
        )

    assert result["success"] is True
    run.assert_called_once()
