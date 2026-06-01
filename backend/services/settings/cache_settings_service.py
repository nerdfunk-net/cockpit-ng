"""Cache settings service."""

from __future__ import annotations

import json
import logging
from dataclasses import asdict
from typing import Any, Dict

from repositories.settings.settings_repository import CacheSettingRepository
from services.settings.defaults import CacheSettings

logger = logging.getLogger(__name__)

_DEFAULT_PREFETCH_ITEMS = {"git": True, "locations": False}


class CacheSettingsService:
    def __init__(self, default: CacheSettings) -> None:
        self._default = default

    def get(self) -> Dict[str, Any]:
        try:
            repo = CacheSettingRepository()
            settings = repo.get_settings()
            if settings:
                return {
                    "enabled": settings.enabled,
                    "ttl_seconds": settings.ttl_seconds,
                    "prefetch_on_startup": settings.prefetch_on_startup,
                    "refresh_interval_minutes": settings.refresh_interval_minutes,
                    "max_commits": settings.max_commits,
                    "prefetch_items": json.loads(settings.prefetch_items)
                    if settings.prefetch_items
                    else _DEFAULT_PREFETCH_ITEMS,
                    "devices_cache_interval_minutes": getattr(
                        settings,
                        "devices_cache_interval_minutes",
                        self._default.devices_cache_interval_minutes,
                    ),
                    "locations_cache_interval_minutes": getattr(
                        settings,
                        "locations_cache_interval_minutes",
                        self._default.locations_cache_interval_minutes,
                    ),
                    "git_commits_cache_interval_minutes": getattr(
                        settings,
                        "git_commits_cache_interval_minutes",
                        self._default.git_commits_cache_interval_minutes,
                    ),
                }
            return asdict(self._default)
        except Exception as e:
            logger.error("Error getting Cache settings: %s", e)
            return asdict(self._default)

    def update(self, data: Dict[str, Any]) -> bool:
        try:
            repo = CacheSettingRepository()
            existing = repo.get_settings()
            kwargs = {
                "enabled": data.get("enabled", self._default.enabled),
                "ttl_seconds": data.get("ttl_seconds", self._default.ttl_seconds),
                "prefetch_on_startup": data.get(
                    "prefetch_on_startup", self._default.prefetch_on_startup
                ),
                "refresh_interval_minutes": data.get(
                    "refresh_interval_minutes", self._default.refresh_interval_minutes
                ),
                "max_commits": data.get("max_commits", self._default.max_commits),
                "prefetch_items": json.dumps(
                    data.get("prefetch_items") or _DEFAULT_PREFETCH_ITEMS
                ),
                "devices_cache_interval_minutes": data.get(
                    "devices_cache_interval_minutes",
                    self._default.devices_cache_interval_minutes,
                ),
                "locations_cache_interval_minutes": data.get(
                    "locations_cache_interval_minutes",
                    self._default.locations_cache_interval_minutes,
                ),
                "git_commits_cache_interval_minutes": data.get(
                    "git_commits_cache_interval_minutes",
                    self._default.git_commits_cache_interval_minutes,
                ),
            }
            if existing:
                repo.update(existing.id, **kwargs)
            else:
                repo.create(**kwargs)
            logger.info("Cache settings updated successfully")
            return True
        except Exception as e:
            logger.error("Error updating Cache settings: %s", e)
            return False
