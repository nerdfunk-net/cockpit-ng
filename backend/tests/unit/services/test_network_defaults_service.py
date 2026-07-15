"""Unit tests for services/settings/network_defaults_service.py."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from services.settings.defaults import NetworkDefaults
from services.settings.network_defaults_service import NetworkDefaultsService

_PATCH_PROFILE_REPO = "services.settings.network_defaults_service.ProfileRepository"

_DEFAULT_NETWORK_DEFAULTS = NetworkDefaults()


def _make_service() -> NetworkDefaultsService:
    return NetworkDefaultsService(default=_DEFAULT_NETWORK_DEFAULTS)


@pytest.mark.unit
def test_get_returns_db_values_when_exist():
    mock_profile = MagicMock(
        location="NYC",
        platform="ios",
        interface_status="active",
        interface_type="1000base-t",
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
    mock_repo.get_by_built_in_key.return_value = mock_profile

    with patch(_PATCH_PROFILE_REPO, return_value=mock_repo):
        result = _make_service().get()

    mock_repo.get_by_built_in_key.assert_called_once_with("network")
    assert result["location"] == "NYC"
    assert result["platform"] == "ios"
    assert result["namespace"] == "Global"
    assert result["interface_type"] == "1000base-t"


@pytest.mark.unit
def test_get_falls_back_when_none():
    mock_repo = MagicMock()
    mock_repo.get_by_built_in_key.return_value = None

    with patch(_PATCH_PROFILE_REPO, return_value=mock_repo):
        result = _make_service().get()

    assert "location" in result
    assert result["csv_delimiter"] == ","


@pytest.mark.unit
def test_update_creates_when_no_existing():
    mock_repo = MagicMock()
    mock_repo.get_by_built_in_key.return_value = None

    with patch(_PATCH_PROFILE_REPO, return_value=mock_repo):
        result = _make_service().update({"location": "Berlin"})

    assert result is True
    mock_repo.create.assert_called_once()
    assert mock_repo.create.call_args.kwargs["built_in_key"] == "network"
    assert mock_repo.create.call_args.kwargs["name"] == "Network"


@pytest.mark.unit
def test_update_passes_interface_type_through():
    mock_repo = MagicMock()
    mock_repo.get_by_built_in_key.return_value = None

    with patch(_PATCH_PROFILE_REPO, return_value=mock_repo):
        result = _make_service().update({"interface_type": "1000base-t"})

    assert result is True
    assert mock_repo.create.call_args.kwargs["interface_type"] == "1000base-t"


@pytest.mark.unit
def test_update_updates_when_existing():
    existing = MagicMock(id=1)
    mock_repo = MagicMock()
    mock_repo.get_by_built_in_key.return_value = existing

    with patch(_PATCH_PROFILE_REPO, return_value=mock_repo):
        result = _make_service().update({"location": "Paris"})

    assert result is True
    mock_repo.update.assert_called_once()
    assert mock_repo.update.call_args.args[0] == 1
    mock_repo.create.assert_not_called()


@pytest.mark.unit
def test_update_returns_false_on_exception():
    mock_repo = MagicMock()
    mock_repo.get_by_built_in_key.side_effect = RuntimeError("DB error")

    with patch(_PATCH_PROFILE_REPO, return_value=mock_repo):
        result = _make_service().update({})

    assert result is False
