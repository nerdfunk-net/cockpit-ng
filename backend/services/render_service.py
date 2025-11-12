"""
Template rendering service with category-specific implementations.
"""

import logging
from typing import Dict, Any, List, Optional
from jinja2 import Template, TemplateError, UndefinedError
import re

logger = logging.getLogger(__name__)


class RenderService:
    """Service for rendering templates with category-specific logic."""

    def __init__(self):
        self.category_renderers = {
            "netmiko": self.render_netmiko_template,
            "inventory": self.render_inventory_template,
            "onboarding": self.render_onboarding_template,
            "parser": self.render_parser_template,
        }

    async def render_template(
        self,
        template_content: str,
        category: str,
        device_id: Optional[str] = None,
        user_variables: Optional[Dict[str, Any]] = None,
        use_nautobot_context: bool = True,
    ) -> Dict[str, Any]:
        """
        Render a template based on its category.

        Args:
            template_content: The Jinja2 template content
            category: Template category (netmiko, inventory, onboarding, parser)
            device_id: Device UUID for Nautobot lookup (optional)
            user_variables: User-provided variables
            use_nautobot_context: Whether to fetch and include Nautobot device data

        Returns:
            Dict containing:
                - rendered_content: The rendered template
                - variables_used: List of variables referenced in template
                - context_data: The full context used for rendering (for debugging)
                - errors: Any warnings or non-fatal errors

        Raises:
            ValueError: If template rendering fails
        """
        if user_variables is None:
            user_variables = {}

        # Get the appropriate renderer for this category
        renderer = self.category_renderers.get(
            category.lower(), self.render_generic_template
        )

        try:
            return await renderer(
                template_content=template_content,
                device_id=device_id,
                user_variables=user_variables,
                use_nautobot_context=use_nautobot_context,
            )
        except Exception as e:
            logger.error(f"Error rendering {category} template: {e}")
            raise ValueError(f"Template rendering failed: {str(e)}")

    async def render_netmiko_template(
        self,
        template_content: str,
        device_id: Optional[str] = None,
        user_variables: Optional[Dict[str, Any]] = None,
        use_nautobot_context: bool = True,
    ) -> Dict[str, Any]:
        """
        Render a Netmiko template with optional Nautobot device context.

        The template has access to:
        - user_variables: Dict of user-provided variables
        - nautobot: Full Nautobot device details (if use_nautobot_context=True)
        """
        context = {"user_variables": user_variables or {}}
        warnings = []

        # Fetch Nautobot device data if requested
        if use_nautobot_context and device_id:
            try:
                from services.nautobot import nautobot_service

                # Use the same GraphQL query as the router endpoint
                query = """
                query DeviceDetails($deviceId: ID!) {
                    device(id: $deviceId) {
                        id
                        name
                        hostname: name
                        asset_tag
                        serial
                        position
                        face
                        config_context
                        local_config_context_data
                        _custom_field_data
                        primary_ip4 {
                            id
                            address
                            host
                            mask_length
                        }
                        role {
                            id
                            name
                        }
                        device_type {
                            id
                            model
                            manufacturer {
                                id
                                name
                            }
                        }
                        location {
                            id
                            name
                            parent {
                                id
                                name
                            }
                        }
                        platform {
                            id
                            name
                        }
                        status {
                            id
                            name
                        }
                        tags {
                            id
                            name
                        }
                    }
                }
                """
                variables = {"deviceId": device_id}
                response = await nautobot_service.graphql_query(query, variables)

                if (
                    not response
                    or "data" not in response
                    or not response["data"].get("device")
                ):
                    raise ValueError(f"Device {device_id} not found in Nautobot")

                context["nautobot"] = response["data"]["device"]
            except Exception as e:
                error_msg = f"Failed to fetch Nautobot device data: {str(e)}"
                logger.error(error_msg)
                raise ValueError(error_msg)
        elif use_nautobot_context and not device_id:
            warnings.append(
                "use_nautobot_context is True but no device_id provided. Nautobot context will be empty."
            )
            context["nautobot"] = {}

        # Extract variables used in template
        variables_used = self._extract_template_variables(template_content)

        # Render the template
        try:
            jinja_template = Template(template_content)
            rendered_content = jinja_template.render(**context)
        except UndefinedError as e:
            # Provide detailed error with available variables
            available_vars = list(context.keys())
            raise ValueError(
                f"Undefined variable in template: {str(e)}. Available variables: {', '.join(available_vars)}"
            )
        except TemplateError as e:
            raise ValueError(f"Template syntax error: {str(e)}")

        return {
            "rendered_content": rendered_content,
            "variables_used": variables_used,
            "context_data": context,
            "warnings": warnings,
        }

    async def render_inventory_template(
        self,
        template_content: str,
        device_id: Optional[str] = None,
        user_variables: Optional[Dict[str, Any]] = None,
        use_nautobot_context: bool = True,
    ) -> Dict[str, Any]:
        """
        Render an Ansible inventory template.

        Note: Inventory templates typically work with multiple devices.
        This is a placeholder for future implementation.
        """
        # For now, use generic rendering
        # TODO: Implement inventory-specific logic when needed
        return await self.render_generic_template(
            template_content=template_content,
            device_id=device_id,
            user_variables=user_variables,
            use_nautobot_context=use_nautobot_context,
        )

    async def render_onboarding_template(
        self,
        template_content: str,
        device_id: Optional[str] = None,
        user_variables: Optional[Dict[str, Any]] = None,
        use_nautobot_context: bool = True,
    ) -> Dict[str, Any]:
        """
        Render an onboarding template.

        Onboarding templates may have specific requirements.
        This is a placeholder for future implementation.
        """
        # For now, use generic rendering
        # TODO: Implement onboarding-specific logic when needed
        return await self.render_generic_template(
            template_content=template_content,
            device_id=device_id,
            user_variables=user_variables,
            use_nautobot_context=use_nautobot_context,
        )

    async def render_parser_template(
        self,
        template_content: str,
        device_id: Optional[str] = None,
        user_variables: Optional[Dict[str, Any]] = None,
        use_nautobot_context: bool = True,
    ) -> Dict[str, Any]:
        """
        Render a parser template (TextFSM).

        Parser templates may not use Jinja2 rendering.
        This is a placeholder for future implementation.
        """
        # Parser templates (TextFSM) don't typically use Jinja2
        # They are used for parsing device output, not generating it
        # Return the template as-is for now
        return {
            "rendered_content": template_content,
            "variables_used": [],
            "context_data": {},
            "warnings": ["Parser templates are not rendered with Jinja2"],
        }

    async def render_generic_template(
        self,
        template_content: str,
        device_id: Optional[str] = None,
        user_variables: Optional[Dict[str, Any]] = None,
        use_nautobot_context: bool = True,
    ) -> Dict[str, Any]:
        """
        Generic template rendering for unknown categories.
        """
        context = {"user_variables": user_variables or {}}
        warnings = []

        if use_nautobot_context and device_id:
            try:
                from services.nautobot import nautobot_service

                query = """
                query DeviceDetails($deviceId: ID!) {
                    device(id: $deviceId) {
                        id
                        name
                        config_context
                        local_config_context_data
                        primary_ip4 { address }
                        role { name }
                        device_type { model }
                        location { name }
                        platform { name }
                    }
                }
                """
                variables = {"deviceId": device_id}
                response = await nautobot_service.graphql_query(query, variables)

                if response and "data" in response and response["data"].get("device"):
                    context["nautobot"] = response["data"]["device"]
                else:
                    warnings.append(f"Device {device_id} not found in Nautobot")
                    context["nautobot"] = {}
            except Exception as e:
                warnings.append(f"Failed to fetch Nautobot data: {str(e)}")
                context["nautobot"] = {}

        variables_used = self._extract_template_variables(template_content)

        try:
            jinja_template = Template(template_content)
            rendered_content = jinja_template.render(**context)
        except UndefinedError as e:
            # Provide detailed error with available variables
            available_vars = list(context.keys())
            raise ValueError(
                f"Undefined variable in template: {str(e)}. Available variables: {', '.join(available_vars)}"
            )
        except TemplateError as e:
            raise ValueError(f"Template syntax error: {str(e)}")

        return {
            "rendered_content": rendered_content,
            "variables_used": variables_used,
            "context_data": context,
            "warnings": warnings,
        }

    def _extract_template_variables(self, template_content: str) -> List[str]:
        """
        Extract variable names from a Jinja2 template.

        Returns a list of unique variable names found in the template.
        """
        # Pattern to match Jinja2 variables: {{ variable }}, {{ obj.attr }}, etc.
        pattern = r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)"
        matches = re.findall(pattern, template_content)

        # Extract top-level variable names (before any dots)
        top_level_vars = set()
        for match in matches:
            top_var = match.split(".")[0]
            top_level_vars.add(top_var)

        return sorted(list(top_level_vars))


# Singleton instance
render_service = RenderService()
