"""Unit tests for CheckMKTagGroupService using FakeCheckMKClient.

All tests run offline — no real CheckMK instance required.

create_host_tag_group and update_host_tag_group accept request objects;
we use SimpleNamespace to build lightweight stand-ins.
"""

from __future__ import annotations

import pytest
from types import SimpleNamespace
from unittest.mock import patch, MagicMock

from services.checkmk.tag_group_service import CheckMKTagGroupService
from services.checkmk.exceptions import CheckMKAPIError
from tests.mocks import FakeCheckMKClient, TAG_GROUP_AGENT_ID


_PATCH_TARGET = (
    "services.checkmk.tag_group_service.CheckMKClientFactory.build_client_from_settings"
)


def _create_request(
    group_id: str, title: str, tags: list | None = None
) -> SimpleNamespace:
    tag_mocks = []
    for t in tags or []:
        m = MagicMock()
        m.dict.return_value = t
        tag_mocks.append(m)
    return SimpleNamespace(
        id=group_id, title=title, tags=tag_mocks, topic=None, help=None
    )


def _update_request(title: str, tags: list | None = None) -> SimpleNamespace:
    tag_mocks = []
    for t in tags or []:
        m = MagicMock()
        m.dict.return_value = t
        tag_mocks.append(m)
    return SimpleNamespace(
        title=title, tags=tag_mocks or None, topic=None, help=None, repair=False
    )


# ── GET /tag_groups ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_get_all_host_tag_groups_returns_seeded():
    """Default tag groups are present in the response."""
    fake = FakeCheckMKClient()

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKTagGroupService()
        result = await svc.get_all_host_tag_groups()

    names = {tg["id"] for tg in result["tag_groups"]}
    assert TAG_GROUP_AGENT_ID in names


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_get_host_tag_group_found():
    """Fetching a known tag group returns its details."""
    fake = FakeCheckMKClient()

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKTagGroupService()
        result = await svc.get_host_tag_group(TAG_GROUP_AGENT_ID)

    assert result["id"] == TAG_GROUP_AGENT_ID


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_get_host_tag_group_not_found_raises():
    """Fetching an unknown tag group raises CheckMKAPIError."""
    fake = FakeCheckMKClient()

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKTagGroupService()
        with pytest.raises(CheckMKAPIError):
            await svc.get_host_tag_group("nonexistent-tag")


# ── POST /tag_groups ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_create_host_tag_group_stores_it():
    """Creating a tag group stores it in the fake client."""
    fake = FakeCheckMKClient()
    tags = [{"id": "tag-prod", "title": "Production"}]

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKTagGroupService()
        await svc.create_host_tag_group(
            _create_request("environment", "Environment", tags)
        )

    assert "environment" in fake._tag_groups
    assert fake._tag_groups["environment"]["title"] == "Environment"


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_create_host_tag_group_duplicate_raises():
    """Creating a tag group with an existing ID raises CheckMKAPIError."""
    fake = FakeCheckMKClient()

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKTagGroupService()
        with pytest.raises(CheckMKAPIError):
            await svc.create_host_tag_group(
                _create_request(TAG_GROUP_AGENT_ID, "Duplicate")
            )


# ── PUT /tag_groups/{id} ───────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_update_host_tag_group_title():
    """Updating a tag group changes its title."""
    fake = FakeCheckMKClient()

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKTagGroupService()
        await svc.update_host_tag_group(
            TAG_GROUP_AGENT_ID, _update_request("Agent (Updated)")
        )

    assert fake._tag_groups[TAG_GROUP_AGENT_ID]["title"] == "Agent (Updated)"


# ── DELETE /tag_groups/{id} ────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_delete_host_tag_group_removes_it():
    """Deleting a tag group removes it from the store."""
    fake = FakeCheckMKClient()

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKTagGroupService()
        await svc.delete_host_tag_group(TAG_GROUP_AGENT_ID)

    assert TAG_GROUP_AGENT_ID not in fake._tag_groups


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_delete_host_tag_group_not_found_raises():
    """Deleting an unknown tag group raises CheckMKAPIError."""
    fake = FakeCheckMKClient()

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKTagGroupService()
        with pytest.raises(CheckMKAPIError):
            await svc.delete_host_tag_group("ghost-tag")
