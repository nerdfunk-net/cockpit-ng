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
        pre_run_command: Optional[str] = None,
        credential_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Render a template based on its category.

        Args:
            template_content: The Jinja2 template content
            category: Template category (netmiko, inventory, onboarding, parser)
            device_id: Device UUID for Nautobot lookup (optional)
            user_variables: User-provided variables
            use_nautobot_context: Whether to fetch and include Nautobot device data
            pre_run_command: Command to execute on device before rendering (optional)
            credential_id: Credential ID for device connection (required if pre_run_command)

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
                pre_run_command=pre_run_command,
                credential_id=credential_id,
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
        pre_run_command: Optional[str] = None,
        credential_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Render a Netmiko template with optional Nautobot device context.

        The template has access to:
        - user_variables: Dict of user-provided variables
        - nautobot: Full Nautobot device details (if use_nautobot_context=True)
        - pre_run_output: Raw output from pre-run command (if pre_run_command provided)
        - pre_run_parsed: TextFSM parsed output (if available)
        """
        context = {"user_variables": user_variables or {}}
        warnings = []

        # Fetch Nautobot device data if requested
        if use_nautobot_context and device_id:
            try:
                from services.nautobot.devices import device_query_service

                # Use shared device details service
                device_data = await device_query_service.get_device_details(
                    device_id=device_id,
                    use_cache=True,
                )
                context["nautobot"] = device_data
            except Exception as e:
                error_msg = f"Failed to fetch Nautobot device data: {str(e)}"
                logger.error(error_msg)
                raise ValueError(error_msg)
        elif use_nautobot_context and not device_id:
            warnings.append(
                "use_nautobot_context is True but no device_id provided. Nautobot context will be empty."
            )
            context["nautobot"] = {}

        # Execute pre-run command if provided
        if pre_run_command and pre_run_command.strip():
            if not device_id:
                raise ValueError(
                    "pre_run_command requires a device_id to execute against"
                )
            if not credential_id:
                raise ValueError(
                    "pre_run_command requires credential_id for device authentication"
                )

            try:
                pre_run_result = await self._execute_pre_run_command(
                    device_id=device_id,
                    command=pre_run_command.strip(),
                    credential_id=credential_id,
                    nautobot_device=context.get("nautobot"),
                )
                context["pre_run_output"] = pre_run_result.get("raw_output", "")
                context["pre_run_parsed"] = pre_run_result.get("parsed_output", [])

                if pre_run_result.get("parse_error"):
                    warnings.append(
                        f"TextFSM parsing not available: {pre_run_result['parse_error']}"
                    )

                logger.info(
                    f"Pre-run command executed successfully. Raw length: {len(context['pre_run_output'])}, "
                    f"Parsed records: {len(context['pre_run_parsed'])}"
                )
            except Exception as e:
                error_msg = f"Failed to execute pre-run command: {str(e)}"
                logger.error(error_msg)
                raise ValueError(error_msg)

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
        pre_run_command: Optional[str] = None,
        credential_id: Optional[int] = None,
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
        pre_run_command: Optional[str] = None,
        credential_id: Optional[int] = None,
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
        pre_run_command: Optional[str] = None,
        credential_id: Optional[int] = None,
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
        pre_run_command: Optional[str] = None,
        credential_id: Optional[int] = None,
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

    async def _execute_pre_run_command(
        self,
        device_id: str,
        command: str,
        credential_id: int,
        nautobot_device: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Execute a command on a device before template rendering.

        Uses Netmiko with TextFSM parsing to get structured output.

        Args:
            device_id: Device UUID from Nautobot
            command: Command to execute
            credential_id: ID of stored credential
            nautobot_device: Nautobot device data (to get IP and platform)

        Returns:
            Dict with:
                - raw_output: Raw command output as string
                - parsed_output: TextFSM parsed output as list of dicts (if available)
                - parse_error: Error message if TextFSM parsing failed
        """
        from netmiko import ConnectHandler
        import credentials_manager

        result = {
            "raw_output": "",
            "parsed_output": [],
            "parse_error": None,
        }

        # Get device connection info from Nautobot data
        if not nautobot_device:
            raise ValueError("Nautobot device data required for pre-run command")

        # Get primary IP
        primary_ip = None
        if nautobot_device.get("primary_ip4"):
            ip_data = nautobot_device["primary_ip4"]
            if isinstance(ip_data, dict) and ip_data.get("address"):
                primary_ip = ip_data["address"].split("/")[0]
            elif isinstance(ip_data, str):
                primary_ip = ip_data.split("/")[0]

        if not primary_ip:
            raise ValueError(
                f"Device {nautobot_device.get('name', device_id)} has no primary IPv4 address"
            )

        # Get platform/device type for Netmiko
        platform = nautobot_device.get("platform", {})
        platform_name = (
            platform.get("name", "") if isinstance(platform, dict) else str(platform)
        )

        # Map Nautobot platform to Netmiko device type
        device_type = self._map_platform_to_netmiko(platform_name)

        # Get credentials
        creds = credentials_manager.get_credential_by_id(credential_id)
        if not creds:
            raise ValueError(f"Credential with ID {credential_id} not found")

        username = creds.get("username")
        password = credentials_manager.get_decrypted_password(credential_id)

        logger.info(
            f"Executing pre-run command on {nautobot_device.get('name', device_id)} "
            f"({primary_ip}): {command}"
        )

        try:
            # Connect and execute command
            device_params = {
                "device_type": device_type,
                "host": primary_ip,
                "username": username,
                "password": password,
                "timeout": 30,
                "session_timeout": 60,
            }

            with ConnectHandler(**device_params) as connection:
                # Try with TextFSM parsing first
                try:
                    parsed_output = connection.send_command(
                        command,
                        use_textfsm=True,
                        read_timeout=30,
                    )

                    # If TextFSM returned parsed data (list of dicts), use it
                    if isinstance(parsed_output, list):
                        result["parsed_output"] = parsed_output
                        # Also get raw output for reference
                        result["raw_output"] = connection.send_command(
                            command,
                            use_textfsm=False,
                            read_timeout=30,
                        )
                    else:
                        # TextFSM didn't parse, output is raw string
                        result["raw_output"] = parsed_output
                        result["parse_error"] = (
                            "No TextFSM template found for this command/platform"
                        )

                except Exception as parse_err:
                    logger.warning(f"TextFSM parsing failed: {parse_err}")
                    result["parse_error"] = str(parse_err)
                    # Fall back to raw output
                    result["raw_output"] = connection.send_command(
                        command,
                        use_textfsm=False,
                        read_timeout=30,
                    )

        except Exception as e:
            logger.error(f"Pre-run command execution failed: {e}")
            raise ValueError(f"Failed to execute command on device: {str(e)}")

        return result

    def _map_platform_to_netmiko(self, platform_name: str) -> str:
        """Map Nautobot platform name to Netmiko device_type."""
        platform_lower = platform_name.lower()

        # Common mappings
        mappings = {
            "cisco_ios": "cisco_ios",
            "cisco_xe": "cisco_xe",
            "cisco_xr": "cisco_xr",
            "cisco_nxos": "cisco_nxos",
            "ios": "cisco_ios",
            "ios-xe": "cisco_xe",
            "iosxe": "cisco_xe",
            "ios-xr": "cisco_xr",
            "iosxr": "cisco_xr",
            "nxos": "cisco_nxos",
            "nx-os": "cisco_nxos",
            "juniper": "juniper_junos",
            "junos": "juniper_junos",
            "arista": "arista_eos",
            "arista_eos": "arista_eos",
            "eos": "arista_eos",
            "paloalto": "paloalto_panos",
            "panos": "paloalto_panos",
            "fortinet": "fortinet",
            "fortigate": "fortinet",
            "huawei": "huawei",
            "linux": "linux",
        }

        for key, value in mappings.items():
            if key in platform_lower:
                return value

        # Default to cisco_ios if unknown
        logger.warning(f"Unknown platform '{platform_name}', defaulting to cisco_ios")
        return "cisco_ios"

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
