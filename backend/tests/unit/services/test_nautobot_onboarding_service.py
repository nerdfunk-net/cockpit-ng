"""Unit tests for DeviceOnboardingService.

All tests run offline - no real Nautobot instance required.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.nautobot.onboarding.onboarding_service import DeviceOnboardingService

DEVICE_ID = "ae000000-0000-0000-0003-000000000001"
JOB_ID = "job-123"


def _task() -> MagicMock:
    task = MagicMock()
    task.request.id = "celery-123"
    return task


def _response(payload: dict, status_code: int = 200) -> MagicMock:
    response = MagicMock()
    response.status_code = status_code
    response.json.return_value = payload
    response.text = "error text"
    response.raise_for_status = MagicMock()
    return response


@pytest.mark.unit
@pytest.mark.nautobot
def test_trigger_nautobot_onboarding_posts_expected_job_payload() -> None:
    """Onboarding trigger posts the Nautobot job payload and returns job metadata."""
    svc = DeviceOnboardingService()
    response = _response({"job_result": {"id": JOB_ID}})

    with (
        patch(
            "utils.nautobot_helpers.get_nautobot_config",
            return_value=("https://nautobot.example", "token"),
        ),
        patch(
            "utils.nautobot_helpers.get_nautobot_headers",
            return_value={"Authorization": "Token token"},
        ),
        patch(
            "services.nautobot.onboarding.onboarding_service.requests.post",
            return_value=response,
        ) as post,
    ):
        job_id, job_url = svc._trigger_nautobot_onboarding(
            ip_address="10.0.0.1",
            location_id="loc-1",
            role_id="role-1",
            namespace_id="ns-1",
            status_id="status-1",
            interface_status_id="if-status-1",
            ip_address_status_id="ip-status-1",
            secret_groups_id="secret-1",
            platform_id="detect",
            port=22,
            timeout=30,
        )

    assert job_id == JOB_ID
    assert job_url == f"https://nautobot.example/extras/job-results/{JOB_ID}/"
    payload = post.call_args.kwargs["json"]
    assert payload["data"]["platform"] is None
    assert payload["data"]["ip_addresses"] == "10.0.0.1"


@pytest.mark.unit
@pytest.mark.nautobot
def test_trigger_nautobot_onboarding_requires_job_id() -> None:
    """Missing job IDs from Nautobot raise an exception."""
    svc = DeviceOnboardingService()

    with (
        patch(
            "utils.nautobot_helpers.get_nautobot_config",
            return_value=("https://nautobot.example", "token"),
        ),
        patch("utils.nautobot_helpers.get_nautobot_headers", return_value={}),
        patch(
            "services.nautobot.onboarding.onboarding_service.requests.post",
            return_value=_response({"job_result": {}}),
        ),
        pytest.raises(Exception, match="No job ID returned"),
    ):
        svc._trigger_nautobot_onboarding(
            ip_address="10.0.0.1",
            location_id="loc-1",
            role_id="role-1",
            namespace_id="ns-1",
            status_id="status-1",
            interface_status_id="if-status-1",
            ip_address_status_id="ip-status-1",
            secret_groups_id="secret-1",
            platform_id="ios",
            port=22,
            timeout=30,
        )


@pytest.mark.unit
@pytest.mark.nautobot
def test_wait_for_job_completion_returns_success_on_completed_status() -> None:
    """Completed Nautobot jobs stop polling and return success."""
    svc = DeviceOnboardingService()

    with (
        patch(
            "utils.nautobot_helpers.get_nautobot_config",
            return_value=("https://nautobot.example", "token"),
        ),
        patch(
            "services.nautobot.onboarding.onboarding_service.requests.get",
            return_value=_response({"status": {"value": "completed"}}),
        ),
        patch(
            "services.nautobot.onboarding.onboarding_service.time.time",
            side_effect=[0, 1, 1],
        ),
        patch("services.nautobot.onboarding.onboarding_service.time.sleep") as sleep,
    ):
        result = svc._wait_for_job_completion(_task(), JOB_ID, max_wait=30)

    assert result == (True, "Job completed successfully")
    sleep.assert_not_called()


@pytest.mark.unit
@pytest.mark.nautobot
def test_wait_for_job_completion_times_out() -> None:
    """Polling returns a timeout tuple when no terminal status is reached."""
    svc = DeviceOnboardingService()

    with (
        patch(
            "utils.nautobot_helpers.get_nautobot_config",
            return_value=("https://nautobot.example", "token"),
        ),
        patch(
            "services.nautobot.onboarding.onboarding_service.requests.get",
            return_value=_response({"status": {"value": "running"}}),
        ),
        patch(
            "services.nautobot.onboarding.onboarding_service.time.time",
            side_effect=[0, 1, 1, 4],
        ),
        patch("services.nautobot.onboarding.onboarding_service.time.sleep"),
    ):
        success, message = svc._wait_for_job_completion(_task(), JOB_ID, max_wait=3)

    assert success is False
    assert "Job timeout" in message


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_async_get_device_id_returns_primary_device() -> None:
    """Primary IP GraphQL lookup returns the first primary device."""
    mock_nb = MagicMock()
    mock_nb.graphql_query = AsyncMock(
        return_value={
            "data": {
                "ip_addresses": [
                    {
                        "address": "10.0.0.1/24",
                        "primary_ip4_for": [{"id": DEVICE_ID, "name": "router-01"}],
                    }
                ]
            }
        }
    )
    svc = DeviceOnboardingService()

    with patch("service_factory.build_nautobot_service", return_value=mock_nb):
        result = await svc._async_get_device_id("10.0.0.1/24")

    assert result == (DEVICE_ID, "router-01")


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_async_get_device_id_returns_none_on_graphql_errors() -> None:
    """GraphQL errors during primary IP lookup return a none tuple."""
    mock_nb = MagicMock()
    mock_nb.graphql_query = AsyncMock(return_value={"errors": [{"message": "boom"}]})
    svc = DeviceOnboardingService()

    with patch("service_factory.build_nautobot_service", return_value=mock_nb):
        result = await svc._async_get_device_id("10.0.0.1/24")

    assert result == (None, None)


@pytest.mark.unit
@pytest.mark.nautobot
def test_update_device_tags_patches_tags() -> None:
    """Tag updates PATCH the device and return a success count."""
    svc = DeviceOnboardingService()

    with (
        patch(
            "utils.nautobot_helpers.get_nautobot_config",
            return_value=("https://nautobot.example", "token"),
        ),
        patch("utils.nautobot_helpers.get_nautobot_headers", return_value={}),
        patch(
            "services.nautobot.onboarding.onboarding_service.requests.patch",
            return_value=_response({"id": DEVICE_ID}),
        ) as patch_request,
    ):
        result = svc._update_device_tags(DEVICE_ID, ["tag-1", "tag-2"])

    assert result == {
        "success": True,
        "type": "tags",
        "count": 2,
        "message": "Applied 2 tags",
    }
    assert patch_request.call_args.kwargs["json"] == {"tags": ["tag-1", "tag-2"]}


@pytest.mark.unit
@pytest.mark.nautobot
def test_process_single_device_runs_optional_updates_and_sync() -> None:
    """Single-device processing applies tags/custom fields, starts sync, and logs audit."""
    svc = DeviceOnboardingService()
    svc._get_device_id_from_ip = MagicMock(return_value=(DEVICE_ID, "router-01"))
    svc._update_device_tags = MagicMock(return_value={"success": True, "type": "tags"})
    svc._update_device_custom_fields = MagicMock(
        return_value={"success": True, "type": "custom_fields"}
    )
    svc._sync_network_data = MagicMock(
        return_value={"success": True, "job_id": "sync-1"}
    )

    with patch("utils.audit_logger.log_device_onboarding") as audit:
        result = svc._process_single_device(
            task_instance=_task(),
            ip_address="10.0.0.1/24",
            namespace_id="ns-1",
            prefix_status_id="prefix-status",
            interface_status_id="if-status",
            ip_address_status_id="ip-status",
            sync_options=["cables"],
            tags=["tag-1"],
            custom_fields={"owner": "netops"},
            device_num=1,
            device_count=1,
            username="admin",
            user_id=1,
        )

    assert result["success"] is True
    assert result["device_id"] == DEVICE_ID
    assert len(result["update_results"]) == 2
    audit.assert_called_once()


@pytest.mark.unit
@pytest.mark.nautobot
def test_onboard_returns_partial_success_for_mixed_device_results() -> None:
    """Multi-device onboarding reports partial success when one post-step fails."""
    svc = DeviceOnboardingService()
    svc._trigger_nautobot_onboarding = MagicMock(return_value=(JOB_ID, "job-url"))
    svc._wait_for_job_completion = MagicMock(return_value=(True, "ok"))
    svc._process_single_device = MagicMock(
        side_effect=[
            {"success": True, "device_name": "router-01"},
            {
                "success": False,
                "error": "lookup failed",
                "stage": "device_lookup_failed",
            },
        ]
    )

    result = svc.onboard(
        task_instance=_task(),
        ip_address="10.0.0.1,10.0.0.2",
        location_id="loc",
        role_id="role",
        namespace_id="ns",
        status_id="status",
        interface_status_id="if-status",
        ip_address_status_id="ip-status",
        prefix_status_id="prefix-status",
        secret_groups_id="secret",
        platform_id="detect",
        port=22,
        timeout=30,
    )

    assert result["success"] is False
    assert result["partial_success"] is True
    assert result["successful_devices"] == 1
    assert result["failed_devices"] == 1
    assert result["stage"] == "partial_success"
