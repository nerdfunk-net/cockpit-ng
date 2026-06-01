"""Unit tests for tasks/execution/base_executor.py.

Covers execute_job_type() — the central dispatcher that routes job_type strings
to the correct executor function.

Executor functions are imported LOCALLY inside execute_job_type (not at module
level), so they must be patched at their source module paths, not on the
base_executor module.

All tests run offline. Executor functions are replaced with MagicMock so the
dispatcher routing logic is tested in isolation.
"""

from __future__ import annotations

from contextlib import ExitStack
from unittest.mock import MagicMock, patch

import pytest

from tasks.execution.base_executor import execute_job_type

# Patch targets at source modules (executors are locally imported inside the function)
_EXECUTOR_PATCHES = {
    "execute_cache_devices": "tasks.execution.cache_executor.execute_cache_devices",
    "execute_sync_devices": "tasks.execution.sync_executor.execute_sync_devices",
    "execute_backup": "tasks.execution.backup_executor.execute_backup",
    "execute_run_commands": "tasks.execution.command_executor.execute_run_commands",
    "execute_compare_devices": "tasks.execution.compare_executor.execute_compare_devices",
    "execute_scan_prefixes": "tasks.execution.scan_prefixes_executor.execute_scan_prefixes",
    "execute_deploy_agent": "tasks.execution.deploy_agent_executor.execute_deploy_agent",
    "execute_ip_addresses": "tasks.execution.ip_addresses_executor.execute_ip_addresses",
    "execute_csv_import": "tasks.execution.csv_import_executor.execute_csv_import",
    "execute_csv_export": "tasks.execution.csv_export_executor.execute_csv_export",
    "execute_ping_agent": "tasks.execution.ping_agent_executor.execute_ping_agent",
    "execute_set_primary_ip": "tasks.execution.set_primary_ip_executor.execute_set_primary_ip",
    "execute_get_client_data": "tasks.execution.client_data_executor.execute_get_client_data",
}


def _run(job_type: str, **kwargs) -> tuple[dict, dict]:
    """
    Run execute_job_type with all executors mocked at their source modules.

    Returns (result, mocks_by_name) where mocks_by_name keys are executor function names.
    """
    mocks = {name: MagicMock(return_value={"success": True}) for name in _EXECUTOR_PATCHES}
    with ExitStack() as stack:
        for name, patch_target in _EXECUTOR_PATCHES.items():
            stack.enter_context(patch(patch_target, mocks[name]))
        result = execute_job_type(
            job_type=job_type,
            schedule_id=kwargs.get("schedule_id"),
            credential_id=kwargs.get("credential_id"),
            job_parameters=kwargs.get("job_parameters"),
            target_devices=kwargs.get("target_devices"),
            task_context=MagicMock(),
            template=kwargs.get("template"),
            job_run_id=kwargs.get("job_run_id"),
        )
    return result, mocks


# ── unknown job type ──────────────────────────────────────────────────────────


@pytest.mark.unit
def test_unknown_job_type_returns_error():
    """An unrecognised job_type returns success=False with an error message."""
    result, _ = _run("nonexistent_job")
    assert result["success"] is False
    assert "Unknown job type" in result["error"]
    assert "nonexistent_job" in result["error"]


# ── routing tests ─────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_cache_devices_routed_to_cache_executor():
    """cache_devices job_type calls execute_cache_devices."""
    result, mocks = _run("cache_devices")
    assert result["success"] is True
    mocks["execute_cache_devices"].assert_called_once()


@pytest.mark.unit
def test_sync_devices_routed_to_sync_executor():
    """sync_devices job_type calls execute_sync_devices."""
    result, mocks = _run("sync_devices")
    assert result["success"] is True
    mocks["execute_sync_devices"].assert_called_once()


@pytest.mark.unit
def test_backup_routed_to_backup_executor():
    """backup job_type calls execute_backup."""
    result, mocks = _run("backup")
    assert result["success"] is True
    mocks["execute_backup"].assert_called_once()


@pytest.mark.unit
def test_run_commands_routed_to_command_executor():
    """run_commands job_type calls execute_run_commands."""
    result, mocks = _run("run_commands")
    assert result["success"] is True
    mocks["execute_run_commands"].assert_called_once()


@pytest.mark.unit
def test_compare_devices_routed_to_compare_executor():
    """compare_devices job_type calls execute_compare_devices."""
    result, mocks = _run("compare_devices")
    assert result["success"] is True
    mocks["execute_compare_devices"].assert_called_once()


@pytest.mark.unit
def test_scan_prefixes_routed_to_scan_executor():
    """scan_prefixes job_type calls execute_scan_prefixes."""
    result, mocks = _run("scan_prefixes")
    assert result["success"] is True
    mocks["execute_scan_prefixes"].assert_called_once()


@pytest.mark.unit
def test_deploy_agent_routed_to_agent_executor():
    """deploy_agent job_type calls execute_deploy_agent."""
    result, mocks = _run("deploy_agent")
    assert result["success"] is True
    mocks["execute_deploy_agent"].assert_called_once()


@pytest.mark.unit
def test_ip_addresses_routed_to_ip_executor():
    """ip_addresses job_type calls execute_ip_addresses."""
    result, mocks = _run("ip_addresses")
    assert result["success"] is True
    mocks["execute_ip_addresses"].assert_called_once()


@pytest.mark.unit
def test_csv_import_routed_to_csv_import_executor():
    """csv_import job_type calls execute_csv_import."""
    result, mocks = _run("csv_import")
    assert result["success"] is True
    mocks["execute_csv_import"].assert_called_once()


@pytest.mark.unit
def test_csv_export_routed_to_csv_export_executor():
    """csv_export job_type calls execute_csv_export."""
    result, mocks = _run("csv_export")
    assert result["success"] is True
    mocks["execute_csv_export"].assert_called_once()


@pytest.mark.unit
def test_ping_agent_routed_to_ping_executor():
    """ping_agent job_type calls execute_ping_agent."""
    result, mocks = _run("ping_agent")
    assert result["success"] is True
    mocks["execute_ping_agent"].assert_called_once()


@pytest.mark.unit
def test_set_primary_ip_routed_to_set_ip_executor():
    """set_primary_ip job_type calls execute_set_primary_ip."""
    result, mocks = _run("set_primary_ip")
    assert result["success"] is True
    mocks["execute_set_primary_ip"].assert_called_once()


@pytest.mark.unit
def test_get_client_data_routed_to_client_data_executor():
    """get_client_data job_type calls execute_get_client_data."""
    result, mocks = _run("get_client_data")
    assert result["success"] is True
    mocks["execute_get_client_data"].assert_called_once()


# ── parameter forwarding ──────────────────────────────────────────────────────


@pytest.mark.unit
def test_executor_receives_all_forwarded_parameters():
    """execute_job_type forwards all keyword parameters to the selected executor."""
    task_ctx = MagicMock()
    _, mocks = _run(
        "sync_devices",
        schedule_id=42,
        credential_id=7,
        job_parameters={"key": "val"},
        target_devices=["dev-uuid-1"],
        template={"activate": True},
        job_run_id=99,
    )
    # _run creates its own task_context MagicMock, so rebuild with our ctx
    sync_mock = MagicMock(return_value={"success": True})
    with ExitStack() as stack:
        for name, patch_target in _EXECUTOR_PATCHES.items():
            mock = sync_mock if name == "execute_sync_devices" else MagicMock(return_value={"success": True})
            stack.enter_context(patch(patch_target, mock))
        execute_job_type(
            job_type="sync_devices",
            schedule_id=42,
            credential_id=7,
            job_parameters={"key": "val"},
            target_devices=["dev-uuid-1"],
            task_context=task_ctx,
            template={"activate": True},
            job_run_id=99,
        )
    call_kwargs = sync_mock.call_args.kwargs
    assert call_kwargs["schedule_id"] == 42
    assert call_kwargs["credential_id"] == 7
    assert call_kwargs["job_parameters"] == {"key": "val"}
    assert call_kwargs["target_devices"] == ["dev-uuid-1"]
    assert call_kwargs["task_context"] is task_ctx
    assert call_kwargs["template"] == {"activate": True}
    assert call_kwargs["job_run_id"] == 99
