"""Unit tests for tasks/update_devices_from_csv_task.py.

Covers:
- _apply_name_transform() — pure regex/replace helper
- _prepare_row_data()     — pure CSV row → (identifier, update_data, interface_config)
- update_devices_from_csv_task — Celery task end-to-end with mocked service

All tests run offline — no Nautobot, database, or Celery broker required.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tasks.update_devices_from_csv_task import (
    _apply_name_transform,
    _prepare_row_data,
    update_devices_from_csv_task,
)

_PATCH_SF = "tasks.update_devices_from_csv_task.service_factory"
_PATCH_SVC = "tasks.update_devices_from_csv_task.DeviceUpdateService"


# ── _apply_name_transform ─────────────────────────────────────────────────────


class TestApplyNameTransform:
    """Tests for the _apply_name_transform() pure function."""

    def test_none_transform_returns_original(self):
        """None name_transform leaves the name unchanged."""
        assert _apply_name_transform("router1.example.com", None) == "router1.example.com"

    def test_empty_pattern_returns_original(self):
        """Empty pattern string leaves the name unchanged."""
        assert _apply_name_transform("router1", {"mode": "regex", "pattern": ""}) == "router1"

    def test_regex_mode_no_capturing_group_returns_full_match(self):
        """Regex without a capturing group returns the full match (group 0)."""
        result = _apply_name_transform("router1.example.com", {"mode": "regex", "pattern": r"\w+"})
        assert result == "router1"

    def test_regex_mode_with_capturing_group_returns_group1(self):
        """Regex with a capturing group returns group(1)."""
        result = _apply_name_transform(
            "router1.example.com",
            {"mode": "regex", "pattern": r"(\w+)\."},
        )
        assert result == "router1"

    def test_regex_mode_no_match_returns_original(self):
        """Regex that matches nothing leaves the name unchanged."""
        result = _apply_name_transform("router1", {"mode": "regex", "pattern": r"^\d+$"})
        assert result == "router1"

    def test_replace_mode_substitutes_pattern(self):
        """Replace mode applies re.sub with the given replacement."""
        result = _apply_name_transform(
            "sw-core-01",
            {"mode": "replace", "pattern": r"-\d+$", "replacement": ""},
        )
        assert result == "sw-core"

    def test_replace_mode_no_match_returns_original(self):
        """Replace mode with non-matching pattern returns the original string."""
        result = _apply_name_transform(
            "router1",
            {"mode": "replace", "pattern": r"^\d+", "replacement": "X"},
        )
        assert result == "router1"

    def test_invalid_pattern_returns_original(self):
        """An invalid regex pattern is caught and the original name is returned."""
        result = _apply_name_transform("router1", {"mode": "regex", "pattern": r"[invalid"})
        assert result == "router1"


# ── _prepare_row_data ─────────────────────────────────────────────────────────


class TestPrepareRowData:
    """Tests for the _prepare_row_data() pure function."""

    def test_name_extracted_as_identifier(self):
        """name column is placed in device_identifier, not update_data."""
        row = {"name": "router1", "status": "active"}
        headers = list(row.keys())
        identifier, update_data, _ = _prepare_row_data(row, headers)
        assert identifier["name"] == "router1"
        assert "name" not in update_data
        assert update_data["status"] == "active"

    def test_id_extracted_as_identifier(self):
        """id column is placed in device_identifier, not update_data."""
        row = {"id": "dev-uuid", "status": "active"}
        headers = list(row.keys())
        identifier, update_data, _ = _prepare_row_data(row, headers)
        assert identifier["id"] == "dev-uuid"
        assert "id" not in update_data

    def test_ip_address_extracted_as_identifier(self):
        """ip_address column is placed in device_identifier, not update_data."""
        row = {"ip_address": "10.0.0.1", "status": "active"}
        headers = list(row.keys())
        identifier, update_data, _ = _prepare_row_data(row, headers)
        assert identifier["ip_address"] == "10.0.0.1"
        assert "ip_address" not in update_data

    def test_custom_primary_key_column(self):
        """Custom primary_key_column with a mapping to a standard field is excluded from update_data."""
        row = {"hostname": "router1", "status": "active"}
        headers = list(row.keys())
        # Map hostname -> name so the pk column is treated as the 'name' identifier
        mapping = {"hostname": "name"}
        identifier, update_data, _ = _prepare_row_data(
            row, headers, column_mapping=mapping, primary_key_column="hostname"
        )
        assert identifier["name"] == "router1"
        assert "name" not in update_data

    def test_column_mapping_renames_field(self):
        """column_mapping translates CSV column names to Nautobot field names."""
        row = {"hostname": "router1", "state": "active"}
        headers = list(row.keys())
        mapping = {"hostname": "name", "state": "status"}
        identifier, update_data, _ = _prepare_row_data(
            row, headers, column_mapping=mapping, primary_key_column="hostname"
        )
        assert identifier["name"] == "router1"
        assert "status" in update_data
        assert update_data["status"] == "active"

    def test_selected_columns_filters_update_data(self):
        """Only columns in selected_columns are included in update_data."""
        row = {"name": "r1", "status": "active", "role": "edge", "platform": "ios"}
        headers = list(row.keys())
        identifier, update_data, _ = _prepare_row_data(
            row, headers, selected_columns=["name", "status"]
        )
        assert update_data == {"status": "active"}
        assert "role" not in update_data
        assert "platform" not in update_data

    def test_cf_prefix_fields_grouped_under_custom_fields(self):
        """Columns mapped to names starting with cf_ are grouped under custom_fields."""
        row = {"name": "r1", "cf_net": "netA", "cf_region": "EU"}
        headers = list(row.keys())
        identifier, update_data, _ = _prepare_row_data(row, headers)
        assert "custom_fields" in update_data
        assert update_data["custom_fields"]["net"] == "netA"
        assert update_data["custom_fields"]["region"] == "EU"
        assert "cf_net" not in update_data

    def test_tags_converted_from_csv_string_to_list(self):
        """Comma-separated tags string is split into a list with whitespace trimmed."""
        row = {"name": "r1", "tags": "tag1, tag2 , tag3"}
        headers = list(row.keys())
        _, update_data, _ = _prepare_row_data(row, headers)
        assert update_data["tags"] == ["tag1", "tag2", "tag3"]

    def test_empty_values_are_skipped(self):
        """Empty string values are not included in update_data."""
        row = {"name": "r1", "status": "", "role": "edge"}
        headers = list(row.keys())
        _, update_data, _ = _prepare_row_data(row, headers)
        assert "status" not in update_data
        assert update_data["role"] == "edge"

    def test_interface_config_built_when_interface_columns_present(self):
        """interface_name/type/status columns produce an interface_config dict."""
        row = {
            "name": "r1",
            "interface_name": "Loopback0",
            "interface_type": "virtual",
            "interface_status": "active",
        }
        headers = list(row.keys())
        _, _, interface_config = _prepare_row_data(row, headers)
        assert interface_config is not None
        assert interface_config["name"] == "Loopback0"
        assert interface_config["type"] == "virtual"
        assert interface_config["status"] == "active"

    def test_interface_config_is_none_without_interface_columns(self):
        """interface_config is None when no interface columns are in the CSV."""
        row = {"name": "r1", "status": "active"}
        headers = list(row.keys())
        _, _, interface_config = _prepare_row_data(row, headers)
        assert interface_config is None

    def test_interface_columns_excluded_from_update_data(self):
        """interface_name/type/status are not placed in update_data."""
        row = {
            "name": "r1",
            "interface_name": "eth0",
            "interface_type": "virtual",
            "interface_status": "active",
            "status": "active",
        }
        headers = list(row.keys())
        _, update_data, _ = _prepare_row_data(row, headers)
        for field in ["interface_name", "interface_type", "interface_status"]:
            assert field not in update_data
        assert update_data["status"] == "active"

    def test_ip_namespace_added_to_update_data(self):
        """ip_namespace column is added to update_data when present."""
        row = {"name": "r1", "ip_namespace": "Global", "status": "active"}
        headers = list(row.keys())
        _, update_data, _ = _prepare_row_data(row, headers)
        assert update_data["ip_namespace"] == "Global"


# ── update_devices_from_csv_task helpers ──────────────────────────────────────


def _csv(*rows: dict, delimiter: str = ",") -> str:
    """Build a minimal CSV string from a list of dicts."""
    if not rows:
        return ""
    headers = list(rows[0].keys())
    lines = [delimiter.join(headers)]
    for row in rows:
        lines.append(delimiter.join(str(row.get(h, "")) for h in headers))
    return "\n".join(lines)


def _make_jrs() -> MagicMock:
    jrs = MagicMock()
    jrs.get_job_run_by_celery_id.return_value = None
    return jrs


def _make_update_svc(result=None, error=None) -> MagicMock:
    svc = MagicMock()
    if error:
        svc.update_device = AsyncMock(side_effect=error)
    else:
        svc.update_device = AsyncMock(
            return_value=result
            or {
                "device_id": "dev-uuid-1",
                "device_name": "router1",
                "updated_fields": ["status"],
                "warnings": [],
            }
        )
    return svc


def _run(csv_content: str, dry_run: bool = False, svc=None) -> dict:
    """Run update_devices_from_csv_task synchronously with all deps mocked."""
    if svc is None:
        svc = _make_update_svc()
    with patch.object(update_devices_from_csv_task, "update_state"):
        with patch(_PATCH_SF) as mock_sf:
            mock_sf.build_nautobot_service.return_value = MagicMock()
            mock_sf.build_job_run_service.return_value = _make_jrs()
            with patch(_PATCH_SVC, return_value=svc):
                return update_devices_from_csv_task.run(csv_content, dry_run=dry_run)


# ── update_devices_from_csv_task tests ───────────────────────────────────────


@pytest.mark.unit
@pytest.mark.nautobot
def test_csv_task_empty_csv_returns_failure():
    """An empty CSV string returns success=False."""
    result = _run("")
    assert result["success"] is False


@pytest.mark.unit
@pytest.mark.nautobot
def test_csv_task_missing_identifier_column_returns_failure():
    """CSV without id/name/ip_address column returns success=False."""
    csv_content = _csv({"hostname": "r1", "status": "active"})
    result = _run(csv_content)
    assert result["success"] is False
    assert "identifier" in result["error"].lower() or "missing" in result["error"].lower()


@pytest.mark.unit
@pytest.mark.nautobot
def test_csv_task_dry_run_records_success_without_service_call():
    """Dry run records each row in successes and does not call update_device."""
    svc = _make_update_svc()
    csv_content = _csv({"name": "router1", "status": "active"})
    result = _run(csv_content, dry_run=True, svc=svc)
    assert result["success"] is True
    assert result["summary"]["successful"] == 1
    assert result["dry_run"] is True
    assert result["successes"][0]["dry_run"] is True
    svc.update_device.assert_not_called()


@pytest.mark.unit
@pytest.mark.nautobot
def test_csv_task_service_success_recorded_in_successes():
    """Successful service update is placed in the successes list."""
    csv_content = _csv({"name": "router1", "status": "active"})
    result = _run(csv_content)
    assert result["success"] is True
    assert result["summary"]["successful"] == 1
    assert result["summary"]["failed"] == 0


@pytest.mark.unit
@pytest.mark.nautobot
def test_csv_task_service_error_goes_to_failures():
    """Service exception is caught and the row is placed in failures."""
    svc = _make_update_svc(error=RuntimeError("device not found"))
    csv_content = _csv({"name": "router1", "status": "active"})
    result = _run(csv_content, svc=svc)
    assert result["success"] is True  # task succeeds; device failed
    assert result["summary"]["failed"] == 1
    assert "device not found" in result["failures"][0]["error"]


@pytest.mark.unit
@pytest.mark.nautobot
def test_csv_task_row_with_no_updateable_data_is_skipped():
    """Row that maps to no update_data is added to the skipped list."""
    # Only "name" — identifier only, nothing to update
    csv_content = _csv({"name": "router1"})
    result = _run(csv_content)
    assert result["summary"]["skipped"] == 1
    assert result["summary"]["successful"] == 0


@pytest.mark.unit
@pytest.mark.nautobot
def test_csv_task_multiple_rows_counted_correctly():
    """Multiple CSV rows are each processed and counted."""
    svc = MagicMock()
    svc.update_device = AsyncMock(
        side_effect=[
            {"device_id": "id-1", "device_name": "r1", "updated_fields": ["status"], "warnings": []},
            {"device_id": "id-2", "device_name": "r2", "updated_fields": ["status"], "warnings": []},
        ]
    )
    csv_content = _csv(
        {"name": "r1", "status": "active"},
        {"name": "r2", "status": "planned"},
    )
    result = _run(csv_content, svc=svc)
    assert result["summary"]["total"] == 2
    assert result["summary"]["successful"] == 2


@pytest.mark.unit
@pytest.mark.nautobot
def test_csv_task_custom_delimiter_parsed_correctly():
    """Semicolon-delimited CSV is parsed when delimiter option is provided."""
    svc = _make_update_svc()
    csv_content = "name;status\nrouter1;active"
    with patch.object(update_devices_from_csv_task, "update_state"):
        with patch(_PATCH_SF) as mock_sf:
            mock_sf.build_nautobot_service.return_value = MagicMock()
            mock_sf.build_job_run_service.return_value = _make_jrs()
            with patch(_PATCH_SVC, return_value=svc):
                result = update_devices_from_csv_task.run(
                    csv_content,
                    csv_options={"delimiter": ";"},
                )
    assert result["success"] is True
    assert result["summary"]["total"] == 1
