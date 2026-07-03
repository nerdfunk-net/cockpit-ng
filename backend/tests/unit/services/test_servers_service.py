"""Unit tests for services/servers/servers_service.py.

All tests run offline — repository is injected via DI.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from models.servers import CreateServerRequest, UpdateServerRequest
from services.servers.servers_service import ServersService


def _make_service() -> tuple[ServersService, MagicMock, MagicMock]:
    mock_repo = MagicMock()
    mock_history_repo = MagicMock()
    return (
        ServersService(
            repository=mock_repo,
            history_repository=mock_history_repo,
            open_ports_history_repository=MagicMock(),
        ),
        mock_repo,
        mock_history_repo,
    )


def _make_service_with_ports() -> tuple[
    ServersService, MagicMock, MagicMock, MagicMock
]:
    mock_repo = MagicMock()
    mock_history_repo = MagicMock()
    mock_open_ports_history_repo = MagicMock()
    return (
        ServersService(
            repository=mock_repo,
            history_repository=mock_history_repo,
            open_ports_history_repository=mock_open_ports_history_repo,
        ),
        mock_repo,
        mock_history_repo,
        mock_open_ports_history_repo,
    )


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
        "ansible_facts": None,
        "open_ports": None,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


# ── Delegation ─────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_list_summaries_delegates_to_repo() -> None:
    """list_summaries forwards search to the repository."""
    svc, mock_repo, _ = _make_service()
    mock_repo.list_summaries.return_value = [_server()]

    result = svc.list_summaries(search="web")

    mock_repo.list_summaries.assert_called_once_with(search="web")
    assert len(result) == 1


@pytest.mark.unit
def test_list_summaries_without_search() -> None:
    """list_summaries with no search passes None to the repository."""
    svc, mock_repo, _ = _make_service()
    mock_repo.list_summaries.return_value = []

    svc.list_summaries()

    mock_repo.list_summaries.assert_called_once_with(search=None)


@pytest.mark.unit
def test_count_all_delegates_to_repo() -> None:
    """count_all returns the repository count."""
    svc, mock_repo, _ = _make_service()
    mock_repo.count_all.return_value = 42

    assert svc.count_all() == 42


@pytest.mark.unit
def test_get_by_id_delegates_to_repo() -> None:
    """get_by_id returns the repository result."""
    svc, mock_repo, _ = _make_service()
    row = _server(id=7)
    mock_repo.get_by_id.return_value = row

    assert svc.get_by_id(7) is row
    mock_repo.get_by_id.assert_called_once_with(7)


@pytest.mark.unit
def test_get_all_delegates_to_repo() -> None:
    """get_all returns all servers from the repository."""
    svc, mock_repo, _ = _make_service()
    mock_repo.get_all.return_value = [_server(), _server(id=2, hostname="db01")]

    assert len(svc.get_all()) == 2


@pytest.mark.unit
def test_delete_delegates_to_repo() -> None:
    """delete returns the repository boolean."""
    svc, mock_repo, _ = _make_service()
    mock_repo.delete.return_value = True

    assert svc.delete(3) is True
    mock_repo.delete.assert_called_once_with(3)


# ── create ─────────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_create_passes_dumped_fields_to_repo() -> None:
    """create persists model fields via repository.create."""
    svc, mock_repo, _ = _make_service()
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
    svc, mock_repo, _ = _make_service()
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
    svc, mock_repo, _ = _make_service()
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
    svc, mock_repo, _ = _make_service()
    mock_repo.create.return_value = _server()

    svc.create(CreateServerRequest(hostname="bare02"))

    assert mock_repo.create.call_args.kwargs["is_virtual"] is False


@pytest.mark.unit
def test_create_respects_explicit_is_virtual_over_facts() -> None:
    """Explicit is_virtual is not overridden by ansible_facts."""
    svc, mock_repo, _ = _make_service()
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
    svc, mock_repo, _ = _make_service()
    contact = [
        {
            "id": "13b79fe1-264f-40a3-91ed-9e93dd45a5d4",
            "name": "Team Ops",
            "role": {
                "id": "866298d0-d942-440b-9c89-8b3e9eb81f79",
                "name": "Administrative",
            },
        }
    ]
    mock_repo.update.return_value = _server(contact=contact)

    data = UpdateServerRequest(contact=contact)
    result = svc.update(1, data)

    mock_repo.update.assert_called_once_with(1, contact=contact)
    assert result is not None


@pytest.mark.unit
def test_update_returns_none_when_not_found() -> None:
    """update propagates None when the repository finds no row."""
    svc, mock_repo, _ = _make_service()
    mock_repo.update.return_value = None

    result = svc.update(99, UpdateServerRequest(hostname="missing"))

    assert result is None


# ── get_grouped ────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_get_grouped_by_location_name() -> None:
    """location dicts are grouped by their name field."""
    svc, mock_repo, _ = _make_service()
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
    svc, mock_repo, _ = _make_service()
    mock_repo.get_all.return_value = [
        _server(id=1, hostname="a", location={"id": "1"}),
    ]

    groups = svc.get_grouped("location")

    assert list(groups.keys()) == ["Uncategorized"]


@pytest.mark.unit
def test_get_grouped_by_scalar_field() -> None:
    """String fields are grouped by their string value."""
    svc, mock_repo, _ = _make_service()
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
def test_get_grouped_contact_array_uses_first_name() -> None:
    """contact arrays are grouped by the first entry's name."""
    svc, mock_repo, _ = _make_service()
    mock_repo.get_all.return_value = [
        _server(
            id=1,
            hostname="a",
            contact=[
                {"id": "13b79fe1-264f-40a3-91ed-9e93dd45a5d4", "name": "primary"},
                {"id": "a13b79fe-264f-40a3-91ed-9e93dd45a5d5", "name": "secondary"},
            ],
        ),
        _server(id=2, hostname="b", contact=[]),
    ]

    groups = svc.get_grouped("contact")

    assert groups["primary"][0].hostname == "a"
    assert groups["Uncategorized"][0].hostname == "b"


@pytest.mark.unit
def test_get_grouped_invalid_field_raises() -> None:
    """Unknown group_by values raise ValueError."""
    svc, mock_repo, _ = _make_service()

    with pytest.raises(ValueError, match="group_by must be one of"):
        svc.get_grouped("hostname")


@pytest.mark.unit
def test_get_grouped_returns_sorted_keys() -> None:
    """Grouped result keys are sorted alphabetically."""
    svc, mock_repo, _ = _make_service()
    mock_repo.get_all.return_value = [
        _server(id=1, hostname="z", distribution_release="22.04"),
        _server(id=2, hostname="a", distribution_release="20.04"),
    ]

    groups = svc.get_grouped("distribution_release")

    assert list(groups.keys()) == ["20.04", "22.04"]


# ── facts history ────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_create_with_ansible_facts_records_history() -> None:
    """create() writes an initial history row when ansible_facts is provided."""
    svc, mock_repo, mock_history_repo = _make_service()
    mock_repo.create.return_value = _server(id=5)

    data = CreateServerRequest(
        hostname="vm01", ansible_facts={"ansible_hostname": "vm01"}
    )
    svc.create(data)

    mock_history_repo.create.assert_called_once()
    kwargs = mock_history_repo.create.call_args.kwargs
    assert kwargs["server_id"] == 5
    assert kwargs["ansible_facts"] == {"ansible_hostname": "vm01"}
    assert isinstance(kwargs["content_hash"], str)


@pytest.mark.unit
def test_create_without_ansible_facts_skips_history() -> None:
    """create() does not write a history row when no facts are supplied."""
    svc, mock_repo, mock_history_repo = _make_service()
    mock_repo.create.return_value = _server(id=6)

    svc.create(CreateServerRequest(hostname="bare01"))

    mock_history_repo.create.assert_not_called()


@pytest.mark.unit
def test_update_with_changed_facts_records_history() -> None:
    """update() writes a history row when ansible_facts differs from the stored value."""
    svc, mock_repo, mock_history_repo = _make_service()
    mock_repo.get_by_id.return_value = _server(
        id=1, ansible_facts={"ansible_hostname": "old"}
    )
    mock_repo.update.return_value = _server(
        id=1, ansible_facts={"ansible_hostname": "new"}
    )

    data = UpdateServerRequest(ansible_facts={"ansible_hostname": "new"})
    svc.update(1, data)

    mock_history_repo.create.assert_called_once()
    kwargs = mock_history_repo.create.call_args.kwargs
    assert kwargs["server_id"] == 1
    assert kwargs["ansible_facts"] == {"ansible_hostname": "new"}


@pytest.mark.unit
def test_update_with_unchanged_facts_skips_history() -> None:
    """update() does not write a history row when facts are byte-identical."""
    svc, mock_repo, mock_history_repo = _make_service()
    same_facts = {"ansible_hostname": "same"}
    mock_repo.get_by_id.return_value = _server(id=1, ansible_facts=same_facts)
    mock_repo.update.return_value = _server(id=1, ansible_facts=same_facts)

    data = UpdateServerRequest(ansible_facts=same_facts)
    svc.update(1, data)

    mock_history_repo.create.assert_not_called()


@pytest.mark.unit
def test_update_without_ansible_facts_field_skips_history() -> None:
    """update() does not touch history when ansible_facts is not part of the request."""
    svc, mock_repo, mock_history_repo = _make_service()
    mock_repo.update.return_value = _server(id=1, hostname="renamed")

    svc.update(1, UpdateServerRequest(hostname="renamed"))

    mock_repo.get_by_id.assert_not_called()
    mock_history_repo.create.assert_not_called()


@pytest.mark.unit
def test_update_when_repo_update_fails_skips_history() -> None:
    """No history row is written if the underlying update did not find the server."""
    svc, mock_repo, mock_history_repo = _make_service()
    mock_repo.get_by_id.return_value = _server(id=1, ansible_facts={"a": 1})
    mock_repo.update.return_value = None

    data = UpdateServerRequest(ansible_facts={"a": 2})
    result = svc.update(1, data)

    assert result is None
    mock_history_repo.create.assert_not_called()


@pytest.mark.unit
def test_get_facts_history_delegates_to_history_repo() -> None:
    """get_facts_history forwards to the history repository."""
    svc, mock_repo, mock_history_repo = _make_service()
    mock_history_repo.get_by_server_id.return_value = ["entry1", "entry2"]

    result = svc.get_facts_history(1)

    mock_history_repo.get_by_server_id.assert_called_once_with(1)
    assert result == ["entry1", "entry2"]


@pytest.mark.unit
def test_get_facts_history_entry_delegates_to_history_repo() -> None:
    """get_facts_history_entry forwards to the history repository, scoped by server."""
    svc, mock_repo, mock_history_repo = _make_service()
    mock_history_repo.get_by_id_scoped.return_value = "entry"

    result = svc.get_facts_history_entry(1, 42)

    mock_history_repo.get_by_id_scoped.assert_called_once_with(1, 42)
    assert result == "entry"


# ── open ports history ───────────────────────────────────────────────────────


@pytest.mark.unit
def test_create_with_open_ports_records_history() -> None:
    """create() writes an initial history row when open_ports is provided."""
    svc, mock_repo, _, mock_ports_history_repo = _make_service_with_ports()
    mock_repo.create.return_value = _server(id=5)

    data = CreateServerRequest(hostname="vm01", open_ports={"tcp_ports": [22]})
    svc.create(data)

    mock_ports_history_repo.create.assert_called_once()
    kwargs = mock_ports_history_repo.create.call_args.kwargs
    assert kwargs["server_id"] == 5
    assert kwargs["open_ports"] == {"tcp_ports": [22]}
    assert isinstance(kwargs["content_hash"], str)


@pytest.mark.unit
def test_create_without_open_ports_skips_history() -> None:
    """create() does not write a ports history row when no open_ports is supplied."""
    svc, mock_repo, _, mock_ports_history_repo = _make_service_with_ports()
    mock_repo.create.return_value = _server(id=6)

    svc.create(CreateServerRequest(hostname="bare01"))

    mock_ports_history_repo.create.assert_not_called()


@pytest.mark.unit
def test_update_with_changed_open_ports_records_history() -> None:
    """update() writes a history row when open_ports differs from the stored value."""
    svc, mock_repo, _, mock_ports_history_repo = _make_service_with_ports()
    mock_repo.get_by_id.return_value = _server(id=1, open_ports={"tcp_ports": [22]})
    mock_repo.update.return_value = _server(id=1, open_ports={"tcp_ports": [22, 80]})

    data = UpdateServerRequest(open_ports={"tcp_ports": [22, 80]})
    svc.update(1, data)

    mock_ports_history_repo.create.assert_called_once()
    kwargs = mock_ports_history_repo.create.call_args.kwargs
    assert kwargs["server_id"] == 1
    assert kwargs["open_ports"] == {"tcp_ports": [22, 80]}


@pytest.mark.unit
def test_update_with_unchanged_open_ports_skips_history() -> None:
    """update() does not write a ports history row when open_ports is byte-identical."""
    svc, mock_repo, _, mock_ports_history_repo = _make_service_with_ports()
    same_ports = {"tcp_ports": [22]}
    mock_repo.get_by_id.return_value = _server(id=1, open_ports=same_ports)
    mock_repo.update.return_value = _server(id=1, open_ports=same_ports)

    data = UpdateServerRequest(open_ports=same_ports)
    svc.update(1, data)

    mock_ports_history_repo.create.assert_not_called()


@pytest.mark.unit
def test_get_open_ports_history_delegates_to_history_repo() -> None:
    """get_open_ports_history forwards to the open-ports history repository."""
    svc, mock_repo, _, mock_ports_history_repo = _make_service_with_ports()
    mock_ports_history_repo.get_by_server_id.return_value = ["entry1", "entry2"]

    result = svc.get_open_ports_history(1)

    mock_ports_history_repo.get_by_server_id.assert_called_once_with(1)
    assert result == ["entry1", "entry2"]


@pytest.mark.unit
def test_get_open_ports_history_entry_delegates_to_history_repo() -> None:
    """get_open_ports_history_entry forwards to the repository, scoped by server."""
    svc, mock_repo, _, mock_ports_history_repo = _make_service_with_ports()
    mock_ports_history_repo.get_by_id_scoped.return_value = "entry"

    result = svc.get_open_ports_history_entry(1, 42)

    mock_ports_history_repo.get_by_id_scoped.assert_called_once_with(1, 42)
    assert result == "entry"
