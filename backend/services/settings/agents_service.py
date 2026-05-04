"""Agents settings service."""

from __future__ import annotations

import logging
from dataclasses import asdict
from typing import Any, Dict

from repositories.settings.settings_repository import AgentsSettingRepository
from services.settings.defaults import AgentsSettings

logger = logging.getLogger(__name__)


class AgentsSettingsService:
    def __init__(self, default: AgentsSettings) -> None:
        self._default = default

    def get(self) -> Dict[str, Any]:
        try:
            repo = AgentsSettingRepository()
            settings = repo.get_settings()
            if settings:
                return {
                    "deployment_method": settings.deployment_method,
                    "local_root_path": settings.local_root_path,
                    "sftp_hostname": settings.sftp_hostname,
                    "sftp_port": settings.sftp_port,
                    "sftp_path": settings.sftp_path,
                    "sftp_username": settings.sftp_username,
                    "sftp_password": settings.sftp_password,
                    "use_global_credentials": settings.use_global_credentials,
                    "global_credential_id": settings.global_credential_id,
                    "git_repository_id": settings.git_repository_id,
                    "agents": settings.agents if settings.agents else [],
                }
            defaults = asdict(self._default)
            defaults["agents"] = []
            return defaults
        except Exception as e:
            logger.error("Error getting Agents settings: %s", e)
            defaults = asdict(self._default)
            defaults["agents"] = []
            return defaults

    def update(self, data: Dict[str, Any]) -> bool:
        try:
            repo = AgentsSettingRepository()
            existing = repo.get_settings()
            kwargs = {
                "deployment_method": data.get(
                    "deployment_method", self._default.deployment_method
                ),
                "local_root_path": data.get(
                    "local_root_path", self._default.local_root_path
                ),
                "sftp_hostname": data.get("sftp_hostname", self._default.sftp_hostname),
                "sftp_port": data.get("sftp_port", self._default.sftp_port),
                "sftp_path": data.get("sftp_path", self._default.sftp_path),
                "sftp_username": data.get("sftp_username", self._default.sftp_username),
                "sftp_password": data.get("sftp_password", self._default.sftp_password),
                "use_global_credentials": data.get(
                    "use_global_credentials", self._default.use_global_credentials
                ),
                "global_credential_id": data.get(
                    "global_credential_id", self._default.global_credential_id
                ),
                "git_repository_id": data.get(
                    "git_repository_id", self._default.git_repository_id
                ),
                "agents": data.get("agents", []),
            }
            if existing:
                repo.update(existing.id, **kwargs)
            else:
                repo.create(**kwargs)
            logger.info("Agents settings updated successfully")
            return True
        except Exception as e:
            logger.error("Error updating Agents settings: %s", e)
            return False
