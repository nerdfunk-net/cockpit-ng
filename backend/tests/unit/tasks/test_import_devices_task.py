"""Unit tests for tasks/import_devices_task.py.

All tests run offline - no Nautobot, database, or Celery broker required.
"""

from __future__ import annotations

from contextlib import ExitStack
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tasks.import_devices_task import _prepare_device_data, import_devices_from_csv_task


@pytest.mark.unit
def test_prepare_device_data_extracts_device_custom_and_interface_fields() -> None:
    """CSV rows are split into device data and optional interface config."""
    row = {
        "name": "router-01",
        "device_type": "ISR",
        "role": "edge",
        "location": "Berlin",
        "cf_asset_owner": "netops",
        "interface_name": "Loopback0",
        "interface_ip_address": "10.0.0.1/32",
        "interface_enabled": "true",
        "interface_mgmt_only": "yes",
        "interface_mtu": "1500",
    }

    device_data, interface_config = _prepare_device_data(row, list(row.keys()), create_interfaces=True)

    assert device_data["name"] == "router-01"
    assert device_data["custom_fields"] == {"asset_owner": "netops"}
    assert "interface_name" not in device_data
    assert interface_config == [
        {
            "name": "Loopback0",
            "type": "virtual",
            "status": "active",
            "ip_address": "10.0.0.1/32",
            "namespace": "Global",
            "is_primary_ipv4": True,
            "enabled": True,
            "mgmt_only": True,
            "mtu": 1500,
        }
    ]


@pytest.mark.unit
def test_import_devices_from_csv_success_and_skipped_device() -> None:
    """The task imports created devices and tracks existing devices as skipped."""
    import_service = MagicMock()
    import_service.import_device = AsyncMock(
        side_effect=[
            {
                "created": True,
                "device_id": "dev-1",
                "device_name": "router-01",
                "warnings": [],
                "details": {"interfaces": [{"id": "if-1"}]},
            },
            {
                "created": False,
                "device_id": "dev-2",
                "device_name": "router-02",
                "warnings": [],
                "details": {"interfaces": []},
            },
        ]
    )
    job_runs = MagicMock()
    job_runs.get_job_run_by_celery_id.return_value = None

    csv_content = "\n".join(
        [
            "name,device_type,role,location,interface_name,interface_ip_address",
            "router-01,ISR,edge,Berlin,Loopback0,10.0.0.1/32",
            "router-02,ISR,edge,Berlin,,",
        ]
    )

    with ExitStack() as stack:
        stack.enter_context(patch("tasks.import_devices_task.service_factory.build_nautobot_service"))
        stack.enter_context(
            patch(
                "tasks.import_devices_task.service_factory.build_job_run_service",
                return_value=job_runs,
            )
        )
        stack.enter_context(
            patch(
                "tasks.import_devices_task.DeviceImportService",
                return_value=import_service,
            )
        )
        stack.enter_context(patch.object(import_devices_from_csv_task, "update_state"))
        result = import_devices_from_csv_task.run(csv_content)

    assert result["success"] is True
    assert result["summary"] == {"total": 2, "successful": 1, "failed": 0, "skipped": 1}
    assert result["successes"][0]["interfaces_created"] == 1
    assert result["skipped"][0]["device_name"] == "router-02"
    assert import_service.import_device.await_count == 2


@pytest.mark.unit
def test_import_devices_from_csv_missing_required_columns_fails() -> None:
    """CSV validation catches missing required import columns before service setup."""
    with patch.object(import_devices_from_csv_task, "update_state"):
        result = import_devices_from_csv_task.run("name,device_type\nrouter-01,ISR")

    assert result["success"] is False
    assert "missing required columns" in result["error"]


@pytest.mark.unit
def test_import_devices_from_csv_records_service_failure() -> None:
    """Per-device import exceptions are aggregated as failures."""
    import_service = MagicMock()
    import_service.import_device = AsyncMock(side_effect=RuntimeError("Nautobot rejected"))
    job_runs = MagicMock()
    job_runs.get_job_run_by_celery_id.return_value = None

    csv_content = "name,device_type,role,location\nrouter-01,ISR,edge,Berlin"

    with ExitStack() as stack:
        stack.enter_context(patch("tasks.import_devices_task.service_factory.build_nautobot_service"))
        stack.enter_context(
            patch(
                "tasks.import_devices_task.service_factory.build_job_run_service",
                return_value=job_runs,
            )
        )
        stack.enter_context(
            patch(
                "tasks.import_devices_task.DeviceImportService",
                return_value=import_service,
            )
        )
        stack.enter_context(patch.object(import_devices_from_csv_task, "update_state"))
        result = import_devices_from_csv_task.run(csv_content)

    assert result["summary"]["failed"] == 1
    assert result["failures"] == [{"device_name": "router-01", "error": "Nautobot rejected"}]
