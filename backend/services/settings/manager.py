"""SettingsManager facade composing all domain-scoped settings services."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from services.settings.agents_service import AgentsSettingsService
from services.settings.cache_settings_service import CacheSettingsService
from services.settings.celery_service import CelerySettingsService
from services.settings.checkmk_service import CheckMKSettingsService
from services.settings.defaults import (
    AgentsSettings,
    CacheSettings,
    CelerySettings,
    CheckMKSettings,
    GitSettings,
    NautobotDefaults,
    NautobotSettings,
)
from services.settings.git_service import GitSettingsService
from services.settings.nautobot_service import NautobotSettingsService
from services.settings.oidc_service import OidcService
from services.settings.system_service import SystemSettingsService

logger = logging.getLogger(__name__)


class SettingsManager:
    """Thin facade over domain-scoped settings services."""

    def __init__(self) -> None:
        try:
            from config import settings as env_settings

            nautobot_default = NautobotSettings(
                url=env_settings.nautobot_url,
                token=env_settings.nautobot_token,
                timeout=env_settings.nautobot_timeout,
                verify_ssl=True,
            )
        except ImportError:
            nautobot_default = NautobotSettings()

        self._nautobot = NautobotSettingsService(nautobot_default, NautobotDefaults())
        self._git = GitSettingsService(GitSettings())
        self._checkmk = CheckMKSettingsService(CheckMKSettings())
        self._cache = CacheSettingsService(CacheSettings())
        self._celery = CelerySettingsService(CelerySettings())
        self._agents = AgentsSettingsService(AgentsSettings())
        self._oidc = OidcService()
        self._system = SystemSettingsService()

    # --- Nautobot ---

    def get_nautobot_settings(self) -> Dict[str, Any]:
        return self._nautobot.get()

    def update_nautobot_settings(self, settings: Dict[str, Any]) -> bool:
        return self._nautobot.update(settings)

    def get_nautobot_defaults(self) -> Dict[str, Any]:
        return self._nautobot.get_defaults()

    def update_nautobot_defaults(self, defaults: Dict[str, Any]) -> bool:
        return self._nautobot.update_defaults(defaults)

    # --- Git ---

    def get_git_settings(self) -> Dict[str, Any]:
        return self._git.get()

    def update_git_settings(self, settings: Dict[str, Any]) -> bool:
        return self._git.update(settings)

    def get_selected_git_repository(self) -> Optional[int]:
        return self._git.get_selected_repository()

    def set_selected_git_repository(self, repository_id: int) -> bool:
        return self._git.set_selected_repository(repository_id)

    # --- CheckMK ---

    def get_checkmk_settings(self) -> Dict[str, Any]:
        return self._checkmk.get()

    def update_checkmk_settings(self, settings: Dict[str, Any]) -> bool:
        return self._checkmk.update(settings)

    # --- Cache ---

    def get_cache_settings(self) -> Dict[str, Any]:
        return self._cache.get()

    def update_cache_settings(self, settings: Dict[str, Any]) -> bool:
        return self._cache.update(settings)

    # --- Celery ---

    def get_celery_settings(self) -> Dict[str, Any]:
        return self._celery.get()

    def update_celery_settings(self, settings: Dict[str, Any]) -> bool:
        return self._celery.update(settings)

    def ensure_builtin_queues(self) -> bool:
        return self._celery.ensure_builtin_queues()

    # --- Agents ---

    def get_agents_settings(self) -> Dict[str, Any]:
        return self._agents.get()

    def update_agents_settings(self, settings: Dict[str, Any]) -> bool:
        return self._agents.update(settings)

    # --- OIDC ---

    def get_oidc_providers_config_path(self) -> str:
        return self._oidc.get_config_path()

    def load_oidc_providers(self) -> Dict[str, Any]:
        return self._oidc.load_providers()

    def get_oidc_providers(self) -> Dict[str, Dict[str, Any]]:
        return self._oidc.get_providers()

    def get_enabled_oidc_providers(self) -> List[Dict[str, Any]]:
        return self._oidc.get_enabled_providers()

    def get_oidc_provider(self, provider_id: str) -> Optional[Dict[str, Any]]:
        return self._oidc.get_provider(provider_id)

    def get_oidc_global_settings(self) -> Dict[str, Any]:
        return self._oidc.get_global_settings()

    def is_oidc_enabled(self) -> bool:
        return self._oidc.is_enabled()

    # --- Aggregate ---

    def get_all_settings(self) -> Dict[str, Any]:
        return {
            "nautobot": self.get_nautobot_settings(),
            "git": self.get_git_settings(),
            "checkmk": self.get_checkmk_settings(),
            "cache": self.get_cache_settings(),
            "metadata": self._system.get_metadata(),
        }

    def update_all_settings(self, settings: Dict[str, Any]) -> bool:
        success = True
        if "nautobot" in settings:
            success &= self.update_nautobot_settings(settings["nautobot"])
        if "git" in settings:
            success &= self.update_git_settings(settings["git"])
        if "checkmk" in settings:
            success &= self.update_checkmk_settings(settings["checkmk"])
        if "cache" in settings:
            success &= self.update_cache_settings(settings["cache"])
        return success

    # --- System ---

    def health_check(self) -> Dict[str, Any]:
        return self._system.health_check()

    def reset_to_defaults(self) -> bool:
        return self._system.reset_to_defaults()
