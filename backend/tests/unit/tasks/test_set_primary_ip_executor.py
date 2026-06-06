"""Unit tests for tasks/execution/set_primary_ip_executor.py."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tasks.execution.set_primary_ip_executor import (
    _execute_interface_name_scaffold,
    _extract_ip_objects,
    execute_set_primary_ip,
)

_PATCH_DB = "core.database.SessionLocal"
_PATCH_AGENT = "services.cockpit_agent.cockpit_agent_service.CockpitAgentService"
_PATCH_RESOLVE = "tasks.execution.set_primary_ip_executor._resolve_devices_with_ip_ids"
_PATCH_PERSISTENCE = "service_factory.build_inventory_persistence_service"
_PATCH_DEVICE_SVC = "services.nautobot.devices.common.DeviceCommonService"


def _db_mock() -> MagicMock:
    db = MagicMock()
    db.close = MagicMock()
    return db


def _call(job_parameters=None, template=None):
    return execute_set_primary_ip(
        schedule_id=None,
        credential_id=None,
        job_parameters=job_parameters or {},
        target_devices=None,
        task_context=MagicMock(),
        template=template,
        job_run_id=8,
    )


@pytest.mark.unit
def test_execute_set_primary_ip_missing_strategy() -> None:
    result = _call()

    assert result["success"] is False
    assert "strategy" in result["error"]


@pytest.mark.unit
def test_execute_set_primary_ip_interface_name_scaffold() -> None:
    result = _call(
        job_parameters={"set_primary_ip_strategy": "interface_name"},
    )

    assert result["success"] is True
    assert result["strategy"] == "interface_name"
    assert "not yet implemented" in result["note"].lower()


@pytest.mark.unit
def test_execute_interface_name_scaffold_direct() -> None:
    result = _execute_interface_name_scaffold()

    assert result["total_devices"] == 0
    assert result["assigned_count"] == 0


@pytest.mark.unit
def test_execute_set_primary_ip_unknown_strategy() -> None:
    result = _call(job_parameters={"set_primary_ip_strategy": "dns_lookup"})

    assert result["success"] is False
    assert "Unknown strategy" in result["error"]


@pytest.mark.unit
def test_execute_ip_reachable_missing_agent_id() -> None:
    result = _call(
        job_parameters={
            "set_primary_ip_strategy": "ip_reachable",
            "inventory_id": 1,
        },
    )

    assert result["success"] is False
    assert "agent_id" in result["error"]


@pytest.mark.unit
def test_execute_ip_reachable_missing_inventory() -> None:
    result = _call(
        job_parameters={
            "set_primary_ip_strategy": "ip_reachable",
            "set_primary_ip_agent_id": "agent-1",
        },
    )

    assert result["success"] is False
    assert "inventory" in result["error"].lower()


@pytest.mark.unit
def test_execute_ip_reachable_resolves_inventory_by_name() -> None:
    mock_persistence = MagicMock()
    mock_persistence.get_inventory_by_name.return_value = None

    with patch(_PATCH_PERSISTENCE, return_value=mock_persistence):
        result = _call(
            job_parameters={"set_primary_ip_strategy": "ip_reachable"},
            template={
                "set_primary_ip_agent_id": "agent-1",
                "inventory_name": "lab",
                "inventory_source": "inventory",
            },
        )

    assert result["success"] is False
    assert "inventory" in result["error"].lower()


@pytest.mark.unit
def test_execute_ip_reachable_assigns_single_reachable_ip() -> None:
    device_records = [
        {
            "device_name": "r1",
            "device_id": "dev-1",
            "ip_objects": [{"id": "ip-uuid", "address": "10.0.0.1/24"}],
        }
    ]
    ping_output = {
        "results": [
            {
                "device_name": "r1",
                "device_id": "dev-1",
                "ip_results": [
                    {
                        "ip_address": "10.0.0.1",
                        "uuid": "ip-uuid",
                        "reachable": True,
                    }
                ],
            }
        ]
    }
    mock_device_svc = MagicMock()
    mock_device_svc.assign_primary_ip_to_device = AsyncMock(return_value=True)

    with patch(_PATCH_RESOLVE, return_value=device_records):
        with patch(_PATCH_DB, return_value=_db_mock()):
            with patch(_PATCH_AGENT) as agent_cls:
                agent_cls.return_value.check_agent_online.return_value = True
                agent_cls.return_value.send_ping.return_value = {
                    "status": "completed",
                    "output": json.dumps(ping_output),
                }
                with patch(_PATCH_DEVICE_SVC, return_value=mock_device_svc):
                    result = _call(
                        job_parameters={
                            "set_primary_ip_strategy": "ip_reachable",
                            "set_primary_ip_agent_id": "agent-1",
                            "inventory_id": 3,
                        },
                    )

    assert result["success"] is True
    assert result["assigned_count"] == 1
    assert result["results"][0]["status"] == "assigned"


@pytest.mark.unit
def test_execute_ip_reachable_skips_ambiguous_reachable_ips() -> None:
    device_records = [
        {
            "device_name": "r1",
            "device_id": "dev-1",
            "ip_objects": [
                {"id": "ip-1", "address": "10.0.0.1/24"},
                {"id": "ip-2", "address": "10.0.0.2/24"},
            ],
        }
    ]
    ping_output = {
        "results": [
            {
                "device_name": "r1",
                "device_id": "dev-1",
                "ip_results": [
                    {"ip_address": "10.0.0.1", "uuid": "ip-1", "reachable": True},
                    {"ip_address": "10.0.0.2", "uuid": "ip-2", "reachable": True},
                ],
            }
        ]
    }

    with patch(_PATCH_RESOLVE, return_value=device_records):
        with patch(_PATCH_DB, return_value=_db_mock()):
            with patch(_PATCH_AGENT) as agent_cls:
                agent_cls.return_value.check_agent_online.return_value = True
                agent_cls.return_value.send_ping.return_value = {
                    "status": "completed",
                    "output": json.dumps(ping_output),
                }
                with patch(_PATCH_DEVICE_SVC, return_value=MagicMock()):
                    result = _call(
                        job_parameters={
                            "set_primary_ip_strategy": "ip_reachable",
                            "set_primary_ip_agent_id": "agent-1",
                            "inventory_id": 3,
                        },
                    )

    assert result["skipped_count"] == 1
    assert result["results"][0]["status"] == "skipped"


@pytest.mark.unit
def test_execute_ip_reachable_marks_unreachable_devices() -> None:
    device_records = [
        {
            "device_name": "r1",
            "device_id": "dev-1",
            "ip_objects": [{"id": "ip-1", "address": "10.0.0.1/24"}],
        }
    ]
    ping_output = {
        "results": [
            {
                "device_name": "r1",
                "device_id": "dev-1",
                "ip_results": [
                    {"ip_address": "10.0.0.1", "uuid": "ip-1", "reachable": False},
                ],
            }
        ]
    }

    with patch(_PATCH_RESOLVE, return_value=device_records):
        with patch(_PATCH_DB, return_value=_db_mock()):
            with patch(_PATCH_AGENT) as agent_cls:
                agent_cls.return_value.check_agent_online.return_value = True
                agent_cls.return_value.send_ping.return_value = {
                    "status": "completed",
                    "output": json.dumps(ping_output),
                }
                with patch(_PATCH_DEVICE_SVC, return_value=MagicMock()):
                    result = _call(
                        job_parameters={
                            "set_primary_ip_strategy": "ip_reachable",
                            "set_primary_ip_agent_id": "agent-1",
                            "inventory_id": 3,
                        },
                    )

    assert result["unreachable_count"] == 1


@pytest.mark.unit
def test_execute_ip_reachable_agent_offline() -> None:
    with patch(
        _PATCH_RESOLVE,
        return_value=[{"device_name": "r1", "device_id": "d1", "ip_objects": []}],
    ):
        with patch(_PATCH_DB, return_value=_db_mock()):
            with patch(_PATCH_AGENT) as agent_cls:
                agent_cls.return_value.check_agent_online.return_value = False
                result = _call(
                    job_parameters={
                        "set_primary_ip_strategy": "ip_reachable",
                        "set_primary_ip_agent_id": "agent-1",
                        "inventory_id": 3,
                    },
                )

    assert result["success"] is False
    assert "offline" in result["error"].lower()


@pytest.mark.unit
def test_execute_ip_reachable_ping_timeout() -> None:
    with patch(
        _PATCH_RESOLVE,
        return_value=[{"device_name": "r1", "device_id": "d1", "ip_objects": []}],
    ):
        with patch(_PATCH_DB, return_value=_db_mock()):
            with patch(_PATCH_AGENT) as agent_cls:
                agent_cls.return_value.check_agent_online.return_value = True
                agent_cls.return_value.send_ping.return_value = {"status": "timeout"}
                result = _call(
                    job_parameters={
                        "set_primary_ip_strategy": "ip_reachable",
                        "set_primary_ip_agent_id": "agent-1",
                        "inventory_id": 3,
                    },
                )

    assert result["success"] is False
    assert "timed out" in result["error"].lower()


@pytest.mark.unit
def test_execute_ip_reachable_fails_without_ip_uuid() -> None:
    device_records = [
        {
            "device_name": "r1",
            "device_id": "dev-1",
            "ip_objects": [{"id": "ip-1", "address": "10.0.0.1/24"}],
        }
    ]
    ping_output = {
        "results": [
            {
                "device_name": "r1",
                "device_id": "dev-1",
                "ip_results": [
                    {"ip_address": "10.0.0.1", "reachable": True},
                ],
            }
        ]
    }

    with patch(_PATCH_RESOLVE, return_value=device_records):
        with patch(_PATCH_DB, return_value=_db_mock()):
            with patch(_PATCH_AGENT) as agent_cls:
                agent_cls.return_value.check_agent_online.return_value = True
                agent_cls.return_value.send_ping.return_value = {
                    "status": "completed",
                    "output": json.dumps(ping_output),
                }
                result = _call(
                    job_parameters={
                        "set_primary_ip_strategy": "ip_reachable",
                        "set_primary_ip_agent_id": "agent-1",
                        "inventory_id": 3,
                    },
                )

    assert result["failed_count"] == 1
    assert "UUID" in result["results"][0]["reason"]


@pytest.mark.asyncio
@pytest.mark.unit
async def test_resolve_devices_with_ip_ids() -> None:
    from tasks.execution.set_primary_ip_executor import _resolve_devices_with_ip_ids

    device = MagicMock()
    device.name = "r1"
    device.id = "dev-1"

    mock_persistence = MagicMock()
    mock_persistence.get_inventory.return_value = {"conditions": []}
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
                    records = await _resolve_devices_with_ip_ids(5)

    assert records[0]["device_name"] == "r1"
    assert records[0]["ip_objects"][0]["id"] == "ip-1"


@pytest.mark.unit
def test_extract_ip_objects_from_graphql_response() -> None:
    graphql_result = {
        "data": {
            "devices": [
                {
                    "interfaces": [
                        {
                            "ip_address_assignments": [
                                {
                                    "ip_address": {
                                        "id": "ip-uuid",
                                        "address": "10.0.0.5/24",
                                    }
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    }

    objects = _extract_ip_objects(graphql_result, "r1")

    assert objects == [{"id": "ip-uuid", "address": "10.0.0.5/24"}]
