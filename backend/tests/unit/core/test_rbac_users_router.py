"""Unit tests for routers/settings/rbac_users.py — user deletion endpoints.

All tests run offline — RBACService and AuditLogService are overridden via
FastAPI dependency injection / service_factory patching, modeled on
tests/unit/core/test_servers_router.py.
"""

from __future__ import annotations

from contextlib import ExitStack, contextmanager
from typing import Generator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from core.auth import verify_token
from dependencies import get_audit_log_service
from main import app
from services.auth.exceptions import (
    RBACConstraintError,
    RBACNotFoundError,
    UserDeletionBlockedError,
)

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


@contextmanager
def _admin_context(mock_rbac: MagicMock) -> Generator[MagicMock, None, None]:
    """Wires an authenticated admin caller + RBACService override, with cleanup."""

    def override_verify_token() -> dict:
        return {"user_id": 1, "username": "admin", "permissions": 0}

    app.dependency_overrides[verify_token] = override_verify_token
    app.dependency_overrides[get_audit_log_service] = lambda: MagicMock()

    mock_rbac.get_user_roles.return_value = [{"id": 1, "name": "admin"}]

    try:
        with patch("service_factory.build_rbac_service", return_value=mock_rbac):
            yield mock_rbac
    finally:
        app.dependency_overrides.clear()


_IMPACT = {
    "user_id": 5,
    "username": "alice",
    "global_templates": [],
    "global_schedules": [],
    "private_templates": [],
    "private_schedules": [],
    "cascade_schedules_from_other_users": [],
    "private_credentials_count": 0,
    "requires_global_reassignment": False,
    "requires_private_confirmation": False,
}


# ── GET /api/rbac/users/{id}/deletion-impact ────────────────────────────────


@pytest.mark.unit
def test_get_deletion_impact_returns_200(client: TestClient) -> None:
    mock_rbac = MagicMock()
    mock_rbac.get_user_deletion_impact.return_value = _IMPACT

    with _admin_context(mock_rbac):
        response = client.get(
            "/api/rbac/users/5/deletion-impact", headers=_AUTH_HEADERS
        )

    assert response.status_code == 200
    assert response.json()["username"] == "alice"


@pytest.mark.unit
def test_get_deletion_impact_404_for_unknown_user(client: TestClient) -> None:
    mock_rbac = MagicMock()
    mock_rbac.get_user_deletion_impact.side_effect = RBACNotFoundError("User", 999)

    with _admin_context(mock_rbac):
        response = client.get(
            "/api/rbac/users/999/deletion-impact", headers=_AUTH_HEADERS
        )

    assert response.status_code == 404


# ── DELETE /api/rbac/users/{id} ──────────────────────────────────────────────


@pytest.mark.unit
def test_delete_user_returns_409_when_blocked(client: TestClient) -> None:
    mock_rbac = MagicMock()
    mock_rbac.delete_user_with_rbac.side_effect = UserDeletionBlockedError(_IMPACT)

    with _admin_context(mock_rbac):
        response = client.delete("/api/rbac/users/5", headers=_AUTH_HEADERS)

    assert response.status_code == 409
    body = response.json()["detail"]
    assert body["message"] == "User deletion requires additional confirmation"
    assert body["impact"] == _IMPACT


@pytest.mark.unit
def test_delete_user_succeeds_with_resolved_params(client: TestClient) -> None:
    mock_rbac = MagicMock()
    mock_rbac.delete_user_with_rbac.return_value = True

    with _admin_context(mock_rbac):
        response = client.delete(
            "/api/rbac/users/5"
            "?reassign_global_items_to_user_id=2&delete_private_items=true",
            headers=_AUTH_HEADERS,
        )

    assert response.status_code == 204
    mock_rbac.delete_user_with_rbac.assert_called_once_with(
        5,
        reassign_global_items_to_user_id=2,
        delete_private_items=True,
    )


@pytest.mark.unit
def test_delete_user_not_found_maps_to_404(client: TestClient) -> None:
    mock_rbac = MagicMock()
    mock_rbac.delete_user_with_rbac.side_effect = RBACNotFoundError("User", 5)

    with _admin_context(mock_rbac):
        response = client.delete("/api/rbac/users/5", headers=_AUTH_HEADERS)

    assert response.status_code == 404


@pytest.mark.unit
def test_delete_user_constraint_error_maps_to_409(client: TestClient) -> None:
    mock_rbac = MagicMock()
    mock_rbac.delete_user_with_rbac.side_effect = RBACConstraintError("boom")

    with _admin_context(mock_rbac):
        response = client.delete("/api/rbac/users/5", headers=_AUTH_HEADERS)

    assert response.status_code == 409
