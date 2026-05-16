"""Unit tests for tasks/update_ip_addresses_from_csv_task.py.

All tests run offline - no Nautobot, database, or Celery broker required.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tasks.update_ip_addresses_from_csv_task import (
    _prepare_ip_address_update_data,
    update_ip_addresses_from_csv_task,
)


@pytest.mark.unit
def test_prepare_ip_address_update_data_excludes_lookup_and_merges_tags() -> None:
    """Update payload excludes lookup/read-only fields and can merge tags."""
    row = {
        "address": "10.0.0.1/24",
        "parent__namespace__name": "Global",
        "description": "uplink",
        "dns_name": "router-01.example.com",
        "tags": "new,core",
        "cf_monitored": "true",
        "status__name": "Active",
    }
    existing = {"tags": [{"name": "existing"}]}

    result = _prepare_ip_address_update_data(
        row,
        list(row.keys()),
        existing,
        tags_mode="merge",
    )

    assert result["description"] == "uplink"
    assert result["dns_name"] == "router-01.example.com"
    assert set(result["tags"]) == {"existing", "new", "core"}
    assert result["custom_fields"] == {"monitored": True}
    assert "address" not in result
    assert "parent__namespace__name" not in result
    assert "status__name" not in result


@pytest.mark.unit
def test_update_ip_addresses_from_csv_dry_run_uses_graphql_lookup() -> None:
    """Dry-run mode validates lookup and returns planned updates without PATCH."""
    job_runs = MagicMock()
    job_runs.get_job_run_by_celery_id.return_value = None

    with patch(
        "tasks.update_ip_addresses_from_csv_task.service_factory.build_nautobot_service",
        return_value=MagicMock(),
    ), patch(
        "tasks.update_ip_addresses_from_csv_task.service_factory.build_job_run_service",
        return_value=job_runs,
    ), patch(
        "tasks.update_ip_addresses_from_csv_task._find_ip_address_by_address_and_namespace_graphql",
        new_callable=AsyncMock,
        return_value=("ip-1", {"tags": []}),
    ) as lookup, patch(
        "tasks.update_ip_addresses_from_csv_task._update_ip_address",
        new_callable=AsyncMock,
    ) as update, patch.object(
        update_ip_addresses_from_csv_task, "update_state"
    ):
        result = update_ip_addresses_from_csv_task.run(
            "address,parent__namespace__name,description\n10.0.0.1/24,Global,uplink",
            dry_run=True,
            ignore_uuid=True,
        )

    assert result["success"] is True
    assert result["dry_run"] is True
    assert result["summary"] == {"total": 1, "successful": 1, "failed": 0, "skipped": 0}
    assert result["successes"][0]["updates"] == {"description": "uplink"}
    lookup.assert_awaited_once()
    update.assert_not_called()


@pytest.mark.unit
def test_update_ip_addresses_from_csv_uuid_update_calls_rest_helper() -> None:
    """UUID mode verifies the address and calls the update helper with selected fields."""
    job_runs = MagicMock()
    job_runs.get_job_run_by_celery_id.return_value = None

    with patch(
        "tasks.update_ip_addresses_from_csv_task.service_factory.build_nautobot_service",
        return_value=MagicMock(),
    ), patch(
        "tasks.update_ip_addresses_from_csv_task.service_factory.build_job_run_service",
        return_value=job_runs,
    ), patch(
        "tasks.update_ip_addresses_from_csv_task._get_ip_address_by_uuid",
        new_callable=AsyncMock,
        return_value={"id": "ip-1", "tags": []},
    ) as get_by_uuid, patch(
        "tasks.update_ip_addresses_from_csv_task._update_ip_address",
        new_callable=AsyncMock,
        return_value={"success": True},
    ) as update, patch.object(
        update_ip_addresses_from_csv_task, "update_state"
    ):
        result = update_ip_addresses_from_csv_task.run(
            "id,address,description,dns_name\nip-1,10.0.0.1/24,uplink,router-01",
            dry_run=False,
            ignore_uuid=False,
            selected_columns=["description"],
        )

    assert result["summary"]["successful"] == 1
    assert result["successes"][0]["updated_fields"] == ["description"]
    get_by_uuid.assert_awaited_once()
    update.assert_awaited_once()
    assert update.await_args.args[2] == {"description": "uplink"}


@pytest.mark.unit
def test_update_ip_addresses_from_csv_missing_address_column_fails() -> None:
    """CSV validation fails when the mapped address column is missing."""
    with patch.object(update_ip_addresses_from_csv_task, "update_state"):
        result = update_ip_addresses_from_csv_task.run("ip\n10.0.0.1/24")

    assert result["success"] is False
    assert "missing required column 'address'" in result["error"]
