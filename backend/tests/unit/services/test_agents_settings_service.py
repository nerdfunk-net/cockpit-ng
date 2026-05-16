"""Unit tests for services/settings/agents_service.py.

All tests run offline — AgentsSettingRepository is patched per call.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from services.settings.agents_service import AgentsSettingsService
from services.settings.defaults import AgentsSettings

_PATCH_REPO = "services.settings.agents_service.AgentsSettingRepository"
_DEFAULT = AgentsSettings()


def _make_service() -> AgentsSettingsService:
    return AgentsSettingsService(default=_DEFAULT)


# ── get ────────────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_get_returns_db_values_when_settings_exist():
    """get() returns database row values when settings exist."""
    mock_settings = MagicMock(
        deployment_method="sftp",
        local_root_path="/data/agents",
        sftp_hostname="sftp.example.com",
        sftp_port=22,
        sftp_path="/upload",
        sftp_username="sftpuser",
        sftp_password="pass",
        use_global_credentials=True,
        global_credential_id=5,
        git_repository_id=3,
        agents=[{"name": "agent1"}],
    )
    mock_repo = MagicMock()
    mock_repo.get_settings.return_value = mock_settings

    with patch(_PATCH_REPO, return_value=mock_repo):
        result = _make_service().get()

    assert result["deployment_method"] == "sftp"
    assert result["sftp_hostname"] == "sftp.example.com"
    assert result["agents"] == [{"name": "agent1"}]


@pytest.mark.unit
def test_get_agents_is_empty_list_when_none():
    """get() returns agents=[] when settings.agents is None."""
    mock_settings = MagicMock(agents=None)
    mock_repo = MagicMock()
    mock_repo.get_settings.return_value = mock_settings

    with patch(_PATCH_REPO, return_value=mock_repo):
        result = _make_service().get()

    assert result["agents"] == []


@pytest.mark.unit
def test_get_returns_defaults_when_no_settings():
    """get() falls back to defaults when no row exists."""
    mock_repo = MagicMock()
    mock_repo.get_settings.return_value = None

    with patch(_PATCH_REPO, return_value=mock_repo):
        result = _make_service().get()

    assert result["deployment_method"] == _DEFAULT.deployment_method
    assert result["agents"] == []


@pytest.mark.unit
def test_get_returns_defaults_on_exception():
    """get() returns defaults when repository raises."""
    mock_repo = MagicMock()
    mock_repo.get_settings.side_effect = RuntimeError("DB offline")

    with patch(_PATCH_REPO, return_value=mock_repo):
        result = _make_service().get()

    assert "deployment_method" in result


# ── update ─────────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_update_calls_repo_update_when_existing():
    """update() calls repo.update when a row already exists."""
    existing = MagicMock(id=1)
    mock_repo = MagicMock()
    mock_repo.get_settings.return_value = existing

    with patch(_PATCH_REPO, return_value=mock_repo):
        result = _make_service().update({"deployment_method": "git"})

    assert result is True
    mock_repo.update.assert_called_once()
    mock_repo.create.assert_not_called()


@pytest.mark.unit
def test_update_calls_repo_create_when_no_existing():
    """update() calls repo.create when no row exists."""
    mock_repo = MagicMock()
    mock_repo.get_settings.return_value = None

    with patch(_PATCH_REPO, return_value=mock_repo):
        result = _make_service().update({"deployment_method": "sftp"})

    assert result is True
    mock_repo.create.assert_called_once()
    mock_repo.update.assert_not_called()


@pytest.mark.unit
def test_update_returns_false_on_exception():
    """update() returns False when repository raises."""
    mock_repo = MagicMock()
    mock_repo.get_settings.side_effect = RuntimeError("DB error")

    with patch(_PATCH_REPO, return_value=mock_repo):
        result = _make_service().update({})

    assert result is False


@pytest.mark.unit
def test_update_agents_defaults_to_empty_list():
    """update() defaults agents to [] when not in payload."""
    mock_repo = MagicMock()
    mock_repo.get_settings.return_value = None

    with patch(_PATCH_REPO, return_value=mock_repo):
        _make_service().update({})

    call_kwargs = mock_repo.create.call_args.kwargs
    assert call_kwargs["agents"] == []
