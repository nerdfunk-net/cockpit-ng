"""Unit tests for services/settings/nautobot_service.py."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from services.settings.defaults import NautobotSettings
from services.settings.nautobot_service import NautobotSettingsService

_PATCH_SETTING_REPO = "services.settings.nautobot_service.NautobotSettingRepository"

_DEFAULT_SETTINGS = NautobotSettings()


def _make_service() -> NautobotSettingsService:
    return NautobotSettingsService(default=_DEFAULT_SETTINGS)


@pytest.mark.unit
def test_get_returns_db_values_when_settings_exist():
    mock_settings = MagicMock(
        url="http://nautobot.local",
        token="abc123",
        timeout=60,
        verify_ssl=False,
    )
    mock_repo = MagicMock()
    mock_repo.get_settings.return_value = mock_settings

    with patch(_PATCH_SETTING_REPO, return_value=mock_repo):
        result = _make_service().get()

    assert result["url"] == "http://nautobot.local"
    assert result["token"] == "abc123"
    assert result["timeout"] == 60
    assert result["verify_ssl"] is False


@pytest.mark.unit
def test_get_returns_defaults_when_no_settings():
    mock_repo = MagicMock()
    mock_repo.get_settings.return_value = None

    with patch(_PATCH_SETTING_REPO, return_value=mock_repo):
        result = _make_service().get()

    assert result["url"] == _DEFAULT_SETTINGS.url
    assert result["timeout"] == _DEFAULT_SETTINGS.timeout


@pytest.mark.unit
def test_get_returns_defaults_on_exception():
    mock_repo = MagicMock()
    mock_repo.get_settings.side_effect = RuntimeError("DB offline")

    with patch(_PATCH_SETTING_REPO, return_value=mock_repo):
        result = _make_service().get()

    assert "url" in result


@pytest.mark.unit
def test_update_calls_repo_update_when_existing():
    existing = MagicMock(id=1)
    mock_repo = MagicMock()
    mock_repo.get_settings.return_value = existing

    with patch(_PATCH_SETTING_REPO, return_value=mock_repo):
        result = _make_service().update({"url": "http://nb.new", "token": "tok"})

    assert result is True
    mock_repo.update.assert_called_once()
    mock_repo.create.assert_not_called()


@pytest.mark.unit
def test_update_calls_repo_create_when_no_existing():
    mock_repo = MagicMock()
    mock_repo.get_settings.return_value = None

    with patch(_PATCH_SETTING_REPO, return_value=mock_repo):
        result = _make_service().update({"url": "http://nb.new"})

    assert result is True
    mock_repo.create.assert_called_once()
    mock_repo.update.assert_not_called()


@pytest.mark.unit
def test_update_returns_false_on_exception():
    mock_repo = MagicMock()
    mock_repo.get_settings.side_effect = Exception("DB error")

    with patch(_PATCH_SETTING_REPO, return_value=mock_repo):
        result = _make_service().update({})

    assert result is False
