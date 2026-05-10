"""Unit tests for tasks/check_ip_task.py.

All tests run offline — no Nautobot, database, or network required.
The device query service and settings manager are fully mocked.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tasks.check_ip_task import check_ip_task

_PATCH_SF = "tasks.check_ip_task.service_factory"
_PATCH_SETTINGS = "tasks.check_ip_task.settings_manager"


def _make_dqs(devices: list) -> MagicMock:
    """Return a mock device query service that yields *devices* on the first page."""
    dqs = MagicMock()
    dqs.get_devices = AsyncMock(
        side_effect=[
            {"devices": devices},
            {"devices": []},
        ]
    )
    return dqs


def _make_jrs() -> MagicMock:
    jrs = MagicMock()
    jrs.get_job_run_by_celery_id.return_value = None
    return jrs


def _csv(rows: list[dict], delimiter: str = ",") -> str:
    """Build a minimal CSV string from a list of dicts."""
    if not rows:
        return "ip_address,name\n"
    headers = list(rows[0].keys())
    lines = [delimiter.join(headers)]
    for row in rows:
        lines.append(delimiter.join(str(row[h]) for h in headers))
    return "\n".join(lines)


def _run(csv_content: str, devices: list, delimiter: str = ",") -> dict:
    """Helper that runs check_ip_task with patched dependencies."""
    with patch.object(check_ip_task, "update_state"):
        with patch(_PATCH_SF) as mock_sf:
            mock_sf.build_device_query_service.return_value = _make_dqs(devices)
            mock_sf.build_job_run_service.return_value = _make_jrs()
            return check_ip_task.run(
                csv_content, delimiter=delimiter, quote_char='"'
            )


# ── happy path ────────────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.nautobot
def test_check_ip_task_all_match():
    """All CSV devices match Nautobot by IP and name → all status='match'."""
    csv_content = _csv([
        {"ip_address": "10.0.0.1", "name": "router1"},
        {"ip_address": "10.0.0.2", "name": "switch1"},
    ])
    nautobot_devices = [
        {"name": "router1", "primary_ip4": "10.0.0.1/24"},
        {"name": "switch1", "primary_ip4": "10.0.0.2/24"},
    ]

    result = _run(csv_content, nautobot_devices)

    assert result["success"] is True
    assert result["statistics"]["matches"] == 2
    assert result["statistics"]["name_mismatches"] == 0
    assert result["statistics"]["ip_not_found"] == 0
    statuses = {r["ip_address"]: r["status"] for r in result["results"]}
    assert statuses["10.0.0.1"] == "match"
    assert statuses["10.0.0.2"] == "match"


@pytest.mark.unit
@pytest.mark.nautobot
def test_check_ip_task_name_mismatch():
    """IP found in Nautobot but name differs → status='name_mismatch'."""
    csv_content = _csv([{"ip_address": "10.0.0.1", "name": "old-name"}])
    nautobot_devices = [{"name": "new-name", "primary_ip4": "10.0.0.1/24"}]

    result = _run(csv_content, nautobot_devices)

    assert result["success"] is True
    assert result["statistics"]["name_mismatches"] == 1
    assert result["results"][0]["status"] == "name_mismatch"
    assert result["results"][0]["nautobot_device_name"] == "new-name"


@pytest.mark.unit
@pytest.mark.nautobot
def test_check_ip_task_ip_not_found():
    """CSV IP absent from Nautobot → status='ip_not_found'."""
    csv_content = _csv([{"ip_address": "10.99.99.99", "name": "ghost"}])
    nautobot_devices = [{"name": "router1", "primary_ip4": "10.0.0.1/24"}]

    result = _run(csv_content, nautobot_devices)

    assert result["success"] is True
    assert result["statistics"]["ip_not_found"] == 1
    assert result["results"][0]["status"] == "ip_not_found"


@pytest.mark.unit
@pytest.mark.nautobot
def test_check_ip_task_cidr_ip_in_csv_stripped():
    """CIDR notation in CSV IP (10.0.0.1/24) is stripped to bare IP for comparison."""
    csv_content = _csv([{"ip_address": "10.0.0.1/24", "name": "router1"}])
    nautobot_devices = [{"name": "router1", "primary_ip4": "10.0.0.1"}]

    result = _run(csv_content, nautobot_devices)

    assert result["results"][0]["status"] == "match"
    assert result["results"][0]["ip_address"] == "10.0.0.1"


@pytest.mark.unit
@pytest.mark.nautobot
def test_check_ip_task_mixed_results():
    """Match, mismatch, and not-found all appear in the same run."""
    csv_content = _csv([
        {"ip_address": "10.0.0.1", "name": "router1"},
        {"ip_address": "10.0.0.2", "name": "wrong-name"},
        {"ip_address": "10.0.0.99", "name": "ghost"},
    ])
    nautobot_devices = [
        {"name": "router1", "primary_ip4": "10.0.0.1/24"},
        {"name": "switch1", "primary_ip4": "10.0.0.2/24"},
    ]

    result = _run(csv_content, nautobot_devices)

    stats = result["statistics"]
    assert stats["matches"] == 1
    assert stats["name_mismatches"] == 1
    assert stats["ip_not_found"] == 1


# ── error paths ───────────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.nautobot
def test_check_ip_task_csv_missing_required_columns():
    """CSV without 'ip_address' and 'name' columns returns success=False."""
    csv_content = "hostname,address\nrouter1,10.0.0.1"

    with patch.object(check_ip_task, "update_state"):
        with patch(_PATCH_SF) as mock_sf:
            mock_sf.build_device_query_service.return_value = _make_dqs([])
            mock_sf.build_job_run_service.return_value = _make_jrs()
            with patch(_PATCH_SETTINGS):
                result = check_ip_task.run(
                    csv_content, delimiter=",", quote_char='"'
                )

    assert result["success"] is False
    assert "ip_address" in result["error"] or "name" in result["error"]


@pytest.mark.unit
@pytest.mark.nautobot
def test_check_ip_task_device_query_service_raises():
    """Exception from get_devices is caught and returned as success=False."""
    csv_content = _csv([{"ip_address": "10.0.0.1", "name": "router1"}])
    dqs = MagicMock()
    dqs.get_devices = AsyncMock(side_effect=RuntimeError("nautobot down"))

    with patch.object(check_ip_task, "update_state"):
        with patch(_PATCH_SF) as mock_sf:
            mock_sf.build_device_query_service.return_value = dqs
            mock_sf.build_job_run_service.return_value = _make_jrs()
            result = check_ip_task.run(csv_content, delimiter=",", quote_char='"')

    assert result["success"] is False
    assert "nautobot down" in result["error"]


@pytest.mark.unit
@pytest.mark.nautobot
def test_check_ip_task_provided_delimiter_used_directly():
    """Provided delimiter/quote_char params bypass settings lookup."""
    csv_content = "ip_address;name\n10.0.0.1;router1"
    nautobot_devices = [{"name": "router1", "primary_ip4": "10.0.0.1"}]

    with patch.object(check_ip_task, "update_state"):
        with patch(_PATCH_SF) as mock_sf:
            mock_sf.build_device_query_service.return_value = _make_dqs(
                nautobot_devices
            )
            mock_sf.build_job_run_service.return_value = _make_jrs()
            with patch(_PATCH_SETTINGS) as mock_settings:
                result = check_ip_task.run(
                    csv_content, delimiter=";", quote_char='"'
                )

    mock_settings.get_nautobot_settings.assert_not_called()
    assert result["success"] is True
    assert result["results"][0]["status"] == "match"
