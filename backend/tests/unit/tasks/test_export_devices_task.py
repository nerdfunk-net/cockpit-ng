"""Unit tests for tasks/export_devices_task.py.

All tests run offline - no Nautobot, database, or Celery broker required.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tasks.export_devices_task import export_devices_task


@pytest.mark.unit
def test_export_devices_rejects_empty_inputs() -> None:
    """Validation errors are returned before Nautobot is queried."""
    with patch.object(export_devices_task, "update_state"):
        no_devices = export_devices_task.run([], ["name"])
        no_properties = export_devices_task.run(["dev-1"], [])

    assert no_devices == {"success": False, "error": "No devices specified for export"}
    assert no_properties == {"success": False, "error": "No properties specified for export"}


@pytest.mark.unit
def test_export_devices_writes_yaml_file(tmp_path) -> None:
    """Fetched device data is filtered, rendered to YAML, and written to disk."""
    nautobot = MagicMock()
    nautobot.graphql_query = AsyncMock(
        return_value={
            "data": {
                "devices": [
                    {
                        "id": "dev-1",
                        "name": "router-01",
                        "status": {"name": "Active"},
                    }
                ]
            }
        }
    )
    job_runs = MagicMock()
    job_runs.get_job_run_by_celery_id.return_value = None
    settings = MagicMock()
    settings.data_directory = str(tmp_path)

    with patch(
        "service_factory.build_nautobot_service", return_value=nautobot
    ), patch(
        "service_factory.build_job_run_service", return_value=job_runs
    ), patch("config.settings", settings), patch.object(
        export_devices_task, "update_state"
    ):
        result = export_devices_task.run(
            device_ids=["dev-1"],
            properties=["name", "status"],
            export_format="yaml",
        )

    assert result["success"] is True
    assert result["exported_devices"] == 1
    assert result["export_format"] == "yaml"
    assert result["file_path"].startswith(str(tmp_path))
    exported = (tmp_path / "exports" / result["filename"]).read_text(encoding="utf-8")
    assert "router-01" in exported
    nautobot.graphql_query.assert_awaited_once()


@pytest.mark.unit
def test_export_devices_returns_error_when_nautobot_returns_no_devices() -> None:
    """An empty Nautobot response returns a user-facing failure."""
    nautobot = MagicMock()
    nautobot.graphql_query = AsyncMock(return_value={"data": {"devices": []}})

    with patch(
        "service_factory.build_nautobot_service", return_value=nautobot
    ), patch.object(export_devices_task, "update_state"):
        result = export_devices_task.run(
            device_ids=["missing"],
            properties=["name"],
            export_format="csv",
        )

    assert result == {
        "success": False,
        "error": "No devices found in Nautobot",
        "requested_count": 1,
    }


@pytest.mark.unit
def test_export_devices_rejects_unsupported_format(tmp_path) -> None:
    """Unsupported export formats are rejected after successful data fetch."""
    nautobot = MagicMock()
    nautobot.graphql_query = AsyncMock(
        return_value={"data": {"devices": [{"id": "dev-1", "name": "router-01"}]}}
    )

    with patch(
        "service_factory.build_nautobot_service", return_value=nautobot
    ), patch.object(export_devices_task, "update_state"):
        result = export_devices_task.run(
            device_ids=["dev-1"],
            properties=["name"],
            export_format="xml",
        )

    assert result == {"success": False, "error": "Unsupported export format: xml"}
