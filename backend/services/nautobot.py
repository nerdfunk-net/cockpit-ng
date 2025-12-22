"""
Nautobot service for handling GraphQL queries and REST API calls.
"""

from __future__ import annotations
import asyncio
import requests
import logging
from typing import Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)


class NautobotService:
    """Service for Nautobot API interactions."""

    def __init__(self):
        self.config = None
        self.executor = ThreadPoolExecutor(max_workers=4)

    def _get_config(self) -> Dict[str, Any]:
        """Get Nautobot configuration from database with fallback to environment variables."""
        # Always check database first to ensure we get the latest settings
        try:
            from settings_manager import settings_manager

            db_settings = settings_manager.get_nautobot_settings()
            if db_settings and db_settings.get("url") and db_settings.get("token"):
                config = {
                    "url": db_settings["url"],
                    "token": db_settings["token"],
                    "timeout": db_settings.get("timeout", 30),
                    "verify_ssl": db_settings.get("verify_ssl", True),
                    "_source": "database",
                }
                logger.debug(f"Using database settings for Nautobot: {config['url']}")
                return config
        except Exception as e:
            logger.warning(
                f"Failed to get database settings, falling back to environment: {e}"
            )

        # Fallback to environment variables (cache these since they don't change)
        if not self.config or self.config.get("_source") != "environment":
            from config import settings

            self.config = {
                "url": settings.nautobot_url,
                "token": settings.nautobot_token,
                "timeout": settings.nautobot_timeout,
                "verify_ssl": True,
                "_source": "environment",
            }
            logger.debug(
                f"Using environment settings for Nautobot: {self.config['url']}"
            )
        return self.config

    def _sync_graphql_query(
        self, query: str, variables: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Synchronous GraphQL query."""
        config = self._get_config()

        if not config["url"] or not config["token"]:
            raise Exception("Nautobot URL and token must be configured")

        graphql_url = f"{config['url'].rstrip('/')}/api/graphql/"

        headers = {
            "Authorization": f"Token {config['token']}",
            "Content-Type": "application/json",
        }

        payload = {"query": query, "variables": variables or {}}

        try:
            response = requests.post(
                graphql_url,
                json=payload,
                headers=headers,
                timeout=config["timeout"],
                verify=config["verify_ssl"],
            )

            if response.status_code == 200:
                return response.json()
            else:
                raise Exception(
                    f"GraphQL request failed with status {response.status_code}: {response.text}"
                )
        except requests.exceptions.Timeout:
            raise Exception(
                f"GraphQL request timed out after {config['timeout']} seconds"
            )
        except Exception as e:
            logger.error(f"GraphQL query failed: {str(e)}")
            raise

    async def graphql_query(
        self, query: str, variables: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Execute GraphQL query against Nautobot."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self.executor, self._sync_graphql_query, query, variables
        )

    def _sync_rest_request(
        self, endpoint: str, method: str = "GET", data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Synchronous REST API request."""
        config = self._get_config()

        if not config["url"] or not config["token"]:
            raise Exception("Nautobot URL and token must be configured")

        api_url = f"{config['url'].rstrip('/')}/api/{endpoint.lstrip('/')}"

        headers = {
            "Authorization": f"Token {config['token']}",
            "Content-Type": "application/json",
        }

        try:
            response = requests.request(
                method,
                api_url,
                json=data,
                headers=headers,
                timeout=config["timeout"],
                verify=config["verify_ssl"],
            )

            if response.status_code in [200, 201, 204]:
                # 204 No Content for successful DELETE operations has no response body
                if response.status_code == 204:
                    return {
                        "status": "success",
                        "message": "Resource deleted successfully",
                    }
                return response.json()
            else:
                raise Exception(
                    f"REST request failed with status {response.status_code}: {response.text}"
                )
        except requests.exceptions.Timeout:
            raise Exception(f"REST request timed out after {config['timeout']} seconds")
        except Exception as e:
            logger.error(f"REST request failed: {str(e)}")
            raise

    async def rest_request(
        self, endpoint: str, method: str = "GET", data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Execute REST API request against Nautobot."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self.executor, self._sync_rest_request, endpoint, method, data
        )

    async def get_custom_fields_for_devices(self) -> list:
        """
        Fetch custom fields for dcim.device content type from Nautobot.

        Returns:
            List of custom field dictionaries with type information
        """
        try:
            result = await self.rest_request(
                "extras/custom-fields/?content_types=dcim.device"
            )
            return result.get("results", [])
        except Exception as e:
            logger.error(f"Error fetching device custom fields: {e}", exc_info=True)
            return []

    def _sync_test_connection(
        self, url: str, token: str, timeout: int = 30, verify_ssl: bool = True
    ) -> tuple[bool, str]:
        """Synchronous connection test."""
        try:
            # Test with a simple GraphQL query
            test_query = """
            query {
              devices(limit: 1) {
                id
                name
              }
            }
            """

            graphql_url = f"{url.rstrip('/')}/api/graphql/"

            headers = {
                "Authorization": f"Token {token}",
                "Content-Type": "application/json",
            }

            payload = {"query": test_query, "variables": {}}

            response = requests.post(
                graphql_url,
                json=payload,
                headers=headers,
                timeout=timeout,
                verify=verify_ssl,
            )

            if response.status_code == 200:
                result = response.json()
                if "errors" not in result:
                    return True, "Connection successful"
                else:
                    return False, f"GraphQL errors: {result['errors']}"
            else:
                return False, f"HTTP {response.status_code}: {response.text}"

        except requests.exceptions.Timeout:
            return False, f"Connection timed out after {timeout} seconds"
        except Exception as e:
            return False, f"Connection failed: {str(e)}"

    async def test_connection(
        self, url: str, token: str, timeout: int = 30, verify_ssl: bool = True
    ) -> tuple[bool, str]:
        """Test connection to Nautobot instance."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self.executor, self._sync_test_connection, url, token, timeout, verify_ssl
        )

    async def get_location_id_by_name(self, location_name: str) -> Optional[str]:
        """Get location UUID by name using GraphQL."""
        if not location_name:
            return None

        query = """
        query locations($location_filter: [String]) {
            locations(name: $location_filter) {
                id
                name
            }
        }
        """
        try:
            result = await self.graphql_query(
                query, {"location_filter": [location_name]}
            )
            locations = result.get("data", {}).get("locations", [])
            if locations:
                return locations[0]["id"]
        except Exception as e:
            logger.warning(f"Failed to look up location '{location_name}': {e}")
        return None

    async def get_role_id_by_name(self, role_name: str) -> Optional[str]:
        """Get role UUID by name using GraphQL."""
        if not role_name:
            return None

        query = """
        query roles($role_filter: [String]) {
            roles(name: $role_filter) {
                id
                name
            }
        }
        """
        try:
            result = await self.graphql_query(query, {"role_filter": [role_name]})
            roles = result.get("data", {}).get("roles", [])
            if roles:
                return roles[0]["id"]
        except Exception as e:
            logger.warning(f"Failed to look up role '{role_name}': {e}")
        return None

    async def get_secrets_group_id_by_name(self, group_name: str) -> Optional[str]:
        """Get secrets group UUID by name using GraphQL."""
        if not group_name:
            return None

        query = """
        query secrets_groups($group_filter: [String]) {
            secrets_groups(name: $group_filter) {
                id
                name
            }
        }
        """
        try:
            result = await self.graphql_query(query, {"group_filter": [group_name]})
            groups = result.get("data", {}).get("secrets_groups", [])
            if groups:
                return groups[0]["id"]
        except Exception as e:
            logger.warning(f"Failed to look up secrets group '{group_name}': {e}")
        return None

    async def get_namespace_id_by_name(self, namespace_name: str) -> Optional[str]:
        """Get namespace UUID by name using GraphQL."""
        if not namespace_name:
            return None

        query = """
        query namespaces($namespace_filter: [String]) {
            namespaces(name: $namespace_filter) {
                id
                name
            }
        }
        """
        try:
            result = await self.graphql_query(
                query, {"namespace_filter": [namespace_name]}
            )
            namespaces = result.get("data", {}).get("namespaces", [])
            if namespaces:
                return namespaces[0]["id"]
        except Exception as e:
            logger.warning(f"Failed to look up namespace '{namespace_name}': {e}")
        return None

    async def get_status_id_by_name(
        self, status_name: str, content_type: str = "dcim.device"
    ) -> Optional[str]:
        """Get status UUID by name and content type using GraphQL."""
        if not status_name:
            return None

        query = """
        query statuses($content_type: [String]) {
            statuses(content_types: $content_type) {
                id
                name
                content_types {
                    model
                }
            }
        }
        """
        try:
            result = await self.graphql_query(query, {"content_type": [content_type]})
            statuses = result.get("data", {}).get("statuses", [])
            for status in statuses:
                # Safely handle None values for status name
                status_name_value = status.get("name")
                if (
                    status_name_value
                    and status_name
                    and status_name_value.lower() == status_name.lower()
                ):
                    return status["id"]
        except Exception as e:
            logger.warning(
                f"Failed to look up status '{status_name}' for {content_type}: {e}"
            )
        return None

    async def get_platform_id_by_name(self, platform_name: str) -> Optional[str]:
        """Get platform UUID by name using GraphQL."""
        if not platform_name:
            return None

        query = """
        query platforms($platform_filter: [String]) {
            platforms(name: $platform_filter) {
                id
                name
            }
        }
        """
        try:
            result = await self.graphql_query(
                query, {"platform_filter": [platform_name]}
            )
            platforms = result.get("data", {}).get("platforms", [])
            if platforms:
                return platforms[0]["id"]
        except Exception as e:
            logger.warning(f"Failed to look up platform '{platform_name}': {e}")
        return None

    async def onboard_device(self, device_data: Dict[str, Any]) -> Dict[str, Any]:
        """Onboard a device via Nautobot 'Sync Devices From Network' job."""
        try:
            # Debug: Log the input device data
            logger.debug("=== NAUTOBOT ONBOARD DEBUG ===")
            logger.debug(f"Input device_data: {device_data}")

            # Convert string names to UUIDs where needed
            # Location and secret_group_id should already be UUIDs from frontend
            location_id = device_data.get("location", "")
            secret_group_id = device_data.get("secret_group_id", "")

            # Convert string names to UUIDs for these fields
            role_name = device_data.get("role", "")
            role_id = await self.get_role_id_by_name(role_name) if role_name else ""

            namespace_name = device_data.get("namespace", "")
            namespace_id = (
                await self.get_namespace_id_by_name(namespace_name)
                if namespace_name
                else ""
            )

            device_status_name = device_data.get("status", "")
            device_status_id = (
                await self.get_status_id_by_name(device_status_name, "dcim.device")
                if device_status_name
                else ""
            )

            interface_status_name = device_data.get("interface_status", "")
            interface_status_id = (
                await self.get_status_id_by_name(
                    interface_status_name, "dcim.interface"
                )
                if interface_status_name
                else ""
            )

            ip_status_name = device_data.get("ip_status", "")
            ip_status_id = (
                await self.get_status_id_by_name(ip_status_name, "ipam.ipaddress")
                if ip_status_name
                else ""
            )

            platform_name = device_data.get("platform", "")
            # Handle special case for "auto-detect" platform or when UUID lookup fails
            if platform_name == "auto-detect":
                platform_id = None  # Use None for auto-detect
            elif platform_name:
                platform_id = await self.get_platform_id_by_name(platform_name)
                logger.debug(
                    f"Platform '{platform_name}' resolved to ID: {platform_id}"
                )
                # If UUID lookup fails, use None instead of the platform name
                if not platform_id:
                    platform_id = None
            else:
                platform_id = None

            # Map the input data to the expected Nautobot API format
            # Now using UUIDs instead of string names
            job_data = {
                "data": {
                    "location": location_id,
                    "ip_addresses": device_data.get("ip_address", ""),
                    "secrets_group": secret_group_id,
                    "device_role": role_id
                    or role_name,  # Fallback to original name if UUID lookup fails
                    "namespace": namespace_id
                    or namespace_name,  # Fallback to original name if UUID lookup fails
                    "device_status": device_status_id
                    or device_status_name,  # Fallback to original name if UUID lookup fails
                    "interface_status": interface_status_id
                    or interface_status_name,  # Fallback to original name if UUID lookup fails
                    "ip_address_status": ip_status_id
                    or ip_status_name,  # Fallback to original name if UUID lookup fails
                    "platform": platform_id,
                    "port": device_data.get("port", 22),
                    "timeout": device_data.get("timeout", 30),
                    "update_devices_without_primary_ip": device_data.get(
                        "update_devices_without_primary_ip", False
                    ),
                }
            }

            # Debug: Log the job data being sent to Nautobot
            logger.debug("Job data being sent to Nautobot:")
            logger.debug("  Original names -> UUIDs:")
            logger.debug(f"    role: '{role_name}' -> '{role_id}'")
            logger.debug(f"    namespace: '{namespace_name}' -> '{namespace_id}'")
            logger.debug(
                f"    device_status: '{device_status_name}' -> '{device_status_id}'"
            )
            logger.debug(
                f"    interface_status: '{interface_status_name}' -> '{interface_status_id}'"
            )
            logger.debug(f"    ip_status: '{ip_status_name}' -> '{ip_status_id}'")
            logger.debug(f"    platform: '{platform_name}' -> '{platform_id}'")
            for key, value in job_data["data"].items():
                logger.debug(f"  {key}: '{value}' (type: {type(value).__name__})")
            logger.debug(f"Complete job_data: {job_data}")
            logger.debug("=== END NAUTOBOT ONBOARD DEBUG ===")

            # Call the correct Nautobot 'Sync Devices From Network' job endpoint
            response = await self.rest_request(
                "extras/jobs/Sync%20Devices%20From%20Network/run/",
                method="POST",
                data=job_data,
            )

            return response

        except Exception as e:
            logger.error(f"Device onboarding failed: {e}")
            raise Exception(f"Failed to onboard device: {str(e)}")


# Global instance
nautobot_service = NautobotService()
