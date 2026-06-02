"""Unit tests for services/servers/servers_service.py.

All tests run offline — repository is injected via DI.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from models.servers import CreateServerRequest, UpdateServerRequest
from services.servers.servers_service import ServersService


def _make_service() -> tuple[ServersService, MagicMock]:
    mock_repo = MagicMock()
    return ServersService(repository=mock_repo), mock_repo


def _server(**kwargs: object) -> SimpleNamespace:
    defaults: dict = {
        "id": 1,
        "hostname": "web01",
        "location": None,
        "cluster": None,
        "distribution_release": None,
        "distribution_version": None,
        "contact": None,
        "is_virtual": False,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


# ── Delegation ─────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_list_summaries_delegates_to_repo() -> None:
    """list_summaries forwards search to the repository."""
    svc, mock_repo = _make_service()
    mock_repo.list_summaries.return_value = [_server()]

    result = svc.list_summaries(search="web")

    mock_repo.list_summaries.assert_called_once_with(search="web")
    assert len(result) == 1


@pytest.mark.unit
def test_list_summaries_without_search() -> None:
    """list_summaries with no search passes None to the repository."""
    svc, mock_repo = _make_service()
    mock_repo.list_summaries.return_value = []

    svc.list_summaries()

    mock_repo.list_summaries.assert_called_once_with(search=None)


@pytest.mark.unit
def test_count_all_delegates_to_repo() -> None:
    """count_all returns the repository count."""
    svc, mock_repo = _make_service()
    mock_repo.count_all.return_value = 42

    assert svc.count_all() == 42


@pytest.mark.unit
def test_get_by_id_delegates_to_repo() -> None:
    """get_by_id returns the repository result."""
    svc, mock_repo = _make_service()
    row = _server(id=7)
    mock_repo.get_by_id.return_value = row

    assert svc.get_by_id(7) is row
    mock_repo.get_by_id.assert_called_once_with(7)


@pytest.mark.unit
def test_get_all_delegates_to_repo() -> None:
    """get_all returns all servers from the repository."""
    svc, mock_repo = _make_service()
    mock_repo.get_all.return_value = [_server(), _server(id=2, hostname="db01")]

    assert len(svc.get_all()) == 2


@pytest.mark.unit
def test_delete_delegates_to_repo() -> None:
    """delete returns the repository boolean."""
    svc, mock_repo = _make_service()
    mock_repo.delete.return_value = True

    assert svc.delete(3) is True
    mock_repo.delete.assert_called_once_with(3)


# ── create ─────────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_create_passes_dumped_fields_to_repo() -> None:
    """create persists model fields via repository.create."""
    svc, mock_repo = _make_service()
    mock_repo.create.return_value = _server(hostname="new-host")

    data = CreateServerRequest(
        hostname="new-host",
        primary_ipv4="10.0.0.1",
        is_virtual=True,
    )
    svc.create(data)

    mock_repo.create.assert_called_once()
    kwargs = mock_repo.create.call_args.kwargs
    assert kwargs["hostname"] == "new-host"
    assert kwargs["primary_ipv4"] == "10.0.0.1"
    assert kwargs["is_virtual"] is True


@pytest.mark.unit
def test_create_infers_is_virtual_from_ansible_facts_guest() -> None:
    """When is_virtual is omitted and facts say guest, is_virtual becomes True."""
    svc, mock_repo = _make_service()
    mock_repo.create.return_value = _server()

    data = CreateServerRequest(
        hostname="vm01",
        ansible_facts={"ansible_virtualization_role": "guest"},
    )
    svc.create(data)

    assert mock_repo.create.call_args.kwargs["is_virtual"] is True


@pytest.mark.unit
def test_create_infers_is_virtual_false_when_not_guest() -> None:
    """When is_virtual is omitted and facts are not guest, is_virtual is False."""
    svc, mock_repo = _make_service()
    mock_repo.create.return_value = _server()

    data = CreateServerRequest(
        hostname="bare01",
        ansible_facts={"ansible_virtualization_role": "host"},
    )
    svc.create(data)

    assert mock_repo.create.call_args.kwargs["is_virtual"] is False


@pytest.mark.unit
def test_create_infers_is_virtual_false_without_facts() -> None:
    """When is_virtual and ansible_facts are absent, is_virtual defaults to False."""
    svc, mock_repo = _make_service()
    mock_repo.create.return_value = _server()

    svc.create(CreateServerRequest(hostname="bare02"))

    assert mock_repo.create.call_args.kwargs["is_virtual"] is False


@pytest.mark.unit
def test_create_respects_explicit_is_virtual_over_facts() -> None:
    """Explicit is_virtual is not overridden by ansible_facts."""
    svc, mock_repo = _make_service()
    mock_repo.create.return_value = _server()

    data = CreateServerRequest(
        hostname="vm02",
        is_virtual=False,
        ansible_facts={"ansible_virtualization_role": "guest"},
    )
    svc.create(data)

    assert mock_repo.create.call_args.kwargs["is_virtual"] is False


# ── update ─────────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_update_passes_only_set_fields() -> None:
    """update sends exclude_unset fields to the repository."""
    svc, mock_repo = _make_service()
    contact = {"id": "13b79fe1-264f-40a3-91ed-9e93dd45a5d4", "name": "Team Ops"}
    mock_repo.update.return_value = _server(contact=contact)

    data = UpdateServerRequest(contact=contact)
    result = svc.update(1, data)

    mock_repo.update.assert_called_once_with(1, contact=contact)
    assert result is not None


@pytest.mark.unit
def test_update_returns_none_when_not_found() -> None:
    """update propagates None when the repository finds no row."""
    svc, mock_repo = _make_service()
    mock_repo.update.return_value = None

    result = svc.update(99, UpdateServerRequest(hostname="missing"))

    assert result is None


# ── get_grouped ────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_get_grouped_by_location_name() -> None:
    """location dicts are grouped by their name field."""
    svc, mock_repo = _make_service()
    mock_repo.get_all.return_value = [
        _server(id=1, hostname="a", location={"id": "1", "name": "NYC"}),
        _server(id=2, hostname="b", location={"id": "2", "name": "NYC"}),
        _server(id=3, hostname="c", location={"id": "3", "name": "Berlin"}),
    ]

    groups = svc.get_grouped("location")

    assert set(groups.keys()) == {"Berlin", "NYC"}
    assert len(groups["NYC"]) == 2
    assert len(groups["Berlin"]) == 1


@pytest.mark.unit
def test_get_grouped_location_without_name_is_uncategorized() -> None:
    """location dicts missing name land in Uncategorized."""
    svc, mock_repo = _make_service()
    mock_repo.get_all.return_value = [
        _server(id=1, hostname="a", location={"id": "1"}),
    ]

    groups = svc.get_grouped("location")

    assert list(groups.keys()) == ["Uncategorized"]


@pytest.mark.unit
def test_get_grouped_by_scalar_field() -> None:
    """String fields are grouped by their string value."""
    svc, mock_repo = _make_service()
    mock_repo.get_all.return_value = [
        _server(
            id=1,
            hostname="a",
            contact={"id": "13b79fe1-264f-40a3-91ed-9e93dd45a5d4", "name": "team-a"},
        ),
        _server(
            id=2,
            hostname="b",
            contact={"id": "13b79fe1-264f-40a3-91ed-9e93dd45a5d4", "name": "team-a"},
        ),
        _server(id=3, hostname="c", contact=None),
    ]

    groups = svc.get_grouped("contact")

    assert groups["team-a"][0].hostname == "a"
    assert groups["Uncategorized"][0].hostname == "c"


@pytest.mark.unit
def test_get_grouped_invalid_field_raises() -> None:
    """Unknown group_by values raise ValueError."""
    svc, mock_repo = _make_service()

    with pytest.raises(ValueError, match="group_by must be one of"):
        svc.get_grouped("hostname")


@pytest.mark.unit
def test_get_grouped_returns_sorted_keys() -> None:
    """Grouped result keys are sorted alphabetically."""
    svc, mock_repo = _make_service()
    mock_repo.get_all.return_value = [
        _server(id=1, hostname="z", distribution_release="22.04"),
        _server(id=2, hostname="a", distribution_release="20.04"),
    ]

    groups = svc.get_grouped("distribution_release")

    assert list(groups.keys()) == ["20.04", "22.04"]
