"""
CheckMK shared foundation: config, client factory, and path utilities.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from services.checkmk.client import CheckMKClient
from urllib.parse import urlparse

from services.checkmk.exceptions import CheckMKClientError

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CheckMKConfig:
    host: str
    site: str
    username: str
    password: str
    protocol: str
    verify_ssl: bool
    timeout: int = 30


def get_checkmk_config(site_name: Optional[str] = None) -> CheckMKConfig:
    """Load and validate CheckMK settings into a typed config object."""
    from settings_manager import settings_manager

    db_settings = settings_manager.get_checkmk_settings()
    if not db_settings or not all(
        key in db_settings for key in ["url", "site", "username", "password"]
    ):
        raise CheckMKClientError(
            "CheckMK settings not configured. Please configure CheckMK settings first."
        )

    url = db_settings["url"].rstrip("/")
    if url.startswith(("http://", "https://")):
        parsed = urlparse(url)
        protocol = parsed.scheme
        host = parsed.netloc
    else:
        protocol = "https"
        host = url

    return CheckMKConfig(
        host=host,
        site=site_name or db_settings["site"],
        username=db_settings["username"],
        password=db_settings["password"],
        protocol=protocol,
        verify_ssl=db_settings.get("verify_ssl", True),
        timeout=30,
    )


def parse_url_str(url: str) -> tuple[str, str]:
    """Return (protocol, host) from a URL string with or without a scheme."""
    raw = url.rstrip("/")
    if raw.startswith(("http://", "https://")):
        parsed = urlparse(raw)
        return parsed.scheme, parsed.netloc
    return "https", raw


def slash_to_tilde(path: str) -> str:
    """Convert a slash-delimited folder path to CheckMK tilde notation."""
    normalized = path.replace("//", "/") if path else "/"
    return normalized.replace("/", "~") if normalized else "~"


class CheckMKClientFactory:
    @staticmethod
    def build_client(config: CheckMKConfig) -> CheckMKClient:
        from services.checkmk.client import CheckMKClient

        return CheckMKClient(
            host=config.host,
            site_name=config.site,
            username=config.username,
            password=config.password,
            protocol=config.protocol,
            verify_ssl=config.verify_ssl,
            timeout=config.timeout,
        )

    @staticmethod
    def build_client_from_settings(site_name: Optional[str] = None) -> CheckMKClient:
        config = get_checkmk_config(site_name=site_name)
        return CheckMKClientFactory.build_client(config)
