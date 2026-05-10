"""Unit tests for CheckMKHostService using FakeCheckMKClient.

All tests run offline — no real CheckMK instance required.
The FakeCheckMKClient is patched into the service via
CheckMKClientFactory.build_client_from_settings.
"""

from __future__ import annotations

import pytest
from unittest.mock import patch

from services.checkmk.host_service import CheckMKHostService
from services.checkmk.exceptions import CheckMKAPIError, HostNotFoundError
from tests.mocks import FakeCheckMKClient, FOLDER_DC1


# ── Helpers ────────────────────────────────────────────────────────────────────

_PATCH_TARGET = "services.checkmk.host_service.CheckMKClientFactory.build_client_from_settings"


def _service_with(fake: FakeCheckMKClient) -> CheckMKHostService:
    return CheckMKHostService()


# ── GET /hosts ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_get_all_hosts_empty():
    """No hosts → empty list returned."""
    fake = FakeCheckMKClient()
    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKHostService()
        result = await svc.get_all_hosts()

    assert result["hosts"] == []
    assert result["total"] == 0


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_get_all_hosts_returns_seeded_hosts():
    """Pre-seeded hosts appear in the response."""
    fake = FakeCheckMKClient()
    fake.seed_host("router1", {"ipaddress": "10.0.0.1"}, folder="/dc1")
    fake.seed_host("switch1", {"ipaddress": "10.0.0.2"}, folder="/dc1/access")

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKHostService()
        result = await svc.get_all_hosts()

    assert result["total"] == 2
    hostnames = {h["host_name"] for h in result["hosts"]}
    assert hostnames == {"router1", "switch1"}


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_get_all_hosts_returns_folder_info():
    """Folder attribute is correctly extracted from the envelope."""
    fake = FakeCheckMKClient()
    fake.seed_host("router1", {"ipaddress": "10.0.0.1"}, folder="/dc1")

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKHostService()
        result = await svc.get_all_hosts()

    host = result["hosts"][0]
    assert host["folder"] == "/dc1"
    assert host["attributes"]["ipaddress"] == "10.0.0.1"


# ── GET /hosts/{hostname} ──────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_get_host_found():
    """Getting a seeded host returns full envelope."""
    fake = FakeCheckMKClient()
    fake.seed_host("router1", {"ipaddress": "10.0.0.1", "alias": "Core Router"})

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKHostService()
        result = await svc.get_host("router1")

    assert result["id"] == "router1"
    assert result["extensions"]["attributes"]["alias"] == "Core Router"


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_get_host_not_found_raises():
    """Getting an unknown host raises HostNotFoundError."""
    fake = FakeCheckMKClient()

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKHostService()
        with pytest.raises(HostNotFoundError, match="not found"):
            await svc.get_host("nonexistent")


# ── POST /hosts ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_create_host_success():
    """Creating a new host stores it and returns the envelope."""
    fake = FakeCheckMKClient()

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKHostService()
        result = await svc.create_host(
            hostname="new-host",
            folder="/dc1",
            attributes={"ipaddress": "192.168.1.10"},
        )

    assert "create_result" in result
    assert "new-host" in fake._hosts
    stored = fake._hosts["new-host"]
    assert stored["extensions"]["attributes"]["ipaddress"] == "192.168.1.10"


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_create_host_duplicate_raises():
    """Creating a host that already exists raises CheckMKAPIError."""
    fake = FakeCheckMKClient()
    fake.seed_host("existing-host", {})

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKHostService()
        with pytest.raises(CheckMKAPIError):
            await svc.create_host(
                hostname="existing-host", folder="/", attributes={}
            )


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_create_host_with_start_discovery():
    """When start_discovery=True, discovery is triggered for the new host."""
    fake = FakeCheckMKClient()

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKHostService()
        result = await svc.create_host(
            hostname="discovered-host",
            folder="/",
            attributes={},
            start_discovery=True,
            discovery_mode="new",
        )

    assert result.get("discovery", {}).get("started") is True
    assert "discovered-host" in fake._discovery_state


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_create_host_discovery_failure_does_not_block():
    """If discovery fails, the host is still created and a warning is recorded."""
    fake = FakeCheckMKClient(
        error_on={("start_service_discovery", "fragile-host"): 500}
    )

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKHostService()
        result = await svc.create_host(
            hostname="fragile-host",
            folder="/",
            attributes={},
            start_discovery=True,
        )

    assert "fragile-host" in fake._hosts
    assert result["discovery"]["started"] is False


# ── PUT /hosts/{hostname} ──────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_update_host_merges_attributes():
    """Updating a host merges the supplied attributes."""
    fake = FakeCheckMKClient()
    fake.seed_host("router1", {"ipaddress": "10.0.0.1"})

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKHostService()
        await svc.update_host("router1", {"alias": "New Alias"})

    stored = fake._hosts["router1"]["extensions"]["attributes"]
    assert stored["ipaddress"] == "10.0.0.1"
    assert stored["alias"] == "New Alias"


# ── DELETE /hosts/{hostname} ───────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_delete_host_removes_from_store():
    """Deleting a host removes it from the in-memory store."""
    fake = FakeCheckMKClient()
    fake.seed_host("gone-host", {})

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKHostService()
        result = await svc.delete_host("gone-host")

    assert result["success"] is True
    assert "gone-host" not in fake._hosts


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_delete_host_error_propagates():
    """Simulated API error on delete propagates out of the service."""
    fake = FakeCheckMKClient(error_on={("delete_host", "locked-host"): 403})
    fake.seed_host("locked-host", {})

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKHostService()
        with pytest.raises(CheckMKAPIError):
            await svc.delete_host("locked-host")


# ── POST /hosts/{hostname}/move ────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_move_host_changes_folder():
    """Moving a host updates its folder in the store."""
    fake = FakeCheckMKClient()
    fake.seed_host("switch1", {}, folder="/old-folder")

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKHostService()
        await svc.move_host("switch1", "/new-folder")

    assert fake._hosts["switch1"]["extensions"]["folder"] == "~new-folder"


# ── POST /hosts/{hostname}/rename ──────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_rename_host():
    """Renaming a host creates the new key and removes the old one."""
    fake = FakeCheckMKClient()
    fake.seed_host("old-name", {"ipaddress": "1.2.3.4"})

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKHostService()
        await svc.rename_host("old-name", "new-name")

    assert "old-name" not in fake._hosts
    assert "new-name" in fake._hosts
    assert fake._hosts["new-name"]["extensions"]["attributes"]["ipaddress"] == "1.2.3.4"


# ── POST /hosts/bulk-create ────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_bulk_create_hosts():
    """Bulk-creating hosts stores all of them."""
    from unittest.mock import MagicMock

    fake = FakeCheckMKClient()

    entry1 = MagicMock()
    entry1.host_name = "bulk-host-1"
    entry1.folder = "/"
    entry1.attributes = {"ipaddress": "10.0.0.10"}

    entry2 = MagicMock()
    entry2.host_name = "bulk-host-2"
    entry2.folder = "/"
    entry2.attributes = {"ipaddress": "10.0.0.11"}

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKHostService()
        result = await svc.bulk_create_hosts([entry1, entry2])

    assert "bulk-host-1" in fake._hosts
    assert "bulk-host-2" in fake._hosts
    assert "value" in result
