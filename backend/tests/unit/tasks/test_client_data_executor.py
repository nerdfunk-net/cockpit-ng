"""Unit tests for tasks/execution/client_data_executor.py.

All tests run offline - no SSH, Nautobot, DNS, database, or Celery broker required.
"""

from __future__ import annotations

import socket
from unittest.mock import MagicMock, patch

import pytest

from tasks.execution.client_data_executor import (
    _parse_arp_output,
    _parse_mac_output,
    _resolve_hostnames,
    execute_get_client_data,
)


@pytest.mark.unit
def test_client_data_executor_requires_credential_id() -> None:
    """Missing credentials fail before device lookup or SSH execution."""
    result = execute_get_client_data(
        schedule_id=None,
        credential_id=None,
        job_parameters=None,
        target_devices=["dev-1"],
        task_context=MagicMock(),
    )

    assert result["success"] is False
    assert "No credential_id specified" in result["error"]


@pytest.mark.unit
def test_client_data_executor_returns_noop_when_all_collect_flags_false() -> None:
    """Valid credentials with all collection disabled return a successful no-op."""
    credentials = MagicMock()
    credentials.get_credential_by_id.return_value = {"name": "ssh", "username": "admin"}
    credentials.get_decrypted_password.return_value = "secret"

    with patch("service_factory.build_credentials_service", return_value=credentials):
        result = execute_get_client_data(
            schedule_id=None,
            credential_id=10,
            job_parameters={
                "collect_ip_address": False,
                "collect_mac_address": False,
                "collect_hostname": False,
            },
            target_devices=["dev-1"],
            task_context=MagicMock(),
        )

    assert result["success"] is True
    assert result["message"] == "No commands to execute (all collect_* flags are False)"
    assert result["session_id"] is None


@pytest.mark.unit
def test_parse_arp_and_mac_textfsm_rows() -> None:
    """TextFSM rows are normalized for client-data repository inserts."""
    arp_rows = _parse_arp_output(
        [
            {
                "ip_address": "10.0.0.10",
                "mac_address": "AABB.CC00.0100",
                "interface": "Gi0/1",
            }
        ],
        "switch-01",
        "10.0.0.1",
        "session-1",
        1,
        1,
    )
    mac_rows = _parse_mac_output(
        [
            {
                "destination_address": "AABB.CC00.0100",
                "vlan_id": "100",
                "destination_port": ["Gi0/1"],
            }
        ],
        "switch-01",
        "10.0.0.1",
        "session-1",
        1,
        1,
    )

    assert arp_rows == [
        {
            "session_id": "session-1",
            "ip_address": "10.0.0.10",
            "mac_address": "aabb.cc00.0100",
            "interface": "Gi0/1",
            "device_name": "switch-01",
            "device_ip": "10.0.0.1",
        }
    ]
    assert mac_rows == [
        {
            "session_id": "session-1",
            "mac_address": "aabb.cc00.0100",
            "vlan": "100",
            "port": "Gi0/1",
            "device_name": "switch-01",
            "device_ip": "10.0.0.1",
        }
    ]


@pytest.mark.unit
def test_parse_helpers_skip_raw_output_without_textfsm() -> None:
    """Raw command output is ignored when TextFSM parsing did not produce rows."""
    assert _parse_arp_output("raw output", "sw1", "10.0.0.1", "s1", 1, 1) == []
    assert _parse_mac_output("raw output", "sw1", "10.0.0.1", "s1", 1, 1) == []


@pytest.mark.unit
def test_resolve_hostnames_skips_unresolved_ips() -> None:
    """Reverse DNS failures are ignored while successful lookups are returned."""

    def fake_gethostbyaddr(ip: str):
        if ip == "10.0.0.10":
            return ("host10.example.com", [], [ip])
        raise socket.herror("not found")

    with patch(
        "tasks.execution.client_data_executor.socket.gethostbyaddr", fake_gethostbyaddr
    ):
        result = _resolve_hostnames(
            {"10.0.0.10", "10.0.0.11"},
            "switch-01",
            "10.0.0.1",
            "session-1",
        )

    assert result == [
        {
            "session_id": "session-1",
            "ip_address": "10.0.0.10",
            "hostname": "host10.example.com",
            "device_name": "switch-01",
            "device_ip": "10.0.0.1",
        }
    ]


@pytest.mark.unit
def test_client_data_executor_credential_not_found() -> None:
    credentials = MagicMock()
    credentials.get_credential_by_id.return_value = None

    with patch("service_factory.build_credentials_service", return_value=credentials):
        result = execute_get_client_data(
            schedule_id=None,
            credential_id=99,
            job_parameters={"collect_ip_address": True},
            target_devices=["dev-1"],
            task_context=MagicMock(),
        )

    assert result["success"] is False
    assert "not found" in result["error"]


@pytest.mark.unit
def test_client_data_executor_collects_and_persists() -> None:
    """Sequential collection stores ARP rows via ClientDataRepository."""
    from unittest.mock import AsyncMock

    credentials = MagicMock()
    credentials.get_credential_by_id.return_value = {
        "name": "ssh",
        "username": "admin",
    }
    credentials.get_decrypted_password.return_value = "secret"

    mock_nb = MagicMock()
    mock_nb.graphql_query = AsyncMock(
        return_value={
            "data": {
                "device": {
                    "name": "switch-01",
                    "primary_ip4": {"address": "10.0.0.1/24", "host": "10.0.0.1"},
                    "platform": {"network_driver": "cisco_ios"},
                }
            }
        }
    )

    mock_netmiko = MagicMock()
    mock_netmiko.execute_commands = AsyncMock(
        return_value=(
            "netmiko-session",
            [
                {
                    "success": True,
                    "command_outputs": {
                        "show ip arp": [
                            {
                                "ip_address": "10.0.0.10",
                                "mac_address": "AA.BB.CC00.0100",
                                "interface": "Gi0/1",
                            }
                        ],
                    },
                }
            ],
        )
    )

    mock_repo = MagicMock()
    mock_repo.bulk_insert_ip_addresses.return_value = 1
    mock_repo.bulk_insert_mac_addresses.return_value = 0
    mock_repo.bulk_insert_hostnames.return_value = 0

    with patch("service_factory.build_credentials_service", return_value=credentials):
        with patch("service_factory.build_nautobot_service", return_value=mock_nb):
            with patch(
                "services.network.automation.netmiko.NetmikoService",
                return_value=mock_netmiko,
            ):
                with patch(
                    "repositories.client_data.client_data_repository.ClientDataRepository",
                    return_value=mock_repo,
                ):
                    result = execute_get_client_data(
                        schedule_id=None,
                        credential_id=10,
                        job_parameters={
                            "collect_ip_address": True,
                            "collect_mac_address": False,
                            "collect_hostname": False,
                            "parallel_tasks": 1,
                        },
                        target_devices=["dev-1"],
                        task_context=MagicMock(),
                    )

    assert result["success"] is True
    assert result["arp_entries"] == 1
    assert result["session_id"]
    mock_repo.bulk_insert_ip_addresses.assert_called_once()
    mock_repo.delete_old_sessions.assert_called_once_with(keep=5)
