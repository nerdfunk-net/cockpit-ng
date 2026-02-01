"""
Base resolver with common GraphQL query logic.

This provides shared functionality for all resolver classes.
"""

import logging
from typing import Optional, Any

logger = logging.getLogger(__name__)


class BaseResolver:
    """Base resolver with common GraphQL query logic."""

    def __init__(self, nautobot_service):
        """
        Initialize the base resolver.

        Args:
            nautobot_service: NautobotService instance for API calls
        """
        from services.nautobot import NautobotService

        self.nautobot: NautobotService = nautobot_service

    async def _resolve_by_field(
        self,
        resource_type: str,
        field_name: str,
        field_value: Any,
        return_field: str = "id",
    ) -> Optional[str]:
        """
        Generic field-based resolution using GraphQL.

        Args:
            resource_type: GraphQL resource type (e.g., "devices", "platforms")
            field_name: Field name to filter by (e.g., "name", "address")
            field_value: Value to search for
            return_field: Field to return from result (default: "id")

        Returns:
            Value of return_field if found, None otherwise

        Example:
            >>> await resolver._resolve_by_field("platforms", "name", "ios", "id")
            '550e8400-e29b-41d4-a716-446655440000'
        """
        try:
            logger.debug(
                f"Resolving {resource_type} by {field_name}='{field_value}'"
            )

            # Build GraphQL query dynamically
            query = f"""
            query GetResource($value: [String]) {{
              {resource_type}({field_name}: $value) {{
                {return_field}
              }}
            }}
            """
            variables = {"value": [field_value] if isinstance(field_value, str) else field_value}

            result = await self.nautobot.graphql_query(query, variables)

            if "errors" in result:
                logger.error(
                    f"GraphQL error resolving {resource_type}: {result['errors']}"
                )
                return None

            resources = result.get("data", {}).get(resource_type, [])
            if resources and len(resources) > 0:
                resolved_value = resources[0].get(return_field)
                logger.debug(
                    f"Resolved {resource_type} '{field_value}' -> {resolved_value}"
                )
                return resolved_value

            logger.debug(f"{resource_type.capitalize()} not found: {field_value}")
            return None

        except Exception as e:
            logger.error(
                f"Error resolving {resource_type} by {field_name}: {e}", exc_info=True
            )
            return None

    async def _resolve_by_name(
        self, resource_type: str, name: str
    ) -> Optional[str]:
        """
        Resolve resource by name (common pattern).

        Args:
            resource_type: GraphQL resource type (e.g., "platforms", "roles")
            name: Resource name to search for

        Returns:
            Resource UUID if found, None otherwise

        Example:
            >>> await resolver._resolve_by_name("platforms", "ios")
            '550e8400-e29b-41d4-a716-446655440000'
        """
        return await self._resolve_by_field(resource_type, "name", name)
