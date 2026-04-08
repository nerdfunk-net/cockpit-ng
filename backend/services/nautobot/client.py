"""
Nautobot service for handling GraphQL queries and REST API calls.
"""

from __future__ import annotations
import httpx
import logging
from typing import Any

from .common.exceptions import (
    NautobotValidationError,
    NautobotAPIError,
    NautobotNotFoundError,
)

logger = logging.getLogger(__name__)


class NautobotService:
    """Pure-async Nautobot API client. App-scoped, lifespan-managed.

    Use this in FastAPI async routes and async services.
    In Celery tasks, use asyncio.run() to call async methods directly.
    """

    def __init__(self):
        self._client: httpx.AsyncClient | None = None

    async def startup(self) -> None:
        """Initialize the async HTTP client. Called by FastAPI lifespan on startup."""
        self._client = httpx.AsyncClient()
        logger.info("NautobotService started — httpx.AsyncClient initialized")

    async def shutdown(self) -> None:
        """Close the async HTTP client. Called by FastAPI lifespan on shutdown."""
        if self._client is not None:
            await self._client.aclose()
            self._client = None
            logger.info("NautobotService shut down — httpx.AsyncClient closed")

    def _get_config(self) -> dict[str, Any]:
        """Get Nautobot configuration from database with fallback to environment variables."""
        try:
            from settings_manager import settings_manager

            db_settings = settings_manager.get_nautobot_settings()
            if db_settings and db_settings.get("url") and db_settings.get("token"):
                config = {
                    "url": db_settings["url"],
                    "token": db_settings["token"],
                    "timeout": db_settings.get("timeout", 30),
                    "verify_ssl": db_settings.get("verify_ssl", True),
                }
                logger.debug("Using database settings for Nautobot: %s", config["url"])
                return config
        except Exception as e:
            logger.warning(
                "Failed to get database settings, falling back to environment: %s", e
            )

        from config import settings

        config = {
            "url": settings.nautobot_url,
            "token": settings.nautobot_token,
            "timeout": settings.nautobot_timeout,
            "verify_ssl": True,
        }
        logger.debug("Using environment settings for Nautobot: %s", config["url"])
        return config

    async def graphql_query(
        self, query: str, variables: dict[str, Any] | None = None
    ) -> dict[str, Any]:
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
            response = await self._do_post(
                graphql_url, payload, headers, config["timeout"]
            )
            if response.status_code == 200:
                return response.json()
            else:
                raise NautobotAPIError(
                    f"GraphQL request failed with status {response.status_code}: {response.text}"
                )
        except httpx.TimeoutException:
            raise NautobotAPIError(
                f"GraphQL request timed out after {config['timeout']} seconds"
            )
        except NautobotAPIError:
            raise
        except Exception as e:
            logger.error("GraphQL query failed: %s", str(e))
            raise

    async def rest_request(
        self, endpoint: str, method: str = "GET", data: dict[str, Any] | None = None
    ) -> dict[str, Any]:
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
            response = await self._do_request(
                method, api_url, data, headers, config["timeout"]
            )
            if response.status_code in [200, 201, 204]:
                if response.status_code == 204:
                    return {
                        "status": "success",
                        "message": "Resource deleted successfully",
                    }
                return response.json()
            elif response.status_code == 404:
                raise NautobotNotFoundError(
                    f"Resource not found: {endpoint} — {response.text}"
                )
            else:
                raise NautobotAPIError(
                    f"REST request failed with status {response.status_code}: {response.text}"
                )
        except httpx.TimeoutException:
            raise NautobotAPIError(
                f"REST request timed out after {config['timeout']} seconds"
            )
        except NautobotAPIError:
            raise
        except Exception as e:
            logger.error("REST request failed: %s", str(e))
            raise

    async def _do_post(
        self,
        url: str,
        payload: dict,
        headers: dict,
        timeout: int,
    ) -> httpx.Response:
        """Send a POST request using the persistent client or a one-shot client."""
        if self._client is not None:
            return await self._client.post(
                url, json=payload, headers=headers, timeout=timeout
            )
        async with httpx.AsyncClient() as client:
            return await client.post(
                url, json=payload, headers=headers, timeout=timeout
            )

    async def _do_request(
        self,
        method: str,
        url: str,
        data: dict | None,
        headers: dict,
        timeout: int,
    ) -> httpx.Response:
        """Send a request using the persistent client or a one-shot client."""
        if self._client is not None:
            return await self._client.request(
                method, url, json=data, headers=headers, timeout=timeout
            )
        async with httpx.AsyncClient() as client:
            return await client.request(
                method, url, json=data, headers=headers, timeout=timeout
            )

    async def test_connection(
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
            async with httpx.AsyncClient(verify=verify_ssl) as client:
                response = await client.post(
                    graphql_url,
                    json=payload,
                    headers=headers,
                    timeout=timeout,
                )
            if response.status_code == 200:
                result = response.json()
                if "errors" not in result:
                    return True, "Connection successful"
                else:
                    return False, f"GraphQL errors: {result['errors']}"
            else:
                return False, f"HTTP {response.status_code}: {response.text}"
        except httpx.TimeoutException:
            return False, f"Connection timed out after {timeout} seconds"
        except Exception as e:
            return False, f"Connection failed: {str(e)}"
