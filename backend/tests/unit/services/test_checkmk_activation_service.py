"""Unit tests for CheckMKActivationService using FakeCheckMKClient.

All tests run offline — no real CheckMK instance required.

get_pending_changes() calls client._make_request() directly.
The FakeCheckMKClient implements _make_request() as a stub that returns
a mock HTTP response — the service still works end-to-end in tests.

activate_changes() accepts a request object; we use SimpleNamespace.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

import pytest

from services.checkmk.activation_service import CheckMKActivationService
from services.checkmk.exceptions import CheckMKAPIError
from tests.mocks import FakeCheckMKClient

_PATCH_TARGET = "services.checkmk.activation_service.CheckMKClientFactory.build_client_from_settings"


def _activate_request(sites: list[str] | None = None) -> SimpleNamespace:
    return SimpleNamespace(
        sites=sites or [],
        force_foreign_changes=False,
        redirect=False,
    )


# ── Pending changes ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_get_pending_changes_initially_empty():
    """No changes pending at startup."""
    fake = FakeCheckMKClient()

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKActivationService()
        result = await svc.get_pending_changes()

    assert result.get("value", []) == [] or result.get("changes", []) == []


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_get_pending_changes_after_host_created():
    """Creating a host adds a pending change."""
    fake = FakeCheckMKClient()
    fake.create_host("new-router", folder="~", attributes={})

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKActivationService()
        result = await svc.get_pending_changes()

    # Either "value" or "changes" list should be non-empty
    changes = result.get("value") or result.get("changes") or []
    assert len(changes) > 0


# ── Activate changes ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_activate_changes_clears_pending():
    """Activating changes empties the pending list."""
    fake = FakeCheckMKClient()
    fake.create_host("host-to-activate", folder="~", attributes={})
    assert len(fake._pending_changes) > 0

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKActivationService()
        result = await svc.activate_changes(_activate_request())

    assert len(fake._pending_changes) == 0
    assert result.get("id") is not None


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_activate_changes_no_pending_succeeds():
    """Activating with nothing pending should succeed (return activation id)."""
    fake = FakeCheckMKClient()

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKActivationService()
        result = await svc.activate_changes(_activate_request())

    assert result is not None


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_activate_changes_error_propagates():
    """A simulated 500 error during activation propagates as CheckMKAPIError."""
    fake = FakeCheckMKClient(error_on={("activate_changes", "*"): 500})
    fake.seed_host("h1", {})

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKActivationService()
        with pytest.raises(CheckMKAPIError):
            await svc.activate_changes(_activate_request())


# ── Activation status ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_get_activation_status_unknown_raises():
    """Querying status of an unknown activation_id raises CheckMKAPIError."""
    fake = FakeCheckMKClient()

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKActivationService()
        with pytest.raises(CheckMKAPIError):
            await svc.get_activation_status("nonexistent-activation-id")


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_get_activation_status_after_activate():
    """After activation, the status should be retrievable."""
    fake = FakeCheckMKClient()
    fake.create_host("status-host", folder="~", attributes={})

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKActivationService()
        activation_result = await svc.activate_changes(_activate_request())
        activation_id = activation_result["id"]
        status = await svc.get_activation_status(activation_id)

    assert status["id"] == activation_id
    assert "status" in status


# ── Running activations ────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_get_running_activations_empty_initially():
    """No running activations at startup."""
    fake = FakeCheckMKClient()

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKActivationService()
        result = await svc.get_running_activations()

    # Result is a list or dict with empty value list
    running = result if isinstance(result, list) else result.get("value", [])
    assert running == []


# ── wait_for_activation_completion ────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_wait_for_activation_completion_returns_done():
    """Waiting for a completed activation returns immediately."""
    fake = FakeCheckMKClient()
    fake.create_host("wait-host", folder="~", attributes={})

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKActivationService()
        activation = await svc.activate_changes(_activate_request())
        activation_id = activation["id"]

        result = await svc.wait_for_activation_completion(activation_id)

    assert result["id"] == activation_id
    assert result["status"] in ("success", "done", "completed")
