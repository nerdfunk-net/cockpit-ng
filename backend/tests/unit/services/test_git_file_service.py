"""Unit tests for services/git/file_service.py."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from services.git.file_service import GitFileService

_REPO = {"id": 1, "name": "templates"}


@pytest.mark.unit
def test_search_files_repo_not_found() -> None:
    svc = GitFileService()
    with patch(
        "services.git.file_service.git_repo_manager.get_repository",
        return_value=None,
    ):
        with pytest.raises(HTTPException) as exc:
            svc.search_files(99, query="cfg")

    assert exc.value.status_code == 404


@pytest.mark.unit
def test_search_files_returns_empty_when_path_missing() -> None:
    svc = GitFileService()
    with patch(
        "services.git.file_service.git_repo_manager.get_repository",
        return_value=_REPO,
    ):
        with patch("services.git.file_service.git_repo_path", return_value="/missing"):
            with patch("services.git.file_service.os.path.exists", return_value=False):
                result = svc.search_files(1)

    assert result["success"] is True
    assert result["data"]["total_count"] == 0


@pytest.mark.unit
def test_search_files_filters_and_limits(tmp_path) -> None:
    repo_dir = tmp_path / "repo"
    repo_dir.mkdir()
    (repo_dir / "router.cfg").write_text("config", encoding="utf-8")
    (repo_dir / "other.txt").write_text("text", encoding="utf-8")

    svc = GitFileService()
    with patch(
        "services.git.file_service.git_repo_manager.get_repository",
        return_value=_REPO,
    ):
        with patch(
            "services.git.file_service.git_repo_path", return_value=str(repo_dir)
        ):
            with patch("services.git.file_service.os.path.exists", return_value=True):
                result = svc.search_files(1, query="router", limit=10)

    assert result["success"] is True
    assert result["data"]["filtered_count"] == 1
    assert result["data"]["files"][0]["name"] == "router.cfg"


@pytest.mark.unit
def test_search_files_handles_unexpected_error() -> None:
    svc = GitFileService()
    with patch(
        "services.git.file_service.git_repo_manager.get_repository",
        side_effect=RuntimeError("disk error"),
    ):
        result = svc.search_files(1)

    assert result["success"] is False
    assert "disk error" in result["message"]


@pytest.mark.unit
def test_get_commit_files_lists_config_files() -> None:
    svc = GitFileService()
    mock_repo = MagicMock()
    mock_commit = MagicMock()
    item = MagicMock()
    item.type = "blob"
    item.path = "templates/router.cfg"
    mock_commit.tree.traverse.return_value = [item]
    mock_repo.commit.return_value = mock_commit

    with patch("services.git.file_service.get_git_repo_by_id", return_value=mock_repo):
        with patch("config.settings") as settings:
            settings.allowed_file_extensions = [".cfg"]
            files = svc.get_commit_files(1, "abc123")

    assert files == ["templates/router.cfg"]


@pytest.mark.unit
def test_get_commit_files_returns_single_file_content() -> None:
    svc = GitFileService()
    mock_repo = MagicMock()
    mock_commit = MagicMock()
    blob = MagicMock()
    blob.data_stream.read.return_value = b"interface lo0"
    mock_commit.tree.__truediv__.return_value = blob
    mock_repo.commit.return_value = mock_commit

    with patch("services.git.file_service.get_git_repo_by_id", return_value=mock_repo):
        result = svc.get_commit_files(1, "abc123def456", file_path="router.cfg")

    assert result["content"] == "interface lo0"
    assert result["file_path"] == "router.cfg"


@pytest.mark.unit
def test_get_file_last_commit_returns_metadata() -> None:
    svc = GitFileService()
    mock_repo = MagicMock()
    mock_commit = MagicMock()
    mock_commit.hexsha = "a" * 40
    mock_commit.message = "update config\n"
    mock_commit.author.name = "Dev"
    mock_commit.author.email = "dev@example.com"
    mock_commit.committer.name = "Dev"
    mock_commit.committer.email = "dev@example.com"
    mock_commit.committed_datetime.isoformat.return_value = "2024-06-01T12:00:00"
    mock_commit.committed_datetime.timestamp.return_value = 1710000000
    blob = MagicMock()
    blob.data_stream.read.return_value = b"ok"
    mock_commit.tree.__truediv__.return_value = blob
    mock_repo.iter_commits.return_value = [mock_commit]

    with patch("services.git.file_service.get_git_repo_by_id", return_value=mock_repo):
        result = svc.get_file_last_commit(1, "router.cfg")

    assert result["file_exists"] is True
    assert result["last_commit"]["short_hash"] == ("a" * 8)


@pytest.mark.unit
def test_get_file_history_returns_cached_result() -> None:
    svc = GitFileService()
    cached = {"file_path": "cfg.yaml", "commits": [], "total_commits": 0}
    cache = MagicMock()
    cache.get.return_value = cached

    with patch(
        "services.git.file_service.get_git_repo_by_id", return_value=MagicMock()
    ):
        result = svc.get_file_history(1, "cfg.yaml", cache_service=cache)

    assert result is cached
    cache.get.assert_called_once()


@pytest.mark.unit
def test_get_file_history_builds_commit_list() -> None:
    svc = GitFileService()
    mock_repo = MagicMock()
    mock_commit = MagicMock()
    mock_commit.hexsha = "b" * 40
    mock_commit.message = "add file\n"
    mock_commit.author.name = "Dev"
    mock_commit.author.email = "dev@example.com"
    mock_commit.committed_datetime.isoformat.return_value = "2024-01-01"
    mock_commit.tree.__getitem__ = MagicMock(return_value=MagicMock())
    mock_repo.iter_commits.return_value = [mock_commit]

    with patch("services.git.file_service.get_git_repo_by_id", return_value=mock_repo):
        result = svc.get_file_history(1, "router.cfg", cache_enabled=False)

    assert result["total_commits"] == 1
    assert result["commits"][0]["change_type"] == "A"


@pytest.mark.unit
def test_get_file_content_reads_text_file(tmp_path) -> None:
    repo_dir = tmp_path / "repo"
    repo_dir.mkdir()
    (repo_dir / "data.txt").write_text("hello", encoding="utf-8")
    svc = GitFileService()

    with patch(
        "services.git.file_service.git_repo_manager.get_repository",
        return_value=_REPO,
    ):
        with patch("services.git.file_service.git_repo_path", return_value=repo_dir):
            content = svc.get_file_content(1, "data.txt", username="alice")

    assert content == "hello"


@pytest.mark.unit
def test_get_file_content_parsed_yaml(tmp_path) -> None:
    repo_dir = tmp_path / "repo"
    repo_dir.mkdir()
    (repo_dir / "vars.yaml").write_text("key: 42\n", encoding="utf-8")
    svc = GitFileService()

    with patch(
        "services.git.file_service.git_repo_manager.get_repository",
        return_value=_REPO,
    ):
        with patch("services.git.file_service.git_repo_path", return_value=repo_dir):
            result = svc.get_file_content_parsed(1, "vars.yaml")

    assert result["parsed"]["key"] == 42


@pytest.mark.unit
def test_get_directory_tree_lists_nested_dirs(tmp_path) -> None:
    repo_dir = tmp_path / "repo"
    sub = repo_dir / "configs"
    sub.mkdir(parents=True)
    (sub / "router.cfg").write_text("!", encoding="utf-8")
    svc = GitFileService()

    with patch(
        "services.git.file_service.git_repo_manager.get_repository",
        return_value=_REPO,
    ):
        with patch("services.git.file_service.git_repo_path", return_value=repo_dir):
            tree = svc.get_directory_tree(1, path="configs")

    assert tree["type"] == "directory"
    assert tree["file_count"] == 1


@pytest.mark.unit
def test_get_directory_files_lists_files_with_commit(tmp_path) -> None:
    repo_dir = tmp_path / "repo"
    repo_dir.mkdir()
    (repo_dir / "hosts.csv").write_text("name,ip\n", encoding="utf-8")
    svc = GitFileService()
    mock_repo = MagicMock()
    mock_commit = MagicMock()
    mock_commit.hexsha = "c" * 40
    mock_commit.message = "add csv\n"
    mock_commit.author.name = "Dev"
    mock_commit.author.email = "dev@example.com"
    mock_commit.committed_datetime.isoformat.return_value = "2024-01-01"
    mock_commit.committed_datetime.timestamp.return_value = 1700000000
    mock_repo.iter_commits.return_value = [mock_commit]

    with patch(
        "services.git.file_service.git_repo_manager.get_repository",
        return_value=_REPO,
    ):
        with patch("services.git.file_service.git_repo_path", return_value=repo_dir):
            with patch(
                "services.git.file_service.get_git_repo_by_id",
                return_value=mock_repo,
            ):
                result = svc.get_directory_files(1, path="")

    assert result["directory_exists"] is True
    assert result["files"][0]["name"] == "hosts.csv"
    assert result["files"][0]["last_commit"]["short_hash"] == ("c" * 8)


@pytest.mark.unit
def test_list_csv_files_filters_by_query(tmp_path) -> None:
    repo_dir = tmp_path / "repo"
    repo_dir.mkdir()
    (repo_dir / "devices.csv").write_text("a\n", encoding="utf-8")
    (repo_dir / "other.txt").write_text("b\n", encoding="utf-8")
    svc = GitFileService()

    with patch(
        "services.git.file_service.git_repo_manager.get_repository",
        return_value=_REPO,
    ):
        with patch(
            "services.git.file_service.git_repo_path", return_value=str(repo_dir)
        ):
            result = svc.list_csv_files(1, query="devices", limit=10)

    assert result["success"] is True
    assert result["data"]["total_count"] == 1
    assert result["data"]["files"][0]["name"] == "devices.csv"


@pytest.mark.unit
def test_get_csv_headers_reads_first_row(tmp_path) -> None:
    repo_dir = tmp_path / "repo"
    repo_dir.mkdir()
    (repo_dir / "import.csv").write_text("hostname,ip\nr1,10.0.0.1\n", encoding="utf-8")
    svc = GitFileService()

    with patch(
        "services.git.file_service.git_repo_manager.get_repository",
        return_value=_REPO,
    ):
        with patch(
            "services.git.file_service.git_repo_path", return_value=str(repo_dir)
        ):
            result = svc.get_csv_headers(1, "import.csv")

    assert result["success"] is True
    assert result["headers"] == ["hostname", "ip"]


@pytest.mark.unit
def test_get_file_content_rejects_path_outside_repo(tmp_path) -> None:
    repo_dir = tmp_path / "repo"
    repo_dir.mkdir()
    svc = GitFileService()

    with patch(
        "services.git.file_service.git_repo_manager.get_repository",
        return_value=_REPO,
    ):
        with patch("services.git.file_service.git_repo_path", return_value=repo_dir):
            with pytest.raises(HTTPException) as exc:
                svc.get_file_content(1, "../../etc/passwd")

    assert exc.value.status_code == 403


@pytest.mark.unit
def test_get_commit_files_raises_404_for_missing_file() -> None:
    svc = GitFileService()
    mock_repo = MagicMock()
    mock_commit = MagicMock()
    mock_commit.tree.__truediv__.side_effect = KeyError("missing")
    mock_repo.commit.return_value = mock_commit

    with patch("services.git.file_service.get_git_repo_by_id", return_value=mock_repo):
        with pytest.raises(HTTPException) as exc:
            svc.get_commit_files(1, "abc123", file_path="missing.cfg")

    assert exc.value.status_code == 500
    assert "not found" in exc.value.detail.lower()


@pytest.mark.unit
def test_list_csv_files_empty_repo(tmp_path) -> None:
    repo_dir = tmp_path / "empty-repo"
    repo_dir.mkdir()
    svc = GitFileService()

    with patch(
        "services.git.file_service.git_repo_manager.get_repository",
        return_value=_REPO,
    ):
        with patch(
            "services.git.file_service.git_repo_path", return_value=str(repo_dir)
        ):
            result = svc.list_csv_files(1)

    assert result["success"] is True
    assert result["data"]["total_count"] == 0


@pytest.mark.unit
def test_get_directory_files_missing_directory() -> None:
    svc = GitFileService()
    mock_repo = MagicMock()

    with patch(
        "services.git.file_service.git_repo_manager.get_repository",
        return_value=_REPO,
    ):
        with patch("services.git.file_service.git_repo_path", return_value="/missing"):
            with patch("services.git.file_service.os.path.exists", return_value=False):
                with patch(
                    "services.git.file_service.get_git_repo_by_id",
                    return_value=mock_repo,
                ):
                    result = svc.get_directory_files(1, path="subdir")

    assert result["directory_exists"] is False
    assert result["files"] == []


@pytest.mark.unit
def test_get_csv_headers_repo_not_found() -> None:
    svc = GitFileService()
    with patch(
        "services.git.file_service.git_repo_manager.get_repository",
        return_value=None,
    ):
        with pytest.raises(HTTPException) as exc:
            svc.get_csv_headers(1, "data.csv")

    assert exc.value.status_code == 404
