"""Unit tests for services/settings/git_service.py."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from services.settings.defaults import GitSettings
from services.settings.git_service import GitSettingsService

_PATCH_GIT_REPO = "services.settings.git_service.GitSettingRepository"
_PATCH_META_REPO = "services.settings.git_service.SettingsMetadataRepository"

_DEFAULT = GitSettings()


def _service() -> GitSettingsService:
    return GitSettingsService(default=_DEFAULT)


@pytest.mark.unit
def test_get_returns_db_settings() -> None:
    mock_settings = SimpleNamespace(
        repo_url="https://git.example.com/repo.git",
        branch="develop",
        username="ci",
        token="secret",
        config_path="/cfg",
        sync_interval=30,
        verify_ssl=False,
    )
    mock_repo = MagicMock()
    mock_repo.get_settings.return_value = mock_settings

    with patch(_PATCH_GIT_REPO, return_value=mock_repo):
        result = _service().get()

    assert result["branch"] == "develop"
    assert result["repo_url"] == "https://git.example.com/repo.git"


@pytest.mark.unit
def test_get_falls_back_on_error() -> None:
    with patch(_PATCH_GIT_REPO, side_effect=RuntimeError("db down")):
        result = _service().get()

    assert result["branch"] == "main"


@pytest.mark.unit
def test_update_creates_when_missing() -> None:
    mock_repo = MagicMock()
    mock_repo.get_settings.return_value = None

    with patch(_PATCH_GIT_REPO, return_value=mock_repo):
        assert _service().update({"branch": "feature"}) is True
    mock_repo.create.assert_called_once()


@pytest.mark.unit
def test_get_selected_repository_parses_int() -> None:
    mock_meta = MagicMock()
    mock_meta.get_by_key.return_value = SimpleNamespace(value="42")

    with patch(_PATCH_META_REPO, return_value=mock_meta):
        assert _service().get_selected_repository() == 42


@pytest.mark.unit
def test_set_selected_repository() -> None:
    mock_meta = MagicMock()

    with patch(_PATCH_META_REPO, return_value=mock_meta):
        assert _service().set_selected_repository(7) is True

    mock_meta.set_metadata.assert_called_once_with("selected_git_repository", "7")
