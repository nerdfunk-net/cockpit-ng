"""OIDC provider configuration service (file-based YAML, no DB)."""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml

logger = logging.getLogger(__name__)

_OIDC_CONFIG_PATH = (
    Path(__file__).parent.parent.parent.parent / "config" / "oidc_providers.yaml"
)
_EMPTY_CONFIG: Dict[str, Any] = {
    "providers": {},
    "global": {"allow_traditional_login": True},
}


class OidcService:
    def get_config_path(self) -> str:
        return str(_OIDC_CONFIG_PATH)

    def load_providers(self) -> Dict[str, Any]:
        config_path = str(_OIDC_CONFIG_PATH)
        if not os.path.exists(config_path):
            logger.warning("OIDC providers config not found at %s", config_path)
            return _EMPTY_CONFIG.copy()
        try:
            with open(config_path, "r") as f:
                config = yaml.safe_load(f)
            if not config:
                logger.warning("OIDC providers config is empty")
                return _EMPTY_CONFIG.copy()
            config.setdefault("providers", {})
            config.setdefault("global", {"allow_traditional_login": True})
            logger.info(
                "Loaded %s OIDC provider(s) from config",
                len(config.get("providers", {})),
            )
            return config
        except yaml.YAMLError as e:
            logger.error("Error parsing OIDC providers YAML: %s", e)
            return _EMPTY_CONFIG.copy()
        except Exception as e:
            logger.error("Error loading OIDC providers config: %s", e)
            return _EMPTY_CONFIG.copy()

    def get_providers(self) -> Dict[str, Dict[str, Any]]:
        return self.load_providers().get("providers", {})

    def get_enabled_providers(self) -> List[Dict[str, Any]]:
        enabled = []
        for provider_id, cfg in self.get_providers().items():
            if cfg.get("enabled", False):
                entry = cfg.copy()
                entry["provider_id"] = provider_id
                enabled.append(entry)
        enabled.sort(key=lambda p: p.get("display_order", 999))
        logger.info("Found %s enabled OIDC provider(s)", len(enabled))
        return enabled

    def get_provider(self, provider_id: str) -> Optional[Dict[str, Any]]:
        provider = self.get_providers().get(provider_id)
        if provider:
            result = provider.copy()
            result["provider_id"] = provider_id
            return result
        logger.warning("OIDC provider '%s' not found in config", provider_id)
        return None

    def get_global_settings(self) -> Dict[str, Any]:
        return self.load_providers().get("global", {"allow_traditional_login": True})

    def is_enabled(self) -> bool:
        return len(self.get_enabled_providers()) > 0
