"""Smoke test: a deliberately failing client endpoint returns the safe 5xx shape."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from core.auth import verify_token
from main import app
from dependencies import get_client_data_service


@pytest.fixture
def client():
    return TestClient(app)


def test_5xx_response_does_not_leak_exception_text(client: TestClient):
    def override_verify_token():
        return {"user_id": 1, "username": "tester", "permissions": 0}

    mock_service = MagicMock()
    mock_service.get_device_names.side_effect = RuntimeError("super-secret-detail")

    app.dependency_overrides[verify_token] = override_verify_token
    app.dependency_overrides[get_client_data_service] = lambda: mock_service

    try:
        with patch("service_factory.build_rbac_service") as rbac:
            rbac.return_value.has_permission = MagicMock(return_value=True)
            resp = client.get(
                "/api/clients/devices",
                headers={"Authorization": "Bearer test-token"},
            )
    finally:
        app.dependency_overrides.clear()

    assert resp.status_code == 500
    body = resp.json()
    assert body["detail"]["message"] == "An internal error occurred"
    assert "error_id" in body["detail"]
    assert "super-secret-detail" not in resp.text
