"""
Environment-backed settings for pytest and other non-UI test runs.

When ``COCKPIT_TEST_ENV=1`` (set after loading ``backend/.env.test``), Nautobot and
CheckMK clients read credentials from environment variables instead of PostgreSQL
settings tables. Production and normal dev (without that flag) are unchanged.
"""

from __future__ import annotations

import os
from typing import Any, Dict, Optional

NAUTOBOT_TOKEN_PLACEHOLDER = "your-test-nautobot-token-here"


def is_test_env_active() -> bool:
    return os.getenv("COCKPIT_TEST_ENV") == "1"


def nautobot_settings_from_env() -> Optional[Dict[str, Any]]:
    """Nautobot URL/token from env; None if missing or placeholder."""
    if not is_test_env_active():
        return None
    url = os.getenv("NAUTOBOT_HOST", "").strip()
    token = os.getenv("NAUTOBOT_TOKEN", "").strip()
    if not url or not token or token == NAUTOBOT_TOKEN_PLACEHOLDER:
        return None
    return {
        "url": url,
        "token": token,
        "timeout": int(os.getenv("NAUTOBOT_TIMEOUT", "30")),
        "verify_ssl": os.getenv("NAUTOBOT_VERIFY_SSL", "true").lower()
        in ("true", "1", "yes", "on"),
    }


def checkmk_settings_from_env() -> Optional[Dict[str, Any]]:
    """CheckMK connection dict from env; None if incomplete."""
    if not is_test_env_active():
        return None
    from services.checkmk.base import parse_checkmk_url

    raw_url = (os.getenv("CHECKMK_URL") or os.getenv("CHECKMK_HOST") or "").strip()
    site_env = os.getenv("CHECKMK_SITE", "").strip()
    username = os.getenv("CHECKMK_USERNAME", "").strip()
    password = os.getenv("CHECKMK_PASSWORD", "").strip()
    if not raw_url or not username or not password:
        return None

    _protocol, host, site = parse_checkmk_url(raw_url, site_env)
    if not host or not site:
        return None

    verify = os.getenv("CHECKMK_VERIFY_SSL", "true").lower() in (
        "true",
        "1",
        "yes",
        "on",
    )
    return {
        "url": f"{_protocol}://{host}",
        "site": site,
        "username": username,
        "password": password,
        "verify_ssl": verify,
    }


def postgres_test_database_url() -> Optional[str]:
    """SQLAlchemy URL for repository integration tests."""
    explicit = os.getenv("TEST_DATABASE_URL", "").strip()
    if explicit:
        return explicit
    host = os.getenv("COCKPIT_DATABASE_HOST", "").strip()
    name = os.getenv("COCKPIT_DATABASE_NAME", "").strip()
    user = os.getenv("COCKPIT_DATABASE_USERNAME", "").strip()
    password = os.getenv("COCKPIT_DATABASE_PASSWORD", "")
    if not all([host, name, user]):
        return None
    port = os.getenv("COCKPIT_DATABASE_PORT", "5432").strip()
    return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{name}"
