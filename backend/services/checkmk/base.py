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
    from services.settings.manager import SettingsManager

    settings_manager = SettingsManager()

    db_settings = settings_manager.get_checkmk_settings()
    if not db_settings or not all(
        key in db_settings for key in ["url", "site", "username", "password"]
    ):
        raise CheckMKClientError(
            "CheckMK settings not configured. Please configure CheckMK settings first."
        )

    protocol, host, resolved_site = parse_checkmk_url(
        db_settings["url"],
        site_name or db_settings.get("site"),
    )

    return CheckMKConfig(
        host=host,
        site=resolved_site,
        username=db_settings["username"],
        password=db_settings["password"],
        protocol=protocol,
        verify_ssl=db_settings.get("verify_ssl", True),
        timeout=30,
    )


def parse_checkmk_url(url: str, site: Optional[str] = None) -> tuple[str, str, str]:
    """
    Parse a CheckMK server URL into (protocol, host, site).

    Accepts common forms:
      - ``http://host:8080`` (site from ``site`` argument / CHECKMK_SITE)
      - ``http://host:8080/cmk``
      - ``http://host:8080/cmk/check_mk`` or full REST base through ``.../api/1.0``

    ``host`` is hostname with optional port (no path). Site is the OMD site id (e.g. ``cmk``).
    """
    raw = (url or "").strip().rstrip("/")
    if not raw:
        return "https", "", (site or "").strip()

    path_parts: list[str] = []

    if raw.startswith(("http://", "https://")):
        parsed = urlparse(raw)
        protocol = parsed.scheme
        host = parsed.netloc
        path_parts = [p for p in parsed.path.split("/") if p]
    elif "/" in raw:
        host, remainder = raw.split("/", 1)
        protocol = "https"
        path_parts = [p for p in remainder.split("/") if p]
    else:
        return "https", raw, (site or "").strip()

    while path_parts and path_parts[-1] in ("1.0", "api"):
        path_parts.pop()
    if path_parts and path_parts[-1] == "check_mk":
        path_parts.pop()

    derived_site = path_parts[0] if path_parts else ""
    resolved_site = derived_site or (site or "").strip()
    return protocol, host, resolved_site


def parse_url_str(url: str) -> tuple[str, str]:
    """Return (protocol, host) from a URL string with or without a scheme."""
    protocol, host, _site = parse_checkmk_url(url)
    return protocol, host


def checkmk_api_base_url(protocol: str, host: str, site: str) -> str:
    """REST API base URL Cockpit uses for CheckMK (for diagnostics)."""
    return f"{protocol}://{host}/{site}/check_mk/api/1.0"


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
