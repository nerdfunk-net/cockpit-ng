"""Unit tests for BaselineImportService in services/network/tools/baseline.py."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import yaml

from services.network.tools.baseline import BaselineImportService

_PATCH_NB = "service_factory.build_nautobot_service"
_PATCH_COMMON = "services.network.tools.baseline.DeviceCommonService"
_PATCH_IMPORT = "services.network.tools.baseline.DeviceImportService"  # skip test only


def _service() -> BaselineImportService:
    with patch(_PATCH_NB, return_value=MagicMock()):
        return BaselineImportService()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_load_baseline_files_reads_yaml(tmp_path) -> None:
    (tmp_path / "one.yaml").write_text(
        yaml.dump({"devices": [{"name": "r1"}]}),
        encoding="utf-8",
    )
    svc = _service()
    data = await svc.load_baseline_files(directory=str(tmp_path))
    assert len(data) == 1
    assert data[0]["devices"][0]["name"] == "r1"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_load_baseline_files_missing_directory_raises(tmp_path) -> None:
    svc = _service()
    missing = tmp_path / "does-not-exist"
    with pytest.raises(FileNotFoundError, match="Baseline directory not found"):
        await svc.load_baseline_files(directory=str(missing))


@pytest.mark.asyncio
@pytest.mark.unit
async def test_get_status_uuid_uses_cache_after_fetch() -> None:
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(
        return_value={
            "results": [
                {"id": "uuid-active", "name": "Active"},
            ]
        }
    )
    with patch(_PATCH_NB, return_value=mock_nb):
        svc = BaselineImportService()

    status_id = await svc.get_status_uuid("Active", content_type="dcim.device")

    assert status_id == "uuid-active"
    mock_nb.rest_request.assert_called_once()


@pytest.mark.unit
def test_status_cache_key_with_content_type() -> None:
    svc = _service()
    assert svc._status_cache_key("Active", "dcim.device") == "dcim.device:Active"
    assert svc._status_cache_key("Active", None) == "Active"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_location_types_creates_new() -> None:
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(
        side_effect=[
            {"count": 0},
            {"id": "lt-new"},
        ]
    )
    with patch(_PATCH_NB, return_value=mock_nb):
        svc = BaselineImportService()

    created = await svc.create_location_types(
        [{"name": "Site", "description": "site", "content_types": ["dcim.device"]}]
    )

    assert created["Site"] == "lt-new"
    assert mock_nb.rest_request.await_count == 2


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_location_types_skips_existing() -> None:
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(
        return_value={
            "count": 1,
            "results": [
                {
                    "id": "lt-existing",
                    "content_types": ["dcim.device"],
                }
            ],
        }
    )
    with patch(_PATCH_NB, return_value=mock_nb):
        svc = BaselineImportService()

    created = await svc.create_location_types([{"name": "Site"}])

    assert created["Site"] == "lt-existing"
    mock_nb.rest_request.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_roles_creates_new() -> None:
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(
        side_effect=[
            {"count": 0},
            {"id": "role-1"},
        ]
    )
    with patch(_PATCH_NB, return_value=mock_nb):
        svc = BaselineImportService()

    created = await svc.create_roles(
        [{"name": "router", "description": "net", "content_types": ["dcim.device"]}]
    )

    assert created["router"] == "role-1"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_tags_creates_with_color() -> None:
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(
        side_effect=[
            {"count": 0},
            {"id": "tag-1"},
        ]
    )
    with patch(_PATCH_NB, return_value=mock_nb):
        svc = BaselineImportService()

    created = await svc.create_tags([{"name": "lab", "color": "green"}])

    assert created["lab"] == "tag-1"
    post_call = mock_nb.rest_request.await_args_list[-1]
    assert post_call.kwargs["data"]["color"] == "4caf50"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_locations_uses_status_and_type() -> None:
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(
        side_effect=[
            {"count": 0},
            {"id": "loc-1"},
        ]
    )
    with patch(_PATCH_NB, return_value=mock_nb):
        svc = BaselineImportService()
        svc.created_resources["location_types"] = {"Building": "lt-1"}
        svc.status_cache["dcim.location:active"] = "status-uuid"

    created = await svc.create_locations(
        [
            {
                "name": "Building A",
                "status": "active",
                "location_types": "Building",
            }
        ]
    )

    assert created["Building A"] == "loc-1"
    post_payload = mock_nb.rest_request.await_args_list[-1].kwargs["data"]
    assert post_payload["status"] == {"id": "status-uuid"}
    assert post_payload["location_type"] == {"id": "lt-1"}


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_manufacturers_creates_new() -> None:
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(side_effect=[{"count": 0}, {"id": "mfr-1"}])
    with patch(_PATCH_NB, return_value=mock_nb):
        with patch(_PATCH_COMMON, return_value=MagicMock()):
            svc = BaselineImportService()

    created = await svc.create_manufacturers(
        [{"name": "Cisco", "description": "vendor"}]
    )

    assert created["Cisco"] == "mfr-1"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_platforms_links_manufacturer() -> None:
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(side_effect=[{"count": 0}, {"id": "plat-1"}])
    with patch(_PATCH_NB, return_value=mock_nb):
        with patch(_PATCH_COMMON, return_value=MagicMock()):
            svc = BaselineImportService()
            svc.created_resources["manufacturers"] = {"Cisco": "mfr-1"}

    created = await svc.create_platforms(
        [{"name": "ios", "manufacturer": "Cisco", "network_driver": "cisco_ios"}]
    )

    assert created["ios"] == "plat-1"
    post_payload = mock_nb.rest_request.await_args_list[-1].kwargs["data"]
    assert post_payload["manufacturer"] == {"id": "mfr-1"}


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_device_types_skips_missing_manufacturer() -> None:
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(return_value={"count": 0})
    with patch(_PATCH_NB, return_value=mock_nb):
        with patch(_PATCH_COMMON, return_value=MagicMock()):
            svc = BaselineImportService()

    created = await svc.create_device_types(
        [{"model": "ISR4331", "manufacturer": "Unknown"}]
    )

    assert created == {}
    mock_nb.rest_request.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_prefixes_uses_common_service() -> None:
    mock_nb = MagicMock()
    mock_common = MagicMock()
    mock_common.ensure_prefix_exists = AsyncMock(return_value="prefix-uuid")
    with patch(_PATCH_NB, return_value=mock_nb):
        with patch(_PATCH_COMMON, return_value=mock_common):
            svc = BaselineImportService()

    created = await svc.create_prefixes(
        [{"prefix": "192.168.1.0/24", "namespace": "Global"}]
    )

    assert created["192.168.1.0/24"] == "prefix-uuid"
    mock_common.ensure_prefix_exists.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_load_baseline_files_raises_when_no_yaml(tmp_path) -> None:
    empty = tmp_path / "empty"
    empty.mkdir()
    svc = _service()
    with pytest.raises(ValueError, match="No YAML files"):
        await svc.load_baseline_files(directory=str(empty))


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_custom_fields_creates_new() -> None:
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(
        side_effect=[
            {"results": []},
            {"id": "cf-uuid"},
        ]
    )
    with patch(_PATCH_NB, return_value=mock_nb):
        with patch(_PATCH_COMMON, return_value=MagicMock()):
            svc = BaselineImportService()

    created = await svc.create_custom_fields(
        {
            "net": [
                {
                    "label": "Network",
                    "type": "select",
                    "content_types": ["dcim.device"],
                }
            ]
        }
    )

    assert created["net"] == "cf-uuid"
    assert svc.custom_field_cache["Network"] == "cf-uuid"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_custom_field_choices_creates_entries() -> None:
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(
        side_effect=[
            {"count": 0},
            {},
            {"count": 0},
            {},
        ]
    )
    with patch(_PATCH_NB, return_value=mock_nb):
        with patch(_PATCH_COMMON, return_value=MagicMock()):
            svc = BaselineImportService()
            svc.created_resources["custom_fields"] = {"net": "cf-id"}

    counts = await svc.create_custom_field_choices(
        {"net": [{"value": "netA"}, {"value": "netB"}]}
    )

    assert counts["net"] == 2
    assert mock_nb.rest_request.await_count == 4


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_location_types_patches_content_types() -> None:
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(
        side_effect=[
            {
                "count": 1,
                "results": [
                    {
                        "id": "lt-1",
                        "content_types": ["dcim.device"],
                    }
                ],
            },
            {},
        ]
    )
    with patch(_PATCH_NB, return_value=mock_nb):
        with patch(_PATCH_COMMON, return_value=MagicMock()):
            svc = BaselineImportService()

    created = await svc.create_location_types(
        [
            {
                "name": "Site",
                "content_types": ["virtualization.virtualmachine"],
            }
        ]
    )

    assert created["Site"] == "lt-1"
    patch_call = mock_nb.rest_request.await_args_list[-1]
    assert "virtualization.cluster" in patch_call.kwargs["data"]["content_types"]


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_devices_imports_via_import_service() -> None:
    mock_nb = MagicMock()
    with patch(_PATCH_NB, return_value=mock_nb):
        with patch(_PATCH_COMMON, return_value=MagicMock()):
            svc = BaselineImportService()

    with patch(
        "services.nautobot.devices.import_service.DeviceImportService.import_device",
        new_callable=AsyncMock,
        return_value={"device_id": "dev-uuid", "created": True},
    ) as mock_import:
        created = await svc.create_devices(
            [
                {
                    "name": "router1",
                    "device_type": "networkA",
                    "location": "Site A",
                    "roles": ["Network"],
                    "interfaces": [
                        {
                            "name": "eth0",
                            "ip_address": "10.0.0.1/24",
                            "type": "1000base-t",
                        }
                    ],
                    "primary_ip4": "10.0.0.1/24",
                }
            ]
        )

    assert created["router1"] == "dev-uuid"
    mock_import.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_devices_skips_when_role_missing() -> None:
    mock_nb = MagicMock()
    with patch(_PATCH_NB, return_value=mock_nb):
        with patch(_PATCH_COMMON, return_value=MagicMock()):
            with patch(_PATCH_IMPORT, return_value=MagicMock()):
                svc = BaselineImportService()

    created = await svc.create_devices([{"name": "orphan", "device_type": "x"}])

    assert created == {}


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_cluster_groups_creates_new() -> None:
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(side_effect=[{"count": 0}, {"id": "cg-1"}])
    with patch(_PATCH_NB, return_value=mock_nb):
        with patch(_PATCH_COMMON, return_value=MagicMock()):
            svc = BaselineImportService()

    created = await svc.create_cluster_groups([{"name": "Default", "description": "d"}])

    assert created["Default"] == "cg-1"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_cluster_types_uses_cluster_manager() -> None:
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(return_value={"count": 0})
    with patch(_PATCH_NB, return_value=mock_nb):
        with patch(_PATCH_COMMON, return_value=MagicMock()):
            svc = BaselineImportService()

    with patch(
        "services.nautobot.managers.cluster_manager.ClusterManager.create_cluster_type",
        new_callable=AsyncMock,
        return_value={"id": "ct-1"},
    ) as mock_create_type:
        created = await svc.create_cluster_types(
            [{"name": "cluster-type", "slug": "cluster-type"}]
        )

    assert created["cluster-type"] == "ct-1"
    mock_create_type.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_clusters_uses_cluster_manager() -> None:
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(return_value={"count": 0})
    with patch(_PATCH_NB, return_value=mock_nb):
        with patch(_PATCH_COMMON, return_value=MagicMock()):
            svc = BaselineImportService()
            svc.created_resources["cluster_types"] = {"cluster-type": "ct-1"}
            svc.created_resources["cluster_groups"] = {"Default": "cg-1"}
            svc.created_resources["locations"] = {"Site A": "loc-1"}

    with patch(
        "services.nautobot.managers.cluster_manager.ClusterManager.create_cluster",
        new_callable=AsyncMock,
        return_value={"id": "cl-1"},
    ) as mock_create_cluster:
        created = await svc.create_clusters(
            [
                {
                    "name": "Cluster A",
                    "cluster_type": "cluster-type",
                    "cluster_group": "Default",
                    "location": "Site A",
                }
            ]
        )

    assert created["Cluster A"] == "cl-1"
    mock_create_cluster.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_baseline_runs_role_step(tmp_path) -> None:
    (tmp_path / "baseline.yaml").write_text(
        yaml.dump(
            {
                "roles": [
                    {
                        "name": "Network",
                        "description": "net",
                        "content_types": ["dcim.device"],
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    mock_nb = MagicMock()
    with patch(_PATCH_NB, return_value=mock_nb):
        with patch(_PATCH_COMMON, return_value=MagicMock()):
            svc = BaselineImportService()

    with patch.object(
        svc, "create_roles", AsyncMock(return_value={"Network": "role-1"})
    ) as mock_roles:
        summary = await svc.create_baseline(directory=str(tmp_path))

    assert summary["success"] is True
    assert summary["created"]["roles"] == 1
    mock_roles.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_baseline_returns_failure_on_load_error() -> None:
    mock_nb = MagicMock()
    with patch(_PATCH_NB, return_value=mock_nb):
        svc = BaselineImportService()

    with patch.object(
        svc, "load_baseline_files", AsyncMock(side_effect=RuntimeError("boom"))
    ):
        summary = await svc.create_baseline(directory="/tmp")

    assert summary["success"] is False
    assert "boom" in summary["message"]


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_virtual_machines_skips_missing_cluster() -> None:
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(return_value={"count": 0})
    with patch(_PATCH_NB, return_value=mock_nb):
        svc = BaselineImportService()
        svc.created_resources["clusters"] = {}

    created = await svc.create_virtual_machines([{"name": "vm1", "cluster": "Missing"}])

    assert created == {}


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_virtual_machines_reuses_existing() -> None:
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(
        return_value={"count": 1, "results": [{"id": "vm-existing"}]}
    )
    with patch(_PATCH_NB, return_value=mock_nb):
        svc = BaselineImportService()

    created = await svc.create_virtual_machines([{"name": "vm1", "cluster": "C1"}])

    assert created["vm1"] == "vm-existing"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_virtual_machines_creates_via_manager() -> None:
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(return_value={"count": 0})
    with patch(_PATCH_NB, return_value=mock_nb):
        svc = BaselineImportService()
        svc.created_resources["clusters"] = {"Cluster A": "cl-1"}
        svc.created_resources["roles"] = {"VM Role": "role-1"}

    with patch.object(svc, "get_status_uuid", AsyncMock(return_value="status-uuid")):
        with patch(
            "services.nautobot.managers.vm_manager.VirtualMachineManager.create_virtual_machine",
            new_callable=AsyncMock,
            return_value={"id": "vm-new"},
        ) as mock_create_vm:
            created = await svc.create_virtual_machines(
                [
                    {
                        "name": "vm-new",
                        "cluster": "Cluster A",
                        "roles": ["VM Role"],
                    }
                ]
            )

    assert created["vm-new"] == "vm-new"
    mock_create_vm.assert_awaited_once()
