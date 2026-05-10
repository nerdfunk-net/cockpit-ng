"""Unit tests for tasks/update_devices_task.py.

Covers the _prepare_device_data() pure function and the update_devices_task
Celery task. All tests run offline — no Nautobot, database, or Celery broker
required.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tasks.update_devices_task import _prepare_device_data, update_devices_task

_PATCH_SF = "tasks.update_devices_task.service_factory"
_PATCH_SVC = "tasks.update_devices_task.DeviceUpdateService"


# ── _prepare_device_data ──────────────────────────────────────────────────────


class TestPrepareDeviceData:
    """Tests for the _prepare_device_data() pure function."""

    def test_id_goes_to_identifier_not_update_data(self):
        """id is extracted as identifier and excluded from update_data."""
        data = {"id": "dev-uuid", "status": "active"}
        identifier, update_data, _, _ = _prepare_device_data(data)
        assert identifier["id"] == "dev-uuid"
        assert "id" not in update_data
        assert update_data["status"] == "active"

    def test_name_goes_to_identifier_not_update_data(self):
        """name is extracted as identifier and excluded from update_data."""
        data = {"name": "router1", "status": "active"}
        identifier, update_data, _, _ = _prepare_device_data(data)
        assert identifier["name"] == "router1"
        assert "name" not in update_data

    def test_ip_address_goes_to_identifier_not_update_data(self):
        """ip_address is extracted as identifier and excluded from update_data."""
        data = {"ip_address": "10.0.0.1", "role": "edge"}
        identifier, update_data, _, _ = _prepare_device_data(data)
        assert identifier["ip_address"] == "10.0.0.1"
        assert "ip_address" not in update_data

    def test_all_identifier_fields_can_coexist(self):
        """id, name, and ip_address can all appear in device_identifier together."""
        data = {"id": "uuid", "name": "router1", "ip_address": "10.0.0.1", "status": "active"}
        identifier, _, _, _ = _prepare_device_data(data)
        assert identifier == {"id": "uuid", "name": "router1", "ip_address": "10.0.0.1"}

    def test_none_values_excluded_from_update_data(self):
        """Fields with None values are excluded from update_data."""
        data = {"name": "r1", "status": None, "role": "edge"}
        _, update_data, _, _ = _prepare_device_data(data)
        assert "status" not in update_data
        assert update_data["role"] == "edge"

    def test_interface_fields_excluded_from_update_data(self):
        """mgmt_interface_* and namespace fields are not placed in update_data."""
        data = {
            "name": "r1",
            "primary_ip4": "10.0.0.1/24",
            "mgmt_interface_name": "eth0",
            "mgmt_interface_type": "1000base-t",
            "mgmt_interface_status": "active",
            "namespace": "Global",
            "add_prefixes_automatically": True,
            "use_assigned_ip_if_exists": False,
        }
        _, update_data, _, _ = _prepare_device_data(data)
        for field in [
            "mgmt_interface_name",
            "mgmt_interface_type",
            "mgmt_interface_status",
            "namespace",
            "add_prefixes_automatically",
            "use_assigned_ip_if_exists",
        ]:
            assert field not in update_data
        assert update_data["primary_ip4"] == "10.0.0.1/24"

    def test_interface_config_built_when_primary_ip4_present(self):
        """interface_config is populated when primary_ip4 is in the data."""
        data = {
            "name": "r1",
            "primary_ip4": "10.0.0.1/24",
            "mgmt_interface_name": "Loopback0",
            "mgmt_interface_type": "virtual",
        }
        _, _, interface_config, _ = _prepare_device_data(data)
        assert interface_config is not None
        assert interface_config["mgmt_interface_name"] == "Loopback0"
        assert interface_config["mgmt_interface_type"] == "virtual"

    def test_interface_config_is_none_without_primary_ip4(self):
        """interface_config is None when primary_ip4 is absent."""
        data = {"name": "r1", "status": "active"}
        _, _, interface_config, _ = _prepare_device_data(data)
        assert interface_config is None

    def test_interfaces_list_extracted_separately(self):
        """interfaces array is returned separately and excluded from update_data."""
        ifaces = [{"name": "eth0", "ip_address": "10.0.0.1/24"}]
        data = {"name": "r1", "interfaces": ifaces, "status": "active"}
        _, update_data, _, interfaces = _prepare_device_data(data)
        assert interfaces == ifaces
        assert "interfaces" not in update_data

    def test_interfaces_non_list_returns_none(self):
        """A non-list interfaces field is discarded (returns None)."""
        data = {"name": "r1", "interfaces": "not-a-list"}
        _, _, _, interfaces = _prepare_device_data(data)
        assert interfaces is None

    def test_empty_device_data_returns_empty_identifier_and_update(self):
        """Completely empty input produces empty identifier and update_data."""
        identifier, update_data, interface_config, interfaces = _prepare_device_data({})
        assert identifier == {}
        assert update_data == {}
        assert interface_config is None
        assert interfaces is None


# ── update_devices_task helpers ───────────────────────────────────────────────


def _make_jrs() -> MagicMock:
    jrs = MagicMock()
    jrs.get_job_run_by_celery_id.return_value = None
    return jrs


def _make_update_svc(result=None, error=None) -> MagicMock:
    svc = MagicMock()
    if error:
        svc.update_device = AsyncMock(side_effect=error)
    else:
        svc.update_device = AsyncMock(
            return_value=result
            or {
                "device_id": "dev-uuid-1",
                "device_name": "router1",
                "updated_fields": ["status"],
                "warnings": [],
            }
        )
    return svc


def _run(devices, dry_run=False, svc=None) -> dict:
    """Run update_devices_task synchronously with all external deps mocked."""
    if svc is None:
        svc = _make_update_svc()
    with patch.object(update_devices_task, "update_state"):
        with patch(_PATCH_SF) as mock_sf:
            mock_sf.build_nautobot_service.return_value = MagicMock()
            mock_sf.build_job_run_service.return_value = _make_jrs()
            with patch(_PATCH_SVC, return_value=svc):
                return update_devices_task.run(devices, dry_run=dry_run)


# ── update_devices_task tests ─────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.nautobot
def test_update_devices_task_empty_list_returns_failure():
    """Empty device list returns success=False without calling the service."""
    with patch.object(update_devices_task, "update_state"):
        with patch(_PATCH_SF) as mock_sf:
            mock_sf.build_job_run_service.return_value = _make_jrs()
            result = update_devices_task.run([])
    assert result["success"] is False
    assert "No devices" in result["error"]


@pytest.mark.unit
@pytest.mark.nautobot
def test_update_devices_task_dry_run_records_success_without_service_call():
    """Dry run records device in successes and does not call update_device."""
    svc = _make_update_svc()
    devices = [{"name": "router1", "status": "active"}]
    result = _run(devices, dry_run=True, svc=svc)
    assert result["success"] is True
    assert result["successful_updates"] == 1
    assert result["dry_run"] is True
    assert result["results"]["successes"][0]["dry_run"] is True
    svc.update_device.assert_not_called()


@pytest.mark.unit
@pytest.mark.nautobot
def test_update_devices_task_service_success_counts_correctly():
    """Successful service update is added to successes."""
    devices = [{"name": "router1", "status": "active"}]
    result = _run(devices)
    assert result["success"] is True
    assert result["successful_updates"] == 1
    assert result["failed_updates"] == 0
    assert result["results"]["successes"][0]["device_name"] == "router1"


@pytest.mark.unit
@pytest.mark.nautobot
def test_update_devices_task_service_error_goes_to_failures():
    """Service exception is caught and device is recorded in failures."""
    svc = _make_update_svc(error=RuntimeError("Nautobot 404"))
    devices = [{"name": "router1", "status": "active"}]
    result = _run(devices, svc=svc)
    assert result["success"] is True  # task-level success; partial failures allowed
    assert result["failed_updates"] == 1
    assert "Nautobot 404" in result["results"]["failures"][0]["error"]


@pytest.mark.unit
@pytest.mark.nautobot
def test_update_devices_task_non_dict_device_is_skipped():
    """A non-dict entry in the device list is counted as skipped."""
    devices = ["not-a-dict", {"name": "router1", "status": "active"}]
    result = _run(devices)
    assert result["skipped_updates"] == 1
    assert result["successful_updates"] == 1


@pytest.mark.unit
@pytest.mark.nautobot
def test_update_devices_task_no_updateable_data_skips_device():
    """Device with only identifier fields and no other data is skipped."""
    # Only "name" — that goes to identifier, leaving update_data empty
    devices = [{"name": "router1"}]
    result = _run(devices)
    assert result["skipped_updates"] == 1
    assert result["successful_updates"] == 0


@pytest.mark.unit
@pytest.mark.nautobot
def test_update_devices_task_multiple_devices_all_succeed():
    """Multiple devices are each processed and counted correctly."""
    svc = MagicMock()
    svc.update_device = AsyncMock(
        side_effect=[
            {"device_id": "id-1", "device_name": "r1", "updated_fields": ["status"], "warnings": []},
            {"device_id": "id-2", "device_name": "r2", "updated_fields": ["role"], "warnings": []},
        ]
    )
    devices = [
        {"name": "r1", "status": "active"},
        {"name": "r2", "role": "leaf"},
    ]
    result = _run(devices, svc=svc)
    assert result["devices_processed"] == 2
    assert result["successful_updates"] == 2
    assert result["failed_updates"] == 0


@pytest.mark.unit
@pytest.mark.nautobot
def test_update_devices_task_mixed_success_and_failure():
    """Combination of successes and failures is counted independently."""
    svc = MagicMock()
    svc.update_device = AsyncMock(
        side_effect=[
            {"device_id": "id-1", "device_name": "r1", "updated_fields": ["status"], "warnings": []},
            RuntimeError("not found"),
        ]
    )
    devices = [
        {"name": "r1", "status": "active"},
        {"name": "r2", "status": "planned"},
    ]
    result = _run(devices, svc=svc)
    assert result["successful_updates"] == 1
    assert result["failed_updates"] == 1
