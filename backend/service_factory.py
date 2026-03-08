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
    from services.inventory.persistence_service import InventoryPersistenceService
    from services.nautobot.devices.query import DeviceQueryService
    from services.checkmk.client import CheckMKService
    from services.checkmk.host_service import CheckMKHostService
    from checkmk.client import CheckMKClient
    from services.agents.deployment_service import AgentDeploymentService
    from services.agents.template_render_service import AgentTemplateRenderService
    from template_manager import TemplateManager


def build_nautobot_service() -> "NautobotService":
    """Construct a fresh NautobotService instance.

    In the FastAPI app the lifespan creates an app-scoped instance with a
    persistent httpx.AsyncClient; routers receive it via Depends().
    In Celery tasks and other non-FastAPI contexts a fresh instance is used;
    it falls back to one-shot httpx connections when startup() is not called.
    """
    from services.nautobot.client import NautobotService

    return NautobotService()


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


def build_inventory_persistence_service() -> "InventoryPersistenceService":
    """Create a new InventoryPersistenceService instance (PostgreSQL CRUD)."""
    from repositories.inventory.inventory_repository import InventoryRepository
    from services.inventory.persistence_service import InventoryPersistenceService

    return InventoryPersistenceService(repository=InventoryRepository())


def build_inventory_service() -> "InventoryService":
    """Create a new InventoryService instance (Nautobot query facade)."""
    from services.inventory.inventory import InventoryService

    return InventoryService(
        persistence_service=build_inventory_persistence_service()
    )


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
    """Create a NautobotMetadataService with a fresh NautobotService."""
    from services.nautobot.metadata_service import NautobotMetadataService
    from services.nautobot.client import NautobotService

    return NautobotMetadataService(NautobotService())


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


def build_template_manager() -> "TemplateManager":
    """Create a new TemplateManager instance."""
    from template_manager import TemplateManager

    return TemplateManager()


# ---------------------------------------------------------------------------
# CheckMK services
# ---------------------------------------------------------------------------


def build_checkmk_config_service():
    """Create a fresh CheckMK ConfigService instance."""
    from services.checkmk.config import ConfigService

    return ConfigService()


def build_nb2cmk_service():
    """Create a fresh NautobotToCheckMKService instance."""
    from services.checkmk.sync import NautobotToCheckMKService

    return NautobotToCheckMKService()


def build_nb2cmk_db_service():
    """Create a fresh NB2CMKDatabaseService instance."""
    from services.checkmk.sync.database import NB2CMKDatabaseService

    return NB2CMKDatabaseService()


def build_nb2cmk_background_service():
    """Create a new NB2CMKBackgroundService instance.

    This service is app-scoped: it holds an in-memory registry of running
    asyncio.Task objects. The app-scoped instance is created in the FastAPI
    lifespan and stored on app.state. Routers access it via Depends().
    """
    from services.checkmk.sync.background import NB2CMKBackgroundService

    return NB2CMKBackgroundService()


def build_checkmk_folder_service():
    """Create a fresh CheckMKFolderService instance."""
    from services.checkmk.folder import CheckMKFolderService

    return CheckMKFolderService()


def build_device_normalization_service():
    """Create a fresh DeviceNormalizationService instance."""
    from services.checkmk.normalization import DeviceNormalizationService

    return DeviceNormalizationService()


# ---------------------------------------------------------------------------
# Git services
# ---------------------------------------------------------------------------


def build_git_service():
    """Create a fresh GitService instance."""
    from services.settings.git.service import GitService

    return GitService()


def build_git_auth_service():
    """Create a fresh GitAuthenticationService instance."""
    from services.settings.git.auth import GitAuthenticationService

    return GitAuthenticationService()


def build_git_cache_service():
    """Create a fresh GitCacheService instance."""
    from services.settings.git.cache import GitCacheService

    return GitCacheService(build_cache_service())


def build_git_operations_service():
    """Create a fresh GitOperationsService instance."""
    from services.settings.git.operations import GitOperationsService

    return GitOperationsService()


def build_git_connection_service():
    """Create a fresh GitConnectionService instance."""
    from services.settings.git.connection import GitConnectionService

    return GitConnectionService()


def build_git_diff_service():
    """Create a fresh GitDiffService instance."""
    from services.settings.git.diff import GitDiffService

    return GitDiffService()


# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------


def build_cache_service():
    """Create a new RedisCacheService instance."""
    from config import settings
    from services.settings.cache import RedisCacheService

    return RedisCacheService(redis_url=settings.redis_url, key_prefix="cockpit-cache")


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


def build_oidc_service():
    """Create a new OIDCService instance.

    This service is app-scoped: it holds JWKS keys and SSL caches that are
    expensive to rebuild. The app-scoped instance is created in the FastAPI
    lifespan and stored on app.state. Routers access it via Depends().
    """
    from services.auth.oidc import OIDCService

    return OIDCService()


# ---------------------------------------------------------------------------
# Network services
# ---------------------------------------------------------------------------


def build_scan_service():
    """Create a fresh ScanService instance."""
    from services.network.scanning.scan import ScanService

    return ScanService()


def build_netmiko_service():
    """Create a fresh NetmikoService instance."""
    from services.network.automation.netmiko import NetmikoService

    return NetmikoService()


def build_render_service():
    """Create a fresh RenderService instance."""
    from services.network.automation.render import RenderService

    return RenderService()


# ---------------------------------------------------------------------------
# Nautobot device services
# ---------------------------------------------------------------------------


def build_device_creation_service():
    """Create a fresh DeviceCreationService instance."""
    from services.nautobot.devices.creation import DeviceCreationService

    return DeviceCreationService()
