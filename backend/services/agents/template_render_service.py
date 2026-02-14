"""
Agent template rendering service.

This service provides reusable template rendering logic for agent templates,
extracted from the /api/templates/advanced-render endpoint.
"""

from __future__ import annotations
import logging
import re
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

from jinja2 import Template, TemplateError, UndefinedError

logger = logging.getLogger(__name__)


@dataclass
class TemplateRenderResult:
    """Result of template rendering."""

    rendered_content: str
    variables_used: List[str]
    context_data: Dict[str, Any]
    warnings: List[str]


class AgentTemplateRenderService:
    """Service for rendering agent templates with full context."""

    @staticmethod
    def extract_template_variables(template_content: str) -> List[str]:
        """Extract variable names from Jinja2 template."""
        pattern = r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_\.]*)"
        matches = re.findall(pattern, template_content)
        return sorted(set(matches))

    async def render_agent_template(
        self,
        template_content: str,
        inventory_id: Optional[int],
        pass_snmp_mapping: bool,
        user_variables: Optional[Dict[str, Any]] = None,
        path: Optional[str] = None,
    ) -> TemplateRenderResult:
        """Render an agent template with full context.

        Args:
            template_content: The template content to render
            inventory_id: Optional inventory ID to fetch devices from
            pass_snmp_mapping: Whether to include SNMP mapping
            user_variables: Optional user-provided variables
            path: Optional deployment path

        Returns:
            TemplateRenderResult with rendered content and metadata

        Raises:
            ValueError: If rendering fails or variables are undefined
        """
        from services.nautobot.devices import device_query_service
        from services.checkmk.config import config_service

        warnings = []
        context = {}

        # Initialize context with user variables
        if user_variables:
            context.update(user_variables)

        # Fetch inventory devices if inventory_id provided
        if inventory_id:
            try:
                from inventory_manager import inventory_manager
                from utils.inventory_converter import (
                    convert_saved_inventory_to_operations,
                )
                from services.inventory.inventory import inventory_service

                # Get inventory by ID
                inventory = inventory_manager.get_inventory(inventory_id)
                if not inventory:
                    raise ValueError(
                        f"Inventory with ID {inventory_id} not found"
                    )

                # Convert stored conditions to operations
                conditions = inventory.get("conditions", [])
                if not conditions:
                    logger.warning(
                        f"Inventory {inventory_id} has no conditions"
                    )
                    context["devices"] = []
                    context["device_details"] = {}
                else:
                    operations = convert_saved_inventory_to_operations(conditions)

                    # Execute operations to get matching devices
                    devices, _ = await inventory_service.preview_inventory(
                        operations
                    )

                    # Convert devices to simple dict format for context
                    device_list = [
                        {
                            "id": device.id,
                            "name": device.name,
                            "primary_ip4": device.primary_ip4,
                        }
                        for device in devices
                    ]
                    context["devices"] = device_list

                    # Fetch device details for each device
                    device_details = {}
                    for device in devices:
                        try:
                            device_data = (
                                await device_query_service.get_device_details(
                                    device_id=device.id,
                                    use_cache=True,
                                )
                            )
                            # Use device name (hostname) as key for user-friendly Jinja2 templates
                            device_details[device.name] = device_data
                        except Exception as e:
                            warning_msg = f"Failed to fetch details for device {device.id}: {str(e)}"
                            logger.warning(warning_msg)
                            warnings.append(warning_msg)

                    context["device_details"] = device_details
                    logger.info(
                        f"Fetched {len(device_list)} devices from inventory {inventory_id}"
                    )

            except Exception as e:
                error_msg = f"Failed to fetch inventory devices: {str(e)}"
                logger.error(error_msg)
                warnings.append(error_msg)

        # Load SNMP mapping if requested
        if pass_snmp_mapping:
            try:
                snmp_mapping = config_service.load_snmp_mapping()
                context["snmp_mapping"] = snmp_mapping
                logger.info(f"Loaded SNMP mapping with {len(snmp_mapping)} entries")
            except Exception as e:
                error_msg = f"Failed to load SNMP mapping: {str(e)}"
                logger.error(error_msg)
                warnings.append(error_msg)

        # Add path if provided
        if path:
            context["path"] = path

        # Extract variables used in template
        variables_used = self.extract_template_variables(template_content)

        # Render the template
        try:
            jinja_template = Template(template_content)
            rendered_content = jinja_template.render(**context)
        except UndefinedError as e:
            available_vars = list(context.keys())
            raise ValueError(
                f"Undefined variable in template: {str(e)}. Available variables: {', '.join(available_vars)}"
            )
        except TemplateError as e:
            raise ValueError(f"Template syntax error: {str(e)}")

        return TemplateRenderResult(
            rendered_content=rendered_content,
            variables_used=variables_used,
            context_data=context,
            warnings=warnings,
        )


# Singleton instance
agent_template_render_service = AgentTemplateRenderService()
