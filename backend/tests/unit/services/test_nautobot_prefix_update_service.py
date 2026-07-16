"""Unit tests for PrefixUpdateService.

All tests run offline - no real Nautobot instance required.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.nautobot.imports.prefix_update_service import PrefixUpdateService

PREFIX_ID = "af000000-0000-0000-0001-000000000001"


def _task() -> MagicMock:
    task = MagicMock()
    task.request.id = "celery-123"
    return task


@pytest.mark.unit
@pytest.mark.nautobot
def test_prepare_prefix_update_data_converts_types_and_custom_fields() -> None:
    """CSV values are converted into the Nautobot prefix PATCH payload."""
    row = {
        "id": PREFIX_ID,
        "prefix": "10.0.0.0/24",
        "namespace": "Global",
        "description": "User subnet",
        "mark_utilized": "true",
        "status__name": "Active",
        "cf_owner": "netops",
        "cf_retired": "false",
        "cf_ticket": "NULL",
        "tags": "prod, edge",
    }

    result = PrefixUpdateService._prepare_prefix_update_data(
        row,
        headers=list(row.keys()),
        existing_prefix={"tags": [{"name": "old"}]},
        tags_mode="replace",
    )

    assert result == {
        "description": "User subnet",
        "mark_utilized": True,
        "status": "Active",
        "tags": ["prod", "edge"],
        "custom_fields": {
            "owner": "netops",
            "retired": False,
            "ticket": None,
        },
    }


@pytest.mark.unit
@pytest.mark.nautobot
def test_prepare_prefix_update_data_merges_tags() -> None:
    """Merge mode preserves existing tags and adds CSV tags."""
    result = PrefixUpdateService._prepare_prefix_update_data(
        {"tags": "new, old"},
        headers=["tags"],
        existing_prefix={"tags": [{"name": "old"}, {"name": "keep"}]},
        tags_mode="merge",
    )

    assert set(result["tags"]) == {"old", "keep", "new"}


@pytest.mark.unit
@pytest.mark.nautobot
def test_prepare_prefix_update_data_respects_selected_columns() -> None:
    """Only selected columns are included in the update payload."""
    result = PrefixUpdateService._prepare_prefix_update_data(
        {"description": "updated", "status": "Active"},
        headers=["description", "status"],
        existing_prefix={},
        selected_columns=["description"],
    )

    assert result == {"description": "updated"}


@pytest.mark.unit
@pytest.mark.nautobot
def test_generate_field_comparison_reports_changes_and_unchanged_values() -> None:
    """Dry-run comparisons describe changed, added, removed, and unchanged fields."""
    comparison = PrefixUpdateService._generate_field_comparison(
        {
            "description": "old",
            "status": {"name": "Active"},
            "tags": [{"name": "old"}, {"name": "keep"}],
            "custom_fields": {"owner": "netops"},
        },
        {
            "description": "new",
            "status": "Active",
            "tags": ["keep", "new"],
            "custom_fields": {"owner": "netops", "ticket": "CHG-1"},
        },
    )

    assert comparison["changes"]["description"] == {"current": "old", "new": "new"}
    assert comparison["changes"]["tags"]["added"] == ["new"]
    assert comparison["changes"]["tags"]["removed"] == ["old"]
    assert comparison["changes"]["custom_fields"]["ticket"] == {
        "current": None,
        "new": "CHG-1",
    }
    assert "status" in comparison["unchanged"]


@pytest.mark.unit
@pytest.mark.nautobot
def test_find_prefix_by_prefix_and_namespace_returns_first_match() -> None:
    """GraphQL prefix lookup returns the first matching prefix."""
    mock_nb = MagicMock()
    mock_nb.graphql_query = AsyncMock(
        return_value={
            "data": {
                "prefixes": [
                    {
                        "id": PREFIX_ID,
                        "prefix": "10.0.0.0/24",
                        "namespace": {"name": "Global"},
                    }
                ]
            }
        }
    )
    svc = PrefixUpdateService()

    prefix_id, prefix_data = svc._find_prefix_by_prefix_and_namespace_graphql(
        mock_nb, "10.0.0.0/24", "Global"
    )

    assert prefix_id == PREFIX_ID
    assert prefix_data["prefix"] == "10.0.0.0/24"
    mock_nb.graphql_query.assert_awaited_once()
    variables = mock_nb.graphql_query.await_args.args[1]
    assert variables == {"ip_prefix": ["10.0.0.0/24"], "namespace": ["Global"]}


@pytest.mark.unit
@pytest.mark.nautobot
def test_update_prefix_returns_success_on_rest_patch() -> None:
    """REST PATCH success is returned as a simple success dict."""
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(return_value={"id": PREFIX_ID})
    svc = PrefixUpdateService()

    # The Celery-facing service bridges to async Nautobot clients with asyncio.run().
    result = svc._update_prefix(mock_nb, PREFIX_ID, {"description": "updated"})

    assert result == {"success": True}
    mock_nb.rest_request.assert_awaited_once_with(
        f"ipam/prefixes/{PREFIX_ID}/",
        method="PATCH",
        data={"description": "updated"},
    )


@pytest.mark.unit
@pytest.mark.nautobot
def test_run_update_dry_run_records_planned_update() -> None:
    """Dry-run CSV updates report the planned payload without PATCHing Nautobot."""
    mock_nb = MagicMock()
    mock_nb.graphql_query = AsyncMock(
        return_value={
            "data": {
                "prefixes": [
                    {
                        "id": PREFIX_ID,
                        "prefix": "10.0.0.0/24",
                        "description": "old",
                        "namespace": {"name": "Global"},
                    }
                ]
            }
        }
    )
    mock_job_runs = MagicMock()
    mock_job_runs.get_job_run_by_celery_id.return_value = {"id": 55}
    svc = PrefixUpdateService()

    with (
        patch("service_factory.build_nautobot_service", return_value=mock_nb),
        patch("service_factory.build_job_run_service", return_value=mock_job_runs),
    ):
        result = svc.run_update(
            task_context=_task(),
            csv_content="prefix,namespace,description\n10.0.0.0/24,Global,new\n",
            dry_run=True,
            ignore_uuid=True,
        )

    assert result["success"] is True
    assert result["dry_run"] is True
    assert result["summary"] == {"total": 1, "successful": 1, "failed": 0, "skipped": 0}
    assert result["successes"][0]["updates"] == {"description": "new"}
    mock_nb.rest_request.assert_not_called()


@pytest.mark.unit
@pytest.mark.nautobot
def test_run_update_missing_required_column_returns_error() -> None:
    """CSV input without the mapped prefix column returns a validation error."""
    svc = PrefixUpdateService()

    result = svc.run_update(
        task_context=_task(),
        csv_content="network,namespace\n10.0.0.0/24,Global\n",
    )

    assert result["success"] is False
    assert "missing required column 'prefix'" in result["error"]


@pytest.mark.unit
@pytest.mark.nautobot
def test_run_update_skips_rows_without_update_fields() -> None:
    """Rows with only lookup columns are counted as skipped."""
    mock_nb = MagicMock()
    mock_nb.graphql_query = AsyncMock(
        return_value={
            "data": {
                "prefixes": [
                    {
                        "id": PREFIX_ID,
                        "prefix": "10.0.0.0/24",
                        "namespace": {"name": "Global"},
                    }
                ]
            }
        }
    )
    svc = PrefixUpdateService()

    with (
        patch("service_factory.build_nautobot_service", return_value=mock_nb),
        patch(
            "service_factory.build_job_run_service", side_effect=RuntimeError("unused")
        ),
    ):
        result = svc.run_update(
            task_context=_task(),
            csv_content="prefix,namespace\n10.0.0.0/24,Global\n",
            dry_run=False,
        )

    assert result["summary"]["skipped"] == 1
    assert result["skipped"][0]["reason"] == "No fields to update"


@pytest.mark.unit
@pytest.mark.nautobot
def test_prepare_prefix_update_data_extracts_notes_without_coercion() -> None:
    """A 'notes'-mapped column is excluded from the payload and reported raw via notes_out."""
    row = {"prefix": "10.0.0.0/24", "namespace": "Global", "notes": "true"}
    notes_holder: dict[str, str] = {}

    result = PrefixUpdateService._prepare_prefix_update_data(
        row, headers=list(row.keys()), existing_prefix={}, notes_out=notes_holder
    )

    assert "notes" not in result
    assert notes_holder == {"value": "true"}


@pytest.mark.unit
@pytest.mark.nautobot
def test_prepare_prefix_update_data_empty_notes_value_not_recorded() -> None:
    """An empty notes column leaves notes_out untouched."""
    row = {"prefix": "10.0.0.0/24", "namespace": "Global", "notes": ""}
    notes_holder: dict[str, str] = {}

    PrefixUpdateService._prepare_prefix_update_data(
        row, headers=list(row.keys()), existing_prefix={}, notes_out=notes_holder
    )

    assert notes_holder == {}


@pytest.mark.unit
@pytest.mark.nautobot
def test_add_prefix_note_creates_when_no_existing_notes() -> None:
    """A note is POSTed when the prefix has no existing notes."""
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(
        side_effect=[{"count": 0, "results": []}, {"id": "note-1"}]
    )
    svc = PrefixUpdateService()

    result = svc._add_prefix_note(mock_nb, PREFIX_ID, "hello")

    assert result == {"success": True, "created": True}
    assert mock_nb.rest_request.await_count == 2
    post_call = mock_nb.rest_request.await_args_list[1]
    assert post_call.kwargs["method"] == "POST"
    assert post_call.kwargs["data"] == {"note": "hello"}


@pytest.mark.unit
@pytest.mark.nautobot
def test_add_prefix_note_skips_duplicate() -> None:
    """No POST is made when the most recent existing note matches exactly."""
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(
        return_value={"count": 1, "results": [{"note": "same text"}]}
    )
    svc = PrefixUpdateService()

    result = svc._add_prefix_note(mock_nb, PREFIX_ID, "same text")

    assert result == {"success": True, "created": False}
    mock_nb.rest_request.assert_awaited_once()


@pytest.mark.unit
@pytest.mark.nautobot
def test_add_prefix_note_creates_when_most_recent_differs() -> None:
    """A new note is POSTed when the most recent existing note has different text."""
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(
        side_effect=[
            {"count": 1, "results": [{"note": "old text"}]},
            {"id": "note-2"},
        ]
    )
    svc = PrefixUpdateService()

    result = svc._add_prefix_note(mock_nb, PREFIX_ID, "new text")

    assert result == {"success": True, "created": True}
    assert mock_nb.rest_request.await_count == 2


@pytest.mark.unit
@pytest.mark.nautobot
def test_add_prefix_note_returns_failure_on_exception() -> None:
    """Exceptions are caught and returned as a failure dict, not raised."""
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(side_effect=RuntimeError("boom"))
    svc = PrefixUpdateService()

    result = svc._add_prefix_note(mock_nb, PREFIX_ID, "hello")

    assert result == {"success": False, "error": "boom"}


@pytest.mark.unit
@pytest.mark.nautobot
def test_run_update_notes_only_row_succeeds() -> None:
    """A row where only 'notes' is mapped succeeds without calling the PATCH helper."""
    mock_nb = MagicMock()
    mock_nb.graphql_query = AsyncMock(
        return_value={
            "data": {
                "prefixes": [
                    {
                        "id": PREFIX_ID,
                        "prefix": "10.0.0.0/24",
                        "namespace": {"name": "Global"},
                    }
                ]
            }
        }
    )
    mock_job_runs = MagicMock()
    mock_job_runs.get_job_run_by_celery_id.return_value = None
    svc = PrefixUpdateService()

    with (
        patch("service_factory.build_nautobot_service", return_value=mock_nb),
        patch("service_factory.build_job_run_service", return_value=mock_job_runs),
        patch.object(
            svc, "_add_prefix_note", return_value={"success": True, "created": True}
        ) as add_note,
        patch.object(svc, "_update_prefix") as update_prefix,
    ):
        result = svc.run_update(
            task_context=_task(),
            csv_content="prefix,namespace,notes\n10.0.0.0/24,Global,a note\n",
            dry_run=False,
            selected_columns=["notes"],
        )

    assert result["summary"]["successful"] == 1
    assert result["successes"][0]["updated_fields"] == ["notes"]
    update_prefix.assert_not_called()
    add_note.assert_called_once()


@pytest.mark.unit
@pytest.mark.nautobot
def test_run_update_notes_only_row_failure_becomes_failure() -> None:
    """A notes-only row becomes a failure when note creation fails."""
    mock_nb = MagicMock()
    mock_nb.graphql_query = AsyncMock(
        return_value={
            "data": {
                "prefixes": [
                    {
                        "id": PREFIX_ID,
                        "prefix": "10.0.0.0/24",
                        "namespace": {"name": "Global"},
                    }
                ]
            }
        }
    )
    mock_job_runs = MagicMock()
    mock_job_runs.get_job_run_by_celery_id.return_value = None
    svc = PrefixUpdateService()

    with (
        patch("service_factory.build_nautobot_service", return_value=mock_nb),
        patch("service_factory.build_job_run_service", return_value=mock_job_runs),
        patch.object(
            svc, "_add_prefix_note", return_value={"success": False, "error": "boom"}
        ),
    ):
        result = svc.run_update(
            task_context=_task(),
            csv_content="prefix,namespace,notes\n10.0.0.0/24,Global,a note\n",
            dry_run=False,
            selected_columns=["notes"],
        )

    assert result["summary"]["successful"] == 0
    assert result["summary"]["failed"] == 1
    assert "Note creation failed: boom" in result["failures"][0]["error"]


@pytest.mark.unit
@pytest.mark.nautobot
def test_run_update_partial_note_failure_becomes_warning() -> None:
    """A field update that succeeds alongside a failed note is a success with a warning."""
    mock_nb = MagicMock()
    mock_nb.graphql_query = AsyncMock(
        return_value={
            "data": {
                "prefixes": [
                    {
                        "id": PREFIX_ID,
                        "prefix": "10.0.0.0/24",
                        "namespace": {"name": "Global"},
                    }
                ]
            }
        }
    )
    mock_job_runs = MagicMock()
    mock_job_runs.get_job_run_by_celery_id.return_value = None
    svc = PrefixUpdateService()

    with (
        patch("service_factory.build_nautobot_service", return_value=mock_nb),
        patch("service_factory.build_job_run_service", return_value=mock_job_runs),
        patch.object(svc, "_update_prefix", return_value={"success": True}),
        patch.object(
            svc, "_add_prefix_note", return_value={"success": False, "error": "boom"}
        ),
    ):
        result = svc.run_update(
            task_context=_task(),
            csv_content="prefix,namespace,description,notes\n"
            "10.0.0.0/24,Global,updated,a note\n",
            dry_run=False,
            selected_columns=["description", "notes"],
        )

    assert result["summary"]["successful"] == 1
    assert result["summary"]["failed"] == 0
    success_entry = result["successes"][0]
    assert success_entry["updated_fields"] == ["description"]
    assert success_entry["warnings"] == ["Note creation failed: boom"]


@pytest.mark.unit
@pytest.mark.nautobot
def test_run_update_dry_run_includes_notes_preview() -> None:
    """Dry-run mode previews the planned note without calling the notes helper."""
    mock_nb = MagicMock()
    mock_nb.graphql_query = AsyncMock(
        return_value={
            "data": {
                "prefixes": [
                    {
                        "id": PREFIX_ID,
                        "prefix": "10.0.0.0/24",
                        "description": "old",
                        "namespace": {"name": "Global"},
                    }
                ]
            }
        }
    )
    mock_job_runs = MagicMock()
    mock_job_runs.get_job_run_by_celery_id.return_value = {"id": 55}
    svc = PrefixUpdateService()

    with (
        patch("service_factory.build_nautobot_service", return_value=mock_nb),
        patch("service_factory.build_job_run_service", return_value=mock_job_runs),
        patch.object(svc, "_add_prefix_note") as add_note,
    ):
        result = svc.run_update(
            task_context=_task(),
            csv_content="prefix,namespace,notes\n10.0.0.0/24,Global,a note\n",
            dry_run=True,
            selected_columns=["notes"],
        )

    assert result["successes"][0]["updates"]["notes"] == "a note"
    add_note.assert_not_called()
