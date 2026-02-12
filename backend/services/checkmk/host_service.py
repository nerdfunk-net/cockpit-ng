"""
CheckMK host management service.

This service provides business logic for CheckMK host operations without
framework dependencies (FastAPI, etc.).
"""

import logging
from typing import Optional, Dict, Any
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


class CheckMKHostService:
    """Service for CheckMK host management operations."""

    def __init__(self):
        """Initialize the CheckMK host service."""
        pass

    def _get_client(self, site_name: Optional[str] = None):
        """
        Create CheckMK client from settings.

        Args:
            site_name: Optional site name to use. If None, uses the configured default site.

        Returns:
            CheckMKClient instance

        Raises:
            ValueError: If CheckMK settings are not configured
        """
        from settings_manager import settings_manager
        from checkmk.client import CheckMKClient

        db_settings = settings_manager.get_checkmk_settings()
        if not db_settings or not all(
            key in db_settings for key in ["url", "site", "username", "password"]
        ):
            raise ValueError(
                "CheckMK settings not configured. Please configure CheckMK settings first."
            )

        # Parse URL
        url = db_settings["url"].rstrip("/")
        if url.startswith(("http://", "https://")):
            parsed_url = urlparse(url)
            protocol = parsed_url.scheme
            host = parsed_url.netloc
        else:
            protocol = "https"
            host = url

        # Use provided site_name or fall back to configured site
        effective_site = db_settings["site"]

        return CheckMKClient(
            host=host,
            site_name=effective_site,
            username=db_settings["username"],
            password=db_settings["password"],
            protocol=protocol,
            verify_ssl=db_settings.get("verify_ssl", True),
        )

    async def delete_host(
        self, hostname: str, site_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Delete a host from CheckMK.

        Args:
            hostname: Name of the host to delete
            site_name: Optional site name to use

        Returns:
            Dictionary with success status and message

        Raises:
            ValueError: If CheckMK settings are not configured
            Exception: If the delete operation fails
        """
        logger.info("Deleting host from CheckMK: %s", hostname)

        try:
            client = self._get_client(site_name)
            client.delete_host(hostname)

            logger.info("Successfully deleted host %s from CheckMK", hostname)
            return {"success": True, "message": f"Host {hostname} deleted successfully"}
        except Exception as e:
            logger.error("Error deleting host %s from CheckMK: %s", hostname, str(e))
            raise


# Global CheckMK host service instance
checkmk_host_service = CheckMKHostService()
