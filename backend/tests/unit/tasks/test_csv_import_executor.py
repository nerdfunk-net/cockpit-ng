"""Unit tests for tasks/execution/csv_import_executor.py."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from tasks.execution.csv_import_executor import execute_csv_import

_PATCH_RUN = "tasks.import_or_update_from_csv_task._run_csv_import"

_TEMPLATE = {
    "id": 10,
    "csv_import_repo_id": 2,
    "csv_import_file_path": "imports/devices.csv",
    "csv_import_type": "device",
    "csv_import_primary_key": "name",
    "csv_import_update_existing": True,
    "csv_import_delimiter": ";",
    "csv_import_quote_char": "'",
    "csv_import_column_mapping": {"name": "name"},
}


def _call(template=None):
    return execute_csv_import(
        schedule_id=None,
        credential_id=None,
        job_parameters=None,
        target_devices=None,
        task_context=MagicMock(),
        template=template,
        job_run_id=99,
    )


@pytest.mark.unit
def test_execute_csv_import_missing_template() -> None:
    result = _call(template=None)

    assert result["success"] is False
    assert "template" in result["error"]


@pytest.mark.unit
def test_execute_csv_import_missing_repo_id() -> None:
    template = {**_TEMPLATE, "csv_import_repo_id": None}

    result = _call(template=template)

    assert result["success"] is False
    assert "repo_id" in result["error"]


@pytest.mark.unit
def test_execute_csv_import_missing_import_type() -> None:
    template = {**_TEMPLATE, "csv_import_type": ""}

    result = _call(template=template)

    assert result["success"] is False
    assert "import_type" in result["error"]


@pytest.mark.unit
def test_execute_csv_import_missing_primary_key() -> None:
    template = {**_TEMPLATE, "csv_import_primary_key": ""}

    result = _call(template=template)

    assert result["success"] is False
    assert "primary_key" in result["error"]


@pytest.mark.unit
def test_execute_csv_import_requires_path_or_filter() -> None:
    template = {**_TEMPLATE, "csv_import_file_path": "", "csv_import_file_filter": None}

    result = _call(template=template)

    assert result["success"] is False
    assert "file_path" in result["error"] or "file_filter" in result["error"]


@pytest.mark.unit
def test_execute_csv_import_accepts_file_filter_without_path() -> None:
    template = {
        **_TEMPLATE,
        "csv_import_file_path": "",
        "csv_import_file_filter": "*.csv",
    }
    expected = {"success": True, "imported": 3}

    with patch(_PATCH_RUN, return_value=expected) as run:
        result = _call(template=template)

    assert result == expected
    run.assert_called_once()
    assert run.call_args.kwargs["file_filter"] == "*.csv"
    assert run.call_args.kwargs["template_id"] == 10


@pytest.mark.unit
def test_execute_csv_import_delegates_to_run_csv_import() -> None:
    expected = {"success": True, "rows": 5}

    with patch(_PATCH_RUN, return_value=expected) as run:
        result = _call(template=_TEMPLATE)

    assert result == expected
    kwargs = run.call_args.kwargs
    assert kwargs["repo_id"] == 2
    assert kwargs["import_type"] == "device"
    assert kwargs["primary_key"] == "name"
    assert kwargs["delimiter"] == ";"
    assert kwargs["dry_run"] is False
