"""
Template render orchestrator — builds context and delegates to RenderService.

Handles both advanced-render (interactive preview) and execute-and-sync
(render → parse → push to Nautobot via Celery).
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

import yaml
from jinja2 import Template, TemplateError, UndefinedError

from models.templates import (
    AdvancedTemplateRenderRequest,
    AdvancedTemplateRenderResponse,
    TemplateExecuteAndSyncRequest,
    TemplateExecuteAndSyncResponse,
)

logger = logging.getLogger(__name__)


class TemplateRenderOrchestrator:
    """Orchestrates template rendering with full context assembly."""

    def __init__(
        self,
        device_query_service: Any,
        checkmk_config_service: Any,
        render_service: Any,
        inventory_service: Any,
        template_manager: Any,
    ) -> None:
        self._device_qs = device_query_service
        self._checkmk = checkmk_config_service
        self._render = render_service
        self._inventory = inventory_service
        self._tm = template_manager

    # ------------------------------------------------------------------
    # Advanced render
    # ------------------------------------------------------------------

    async def advanced_render(
        self, request: AdvancedTemplateRenderRequest
    ) -> AdvancedTemplateRenderResponse:
        """Render a template with full context (netmiko or agent)."""
        category = request.category.lower()
        warnings: List[str] = []
        pre_run_output: Optional[str] = None
        pre_run_parsed: Optional[List[Any]] = None

        context: Dict[str, Any] = {}
        if request.user_variables:
            context.update(request.user_variables)

        if category == "netmiko":
            (
                context,
                pre_run_output,
                pre_run_parsed,
                warnings,
            ) = await self._build_netmiko_context(request, context, warnings)
        elif category == "agent":
            context, warnings = await self._build_agent_context(
                request, context, warnings
            )

        variables_used = _extract_template_variables(request.template_content)

        try:
            rendered = Template(request.template_content).render(**context)
        except UndefinedError as exc:
            available = list(context.keys())
            raise ValueError(
                f"Undefined variable in template: {exc}. "
                f"Available variables: {', '.join(available)}"
            )
        except TemplateError as exc:
            raise ValueError(f"Template syntax error: {exc}")

        return AdvancedTemplateRenderResponse(
            rendered_content=rendered,
            variables_used=variables_used,
            context_data=context,
            warnings=warnings,
            pre_run_output=pre_run_output,
            pre_run_parsed=pre_run_parsed,
        )

    async def _build_netmiko_context(
        self,
        request: AdvancedTemplateRenderRequest,
        context: Dict[str, Any],
        warnings: List[str],
    ) -> Tuple[Dict[str, Any], Optional[str], Optional[List[Any]], List[str]]:
        pre_run_output: Optional[str] = None
        pre_run_parsed: Optional[List[Any]] = None

        context["pre_run"] = {"raw": "", "parsed": []}

        needs_device_data = (
            request.use_nautobot_context
            or (request.pre_run_command and request.pre_run_command.strip())
        ) and request.device_id

        if needs_device_data:
            try:
                device_data = await self._device_qs.get_device_details(
                    device_id=request.device_id, use_cache=True
                )
                context["device_details"] = device_data
                context["devices"] = [
                    {
                        "id": request.device_id,
                        "name": device_data.get("name", ""),
                        "primary_ip4": (
                            device_data.get("primary_ip4", {}).get("address", "")
                            if isinstance(device_data.get("primary_ip4"), dict)
                            else device_data.get("primary_ip4", "")
                        ),
                        "primary_ip6": (
                            device_data.get("primary_ip6", {}).get("address", "")
                            if isinstance(device_data.get("primary_ip6"), dict)
                            else device_data.get("primary_ip6", "")
                        ),
                    }
                ]
            except Exception as exc:
                error_msg = f"Failed to fetch Nautobot device data: {exc}"
                logger.error(error_msg)
                if request.pre_run_command and request.pre_run_command.strip():
                    raise ValueError(error_msg)
                warnings.append(error_msg)

        if request.pre_run_command and request.pre_run_command.strip():
            if not request.device_id:
                raise ValueError(
                    "A test device is required to execute pre-run commands. "
                    "Please select a test device in the Netmiko Options panel."
                )
            if not request.credential_id:
                raise ValueError(
                    "Device credentials are required to execute pre-run commands. "
                    "Please select credentials in the Netmiko Options panel."
                )

            try:
                result = await self._render._execute_pre_run_command(
                    device_id=request.device_id,
                    command=request.pre_run_command.strip(),
                    credential_id=request.credential_id,
                    nautobot_device=context.get("device_details"),
                )
                pre_run_output = result.get("raw_output", "")
                pre_run_parsed = result.get("parsed_output", [])
                context["pre_run"] = {"raw": pre_run_output, "parsed": pre_run_parsed}

                if result.get("parse_error"):
                    warnings.append(
                        f"TextFSM parsing not available: {result['parse_error']}"
                    )
            except Exception as exc:
                raise ValueError(f"Failed to execute pre-run command: {exc}")

        return context, pre_run_output, pre_run_parsed, warnings

    async def _build_agent_context(
        self,
        request: AdvancedTemplateRenderRequest,
        context: Dict[str, Any],
        warnings: List[str],
    ) -> Tuple[Dict[str, Any], List[str]]:
        if request.inventory_id:
            try:
                from utils.inventory_converter import (
                    convert_saved_inventory_to_operations,
                )
                import service_factory as _sf

                persistence = _sf.build_inventory_persistence_service()
                inventory = persistence.get_inventory(request.inventory_id)
                if not inventory:
                    raise ValueError(
                        f"Inventory with ID {request.inventory_id} not found"
                    )

                conditions = inventory.get("conditions", [])
                if not conditions:
                    logger.warning(
                        "Inventory %s has no conditions", request.inventory_id
                    )
                    context["devices"] = []
                    context["device_details"] = {}
                else:
                    operations = convert_saved_inventory_to_operations(conditions)
                    devices, _ = await self._inventory.preview_inventory(operations)

                    context["devices"] = [
                        {"id": d.id, "name": d.name, "primary_ip4": d.primary_ip4}
                        for d in devices
                    ]

                    device_details: Dict[str, Any] = {}
                    for device in devices:
                        try:
                            data = await self._device_qs.get_device_details(
                                device_id=device.id, use_cache=True
                            )
                            device_details[device.name] = data
                        except Exception as exc:
                            msg = (
                                f"Failed to fetch details for device {device.id}: {exc}"
                            )
                            logger.warning(msg)
                            warnings.append(msg)
                    context["device_details"] = device_details

            except Exception as exc:
                error_msg = f"Failed to fetch inventory devices: {exc}"
                logger.error(error_msg)
                warnings.append(error_msg)

        if request.pass_snmp_mapping:
            try:
                snmp_mapping = self._checkmk.load_snmp_mapping()
                context["snmp_mapping"] = snmp_mapping
            except Exception as exc:
                error_msg = f"Failed to load SNMP mapping: {exc}"
                logger.error(error_msg)
                warnings.append(error_msg)

        if request.path:
            context["path"] = request.path

        return context, warnings

    # ------------------------------------------------------------------
    # Execute and sync
    # ------------------------------------------------------------------

    async def execute_and_sync(
        self,
        request: TemplateExecuteAndSyncRequest,
        username: str | None,
    ) -> TemplateExecuteAndSyncResponse:
        """Render template per device, parse output, queue Celery update task."""
        from tasks.update_devices_task import update_devices_task
        import job_run_manager

        template = self._tm.get_template(request.template_id)
        if not template:
            raise ValueError(f"Template with ID {request.template_id} not found")

        template_content = self._tm.get_template_content(request.template_id)
        if not template_content:
            raise ValueError(f"Template content for ID {request.template_id} not found")

        rendered_outputs: Dict[str, str] = {}
        parsed_updates: List[Dict[str, Any]] = []
        errors: List[str] = []
        warnings: List[str] = []

        for device_id in request.device_ids:
            try:
                result = await self._render.render_template(
                    template_content=template_content,
                    category=template["category"],
                    device_id=device_id,
                    user_variables=request.user_variables or {},
                    use_nautobot_context=template.get("use_nautobot_context", True),
                    pre_run_command=template.get("pre_run_command"),
                    credential_id=template.get("credential_id"),
                )
                rendered_content = result["rendered_content"]
                rendered_outputs[device_id] = rendered_content

                for w in result.get("warnings", []):
                    warnings.append(f"Device {device_id}: {w}")

                parsed, parse_errors = _parse_rendered_output(
                    rendered_content, device_id, request.output_format
                )
                if parsed is not None:
                    parsed_updates.append(parsed)
                errors.extend(parse_errors)

            except Exception as exc:
                errors.append(f"Device {device_id}: Template rendering failed: {exc}")
                logger.error(
                    "Error rendering template for device %s: %s", device_id, exc
                )

        if request.dry_run:
            return TemplateExecuteAndSyncResponse(
                success=len(errors) == 0,
                message=(
                    f"Dry run completed. Parsed {len(parsed_updates)} device update(s). "
                    f"{len(errors)} error(s)."
                ),
                rendered_outputs=rendered_outputs,
                parsed_updates=parsed_updates,
                errors=errors,
                warnings=warnings,
            )

        if errors:
            return TemplateExecuteAndSyncResponse(
                success=False,
                message=f"Template rendering/parsing failed with {len(errors)} error(s)",
                rendered_outputs=rendered_outputs,
                parsed_updates=parsed_updates,
                errors=errors,
                warnings=warnings,
            )

        if not parsed_updates:
            return TemplateExecuteAndSyncResponse(
                success=False,
                message="No device updates to process",
                rendered_outputs=rendered_outputs,
                errors=["No valid device updates parsed from template output"],
                warnings=warnings,
            )

        task = update_devices_task.delay(devices=parsed_updates, dry_run=False)

        job_name = f"Sync to Nautobot from template '{template['name']}'"
        job_run = job_run_manager.create_job_run(
            job_name=job_name,
            job_type="template_execute_and_sync",
            triggered_by="manual",
            executed_by=username,
        )
        job_run_manager.mark_started(job_run["id"], task.id)

        return TemplateExecuteAndSyncResponse(
            success=True,
            message=f"Successfully queued update for {len(parsed_updates)} device(s)",
            task_id=task.id,
            job_id=str(job_run["id"]),
            rendered_outputs=rendered_outputs,
            parsed_updates=parsed_updates,
            errors=errors,
            warnings=warnings,
        )


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


def _extract_template_variables(template_content: str) -> List[str]:
    pattern = r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_\.]*)"
    return sorted(set(re.findall(pattern, template_content)))


def _parse_rendered_output(
    rendered_content: str,
    device_id: str,
    output_format: str,
) -> Tuple[Optional[Dict[str, Any]], List[str]]:
    errors: List[str] = []

    try:
        if output_format == "json":
            parsed = json.loads(rendered_content)
            if not isinstance(parsed, dict):
                errors.append(
                    f"Device {device_id}: JSON output must be an object, got {type(parsed)}"
                )
                return None, errors
            if "id" not in parsed and "name" not in parsed:
                parsed["id"] = device_id
            return parsed, errors

        if output_format == "yaml":
            parsed = yaml.safe_load(rendered_content)
            if not isinstance(parsed, dict):
                errors.append(
                    f"Device {device_id}: YAML output must be an object, got {type(parsed)}"
                )
                return None, errors
            if "id" not in parsed and "name" not in parsed:
                parsed["id"] = device_id
            return parsed, errors

        if output_format == "text":
            parsed = {"id": device_id}
            for line in rendered_content.strip().split("\n"):
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    key, value = line.split("=", 1)
                    parsed[key.strip()] = value.strip()
            if len(parsed) > 1:
                return parsed, errors
            errors.append(
                f"Device {device_id}: No key-value pairs found in text output"
            )
            return None, errors

        errors.append(
            f"Device {device_id}: Unsupported output format '{output_format}'"
        )
        return None, errors

    except json.JSONDecodeError as exc:
        errors.append(f"Device {device_id}: Failed to parse JSON: {exc}")
    except yaml.YAMLError as exc:
        errors.append(f"Device {device_id}: Failed to parse YAML: {exc}")
    except Exception as exc:
        errors.append(f"Device {device_id}: Parse error: {exc}")

    return None, errors
