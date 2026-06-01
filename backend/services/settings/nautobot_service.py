"""Nautobot connection settings service."""

from __future__ import annotations

import logging
from dataclasses import asdict
from typing import Any, Dict

from repositories.settings.settings_repository import NautobotSettingRepository
from services.settings.defaults import NautobotSettings

logger = logging.getLogger(__name__)


class NautobotSettingsService:
    def __init__(self, default: NautobotSettings) -> None:
        self._default = default

    def get(self) -> Dict[str, Any]:
        try:
            repo = NautobotSettingRepository()
            settings = repo.get_settings()
            if settings:
                return {
                    "url": settings.url,
                    "token": settings.token,
                    "timeout": settings.timeout,
                    "verify_ssl": settings.verify_ssl,
                }
            return asdict(self._default)
        except Exception as e:
            logger.error("Error getting Nautobot settings: %s", e)
            return asdict(self._default)

    def update(self, data: Dict[str, Any]) -> bool:
        try:
            repo = NautobotSettingRepository()
            existing = repo.get_settings()
            kwargs = {
                "url": data.get("url", self._default.url),
                "token": data.get("token", self._default.token),
                "timeout": data.get("timeout", self._default.timeout),
                "verify_ssl": data.get("verify_ssl", self._default.verify_ssl),
            }
            if existing:
                repo.update(existing.id, **kwargs)
            else:
                repo.create(**kwargs)
            logger.info("Nautobot settings updated successfully")
            return True
        except Exception as e:
            logger.error("Error updating Nautobot settings: %s", e)
            return False
