"""CheckMK settings service."""

from __future__ import annotations

import logging
from dataclasses import asdict
from typing import Any, Dict

from repositories.settings.settings_repository import CheckMKSettingRepository
from services.settings.defaults import CheckMKSettings

logger = logging.getLogger(__name__)


class CheckMKSettingsService:
    def __init__(self, default: CheckMKSettings) -> None:
        self._default = default

    def get(self) -> Dict[str, Any]:
        try:
            repo = CheckMKSettingRepository()
            settings = repo.get_settings()
            if settings:
                return {
                    "url": settings.url,
                    "site": settings.site,
                    "username": settings.username,
                    "password": settings.password,
                    "verify_ssl": settings.verify_ssl,
                }
            return asdict(self._default)
        except Exception as e:
            logger.error("Error getting CheckMK settings: %s", e)
            return asdict(self._default)

    def update(self, data: Dict[str, Any]) -> bool:
        try:
            repo = CheckMKSettingRepository()
            existing = repo.get_settings()
            kwargs = {
                "url": data.get("url", self._default.url),
                "site": data.get("site", self._default.site),
                "username": data.get("username", self._default.username),
                "password": data.get("password", self._default.password),
                "verify_ssl": data.get("verify_ssl", self._default.verify_ssl),
            }
            if existing:
                repo.update(existing.id, **kwargs)
            else:
                repo.create(**kwargs)
            logger.info("CheckMK settings updated successfully")
            return True
        except Exception as e:
            logger.error("Error updating CheckMK settings: %s", e)
            return False
