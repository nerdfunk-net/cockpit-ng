"""Unit tests for services/checkmk/sync/queries.py."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from services.checkmk.sync.queries import DeviceQueryService


@pytest.mark.asyncio
@pytest.mark.unit
async def test_get_devices_for_sync_success() -> None:
    with (
        patch("service_factory.build_checkmk_config_service"),
        patch("service_factory.build_device_normalization_service"),
        patch("service_factory.build_priority_rule_evaluator"),
    ):
        svc = DeviceQueryService()

    nautobot = MagicMock()
    nautobot.graphql_query = AsyncMock(
        return_value={
            "data": {
                "devices": [
                    {
                        "id": "1",
                        "name": "sw1",
                        "role": {"name": "access"},
                        "status": {"name": "active"},
                        "location": {"name": "DC"},
                    }
                ]
            }
        }
    )

    with patch("service_factory.build_nautobot_service", return_value=nautobot):
        result = await svc.get_devices_for_sync()

    assert result.total == 1
    assert result.devices[0]["name"] == "sw1"
    nautobot.graphql_query.assert_awaited_once()
    _, variables = nautobot.graphql_query.await_args.args
    assert variables == {}


@pytest.mark.asyncio
@pytest.mark.unit
async def test_get_devices_for_sync_require_primary_ip() -> None:
    with (
        patch("service_factory.build_checkmk_config_service"),
        patch("service_factory.build_device_normalization_service"),
        patch("service_factory.build_priority_rule_evaluator"),
    ):
        svc = DeviceQueryService()

    nautobot = MagicMock()
    nautobot.graphql_query = AsyncMock(
        return_value={
            "data": {
                "devices": [
                    {
                        "id": "2",
                        "name": "sw2",
                        "role": {"name": "core"},
                        "status": {"name": "active"},
                        "location": {"name": "DC"},
                    }
                ]
            }
        }
    )

    with patch("service_factory.build_nautobot_service", return_value=nautobot):
        result = await svc.get_devices_for_sync(require_primary_ip=True)

    assert result.total == 1
    assert result.devices[0]["name"] == "sw2"
    assert "primary IP address" in result.message
    nautobot.graphql_query.assert_awaited_once()
    call_args = nautobot.graphql_query.await_args
    assert call_args is not None
    query, variables = call_args.args
    assert "has_primary_ip" in query
    assert variables == {"has_primary_ip": True}


@pytest.mark.asyncio
@pytest.mark.unit
async def test_get_devices_for_sync_graphql_errors() -> None:
    with (
        patch("service_factory.build_checkmk_config_service"),
        patch("service_factory.build_device_normalization_service"),
        patch("service_factory.build_priority_rule_evaluator"),
    ):
        svc = DeviceQueryService()

    nautobot = MagicMock()
    nautobot.graphql_query = AsyncMock(return_value={"errors": [{"message": "bad"}]})

    with patch("service_factory.build_nautobot_service", return_value=nautobot):
        with pytest.raises(HTTPException) as exc_info:
            await svc.get_devices_for_sync()

    assert exc_info.value.status_code == 500


@pytest.mark.asyncio
@pytest.mark.unit
async def test_get_device_normalized_not_found() -> None:
    config = MagicMock()
    config.get_query.return_value = "query { device(id: $id) { name } }"

    with (
        patch("service_factory.build_checkmk_config_service", return_value=config),
        patch("service_factory.build_device_normalization_service"),
        patch("service_factory.build_priority_rule_evaluator"),
    ):
        svc = DeviceQueryService()

    nautobot = MagicMock()
    nautobot.graphql_query = AsyncMock(return_value={"data": {"device": None}})

    with patch("service_factory.build_nautobot_service", return_value=nautobot):
        with pytest.raises(HTTPException) as exc_info:
            await svc.get_device_normalized("dev-missing")

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
@pytest.mark.unit
async def test_get_device_normalized_success_with_matched_rule() -> None:
    from models.nb2cmk import DeviceExtensions

    config = MagicMock()
    config.get_query.return_value = "query { device(id: $id) { name } }"
    config.load_config_file.return_value = {"attributes": {}}

    rule = MagicMock()
    rule.id = 5
    rule.filename = "priority.yaml"
    rule.priority_order = 1

    rule_evaluator = MagicMock()
    rule_evaluator.find_matching_rule.return_value = rule

    extensions = DeviceExtensions(
        folder="/dc",
        attributes={"ipaddress": "10.0.0.1"},
        internal={"hostname": "sw1"},
    )
    normalization = MagicMock()
    normalization.normalize_device.return_value = extensions

    with (
        patch("service_factory.build_checkmk_config_service", return_value=config),
        patch(
            "service_factory.build_device_normalization_service",
            return_value=normalization,
        ),
        patch(
            "service_factory.build_priority_rule_evaluator", return_value=rule_evaluator
        ),
    ):
        svc = DeviceQueryService()

    nautobot = MagicMock()
    nautobot.graphql_query = AsyncMock(
        return_value={"data": {"device": {"name": "sw1", "role": {"name": "access"}}}}
    )

    with patch("service_factory.build_nautobot_service", return_value=nautobot):
        result = await svc.get_device_normalized("dev-1")

    assert result["folder"] == "/dc"
    assert result["internal"]["matched_rule"]["filename"] == "priority.yaml"
    config.load_config_file.assert_called_once_with("priority.yaml")
