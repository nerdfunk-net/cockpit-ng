"""
Agent template rendering service.

This service provides reusable template rendering logic for agent templates,
extracted from the /api/templates/advanced-render endpoint.
"""

from __future__ import annotations
import json
import logging
import os
import re
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

import yaml
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
        stored_variables: Optional[Dict[str, Any]] = None,
        username: Optional[str] = None,
    ) -> TemplateRenderResult:
        """Render an agent template with full context.

        Args:
            template_content: The template content to render
            inventory_id: Optional inventory ID to fetch devices from
            pass_snmp_mapping: Whether to include SNMP mapping
            user_variables: Optional user-provided variables (overrides stored)
            path: Optional deployment path
            stored_variables: Optional stored template variables with type/metadata
            username: Optional username for inventory access control

        Returns:
            TemplateRenderResult with rendered content and metadata

        Raises:
            ValueError: If rendering fails or variables are undefined
        """
        from services.nautobot.devices import device_query_service
        from services.checkmk.config import config_service

        warnings = []
        context = {}

        # 1. Populate stored variables first (base context)
        # Use the template's inventory_id as override for all inventory-type variables
        if stored_variables:
            populated = await self._populate_stored_variables(
                stored_variables, username, override_inventory_id=inventory_id
            )
            context.update(populated)

        # 2. Apply user overrides on top (user_variables win)
        if user_variables:
            context.update(user_variables)

        # 3. Auto-filled variables (devices, device_details, snmp_mapping, path)
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
                        "Inventory %d has no conditions", inventory_id
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
                            warning_msg = "Failed to fetch details for device %s: %s" % (device.id, str(e))
                            logger.warning(warning_msg)
                            warnings.append(warning_msg)

                    context["device_details"] = device_details
                    logger.info(
                        "Fetched %d devices from inventory %d",
                        len(device_list),
                        inventory_id,
                    )

            except Exception as e:
                error_msg = "Failed to fetch inventory devices: %s" % str(e)
                logger.error(error_msg)
                warnings.append(error_msg)

        # Load SNMP mapping if requested
        if pass_snmp_mapping:
            try:
                snmp_mapping = config_service.load_snmp_mapping()
                context["snmp_mapping"] = snmp_mapping
                logger.info("Loaded SNMP mapping with %d entries", len(snmp_mapping))
            except Exception as e:
                error_msg = "Failed to load SNMP mapping: %s" % str(e)
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
                "Undefined variable in template: %s. Available variables: %s"
                % (str(e), ", ".join(available_vars))
            )
        except TemplateError as e:
            raise ValueError("Template syntax error: %s" % str(e))

        return TemplateRenderResult(
            rendered_content=rendered_content,
            variables_used=variables_used,
            context_data=context,
            warnings=warnings,
        )

    async def _populate_stored_variables(
        self,
        stored_variables: Dict[str, Any],
        username: Optional[str],
        override_inventory_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Populate stored template variables by dispatching to type-specific methods.

        Args:
            stored_variables: Dict mapping variable name to its definition
                (either {value, type, metadata} or plain value for legacy format)
            username: Username for inventory access control
            override_inventory_id: Override inventory ID for all inventory-type variables
                (when user selects a different inventory in the deploy app)

        Returns:
            Dict of variable name → populated value

        Raises:
            ValueError: If any variable fails to populate
        """
        populated = {}

        for var_name, var_def in stored_variables.items():
            # Legacy format: plain value (not a dict with "type" key)
            if not isinstance(var_def, dict) or "type" not in var_def:
                populated[var_name] = var_def
                continue

            var_type = var_def.get("type", "custom")
            try:
                if var_type == "custom":
                    populated[var_name] = self._populate_custom_variable(var_def)
                elif var_type == "nautobot":
                    populated[var_name] = await self._populate_nautobot_variable(var_def)
                elif var_type == "yaml":
                    populated[var_name] = await self._populate_yaml_variable(var_def)
                elif var_type == "inventory":
                    populated[var_name] = await self._populate_inventory_variable(
                        var_def, username, override_inventory_id
                    )
                elif var_type == "auto-filled":
                    # Auto-filled variables are handled separately (devices, snmp_mapping, etc.)
                    # Use the stored value as-is
                    populated[var_name] = self._populate_custom_variable(var_def)
                else:
                    logger.warning(
                        "Unknown variable type '%s' for '%s', treating as custom",
                        var_type,
                        var_name,
                    )
                    populated[var_name] = self._populate_custom_variable(var_def)
            except Exception as e:
                raise ValueError(
                    "Failed to populate variable '%s' (type=%s): %s"
                    % (var_name, var_type, str(e))
                )

        return populated

    @staticmethod
    def _populate_custom_variable(var_def: Dict[str, Any]) -> Any:
        """Populate a custom variable by parsing its stored value.

        Attempts JSON parse first (for lists/dicts), falls back to raw string.
        """
        value = var_def.get("value", "")
        if not value:
            return value

        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return value

    async def _populate_nautobot_variable(self, var_def: Dict[str, Any]) -> Any:
        """Populate a variable from Nautobot API data.

        Supported sources: locations, tags, custom-fields, statuses, roles, namespaces.
        """
        from services.nautobot import nautobot_service, nautobot_metadata_service

        metadata = var_def.get("metadata", {})
        source = metadata.get("nautobot_source")

        if not source:
            raise ValueError("nautobot variable missing 'nautobot_source' in metadata")

        if source == "locations":
            query = """
            query {
                locations {
                    id
                    name
                    location_type { id name }
                    parent { id name }
                }
            }
            """
            result = await nautobot_service.graphql_query(query)
            return result.get("data", {}).get("locations", [])

        elif source == "tags":
            result = await nautobot_service.rest_request("extras/tags/?limit=0")
            return result.get("results", [])

        elif source == "custom-fields":
            return await nautobot_metadata_service.get_device_custom_fields()

        elif source == "statuses":
            result = await nautobot_service.rest_request(
                "extras/statuses/?content_types=dcim.device"
            )
            return result.get("results", [])

        elif source == "roles":
            result = await nautobot_service.rest_request(
                "extras/roles/?content_types=dcim.device&limit=0"
            )
            return result.get("results", [])

        elif source == "namespaces":
            query = """
            query {
                namespaces {
                    id
                    name
                    description
                }
            }
            """
            result = await nautobot_service.graphql_query(query)
            return result.get("data", {}).get("namespaces", [])

        else:
            raise ValueError("Unknown nautobot_source: '%s'" % source)

    async def _populate_yaml_variable(self, var_def: Dict[str, Any]) -> Any:
        """Populate a variable from a YAML file in a git repository.

        Reads the file from the local clone using the same pattern as
        the /api/git/{repo_id}/file-content endpoint.
        """
        from git_repositories_manager import GitRepositoryManager
        from services.settings.git.paths import repo_path as git_repo_path

        metadata = var_def.get("metadata", {})
        repo_id = metadata.get("yaml_file_id")
        file_path = metadata.get("yaml_file_path")

        if not repo_id:
            raise ValueError("yaml variable missing 'yaml_file_id' in metadata")
        if not file_path:
            raise ValueError("yaml variable missing 'yaml_file_path' in metadata")

        git_manager = GitRepositoryManager()
        repository = git_manager.get_repository(repo_id)
        if not repository:
            raise ValueError("Git repository with ID %d not found" % repo_id)

        repo_path = git_repo_path(repository)
        if not os.path.exists(repo_path):
            raise ValueError(
                "Git repository directory not found: %s" % str(repo_path)
            )

        # Construct and validate file path (prevent path traversal)
        full_path = os.path.realpath(os.path.join(str(repo_path), file_path.lstrip("/")))
        repo_real = os.path.realpath(str(repo_path))
        if not full_path.startswith(repo_real):
            raise ValueError("Invalid file path: path traversal detected")

        if not os.path.isfile(full_path):
            raise ValueError("YAML file not found: %s" % file_path)

        with open(full_path, "r", encoding="utf-8") as f:
            content = f.read()

        return yaml.safe_load(content)

    async def _populate_inventory_variable(
        self,
        var_def: Dict[str, Any],
        username: Optional[str],
        override_inventory_id: Optional[int] = None,
    ) -> Any:
        """Populate a variable from inventory analysis.

        Uses inventory_service.analyze_inventory() to get metadata about
        devices matching the inventory's conditions, then extracts the
        requested data type.

        Args:
            var_def: Variable definition with metadata
            username: Username for access control
            override_inventory_id: If provided, use this inventory_id instead of
                the one in metadata (for deploy app where user selects inventory)
        """
        from services.inventory.inventory import inventory_service

        metadata = var_def.get("metadata", {})
        # Use override if provided (from deploy app), otherwise use metadata
        inv_id = override_inventory_id or metadata.get("inventory_id")
        data_type = metadata.get("inventory_data_type")

        if not inv_id:
            raise ValueError(
                "inventory variable missing 'inventory_id' in metadata and no "
                "override_inventory_id provided"
            )
        if not data_type:
            raise ValueError(
                "inventory variable missing 'inventory_data_type' in metadata"
            )

        if not username:
            raise ValueError(
                "username is required to access inventory data"
            )

        logger.info(
            "Populating inventory variable with inventory_id=%d (override=%s)",
            inv_id,
            override_inventory_id is not None,
        )
        analysis = await inventory_service.analyze_inventory(inv_id, username)

        # For custom_fields, optionally extract a specific field
        if data_type == "custom_fields":
            custom_field = metadata.get("inventory_custom_field")
            all_fields = analysis.get("custom_fields", {})
            if custom_field:
                return all_fields.get(custom_field, [])
            return all_fields

        result = analysis.get(data_type)
        if result is None:
            raise ValueError(
                "Unknown inventory_data_type: '%s'. "
                "Valid types: locations, tags, custom_fields, statuses, roles"
                % data_type
            )

        return result


# Singleton instance
agent_template_render_service = AgentTemplateRenderService()
