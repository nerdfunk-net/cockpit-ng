"""Unit tests for services/servers/ansible_ops.py."""

from __future__ import annotations

from dataclasses import FrozenInstanceError
from unittest.mock import MagicMock, patch

import pytest

from services.cockpit_agent.ansible_auth import ResolvedAnsibleAuth
from services.servers.ansible_ops import (
    HostScanResult,
    PrefixScanConfig,
    ServerAnsibleOperationsService,
)

_PATCH_EXPAND = "tasks.ping_network_task._expand_cidr_to_ips"
_PATCH_FPING = "tasks.ping_network_task._fping_networks"

_FACTS_OUTPUT = {
    "facts": {
        "ansible_facts": {
            "fqdn": "host1.example.com",
            "hostname": "host1",
            "os_family": "Debian",
        },
        "ansible_virtualization_role": "host",
    },
    "ip_address": "10.0.0.5",
    "hostname": "host1",
}

_PORTS_OUTPUT = {
    "tcp_ports": [{"address": "0.0.0.0", "port": 22}],
    "udp_ports": [{"address": "0.0.0.0", "port": 123}],
    "ip_address": "10.0.0.5",
    "hostname": "host1.example.com",
}


def _server_mock(server_id: int = 1, hostname: str = "host1", **creds) -> MagicMock:
    server = MagicMock(id=server_id, hostname=hostname)
    server.ansible_credentials = creds or None
    return server


def _ops(servers_service=None, agent_service=None) -> ServerAnsibleOperationsService:
    return ServerAnsibleOperationsService(
        servers_service=servers_service or MagicMock(),
        agent_service=agent_service or MagicMock(),
    )


# ---------------------------------------------------------------------------
# Single-host refresh
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_refresh_facts_server_not_found() -> None:
    servers_service = MagicMock()
    servers_service.get_by_id.return_value = None
    ops = _ops(servers_service=servers_service)

    result = ops.refresh_facts_for_server(1, sent_by="tester")

    assert result.success is False
    assert "not found" in result.error


@pytest.mark.unit
def test_refresh_facts_no_stored_credentials() -> None:
    servers_service = MagicMock()
    servers_service.get_by_id.return_value = _server_mock()
    ops = _ops(servers_service=servers_service)

    result = ops.refresh_facts_for_server(1, sent_by="tester")

    assert result.success is False
    assert "No stored Ansible connection settings" in result.error


@pytest.mark.unit
def test_refresh_facts_incomplete_credentials() -> None:
    servers_service = MagicMock()
    servers_service.get_by_id.return_value = _server_mock(
        agent_id="agent-1", target="10.0.0.5", use_sshkey=False, credential_id=None
    )
    ops = _ops(servers_service=servers_service)

    result = ops.refresh_facts_for_server(1, sent_by="tester")

    assert result.success is False
    assert "incomplete" in result.error


@pytest.mark.unit
def test_refresh_facts_agent_offline() -> None:
    servers_service = MagicMock()
    servers_service.get_by_id.return_value = _server_mock(
        agent_id="agent-1", target="10.0.0.5", use_sshkey=True, credential_id=None
    )
    agent_service = MagicMock()
    agent_service.check_agent_online.return_value = False
    ops = _ops(servers_service=servers_service, agent_service=agent_service)

    result = ops.refresh_facts_for_server(1, sent_by="tester")

    assert result.success is False
    assert "offline" in result.error.lower()


@pytest.mark.unit
def test_refresh_facts_success_updates_by_server_id() -> None:
    servers_service = MagicMock()
    servers_service.get_by_id.return_value = _server_mock(
        server_id=7,
        hostname="old-name",
        agent_id="agent-1",
        target="10.0.0.5",
        use_sshkey=True,
        ansible_user="svcuser",
        credential_id=None,
    )
    agent_service = MagicMock()
    agent_service.check_agent_online.return_value = True
    agent_service.send_ansible_get_facts.return_value = {
        "status": "success",
        "output": _FACTS_OUTPUT,
    }
    ops = _ops(servers_service=servers_service, agent_service=agent_service)

    result = ops.refresh_facts_for_server(7, sent_by="tester")

    assert result.success is True
    assert result.operation == "update"
    assert result.server_id == 7
    servers_service.update.assert_called_once()
    assert servers_service.update.call_args.args[0] == 7
    servers_service.get_by_hostname.assert_not_called()
    servers_service.create.assert_not_called()


@pytest.mark.unit
def test_refresh_open_ports_success_updates_by_server_id() -> None:
    servers_service = MagicMock()
    servers_service.get_by_id.return_value = _server_mock(
        server_id=7,
        agent_id="agent-1",
        target="10.0.0.5",
        use_sshkey=False,
        ansible_user="admin",
        credential_id=5,
    )
    agent_service = MagicMock()
    agent_service.check_agent_online.return_value = True
    agent_service.send_open_ports_scan.return_value = {
        "status": "success",
        "output": _PORTS_OUTPUT,
    }
    ops = _ops(servers_service=servers_service, agent_service=agent_service)

    result = ops.refresh_open_ports_for_server(7, sent_by="tester")

    assert result.success is True
    assert result.operation == "update"
    update_request = servers_service.update.call_args.args[1]
    assert update_request.open_ports == {
        "tcp_ports": [{"address": "0.0.0.0", "port": 22}],
        "udp_ports": [{"address": "0.0.0.0", "port": 123}],
    }


@pytest.mark.unit
def test_refresh_facts_agent_error_returns_failure() -> None:
    servers_service = MagicMock()
    servers_service.get_by_id.return_value = _server_mock(
        agent_id="agent-1", target="10.0.0.5", use_sshkey=True, credential_id=None
    )
    agent_service = MagicMock()
    agent_service.check_agent_online.return_value = True
    agent_service.send_ansible_get_facts.return_value = {
        "status": "error",
        "error": "login failed",
    }
    ops = _ops(servers_service=servers_service, agent_service=agent_service)

    result = ops.refresh_facts_for_server(1, sent_by="tester")

    assert result.success is False
    assert result.error == "login failed"
    servers_service.update.assert_not_called()


# ---------------------------------------------------------------------------
# Bulk prefix scan
# ---------------------------------------------------------------------------


def _auth(**overrides) -> ResolvedAnsibleAuth:
    defaults = dict(use_sshkey=False, ansible_user="admin", credential_id=5)
    defaults.update(overrides)
    return ResolvedAnsibleAuth(**defaults)


@pytest.mark.unit
def test_run_facts_prefix_scan_invalid_cidr() -> None:
    ops = _ops()
    config = PrefixScanConfig(
        agent_id="agent-1", prefixes=["not-a-cidr"], auth=_auth(), sent_by="tester"
    )

    with patch(_PATCH_EXPAND, side_effect=ValueError("Invalid CIDR: not-a-cidr")):
        result = ops.run_facts_prefix_scan(config)

    assert result["success"] is False
    assert "Invalid CIDR" in result["error"]


@pytest.mark.unit
def test_run_facts_prefix_scan_no_hosts_reachable() -> None:
    ops = _ops()
    config = PrefixScanConfig(
        agent_id="agent-1", prefixes=["10.0.0.0/30"], auth=_auth(), sent_by="tester"
    )

    with patch(_PATCH_EXPAND, return_value=["10.0.0.1", "10.0.0.2"]):
        with patch(_PATCH_FPING, return_value=set()):
            result = ops.run_facts_prefix_scan(config)

    assert result["success"] is True
    assert result["message"] == "No hosts reachable"
    assert result["scanned_ip_count"] == 2


@pytest.mark.unit
def test_run_facts_prefix_scan_agent_offline() -> None:
    agent_service = MagicMock()
    agent_service.check_agent_online.return_value = False
    ops = _ops(agent_service=agent_service)
    config = PrefixScanConfig(
        agent_id="agent-1", prefixes=["10.0.0.0/30"], auth=_auth(), sent_by="tester"
    )

    with patch(_PATCH_EXPAND, return_value=["10.0.0.1"]):
        with patch(_PATCH_FPING, return_value={"10.0.0.1"}):
            result = ops.run_facts_prefix_scan(config)

    assert result["success"] is False
    assert "offline" in result["error"].lower()


@pytest.mark.unit
def test_run_facts_prefix_scan_success_creates_new_server() -> None:
    servers_service = MagicMock()
    servers_service.get_by_hostname.return_value = None
    servers_service.create.return_value = MagicMock(id=42)
    agent_service = MagicMock()
    agent_service.check_agent_online.return_value = True
    agent_service.send_ansible_get_facts.return_value = {
        "status": "success",
        "output": _FACTS_OUTPUT,
    }
    ops = _ops(servers_service=servers_service, agent_service=agent_service)
    config = PrefixScanConfig(
        agent_id="agent-1", prefixes=["10.0.0.0/30"], auth=_auth(), sent_by="tester"
    )

    progress_calls = []
    with patch(_PATCH_EXPAND, return_value=["10.0.0.1"]):
        with patch(_PATCH_FPING, return_value={"10.0.0.1"}):
            result = ops.run_facts_prefix_scan(
                config, progress=lambda c, t, s: progress_calls.append((c, t, s))
            )

    assert result["success"] is True
    assert result["success_count"] == 1
    assert result["failed_count"] == 0
    assert result["results"][0]["operation"] == "create"
    assert result["results"][0]["hostname"] == "host1.example.com"
    servers_service.create.assert_called_once()
    assert progress_calls[-1] == (100, 100, "Done")


@pytest.mark.unit
def test_run_facts_prefix_scan_one_failure_does_not_abort() -> None:
    servers_service = MagicMock()
    servers_service.get_by_hostname.return_value = None
    servers_service.create.return_value = MagicMock(id=1)
    agent_service = MagicMock()
    agent_service.check_agent_online.return_value = True

    def _side_effect(**kwargs):
        if kwargs["ip_address"] == "10.0.0.1":
            return {"status": "success", "output": _FACTS_OUTPUT}
        return {"status": "error", "error": "login failed"}

    agent_service.send_ansible_get_facts.side_effect = _side_effect
    ops = _ops(servers_service=servers_service, agent_service=agent_service)
    config = PrefixScanConfig(
        agent_id="agent-1",
        prefixes=["10.0.0.0/29"],
        auth=_auth(),
        sent_by="tester",
    )

    with patch(_PATCH_EXPAND, return_value=["10.0.0.1", "10.0.0.2"]):
        with patch(_PATCH_FPING, return_value={"10.0.0.1", "10.0.0.2"}):
            result = ops.run_facts_prefix_scan(config)

    assert result["success"] is True
    assert result["success_count"] == 1
    assert result["failed_count"] == 1


@pytest.mark.unit
def test_run_open_ports_prefix_scan_success_updates_existing() -> None:
    servers_service = MagicMock()
    servers_service.get_by_hostname.return_value = MagicMock(id=99)
    agent_service = MagicMock()
    agent_service.check_agent_online.return_value = True
    agent_service.send_open_ports_scan.return_value = {
        "status": "success",
        "output": _PORTS_OUTPUT,
    }
    ops = _ops(servers_service=servers_service, agent_service=agent_service)
    config = PrefixScanConfig(
        agent_id="agent-1", prefixes=["10.0.0.0/30"], auth=_auth(), sent_by="tester"
    )

    with patch(_PATCH_EXPAND, return_value=["10.0.0.1"]):
        with patch(_PATCH_FPING, return_value={"10.0.0.1"}):
            result = ops.run_open_ports_prefix_scan(config)

    assert result["success"] is True
    assert result["results"][0]["operation"] == "update"
    servers_service.update.assert_called_once()
    servers_service.create.assert_not_called()


@pytest.mark.unit
def test_ssh_key_mode_does_not_forward_ansible_user_when_credential_set() -> None:
    """Regression guard for the auth_type -> send_ansible_get_facts mapping:
    ansible_user is only forwarded when credential_id is None (ssh_key mode).
    """
    servers_service = MagicMock()
    servers_service.get_by_hostname.return_value = None
    servers_service.create.return_value = MagicMock(id=1)
    agent_service = MagicMock()
    agent_service.check_agent_online.return_value = True
    agent_service.send_ansible_get_facts.return_value = {
        "status": "success",
        "output": _FACTS_OUTPUT,
    }
    ops = _ops(servers_service=servers_service, agent_service=agent_service)
    config = PrefixScanConfig(
        agent_id="agent-1",
        prefixes=["10.0.0.0/30"],
        auth=_auth(use_sshkey=True, ansible_user="keyuser", credential_id=5),
        sent_by="tester",
    )

    with patch(_PATCH_EXPAND, return_value=["10.0.0.1"]):
        with patch(_PATCH_FPING, return_value={"10.0.0.1"}):
            ops.run_facts_prefix_scan(config)

    call_kwargs = agent_service.send_ansible_get_facts.call_args.kwargs
    assert call_kwargs["ansible_user"] is None
    assert call_kwargs["credential_id"] == 5
    created_creds = servers_service.create.call_args.args[0].ansible_credentials
    assert created_creds.credential_id is None
    assert created_creds.ansible_user == "keyuser"


@pytest.mark.unit
def test_gather_facts_exception_is_caught_as_host_failure() -> None:
    servers_service = MagicMock()
    servers_service.get_by_hostname.side_effect = RuntimeError("db down")
    agent_service = MagicMock()
    agent_service.check_agent_online.return_value = True
    agent_service.send_ansible_get_facts.return_value = {
        "status": "success",
        "output": _FACTS_OUTPUT,
    }
    ops = _ops(servers_service=servers_service, agent_service=agent_service)
    config = PrefixScanConfig(
        agent_id="agent-1", prefixes=["10.0.0.0/30"], auth=_auth(), sent_by="tester"
    )

    with patch(_PATCH_EXPAND, return_value=["10.0.0.1"]):
        with patch(_PATCH_FPING, return_value={"10.0.0.1"}):
            result = ops.run_facts_prefix_scan(config)

    assert result["success"] is True
    assert result["failed_count"] == 1
    assert result["results"][0]["error"] == "db down"


@pytest.mark.unit
def test_host_scan_result_is_frozen() -> None:
    result = HostScanResult(hostname="h", operation="create", success=True)
    with pytest.raises(FrozenInstanceError):
        result.hostname = "other"  # type: ignore[misc]
