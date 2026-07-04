"""Unit tests for tasks/execution/port_scan_executor.py."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from tasks.execution.port_scan_executor import execute_port_scan


@pytest.mark.unit
def test_execute_port_scan_missing_template():
    result = execute_port_scan(
        schedule_id=1,
        credential_id=None,
        job_parameters=None,
        target_devices=None,
        task_context=MagicMock(),
        template=None,
    )

    assert result["success"] is False
    assert "No template provided" in result["error"]


@pytest.mark.unit
def test_execute_port_scan_missing_agent():
    result = execute_port_scan(
        schedule_id=1,
        credential_id=None,
        job_parameters=None,
        target_devices=None,
        task_context=MagicMock(),
        template={
            "port_scan_target_source": "cidr",
            "port_scan_cidrs": ["10.0.0.0/24"],
        },
    )

    assert result["success"] is False
    assert "port_scan_agent_id" in result["error"]


@pytest.mark.unit
def test_execute_port_scan_cidr_success():
    task_context = MagicMock()
    with patch(
        "tasks.nmap_scan_network_task.run_nmap_port_scan",
        return_value={"success": True, "total_reachable": 1},
    ) as mock_run:
        result = execute_port_scan(
            schedule_id=1,
            credential_id=None,
            job_parameters=None,
            target_devices=None,
            task_context=task_context,
            template={
                "port_scan_target_source": "cidr",
                "port_scan_cidrs": ["192.168.1.0/24"],
                "port_scan_agent_id": "nmap-1",
                "port_scan_type": "connect",
                "port_scan_ports": "22,80",
                "port_scan_service_detection": True,
                "port_scan_timeout": 120,
            },
        )

    assert result["success"] is True
    mock_run.assert_called_once_with(
        target_source="cidr",
        cidrs=["192.168.1.0/24"],
        inventory_name=None,
        agent_id="nmap-1",
        executed_by="admin",
        ports="22,80",
        scan_type="connect",
        service_detection=True,
        timeout=120,
        task_context=task_context,
    )


@pytest.mark.unit
def test_execute_port_scan_inventory_success():
    with patch(
        "tasks.nmap_scan_network_task.run_nmap_port_scan",
        return_value={"success": True, "total_reachable": 2},
    ) as mock_run:
        result = execute_port_scan(
            schedule_id=2,
            credential_id=None,
            job_parameters=None,
            target_devices=None,
            task_context=MagicMock(),
            template={
                "port_scan_target_source": "inventory",
                "inventory_name": "prod-routers",
                "port_scan_agent_id": "nmap-1",
            },
        )

    assert result["success"] is True
    assert mock_run.call_args.kwargs["target_source"] == "inventory"
    assert mock_run.call_args.kwargs["inventory_name"] == "prod-routers"
