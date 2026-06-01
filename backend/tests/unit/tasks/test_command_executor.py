"""Unit tests for tasks/execution/command_executor.py.

All tests run offline - no Nautobot, SSH, database, or Celery broker required.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tasks.execution.command_executor import execute_run_commands


@pytest.mark.unit
def test_execute_run_commands_requires_command_template() -> None:
    """Missing command template configuration fails before credential lookup."""
    result = execute_run_commands(
        schedule_id=None,
        credential_id=10,
        job_parameters={},
        target_devices=["dev-1"],
        task_context=MagicMock(),
    )

    assert result["success"] is False
    assert "No command template specified" in result["error"]


@pytest.mark.unit
def test_execute_run_commands_happy_path_sends_rendered_commands() -> None:
    """Rendered command lines are sent to Netmiko for each target device."""
    credentials = MagicMock()
    credentials.get_credential_by_id.return_value = {
        "name": "ssh",
        "username": "admin",
    }
    credentials.get_decrypted_password.return_value = "secret"
    templates = MagicMock()
    templates.get_template_by_name.return_value = {"id": 5, "name": "show-basic"}
    templates.get_template_content.return_value = "show version\nshow ip int brief"
    nautobot = MagicMock()
    nautobot.graphql_query = AsyncMock(
        return_value={
            "data": {
                "device": {
                    "id": "dev-1",
                    "name": "router-01",
                    "primary_ip4": {"address": "10.0.0.1/24"},
                    "platform": {"name": "Linux", "network_driver": "linux"},
                }
            }
        }
    )
    render_service = MagicMock()
    render_service.render_template = AsyncMock(return_value={"rendered_content": "show version\nshow ip int brief"})
    netmiko = MagicMock()
    netmiko._connect_and_execute.return_value = {
        "success": True,
        "output": "Cisco IOS output",
    }

    with (
        patch("service_factory.build_credentials_service", return_value=credentials),
        patch("service_factory.build_template_service", return_value=templates),
        patch("service_factory.build_nautobot_service", return_value=nautobot),
        patch("services.network.automation.render.RenderService", return_value=render_service),
        patch("services.network.automation.netmiko.NetmikoService", return_value=netmiko),
    ):
        result = execute_run_commands(
            schedule_id=None,
            credential_id=10,
            job_parameters={"command_template_name": "show-basic"},
            target_devices=["dev-1"],
            task_context=MagicMock(),
        )

    assert result["success"] is True
    assert result["success_count"] == 1
    assert result["failed_count"] == 0
    netmiko._connect_and_execute.assert_called_once_with(
        device_ip="10.0.0.1",
        device_type="linux",
        username="admin",
        password="secret",
        commands=["show version", "show ip int brief"],
        enable_mode=False,
    )


@pytest.mark.unit
def test_execute_run_commands_records_device_fetch_failure() -> None:
    """Missing Nautobot device data is reported as a failed device."""
    credentials = MagicMock()
    credentials.get_credential_by_id.return_value = {"name": "ssh", "username": "admin"}
    credentials.get_decrypted_password.return_value = "secret"
    templates = MagicMock()
    templates.get_template_by_name.return_value = {"id": 5}
    templates.get_template_content.return_value = "show version"
    nautobot = MagicMock()
    nautobot.graphql_query = AsyncMock(return_value={"data": {"device": None}})

    with (
        patch("service_factory.build_credentials_service", return_value=credentials),
        patch("service_factory.build_template_service", return_value=templates),
        patch("service_factory.build_nautobot_service", return_value=nautobot),
    ):
        result = execute_run_commands(
            schedule_id=None,
            credential_id=10,
            job_parameters={"command_template_name": "show-basic"},
            target_devices=["missing"],
            task_context=MagicMock(),
        )

    assert result["success"] is False
    assert result["failed_count"] == 1
    assert result["failed_devices"][0]["error"] == "Failed to fetch device data from Nautobot"
