"""Unit tests for routers/servers/servers.py API endpoints.

All tests run offline — ServersService is overridden via FastAPI dependency injection.
"""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from core.auth import verify_token
from dependencies import get_servers_service
from main import app
from models.servers import CreateServerRequest, UpdateServerRequest

_NOW = datetime(2024, 6, 1, 12, 0, 0, tzinfo=timezone.utc)
_VALID_UUID = "550e8400-e29b-41d4-a716-446655440000"
_AUTH_HEADERS = {"Authorization": "Bearer test-token"}


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _summary(**kwargs: object) -> SimpleNamespace:
    defaults: dict = {
        "id": 1,
        "hostname": "web01",
        "location": {"id": "loc-1", "name": "NYC"},
        "cluster": None,
        "distribution_release": "22.04",
        "distribution_version": "22.04.3",
        "contact": "ops",
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
        "architecture": "x86_64",
        "distribution_release": "22.04",
        "distribution_version": "22.04.3",
        "contact": "ops",
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


def _auth_context(client: TestClient, mock_service: MagicMock):
    """Context manager: auth + RBAC + service override."""

    def override_verify_token() -> dict:
        return {"user_id": 1, "username": "tester", "permissions": 0}

    app.dependency_overrides[verify_token] = override_verify_token
    app.dependency_overrides[get_servers_service] = lambda: mock_service

    return patch("service_factory.build_rbac_service")


# ── GET /api/servers ───────────────────────────────────────────────────────────


@pytest.mark.unit
def test_list_servers_returns_summaries(client: TestClient) -> None:
    """List endpoint returns servers, total, and total_all."""
    mock_service = MagicMock()
    mock_service.list_summaries.return_value = [_summary(), _summary(id=2, hostname="db01")]
    mock_service.count_all.return_value = 5

    with _auth_context(client, mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.get("/api/servers", headers=_AUTH_HEADERS)

    app.dependency_overrides.clear()

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

    with _auth_context(client, mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.get("/api/servers?q=web", headers=_AUTH_HEADERS)

    app.dependency_overrides.clear()

    assert resp.status_code == 200
    mock_service.list_summaries.assert_called_once_with(search="web")


@pytest.mark.unit
def test_list_servers_invalid_group_by_returns_400(client: TestClient) -> None:
    """Deprecated group_by query rejects unknown fields."""
    mock_service = MagicMock()

    with _auth_context(client, mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.get(
            "/api/servers?group_by=hostname",
            headers=_AUTH_HEADERS,
        )

    app.dependency_overrides.clear()

    assert resp.status_code == 400
    assert "Invalid group_by" in resp.json()["detail"]


@pytest.mark.unit
def test_list_servers_valid_group_by_allowed(client: TestClient) -> None:
    """Valid deprecated group_by values do not block the list."""
    mock_service = MagicMock()
    mock_service.list_summaries.return_value = []
    mock_service.count_all.return_value = 0

    with _auth_context(client, mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.get(
            "/api/servers?group_by=location",
            headers=_AUTH_HEADERS,
        )

    app.dependency_overrides.clear()

    assert resp.status_code == 200


@pytest.mark.unit
def test_list_servers_internal_error_is_sanitized(client: TestClient) -> None:
    """Unexpected errors return the safe 5xx shape without leaking details."""
    mock_service = MagicMock()
    mock_service.list_summaries.side_effect = RuntimeError("db-secret")

    with _auth_context(client, mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.get("/api/servers", headers=_AUTH_HEADERS)

    app.dependency_overrides.clear()

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

    with _auth_context(client, mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.get("/api/servers/1", headers=_AUTH_HEADERS)

    app.dependency_overrides.clear()

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

    with _auth_context(client, mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.get("/api/servers/999", headers=_AUTH_HEADERS)

    app.dependency_overrides.clear()

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

    with _auth_context(client, mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.post("/api/servers", json=payload, headers=_AUTH_HEADERS)

    app.dependency_overrides.clear()

    assert resp.status_code == 201
    assert resp.json()["hostname"] == "new-host"
    assert isinstance(mock_service.create.call_args[0][0], CreateServerRequest)


@pytest.mark.unit
def test_create_server_validation_error_returns_422(client: TestClient) -> None:
    """Invalid body is rejected before the service runs."""
    mock_service = MagicMock()

    with _auth_context(client, mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.post(
            "/api/servers",
            json={"hostname": "x", "primary_ipv4": "not-an-ip"},
            headers=_AUTH_HEADERS,
        )

    app.dependency_overrides.clear()

    assert resp.status_code == 422
    mock_service.create.assert_not_called()


# ── PUT /api/servers/{id} ──────────────────────────────────────────────────────


@pytest.mark.unit
def test_update_server_returns_updated_record(client: TestClient) -> None:
    """Update endpoint returns the updated server."""
    mock_service = MagicMock()
    mock_service.update.return_value = _detail(contact="new-ops")

    with _auth_context(client, mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.put(
            "/api/servers/1",
            json={"contact": "new-ops"},
            headers=_AUTH_HEADERS,
        )

    app.dependency_overrides.clear()

    assert resp.status_code == 200
    assert resp.json()["contact"] == "new-ops"
    assert isinstance(mock_service.update.call_args[0][1], UpdateServerRequest)


@pytest.mark.unit
def test_update_server_not_found_returns_404(client: TestClient) -> None:
    """Update on missing server returns 404."""
    mock_service = MagicMock()
    mock_service.update.return_value = None

    with _auth_context(client, mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.put(
            "/api/servers/999",
            json={"contact": "x"},
            headers=_AUTH_HEADERS,
        )

    app.dependency_overrides.clear()

    assert resp.status_code == 404


# ── DELETE /api/servers/{id} ───────────────────────────────────────────────────


@pytest.mark.unit
def test_delete_server_returns_204(client: TestClient) -> None:
    """Delete endpoint returns 204 when the row is removed."""
    mock_service = MagicMock()
    mock_service.delete.return_value = True

    with _auth_context(client, mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.delete("/api/servers/1", headers=_AUTH_HEADERS)

    app.dependency_overrides.clear()

    assert resp.status_code == 204
    mock_service.delete.assert_called_once_with(1)


@pytest.mark.unit
def test_delete_server_not_found_returns_404(client: TestClient) -> None:
    """Delete on missing server returns 404."""
    mock_service = MagicMock()
    mock_service.delete.return_value = False

    with _auth_context(client, mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=True)
        resp = client.delete("/api/servers/999", headers=_AUTH_HEADERS)

    app.dependency_overrides.clear()

    assert resp.status_code == 404


# ── Authorization ──────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_list_servers_forbidden_without_permission(client: TestClient) -> None:
    """List returns 403 when RBAC denies servers:read."""
    mock_service = MagicMock()

    with _auth_context(client, mock_service) as rbac:
        rbac.return_value.has_permission = MagicMock(return_value=False)
        resp = client.get("/api/servers", headers=_AUTH_HEADERS)

    app.dependency_overrides.clear()

    assert resp.status_code == 403
    mock_service.list_summaries.assert_not_called()
