"""Unit tests for services/git/service.py."""

from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from git import GitCommandError, InvalidGitRepositoryError

from services.git.service import GitService

_REPO = {
    "name": "configs",
    "url": "https://example.com/org/repo.git",
    "branch": "main",
    "verify_ssl": True,
}


@contextmanager
def _fake_auth():
    yield ("https://token@example.com/org/repo.git", "user", "token", None)


def _service() -> GitService:
    svc = GitService()
    svc._auth.setup_auth_environment = MagicMock(return_value=_fake_auth())
    svc._auth.normalize_url = MagicMock(side_effect=lambda u: u.rstrip("/"))
    return svc


def _mock_repo() -> MagicMock:
    repo = MagicMock()
    origin = MagicMock()
    origin.url = "https://example.com/org/repo.git"
    origin.urls = ["https://example.com/org/repo.git"]
    origin.pull.return_value = [MagicMock()]
    origin.push.return_value = []
    repo.remotes.origin = origin
    repo.active_branch.name = "main"
    repo.head.is_valid.return_value = True
    repo.head.commit.hexsha = "abcdef1234567890"
    repo.head.commit.message = "init\n"
    repo.head.commit.author.name = "Dev"
    repo.head.commit.committed_datetime.isoformat.return_value = "2024-01-01T00:00:00"
    repo.is_dirty.return_value = False
    repo.untracked_files = []
    repo.index.diff.return_value = []
    repo.git.diff.return_value = "file.txt\n"
    mock_commit = MagicMock()
    mock_commit.hexsha = "deadbeef"
    repo.index.commit.return_value = mock_commit
    return repo


@pytest.mark.unit
def test_get_repo_path_returns_path() -> None:
    svc = _service()
    with patch("services.git.service.get_repo_path", return_value=Path("/data/repo")):
        assert svc.get_repo_path(_REPO) == Path("/data/repo")


@pytest.mark.unit
def test_open_or_clone_returns_existing_repo() -> None:
    svc = _service()
    mock_repo = _mock_repo()

    with patch("services.git.service.get_repo_path", return_value=Path("/data/repo")):
        with patch.object(Path, "mkdir", return_value=None):
            with patch("services.git.service.Repo", return_value=mock_repo):
                result = svc.open_or_clone(_REPO)

    assert result is mock_repo


@pytest.mark.unit
def test_open_or_clone_reclones_on_invalid_repo() -> None:
    svc = _service()
    mock_repo = _mock_repo()

    with patch("services.git.service.get_repo_path", return_value=Path("/data/repo")):
        with patch.object(Path, "mkdir", return_value=None):
            with patch(
                "services.git.service.Repo", side_effect=InvalidGitRepositoryError()
            ):
                with patch.object(svc, "_clone_fresh", return_value=mock_repo) as clone:
                    result = svc.open_or_clone(_REPO)

    assert result is mock_repo
    clone.assert_called_once()


@pytest.mark.unit
def test_pull_success() -> None:
    svc = _service()
    mock_repo = _mock_repo()

    with patch("services.git.service.set_ssl_env"):
        result = svc.pull(_REPO, repo=mock_repo)

    assert result.success is True
    assert result.commits_pulled == 1


@pytest.mark.unit
def test_pull_git_error_returns_failure() -> None:
    svc = _service()
    mock_repo = _mock_repo()
    mock_repo.remotes.origin.pull.side_effect = GitCommandError("pull", 1)

    with patch("services.git.service.set_ssl_env"):
        result = svc.pull(_REPO, repo=mock_repo)

    assert result.success is False
    assert "Pull failed" in result.message


@pytest.mark.unit
def test_push_success() -> None:
    svc = _service()
    mock_repo = _mock_repo()

    with patch("services.git.service.set_ssl_env"):
        result = svc.push(_REPO, repo=mock_repo)

    assert result.success is True
    assert result.pushed is True


@pytest.mark.unit
def test_push_auth_error_message() -> None:
    svc = _service()
    mock_repo = _mock_repo()
    mock_repo.remotes.origin.push.side_effect = GitCommandError(
        "push", 128, stderr=b"authentication failed"
    )

    with patch("services.git.service.set_ssl_env"):
        result = svc.push(_REPO, repo=mock_repo)

    assert result.success is False
    assert "Authentication failed" in result.message


@pytest.mark.unit
def test_commit_creates_commit() -> None:
    svc = _service()
    mock_repo = _mock_repo()

    with patch("services.git.service.set_git_author"):
        result = svc.commit(_REPO, "backup", files=["file.txt"], repo=mock_repo)

    assert result.success is True
    assert result.files_changed == 1
    assert result.commit_sha == "deadbeef"


@pytest.mark.unit
def test_commit_no_changes() -> None:
    svc = _service()
    mock_repo = _mock_repo()
    mock_repo.git.diff.return_value = ""

    with patch("services.git.service.set_git_author"):
        result = svc.commit(_REPO, "empty", repo=mock_repo)

    assert result.success is True
    assert result.files_changed == 0


@pytest.mark.unit
def test_commit_and_push_skips_push_when_no_changes() -> None:
    svc = _service()
    mock_repo = _mock_repo()
    mock_repo.git.diff.return_value = ""

    with patch("services.git.service.set_git_author"):
        result = svc.commit_and_push(_REPO, "noop", repo=mock_repo)

    assert result.success is True
    assert result.pushed is False


@pytest.mark.unit
def test_fetch_success() -> None:
    svc = _service()
    mock_repo = _mock_repo()

    with patch("services.git.service.set_ssl_env"):
        result = svc.fetch(_REPO, repo=mock_repo)

    assert result.success is True


@pytest.mark.unit
def test_get_status_when_path_missing(tmp_path: Path) -> None:
    svc = _service()
    missing = tmp_path / "missing"

    with patch.object(svc, "get_repo_path", return_value=missing):
        status = svc.get_status(_REPO)

    assert status["exists"] is False
    assert status["is_git_repo"] is False


@pytest.mark.unit
def test_get_status_populates_branch_and_commit() -> None:
    svc = _service()
    mock_repo = _mock_repo()

    with patch.object(svc, "get_repo_path", return_value=Path("/data/repo")):
        with patch("services.git.service.Repo", return_value=mock_repo):
            with patch.object(Path, "exists", return_value=True):
                status = svc.get_status(_REPO, repo=mock_repo)

    assert status["is_git_repo"] is True
    assert status["current_branch"] == "main"
    assert status["current_commit"]["sha"] == "abcdef12"
