"""Unit tests for CheckMKFolderService using FakeCheckMKClient.

All tests run offline — no real CheckMK instance required.
"""

from __future__ import annotations

import pytest
from unittest.mock import patch

from services.checkmk.folder import CheckMKFolderService
from services.checkmk.exceptions import CheckMKAPIError
from tests.mocks import FakeCheckMKClient, FOLDER_DC1, FOLDER_ROOT


_PATCH_TARGET = "services.checkmk.folder.CheckMKClientFactory.build_client_from_settings"


# ── GET /folders ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_get_all_folders_returns_seeded_folders():
    """Seeded folders are returned in the list."""
    fake = FakeCheckMKClient()

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKFolderService()
        result = await svc.get_all_folders()

    assert result["total"] >= 2
    folder_ids = {f["name"] for f in result["folders"]}
    # Root and dc1 are seeded by default
    assert any("dc1" in fid for fid in folder_ids)


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_get_all_folders_filtered_by_parent():
    """Passing a parent filters down to direct children."""
    fake = FakeCheckMKClient()
    # Add extra folder under a different parent
    fake.seed_folder("~other", "Other", parent="~")

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKFolderService()
        result = await svc.get_all_folders(parent="~")

    for folder in result["folders"]:
        assert folder["parent"] == "~"


# ── POST /folders ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_create_folder_path_single_segment():
    """A single-segment path creates exactly one folder."""
    fake = FakeCheckMKClient()

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKFolderService()
        success = await svc.create_path("/new-site", site_name="cmk", current_user={})

    assert success is True
    assert "~new-site" in fake._folders


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_create_folder_path_multi_segment():
    """A multi-segment path creates all intermediate folders."""
    fake = FakeCheckMKClient()

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKFolderService()
        success = await svc.create_path("/region/country/city", site_name="cmk", current_user={})

    assert success is True
    assert "~region" in fake._folders
    assert "~region~country" in fake._folders
    assert "~region~country~city" in fake._folders


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_create_folder_path_already_exists_is_idempotent():
    """If a folder already exists, create_path should still succeed (skip, not fail)."""
    fake = FakeCheckMKClient()
    # Pre-create so the API would return 400 "already exists"
    fake._folders["~dc1"] = {"id": "~dc1", "title": "DC1", "extensions": {"parent": "~", "path": "~dc1", "attributes": {}, "hosts": []}}

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKFolderService()
        success = await svc.create_path("/dc1", site_name="cmk", current_user={})

    assert success is True


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_create_folder_path_empty_returns_true():
    """Empty path or root path should return True without creating anything."""
    fake = FakeCheckMKClient()
    initial_count = len(fake._folders)

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKFolderService()
        result = await svc.create_path("/", site_name="cmk", current_user={})

    assert result is True
    assert len(fake._folders) == initial_count


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_create_folder_api_error_returns_false():
    """Non-400 API errors during folder creation should return False."""
    fake = FakeCheckMKClient(error_on={("create_folder", "blocked"): 500})

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKFolderService()
        result = await svc.create_path("/blocked", site_name="cmk", current_user={})

    assert result is False


# ── GET /folders (service method) ─────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_get_all_folders_structure():
    """Each returned folder has expected keys."""
    fake = FakeCheckMKClient()

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKFolderService()
        result = await svc.get_all_folders()

    for folder in result["folders"]:
        assert "name" in folder
        assert "title" in folder
        assert "parent" in folder
        assert "path" in folder
