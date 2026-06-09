"""Unit tests for git repository content search."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from models.git_content_search import GitContentSearchRequest
from services.git.file_service import GitFileService

_REPO = {"id": 1, "name": "device-configs", "branch": "main"}


@pytest.mark.unit
def test_content_search_request_requires_commits_in_diff_mode() -> None:
    with pytest.raises(ValidationError):
        GitContentSearchRequest(query="test", diff_mode=True)


@pytest.mark.unit
def test_content_search_request_rejects_history_with_diff_mode() -> None:
    with pytest.raises(ValidationError):
        GitContentSearchRequest(
            query="test",
            diff_mode=True,
            include_history=True,
            commit1="abc",
            commit2="def",
        )


@pytest.mark.unit
def test_search_file_content_repo_not_found() -> None:
    svc = GitFileService()
    request = GitContentSearchRequest(query="interface")

    with patch(
        "services.git.file_search_service.git_repo_manager.get_repository",
        return_value=None,
    ):
        with pytest.raises(HTTPException) as exc:
            svc.search_file_content(99, request)

    assert exc.value.status_code == 404


@pytest.mark.unit
def test_search_file_content_current_mode(tmp_path) -> None:
    repo_dir = tmp_path / "repo"
    repo_dir.mkdir()
    (repo_dir / "router.cfg").write_text(
        "interface lo0\nsnmp-server community public\n",
        encoding="utf-8",
    )
    (repo_dir / "switch.cfg").write_text("hostname sw1\n", encoding="utf-8")

    svc = GitFileService()
    request = GitContentSearchRequest(query="snmp-server")

    mock_repo = MagicMock()
    mock_repo.head.commit.hexsha = "a" * 40

    with patch(
        "services.git.file_search_service.git_repo_manager.get_repository",
        return_value=_REPO,
    ):
        with patch(
            "services.git.file_search_service.git_repo_path", return_value=str(repo_dir)
        ):
            with patch(
                "services.git.file_search_service.get_git_repo_by_id",
                return_value=mock_repo,
            ):
                with patch("config.settings") as settings:
                    settings.allowed_file_extensions = [".cfg"]
                    result = svc.search_file_content(1, request)

    assert result["success"] is True
    data = result["data"]
    assert data["search_mode"] == "current"
    assert data["total_matches"] == 1
    assert data["matches"][0]["file_path"] == "router.cfg"
    assert "snmp-server" in data["matches"][0]["line_content"]


@pytest.mark.unit
def test_search_file_content_path_filter_excludes_files(tmp_path) -> None:
    repo_dir = tmp_path / "repo"
    site_a = repo_dir / "site-a"
    site_b = repo_dir / "site-b"
    site_a.mkdir(parents=True)
    site_b.mkdir(parents=True)
    (site_a / "router.cfg").write_text(
        "snmp-server community public\n", encoding="utf-8"
    )
    (site_b / "router.cfg").write_text(
        "snmp-server community private\n", encoding="utf-8"
    )

    svc = GitFileService()
    request = GitContentSearchRequest(
        query="snmp-server",
        path_filter="site-a/*",
    )

    mock_repo = MagicMock()
    mock_repo.head.commit.hexsha = "a" * 40

    with patch(
        "services.git.file_search_service.git_repo_manager.get_repository",
        return_value=_REPO,
    ):
        with patch(
            "services.git.file_search_service.git_repo_path", return_value=str(repo_dir)
        ):
            with patch(
                "services.git.file_search_service.get_git_repo_by_id",
                return_value=mock_repo,
            ):
                with patch("config.settings") as settings:
                    settings.allowed_file_extensions = [".cfg"]
                    result = svc.search_file_content(1, request)

    assert result["data"]["total_matches"] == 1
    assert result["data"]["matches"][0]["file_path"] == "site-a/router.cfg"


@pytest.mark.unit
def test_search_file_content_history_mode(tmp_path) -> None:
    repo_dir = tmp_path / "repo"
    repo_dir.mkdir()
    (repo_dir / "router.cfg").write_text("current config\n", encoding="utf-8")

    old_commit = MagicMock()
    old_commit.hexsha = "b" * 40
    old_commit.message = "old backup"
    old_commit.committed_datetime.isoformat.return_value = "2024-01-01T00:00:00"

    mock_repo = MagicMock()
    mock_repo.iter_commits.return_value = [old_commit]
    mock_repo.commit.return_value = old_commit

    blob = MagicMock()
    blob.data_stream.read.return_value = b"legacy snmp-server community old\n"
    old_commit.tree.__truediv__.return_value = blob

    svc = GitFileService()
    request = GitContentSearchRequest(query="legacy", include_history=True)

    with patch(
        "services.git.file_search_service.git_repo_manager.get_repository",
        return_value=_REPO,
    ):
        with patch(
            "services.git.file_search_service.git_repo_path", return_value=str(repo_dir)
        ):
            with patch(
                "services.git.file_search_service.get_git_repo_by_id",
                return_value=mock_repo,
            ):
                with patch("config.settings") as settings:
                    settings.allowed_file_extensions = [".cfg"]
                    result = svc.search_file_content(1, request)

    assert result["data"]["search_mode"] == "history"
    assert result["data"]["total_matches"] == 1
    assert result["data"]["matches"][0]["match_source"] == "history"
    assert result["data"]["matches"][0]["commit"] == ("b" * 40)[:8]


@pytest.mark.unit
def test_search_file_content_diff_mode_finds_changed_lines() -> None:
    svc = GitFileService()
    request = GitContentSearchRequest(
        query="added-line",
        diff_mode=True,
        commit1="a" * 40,
        commit2="b" * 40,
    )

    mock_repo = MagicMock()
    mock_repo.git.diff.return_value = "router.cfg\n"

    commit_a = MagicMock()
    blob_a = MagicMock()
    blob_a.data_stream.read.return_value = b"hostname r1\n"
    commit_a.tree.__truediv__.return_value = blob_a

    commit_b = MagicMock()
    blob_b = MagicMock()
    blob_b.data_stream.read.return_value = b"hostname r1\nadded-line here\n"
    commit_b.tree.__truediv__.return_value = blob_b

    def resolve_commit(commit_hash: str) -> MagicMock:
        if commit_hash.startswith("a"):
            return commit_a
        return commit_b

    mock_repo.commit.side_effect = resolve_commit

    with patch(
        "services.git.file_search_service.git_repo_manager.get_repository",
        return_value=_REPO,
    ):
        with patch(
            "services.git.file_search_service.get_git_repo_by_id",
            return_value=mock_repo,
        ):
            with patch("config.settings") as settings:
                settings.allowed_file_extensions = [".cfg"]
                result = svc.search_file_content(1, request)

    assert result["data"]["search_mode"] == "diff"
    assert result["data"]["total_matches"] == 1
    assert result["data"]["matches"][0]["change_type"] == "add"
    assert "added-line" in result["data"]["matches"][0]["line_content"]


@pytest.mark.unit
def test_search_file_content_diff_mode_ignores_unchanged_lines() -> None:
    svc = GitFileService()
    request = GitContentSearchRequest(
        query="hostname",
        diff_mode=True,
        commit1="a" * 40,
        commit2="b" * 40,
    )

    mock_repo = MagicMock()
    mock_repo.git.diff.return_value = "router.cfg\n"

    commit_a = MagicMock()
    blob_a = MagicMock()
    blob_a.data_stream.read.return_value = b"hostname r1\n"
    commit_a.tree.__truediv__.return_value = blob_a

    commit_b = MagicMock()
    blob_b = MagicMock()
    blob_b.data_stream.read.return_value = b"hostname r1\n"
    commit_b.tree.__truediv__.return_value = blob_b

    def resolve_commit(commit_hash: str) -> MagicMock:
        if commit_hash.startswith("a"):
            return commit_a
        return commit_b

    mock_repo.commit.side_effect = resolve_commit

    with patch(
        "services.git.file_search_service.git_repo_manager.get_repository",
        return_value=_REPO,
    ):
        with patch(
            "services.git.file_search_service.get_git_repo_by_id",
            return_value=mock_repo,
        ):
            with patch("config.settings") as settings:
                settings.allowed_file_extensions = [".cfg"]
                result = svc.search_file_content(1, request)

    assert result["data"]["total_matches"] == 0
