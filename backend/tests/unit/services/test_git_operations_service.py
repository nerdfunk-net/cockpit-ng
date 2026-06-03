"""Unit tests for services/git/operations.py."""

from __future__ import annotations

from contextlib import contextmanager
from unittest.mock import MagicMock, patch

import pytest
from git import GitCommandError

from services.git.operations import GitOperationsService

_REPO = {
    "id": 1,
    "name": "templates",
    "url": "https://example.com/org/repo.git",
    "branch": "main",
    "verify_ssl": True,
}


@contextmanager
def _fake_auth():
    yield ("https://token@example.com/org/repo.git", "user", "token", None)


def _service() -> GitOperationsService:
    svc = GitOperationsService()
    svc._auth.setup_auth_environment = MagicMock(return_value=_fake_auth())
    return svc


@pytest.mark.unit
def test_get_repository_status_when_path_missing() -> None:
    svc = _service()
    with patch("services.git.operations.get_repo_path", return_value="/nonexistent/repo"):
        with patch("services.git.operations.os.path.exists", return_value=False):
            status = svc.get_repository_status(_REPO, repo_id=1)

    assert status["exists"] is False
    assert status["is_git_repo"] is False


@pytest.mark.unit
def test_clone_repository_success() -> None:
    svc = _service()
    with patch("services.git.operations.get_repo_path", return_value="/tmp/clone-target"):
        with patch("services.git.operations.os.makedirs"):
            with patch("services.git.operations.set_ssl_env"):
                with patch("services.git.operations.Repo.clone_from"):
                    result = svc.clone_repository(_REPO)

    assert result.success is True
    assert "cloned successfully" in result.message.lower()


@pytest.mark.unit
def test_clone_repository_failure_cleans_up() -> None:
    svc = _service()
    with patch("services.git.operations.get_repo_path", return_value="/tmp/clone-target"):
        with patch("services.git.operations.os.makedirs"):
            with patch("services.git.operations.set_ssl_env"):
                with patch(
                    "services.git.operations.Repo.clone_from",
                    side_effect=RuntimeError("network"),
                ):
                    with patch("services.git.operations.os.path.exists", return_value=True):
                        with patch("services.git.operations.shutil.rmtree"):
                            result = svc.clone_repository(_REPO)

    assert result.success is False
    assert "Clone failed" in result.message


@pytest.mark.unit
def test_sync_repository_pull_success() -> None:
    svc = _service()
    mock_repo = MagicMock()
    mock_origin = MagicMock()
    mock_repo.remotes.origin = mock_origin

    with patch("services.git.operations.get_repo_path", return_value="/tmp/repo"):
        with patch("services.git.operations.os.makedirs"):
            with patch("services.git.operations.os.path.exists", return_value=True):
                with patch(
                    "services.git.operations.os.path.isdir",
                    side_effect=lambda p: p.endswith(".git"),
                ):
                    with patch("services.git.operations.set_ssl_env"):
                        with patch("services.git.operations.Repo", return_value=mock_repo):
                            result = svc.sync_repository(_REPO)

    assert result.success is True
    mock_origin.pull.assert_called_once_with("main")


@pytest.mark.unit
def test_sync_repository_clone_auth_error_message() -> None:
    svc = _service()
    gce = GitCommandError("clone", 128, stderr=b"authentication failed")

    with patch("services.git.operations.get_repo_path", return_value="/tmp/new-repo"):
        with patch("services.git.operations.os.makedirs"):
            with patch("services.git.operations.os.path.exists", return_value=False):
                with patch("services.git.operations.os.path.isdir", return_value=False):
                    with patch("services.git.operations.set_ssl_env"):
                        with patch(
                            "services.git.operations.Repo.clone_from",
                            side_effect=gce,
                        ):
                            with patch("services.git.operations.os.listdir", return_value=[]):
                                with patch("services.git.operations.shutil.rmtree"):
                                    result = svc.sync_repository(_REPO)

    assert result.success is False
    assert "Authentication failed" in result.message


@pytest.mark.unit
def test_get_repository_status_populates_git_fields() -> None:
    svc = _service()
    mock_repo = MagicMock()
    mock_repo.active_branch.name = "main"
    mock_head_commit = MagicMock()
    mock_head_commit.hexsha = "abcdef1234567890"
    mock_head_commit.message = "  latest\n"
    mock_head_commit.committed_datetime.isoformat.return_value = "2024-06-01T12:00:00"
    mock_head_commit.author.name = "Dev"
    mock_head_commit.author.email = "dev@example.com"
    mock_repo.head.is_valid.return_value = True
    mock_repo.head.commit = mock_head_commit
    mock_repo.branches = [MagicMock(name="main")]
    mock_repo.remotes = []

    mock_cache_svc = MagicMock()
    mock_cache_svc.get_commits.return_value = []

    with patch("services.git.operations.get_repo_path", return_value="/tmp/repo"):
        with patch("services.git.operations.os.path.exists", return_value=True):
            with patch("services.git.operations.Repo", return_value=mock_repo):
                with patch("service_factory.build_git_cache_service", return_value=mock_cache_svc):
                    status = svc.get_repository_status(_REPO, repo_id=3)

    assert status["is_git_repo"] is True
    assert status["current_branch"] == "main"
    assert status["current_commit"] == "abcdef12"


@pytest.mark.unit
def test_remove_and_sync_clones_fresh() -> None:
    svc = _service()
    with patch("services.git.operations.get_repo_path", return_value="/tmp/repo"):
        with patch("services.git.operations.os.path.exists", return_value=True):
            with patch("services.git.operations.shutil.rmtree"):
                with patch("services.git.operations.os.makedirs"):
                    with patch("services.git.operations.set_ssl_env"):
                        with patch("services.git.operations.Repo.clone_from"):
                            with patch(
                                "services.git.operations.os.path.isdir",
                                side_effect=lambda p: p.endswith(".git"),
                            ):
                                result = svc.remove_and_sync(_REPO)

    assert result.success is True
    assert "re-cloned" in result.message
