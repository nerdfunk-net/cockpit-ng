"""Unit tests for services/settings/cache_settings_service.py.

All tests run offline — CacheSettingRepository is patched per call.
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest

from services.settings.cache_settings_service import CacheSettingsService
from services.settings.defaults import CacheSettings

_PATCH_REPO = "services.settings.cache_settings_service.CacheSettingRepository"
_DEFAULT = CacheSettings()


def _make_service() -> CacheSettingsService:
    return CacheSettingsService(default=_DEFAULT)


# ── get ────────────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_get_returns_db_values_when_settings_exist():
    """get() returns database row values when settings exist."""
    prefetch = json.dumps({"git": True, "locations": False})
    mock_settings = MagicMock(
        enabled=False,
        ttl_seconds=300,
        prefetch_on_startup=False,
        refresh_interval_minutes=30,
        max_commits=100,
        prefetch_items=prefetch,
        devices_cache_interval_minutes=120,
        locations_cache_interval_minutes=20,
        git_commits_cache_interval_minutes=10,
    )
    mock_repo = MagicMock()
    mock_repo.get_settings.return_value = mock_settings

    with patch(_PATCH_REPO, return_value=mock_repo):
        result = _make_service().get()

    assert result["enabled"] is False
    assert result["ttl_seconds"] == 300
    assert result["prefetch_items"] == {"git": True, "locations": False}


@pytest.mark.unit
def test_get_returns_defaults_when_no_settings():
    """get() falls back to defaults when no DB row exists."""
    mock_repo = MagicMock()
    mock_repo.get_settings.return_value = None

    with patch(_PATCH_REPO, return_value=mock_repo):
        result = _make_service().get()

    assert result["enabled"] == _DEFAULT.enabled
    assert result["ttl_seconds"] == _DEFAULT.ttl_seconds


@pytest.mark.unit
def test_get_returns_defaults_on_exception():
    """get() returns defaults when repository raises."""
    mock_repo = MagicMock()
    mock_repo.get_settings.side_effect = RuntimeError("DB offline")

    with patch(_PATCH_REPO, return_value=mock_repo):
        result = _make_service().get()

    assert "enabled" in result


# ── update ─────────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_update_calls_repo_update_when_existing():
    """update() calls repo.update when a settings row already exists."""
    existing = MagicMock(id=1)
    mock_repo = MagicMock()
    mock_repo.get_settings.return_value = existing

    with patch(_PATCH_REPO, return_value=mock_repo):
        result = _make_service().update({"enabled": False, "ttl_seconds": 120})

    assert result is True
    mock_repo.update.assert_called_once()
    mock_repo.create.assert_not_called()


@pytest.mark.unit
def test_update_calls_repo_create_when_no_existing():
    """update() calls repo.create when no row exists."""
    mock_repo = MagicMock()
    mock_repo.get_settings.return_value = None

    with patch(_PATCH_REPO, return_value=mock_repo):
        result = _make_service().update({"enabled": True})

    assert result is True
    mock_repo.create.assert_called_once()
    mock_repo.update.assert_not_called()


@pytest.mark.unit
def test_update_serializes_prefetch_items_to_json():
    """update() serializes prefetch_items dict to JSON string."""
    mock_repo = MagicMock()
    mock_repo.get_settings.return_value = None

    with patch(_PATCH_REPO, return_value=mock_repo):
        _make_service().update({"prefetch_items": {"git": True}})

    call_kwargs = mock_repo.create.call_args.kwargs
    assert isinstance(call_kwargs["prefetch_items"], str)
    assert json.loads(call_kwargs["prefetch_items"]) == {"git": True}


@pytest.mark.unit
def test_update_returns_false_on_exception():
    """update() returns False when repository raises."""
    mock_repo = MagicMock()
    mock_repo.get_settings.side_effect = RuntimeError("DB error")

    with patch(_PATCH_REPO, return_value=mock_repo):
        result = _make_service().update({})

    assert result is False
