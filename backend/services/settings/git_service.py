"""Git settings service."""

from __future__ import annotations

import logging
from dataclasses import asdict
from typing import Any, Dict, Optional

from repositories.settings.settings_repository import (
    GitSettingRepository,
    SettingsMetadataRepository,
)
from services.settings.defaults import GitSettings

logger = logging.getLogger(__name__)


class GitSettingsService:
    def __init__(self, default: GitSettings) -> None:
        self._default = default

    def get(self) -> Dict[str, Any]:
        try:
            repo = GitSettingRepository()
            settings = repo.get_settings()
            if settings:
                return {
                    "repo_url": settings.repo_url,
                    "branch": settings.branch,
                    "username": settings.username or "",
                    "token": settings.token or "",
                    "config_path": settings.config_path,
                    "sync_interval": settings.sync_interval,
                    "verify_ssl": settings.verify_ssl,
                }
            return asdict(self._default)
        except Exception as e:
            logger.error("Error getting Git settings: %s", e)
            return asdict(self._default)

    def update(self, data: Dict[str, Any]) -> bool:
        try:
            repo = GitSettingRepository()
            existing = repo.get_settings()
            kwargs = {
                "repo_url": data.get("repo_url", self._default.repo_url),
                "branch": data.get("branch", self._default.branch),
                "username": data.get("username", self._default.username),
                "token": data.get("token", self._default.token),
                "config_path": data.get("config_path", self._default.config_path),
                "sync_interval": data.get("sync_interval", self._default.sync_interval),
                "verify_ssl": data.get("verify_ssl", self._default.verify_ssl),
            }
            if existing:
                repo.update(existing.id, **kwargs)
            else:
                repo.create(**kwargs)
            logger.info("Git settings updated successfully")
            return True
        except Exception as e:
            logger.error("Error updating Git settings: %s", e)
            return False

    def get_selected_repository(self) -> Optional[int]:
        try:
            repo = SettingsMetadataRepository()
            result = repo.get_by_key("selected_git_repository")
            return int(result.value) if result and result.value else None
        except Exception as e:
            logger.error("Error getting selected Git repository: %s", e)
            return None

    def set_selected_repository(self, repository_id: int) -> bool:
        try:
            repo = SettingsMetadataRepository()
            repo.set_metadata("selected_git_repository", str(repository_id))
            logger.info("Selected Git repository set to ID: %s", repository_id)
            return True
        except Exception as e:
            logger.error("Error setting selected Git repository: %s", e)
            return False
