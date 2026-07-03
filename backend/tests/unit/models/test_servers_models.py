"""Unit tests for models/servers.py Pydantic schemas.

All tests run offline.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from models.servers import (
    _ANSIBLE_FACTS_MAX_BYTES,
    _OPEN_PORTS_MAX_BYTES,
    AnsibleCredentials,
    CreateServerRequest,
    ListServersResponse,
    ServerContact,
    ServerFactsHistoryDetail,
    ServerFactsHistoryEntry,
    ServerFactsHistoryListResponse,
    ServerOpenPortsHistoryDetail,
    ServerOpenPortsHistoryEntry,
    ServerOpenPortsHistoryListResponse,
    ServerResponse,
    ServerSummaryResponse,
    UpdateServerRequest,
    normalize_contacts,
)

_CONTACT_ROLE = {
    "id": "866298d0-d942-440b-9c89-8b3e9eb81f79",
    "name": "Administrative",
}
_CONTACT_ENTRY = {
    "id": "13b79fe1-264f-40a3-91ed-9e93dd45a5d4",
    "name": "ops@example.com",
    "role": _CONTACT_ROLE,
}

_VALID_UUID = "550e8400-e29b-41d4-a716-446655440000"


# ── CreateServerRequest ────────────────────────────────────────────────────────


@pytest.mark.unit
def test_create_server_minimal_hostname() -> None:
    """hostname-only payload is accepted."""
    req = CreateServerRequest(hostname="web01")
    assert req.hostname == "web01"
    assert req.is_virtual is None


@pytest.mark.unit
def test_create_server_valid_ipv4() -> None:
    """primary_ipv4 accepts valid IPv4 addresses."""
    req = CreateServerRequest(hostname="web01", primary_ipv4="192.168.1.10")
    assert req.primary_ipv4 == "192.168.1.10"


@pytest.mark.unit
def test_create_server_invalid_ipv4_raises() -> None:
    """Invalid primary_ipv4 is rejected."""
    with pytest.raises(ValidationError, match="primary_ipv4"):
        CreateServerRequest(hostname="web01", primary_ipv4="not-an-ip")


@pytest.mark.unit
def test_create_server_valid_nautobot_uuid() -> None:
    """nautobot_uuid accepts standard UUID strings."""
    req = CreateServerRequest(hostname="web01", nautobot_uuid=_VALID_UUID)
    assert req.nautobot_uuid == _VALID_UUID


@pytest.mark.unit
def test_create_server_invalid_nautobot_uuid_raises() -> None:
    """Malformed nautobot_uuid is rejected."""
    with pytest.raises(ValidationError, match="nautobot_uuid"):
        CreateServerRequest(hostname="web01", nautobot_uuid="not-a-uuid")


@pytest.mark.unit
def test_create_server_ansible_facts_within_limit() -> None:
    """ansible_facts under the size cap are accepted."""
    req = CreateServerRequest(
        hostname="web01",
        ansible_facts={"ansible_hostname": "web01"},
    )
    assert req.ansible_facts is not None


@pytest.mark.unit
def test_create_server_ansible_facts_over_limit_raises() -> None:
    """ansible_facts larger than 512 KB are rejected."""
    huge = {"data": "x" * (_ANSIBLE_FACTS_MAX_BYTES + 1)}
    with pytest.raises(ValidationError, match="ansible_facts exceeds"):
        CreateServerRequest(hostname="web01", ansible_facts=huge)


@pytest.mark.unit
def test_create_server_open_ports_within_limit() -> None:
    """open_ports under the size cap are accepted."""
    req = CreateServerRequest(
        hostname="web01",
        open_ports={"tcp_ports": [22, 80], "udp_ports": [123]},
    )
    assert req.open_ports is not None


@pytest.mark.unit
def test_create_server_open_ports_over_limit_raises() -> None:
    """open_ports larger than 512 KB are rejected."""
    huge = {"data": "x" * (_OPEN_PORTS_MAX_BYTES + 1)}
    with pytest.raises(ValidationError, match="open_ports exceeds"):
        CreateServerRequest(hostname="web01", open_ports=huge)


@pytest.mark.unit
def test_create_server_sshkey_credentials_no_credential_id() -> None:
    """SSH key auth must not include credential_id."""
    creds = AnsibleCredentials(
        target="10.0.0.1",
        agent_id="agent-1",
        use_sshkey=True,
        ansible_user="admin",
        credential_id=None,
    )
    req = CreateServerRequest(hostname="web01", ansible_credentials=creds)
    assert req.ansible_credentials is not None


@pytest.mark.unit
def test_create_server_sshkey_with_credential_id_raises() -> None:
    """credential_id must not be set when use_sshkey is true."""
    creds = AnsibleCredentials(
        target="10.0.0.1",
        agent_id="agent-1",
        use_sshkey=True,
        ansible_user="admin",
        credential_id=5,
    )
    with pytest.raises(ValidationError, match="credential_id must not be set"):
        CreateServerRequest(hostname="web01", ansible_credentials=creds)


@pytest.mark.unit
def test_create_server_password_auth_requires_credential_id() -> None:
    """Password auth requires credential_id."""
    creds = AnsibleCredentials(
        target="10.0.0.1",
        agent_id="agent-1",
        use_sshkey=False,
        ansible_user="admin",
        credential_id=None,
    )
    with pytest.raises(ValidationError, match="credential_id is required"):
        CreateServerRequest(hostname="web01", ansible_credentials=creds)


@pytest.mark.unit
def test_create_server_empty_hostname_raises() -> None:
    """hostname must be non-empty."""
    with pytest.raises(ValidationError):
        CreateServerRequest(hostname="")


# ── UpdateServerRequest ──────────────────────────────────────────────────────────


@pytest.mark.unit
def test_update_server_partial_fields() -> None:
    """Update accepts a subset of fields."""
    req = UpdateServerRequest(contact=_CONTACT_ENTRY)
    dumped = req.model_dump(exclude_unset=True)
    assert dumped == {"contact": [_CONTACT_ENTRY]}


@pytest.mark.unit
def test_update_server_normalizes_single_contact_to_array() -> None:
    """Legacy single-object contact input is stored as a one-element list."""
    req = UpdateServerRequest(contact=_CONTACT_ENTRY)
    assert len(req.contact or []) == 1
    assert req.contact[0].name == "ops@example.com"


@pytest.mark.unit
def test_update_server_accepts_contact_array() -> None:
    """Update accepts contact as an array."""
    second = {
        "id": "a13b79fe-264f-40a3-91ed-9e93dd45a5d5",
        "name": "billing@example.com",
        "role": _CONTACT_ROLE,
    }
    req = UpdateServerRequest(contact=[_CONTACT_ENTRY, second])
    assert len(req.contact or []) == 2


@pytest.mark.unit
def test_server_response_normalizes_legacy_single_contact() -> None:
    """Response models normalize legacy DB single-object contact to an array."""
    resp = ServerResponse(
        id=1,
        hostname="web01",
        contact=_CONTACT_ENTRY,
        is_virtual=False,
    )
    assert resp.contact is not None
    assert len(resp.contact) == 1
    assert resp.contact[0].name == "ops@example.com"


@pytest.mark.unit
def test_update_server_invalid_uuid_raises() -> None:
    """Update rejects invalid nautobot_uuid."""
    with pytest.raises(ValidationError, match="nautobot_uuid"):
        UpdateServerRequest(nautobot_uuid="bad")


@pytest.mark.unit
def test_update_server_cluster_and_interfaces() -> None:
    """Update accepts cluster and selected_interfaces JSON fields."""
    req = UpdateServerRequest(
        cluster={"id": "c1", "name": "prod-cluster"},
        selected_interfaces=[{"name": "eth0", "enabled": True}],
    )
    assert req.cluster is not None
    assert req.cluster.name == "prod-cluster"
    assert len(req.selected_interfaces or []) == 1


@pytest.mark.unit
def test_update_server_invalid_contact_uuid_raises() -> None:
    """Update rejects invalid contact UUIDs."""
    with pytest.raises(ValidationError, match="contact.id"):
        UpdateServerRequest(contact={"id": "bad-uuid", "name": "ops"})


@pytest.mark.unit
def test_update_server_missing_contact_role_raises() -> None:
    """Update rejects contact without role."""
    with pytest.raises(ValidationError, match="contact.role"):
        UpdateServerRequest(
            contact=[
                {
                    "id": "13b79fe1-264f-40a3-91ed-9e93dd45a5d4",
                    "name": "ops@example.com",
                }
            ]
        )


# ── normalize_contacts ─────────────────────────────────────────────────────────


@pytest.mark.unit
def test_normalize_contacts_none() -> None:
    """None contact input stays None."""
    assert normalize_contacts(None) is None


@pytest.mark.unit
def test_normalize_contacts_legacy_dict() -> None:
    """Legacy single-object contact becomes a one-element list."""
    result = normalize_contacts(_CONTACT_ENTRY)
    assert result is not None
    assert len(result) == 1
    assert isinstance(result[0], ServerContact)
    assert result[0].name == "ops@example.com"


@pytest.mark.unit
def test_normalize_contacts_array() -> None:
    """Array contact input is validated as a list of ServerContact."""
    second = {
        "id": "a13b79fe-264f-40a3-91ed-9e93dd45a5d5",
        "name": "billing@example.com",
        "role": _CONTACT_ROLE,
    }
    result = normalize_contacts([_CONTACT_ENTRY, second])
    assert result is not None
    assert len(result) == 2
    assert result[1].name == "billing@example.com"


@pytest.mark.unit
def test_normalize_contacts_invalid_type_raises() -> None:
    """Non-object contact values raise ValueError."""
    with pytest.raises(ValueError, match="contact must be an object or a list"):
        normalize_contacts("not-a-contact")


# ── Response models ────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_list_servers_response_shape() -> None:
    """ListServersResponse carries servers, total, and total_all."""
    summary = ServerSummaryResponse(
        id=1,
        hostname="web01",
        is_virtual=False,
    )
    resp = ListServersResponse(servers=[summary], total=1, total_all=10)
    assert resp.total == 1
    assert resp.total_all == 10
    assert resp.servers[0].hostname == "web01"


# ── Facts history models ────────────────────────────────────────────────────────


@pytest.mark.unit
def test_server_facts_history_entry_excludes_facts_blob() -> None:
    """ServerFactsHistoryEntry only carries id and recorded_at."""
    entry = ServerFactsHistoryEntry(
        id=1, recorded_at=datetime(2024, 6, 1, tzinfo=timezone.utc)
    )
    assert entry.id == 1
    assert not hasattr(entry, "ansible_facts")


@pytest.mark.unit
def test_server_facts_history_detail_carries_facts() -> None:
    """ServerFactsHistoryDetail includes the full ansible_facts payload."""
    detail = ServerFactsHistoryDetail(
        id=1,
        recorded_at=datetime(2024, 6, 1, tzinfo=timezone.utc),
        ansible_facts={"ansible_hostname": "web01"},
    )
    assert detail.ansible_facts == {"ansible_hostname": "web01"}


@pytest.mark.unit
def test_server_facts_history_list_response_shape() -> None:
    """ServerFactsHistoryListResponse wraps a list of entries."""
    entry = ServerFactsHistoryEntry(
        id=1, recorded_at=datetime(2024, 6, 1, tzinfo=timezone.utc)
    )
    resp = ServerFactsHistoryListResponse(entries=[entry])
    assert resp.entries[0].id == 1


# ── Open ports history models ────────────────────────────────────────────────────


@pytest.mark.unit
def test_server_open_ports_history_entry_excludes_ports_blob() -> None:
    """ServerOpenPortsHistoryEntry only carries id and recorded_at."""
    entry = ServerOpenPortsHistoryEntry(
        id=1, recorded_at=datetime(2024, 6, 1, tzinfo=timezone.utc)
    )
    assert entry.id == 1
    assert not hasattr(entry, "open_ports")


@pytest.mark.unit
def test_server_open_ports_history_detail_carries_ports() -> None:
    """ServerOpenPortsHistoryDetail includes the full open_ports payload."""
    detail = ServerOpenPortsHistoryDetail(
        id=1,
        recorded_at=datetime(2024, 6, 1, tzinfo=timezone.utc),
        open_ports={"tcp_ports": [22, 80], "udp_ports": [123]},
    )
    assert detail.open_ports == {"tcp_ports": [22, 80], "udp_ports": [123]}


@pytest.mark.unit
def test_server_open_ports_history_list_response_shape() -> None:
    """ServerOpenPortsHistoryListResponse wraps a list of entries."""
    entry = ServerOpenPortsHistoryEntry(
        id=1, recorded_at=datetime(2024, 6, 1, tzinfo=timezone.utc)
    )
    resp = ServerOpenPortsHistoryListResponse(entries=[entry])
    assert resp.entries[0].id == 1
