"""
Service factory: plain Python factory functions for constructing services.

No FastAPI imports. No global state.

Usage:
- FastAPI routers: use dependencies.py (which calls this module internally)
- Celery tasks and non-router code: import and call factory functions directly

See: doc/refactoring/REFACTORING_SERVICES.md — Phase 2
"""

from __future__ import annotations
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from services.nautobot.client import NautobotService
    from services.nautobot.metadata_service import NautobotMetadataService
    from services.nautobot.offboarding.service import OffboardingService
    from services.inventory.inventory import InventoryService
    from services.nautobot.devices.query import DeviceQueryService
    from services.checkmk.client import CheckMKService
    from services.checkmk.host_service import CheckMKHostService
    from checkmk.client import CheckMKClient
    from services.agents.deployment_service import AgentDeploymentService
    from services.agents.template_render_service import AgentTemplateRenderService


def build_nautobot_service() -> "NautobotService":
    """Return the module-level NautobotService singleton.

    In the FastAPI app, the singleton is lifecycle-managed via lifespan.
    In Celery tasks, the service falls back to one-shot httpx requests
    when its persistent client is not initialized.
    """
    from services.nautobot.client import nautobot_service

    return nautobot_service


def build_checkmk_client(site_name: Optional[str] = None) -> "CheckMKClient":
    """Create a CheckMK client from database settings."""
    from urllib.parse import urlparse
    from checkmk.client import CheckMKClient
    from services.checkmk.exceptions import CheckMKClientError
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
        parsed_url = urlparse(url)
        protocol = parsed_url.scheme
        host = parsed_url.netloc
    else:
        protocol = "https"
        host = url

    effective_site = site_name or db_settings["site"]

    return CheckMKClient(
        host=host,
        site_name=effective_site,
        username=db_settings["username"],
        password=db_settings["password"],
        protocol=protocol,
        verify_ssl=db_settings.get("verify_ssl", True),
        timeout=30,
    )


def build_inventory_service() -> "InventoryService":
    """Create a new InventoryService instance."""
    from services.inventory.inventory import InventoryService

    return InventoryService()


def build_device_query_service() -> "DeviceQueryService":
    """Create a new DeviceQueryService instance."""
    from services.nautobot.devices.query import DeviceQueryService

    return DeviceQueryService()


def build_checkmk_service() -> "CheckMKService":
    """Create a new CheckMKService instance."""
    from services.checkmk.client import CheckMKService

    return CheckMKService()


def build_checkmk_host_service() -> "CheckMKHostService":
    """Create a new CheckMKHostService instance."""
    from services.checkmk.host_service import CheckMKHostService

    return CheckMKHostService()


def build_nautobot_metadata_service() -> "NautobotMetadataService":
    """Create a NautobotMetadataService using the module-level nautobot_service singleton."""
    from services.nautobot.metadata_service import NautobotMetadataService
    from services.nautobot.client import nautobot_service

    return NautobotMetadataService(nautobot_service)


def build_offboarding_service() -> "OffboardingService":
    """Create a new OffboardingService instance."""
    from services.nautobot.offboarding.service import OffboardingService

    return OffboardingService()


def build_agent_template_render_service() -> "AgentTemplateRenderService":
    """Create a new AgentTemplateRenderService instance."""
    from services.agents.template_render_service import AgentTemplateRenderService

    return AgentTemplateRenderService()


def build_agent_deployment_service() -> "AgentDeploymentService":
    """Create a new AgentDeploymentService instance."""
    from services.agents.deployment_service import AgentDeploymentService

    return AgentDeploymentService()


# ---------------------------------------------------------------------------
# CheckMK services
# ---------------------------------------------------------------------------


def build_checkmk_config_service():
    """Return the module-level CheckMK ConfigService singleton."""
    from services.checkmk.config import config_service

    return config_service


def build_nb2cmk_service():
    """Return the module-level NautobotToCheckMKService singleton."""
    from services.checkmk.sync import nb2cmk_service

    return nb2cmk_service


def build_nb2cmk_db_service():
    """Return the module-level NB2CMKDatabaseService singleton."""
    from services.checkmk.sync.database import nb2cmk_db_service

    return nb2cmk_db_service


# ---------------------------------------------------------------------------
# Git services
# ---------------------------------------------------------------------------


def build_git_service():
    """Return the module-level GitService singleton."""
    from services.settings.git.service import git_service

    return git_service


def build_git_auth_service():
    """Return the module-level GitAuthenticationService singleton."""
    from services.settings.git.auth import git_auth_service

    return git_auth_service


def build_git_cache_service():
    """Return the module-level GitCacheService singleton."""
    from services.settings.git.cache import git_cache_service

    return git_cache_service


def build_git_operations_service():
    """Return the module-level GitOperationsService singleton."""
    from services.settings.git.operations import git_operations_service

    return git_operations_service


def build_git_connection_service():
    """Return the module-level GitConnectionService singleton."""
    from services.settings.git.connection import git_connection_service

    return git_connection_service


def build_git_diff_service():
    """Return the module-level GitDiffService singleton."""
    from services.settings.git.diff import git_diff_service

    return git_diff_service


# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------


def build_cache_service():
    """Return the module-level RedisCacheService singleton."""
    from services.settings.cache import cache_service

    return cache_service


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


def build_oidc_service():
    """Return the module-level OIDCService singleton.

    This service is app-scoped; it is kept as a singleton because it holds
    JWKS and SSL caches that should not be rebuilt per request.
    """
    from services.auth.oidc import oidc_service

    return oidc_service


# ---------------------------------------------------------------------------
# Network services
# ---------------------------------------------------------------------------


def build_scan_service():
    """Return the module-level ScanService singleton."""
    from services.network.scanning.scan import scan_service

    return scan_service


def build_netmiko_service():
    """Return the module-level NetmikoService singleton."""
    from services.network.automation.netmiko import netmiko_service

    return netmiko_service


def build_render_service():
    """Return the module-level RenderService singleton."""
    from services.network.automation.render import render_service

    return render_service


# ---------------------------------------------------------------------------
# Nautobot device services
# ---------------------------------------------------------------------------


def build_device_creation_service():
    """Return the module-level DeviceCreationService singleton."""
    from services.nautobot.devices.creation import device_creation_service

    return device_creation_service
