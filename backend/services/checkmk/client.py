"""
CheckMK connection service for API interactions and system-level operations.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from services.checkmk.base import CheckMKClientFactory, get_checkmk_config, parse_url_str
from services.checkmk.exceptions import CheckMKAPIError, CheckMKClientError, HostNotFoundError

logger = logging.getLogger(__name__)


class CheckMKConnectionService:
    """Service for CheckMK connection and system-level operations."""

    def __init__(self):
        pass

    # ------------------------------------------------------------------
    # Kept for POST /test (explicit credentials from request body)
    # ------------------------------------------------------------------

    async def test_connection(
        self, url: str, site: str, username: str, password: str, verify_ssl: bool = True
    ) -> Tuple[bool, str]:
        """Test connection using explicitly supplied credentials."""
        from checkmk.client import CheckMKClient

        def _run() -> Tuple[bool, str]:
            protocol, host = parse_url_str(url)

            client = CheckMKClient(
                host=host,
                site_name=site,
                username=username,
                password=password,
                protocol=protocol,
                verify_ssl=verify_ssl,
                timeout=10,
            )
            try:
                if client.test_connection():
                    try:
                        version_info = client.get_version()
                        version = version_info.get("versions", {}).get("checkmk", "Unknown")
                        return True, f"Connection successful! CheckMK version: {version}"
                    except CheckMKAPIError:
                        return True, "Connection successful!"
                else:
                    return (
                        False,
                        "Connection test failed. Please check your credentials and server configuration.",
                    )
            except CheckMKAPIError as e:
                if e.status_code == 401:
                    return False, "Authentication failed. Please check your username and password."
                elif e.status_code == 404:
                    return (
                        False,
                        "CheckMK API not found. Please verify the server URL, site name, and that CheckMK is properly installed.",
                    )
                return False, f"API error (HTTP {e.status_code}): {str(e)}"
            except Exception as e:
                err = str(e).lower()
                if "ssl" in err:
                    return False, "SSL certificate verification failed. You may need to disable SSL verification for self-signed certificates."
                elif "timeout" in err or "timed out" in err:
                    return False, "Connection timeout. Please check if the server is reachable."
                elif "connection" in err or "network" in err:
                    return False, "Connection failed. Please check the server URL and network connectivity."
                return False, f"Connection test failed: {str(e)}"

        return await asyncio.to_thread(_run)

    # ------------------------------------------------------------------
    # GET /test — uses saved settings
    # ------------------------------------------------------------------

    async def test_connection_from_settings(self) -> Dict[str, Any]:
        """Test connection using database-stored settings."""
        config = get_checkmk_config()
        url = f"{config.protocol}://{config.host}"
        success, message = await self.test_connection(
            url, config.site, config.username, config.password, config.verify_ssl
        )
        return {
            "success": success,
            "message": message,
            "checkmk_url": url,
            "connection_source": "database",
        }

    # ------------------------------------------------------------------
    # GET /stats
    # ------------------------------------------------------------------

    async def get_stats(self, cache_service) -> Dict[str, Any]:
        """Get CheckMK host statistics with 10-minute Redis caching."""
        cache_key = "checkmk:stats"
        cache_ttl = 600

        cached = cache_service.get(cache_key)
        if cached is not None:
            logger.info("Returning cached CheckMK stats")
            return cached

        logger.info("CheckMK cache expired or missing, fetching fresh stats")
        client = CheckMKClientFactory.build_client_from_settings()

        hosts_data = await asyncio.to_thread(client.get_all_hosts)
        host_count = len(hosts_data.get("value", []))

        stats = {
            "total_hosts": host_count,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        cache_service.set(cache_key, stats, cache_ttl)
        return stats

    # ------------------------------------------------------------------
    # GET /version
    # ------------------------------------------------------------------

    async def get_version(self) -> Dict[str, Any]:
        """Get CheckMK version information."""
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(client.get_version)

    # ------------------------------------------------------------------
    # GET /inventory/{hostname}
    # ------------------------------------------------------------------

    async def get_host_inventory(self, hostname: str) -> Dict[str, Any]:
        """Get inventory data for a specific host via the CheckMK inventory API."""
        import requests

        config = get_checkmk_config()
        inventory_url = (
            f"{config.protocol}://{config.host}/{config.site}/check_mk/host_inv_api.py"
        )

        def _fetch():
            return requests.get(
                inventory_url,
                params={"host": hostname, "output_format": "json"},
                auth=(config.username, config.password),
                verify=config.verify_ssl,
                timeout=30,
            )

        logger.info("Fetching inventory for host %s from %s", hostname, inventory_url)
        try:
            response = await asyncio.to_thread(_fetch)
        except Exception as e:
            raise CheckMKClientError(f"Failed to connect to CheckMK inventory API: {str(e)}") from e

        if response.status_code == 404:
            raise HostNotFoundError(f"Inventory data not found for host '{hostname}'")
        elif response.status_code != 200:
            raise CheckMKAPIError(
                f"CheckMK inventory API error: {response.status_code}",
                status_code=response.status_code,
            )
        return response.json()


# Backwards-compatible alias used by legacy service_factory shim
CheckMKService = CheckMKConnectionService
