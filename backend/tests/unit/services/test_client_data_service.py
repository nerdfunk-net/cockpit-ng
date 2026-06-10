"""Unit tests for services/clients/client_data_service.py.

All tests run offline — repository is injected via DI.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from services.clients.client_data_service import ClientDataService


def _make_service() -> tuple[ClientDataService, MagicMock]:
    mock_repo = MagicMock()
    return ClientDataService(repository=mock_repo), mock_repo


# ── get_device_names ───────────────────────────────────────────────────────────


@pytest.mark.unit
def test_get_device_names_delegates_to_repo():
    """get_device_names calls repository.get_device_names."""
    svc, mock_repo = _make_service()
    mock_repo.get_device_names.return_value = ["router1", "switch1"]
    result = svc.get_device_names()
    mock_repo.get_device_names.assert_called_once()
    assert result == ["router1", "switch1"]


@pytest.mark.unit
def test_get_device_names_empty():
    """Empty list from repo is returned as-is."""
    svc, mock_repo = _make_service()
    mock_repo.get_device_names.return_value = []
    assert svc.get_device_names() == []


# ── get_client_data ────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_get_client_data_delegates_all_filters():
    """All filter kwargs are forwarded to repository.get_client_data."""
    svc, mock_repo = _make_service()
    mock_repo.get_client_data.return_value = ([], 0)

    svc.get_client_data(
        device_name="router1",
        ip_address="10.0.0.1",
        mac_address="aa:bb:cc:dd:ee:ff",
        port="eth0",
        vlan="100",
        hostname="myhost",
        page=2,
        page_size=25,
    )

    mock_repo.get_client_data.assert_called_once_with(
        device_name="router1",
        ip_address="10.0.0.1",
        mac_address="aa:bb:cc:dd:ee:ff",
        port="eth0",
        vlan="100",
        vrf=None,
        hostname="myhost",
        page=2,
        page_size=25,
    )


@pytest.mark.unit
def test_get_client_data_returns_tuple():
    """Return value is the (items, total) tuple from the repository."""
    svc, mock_repo = _make_service()
    mock_repo.get_client_data.return_value = ([{"ip": "1.2.3.4"}], 1)
    items, total = svc.get_client_data()
    assert total == 1
    assert items[0]["ip"] == "1.2.3.4"


@pytest.mark.unit
def test_get_client_data_defaults():
    """Calling with no args uses default page=1, page_size=50."""
    svc, mock_repo = _make_service()
    mock_repo.get_client_data.return_value = ([], 0)
    svc.get_client_data()
    call_kwargs = mock_repo.get_client_data.call_args.kwargs
    assert call_kwargs["page"] == 1
    assert call_kwargs["page_size"] == 50


# ── get_client_history ─────────────────────────────────────────────────────────


@pytest.mark.unit
def test_get_client_history_delegates_to_repo():
    """get_client_history calls repository.get_client_history with all filters."""
    svc, mock_repo = _make_service()
    mock_repo.get_client_history.return_value = {"entries": []}

    svc.get_client_history(
        ip_address="10.0.0.1",
        mac_address="aa:bb:cc:dd:ee:ff",
        hostname="myhost",
    )

    mock_repo.get_client_history.assert_called_once_with(
        ip_address="10.0.0.1",
        mac_address="aa:bb:cc:dd:ee:ff",
        hostname="myhost",
    )


@pytest.mark.unit
def test_get_client_history_returns_repo_value():
    """Return value from repository is forwarded unchanged."""
    svc, mock_repo = _make_service()
    mock_repo.get_client_history.return_value = {"entries": [{"ts": "2024-01-01"}]}
    result = svc.get_client_history(ip_address="10.0.0.1")
    assert result["entries"][0]["ts"] == "2024-01-01"
