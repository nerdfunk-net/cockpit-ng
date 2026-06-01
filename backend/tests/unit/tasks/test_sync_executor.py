"""Unit tests for tasks/execution/sync_executor.py.

All tests run offline - no Nautobot, CheckMK, database, or Celery broker required.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tasks.execution.sync_executor import _sync_one_device, execute_sync_devices


@pytest.mark.asyncio
@pytest.mark.unit
async def test_sync_one_device_skips_devices_without_primary_ip() -> None:
    """Devices without an IPv4 address are skipped before CheckMK writes."""
    service = MagicMock()
    service.get_device_normalized = AsyncMock(
        return_value={"internal": {"hostname": "router-01"}, "attributes": {}}
    )

    result = await _sync_one_device(service, "dev-1")

    assert result["operation"] == "skip"
    assert result["success"] is False
    service.update_device_in_checkmk.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_sync_one_device_falls_back_to_add_on_not_found() -> None:
    """A missing CheckMK host triggers add_device_to_checkmk."""
    service = MagicMock()
    service.get_device_normalized = AsyncMock(
        return_value={
            "internal": {"hostname": "router-01"},
            "attributes": {"ipaddress": "10.0.0.1"},
        }
    )
    service.update_device_in_checkmk = AsyncMock(
        side_effect=RuntimeError("404 not found")
    )
    service.add_device_to_checkmk = AsyncMock(
        return_value=SimpleNamespace(hostname="router-01", message="Added")
    )

    result = await _sync_one_device(service, "dev-1")

    assert result["operation"] == "add"
    assert result["success"] is True
    service.add_device_to_checkmk.assert_awaited_once_with("dev-1")


@pytest.mark.unit
def test_execute_sync_devices_syncs_targets_and_skips_activation_when_disabled() -> (
    None
):
    """Explicit target devices are synced and activation respects template settings."""
    config = MagicMock()
    nb2cmk = MagicMock()
    nb2cmk.get_device_normalized = AsyncMock(
        return_value={
            "internal": {"hostname": "router-01"},
            "attributes": {"ipaddress": "10.0.0.1"},
        }
    )
    nb2cmk.update_device_in_checkmk = AsyncMock(
        return_value=SimpleNamespace(hostname="router-01", message="Updated")
    )

    with (
        patch("service_factory.build_checkmk_config_service", return_value=config),
        patch("service_factory.build_nb2cmk_service", return_value=nb2cmk),
        patch(
            "tasks.execution.sync_executor._filter_by_last_compare_run",
            return_value=["dev-1"],
        ) as filter_by_compare,
        patch("tasks.execution.sync_executor._activate_checkmk_changes") as activate,
    ):
        result = execute_sync_devices(
            schedule_id=None,
            credential_id=None,
            job_parameters=None,
            target_devices=["dev-1"],
            task_context=MagicMock(),
            template={
                "use_last_compare_run": True,
                "activate_changes_after_sync": False,
            },
        )

    assert result["success"] is True
    assert result["success_count"] == 1
    assert result["activation"] is None
    config.reload_config.assert_called_once()
    filter_by_compare.assert_called_once()
    activate.assert_not_called()


@pytest.mark.unit
def test_execute_sync_devices_no_devices_returns_successful_noop() -> None:
    """An empty target list and empty Nautobot sync source returns a no-op success."""
    config = MagicMock()
    nb2cmk = MagicMock()
    nb2cmk.get_devices_for_sync = AsyncMock(return_value=SimpleNamespace(devices=[]))

    with (
        patch("service_factory.build_checkmk_config_service", return_value=config),
        patch("service_factory.build_nb2cmk_service", return_value=nb2cmk),
    ):
        result = execute_sync_devices(
            schedule_id=None,
            credential_id=None,
            job_parameters=None,
            target_devices=[],
            task_context=MagicMock(),
        )

    assert result == {
        "success": True,
        "message": "No devices to sync",
        "total": 0,
        "success_count": 0,
        "failed_count": 0,
    }
