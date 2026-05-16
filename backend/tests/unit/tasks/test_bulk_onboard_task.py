"""Unit tests for tasks/bulk_onboard_task.py.

All tests run offline - no Nautobot, database, or Celery broker required.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from tasks.bulk_onboard_task import bulk_onboard_devices_task

DEFAULT_CONFIG = {
    "location_id": "loc-1",
    "namespace_id": "ns-1",
    "role_id": "role-1",
    "status_id": "status-1",
    "interface_status_id": "if-status-1",
    "ip_address_status_id": "ip-status-1",
    "prefix_status_id": "prefix-status-1",
    "secret_groups_id": "secret-1",
    "platform_id": "detect",
    "onboarding_timeout": 5,
    "sync_options": ["interfaces"],
}


@pytest.mark.unit
def test_bulk_onboard_empty_devices_fails_validation() -> None:
    """Empty device lists are rejected before progress updates or service calls."""
    result = bulk_onboard_devices_task.run([], DEFAULT_CONFIG)

    assert result == {
        "success": False,
        "error": "No devices provided for bulk onboarding",
        "stage": "validation_failed",
    }


@pytest.mark.unit
def test_bulk_onboard_successful_device_updates_job_run() -> None:
    """A successful onboarding flow records the device result and marks the job complete."""
    job_runs = MagicMock()
    job_runs.get_job_run_by_celery_id.return_value = {"id": 77}

    with patch(
        "tasks.onboard_device_task._trigger_nautobot_onboarding",
        return_value=("job-1", "http://nautobot/jobs/job-1"),
    ) as trigger, patch(
        "tasks.onboard_device_task._wait_for_job_completion",
        return_value=(True, {"status": "completed"}),
    ), patch(
        "tasks.onboard_device_task._process_single_device",
        return_value={
            "success": True,
            "device_id": "dev-1",
            "device_name": "router-01",
        },
    ) as process, patch(
        "service_factory.build_job_run_service", return_value=job_runs
    ), patch.object(
        bulk_onboard_devices_task, "update_state"
    ):
        result = bulk_onboard_devices_task.run(
            devices=[{"ip_address": "192.0.2.10"}],
            default_config=DEFAULT_CONFIG,
            username="alice",
            user_id=10,
        )

    assert result["success"] is True
    assert result["successful_devices"] == 1
    assert result["failed_devices"] == 0
    assert result["devices"][0]["device_name"] == "router-01"
    trigger.assert_called_once()
    process.assert_called_once()
    job_runs.mark_completed.assert_called_once()


@pytest.mark.unit
def test_bulk_onboard_missing_required_fields_records_device_failure() -> None:
    """Missing merged configuration fields are recorded as per-device errors."""
    job_runs = MagicMock()
    job_runs.get_job_run_by_celery_id.return_value = {"id": 78}
    incomplete_defaults = {**DEFAULT_CONFIG, "location_id": ""}

    with patch(
        "service_factory.build_job_run_service", return_value=job_runs
    ), patch.object(bulk_onboard_devices_task, "update_state"):
        result = bulk_onboard_devices_task.run(
            devices=[{"ip_address": "192.0.2.10"}],
            default_config=incomplete_defaults,
        )

    assert result["success"] is False
    assert result["stage"] == "all_failed"
    assert result["devices"][0]["stage"] == "exception"
    assert "Missing required fields: location_id" in result["devices"][0]["message"]
    job_runs.mark_failed.assert_called_once()


@pytest.mark.unit
def test_bulk_onboard_job_timeout_records_onboarding_failure() -> None:
    """A Nautobot job timeout skips post-processing and marks the device failed."""
    job_runs = MagicMock()
    job_runs.get_job_run_by_celery_id.return_value = None

    with patch(
        "tasks.onboard_device_task._trigger_nautobot_onboarding",
        return_value=("job-timeout", "url"),
    ), patch(
        "tasks.onboard_device_task._wait_for_job_completion",
        return_value=(False, "timeout"),
    ), patch(
        "tasks.onboard_device_task._process_single_device"
    ) as process, patch(
        "service_factory.build_job_run_service", return_value=job_runs
    ), patch.object(
        bulk_onboard_devices_task, "update_state"
    ):
        result = bulk_onboard_devices_task.run(
            devices=[{"ip_address": "192.0.2.10"}],
            default_config=DEFAULT_CONFIG,
        )

    assert result["success"] is False
    assert result["devices"][0]["stage"] == "onboarding_failed"
    process.assert_not_called()
