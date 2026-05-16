"""Unit tests for services/settings/system_service.py.

All tests run offline — all repositories are patched.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from services.settings.system_service import SystemSettingsService

_PATCH_NAUTOBOT_REPO = "services.settings.system_service.NautobotSettingRepository"
_PATCH_GIT_REPO = "services.settings.system_service.GitSettingRepository"
_PATCH_METADATA_REPO = "services.settings.system_service.SettingsMetadataRepository"


def _make_service() -> SystemSettingsService:
    return SystemSettingsService()


# ── health_check ───────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_health_check_returns_healthy():
    """health_check() returns status=healthy when repos respond."""
    mock_nb_repo = MagicMock()
    mock_nb_repo.get_settings.return_value = MagicMock()
    mock_git_repo = MagicMock()
    mock_git_repo.get_settings.return_value = None

    with (
        patch(_PATCH_NAUTOBOT_REPO, return_value=mock_nb_repo),
        patch(_PATCH_GIT_REPO, return_value=mock_git_repo),
    ):
        result = _make_service().health_check()

    assert result["status"] == "healthy"
    assert result["nautobot_settings_count"] == 1
    assert result["git_settings_count"] == 0


@pytest.mark.unit
def test_health_check_returns_unhealthy_on_exception():
    """health_check() returns status=unhealthy when a repo raises."""
    mock_nb_repo = MagicMock()
    mock_nb_repo.get_settings.side_effect = RuntimeError("DB offline")

    with patch(_PATCH_NAUTOBOT_REPO, return_value=mock_nb_repo):
        result = _make_service().health_check()

    assert result["status"] == "unhealthy"


@pytest.mark.unit
def test_health_check_includes_database_type():
    """health_check() always includes database_type='postgresql'."""
    mock_nb_repo = MagicMock()
    mock_nb_repo.get_settings.return_value = None
    mock_git_repo = MagicMock()
    mock_git_repo.get_settings.return_value = None

    with (
        patch(_PATCH_NAUTOBOT_REPO, return_value=mock_nb_repo),
        patch(_PATCH_GIT_REPO, return_value=mock_git_repo),
    ):
        result = _make_service().health_check()

    assert result["database_type"] == "postgresql"


# ── get_metadata ───────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_get_metadata_returns_schema_version():
    """get_metadata() returns schema_version from the metadata row."""
    mock_entry = MagicMock(value="2.1")
    mock_repo = MagicMock()
    mock_repo.get_by_key.return_value = mock_entry

    with patch(_PATCH_METADATA_REPO, return_value=mock_repo):
        result = _make_service().get_metadata()

    assert result["schema_version"] == "2.1"


@pytest.mark.unit
def test_get_metadata_defaults_schema_version_when_missing():
    """get_metadata() defaults to '1.0' when schema_version row is missing."""
    mock_repo = MagicMock()
    mock_repo.get_by_key.return_value = None

    with patch(_PATCH_METADATA_REPO, return_value=mock_repo):
        result = _make_service().get_metadata()

    assert result["schema_version"] == "1.0"


@pytest.mark.unit
def test_get_metadata_returns_error_on_exception():
    """get_metadata() returns error dict when repo raises."""
    mock_repo = MagicMock()
    mock_repo.get_by_key.side_effect = RuntimeError("DB error")

    with patch(_PATCH_METADATA_REPO, return_value=mock_repo):
        result = _make_service().get_metadata()

    assert "error" in result
