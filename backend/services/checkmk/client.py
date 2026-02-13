"""
CheckMK service for API interactions.
"""

import logging
from typing import Tuple
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


class CheckMKService:
    """Service for CheckMK API interactions"""

    def __init__(self):
        pass

    async def test_connection(
        self, url: str, site: str, username: str, password: str, verify_ssl: bool = True
    ) -> Tuple[bool, str]:
        """
        Test connection to CheckMK server using the CheckMK client.

        Args:
            url: CheckMK server URL
            site: CheckMK site name
            username: CheckMK username
            password: CheckMK password
            verify_ssl: Whether to verify SSL certificates

        Returns:
            Tuple of (success, message)
        """
        try:
            # Import the CheckMK client
            from checkmk.client import CheckMKClient, CheckMKAPIError

            # Clean up URL to get host and protocol
            url = url.rstrip("/")
            if url.startswith(("http://", "https://")):
                parsed_url = urlparse(url)
                protocol = parsed_url.scheme
                host = parsed_url.netloc
            else:
                # Default to https if no protocol specified
                protocol = "https"
                host = url

            logger.info(
                "Testing CheckMK connection to: %s://%s/%s", protocol, host, site
            )

            # Create CheckMK client
            client = CheckMKClient(
                host=host,
                site_name=site,
                username=username,
                password=password,
                protocol=protocol,
                verify_ssl=verify_ssl,
                timeout=10,
            )

            # Test connection using the client
            if client.test_connection():
                try:
                    # Get version information
                    version_info = client.get_version()
                    version = version_info.get("versions", {}).get("checkmk", "Unknown")
                    logger.info("CheckMK connection successful, version: %s", version)
                    return True, f"Connection successful! CheckMK version: {version}"
                except CheckMKAPIError:
                    # Connection works but couldn't get version info
                    logger.info(
                        "CheckMK connection successful (could not retrieve version)"
                    )
                    return True, "Connection successful!"
            else:
                logger.warning("CheckMK connection test returned False")
                return (
                    False,
                    "Connection test failed. Please check your credentials and server configuration.",
                )

        except CheckMKAPIError as e:
            logger.error("CheckMK API error: %s", e)
            if e.status_code == 401:
                return (
                    False,
                    "Authentication failed. Please check your username and password.",
                )
            elif e.status_code == 404:
                return (
                    False,
                    "CheckMK API not found. Please verify the server URL, site name, and that CheckMK is properly installed.",
                )
            else:
                return False, f"API error (HTTP {e.status_code}): {str(e)}"
        except ImportError:
            logger.error("CheckMK client not available")
            return (
                False,
                "CheckMK client module not found. Please ensure the CheckMK client is properly installed.",
            )
        except Exception as e:
            logger.error("CheckMK connection test failed: %s", e)
            # Provide more specific error messages based on common issues
            error_str = str(e).lower()
            if "ssl" in error_str:
                return (
                    False,
                    "SSL certificate verification failed. You may need to disable SSL verification for self-signed certificates.",
                )
            elif "timeout" in error_str or "timed out" in error_str:
                return (
                    False,
                    "Connection timeout. Please check if the server is reachable.",
                )
            elif "connection" in error_str or "network" in error_str:
                return (
                    False,
                    "Connection failed. Please check the server URL and network connectivity.",
                )
            else:
                return False, f"Connection test failed: {str(e)}"


# Global CheckMK service instance
checkmk_service = CheckMKService()
