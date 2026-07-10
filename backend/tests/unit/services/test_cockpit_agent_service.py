"""Unit tests for services/cockpit_agent/cockpit_agent_service.py."""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest
import redis

from services.cockpit_agent.cockpit_agent_service import CockpitAgentService


@pytest.fixture
def service() -> CockpitAgentService:
    db = MagicMock()
    with patch.object(CockpitAgentService, "_get_redis_client") as redis_factory:
        redis_factory.return_value = MagicMock()
        svc = CockpitAgentService(db)
    svc.repository = MagicMock()
    # Commands are HMAC-signed/encrypted with the agent's shared secret,
    # which must be a real string (MagicMock breaks hashing).
    svc.repository.get_agent_shared_secret.return_value = "test-shared-secret"
    return svc


@pytest.mark.unit
def test_send_command_publishes_and_returns_id(service: CockpitAgentService) -> None:
    service.redis_client.publish = MagicMock()

    command_id = service.send_command(
        agent_id="agent-1",
        command="git_pull",
        params={"branch": "main"},
        sent_by="alice",
    )

    assert command_id
    service.repository.save_command.assert_called_once()
    service.redis_client.publish.assert_called_once()
    channel, payload = service.redis_client.publish.call_args[0]
    assert channel == "cockpit-agent:agent-1"
    assert json.loads(payload)["command"] == "git_pull"


@pytest.mark.unit
def test_send_command_redis_error_updates_db(service: CockpitAgentService) -> None:
    service.redis_client.publish.side_effect = redis.RedisError("down")

    with pytest.raises(redis.RedisError):
        service.send_command("agent-1", "ping", {}, "alice")

    service.repository.update_command_result.assert_called_once()


@pytest.mark.unit
def test_send_git_pull_offline_agent(service: CockpitAgentService) -> None:
    with patch.object(service, "check_agent_online", return_value=False):
        result = service.send_git_pull("agent-1", "/repo", "main", "alice")

    assert result["status"] == "error"
    assert "offline" in result["error"].lower()


@pytest.mark.unit
def test_send_git_pull_success(service: CockpitAgentService) -> None:
    with (
        patch.object(service, "check_agent_online", return_value=True),
        patch.object(
            service,
            "send_command_and_wait",
            return_value={"status": "success", "output": "ok"},
        ),
    ):
        result = service.send_git_pull("agent-1", "/repo", "main", "alice", timeout=5)

    assert result["status"] == "success"


@pytest.mark.unit
def test_wait_for_response_success(service: CockpitAgentService) -> None:
    pubsub = MagicMock()
    pubsub.get_message.return_value = {
        "type": "message",
        "data": json.dumps(
            {
                "command_id": "cmd-1",
                "status": "success",
                "output": "done",
                "execution_time_ms": 12,
            }
        ),
    }

    redis_sub = MagicMock()
    redis_sub.pubsub.return_value = pubsub

    with patch("redis.from_url", return_value=redis_sub):
        result = service.wait_for_response("agent-1", "cmd-1", timeout=5)

    assert result["status"] == "success"
    service.repository.update_command_result.assert_called_once()


@pytest.mark.unit
def test_get_agent_status_returns_parsed_fields(service: CockpitAgentService) -> None:
    service.redis_client.hgetall.return_value = {
        "status": "online",
        "last_heartbeat": "1000",
        "version": "1.0",
        "agent_id": "agent-1",
        "capabilities": "ping",
        "started_at": "900",
        "commands_executed": "3",
    }

    status = service.get_agent_status("agent-1")

    assert status is not None
    assert status["status"] == "online"
    assert status["commands_executed"] == 3


@pytest.mark.unit
def test_list_agents_scans_redis_keys(service: CockpitAgentService) -> None:
    service.redis_client.keys.return_value = ["agents:agent-1"]
    with patch.object(
        service,
        "get_agent_status",
        return_value={"agent_id": "agent-1", "status": "online"},
    ):
        agents = service.list_agents()

    assert len(agents) == 1
    assert agents[0]["agent_id"] == "agent-1"


@pytest.mark.unit
def test_wait_for_response_timeout(service: CockpitAgentService) -> None:
    pubsub = MagicMock()
    pubsub.get_message.return_value = None

    redis_sub = MagicMock()
    redis_sub.pubsub.return_value = pubsub

    with patch("redis.from_url", return_value=redis_sub):
        result = service.wait_for_response("agent-1", "cmd-1", timeout=0)

    assert result["status"] == "timeout"


@pytest.mark.unit
def test_send_nmap_scan_offline_agent(service: CockpitAgentService) -> None:
    with patch.object(service, "check_agent_online", return_value=False):
        result = service.send_nmap_scan("nmap-1", "10.0.0.1", "alice", ports="22,80")

    assert result["status"] == "error"
    assert "offline" in result["error"].lower()


@pytest.mark.unit
def test_send_nmap_scan_success(service: CockpitAgentService) -> None:
    with (
        patch.object(service, "check_agent_online", return_value=True),
        patch.object(
            service,
            "send_command_and_wait",
            return_value={"status": "success", "output": {"tcp_ports": []}},
        ) as wait_mock,
    ):
        result = service.send_nmap_scan(
            "nmap-1",
            "10.0.0.1",
            "alice",
            ports="22,80",
            scan_type="connect",
            service_detection=True,
            timeout=120,
        )

    assert result["status"] == "success"
    wait_mock.assert_called_once_with(
        agent_id="nmap-1",
        command="scan_ports",
        params={
            "ip_address": "10.0.0.1",
            "ports": "22,80",
            "scan_type": "connect",
            "service_detection": True,
        },
        sent_by="alice",
        timeout=120,
    )


@pytest.mark.unit
def test_send_get_data_offline_agent(service: CockpitAgentService) -> None:
    with patch.object(service, "check_agent_online", return_value=False):
        result = service.send_get_data("get-data-1", "data-1", "alice")

    assert result["status"] == "error"
    assert "offline" in result["error"].lower()


@pytest.mark.unit
def test_send_get_data_unknown_flow(service: CockpitAgentService) -> None:
    with (
        patch.object(service, "check_agent_online", return_value=True),
        patch.object(
            service,
            "get_agent_status",
            return_value={"data_flows": "data-1,data-2"},
        ),
    ):
        result = service.send_get_data("get-data-1", "data-3", "alice")

    assert result["status"] == "error"
    assert "Unknown flow" in result["error"]


@pytest.mark.unit
def test_send_get_data_success(service: CockpitAgentService) -> None:
    with (
        patch.object(service, "check_agent_online", return_value=True),
        patch.object(
            service,
            "get_agent_status",
            return_value={"data_flows": "data-1,data-2"},
        ),
        patch.object(
            service,
            "send_command_and_wait",
            return_value={"status": "success", "output": {"files": {}}},
        ) as wait_mock,
    ):
        result = service.send_get_data("get-data-1", "data-2", "alice", timeout=90)

    assert result["status"] == "success"
    wait_mock.assert_called_once_with(
        agent_id="get-data-1",
        command="data-2",
        params={},
        sent_by="alice",
        timeout=90,
    )
