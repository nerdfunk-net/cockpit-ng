"""Unit tests for services/settings/checkmk_service.py.

All tests run offline — CheckMKSettingRepository is patched per call.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from services.settings.checkmk_service import CheckMKSettingsService
from services.settings.defaults import CheckMKSettings

_PATCH_REPO = "services.settings.checkmk_service.CheckMKSettingRepository"
_DEFAULT = CheckMKSettings(url="", site="", username="", password="", verify_ssl=True)


def _make_service() -> CheckMKSettingsService:
    return CheckMKSettingsService(default=_DEFAULT)


# ── get ────────────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_get_returns_db_values_when_settings_exist():
    """get() returns values from the database row when one exists."""
    mock_settings = MagicMock(
        url="http://cmk.local",
        site="prod",
        username="automation",
        password="secret",
        verify_ssl=False,
    )
    mock_repo = MagicMock()
    mock_repo.get_settings.return_value = mock_settings

    with patch(_PATCH_REPO, return_value=mock_repo):
        result = _make_service().get()

    assert result["url"] == "http://cmk.local"
    assert result["site"] == "prod"
    assert result["username"] == "automation"
    assert result["verify_ssl"] is False


@pytest.mark.unit
def test_get_returns_defaults_when_no_settings():
    """get() falls back to defaults when no DB row exists."""
    mock_repo = MagicMock()
    mock_repo.get_settings.return_value = None

    with patch(_PATCH_REPO, return_value=mock_repo):
        result = _make_service().get()

    assert result["url"] == _DEFAULT.url
    assert result["verify_ssl"] == _DEFAULT.verify_ssl


@pytest.mark.unit
def test_get_returns_defaults_on_repo_exception():
    """get() returns defaults when the repository raises."""
    mock_repo = MagicMock()
    mock_repo.get_settings.side_effect = Exception("DB offline")

    with patch(_PATCH_REPO, return_value=mock_repo):
        result = _make_service().get()

    assert "url" in result


# ── update ─────────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_update_calls_repo_update_when_existing():
    """update() calls repo.update when a settings row already exists."""
    existing = MagicMock(id=1)
    mock_repo = MagicMock()
    mock_repo.get_settings.return_value = existing

    with patch(_PATCH_REPO, return_value=mock_repo):
        result = _make_service().update({"url": "http://new.cmk", "site": "dev"})

    assert result is True
    mock_repo.update.assert_called_once()
    mock_repo.create.assert_not_called()


@pytest.mark.unit
def test_update_calls_repo_create_when_no_existing():
    """update() calls repo.create when no settings row exists yet."""
    mock_repo = MagicMock()
    mock_repo.get_settings.return_value = None

    with patch(_PATCH_REPO, return_value=mock_repo):
        result = _make_service().update({"url": "http://cmk.new"})

    assert result is True
    mock_repo.create.assert_called_once()
    mock_repo.update.assert_not_called()


@pytest.mark.unit
def test_update_returns_false_on_exception():
    """update() returns False when the repository raises."""
    mock_repo = MagicMock()
    mock_repo.get_settings.side_effect = Exception("DB error")

    with patch(_PATCH_REPO, return_value=mock_repo):
        result = _make_service().update({"url": "http://cmk"})

    assert result is False


@pytest.mark.unit
def test_update_uses_defaults_for_missing_keys():
    """update() fills missing data keys with the service defaults."""
    existing = MagicMock(id=1)
    mock_repo = MagicMock()
    mock_repo.get_settings.return_value = existing

    with patch(_PATCH_REPO, return_value=mock_repo):
        _make_service().update({})  # empty payload

    call_kwargs = mock_repo.update.call_args.kwargs
    assert call_kwargs["url"] == _DEFAULT.url
    assert call_kwargs["verify_ssl"] == _DEFAULT.verify_ssl
