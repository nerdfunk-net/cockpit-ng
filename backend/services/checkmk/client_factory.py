"""
CheckMK client factory for creating client instances from database settings.

This module provides utilities to create CheckMK client instances using
configuration from the settings manager, following the service layer pattern.
"""

import logging
from typing import Optional
from urllib.parse import urlparse

from checkmk.client import CheckMKClient, CheckMKAPIError
from settings_manager import settings_manager

logger = logging.getLogger(__name__)


class CheckMKClientError(Exception):
    """Exception raised when CheckMK client cannot be created or used."""

    pass


def get_checkmk_client(site_name: Optional[str] = None) -> CheckMKClient:
    """
    Create CheckMK client from database settings.

    Args:
        site_name: Optional site name to use. If None, uses the configured default site.

    Returns:
        CheckMKClient instance configured with database settings

    Raises:
        CheckMKClientError: If CheckMK settings are not configured properly
    """
    db_settings = settings_manager.get_checkmk_settings()
    if not db_settings or not all(
        key in db_settings for key in ["url", "site", "username", "password"]
    ):
        raise CheckMKClientError(
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
    effective_site = site_name or db_settings["site"]

    # Log client initialization details for debugging
    logger.info("Initializing CheckMK client:")
    logger.info("  host: %s", host)
    logger.info("  site_name: %s", effective_site)
    logger.info("  username: %s", db_settings["username"])
    logger.info("  protocol: %s", protocol)
    logger.info("  verify_ssl: %s", db_settings.get("verify_ssl", True))

    return CheckMKClient(
        host=host,
        site_name=effective_site,
        username=db_settings["username"],
        password=db_settings["password"],
        protocol=protocol,
        verify_ssl=db_settings.get("verify_ssl", True),
        timeout=30,
    )


class HostNotFoundError(Exception):
    """Exception raised when a host is not found in CheckMK."""

    pass


async def get_host_data(hostname: str, effective_attributes: bool = False) -> dict:
    """
    Get host configuration from CheckMK.

    Args:
        hostname: The hostname to retrieve
        effective_attributes: Whether to include effective attributes

    Returns:
        dict: Host configuration data

    Raises:
        CheckMKClientError: If settings are not configured
        HostNotFoundError: If the host is not found (404)
        CheckMKAPIError: If CheckMK API returns an error
    """
    try:
        client = get_checkmk_client()
        result = client.get_host(hostname, effective_attributes)
        return result
    except CheckMKAPIError as e:
        if e.status_code == 404:
            raise HostNotFoundError(f"Host '{hostname}' not found in CheckMK")
        raise
