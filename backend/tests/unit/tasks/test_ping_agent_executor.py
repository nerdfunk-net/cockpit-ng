"""Unit tests for tasks/execution/ping_agent_executor.py."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tasks.execution.ping_agent_executor import (
    _resolve_devices_from_inventory,
    execute_ping_agent,
)

_PATCH_DB = "core.database.SessionLocal"
_PATCH_AGENT = "services.cockpit_agent.cockpit_agent_service.CockpitAgentService"
_PATCH_RESOLVE = "tasks.execution.ping_agent_executor._resolve_devices_from_inventory"

_DEVICES = [
    {
        "device_name": "r1",
        "device_id": "dev-1",
        "ip_addresses": ["10.0.0.1"],
    }
]


def _db_mock() -> MagicMock:
    db = MagicMock()
    db.close = MagicMock()
    return db


def _call(job_parameters=None, template=None):
    return execute_ping_agent(
        schedule_id=None,
        credential_id=None,
        job_parameters=job_parameters,
        target_devices=None,
        task_context=MagicMock(),
        template=template,
        job_run_id=5,
    )


@pytest.mark.unit
def test_execute_ping_agent_missing_agent_id() -> None:
    result = _call(job_parameters={"devices": _DEVICES})

    assert result["success"] is False
    assert "agent_id" in result["error"]


@pytest.mark.unit
def test_execute_ping_agent_reads_agent_from_template() -> None:
    with patch(_PATCH_DB, return_value=_db_mock()):
        with patch(_PATCH_AGENT) as agent_cls:
            agent_cls.return_value.check_agent_online.return_value = False
            result = _call(
                job_parameters={"devices": _DEVICES},
                template={"ping_agent_id": "agent-tmpl"},
            )

    assert result["success"] is False
    assert "offline" in result["error"].lower()


@pytest.mark.unit
def test_execute_ping_agent_no_devices() -> None:
    result = _call(job_parameters={"agent_id": "agent-1"})

    assert result["success"] is False
    assert "No devices" in result["error"]


@pytest.mark.unit
def test_execute_ping_agent_resolves_inventory_on_failure() -> None:
    with patch(_PATCH_RESOLVE, side_effect=RuntimeError("inventory missing")):
        result = _call(
            job_parameters={"agent_id": "agent-1", "inventory_id": 99},
        )

    assert result["success"] is False
    assert "inventory" in result["error"].lower()


@pytest.mark.unit
def test_execute_ping_agent_agent_offline() -> None:
    with patch(_PATCH_DB, return_value=_db_mock()):
        with patch(_PATCH_AGENT) as agent_cls:
            agent_cls.return_value.check_agent_online.return_value = False
            result = _call(
                job_parameters={"agent_id": "agent-1", "devices": _DEVICES},
            )

    assert result["success"] is False
    assert "offline" in result["error"].lower()


@pytest.mark.unit
def test_execute_ping_agent_timeout() -> None:
    with patch(_PATCH_DB, return_value=_db_mock()):
        with patch(_PATCH_AGENT) as agent_cls:
            agent_cls.return_value.check_agent_online.return_value = True
            agent_cls.return_value.send_ping.return_value = {"status": "timeout"}
            result = _call(
                job_parameters={"agent_id": "agent-1", "devices": _DEVICES},
            )

    assert result["success"] is False
    assert "timed out" in result["error"].lower()


@pytest.mark.unit
def test_execute_ping_agent_error_status() -> None:
    with patch(_PATCH_DB, return_value=_db_mock()):
        with patch(_PATCH_AGENT) as agent_cls:
            agent_cls.return_value.check_agent_online.return_value = True
            agent_cls.return_value.send_ping.return_value = {
                "status": "error",
                "error": "agent rejected command",
            }
            result = _call(
                job_parameters={"agent_id": "agent-1", "devices": _DEVICES},
            )

    assert result["success"] is False
    assert "rejected" in result["error"]


@pytest.mark.unit
def test_execute_ping_agent_success_parses_json_output() -> None:
    output = {
        "total_devices": 1,
        "reachable_count": 1,
        "unreachable_count": 0,
        "results": [],
    }
    with patch(_PATCH_DB, return_value=_db_mock()):
        with patch(_PATCH_AGENT) as agent_cls:
            agent_cls.return_value.check_agent_online.return_value = True
            agent_cls.return_value.send_ping.return_value = {
                "status": "completed",
                "command_id": "cmd-1",
                "output": json.dumps(output),
                "execution_time_ms": 120,
            }
            result = _call(
                job_parameters={
                    "agent_id": "agent-1",
                    "devices": _DEVICES,
                    "sent_by": "tester",
                },
            )

    assert result["success"] is True
    assert result["reachable_count"] == 1
    assert result["command_id"] == "cmd-1"
    agent_cls.return_value.send_ping.assert_called_once()
    assert agent_cls.return_value.send_ping.call_args.kwargs["sent_by"] == "tester"


@pytest.mark.unit
def test_execute_ping_agent_closes_db_on_exception() -> None:
    db = _db_mock()

    with patch(_PATCH_DB, return_value=db):
        with patch(_PATCH_AGENT) as agent_cls:
            agent_cls.return_value.check_agent_online.side_effect = RuntimeError("boom")
            result = _call(
                job_parameters={"agent_id": "agent-1", "devices": _DEVICES},
            )

    assert result["success"] is False
    db.close.assert_called_once()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_resolve_devices_from_inventory() -> None:
    device = MagicMock()
    device.name = "r1"
    device.id = "dev-1"

    mock_persistence = MagicMock()
    mock_persistence.get_inventory.return_value = {"conditions": [{"version": 2}]}
    mock_inventory = MagicMock()
    mock_inventory.preview_inventory = AsyncMock(return_value=([device], 1))
    mock_nb = MagicMock()
    mock_nb.graphql_query = AsyncMock(
        return_value={
            "data": {
                "devices": [
                    {
                        "interfaces": [
                            {
                                "ip_address_assignments": [
                                    {
                                        "ip_address": {
                                            "id": "ip-1",
                                            "address": "10.0.0.1/24",
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        }
    )

    with patch(
        "service_factory.build_inventory_persistence_service",
        return_value=mock_persistence,
    ):
        with patch(
            "service_factory.build_inventory_service",
            return_value=mock_inventory,
        ):
            with patch("service_factory.build_nautobot_service", return_value=mock_nb):
                with patch(
                    "routers.cockpit_agent._conditions_to_operations",
                    return_value=[],
                ):
                    devices = await _resolve_devices_from_inventory(7)

    assert len(devices) == 1
    assert devices[0]["device_name"] == "r1"
    assert devices[0]["ip_addresses"]
