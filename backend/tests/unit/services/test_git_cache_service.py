"""Unit tests for services/git/cache.py."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from services.git.cache import GitCacheService

_SAMPLE_COMMITS = [
    {
        "hash": "abc123",
        "short_hash": "abc123",
        "message": "init",
        "author": {"name": "Dev", "email": "dev@example.com"},
        "date": "2024-01-01T00:00:00",
        "files_changed": 0,
    }
]


def _service(mock_cache: MagicMock | None = None) -> GitCacheService:
    return GitCacheService(mock_cache or MagicMock())


@pytest.mark.unit
def test_build_cache_key_with_parts() -> None:
    svc = _service()
    assert svc._build_cache_key(3, "commits", "main") == "repo:3:commits:main"
    assert svc._build_cache_key(3) == "repo:3"


@pytest.mark.unit
def test_get_cache_config_falls_back_on_settings_error() -> None:
    svc = _service()
    with patch(
        "services.settings.manager.SettingsManager",
        side_effect=RuntimeError("no settings"),
    ):
        cfg = svc._get_cache_config()
    assert cfg["enabled"] is True
    assert cfg["max_commits"] == 500


@pytest.mark.unit
def test_get_commits_returns_cached_slice() -> None:
    mock_cache = MagicMock()
    mock_cache.get.return_value = _SAMPLE_COMMITS * 3
    svc = _service(mock_cache)

    with patch.object(svc, "_get_cache_config", return_value={"enabled": True}):
        result = svc.get_commits(1, "/tmp/repo", "main", limit=2)

    assert len(result) == 2
    mock_cache.get.assert_called_once()


@pytest.mark.unit
def test_get_commits_cache_hit_returns_models() -> None:
    mock_cache = MagicMock()
    mock_cache.get.return_value = _SAMPLE_COMMITS
    svc = _service(mock_cache)

    with patch.object(svc, "_get_cache_config", return_value={"enabled": True}):
        result = svc.get_commits(1, "/tmp/repo", "main", use_models=True)

    assert result[0].hash == "abc123"


@pytest.mark.unit
def test_get_commits_skips_cache_when_disabled() -> None:
    mock_cache = MagicMock()
    svc = _service(mock_cache)

    with patch.object(
        svc, "_get_cache_config", return_value={"enabled": False}
    ):
        with patch.object(svc, "_fetch_commits_from_repo", return_value=_SAMPLE_COMMITS) as fetch:
            result = svc.get_commits(1, "/tmp/repo", "main")

    assert result == _SAMPLE_COMMITS
    mock_cache.get.assert_not_called()
    fetch.assert_called_once()


@pytest.mark.unit
def test_get_commits_fetches_and_caches_on_miss() -> None:
    mock_cache = MagicMock()
    mock_cache.get.return_value = None
    svc = _service(mock_cache)

    with patch.object(svc, "_get_cache_config", return_value={"enabled": True, "max_commits": 500, "ttl_seconds": 600}):
        with patch.object(svc, "_fetch_commits_from_repo", return_value=_SAMPLE_COMMITS) as fetch:
            result = svc.get_commits(5, "/tmp/repo", "main")

    assert result == _SAMPLE_COMMITS
    fetch.assert_called_once()


@pytest.mark.unit
def test_fetch_commits_subprocess_parses_log() -> None:
    svc = _service()
    log_stdout = "deadbeef|subject|Author|author@example.com|2024-01-01T00:00:00\n"
    with patch("services.git.cache.subprocess.run") as run:
        run.return_value = MagicMock(returncode=0, stdout=log_stdout)
        commits = svc._fetch_commits_subprocess("/tmp/repo", "main", 5)

    assert len(commits) == 1
    assert commits[0]["hash"] == "deadbeef"
    assert commits[0]["author"]["email"] == "author@example.com"


@pytest.mark.unit
def test_fetch_commits_subprocess_returns_empty_on_failure() -> None:
    svc = _service()
    with patch("services.git.cache.subprocess.run", side_effect=OSError("git missing")):
        assert svc._fetch_commits_subprocess("/tmp/repo", "main", 5) == []


@pytest.mark.unit
def test_get_file_history_returns_cached() -> None:
    mock_cache = MagicMock()
    mock_cache.get.return_value = _SAMPLE_COMMITS
    svc = _service(mock_cache)

    with patch.object(svc, "_get_cache_config", return_value={"enabled": True}):
        result = svc.get_file_history(1, "/tmp/repo", "config.yaml")

    assert result == _SAMPLE_COMMITS


@pytest.mark.unit
def test_get_commit_details_returns_cached() -> None:
    mock_cache = MagicMock()
    cached = {**_SAMPLE_COMMITS[0], "stats": {"additions": 1}}
    mock_cache.get.return_value = cached
    svc = _service(mock_cache)

    with patch.object(svc, "_get_cache_config", return_value={"enabled": True}):
        result = svc.get_commit_details(1, "/tmp/repo", "abc123")

    assert result is not None
    assert result["hash"] == "abc123"


@pytest.mark.unit
def test_invalidate_repo_uses_delete_pattern() -> None:
    mock_cache = MagicMock()
    mock_cache.delete_pattern = MagicMock()
    svc = _service(mock_cache)
    svc.invalidate_repo(9)
    mock_cache.delete_pattern.assert_called_once_with("repo:9:*")


@pytest.mark.unit
def test_fetch_commits_from_repo_uses_gitpython_and_caches() -> None:
    mock_cache = MagicMock()
    svc = _service(mock_cache)
    mock_commit = MagicMock()
    mock_commit.hexsha = "abc"
    mock_commit.message = "msg"
    mock_commit.author.name = "Dev"
    mock_commit.author.email = "dev@example.com"
    mock_commit.committed_datetime.isoformat.return_value = "2024-01-01"

    with patch("services.git.cache.Repo") as repo_cls:
        repo_cls.return_value.iter_commits.return_value = [mock_commit]
        with patch("services.git.cache.commit_to_dict", return_value=_SAMPLE_COMMITS[0]):
            commits = svc._fetch_commits_from_repo(
                1, "/tmp/repo", "main", 10, {"enabled": True, "max_commits": 500, "ttl_seconds": 60}
            )

    assert len(commits) == 1
    mock_cache.set.assert_called_once()


@pytest.mark.unit
def test_get_file_history_fetches_from_repo_on_miss() -> None:
    mock_cache = MagicMock()
    mock_cache.get.return_value = None
    svc = _service(mock_cache)
    mock_commit = MagicMock()
    mock_commit.parents = []

    with patch.object(svc, "_get_cache_config", return_value={"enabled": True, "ttl_seconds": 300}):
        with patch("services.git.cache.Repo") as repo_cls:
            repo_cls.return_value.iter_commits.return_value = [mock_commit]
            with patch("services.git.cache.commit_to_dict", return_value=_SAMPLE_COMMITS[0]):
                result = svc.get_file_history(2, "/tmp/repo", "README.md")

    assert len(result) == 1
    mock_cache.set.assert_called_once()


@pytest.mark.unit
def test_get_commit_details_fetches_from_repo() -> None:
    mock_cache = MagicMock()
    mock_cache.get.return_value = None
    svc = _service(mock_cache)
    mock_commit = MagicMock()
    mock_stats = MagicMock()
    mock_stats.total = {"insertions": 1, "deletions": 2, "lines": 3, "files": 4}

    with patch.object(svc, "_get_cache_config", return_value={"enabled": True, "ttl_seconds": 120}):
        with patch("services.git.cache.Repo") as repo_cls:
            repo_cls.return_value.commit.return_value = mock_commit
            with patch("services.git.cache.commit_to_dict", return_value=_SAMPLE_COMMITS[0]):
                mock_commit.stats = mock_stats
                result = svc.get_commit_details(1, "/tmp/repo", "abc123")

    assert result is not None
    assert result["stats"]["additions"] == 1


@pytest.mark.unit
def test_invalidate_all_clears_when_no_pattern_support() -> None:
    mock_cache = MagicMock(spec=["clear"])
    svc = _service(mock_cache)
    svc.invalidate_all()
    mock_cache.clear.assert_called_once()
