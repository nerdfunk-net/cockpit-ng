"""Unit tests for tasks/update_ip_addresses_from_csv_task.py.

All tests run offline - no Nautobot, database, or Celery broker required.
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tasks.update_ip_addresses_from_csv_task import (
    _add_ip_address_note,
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

    with (
        patch(
            "tasks.update_ip_addresses_from_csv_task.service_factory.build_nautobot_service",
            return_value=MagicMock(),
        ),
        patch(
            "tasks.update_ip_addresses_from_csv_task.service_factory.build_job_run_service",
            return_value=job_runs,
        ),
        patch(
            "tasks.update_ip_addresses_from_csv_task._find_ip_address_by_address_and_namespace_graphql",
            new_callable=AsyncMock,
            return_value=("ip-1", {"tags": []}),
        ) as lookup,
        patch(
            "tasks.update_ip_addresses_from_csv_task._update_ip_address",
            new_callable=AsyncMock,
        ) as update,
        patch.object(update_ip_addresses_from_csv_task, "update_state"),
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

    with (
        patch(
            "tasks.update_ip_addresses_from_csv_task.service_factory.build_nautobot_service",
            return_value=MagicMock(),
        ),
        patch(
            "tasks.update_ip_addresses_from_csv_task.service_factory.build_job_run_service",
            return_value=job_runs,
        ),
        patch(
            "tasks.update_ip_addresses_from_csv_task._get_ip_address_by_uuid",
            new_callable=AsyncMock,
            return_value={"id": "ip-1", "tags": []},
        ) as get_by_uuid,
        patch(
            "tasks.update_ip_addresses_from_csv_task._update_ip_address",
            new_callable=AsyncMock,
            return_value={"success": True},
        ) as update,
        patch.object(update_ip_addresses_from_csv_task, "update_state"),
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


@pytest.mark.unit
def test_prepare_ip_address_update_data_extracts_notes_without_coercion() -> None:
    """A 'notes'-mapped column is excluded from update_data and reported raw via notes_out."""
    row = {
        "address": "10.0.0.1/24",
        "parent__namespace__name": "Global",
        "notes": "true",
    }
    notes_holder: dict[str, str] = {}

    result = _prepare_ip_address_update_data(
        row, list(row.keys()), {}, notes_out=notes_holder
    )

    assert "notes" not in result
    assert notes_holder == {"value": "true"}


@pytest.mark.unit
def test_prepare_ip_address_update_data_empty_notes_value_not_recorded() -> None:
    """An empty notes column leaves notes_out untouched."""
    row = {"address": "10.0.0.1/24", "parent__namespace__name": "Global", "notes": ""}
    notes_holder: dict[str, str] = {}

    _prepare_ip_address_update_data(row, list(row.keys()), {}, notes_out=notes_holder)

    assert notes_holder == {}


@pytest.mark.unit
def test_add_ip_address_note_creates_when_no_existing_notes() -> None:
    """A note is POSTed when the IP address has no existing notes."""
    nautobot_service = MagicMock()
    nautobot_service.rest_request = AsyncMock(
        side_effect=[{"count": 0, "results": []}, {"id": "note-1"}]
    )

    result = asyncio.run(_add_ip_address_note(nautobot_service, "ip-1", "hello"))

    assert result == {"success": True, "created": True}
    assert nautobot_service.rest_request.await_count == 2
    post_call = nautobot_service.rest_request.await_args_list[1]
    assert post_call.kwargs["method"] == "POST"
    assert post_call.kwargs["data"] == {"note": "hello"}


@pytest.mark.unit
def test_add_ip_address_note_skips_duplicate() -> None:
    """No POST is made when the most recent existing note matches exactly."""
    nautobot_service = MagicMock()
    nautobot_service.rest_request = AsyncMock(
        return_value={"count": 1, "results": [{"note": "same text"}]}
    )

    result = asyncio.run(_add_ip_address_note(nautobot_service, "ip-1", "same text"))

    assert result == {"success": True, "created": False}
    nautobot_service.rest_request.assert_awaited_once()


@pytest.mark.unit
def test_add_ip_address_note_creates_when_most_recent_differs() -> None:
    """A new note is POSTed when the most recent existing note has different text."""
    nautobot_service = MagicMock()
    nautobot_service.rest_request = AsyncMock(
        side_effect=[
            {"count": 1, "results": [{"note": "old text"}]},
            {"id": "note-2"},
        ]
    )

    result = asyncio.run(_add_ip_address_note(nautobot_service, "ip-1", "new text"))

    assert result == {"success": True, "created": True}
    assert nautobot_service.rest_request.await_count == 2


@pytest.mark.unit
def test_add_ip_address_note_returns_failure_on_exception() -> None:
    """Exceptions are caught and returned as a failure dict, not raised."""
    nautobot_service = MagicMock()
    nautobot_service.rest_request = AsyncMock(side_effect=RuntimeError("boom"))

    result = asyncio.run(_add_ip_address_note(nautobot_service, "ip-1", "hello"))

    assert result == {"success": False, "error": "boom"}


@pytest.mark.unit
def test_update_ip_addresses_notes_only_row_succeeds() -> None:
    """A row where only 'notes' is mapped succeeds without calling the PATCH helper."""
    job_runs = MagicMock()
    job_runs.get_job_run_by_celery_id.return_value = None

    with (
        patch(
            "tasks.update_ip_addresses_from_csv_task.service_factory.build_nautobot_service",
            return_value=MagicMock(),
        ),
        patch(
            "tasks.update_ip_addresses_from_csv_task.service_factory.build_job_run_service",
            return_value=job_runs,
        ),
        patch(
            "tasks.update_ip_addresses_from_csv_task._find_ip_address_by_address_and_namespace_graphql",
            new_callable=AsyncMock,
            return_value=("ip-1", {"tags": []}),
        ),
        patch(
            "tasks.update_ip_addresses_from_csv_task._update_ip_address",
            new_callable=AsyncMock,
        ) as update,
        patch(
            "tasks.update_ip_addresses_from_csv_task._add_ip_address_note",
            new_callable=AsyncMock,
            return_value={"success": True, "created": True},
        ) as add_note,
        patch.object(update_ip_addresses_from_csv_task, "update_state"),
    ):
        result = update_ip_addresses_from_csv_task.run(
            "address,parent__namespace__name,notes\n10.0.0.1/24,Global,a note",
            dry_run=False,
            ignore_uuid=True,
            selected_columns=["notes"],
        )

    assert result["summary"]["successful"] == 1
    assert result["successes"][0]["updated_fields"] == ["notes"]
    update.assert_not_called()
    add_note.assert_awaited_once()


@pytest.mark.unit
def test_update_ip_addresses_notes_only_row_failure_becomes_failure() -> None:
    """A notes-only row becomes a failure when note creation fails."""
    job_runs = MagicMock()
    job_runs.get_job_run_by_celery_id.return_value = None

    with (
        patch(
            "tasks.update_ip_addresses_from_csv_task.service_factory.build_nautobot_service",
            return_value=MagicMock(),
        ),
        patch(
            "tasks.update_ip_addresses_from_csv_task.service_factory.build_job_run_service",
            return_value=job_runs,
        ),
        patch(
            "tasks.update_ip_addresses_from_csv_task._find_ip_address_by_address_and_namespace_graphql",
            new_callable=AsyncMock,
            return_value=("ip-1", {"tags": []}),
        ),
        patch(
            "tasks.update_ip_addresses_from_csv_task._add_ip_address_note",
            new_callable=AsyncMock,
            return_value={"success": False, "error": "boom"},
        ),
        patch.object(update_ip_addresses_from_csv_task, "update_state"),
    ):
        result = update_ip_addresses_from_csv_task.run(
            "address,parent__namespace__name,notes\n10.0.0.1/24,Global,a note",
            dry_run=False,
            ignore_uuid=True,
            selected_columns=["notes"],
        )

    assert result["summary"]["successful"] == 0
    assert result["summary"]["failed"] == 1
    assert "Note creation failed: boom" in result["failures"][0]["error"]


@pytest.mark.unit
def test_update_ip_addresses_partial_note_failure_becomes_warning() -> None:
    """A field update that succeeds alongside a failed note is a success with a warning."""
    job_runs = MagicMock()
    job_runs.get_job_run_by_celery_id.return_value = None

    with (
        patch(
            "tasks.update_ip_addresses_from_csv_task.service_factory.build_nautobot_service",
            return_value=MagicMock(),
        ),
        patch(
            "tasks.update_ip_addresses_from_csv_task.service_factory.build_job_run_service",
            return_value=job_runs,
        ),
        patch(
            "tasks.update_ip_addresses_from_csv_task._find_ip_address_by_address_and_namespace_graphql",
            new_callable=AsyncMock,
            return_value=("ip-1", {"tags": []}),
        ),
        patch(
            "tasks.update_ip_addresses_from_csv_task._update_ip_address",
            new_callable=AsyncMock,
            return_value={"success": True},
        ),
        patch(
            "tasks.update_ip_addresses_from_csv_task._add_ip_address_note",
            new_callable=AsyncMock,
            return_value={"success": False, "error": "boom"},
        ),
        patch.object(update_ip_addresses_from_csv_task, "update_state"),
    ):
        result = update_ip_addresses_from_csv_task.run(
            "address,parent__namespace__name,description,notes\n"
            "10.0.0.1/24,Global,uplink,a note",
            dry_run=False,
            ignore_uuid=True,
            selected_columns=["description", "notes"],
        )

    assert result["summary"]["successful"] == 1
    assert result["summary"]["failed"] == 0
    success_entry = result["successes"][0]
    assert success_entry["updated_fields"] == ["description"]
    assert success_entry["warnings"] == ["Note creation failed: boom"]


@pytest.mark.unit
def test_update_ip_addresses_dry_run_includes_notes_preview() -> None:
    """Dry-run mode previews the planned note without calling the notes helper."""
    job_runs = MagicMock()
    job_runs.get_job_run_by_celery_id.return_value = None

    with (
        patch(
            "tasks.update_ip_addresses_from_csv_task.service_factory.build_nautobot_service",
            return_value=MagicMock(),
        ),
        patch(
            "tasks.update_ip_addresses_from_csv_task.service_factory.build_job_run_service",
            return_value=job_runs,
        ),
        patch(
            "tasks.update_ip_addresses_from_csv_task._find_ip_address_by_address_and_namespace_graphql",
            new_callable=AsyncMock,
            return_value=("ip-1", {"tags": []}),
        ),
        patch(
            "tasks.update_ip_addresses_from_csv_task._add_ip_address_note",
            new_callable=AsyncMock,
        ) as add_note,
        patch.object(update_ip_addresses_from_csv_task, "update_state"),
    ):
        result = update_ip_addresses_from_csv_task.run(
            "address,parent__namespace__name,notes\n10.0.0.1/24,Global,a note",
            dry_run=True,
            ignore_uuid=True,
            selected_columns=["notes"],
        )

    assert result["successes"][0]["updates"]["notes"] == "a note"
    add_note.assert_not_called()
