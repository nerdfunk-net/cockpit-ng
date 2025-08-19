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
            if db_settings and db_settings.get('url') and db_settings.get('token'):
                config = {
                    'url': db_settings['url'],
                    'token': db_settings['token'],
                    'timeout': db_settings.get('timeout', 30),
                    'verify_ssl': db_settings.get('verify_ssl', True),
                    '_source': 'database'
                }
                logger.debug(f"Using database settings for Nautobot: {config['url']}")
                return config
        except Exception as e:
            logger.warning(f"Failed to get database settings, falling back to environment: {e}")

        # Fallback to environment variables (cache these since they don't change)
        if not self.config or self.config.get('_source') != 'environment':
            from config import settings
            self.config = {
                'url': settings.nautobot_url,
                'token': settings.nautobot_token,
                'timeout': settings.nautobot_timeout,
                'verify_ssl': True,
                '_source': 'environment'
            }
            logger.debug(f"Using environment settings for Nautobot: {self.config['url']}")
        return self.config

    def _sync_graphql_query(self, query: str, variables: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Synchronous GraphQL query."""
        config = self._get_config()

        if not config['url'] or not config['token']:
            raise Exception("Nautobot URL and token must be configured")

        graphql_url = f"{config['url'].rstrip('/')}/api/graphql/"

        headers = {
            "Authorization": f"Token {config['token']}",
            "Content-Type": "application/json"
        }

        payload = {
            "query": query,
            "variables": variables or {}
        }

        try:
            response = requests.post(
                graphql_url, 
                json=payload, 
                headers=headers,
                timeout=config['timeout'],
                verify=config['verify_ssl']
            )

            if response.status_code == 200:
                return response.json()
            else:
                raise Exception(f"GraphQL request failed with status {response.status_code}: {response.text}")
        except requests.exceptions.Timeout:
            raise Exception(f"GraphQL request timed out after {config['timeout']} seconds")
        except Exception as e:
            logger.error(f"GraphQL query failed: {str(e)}")
            raise

    async def graphql_query(self, query: str, variables: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Execute GraphQL query against Nautobot."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self.executor, self._sync_graphql_query, query, variables)

    def _sync_rest_request(self, endpoint: str, method: str = "GET", data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Synchronous REST API request."""
        config = self._get_config()

        if not config['url'] or not config['token']:
            raise Exception("Nautobot URL and token must be configured")

        api_url = f"{config['url'].rstrip('/')}/api/{endpoint.lstrip('/')}"

        headers = {
            "Authorization": f"Token {config['token']}",
            "Content-Type": "application/json"
        }

        try:
            response = requests.request(
                method, 
                api_url, 
                json=data, 
                headers=headers,
                timeout=config['timeout'],
                verify=config['verify_ssl']
            )

            if response.status_code in [200, 201]:
                return response.json()
            else:
                raise Exception(f"REST request failed with status {response.status_code}: {response.text}")
        except requests.exceptions.Timeout:
            raise Exception(f"REST request timed out after {config['timeout']} seconds")
        except Exception as e:
            logger.error(f"REST request failed: {str(e)}")
            raise

    async def rest_request(self, endpoint: str, method: str = "GET", data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Execute REST API request against Nautobot."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self.executor, self._sync_rest_request, endpoint, method, data)

    def _sync_test_connection(self, url: str, token: str, timeout: int = 30, verify_ssl: bool = True) -> tuple[bool, str]:
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
                "Content-Type": "application/json"
            }

            payload = {
                "query": test_query,
                "variables": {}
            }

            response = requests.post(
                graphql_url,
                json=payload,
                headers=headers,
                timeout=timeout,
                verify=verify_ssl
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

    async def test_connection(self, url: str, token: str, timeout: int = 30, verify_ssl: bool = True) -> tuple[bool, str]:
        """Test connection to Nautobot instance."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self.executor, self._sync_test_connection, url, token, timeout, verify_ssl)

    async def onboard_device(self, device_data: Dict[str, Any]) -> Dict[str, Any]:
        """Onboard a device via Nautobot onboarding API."""
        try:
            # Call Nautobot onboarding endpoint
            response = await self.rest_request(
                "api/extras/jobs/nautobot_golden_config.jobs.OnboardingJob/run/",
                method="POST",
                data={
                    "class_path": "nautobot_golden_config.jobs.OnboardingJob",
                    "data": device_data
                }
            )

            return response

        except Exception as e:
            logger.error(f"Device onboarding failed: {e}")
            raise Exception(f"Failed to onboard device: {str(e)}")


# Global instance
nautobot_service = NautobotService()
