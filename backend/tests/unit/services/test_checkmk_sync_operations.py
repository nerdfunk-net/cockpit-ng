"""Unit tests for services/checkmk/sync/operations.py."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from services.checkmk.sync.operations import DeviceSyncOperations


def _normalized(hostname: str = "router-01", folder: str = "/dc1") -> dict:
    return {
        "internal": {"hostname": hostname},
        "folder": folder,
        "attributes": {"ipaddress": "10.0.0.1"},
    }


@pytest.fixture
def ops() -> DeviceSyncOperations:
    query = MagicMock()
    with (
        patch("service_factory.build_checkmk_config_service"),
        patch("service_factory.build_checkmk_folder_service"),
    ):
        return DeviceSyncOperations(query)


@pytest.mark.asyncio
@pytest.mark.unit
async def test_add_device_no_hostname_raises(ops: DeviceSyncOperations) -> None:
    ops.query_service.get_device_normalized = AsyncMock(
        return_value={"internal": {}, "folder": "/", "attributes": {}}
    )

    with pytest.raises(HTTPException) as exc_info:
        await ops.add_device_to_checkmk("dev-1")

    assert exc_info.value.status_code == 400
    assert "hostname" in exc_info.value.detail.lower()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_add_device_success(ops: DeviceSyncOperations) -> None:
    ops.query_service.get_device_normalized = AsyncMock(return_value=_normalized())
    folder_svc = MagicMock()
    folder_svc.create_path = AsyncMock(return_value=True)
    ops._folder = folder_svc

    client = MagicMock()
    client.create_host.return_value = {"id": "host-1"}
    client.start_service_discovery.return_value = {"started": True}

    with (
        patch("service_factory.build_checkmk_client", return_value=client),
        patch(
            "services.checkmk.sync.operations.get_device_site_from_normalized_data",
            return_value="site1",
        ),
    ):
        result = await ops.add_device_to_checkmk("dev-1")

    assert result.success is True
    assert result.hostname == "router-01"
    client.create_host.assert_called_once()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_update_device_moves_host_when_folder_changes(ops: DeviceSyncOperations) -> None:
    ops.query_service.get_device_normalized = AsyncMock(
        return_value=_normalized(folder="/new-site")
    )
    folder_svc = MagicMock()
    folder_svc.create_path = AsyncMock(return_value=True)
    ops._folder = folder_svc

    client = MagicMock()
    client.get_host.return_value = {
        "extensions": {"folder": "/~old-site"},
    }
    client.update_host.return_value = {"updated": True}

    with (
        patch("service_factory.build_checkmk_client", return_value=client),
        patch(
            "services.checkmk.sync.operations.get_device_site_from_normalized_data",
            return_value="site1",
        ),
        patch(
            "services.checkmk.sync.operations.normalize_folder_path",
            side_effect=lambda p: p,
        ),
    ):
        result = await ops.update_device_in_checkmk("dev-1")

    assert result.success is True
    assert result.folder_changed is True
    client.move_host.assert_called_once()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_update_device_host_not_found_in_checkmk(ops: DeviceSyncOperations) -> None:
    from services.checkmk.exceptions import CheckMKAPIError

    ops.query_service.get_device_normalized = AsyncMock(return_value=_normalized())
    client = MagicMock()
    client.get_host.side_effect = CheckMKAPIError("404 not found", status_code=404)

    with (
        patch("service_factory.build_checkmk_client", return_value=client),
        patch(
            "services.checkmk.sync.operations.get_device_site_from_normalized_data",
            return_value="site1",
        ),
    ):
        with pytest.raises(HTTPException) as exc_info:
            await ops.update_device_in_checkmk("dev-1")

    assert exc_info.value.status_code == 404


@pytest.mark.unit
def test_get_default_site(ops: DeviceSyncOperations) -> None:
    ops._config.get_default_site.return_value = "helsinki"

    result = ops.get_default_site()

    assert result.default_site == "helsinki"
