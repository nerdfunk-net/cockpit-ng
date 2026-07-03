"""Unit tests for tasks/execution/get_open_ports_executor.py."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from tasks.execution.get_open_ports_executor import execute_get_open_ports

_PATCH_DB = "core.database.SessionLocal"
_PATCH_AGENT = "services.cockpit_agent.cockpit_agent_service.CockpitAgentService"
_PATCH_CREDENTIALS = "service_factory.build_credentials_service"
_PATCH_SERVERS = "service_factory.build_servers_service"
_PATCH_EXPAND = "tasks.ping_network_task._expand_cidr_to_ips"
_PATCH_FPING = "tasks.ping_network_task._fping_networks"

_PORTS_OUTPUT = {
    "tcp_ports": [
        {"address": "0.0.0.0", "port": 22},
        {"address": "127.0.0.1", "port": 80},
    ],
    "udp_ports": [{"address": "0.0.0.0", "port": 123}],
    "ip_address": "10.0.0.5",
    "hostname": "host1.example.com",
}


def _db_mock() -> MagicMock:
    db = MagicMock()
    db.close = MagicMock()
    return db


def _credentials_mock(username: str = "admin") -> MagicMock:
    credentials = MagicMock()
    credentials.get_credential_by_id.return_value = {"username": username}
    return credentials


def _call(job_parameters=None, template=None, credential_id=5):
    return execute_get_open_ports(
        schedule_id=None,
        credential_id=credential_id,
        job_parameters=job_parameters,
        target_devices=None,
        task_context=MagicMock(),
        template=template,
        job_run_id=7,
    )


@pytest.mark.unit
def test_missing_agent_id() -> None:
    result = _call(job_parameters={"prefixes": ["10.0.0.0/24"]})
    assert result["success"] is False
    assert "agent_id" in result["error"]


@pytest.mark.unit
def test_missing_prefixes() -> None:
    result = _call(job_parameters={"agent_id": "agent-1"})
    assert result["success"] is False
    assert "prefixes" in result["error"].lower()


@pytest.mark.unit
def test_missing_credential_id() -> None:
    result = _call(
        job_parameters={"agent_id": "agent-1", "prefixes": ["10.0.0.0/24"]},
        credential_id=None,
    )
    assert result["success"] is False
    assert "credential_id" in result["error"]


@pytest.mark.unit
def test_invalid_auth_type_returns_error() -> None:
    result = _call(
        job_parameters={
            "agent_id": "agent-1",
            "prefixes": ["10.0.0.0/24"],
            "open_ports_auth_type": "bogus",
        },
    )
    assert result["success"] is False
    assert "Invalid open_ports_auth_type" in result["error"]


@pytest.mark.unit
def test_ssh_key_mode_requires_ansible_user() -> None:
    result = _call(
        job_parameters={
            "agent_id": "agent-1",
            "prefixes": ["10.0.0.0/24"],
            "open_ports_auth_type": "ssh_key",
        },
        credential_id=None,
    )
    assert result["success"] is False
    assert "SSH username" in result["error"]


@pytest.mark.unit
def test_invalid_cidr_returns_error() -> None:
    result = _call(
        job_parameters={"agent_id": "agent-1", "prefixes": ["not-a-cidr"]},
    )
    assert result["success"] is False
    assert "Invalid CIDR" in result["error"]


@pytest.mark.unit
def test_no_hosts_reachable() -> None:
    with patch(_PATCH_EXPAND, return_value=["10.0.0.1", "10.0.0.2"]):
        with patch(_PATCH_FPING, return_value=set()):
            result = _call(
                job_parameters={"agent_id": "agent-1", "prefixes": ["10.0.0.0/30"]},
            )

    assert result["success"] is True
    assert result["message"] == "No hosts reachable"
    assert result["scanned_ip_count"] == 2


@pytest.mark.unit
def test_credential_not_found() -> None:
    credentials = MagicMock()
    credentials.get_credential_by_id.return_value = None

    with patch(_PATCH_EXPAND, return_value=["10.0.0.1"]):
        with patch(_PATCH_FPING, return_value={"10.0.0.1"}):
            with patch(_PATCH_CREDENTIALS, return_value=credentials):
                result = _call(
                    job_parameters={"agent_id": "agent-1", "prefixes": ["10.0.0.0/30"]},
                )

    assert result["success"] is False
    assert "Credential 5 not found" in result["error"]


@pytest.mark.unit
def test_agent_offline() -> None:
    with patch(_PATCH_EXPAND, return_value=["10.0.0.1"]):
        with patch(_PATCH_FPING, return_value={"10.0.0.1"}):
            with patch(_PATCH_CREDENTIALS, return_value=_credentials_mock()):
                with patch(_PATCH_DB, return_value=_db_mock()):
                    with patch(_PATCH_SERVERS, return_value=MagicMock()):
                        with patch(_PATCH_AGENT) as agent_cls:
                            agent_cls.return_value.check_agent_online.return_value = (
                                False
                            )
                            result = _call(
                                job_parameters={
                                    "agent_id": "agent-1",
                                    "prefixes": ["10.0.0.0/30"],
                                },
                            )

    assert result["success"] is False
    assert "offline" in result["error"].lower()


@pytest.mark.unit
def test_success_creates_new_server() -> None:
    servers_service = MagicMock()
    servers_service.get_by_hostname.return_value = None
    servers_service.create.return_value = MagicMock(id=42)

    with patch(_PATCH_EXPAND, return_value=["10.0.0.1"]):
        with patch(_PATCH_FPING, return_value={"10.0.0.1"}):
            with patch(_PATCH_CREDENTIALS, return_value=_credentials_mock()):
                with patch(_PATCH_DB, return_value=_db_mock()):
                    with patch(_PATCH_SERVERS, return_value=servers_service):
                        with patch(_PATCH_AGENT) as agent_cls:
                            agent_cls.return_value.check_agent_online.return_value = (
                                True
                            )
                            agent_cls.return_value.send_open_ports_scan.return_value = {
                                "status": "success",
                                "output": _PORTS_OUTPUT,
                            }
                            result = _call(
                                job_parameters={
                                    "agent_id": "agent-1",
                                    "prefixes": ["10.0.0.0/30"],
                                },
                            )

    assert result["success"] is True
    assert result["success_count"] == 1
    assert result["failed_count"] == 0
    assert result["results"][0]["operation"] == "create"
    assert result["results"][0]["hostname"] == "host1.example.com"
    servers_service.create.assert_called_once()
    created_request = servers_service.create.call_args.args[0]
    assert created_request.open_ports == {
        "tcp_ports": [
            {"address": "0.0.0.0", "port": 22},
            {"address": "127.0.0.1", "port": 80},
        ],
        "udp_ports": [{"address": "0.0.0.0", "port": 123}],
    }
    servers_service.update.assert_not_called()


@pytest.mark.unit
def test_ssh_key_mode_success_skips_credential_lookup() -> None:
    servers_service = MagicMock()
    servers_service.get_by_hostname.return_value = None
    servers_service.create.return_value = MagicMock(id=1)
    credentials = MagicMock()

    with patch(_PATCH_EXPAND, return_value=["10.0.0.1"]):
        with patch(_PATCH_FPING, return_value={"10.0.0.1"}):
            with patch(_PATCH_CREDENTIALS, return_value=credentials):
                with patch(_PATCH_DB, return_value=_db_mock()):
                    with patch(_PATCH_SERVERS, return_value=servers_service):
                        with patch(_PATCH_AGENT) as agent_cls:
                            agent_cls.return_value.check_agent_online.return_value = (
                                True
                            )
                            agent_cls.return_value.send_open_ports_scan.return_value = {
                                "status": "success",
                                "output": _PORTS_OUTPUT,
                            }
                            result = _call(
                                job_parameters={
                                    "agent_id": "agent-1",
                                    "prefixes": ["10.0.0.0/30"],
                                    "open_ports_auth_type": "ssh_key",
                                    "open_ports_ansible_user": "svcuser",
                                },
                                credential_id=None,
                            )

    assert result["success"] is True
    assert result["success_count"] == 1
    credentials.get_credential_by_id.assert_not_called()
    call_kwargs = agent_cls.return_value.send_open_ports_scan.call_args.kwargs
    assert call_kwargs["use_sshkey"] is True
    assert call_kwargs["ansible_user"] == "svcuser"
    assert call_kwargs["credential_id"] is None
    created_creds = servers_service.create.call_args.args[0].ansible_credentials
    assert created_creds.use_sshkey is True
    assert created_creds.ansible_user == "svcuser"
    assert created_creds.credential_id is None


@pytest.mark.unit
def test_success_updates_existing_server() -> None:
    servers_service = MagicMock()
    servers_service.get_by_hostname.return_value = MagicMock(id=99)

    with patch(_PATCH_EXPAND, return_value=["10.0.0.1"]):
        with patch(_PATCH_FPING, return_value={"10.0.0.1"}):
            with patch(_PATCH_CREDENTIALS, return_value=_credentials_mock()):
                with patch(_PATCH_DB, return_value=_db_mock()):
                    with patch(_PATCH_SERVERS, return_value=servers_service):
                        with patch(_PATCH_AGENT) as agent_cls:
                            agent_cls.return_value.check_agent_online.return_value = (
                                True
                            )
                            agent_cls.return_value.send_open_ports_scan.return_value = {
                                "status": "success",
                                "output": _PORTS_OUTPUT,
                            }
                            result = _call(
                                job_parameters={
                                    "agent_id": "agent-1",
                                    "prefixes": ["10.0.0.0/30"],
                                },
                            )

    assert result["success"] is True
    assert result["results"][0]["operation"] == "update"
    servers_service.update.assert_called_once()
    servers_service.create.assert_not_called()


@pytest.mark.unit
def test_one_failed_ip_does_not_abort_batch() -> None:
    servers_service = MagicMock()
    servers_service.get_by_hostname.return_value = None
    servers_service.create.return_value = MagicMock(id=1)

    with patch(_PATCH_EXPAND, return_value=["10.0.0.1", "10.0.0.2"]):
        with patch(_PATCH_FPING, return_value={"10.0.0.1", "10.0.0.2"}):
            with patch(_PATCH_CREDENTIALS, return_value=_credentials_mock()):
                with patch(_PATCH_DB, return_value=_db_mock()):
                    with patch(_PATCH_SERVERS, return_value=servers_service):
                        with patch(_PATCH_AGENT) as agent_cls:
                            agent_cls.return_value.check_agent_online.return_value = (
                                True
                            )

                            def _side_effect(**kwargs):
                                if kwargs["ip_address"] == "10.0.0.1":
                                    return {
                                        "status": "success",
                                        "output": _PORTS_OUTPUT,
                                    }
                                return {"status": "error", "error": "login failed"}

                            agent_cls.return_value.send_open_ports_scan.side_effect = (
                                _side_effect
                            )
                            result = _call(
                                job_parameters={
                                    "agent_id": "agent-1",
                                    "prefixes": ["10.0.0.0/29"],
                                },
                            )

    assert result["success"] is True
    assert result["success_count"] == 1
    assert result["failed_count"] == 1


@pytest.mark.unit
def test_closes_db_on_exception() -> None:
    db = _db_mock()

    with patch(_PATCH_EXPAND, return_value=["10.0.0.1"]):
        with patch(_PATCH_FPING, return_value={"10.0.0.1"}):
            with patch(_PATCH_CREDENTIALS, return_value=_credentials_mock()):
                with patch(_PATCH_DB, return_value=db):
                    with patch(_PATCH_SERVERS, return_value=MagicMock()):
                        with patch(_PATCH_AGENT) as agent_cls:
                            agent_cls.return_value.check_agent_online.side_effect = (
                                RuntimeError("boom")
                            )
                            result = _call(
                                job_parameters={
                                    "agent_id": "agent-1",
                                    "prefixes": ["10.0.0.0/30"],
                                },
                            )

    assert result["success"] is False
    db.close.assert_called_once()
