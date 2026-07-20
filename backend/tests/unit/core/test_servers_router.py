"""Unit tests for routers/servers/servers.py API endpoints.

All tests run offline — ServersService is overridden via FastAPI dependency injection.
"""

from __future__ import annotations

from contextlib import ExitStack, contextmanager
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Generator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from core.auth import verify_token
from dependencies import get_server_ansible_ops_service, get_servers_service
from main import app
from models.servers import CreateServerRequest, UpdateServerRequest
from services.servers.ansible_ops import HostScanResult

_NOW = datetime(2024, 6, 1, 12, 0, 0, tzinfo=timezone.utc)
_VALID_UUID = "550e8400-e29b-41d4-a716-446655440000"
_AUTH_HEADERS = {"Authorization": "Bearer test-token"}


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """TestClient with lifespan fully mocked — no real DB or external connections."""
    with ExitStack() as stack:
        mock_nb = stack.enter_context(patch("service_factory.build_nautobot_service"))
        stack.enter_context(patch("service_factory.build_oidc_service"))
        stack.enter_context(patch("service_factory.build_cache_service"))
        mock_bg = stack.enter_context(
            patch("service_factory.build_nb2cmk_background_service")
        )
        stack.enter_context(patch("main._startup_services", new=AsyncMock()))
        stack.enter_context(patch("main._shutdown_event"))
        mock_nb.return_value.startup = AsyncMock()
        mock_nb.return_value.shutdown = AsyncMock()
        mock_bg.return_value.shutdown = AsyncMock()
        with TestClient(app) as c:
            yield c


def _summary(**kwargs: object) -> SimpleNamespace:
    defaults: dict = {
        "id": 1,
        "hostname": "web01",
        "location": {"id": "loc-1", "name": "NYC"},
        "cluster": None,
        "distribution": "Ubuntu",
        "distribution_release": "22.04",
        "distribution_version": "22.04.3",
        "contact": {"id": "13b79fe1-264f-40a3-91ed-9e93dd45a5d4", "name": "ops"},
        "is_virtual": False,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def _detail(**kwargs: object) -> SimpleNamespace:
    defaults: dict = {
        "id": 1,
        "hostname": "web01",
        "location": {"id": "loc-1", "name": "NYC"},
        "cluster": None,
        "primary_ipv4": "10.0.0.1",
        "primary_interface": "eth0",
        "os_family": "Debian",
        "processor_count": 4,
        "memtotal_mb": 8192,
        "disk_count": 2,
        "disk_total_gb": 100,
        "disk_usage_pct": 55,
        "architecture": "x86_64",
        "distribution": "Ubuntu",
        "distribution_release": "22.04",
        "distribution_version": "22.04.3",
        "contact": {"id": "13b79fe1-264f-40a3-91ed-9e93dd45a5d4", "name": "ops"},
        "nautobot_uuid": _VALID_UUID,
        "is_virtual": False,
        "ansible_facts": {"ansible_hostname": "web01"},
        "ansible_credentials": None,
        "selected_interfaces": None,
        "created_at": _NOW,
        "updated_at": _NOW,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def _search_hit(**kwargs: object) -> SimpleNamespace:
    defaults: dict = {
        "id": 1,
        "hostname": "web01",
        "location": {"id": "loc-1", "name": "NYC"},
        "cluster": None,
        "os_family": "Debian",
        "processor_count": 4,
        "memtotal_mb": 8192,
        "disk_count": 2,
        "disk_total_gb": 100,
        "disk_usage_pct": 55,
        "distribution": "Ubuntu",
        "distribution_release": "jammy",
        "distribution_version": "22.04",
        "contact": None,
        "is_virtual": False,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


@contextmanager
def _auth_context(
    mock_service: MagicMock, ops_service: MagicMock | None = None
) -> Generator[MagicMock, None, None]:
    """Context manager: wires auth + RBAC + service override and guarantees cleanup."""

    def override_verify_token() -> dict:
        return {"user_id": 1, "username": "tester", "permissions": 0}

    app.dependency_overrides[verify_token] = override_verify_token
    app.dependency_overrides[get_servers_service] = lambda: mock_service
    if ops_service is not None:
        app.dependency_overrides[get_server_ansible_ops_service] = lambda: ops_service

    try:
        with patch("service_factory.build_rbac_service") as rbac_mock:
            yield rbac_mock
    finally:
        app.dependency_overrides.clear()


# ── GET /api/servers ───────────────────────────────────────────────────────────


@pytest.mark.unit
def test_list_servers_returns_summaries(client: TestClient) -> None:
    """List endpoint returns servers, total, and total_all."""
    mock_service = MagicMock()
    mock_service.list_summaries.return_value = [
        _summary(),
        _summary(id=2, hostname="db01"),
    ]
    mock_service.count_all.return_value = 5

    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.get("/api/servers", headers=_AUTH_HEADERS)

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    assert body["total_all"] == 5
    assert len(body["servers"]) == 2
    assert body["servers"][0]["hostname"] == "web01"
    mock_service.list_summaries.assert_called_once_with(search=None)


@pytest.mark.unit
def test_list_servers_passes_search_query(client: TestClient) -> None:
    """?q= strips whitespace and forwards search to the service."""
    mock_service = MagicMock()
    mock_service.list_summaries.return_value = []
    mock_service.count_all.return_value = 0

    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.get("/api/servers?q=web", headers=_AUTH_HEADERS)

    assert resp.status_code == 200
    mock_service.list_summaries.assert_called_once_with(search="web")


@pytest.mark.unit
def test_list_servers_invalid_group_by_returns_400(client: TestClient) -> None:
    """Deprecated group_by query rejects unknown fields."""
    mock_service = MagicMock()

    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.get(
            "/api/servers?group_by=hostname",
            headers=_AUTH_HEADERS,
        )

    assert resp.status_code == 400
    assert "Invalid group_by" in resp.json()["detail"]


@pytest.mark.unit
def test_list_servers_valid_group_by_allowed(client: TestClient) -> None:
    """Valid deprecated group_by values do not block the list."""
    mock_service = MagicMock()
    mock_service.list_summaries.return_value = []
    mock_service.count_all.return_value = 0

    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.get(
            "/api/servers?group_by=location",
            headers=_AUTH_HEADERS,
        )

    assert resp.status_code == 200


@pytest.mark.unit
def test_list_servers_internal_error_is_sanitized(client: TestClient) -> None:
    """Unexpected errors return the safe 5xx shape without leaking details."""
    mock_service = MagicMock()
    mock_service.list_summaries.side_effect = RuntimeError("db-secret")

    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.get("/api/servers", headers=_AUTH_HEADERS)

    assert resp.status_code == 500
    body = resp.json()
    assert body["detail"]["message"] == "An internal error occurred"
    assert "db-secret" not in resp.text


# ── GET /api/servers/{id} ──────────────────────────────────────────────────────


@pytest.mark.unit
def test_get_server_returns_detail(client: TestClient) -> None:
    """Detail endpoint returns the full server record."""
    mock_service = MagicMock()
    mock_service.get_by_id.return_value = _detail()

    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.get("/api/servers/1", headers=_AUTH_HEADERS)

    assert resp.status_code == 200
    body = resp.json()
    assert body["hostname"] == "web01"
    assert body["nautobot_uuid"] == _VALID_UUID
    assert body["ansible_facts"]["ansible_hostname"] == "web01"


@pytest.mark.unit
def test_get_server_not_found_returns_404(client: TestClient) -> None:
    """Missing server returns 404."""
    mock_service = MagicMock()
    mock_service.get_by_id.return_value = None

    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.get("/api/servers/999", headers=_AUTH_HEADERS)

    assert resp.status_code == 404
    assert resp.json()["detail"] == "Server not found"


# ── POST /api/servers ──────────────────────────────────────────────────────────


@pytest.mark.unit
def test_create_server_returns_201(client: TestClient) -> None:
    """Create endpoint returns 201 with the new server."""
    mock_service = MagicMock()
    mock_service.create.return_value = _detail(id=2, hostname="new-host")

    payload = {
        "hostname": "new-host",
        "primary_ipv4": "10.0.0.2",
        "is_virtual": False,
    }

    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.post("/api/servers", json=payload, headers=_AUTH_HEADERS)

    assert resp.status_code == 201
    assert resp.json()["hostname"] == "new-host"
    assert isinstance(mock_service.create.call_args[0][0], CreateServerRequest)


@pytest.mark.unit
def test_create_server_validation_error_returns_422(client: TestClient) -> None:
    """Invalid body is rejected before the service runs."""
    mock_service = MagicMock()

    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.post(
            "/api/servers",
            json={"hostname": "x", "primary_ipv4": "not-an-ip"},
            headers=_AUTH_HEADERS,
        )

    assert resp.status_code == 422
    mock_service.create.assert_not_called()


# ── PUT /api/servers/{id} ──────────────────────────────────────────────────────


@pytest.mark.unit
def test_update_server_returns_updated_record(client: TestClient) -> None:
    """Update endpoint returns the updated server."""
    mock_service = MagicMock()
    new_contact = {
        "id": "13b79fe1-264f-40a3-91ed-9e93dd45a5d4",
        "name": "new-ops",
        "role": {
            "id": "866298d0-d942-440b-9c89-8b3e9eb81f79",
            "name": "Administrative",
        },
    }
    mock_service.update.return_value = _detail(contact=[new_contact])

    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.put(
            "/api/servers/1",
            json={"contact": [new_contact]},
            headers=_AUTH_HEADERS,
        )

    assert resp.status_code == 200
    assert resp.json()["contact"] == [{**new_contact, "association_id": None}]
    assert isinstance(mock_service.update.call_args[0][1], UpdateServerRequest)


@pytest.mark.unit
def test_update_server_not_found_returns_404(client: TestClient) -> None:
    """Update on missing server returns 404."""
    mock_service = MagicMock()
    mock_service.update.return_value = None

    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.put(
            "/api/servers/999",
            json={
                "contact": [
                    {
                        "id": "13b79fe1-264f-40a3-91ed-9e93dd45a5d4",
                        "name": "x",
                        "role": {
                            "id": "866298d0-d942-440b-9c89-8b3e9eb81f79",
                            "name": "Administrative",
                        },
                    }
                ]
            },
            headers=_AUTH_HEADERS,
        )

    assert resp.status_code == 404


# ── POST /api/servers/{id}/refresh-facts ───────────────────────────────────────


@pytest.mark.unit
def test_refresh_facts_returns_updated_server(client: TestClient) -> None:
    """Successful refresh returns the updated server record."""
    mock_service = MagicMock()
    mock_service.get_by_id.return_value = _detail(hostname="refreshed-host")
    ops_service = MagicMock()
    ops_service.refresh_facts_for_server.return_value = HostScanResult(
        hostname="refreshed-host", operation="update", success=True, server_id=1
    )

    with _auth_context(mock_service, ops_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.post("/api/servers/1/refresh-facts", headers=_AUTH_HEADERS)

    assert resp.status_code == 200
    assert resp.json()["hostname"] == "refreshed-host"
    ops_service.refresh_facts_for_server.assert_called_once_with(1, sent_by="tester")


@pytest.mark.unit
def test_refresh_facts_server_not_found_returns_404(client: TestClient) -> None:
    """Refresh on a missing server returns 404 without calling the ops service."""
    mock_service = MagicMock()
    mock_service.get_by_id.return_value = None
    ops_service = MagicMock()

    with _auth_context(mock_service, ops_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.post("/api/servers/999/refresh-facts", headers=_AUTH_HEADERS)

    assert resp.status_code == 404
    ops_service.refresh_facts_for_server.assert_not_called()


@pytest.mark.unit
def test_refresh_facts_agent_error_returns_422(client: TestClient) -> None:
    """Agent/credential failures surface as a 422 with the ops-service error message."""
    mock_service = MagicMock()
    mock_service.get_by_id.return_value = _detail()
    ops_service = MagicMock()
    ops_service.refresh_facts_for_server.return_value = HostScanResult(
        hostname="web01",
        operation="get_facts",
        success=False,
        error="Agent 'agent-1' is offline or not responding",
    )

    with _auth_context(mock_service, ops_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.post("/api/servers/1/refresh-facts", headers=_AUTH_HEADERS)

    assert resp.status_code == 422
    assert "offline" in resp.json()["detail"].lower()


@pytest.mark.unit
def test_refresh_facts_internal_error_is_sanitized(client: TestClient) -> None:
    """Unexpected errors on refresh return the safe 5xx shape."""
    mock_service = MagicMock()
    mock_service.get_by_id.return_value = _detail()
    ops_service = MagicMock()
    ops_service.refresh_facts_for_server.side_effect = RuntimeError("boom")

    with _auth_context(mock_service, ops_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.post("/api/servers/1/refresh-facts", headers=_AUTH_HEADERS)

    assert resp.status_code == 500
    body = resp.json()
    assert body["detail"]["message"] == "An internal error occurred"
    assert "boom" not in resp.text


@pytest.mark.unit
def test_refresh_facts_forbidden_without_permission(client: TestClient) -> None:
    """Refresh returns 403 when RBAC denies servers:write."""
    mock_service = MagicMock()
    ops_service = MagicMock()

    with _auth_context(mock_service, ops_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=False)
        resp = client.post("/api/servers/1/refresh-facts", headers=_AUTH_HEADERS)

    assert resp.status_code == 403
    ops_service.refresh_facts_for_server.assert_not_called()


# ── POST /api/servers/{id}/refresh-open-ports ──────────────────────────────────


@pytest.mark.unit
def test_refresh_open_ports_returns_updated_server(client: TestClient) -> None:
    """Successful refresh returns the updated server record."""
    mock_service = MagicMock()
    mock_service.get_by_id.return_value = _detail()
    ops_service = MagicMock()
    ops_service.refresh_open_ports_for_server.return_value = HostScanResult(
        hostname="web01", operation="update", success=True, server_id=1
    )

    with _auth_context(mock_service, ops_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.post("/api/servers/1/refresh-open-ports", headers=_AUTH_HEADERS)

    assert resp.status_code == 200
    assert resp.json()["hostname"] == "web01"
    ops_service.refresh_open_ports_for_server.assert_called_once_with(
        1, sent_by="tester"
    )


@pytest.mark.unit
def test_refresh_open_ports_server_not_found_returns_404(client: TestClient) -> None:
    """Refresh on a missing server returns 404 without calling the ops service."""
    mock_service = MagicMock()
    mock_service.get_by_id.return_value = None
    ops_service = MagicMock()

    with _auth_context(mock_service, ops_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.post("/api/servers/999/refresh-open-ports", headers=_AUTH_HEADERS)

    assert resp.status_code == 404
    ops_service.refresh_open_ports_for_server.assert_not_called()


@pytest.mark.unit
def test_refresh_open_ports_agent_error_returns_422(client: TestClient) -> None:
    """Agent/credential failures surface as a 422 with the ops-service error message."""
    mock_service = MagicMock()
    mock_service.get_by_id.return_value = _detail()
    ops_service = MagicMock()
    ops_service.refresh_open_ports_for_server.return_value = HostScanResult(
        hostname="web01",
        operation="get_open_ports",
        success=False,
        error="Stored credentials are incomplete (missing credential ID).",
    )

    with _auth_context(mock_service, ops_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.post("/api/servers/1/refresh-open-ports", headers=_AUTH_HEADERS)

    assert resp.status_code == 422
    assert "incomplete" in resp.json()["detail"]


@pytest.mark.unit
def test_refresh_open_ports_forbidden_without_permission(client: TestClient) -> None:
    """Refresh returns 403 when RBAC denies servers:write."""
    mock_service = MagicMock()
    ops_service = MagicMock()

    with _auth_context(mock_service, ops_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=False)
        resp = client.post("/api/servers/1/refresh-open-ports", headers=_AUTH_HEADERS)

    assert resp.status_code == 403
    ops_service.refresh_open_ports_for_server.assert_not_called()


# ── GET /api/servers/{id}/facts/history ────────────────────────────────────────


def _history_entry(**kwargs: object) -> SimpleNamespace:
    defaults: dict = {"id": 1, "recorded_at": _NOW}
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def _history_detail(**kwargs: object) -> SimpleNamespace:
    defaults: dict = {
        "id": 1,
        "recorded_at": _NOW,
        "ansible_facts": {"ansible_hostname": "web01"},
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


@pytest.mark.unit
def test_get_server_facts_history_returns_entries(client: TestClient) -> None:
    """History list endpoint returns lightweight entries, newest first."""
    mock_service = MagicMock()
    mock_service.get_by_id.return_value = _detail()
    mock_service.get_facts_history.return_value = [
        _history_entry(id=2, recorded_at=_NOW),
        _history_entry(id=1, recorded_at=_NOW),
    ]

    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.get("/api/servers/1/facts/history", headers=_AUTH_HEADERS)

    assert resp.status_code == 200
    body = resp.json()
    assert len(body["entries"]) == 2
    assert body["entries"][0]["id"] == 2
    assert "ansible_facts" not in body["entries"][0]
    mock_service.get_facts_history.assert_called_once_with(1)


@pytest.mark.unit
def test_get_server_facts_history_server_not_found_returns_404(
    client: TestClient,
) -> None:
    """History list returns 404 when the server itself doesn't exist."""
    mock_service = MagicMock()
    mock_service.get_by_id.return_value = None

    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.get("/api/servers/999/facts/history", headers=_AUTH_HEADERS)

    assert resp.status_code == 404
    mock_service.get_facts_history.assert_not_called()


@pytest.mark.unit
def test_get_server_facts_history_forbidden_without_permission(
    client: TestClient,
) -> None:
    """History list returns 403 when RBAC denies servers:read."""
    mock_service = MagicMock()

    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=False)
        resp = client.get("/api/servers/1/facts/history", headers=_AUTH_HEADERS)

    assert resp.status_code == 403
    mock_service.get_by_id.assert_not_called()


# ── GET /api/servers/{id}/facts/history/{history_id} ───────────────────────────


@pytest.mark.unit
def test_get_server_facts_history_entry_returns_detail(client: TestClient) -> None:
    """History detail endpoint returns the full historical facts snapshot."""
    mock_service = MagicMock()
    mock_service.get_facts_history_entry.return_value = _history_detail()

    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.get("/api/servers/1/facts/history/1", headers=_AUTH_HEADERS)

    assert resp.status_code == 200
    body = resp.json()
    assert body["ansible_facts"]["ansible_hostname"] == "web01"
    mock_service.get_facts_history_entry.assert_called_once_with(1, 1)


@pytest.mark.unit
def test_get_server_facts_history_entry_not_found_returns_404(
    client: TestClient,
) -> None:
    """History detail returns 404 when the entry doesn't exist or isn't scoped to the server."""
    mock_service = MagicMock()
    mock_service.get_facts_history_entry.return_value = None

    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.get("/api/servers/1/facts/history/999", headers=_AUTH_HEADERS)

    assert resp.status_code == 404


@pytest.mark.unit
def test_get_server_facts_history_entry_internal_error_is_sanitized(
    client: TestClient,
) -> None:
    """Unexpected errors on history detail return the safe 5xx shape."""
    mock_service = MagicMock()
    mock_service.get_facts_history_entry.side_effect = RuntimeError("db-secret")

    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.get("/api/servers/1/facts/history/1", headers=_AUTH_HEADERS)

    assert resp.status_code == 500
    body = resp.json()
    assert body["detail"]["message"] == "An internal error occurred"


# ── GET /api/servers/{id}/open-ports/history ────────────────────────────────────


def _ports_history_detail(**kwargs: object) -> SimpleNamespace:
    defaults: dict = {
        "id": 1,
        "recorded_at": _NOW,
        "open_ports": {"tcp_ports": [22, 80], "udp_ports": [123]},
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


@pytest.mark.unit
def test_get_server_open_ports_history_returns_entries(client: TestClient) -> None:
    """History list endpoint returns lightweight entries, newest first."""
    mock_service = MagicMock()
    mock_service.get_by_id.return_value = _detail()
    mock_service.get_open_ports_history.return_value = [
        _history_entry(id=2, recorded_at=_NOW),
        _history_entry(id=1, recorded_at=_NOW),
    ]

    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.get("/api/servers/1/open-ports/history", headers=_AUTH_HEADERS)

    assert resp.status_code == 200
    body = resp.json()
    assert len(body["entries"]) == 2
    assert body["entries"][0]["id"] == 2
    assert "open_ports" not in body["entries"][0]
    mock_service.get_open_ports_history.assert_called_once_with(1)


@pytest.mark.unit
def test_get_server_open_ports_history_server_not_found_returns_404(
    client: TestClient,
) -> None:
    """History list returns 404 when the server itself doesn't exist."""
    mock_service = MagicMock()
    mock_service.get_by_id.return_value = None

    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.get("/api/servers/999/open-ports/history", headers=_AUTH_HEADERS)

    assert resp.status_code == 404
    mock_service.get_open_ports_history.assert_not_called()


# ── GET /api/servers/{id}/open-ports/history/{history_id} ───────────────────────


@pytest.mark.unit
def test_get_server_open_ports_history_entry_returns_detail(client: TestClient) -> None:
    """History detail endpoint returns the full historical open-ports snapshot."""
    mock_service = MagicMock()
    mock_service.get_open_ports_history_entry.return_value = _ports_history_detail()

    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.get("/api/servers/1/open-ports/history/1", headers=_AUTH_HEADERS)

    assert resp.status_code == 200
    body = resp.json()
    assert body["open_ports"]["tcp_ports"] == [22, 80]
    mock_service.get_open_ports_history_entry.assert_called_once_with(1, 1)


@pytest.mark.unit
def test_get_server_open_ports_history_entry_not_found_returns_404(
    client: TestClient,
) -> None:
    """History detail returns 404 when the entry doesn't exist or isn't scoped to the server."""
    mock_service = MagicMock()
    mock_service.get_open_ports_history_entry.return_value = None

    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.get(
            "/api/servers/1/open-ports/history/999", headers=_AUTH_HEADERS
        )

    assert resp.status_code == 404
    assert "db-secret" not in resp.text


# ── DELETE /api/servers/{id} ───────────────────────────────────────────────────


@pytest.mark.unit
def test_delete_server_returns_204(client: TestClient) -> None:
    """Delete endpoint returns 204 when the row is removed."""
    mock_service = MagicMock()
    mock_service.delete.return_value = True

    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.delete("/api/servers/1", headers=_AUTH_HEADERS)

    assert resp.status_code == 204
    mock_service.delete.assert_called_once_with(1)


@pytest.mark.unit
def test_delete_server_not_found_returns_404(client: TestClient) -> None:
    """Delete on missing server returns 404."""
    mock_service = MagicMock()
    mock_service.delete.return_value = False

    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.delete("/api/servers/999", headers=_AUTH_HEADERS)

    assert resp.status_code == 404


# ── Authorization ──────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_list_servers_forbidden_without_permission(client: TestClient) -> None:
    """List returns 403 when RBAC denies servers:read."""
    mock_service = MagicMock()

    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=False)
        resp = client.get("/api/servers", headers=_AUTH_HEADERS)

    assert resp.status_code == 403
    mock_service.list_summaries.assert_not_called()


@pytest.mark.unit
def test_create_server_forbidden_without_permission(client: TestClient) -> None:
    """Create returns 403 when RBAC denies servers:write."""
    mock_service = MagicMock()

    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=False)
        resp = client.post(
            "/api/servers",
            json={"hostname": "new-host"},
            headers=_AUTH_HEADERS,
        )

    assert resp.status_code == 403
    mock_service.create.assert_not_called()


@pytest.mark.unit
def test_update_server_forbidden_without_permission(client: TestClient) -> None:
    """Update returns 403 when RBAC denies servers:write."""
    mock_service = MagicMock()

    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=False)
        resp = client.put(
            "/api/servers/1",
            json={"hostname": "renamed"},
            headers=_AUTH_HEADERS,
        )

    assert resp.status_code == 403
    mock_service.update.assert_not_called()


@pytest.mark.unit
def test_delete_server_forbidden_without_permission(client: TestClient) -> None:
    """Delete returns 403 when RBAC denies servers:delete."""
    mock_service = MagicMock()

    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=False)
        resp = client.delete("/api/servers/1", headers=_AUTH_HEADERS)

    assert resp.status_code == 403
    mock_service.delete.assert_not_called()


# ── 5xx sanitization ───────────────────────────────────────────────────────────


@pytest.mark.unit
def test_get_server_internal_error_is_sanitized(client: TestClient) -> None:
    """Unexpected errors on detail return the safe 5xx shape."""
    mock_service = MagicMock()
    mock_service.get_by_id.side_effect = RuntimeError("db-secret")

    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.get("/api/servers/1", headers=_AUTH_HEADERS)

    assert resp.status_code == 500
    body = resp.json()
    assert body["detail"]["message"] == "An internal error occurred"
    assert "error_id" in body["detail"]
    assert "db-secret" not in resp.text


@pytest.mark.unit
def test_create_server_duplicate_hostname_returns_400(client: TestClient) -> None:
    """Duplicate hostname returns a clear 400 message instead of sanitized 500."""
    from sqlalchemy.exc import IntegrityError

    mock_service = MagicMock()
    mock_service.create.side_effect = IntegrityError(
        "insert",
        {},
        Exception(
            'duplicate key value violates unique constraint "uq_servers_hostname"'
        ),
    )

    hostname = "v2202503262298326986.nicesrv.de"
    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.post(
            "/api/servers",
            json={"hostname": hostname},
            headers=_AUTH_HEADERS,
        )

    assert resp.status_code == 400
    assert hostname in resp.json()["detail"]
    assert "already exists" in resp.json()["detail"].lower()


@pytest.mark.unit
def test_create_server_internal_error_is_sanitized(client: TestClient) -> None:
    """Unexpected errors on create return the safe 5xx shape."""
    mock_service = MagicMock()
    mock_service.create.side_effect = RuntimeError("insert-failed")

    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.post(
            "/api/servers",
            json={"hostname": "new-host"},
            headers=_AUTH_HEADERS,
        )

    assert resp.status_code == 500
    body = resp.json()
    assert body["detail"]["message"] == "An internal error occurred"
    assert "insert-failed" not in resp.text


@pytest.mark.unit
def test_update_server_internal_error_is_sanitized(client: TestClient) -> None:
    """Unexpected errors on update return the safe 5xx shape."""
    mock_service = MagicMock()
    mock_service.update.side_effect = RuntimeError("update-failed")

    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.put(
            "/api/servers/1",
            json={"hostname": "renamed"},
            headers=_AUTH_HEADERS,
        )

    assert resp.status_code == 500
    body = resp.json()
    assert body["detail"]["message"] == "An internal error occurred"
    assert "update-failed" not in resp.text


# ── POST /api/servers/search & GET /api/servers/search/facets ─────────────────


@pytest.mark.unit
def test_search_servers_returns_hits(client: TestClient) -> None:
    mock_service = MagicMock()
    mock_service.search.return_value = [
        _search_hit(),
        _search_hit(id=2, hostname="db01", memtotal_mb=16384),
    ]

    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.post(
            "/api/servers/search",
            json={
                "query": {
                    "combinator": "and",
                    "rules": [
                        {"field": "memtotal_mb", "op": "gt", "value": 8192},
                        {"field": "os_family", "op": "eq", "value": "Debian"},
                    ],
                }
            },
            headers=_AUTH_HEADERS,
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    assert body["servers"][0]["hostname"] == "web01"
    assert body["servers"][0]["disk_total_gb"] == 100
    assert body["servers"][0]["distribution"] == "Ubuntu"
    mock_service.search.assert_called_once()


@pytest.mark.unit
def test_search_servers_rejects_empty_query(client: TestClient) -> None:
    mock_service = MagicMock()

    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.post(
            "/api/servers/search",
            json={"query": {"combinator": "and", "rules": []}},
            headers=_AUTH_HEADERS,
        )

    assert resp.status_code == 422
    mock_service.search.assert_not_called()


@pytest.mark.unit
def test_get_search_facets(client: TestClient) -> None:
    mock_service = MagicMock()
    mock_service.get_search_facets.return_value = {
        "os_family": ["Debian", "RedHat"],
        "distribution": ["Ubuntu", "Rocky"],
        "distribution_version": ["22.04", "9.4"],
    }

    with _auth_context(mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.get("/api/servers/search/facets", headers=_AUTH_HEADERS)

    assert resp.status_code == 200
    body = resp.json()
    assert body["os_family"] == ["Debian", "RedHat"]
    assert body["distribution"] == ["Ubuntu", "Rocky"]
    assert body["distribution_version"] == ["22.04", "9.4"]
