"""Unit tests for CheckMKMonitoringService using FakeCheckMKClient.

All tests run offline — no real CheckMK instance required.

The FakeCheckMKClient returns the same response shape as the real client:
- get_all_monitored_hosts → {"value": [...]}
- get_monitored_host      → {"id": hostname, "extensions": {...}}
- get_host_services       → {"value": [...]}
- show_service            → {"id": service, "extensions": {...}}
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from services.checkmk.exceptions import CheckMKAPIError
from services.checkmk.monitoring_service import CheckMKMonitoringService
from tests.mocks import FakeCheckMKClient

_PATCH_TARGET = "services.checkmk.monitoring_service.CheckMKClientFactory.build_client_from_settings"


# ── GET monitored hosts ────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_get_all_monitored_hosts_empty():
    """No hosts monitored when nothing is seeded."""
    fake = FakeCheckMKClient()

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKMonitoringService()
        result = await svc.get_all_monitored_hosts()

    assert result["value"] == []


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_get_all_monitored_hosts_returns_seeded():
    """Seeded monitored hosts appear in the response."""
    fake = FakeCheckMKClient()
    fake.seed_monitored_host("monitored-router", {"address": "10.0.0.1"})
    fake.seed_monitored_host("monitored-switch", {"address": "10.0.0.2"})

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKMonitoringService()
        result = await svc.get_all_monitored_hosts()

    ids = {h["id"] for h in result["value"]}
    assert "monitored-router" in ids
    assert "monitored-switch" in ids


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_get_monitored_host_found():
    """Getting a monitored host by name returns its details."""
    fake = FakeCheckMKClient()
    fake.seed_monitored_host("core-router", {"address": "192.168.0.1"})

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKMonitoringService()
        result = await svc.get_monitored_host("core-router")

    assert result["id"] == "core-router"
    assert "extensions" in result


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_get_monitored_host_not_found_raises():
    """Getting an unknown monitored host raises CheckMKAPIError."""
    fake = FakeCheckMKClient()

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKMonitoringService()
        with pytest.raises(CheckMKAPIError):
            await svc.get_monitored_host("ghost-router")


# ── GET host services ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_get_host_services_returns_list():
    """Getting host services returns a list of service entries."""
    fake = FakeCheckMKClient()
    fake.seed_host("router1", {})
    fake.seed_host_services("router1", [{"description": "CPU load"}, {"description": "Memory"}])

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKMonitoringService()
        result = await svc.get_host_services("router1")

    assert "value" in result
    assert len(result["value"]) == 2


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_get_host_services_empty_when_not_seeded():
    """Getting services for a host with no seeded services returns empty list."""
    fake = FakeCheckMKClient()
    fake.seed_host("router1", {})

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKMonitoringService()
        result = await svc.get_host_services("router1")

    assert result["value"] == []


# ── show_service ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_show_service_returns_detail():
    """show_service returns specific service details."""
    fake = FakeCheckMKClient()
    fake.seed_host("router1", {})

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKMonitoringService()
        result = await svc.show_service("router1", "CPU load")

    assert result["id"] == "CPU load"
    assert "extensions" in result


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_show_service_query_with_columns():
    """show_service with columns param passes through and returns a result."""
    fake = FakeCheckMKClient()
    fake.seed_host("router1", {})

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKMonitoringService()
        result = await svc.show_service("router1", "Memory", columns=["state", "description"])

    assert "id" in result
