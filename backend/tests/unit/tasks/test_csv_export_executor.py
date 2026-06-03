"""Unit tests for tasks/execution/csv_export_executor.py."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tasks.execution.csv_export_executor import execute_csv_export

_PATCH_RUN = "tasks.csv_export_task._run_csv_export"
_PATCH_DEVICES = "service_factory.build_device_query_service"

_TEMPLATE = {
    "csv_export_repo_id": 1,
    "csv_export_file_path": "exports/devices.csv",
    "csv_export_properties": ["name", "serial"],
    "csv_export_delimiter": ";",
    "csv_export_quote_char": "'",
    "csv_export_include_headers": False,
}


def _call(template=None, target_devices=None, **kwargs):
    return execute_csv_export(
        schedule_id=None,
        credential_id=None,
        job_parameters=None,
        target_devices=target_devices,
        task_context=MagicMock(),
        template=template,
        job_run_id=42,
        **kwargs,
    )


@pytest.mark.unit
def test_execute_csv_export_missing_template() -> None:
    result = _call(template=None)

    assert result["success"] is False
    assert "template" in result["error"]


@pytest.mark.unit
def test_execute_csv_export_missing_repo_id() -> None:
    template = {**_TEMPLATE, "csv_export_repo_id": None}

    result = _call(template=template)

    assert result["success"] is False
    assert "repo_id" in result["error"]


@pytest.mark.unit
def test_execute_csv_export_missing_file_path() -> None:
    template = {**_TEMPLATE, "csv_export_file_path": ""}

    result = _call(template=template)

    assert result["success"] is False
    assert "file_path" in result["error"]


@pytest.mark.unit
def test_execute_csv_export_missing_properties() -> None:
    template = {**_TEMPLATE, "csv_export_properties": []}

    result = _call(template=template)

    assert result["success"] is False
    assert "properties" in result["error"]


@pytest.mark.unit
def test_execute_csv_export_no_devices_resolved() -> None:
    with patch(_PATCH_RUN) as run:
        result = _call(
            template=_TEMPLATE,
            target_devices=[{"name": "no-id"}],
        )

    assert result["success"] is False
    assert "No target devices" in result["error"]
    run.assert_not_called()


@pytest.mark.unit
def test_execute_csv_export_uses_target_devices() -> None:
    expected = {"success": True, "exported": 2}
    task_ctx = MagicMock()

    with patch(_PATCH_RUN, return_value=expected) as run:
        result = execute_csv_export(
            schedule_id=None,
            credential_id=None,
            job_parameters=None,
            target_devices=[{"id": "dev-1"}, {"device_id": "dev-2"}],
            task_context=task_ctx,
            template=_TEMPLATE,
            job_run_id=7,
        )

    assert result == expected
    run.assert_called_once()
    assert run.call_args.kwargs["device_ids"] == ["dev-1", "dev-2"]
    assert run.call_args.kwargs["delimiter"] == ";"
    assert run.call_args.kwargs["include_headers"] is False


@pytest.mark.unit
def test_execute_csv_export_fetches_all_devices_when_no_targets() -> None:
    mock_query = MagicMock()
    mock_query.get_devices = AsyncMock(
        return_value={"devices": [{"id": "a"}, {"id": "b"}]}
    )

    with patch(_PATCH_DEVICES, return_value=mock_query):
        with patch(_PATCH_RUN, return_value={"success": True}) as run:
            result = _call(template=_TEMPLATE, target_devices=None)

    assert result["success"] is True
    assert run.call_args.kwargs["device_ids"] == ["a", "b"]
