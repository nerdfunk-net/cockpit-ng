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
        patch("service_factory.build_job_run_service", side_effect=RuntimeError("unused")),
    ):
        result = svc.run_update(
            task_context=_task(),
            csv_content="prefix,namespace\n10.0.0.0/24,Global\n",
            dry_run=False,
        )

    assert result["summary"]["skipped"] == 1
    assert result["skipped"][0]["reason"] == "No fields to update"
