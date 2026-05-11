"""Unit tests for tasks/update_ip_prefixes_from_csv_task.py.

The task is a thin wrapper that delegates entirely to PrefixUpdateService.run_update().
Tests verify correct delegation, parameter passing, and that the service's return
value is propagated unchanged.

All tests run offline — no Nautobot, database, or Celery broker required.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from tasks.update_ip_prefixes_from_csv_task import update_ip_prefixes_from_csv_task

_PATCH_SERVICE = "tasks.update_ip_prefixes_from_csv_task._prefix_update_service"


def _run(csv_content: str = "prefix\n10.0.0.0/24", **kwargs) -> tuple[dict, MagicMock]:
    """Run the task synchronously and return (result, mocked service instance)."""
    mock_service = MagicMock()
    mock_service.run_update.return_value = {"success": True, "summary": {}}

    with patch(_PATCH_SERVICE, mock_service):
        result = update_ip_prefixes_from_csv_task.run(csv_content, **kwargs)

    return result, mock_service


# ── delegation tests ──────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.nautobot
def test_delegates_to_prefix_update_service():
    """Task calls PrefixUpdateService.run_update exactly once."""
    _, svc = _run()
    svc.run_update.assert_called_once()


@pytest.mark.unit
@pytest.mark.nautobot
def test_passes_csv_content_to_service():
    """csv_content is forwarded to run_update as the csv_content keyword argument."""
    csv = "prefix,description\n192.168.0.0/24,test"
    _, svc = _run(csv_content=csv)
    call_kwargs = svc.run_update.call_args.kwargs
    assert call_kwargs["csv_content"] == csv


@pytest.mark.unit
@pytest.mark.nautobot
def test_passes_task_context_to_service():
    """task_context passed to run_update is a Celery task instance."""
    from celery import Task as CeleryTask

    _, svc = _run()
    call_kwargs = svc.run_update.call_args.kwargs
    # task_context should be a Celery Task instance (the bound self)
    assert isinstance(call_kwargs["task_context"], CeleryTask)


@pytest.mark.unit
@pytest.mark.nautobot
def test_passes_dry_run_flag_to_service():
    """dry_run=True is forwarded to run_update."""
    _, svc = _run(dry_run=True)
    call_kwargs = svc.run_update.call_args.kwargs
    assert call_kwargs["dry_run"] is True


@pytest.mark.unit
@pytest.mark.nautobot
def test_passes_tags_mode_to_service():
    """tags_mode is forwarded to run_update."""
    _, svc = _run(tags_mode="merge")
    call_kwargs = svc.run_update.call_args.kwargs
    assert call_kwargs["tags_mode"] == "merge"


@pytest.mark.unit
@pytest.mark.nautobot
def test_passes_ignore_uuid_to_service():
    """ignore_uuid=False is forwarded to run_update."""
    _, svc = _run(ignore_uuid=False)
    call_kwargs = svc.run_update.call_args.kwargs
    assert call_kwargs["ignore_uuid"] is False


@pytest.mark.unit
@pytest.mark.nautobot
def test_passes_column_mapping_to_service():
    """column_mapping dict is forwarded to run_update."""
    mapping = {"prefix_cidr": "prefix", "desc": "description"}
    _, svc = _run(column_mapping=mapping)
    call_kwargs = svc.run_update.call_args.kwargs
    assert call_kwargs["column_mapping"] == mapping


@pytest.mark.unit
@pytest.mark.nautobot
def test_passes_selected_columns_to_service():
    """selected_columns list is forwarded to run_update."""
    cols = ["prefix", "description"]
    _, svc = _run(selected_columns=cols)
    call_kwargs = svc.run_update.call_args.kwargs
    assert call_kwargs["selected_columns"] == cols


@pytest.mark.unit
@pytest.mark.nautobot
def test_passes_csv_options_to_service():
    """csv_options dict is forwarded to run_update."""
    opts = {"delimiter": ";", "quoteChar": "'"}
    _, svc = _run(csv_options=opts)
    call_kwargs = svc.run_update.call_args.kwargs
    assert call_kwargs["csv_options"] == opts


@pytest.mark.unit
@pytest.mark.nautobot
def test_returns_service_result_unchanged():
    """The return value from run_update is returned directly by the task."""
    expected = {"success": True, "summary": {"total": 3, "updated": 2}}
    mock_service = MagicMock()
    mock_service.run_update.return_value = expected

    with patch(_PATCH_SERVICE, mock_service):
        result = update_ip_prefixes_from_csv_task.run("prefix\n10.0.0.0/24")

    assert result is expected
