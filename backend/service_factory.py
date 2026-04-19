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
    from services.checkmk.client import CheckMKConnectionService
    from services.checkmk.host_service import CheckMKHostService
    from services.checkmk.monitoring_service import CheckMKMonitoringService
    from services.checkmk.discovery_service import CheckMKDiscoveryService
    from services.checkmk.problems_service import CheckMKProblemsService
    from services.checkmk.activation_service import CheckMKActivationService
    from services.checkmk.host_group_service import CheckMKHostGroupService
    from services.checkmk.tag_group_service import CheckMKTagGroupService
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
    from services.checkmk.base import CheckMKClientFactory

    return CheckMKClientFactory.build_client_from_settings(site_name=site_name)


def build_inventory_persistence_service() -> "InventoryPersistenceService":
    """Create a new InventoryPersistenceService instance (PostgreSQL CRUD)."""
    from repositories.inventory.inventory_repository import InventoryRepository
    from services.inventory.persistence_service import InventoryPersistenceService

    return InventoryPersistenceService(repository=InventoryRepository())


def build_inventory_service() -> "InventoryService":
    """Create a new InventoryService instance (Nautobot query facade)."""
    from services.inventory.inventory import InventoryService

    return InventoryService(
        persistence_service=build_inventory_persistence_service(),
        cache_service=build_cache_service(),
    )


def build_device_query_service() -> "DeviceQueryService":
    """Create a new DeviceQueryService instance."""
    from services.nautobot.devices.query import DeviceQueryService

    return DeviceQueryService()


def build_checkmk_service() -> "CheckMKConnectionService":
    """Create a new CheckMKConnectionService instance."""
    from services.checkmk.client import CheckMKConnectionService

    return CheckMKConnectionService()


def build_checkmk_host_service() -> "CheckMKHostService":
    """Create a new CheckMKHostService instance."""
    from services.checkmk.host_service import CheckMKHostService

    return CheckMKHostService()


def build_checkmk_monitoring_service() -> "CheckMKMonitoringService":
    """Create a new CheckMKMonitoringService instance."""
    from services.checkmk.monitoring_service import CheckMKMonitoringService

    return CheckMKMonitoringService()


def build_checkmk_discovery_service() -> "CheckMKDiscoveryService":
    """Create a new CheckMKDiscoveryService instance."""
    from services.checkmk.discovery_service import CheckMKDiscoveryService

    return CheckMKDiscoveryService()


def build_checkmk_problems_service() -> "CheckMKProblemsService":
    """Create a new CheckMKProblemsService instance."""
    from services.checkmk.problems_service import CheckMKProblemsService

    return CheckMKProblemsService()


def build_checkmk_activation_service() -> "CheckMKActivationService":
    """Create a new CheckMKActivationService instance."""
    from services.checkmk.activation_service import CheckMKActivationService

    return CheckMKActivationService()


def build_checkmk_host_group_service() -> "CheckMKHostGroupService":
    """Create a new CheckMKHostGroupService instance."""
    from services.checkmk.host_group_service import CheckMKHostGroupService

    return CheckMKHostGroupService()


def build_checkmk_tag_group_service() -> "CheckMKTagGroupService":
    """Create a new CheckMKTagGroupService instance."""
    from services.checkmk.tag_group_service import CheckMKTagGroupService

    return CheckMKTagGroupService()


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


# ---------------------------------------------------------------------------
# Template services
# ---------------------------------------------------------------------------


def build_template_scan_service():
    """Create a TemplateScanService using the default contributing-data directory."""
    from services.templates.scan_service import TemplateScanService

    return TemplateScanService()


def build_template_import_service():
    """Create a TemplateImportService backed by the global template_manager."""
    from template_manager import template_manager
    from services.templates.import_service import TemplateImportService

    return TemplateImportService(template_manager=template_manager)


def build_template_render_orchestrator():
    """Create a TemplateRenderOrchestrator with all required dependencies."""
    from template_manager import template_manager
    from services.templates.render_orchestrator import TemplateRenderOrchestrator

    return TemplateRenderOrchestrator(
        device_query_service=build_device_query_service(),
        checkmk_config_service=build_checkmk_config_service(),
        render_service=build_render_service(),
        inventory_service=build_inventory_service(),
        template_manager=template_manager,
    )
