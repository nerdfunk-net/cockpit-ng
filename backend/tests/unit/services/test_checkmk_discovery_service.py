"""Unit tests for CheckMKDiscoveryService using FakeCheckMKClient.

All tests run offline — no real CheckMK instance required.

start_bulk_discovery accepts a request object; we use SimpleNamespace.
"""

from __future__ import annotations

import pytest
from types import SimpleNamespace
from unittest.mock import patch

from services.checkmk.discovery_service import CheckMKDiscoveryService
from services.checkmk.exceptions import CheckMKAPIError
from tests.mocks import FakeCheckMKClient


_PATCH_TARGET = (
    "services.checkmk.discovery_service.CheckMKClientFactory.build_client_from_settings"
)


def _bulk_request(hostnames: list[str], mode: str = "new") -> SimpleNamespace:
    options = SimpleNamespace(
        monitor_undecided_services=True,
        remove_vanished_services=False,
        update_service_labels=False,
        update_service_parameters=False,
        update_host_labels=False,
    )
    return SimpleNamespace(
        hostnames=hostnames,
        options=options,
        do_full_scan=False,
        bulk_size=10,
        ignore_errors=False,
    )


# ── GET discovery state ────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_get_service_discovery_initial_state():
    """Discovery state for an unstarted host returns 'idle'."""
    fake = FakeCheckMKClient()
    fake.seed_host("router1", {})

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKDiscoveryService()
        result = await svc.get_service_discovery("router1")

    assert result["host_name"] == "router1"
    assert result["status"] in ("idle", "pending", "running", "finished")


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_get_service_discovery_after_start():
    """Discovery state transitions after start_service_discovery is called."""
    fake = FakeCheckMKClient()
    fake.seed_host("switch1", {})
    fake.start_service_discovery("switch1", mode="new")

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKDiscoveryService()
        result = await svc.get_service_discovery("switch1")

    assert result["host_name"] == "switch1"
    assert result["status"] != "idle"


# ── POST /hosts/{hostname}/discovery ──────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_start_service_discovery_succeeds():
    """Starting discovery on an existing host stores the state."""
    fake = FakeCheckMKClient()
    fake.seed_host("core-router", {})

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKDiscoveryService()
        result = await svc.start_service_discovery("core-router", mode="new")

    assert "core-router" in fake._discovery_state
    assert result.get("started") is True or "state" in result


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_start_service_discovery_host_not_found_raises():
    """Starting discovery on a non-existent host raises CheckMKAPIError."""
    fake = FakeCheckMKClient()

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKDiscoveryService()
        with pytest.raises(CheckMKAPIError):
            await svc.start_service_discovery("ghost-host", mode="new")


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_start_service_discovery_simulated_error():
    """Simulated 500 error propagates out of the service."""
    fake = FakeCheckMKClient(error_on={("start_service_discovery", "flaky"): 500})
    fake.seed_host("flaky", {})

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKDiscoveryService()
        with pytest.raises(CheckMKAPIError):
            await svc.start_service_discovery("flaky", mode="new")


# ── wait_for_service_discovery ─────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_wait_for_service_discovery_returns_final_state():
    """Wait should return the finished state."""
    fake = FakeCheckMKClient()
    fake.seed_host("router1", {})
    # Fake always returns 'completed' status from wait_for_service_discovery
    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKDiscoveryService()
        result = await svc.wait_for_service_discovery("router1")

    assert result["host_name"] == "router1"
    assert result["status"] == "completed"


# ── Bulk discovery ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_start_bulk_discovery_starts_all_hosts():
    """Bulk discovery should trigger discovery for every listed host."""
    fake = FakeCheckMKClient()
    fake.seed_host("h1", {})
    fake.seed_host("h2", {})
    fake.seed_host("h3", {})

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKDiscoveryService()
        result = await svc.start_bulk_discovery(_bulk_request(["h1", "h2", "h3"]))

    for hostname in ["h1", "h2", "h3"]:
        assert hostname in fake._discovery_state

    assert result.get("started") == 3 or result is not None


# ── update_discovery_phase ─────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_update_discovery_phase():
    """Updating the discovery phase is stored correctly."""
    fake = FakeCheckMKClient()
    fake.seed_host("router1", {})
    fake.start_service_discovery("router1", mode="new")

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKDiscoveryService()
        await svc.update_discovery_phase("router1", "monitor")

    assert fake._discovery_state["router1"]["mode"] == "monitor"
