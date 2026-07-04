"""Unit tests for tasks/nmap_scan_network_task.py."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from tasks.nmap_scan_network_task import nmap_scan_network_task


@pytest.mark.unit
def test_nmap_scan_network_task_rejects_unknown_agent_type():
    with patch("tasks.nmap_scan_network_task._resolve_nmap_agent", return_value=None):
        result = nmap_scan_network_task.run(
            cidrs=["192.168.1.0/24"],
            agent_id="not-nmap",
            executed_by="tester",
        )

    assert result["success"] is False
    assert "not configured as type 'nmap'" in result["error"]


@pytest.mark.unit
def test_nmap_scan_network_task_offline_agent():
    with (
        patch(
            "tasks.nmap_scan_network_task._resolve_nmap_agent", return_value="nmap-1"
        ),
        patch.object(nmap_scan_network_task, "update_state"),
        patch("tasks.nmap_scan_network_task.service_factory") as mock_sf,
        patch("core.database.SessionLocal") as session_cls,
    ):
        jrs = MagicMock()
        jrs.create_job_run.return_value = {"id": 1}
        mock_sf.build_job_run_service.return_value = jrs

        agent_service = MagicMock()
        agent_service.check_agent_online.return_value = False
        session_cls.return_value = MagicMock()

        with patch(
            "tasks.nmap_scan_network_task.CockpitAgentService",
            return_value=agent_service,
        ):
            result = nmap_scan_network_task.run(
                cidrs=["192.168.1.0/24"],
                agent_id="nmap-1",
                executed_by="tester",
            )

    assert result["success"] is False
    assert "offline" in result["error"].lower()
    jrs.mark_failed.assert_called_once()


@pytest.mark.unit
def test_nmap_scan_network_task_no_alive_hosts():
    with (
        patch(
            "tasks.nmap_scan_network_task._resolve_nmap_agent", return_value="nmap-1"
        ),
        patch.object(nmap_scan_network_task, "update_state"),
        patch("tasks.nmap_scan_network_task.service_factory") as mock_sf,
        patch("core.database.SessionLocal") as session_cls,
        patch(
            "tasks.nmap_scan_network_task._expand_cidr_to_ips",
            return_value=["192.168.1.1"],
        ),
        patch("tasks.nmap_scan_network_task._fping_networks", return_value=set()),
    ):
        jrs = MagicMock()
        jrs.create_job_run.return_value = {"id": 1}
        mock_sf.build_job_run_service.return_value = jrs

        agent_service = MagicMock()
        agent_service.check_agent_online.return_value = True
        session_cls.return_value = MagicMock()

        with patch(
            "tasks.nmap_scan_network_task.CockpitAgentService",
            return_value=agent_service,
        ):
            result = nmap_scan_network_task.run(
                cidrs=["192.168.1.0/24"],
                agent_id="nmap-1",
                executed_by="tester",
            )

    assert result["success"] is True
    assert result["total_reachable"] == 0
    assert result["networks"][0]["reachable_count"] == 0
    jrs.mark_completed.assert_called_once()


@pytest.mark.unit
def test_nmap_scan_network_task_inventory_not_found():
    with (
        patch(
            "tasks.nmap_scan_network_task._resolve_nmap_agent", return_value="nmap-1"
        ),
        patch.object(nmap_scan_network_task, "update_state"),
        patch("tasks.nmap_scan_network_task.service_factory") as mock_sf,
        patch("core.database.SessionLocal") as session_cls,
        patch(
            "tasks.nmap_scan_network_task._resolve_inventory_to_ips_sync",
            side_effect=ValueError("Inventory 'missing' not found"),
        ),
    ):
        jrs = MagicMock()
        jrs.create_job_run.return_value = {"id": 1}
        mock_sf.build_job_run_service.return_value = jrs

        agent_service = MagicMock()
        agent_service.check_agent_online.return_value = True
        session_cls.return_value = MagicMock()

        with patch(
            "tasks.nmap_scan_network_task.CockpitAgentService",
            return_value=agent_service,
        ):
            result = nmap_scan_network_task.run(
                cidrs=[],
                agent_id="nmap-1",
                executed_by="tester",
                target_source="inventory",
                inventory_name="missing",
            )

    assert result["success"] is False
    assert "not found" in result["error"]
    jrs.mark_failed.assert_called_once()


@pytest.mark.unit
def test_nmap_scan_network_task_inventory_mode_scans_alive_hosts():
    with (
        patch(
            "tasks.nmap_scan_network_task._resolve_nmap_agent", return_value="nmap-1"
        ),
        patch.object(nmap_scan_network_task, "update_state"),
        patch("tasks.nmap_scan_network_task.service_factory") as mock_sf,
        patch("core.database.SessionLocal") as session_cls,
        patch(
            "tasks.nmap_scan_network_task._resolve_inventory_to_ips_sync",
            return_value=(["10.0.0.1"], {"prod-routers": ["10.0.0.1"]}),
        ),
        patch(
            "tasks.nmap_scan_network_task._fping_networks",
            return_value={"10.0.0.1"},
        ),
    ):
        jrs = MagicMock()
        jrs.create_job_run.return_value = {"id": 1}
        mock_sf.build_job_run_service.return_value = jrs

        agent_service = MagicMock()
        agent_service.check_agent_online.return_value = True
        agent_service.send_nmap_scan.return_value = {
            "status": "success",
            "output": {
                "ip_address": "10.0.0.1",
                "hostname": "router1",
                "host_status": "up",
                "tcp_ports": [{"address": "10.0.0.1", "port": 22}],
                "udp_ports": [],
                "services": [],
                "scan_arguments": "-sT -p 22",
            },
        }
        session_cls.return_value = MagicMock()

        with patch(
            "tasks.nmap_scan_network_task.CockpitAgentService",
            return_value=agent_service,
        ):
            result = nmap_scan_network_task.run(
                cidrs=[],
                agent_id="nmap-1",
                executed_by="tester",
                target_source="inventory",
                inventory_name="prod-routers",
            )

    assert result["success"] is True
    assert result["total_reachable"] == 1
    assert result["networks"][0]["network"] == "prod-routers"
    assert result["total_open_tcp_ports"] == 1
    agent_service.send_nmap_scan.assert_called_once()
    jrs.mark_completed.assert_called_once()
