"""
NautobotSyncClient: Synchronous Nautobot HTTP client.

Migration aid. Will be deleted when all callers migrate to async (see Phase 6 of
the backend services refactoring plan at doc/refactoring/REFACTORING_SERVICES.md).
"""

import requests
import logging
from typing import Dict, Any, Optional

from .common.exceptions import NautobotValidationError, NautobotAPIError

logger = logging.getLogger(__name__)


class NautobotSyncClient:
    """Synchronous Nautobot HTTP client for use in Celery tasks and sync service helpers.

    Stateless. Construct per call site. No lifecycle management.
    """

    def _get_config(self) -> Dict[str, Any]:
        """Get Nautobot configuration from database with fallback to environment variables."""
        try:
            from settings_manager import settings_manager

            db_settings = settings_manager.get_nautobot_settings()
            if db_settings and db_settings.get("url") and db_settings.get("token"):
                return {
                    "url": db_settings["url"],
                    "token": db_settings["token"],
                    "timeout": db_settings.get("timeout", 30),
                    "verify_ssl": db_settings.get("verify_ssl", True),
                }
        except Exception as e:
            logger.warning(
                "Failed to get database settings, falling back to environment: %s", e
            )

        from config import settings

        return {
            "url": settings.nautobot_url,
            "token": settings.nautobot_token,
            "timeout": settings.nautobot_timeout,
            "verify_ssl": True,
        }

    def graphql_query(
        self, query: str, variables: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Execute a GraphQL query against Nautobot."""
        config = self._get_config()

        if not config["url"] or not config["token"]:
            raise NautobotValidationError("Nautobot URL and token must be configured")

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
                raise NautobotAPIError(
                    f"GraphQL request failed with status {response.status_code}: {response.text}"
                )
        except requests.exceptions.Timeout:
            raise NautobotAPIError(
                f"GraphQL request timed out after {config['timeout']} seconds"
            )
        except Exception as e:
            logger.error("GraphQL query failed: %s", str(e))
            raise

    def rest_request(
        self, endpoint: str, method: str = "GET", data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Execute a REST API request against Nautobot."""
        config = self._get_config()

        if not config["url"] or not config["token"]:
            raise NautobotValidationError("Nautobot URL and token must be configured")

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
                if response.status_code == 204:
                    return {"status": "success", "message": "Resource deleted successfully"}
                return response.json()
            else:
                raise NautobotAPIError(
                    f"REST request failed with status {response.status_code}: {response.text}"
                )
        except requests.exceptions.Timeout:
            raise NautobotAPIError(
                f"REST request timed out after {config['timeout']} seconds"
            )
        except Exception as e:
            logger.error("REST request failed: %s", str(e))
            raise

    def test_connection(
        self, url: str, token: str, timeout: int = 30, verify_ssl: bool = True
    ) -> tuple[bool, str]:
        """Test connection to a Nautobot instance."""
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

        try:
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
