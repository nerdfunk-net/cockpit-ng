"""Unit tests for tasks/execution/ip_addresses_executor.py."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from tasks.execution.ip_addresses_executor import execute_ip_addresses

_PATCH_SVC = "services.nautobot.ip_addresses.IPAddressQueryService"

_TEMPLATE_LIST = {
    "ip_action": "list",
    "ip_filter_field": "cf_last_scan",
    "ip_filter_type": "lte",
    "ip_filter_value": "2024-01-01",
    "ip_include_null": False,
}


def _call(template=None):
    return execute_ip_addresses(
        schedule_id=None,
        credential_id=None,
        job_parameters=None,
        target_devices=None,
        task_context=MagicMock(),
        template=template,
        job_run_id=1,
    )


@pytest.mark.unit
def test_execute_ip_addresses_missing_filter_config() -> None:
    result = _call(template={"ip_action": "list"})

    assert result["success"] is False
    assert "ip_filter_field" in result["error"]


@pytest.mark.unit
def test_execute_ip_addresses_list_action() -> None:
    task_ctx = MagicMock()
    mock_svc = MagicMock()
    mock_svc.list_ip_addresses.return_value = [
        {"id": "ip-1", "address": "10.0.0.1/24"},
    ]

    with patch(_PATCH_SVC, return_value=mock_svc):
        result = execute_ip_addresses(
            schedule_id=None,
            credential_id=None,
            job_parameters=None,
            target_devices=None,
            task_context=task_ctx,
            template=_TEMPLATE_LIST,
        )

    assert result["success"] is True
    assert result["action"] == "list"
    assert result["total"] == 1
    task_ctx.update_state.assert_called()


@pytest.mark.unit
def test_execute_ip_addresses_remove_skips_assigned() -> None:
    task_ctx = MagicMock()
    mock_svc = MagicMock()
    mock_svc.list_ip_addresses.return_value = [
        {
            "id": "ip-1",
            "address": "10.0.0.1/24",
            "interface_assignments": [
                {
                    "id": "a1",
                    "interface": {"name": "eth0", "device": {"name": "r1"}},
                }
            ],
        },
        {"id": "ip-2", "address": "10.0.0.2/24"},
    ]
    mock_svc.delete_ip_address.side_effect = lambda ip_id: ip_id == "ip-2"

    template = {
        **_TEMPLATE_LIST,
        "ip_action": "remove",
        "ip_remove_skip_assigned": True,
    }

    with patch(_PATCH_SVC, return_value=mock_svc):
        result = execute_ip_addresses(
            schedule_id=None,
            credential_id=None,
            job_parameters=None,
            target_devices=None,
            task_context=task_ctx,
            template=template,
        )

    assert result["success"] is True
    assert result["skipped"] == 1
    assert result["deleted"] == 1
    assert result["failed"] == 0


@pytest.mark.unit
def test_execute_ip_addresses_remove_counts_missing_id_as_failed() -> None:
    mock_svc = MagicMock()
    mock_svc.list_ip_addresses.return_value = [{"address": "10.0.0.3/24"}]

    template = {**_TEMPLATE_LIST, "ip_action": "remove"}

    with patch(_PATCH_SVC, return_value=mock_svc):
        result = _call(template=template)

    assert result["failed"] == 1
    assert result["failed_ips"][0]["reason"] == "missing id"


@pytest.mark.unit
def test_execute_ip_addresses_mark_requires_mark_fields() -> None:
    template = {**_TEMPLATE_LIST, "ip_action": "mark"}

    result = _call(template=template)

    assert result["success"] is False
    assert "ip_mark_status" in result["error"]


@pytest.mark.unit
def test_execute_ip_addresses_mark_updates_ips() -> None:
    task_ctx = MagicMock()
    mock_svc = MagicMock()
    mock_svc.list_ip_addresses.return_value = [
        {"id": "ip-1", "address": "10.0.0.1/24"},
        {"id": "ip-2", "address": "10.0.0.2/24"},
    ]
    mock_svc.update_ip_address.side_effect = lambda ip_id, **kw: ip_id == "ip-1"

    template = {
        **_TEMPLATE_LIST,
        "ip_action": "mark",
        "ip_mark_status": "status-uuid",
        "ip_mark_description": "scanned",
    }

    with patch(_PATCH_SVC, return_value=mock_svc):
        result = execute_ip_addresses(
            schedule_id=None,
            credential_id=None,
            job_parameters=None,
            target_devices=None,
            task_context=task_ctx,
            template=template,
        )

    assert result["success"] is True
    assert result["updated"] == 1
    assert result["failed"] == 1
    assert result["changes"]["status"] == "status-uuid"


@pytest.mark.unit
def test_execute_ip_addresses_unknown_action() -> None:
    template = {**_TEMPLATE_LIST, "ip_action": "archive"}

    result = _call(template=template)

    assert result["success"] is False
    assert "Unknown action" in result["error"]


@pytest.mark.unit
def test_execute_ip_addresses_handles_service_exception() -> None:
    mock_svc = MagicMock()
    mock_svc.list_ip_addresses.side_effect = RuntimeError("nautobot down")

    with patch(_PATCH_SVC, return_value=mock_svc):
        result = _call(template=_TEMPLATE_LIST)

    assert result["success"] is False
    assert "nautobot down" in result["error"]
