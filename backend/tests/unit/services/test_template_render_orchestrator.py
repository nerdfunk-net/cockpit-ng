"""Unit tests for TemplateRenderOrchestrator.

All tests run offline - no Nautobot, CheckMK, Celery, or database required.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from models.templates import (
    AdvancedTemplateRenderRequest,
    TemplateExecuteAndSyncRequest,
)
from services.templates.render_orchestrator import (
    TemplateRenderOrchestrator,
    _extract_template_variables,
    _parse_rendered_output,
)

DEVICE_ID = "ba000000-0000-0000-0003-000000000001"


def _orchestrator() -> TemplateRenderOrchestrator:
    device_qs = MagicMock()
    device_qs.get_device_details = AsyncMock(
        return_value={
            "id": DEVICE_ID,
            "name": "router-01",
            "primary_ip4": {"address": "10.0.0.1/24"},
        }
    )
    checkmk = MagicMock()
    checkmk.load_snmp_mapping.return_value = {"cisco_ios": {"snmp_community": "public"}}
    render = MagicMock()
    render._execute_pre_run_command = AsyncMock(
        return_value={
            "raw_output": "Version 17.9",
            "parsed_output": [{"version": "17.9"}],
        }
    )
    render.render_template = AsyncMock(
        return_value={
            "rendered_content": '{"name": "router-01", "status": "Active"}',
            "warnings": ["minor warning"],
        }
    )
    inventory = MagicMock()
    inventory.preview_inventory = AsyncMock(
        return_value=(
            [
                SimpleNamespace(
                    id=DEVICE_ID,
                    name="router-01",
                    primary_ip4="10.0.0.1/24",
                )
            ],
            1,
        )
    )
    template_manager = MagicMock()
    template_manager.get_template.return_value = {
        "id": 1,
        "name": "sync_template",
        "category": "netmiko",
        "use_nautobot_context": True,
        "pre_run_command": None,
        "credential_id": None,
    }
    template_manager.get_template_content.return_value = '{"name": "{{ device_name }}"}'
    return TemplateRenderOrchestrator(
        device_qs,
        checkmk,
        render,
        inventory,
        template_manager,
    )


@pytest.mark.asyncio
@pytest.mark.unit
async def test_advanced_render_netmiko_adds_device_context_and_pre_run_output() -> None:
    """Netmiko rendering includes Nautobot device data and parsed pre-run output."""
    orchestrator = _orchestrator()

    result = await orchestrator.advanced_render(
        AdvancedTemplateRenderRequest(
            template_content=(
                "device={{ devices[0].name }} ip={{ devices[0].primary_ip4 }} version={{ pre_run.parsed[0].version }}"
            ),
            category="netmiko",
            device_id=DEVICE_ID,
            credential_id=10,
            pre_run_command="show version",
            use_nautobot_context=True,
        )
    )

    assert "device=router-01" in result.rendered_content
    assert "ip=10.0.0.1/24" in result.rendered_content
    assert "version=17.9" in result.rendered_content
    assert result.pre_run_output == "Version 17.9"
    assert result.context_data["device_details"]["name"] == "router-01"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_advanced_render_netmiko_requires_device_for_pre_run() -> None:
    """Pre-run commands require a selected test device."""
    orchestrator = _orchestrator()

    with pytest.raises(ValueError, match="test device is required"):
        await orchestrator.advanced_render(
            AdvancedTemplateRenderRequest(
                template_content="{{ pre_run.raw }}",
                category="netmiko",
                pre_run_command="show version",
                credential_id=10,
            )
        )


@pytest.mark.asyncio
@pytest.mark.unit
async def test_advanced_render_agent_adds_inventory_snmp_mapping_and_path() -> None:
    """Agent rendering combines inventory devices, SNMP mapping, and path variables."""
    orchestrator = _orchestrator()
    persistence = MagicMock()
    persistence.get_inventory.return_value = {"conditions": [{"field": "role"}]}

    with (
        patch(
            "service_factory.build_inventory_persistence_service",
            return_value=persistence,
        ),
        patch(
            "utils.inventory_converter.convert_saved_inventory_to_operations",
            return_value=[{"operation": "role"}],
        ),
    ):
        result = await orchestrator.advanced_render(
            AdvancedTemplateRenderRequest(
                template_content=(
                    "count={{ devices|length }} snmp={{ snmp_mapping.cisco_ios.snmp_community }} path={{ path }}"
                ),
                category="agent",
                inventory_id=7,
                pass_snmp_mapping=True,
                path="/etc/agent/config.yml",
            )
        )

    assert "count=1" in result.rendered_content
    assert "snmp=public" in result.rendered_content
    assert "path=/etc/agent/config.yml" in result.rendered_content


@pytest.mark.asyncio
@pytest.mark.unit
async def test_advanced_render_agent_records_inventory_warning() -> None:
    """Inventory lookup failures are returned as non-fatal warnings."""
    orchestrator = _orchestrator()

    with patch(
        "service_factory.build_inventory_persistence_service",
        side_effect=RuntimeError("inventory unavailable"),
    ):
        result = await orchestrator.advanced_render(
            AdvancedTemplateRenderRequest(
                template_content="hello {{ name }}",
                category="agent",
                inventory_id=7,
                user_variables={"name": "world"},
            )
        )

    assert result.rendered_content == "hello world"
    assert result.warnings == [
        "Failed to fetch inventory devices: inventory unavailable"
    ]


@pytest.mark.asyncio
@pytest.mark.unit
async def test_execute_and_sync_dry_run_returns_parsed_updates() -> None:
    """Dry-run execute-and-sync renders and parses output without queuing Celery."""
    orchestrator = _orchestrator()

    result = await orchestrator.execute_and_sync(
        TemplateExecuteAndSyncRequest(
            template_id=1,
            device_ids=[DEVICE_ID],
            dry_run=True,
            output_format="json",
        ),
        username="alice",
    )

    assert result.success is True
    assert result.task_id is None
    assert result.parsed_updates == [{"name": "router-01", "status": "Active"}]
    assert result.warnings == [f"Device {DEVICE_ID}: minor warning"]


@pytest.mark.asyncio
@pytest.mark.unit
async def test_execute_and_sync_queues_update_task_when_valid() -> None:
    """Successful non-dry-run execution queues the parsed device update task."""
    orchestrator = _orchestrator()
    job_runs = MagicMock()
    job_runs.create_job_run.return_value = {"id": 99}
    queued_task = SimpleNamespace(id="celery-123")
    update_task = MagicMock()
    update_task.delay.return_value = queued_task

    with (
        patch("service_factory.build_job_run_service", return_value=job_runs),
        patch("tasks.update_devices_task.update_devices_task", update_task),
    ):
        result = await orchestrator.execute_and_sync(
            TemplateExecuteAndSyncRequest(
                template_id=1,
                device_ids=[DEVICE_ID],
                dry_run=False,
                output_format="json",
            ),
            username="alice",
        )

    assert result.success is True
    assert result.task_id == "celery-123"
    assert result.job_id == "99"
    update_task.delay.assert_called_once_with(
        devices=[{"name": "router-01", "status": "Active"}],
        dry_run=False,
    )
    job_runs.mark_started.assert_called_once_with(99, "celery-123")


@pytest.mark.asyncio
@pytest.mark.unit
async def test_execute_and_sync_returns_parse_errors_without_queueing() -> None:
    """Invalid rendered output blocks queueing and returns parse errors."""
    orchestrator = _orchestrator()
    orchestrator._render.render_template = AsyncMock(
        return_value={"rendered_content": '["not-an-object"]', "warnings": []}
    )
    update_task = MagicMock()

    with (
        patch("service_factory.build_job_run_service", return_value=MagicMock()),
        patch("tasks.update_devices_task.update_devices_task", update_task),
    ):
        result = await orchestrator.execute_and_sync(
            TemplateExecuteAndSyncRequest(
                template_id=1,
                device_ids=[DEVICE_ID],
                dry_run=False,
                output_format="json",
            ),
            username="alice",
        )

    assert result.success is False
    assert "JSON output must be an object" in result.errors[0]
    update_task.delay.assert_not_called()


@pytest.mark.unit
def test_extract_template_variables_deduplicates_and_sorts() -> None:
    """Variable extraction returns unique dotted variable names."""
    result = _extract_template_variables(
        "{{ device.name }} {{ hostname }} {{ device.name }}"
    )

    assert result == ["device.name", "hostname"]


@pytest.mark.unit
def test_parse_rendered_output_supports_yaml_and_text() -> None:
    """Rendered YAML and key-value text output are parsed into update dictionaries."""
    yaml_result, yaml_errors = _parse_rendered_output(
        "status: Active\n", DEVICE_ID, "yaml"
    )
    text_result, text_errors = _parse_rendered_output(
        "status=Active\nplatform=cisco_ios",
        DEVICE_ID,
        "text",
    )

    assert yaml_result == {"status": "Active", "id": DEVICE_ID}
    assert yaml_errors == []
    assert text_result == {
        "id": DEVICE_ID,
        "status": "Active",
        "platform": "cisco_ios",
    }
    assert text_errors == []


@pytest.mark.unit
def test_parse_rendered_output_reports_unsupported_format() -> None:
    """Unsupported output formats return a parse error."""
    parsed, errors = _parse_rendered_output("x", DEVICE_ID, "xml")

    assert parsed is None
    assert errors == [f"Device {DEVICE_ID}: Unsupported output format 'xml'"]
