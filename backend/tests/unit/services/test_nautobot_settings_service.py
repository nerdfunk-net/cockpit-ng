"""Unit tests for services/settings/nautobot_service.py.

All tests run offline — NautobotSettingRepository and NautobotDefaultRepository
are patched per call.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from services.settings.nautobot_service import NautobotSettingsService
from services.settings.defaults import NautobotDefaults, NautobotSettings

_PATCH_SETTING_REPO = "services.settings.nautobot_service.NautobotSettingRepository"
_PATCH_DEFAULT_REPO = "services.settings.nautobot_service.NautobotDefaultRepository"

_DEFAULT_SETTINGS = NautobotSettings()
_DEFAULT_NB_DEFAULTS = NautobotDefaults()


def _make_service() -> NautobotSettingsService:
    return NautobotSettingsService(
        default=_DEFAULT_SETTINGS,
        default_nautobot_defaults=_DEFAULT_NB_DEFAULTS,
    )


# ── get ────────────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_get_returns_db_values_when_settings_exist():
    """get() returns database row values when settings exist."""
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
    """get() falls back to defaults when no DB row exists."""
    mock_repo = MagicMock()
    mock_repo.get_settings.return_value = None

    with patch(_PATCH_SETTING_REPO, return_value=mock_repo):
        result = _make_service().get()

    assert result["url"] == _DEFAULT_SETTINGS.url
    assert result["timeout"] == _DEFAULT_SETTINGS.timeout


@pytest.mark.unit
def test_get_returns_defaults_on_exception():
    """get() returns defaults when the repository raises."""
    mock_repo = MagicMock()
    mock_repo.get_settings.side_effect = RuntimeError("DB offline")

    with patch(_PATCH_SETTING_REPO, return_value=mock_repo):
        result = _make_service().get()

    assert "url" in result


# ── update ─────────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_update_calls_repo_update_when_existing():
    """update() calls repo.update when a settings row already exists."""
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
    """update() calls repo.create when no settings row exists yet."""
    mock_repo = MagicMock()
    mock_repo.get_settings.return_value = None

    with patch(_PATCH_SETTING_REPO, return_value=mock_repo):
        result = _make_service().update({"url": "http://nb.new"})

    assert result is True
    mock_repo.create.assert_called_once()
    mock_repo.update.assert_not_called()


@pytest.mark.unit
def test_update_returns_false_on_exception():
    """update() returns False when the repository raises."""
    mock_repo = MagicMock()
    mock_repo.get_settings.side_effect = Exception("DB error")

    with patch(_PATCH_SETTING_REPO, return_value=mock_repo):
        result = _make_service().update({})

    assert result is False


# ── get_defaults ───────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_get_defaults_returns_db_values_when_exist():
    """get_defaults() returns database row values when defaults exist."""
    mock_settings = MagicMock(
        location="NYC",
        platform="ios",
        interface_status="active",
        device_status="active",
        ip_address_status="active",
        ip_prefix_status="active",
        namespace="Global",
        device_role="router",
        secret_group="default",
        csv_delimiter=",",
        csv_quote_char='"',
    )
    mock_repo = MagicMock()
    mock_repo.get_defaults.return_value = mock_settings

    with patch(_PATCH_DEFAULT_REPO, return_value=mock_repo):
        result = _make_service().get_defaults()

    assert result["location"] == "NYC"
    assert result["platform"] == "ios"
    assert result["namespace"] == "Global"


@pytest.mark.unit
def test_get_defaults_falls_back_when_none():
    """get_defaults() falls back to defaults when no row exists."""
    mock_repo = MagicMock()
    mock_repo.get_defaults.return_value = None

    with patch(_PATCH_DEFAULT_REPO, return_value=mock_repo):
        result = _make_service().get_defaults()

    assert "location" in result
    assert result["csv_delimiter"] == ","


@pytest.mark.unit
def test_update_defaults_creates_when_no_existing():
    """update_defaults() calls repo.create when no row exists."""
    mock_repo = MagicMock()
    mock_repo.get_defaults.return_value = None

    with patch(_PATCH_DEFAULT_REPO, return_value=mock_repo):
        result = _make_service().update_defaults({"location": "Berlin"})

    assert result is True
    mock_repo.create.assert_called_once()


@pytest.mark.unit
def test_update_defaults_updates_when_existing():
    """update_defaults() calls repo.update when a row already exists."""
    existing = MagicMock(id=1)
    mock_repo = MagicMock()
    mock_repo.get_defaults.return_value = existing

    with patch(_PATCH_DEFAULT_REPO, return_value=mock_repo):
        result = _make_service().update_defaults({"location": "Paris"})

    assert result is True
    mock_repo.update.assert_called_once()
    mock_repo.create.assert_not_called()


@pytest.mark.unit
def test_update_defaults_returns_false_on_exception():
    """update_defaults() returns False when the repository raises."""
    mock_repo = MagicMock()
    mock_repo.get_defaults.side_effect = RuntimeError("DB error")

    with patch(_PATCH_DEFAULT_REPO, return_value=mock_repo):
        result = _make_service().update_defaults({})

    assert result is False
