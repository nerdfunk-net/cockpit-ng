"""Unit tests for PortScanDashboardService."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict
from unittest.mock import MagicMock, patch

import pytest

from services.jobs.port_scan_dashboard_service import PortScanDashboardService

_REPO_PATH = "services.jobs.port_scan_dashboard_service.job_run_repository"


def _make_port_scan_run(
    *,
    completed_at: datetime | None = None,
    success: bool = True,
    total_ips_scanned: int = 2,
    total_reachable: int = 2,
    total_hosts_scanned: int = 2,
    total_open_tcp_ports: int = 2,
    total_open_udp_ports: int = 0,
    networks: list[Dict[str, Any]] | None = None,
    job_type: str = "port_scan",
) -> Dict[str, Any]:
    if completed_at is None:
        completed_at = datetime(2026, 7, 6, 12, 0, tzinfo=timezone.utc)
    if networks is None:
        networks = [
            {
                "network": "192.168.1.0/24",
                "total_ips": total_ips_scanned,
                "reachable_count": total_reachable,
                "hosts": [],
            }
        ]

    return {
        "job_type": job_type,
        "status": "completed",
        "completed_at": completed_at,
        "result": json.dumps(
            {
                "success": success,
                "agent_id": "nmap-probe-01",
                "scan_type": "connect",
                "ports": "1-80",
                "networks": networks,
                "total_networks": len(networks),
                "total_ips_scanned": total_ips_scanned,
                "total_reachable": total_reachable,
                "total_hosts_scanned": total_hosts_scanned,
                "total_open_tcp_ports": total_open_tcp_ports,
                "total_open_udp_ports": total_open_udp_ports,
            }
        ),
    }


@pytest.fixture
def svc() -> PortScanDashboardService:
    return PortScanDashboardService()


@pytest.mark.unit
class TestPortScanDashboardSummary:
    @patch(_REPO_PATH)
    def test_empty_runs_returns_no_data(
        self, mock_repo: MagicMock, svc: PortScanDashboardService
    ) -> None:
        mock_repo.get_all_by_types_and_statuses.return_value = []

        result = svc.get_port_scan_summary()

        assert result["has_data"] is False
        assert "No port scan jobs" in result["message"]

    @patch(_REPO_PATH)
    def test_aggregates_single_run(
        self, mock_repo: MagicMock, svc: PortScanDashboardService
    ) -> None:
        mock_repo.get_all_by_types_and_statuses.return_value = [_make_port_scan_run()]

        result = svc.get_port_scan_summary()

        assert result["has_data"] is True
        assert result["total_runs"] == 1
        assert result["successful_runs"] == 1
        assert result["failed_runs"] == 0
        assert result["total_ips_scanned"] == 2
        assert result["total_reachable"] == 2
        assert result["total_unreachable"] == 0
        assert result["total_open_tcp_ports"] == 2
        assert result["total_open_udp_ports"] == 0
        assert result["total_networks"] == 1
        assert result["reachability_percent"] == 100.0
        assert result["latest_completed_at"] is not None

    @patch(_REPO_PATH)
    def test_details_returns_latest_network_per_name(
        self, mock_repo: MagicMock, svc: PortScanDashboardService
    ) -> None:
        mock_repo.get_all_by_types_and_statuses.return_value = [
            _make_port_scan_run(
                completed_at=datetime(2026, 7, 6, 14, 0, tzinfo=timezone.utc),
                networks=[
                    {
                        "network": "192.168.1.0/24",
                        "total_ips": 2,
                        "reachable_count": 2,
                        "hosts": [
                            {
                                "ip_address": "192.168.1.10",
                                "hostname": "host-a",
                                "host_status": "up",
                                "tcp_ports": [{"address": "*", "port": 22}],
                                "udp_ports": [],
                                "success": True,
                            }
                        ],
                    }
                ],
            ),
            _make_port_scan_run(
                completed_at=datetime(2026, 7, 6, 10, 0, tzinfo=timezone.utc),
                networks=[
                    {
                        "network": "192.168.1.0/24",
                        "total_ips": 1,
                        "reachable_count": 1,
                        "hosts": [
                            {
                                "ip_address": "192.168.1.99",
                                "hostname": "old-host",
                                "host_status": "up",
                                "tcp_ports": [],
                                "udp_ports": [],
                                "success": True,
                            }
                        ],
                    },
                    {
                        "network": "10.0.0.0/8",
                        "total_ips": 5,
                        "reachable_count": 3,
                        "hosts": [],
                    },
                ],
            ),
        ]

        result = svc.get_port_scan_details()

        assert result["has_data"] is True
        assert result["total_networks"] == 2
        assert len(result["networks"]) == 2
        assert result["networks"][0]["network"] == "10.0.0.0/8"
        assert result["networks"][1]["network"] == "192.168.1.0/24"
        assert result["networks"][1]["hosts"][0]["ip_address"] == "192.168.1.10"
        assert result["networks"][1]["open_tcp_ports"] == 1

    @patch(_REPO_PATH)
    def test_details_empty_when_no_valid_results(
        self, mock_repo: MagicMock, svc: PortScanDashboardService
    ) -> None:
        mock_repo.get_all_by_types_and_statuses.return_value = []

        result = svc.get_port_scan_details()

        assert result["has_data"] is False

    @patch(_REPO_PATH)
    def test_aggregates_multiple_runs(
        self, mock_repo: MagicMock, svc: PortScanDashboardService
    ) -> None:
        mock_repo.get_all_by_types_and_statuses.return_value = [
            _make_port_scan_run(
                completed_at=datetime(2026, 7, 6, 14, 0, tzinfo=timezone.utc),
                total_ips_scanned=3,
                total_reachable=2,
                total_hosts_scanned=2,
                total_open_tcp_ports=4,
            ),
            _make_port_scan_run(
                completed_at=datetime(2026, 7, 6, 10, 0, tzinfo=timezone.utc),
                total_ips_scanned=5,
                total_reachable=4,
                total_hosts_scanned=4,
                total_open_tcp_ports=6,
                networks=[
                    {
                        "network": "10.0.0.0/8",
                        "total_ips": 5,
                        "reachable_count": 4,
                        "hosts": [],
                    }
                ],
            ),
        ]

        result = svc.get_port_scan_summary()

        assert result["has_data"] is True
        assert result["total_runs"] == 2
        assert result["total_ips_scanned"] == 8
        assert result["total_reachable"] == 6
        assert result["total_unreachable"] == 2
        assert result["total_open_tcp_ports"] == 10
        assert result["total_networks"] == 2
        assert result["reachability_percent"] == 75.0
        assert result["latest_completed_at"] == "2026-07-06T14:00:00+00:00"

    @patch(_REPO_PATH)
    def test_includes_nmap_scan_network_job_type(
        self, mock_repo: MagicMock, svc: PortScanDashboardService
    ) -> None:
        mock_repo.get_all_by_types_and_statuses.return_value = [
            _make_port_scan_run(job_type="nmap_scan_network")
        ]

        result = svc.get_port_scan_summary()

        assert result["has_data"] is True
        assert result["total_runs"] == 1

    @patch(_REPO_PATH)
    def test_skips_runs_without_valid_port_scan_result(
        self, mock_repo: MagicMock, svc: PortScanDashboardService
    ) -> None:
        mock_repo.get_all_by_types_and_statuses.return_value = [
            {
                "job_type": "port_scan",
                "status": "completed",
                "completed_at": datetime.now(timezone.utc),
                "result": json.dumps({"success": True, "message": "not a port scan"}),
            }
        ]

        result = svc.get_port_scan_summary()

        assert result["has_data"] is False
        assert result["message"] == "No valid port scan results found"
