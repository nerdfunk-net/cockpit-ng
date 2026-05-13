"""Unit tests for CheckMKHostGroupService using FakeCheckMKClient.

All tests run offline — no real CheckMK instance required.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from services.checkmk.exceptions import CheckMKAPIError
from services.checkmk.host_group_service import CheckMKHostGroupService
from tests.mocks import HOST_GROUP_NETWORK, HOST_GROUP_SERVERS, FakeCheckMKClient

_PATCH_TARGET = "services.checkmk.host_group_service.CheckMKClientFactory.build_client_from_settings"


# ── GET /host_groups ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_get_host_groups_returns_seeded():
    """Both default host groups are returned."""
    fake = FakeCheckMKClient()

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKHostGroupService()
        result = await svc.get_host_groups()

    assert "value" in result
    names = {g["name"] for g in result["value"]}
    assert HOST_GROUP_NETWORK in names
    assert HOST_GROUP_SERVERS in names


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_get_host_group_found():
    """Getting a known host group returns its data."""
    fake = FakeCheckMKClient()

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKHostGroupService()
        result = await svc.get_host_group(HOST_GROUP_NETWORK)

    assert result["name"] == HOST_GROUP_NETWORK
    assert result["alias"] == "Network Devices"


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_get_host_group_not_found_raises():
    """Getting an unknown host group raises CheckMKAPIError."""
    fake = FakeCheckMKClient()

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKHostGroupService()
        with pytest.raises(CheckMKAPIError):
            await svc.get_host_group("ghost-group")


# ── POST /host_groups ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_create_host_group_success():
    """Creating a new host group stores it."""
    fake = FakeCheckMKClient()

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKHostGroupService()
        await svc.create_host_group("firewall-group", "Firewall Devices")

    assert "firewall-group" in fake._host_groups
    assert fake._host_groups["firewall-group"]["alias"] == "Firewall Devices"


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_create_host_group_duplicate_raises():
    """Creating a group that already exists raises CheckMKAPIError."""
    fake = FakeCheckMKClient()

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKHostGroupService()
        with pytest.raises(CheckMKAPIError):
            await svc.create_host_group(HOST_GROUP_NETWORK, "Duplicate")


# ── PUT /host_groups/{name} ────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_update_host_group_alias():
    """Updating a host group changes its alias."""
    fake = FakeCheckMKClient()

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKHostGroupService()
        await svc.update_host_group(HOST_GROUP_NETWORK, "New Alias")

    assert fake._host_groups[HOST_GROUP_NETWORK]["alias"] == "New Alias"


# ── DELETE /host_groups/{name} ─────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_delete_host_group_removes_it():
    """Deleting a host group removes it from the store."""
    fake = FakeCheckMKClient()

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKHostGroupService()
        await svc.delete_host_group(HOST_GROUP_SERVERS)

    assert HOST_GROUP_SERVERS not in fake._host_groups


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_delete_host_group_not_found_raises():
    """Deleting a non-existent host group raises CheckMKAPIError."""
    fake = FakeCheckMKClient()

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKHostGroupService()
        with pytest.raises(CheckMKAPIError):
            await svc.delete_host_group("does-not-exist")


# ── Bulk operations ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_bulk_delete_host_groups():
    """Bulk delete removes all listed groups."""
    fake = FakeCheckMKClient()

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKHostGroupService()
        await svc.bulk_delete_host_groups([HOST_GROUP_NETWORK, HOST_GROUP_SERVERS])

    assert HOST_GROUP_NETWORK not in fake._host_groups
    assert HOST_GROUP_SERVERS not in fake._host_groups
