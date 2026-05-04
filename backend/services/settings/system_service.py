"""System-level settings operations: health check, reset, metadata."""

from __future__ import annotations

import logging
from typing import Any, Dict

from repositories.settings.settings_repository import (
    GitSettingRepository,
    NautobotSettingRepository,
    SettingsMetadataRepository,
)

logger = logging.getLogger(__name__)


class SystemSettingsService:
    def health_check(self) -> Dict[str, Any]:
        try:
            nautobot_repo = NautobotSettingRepository()
            git_repo = GitSettingRepository()
            return {
                "status": "healthy",
                "database_type": "postgresql",
                "nautobot_settings_count": 1 if nautobot_repo.get_settings() else 0,
                "git_settings_count": 1 if git_repo.get_settings() else 0,
            }
        except Exception as e:
            logger.error("Database health check failed: %s", e)
            return {"status": "unhealthy", "error": str(e), "recovery_needed": False}

    def reset_to_defaults(self) -> bool:
        try:
            from core.database import get_db_session
            from core.models import (
                CacheSetting,
                CheckMKSetting,
                GitSetting,
                NautobotSetting,
            )

            session = get_db_session()
            try:
                session.query(NautobotSetting).delete()
                session.query(GitSetting).delete()
                session.query(CheckMKSetting).delete()
                session.query(CacheSetting).delete()
                session.commit()
                logger.info("Settings reset to defaults")
                return True
            finally:
                session.close()
        except Exception as e:
            logger.error("Error resetting settings: %s", e)
            return False

    def get_metadata(self) -> Dict[str, Any]:
        try:
            repo = SettingsMetadataRepository()
            schema_version = repo.get_by_key("schema_version")
            return {
                "schema_version": schema_version.value if schema_version else "1.0",
                "database_type": "postgresql",
            }
        except Exception as e:
            logger.error("Error getting metadata: %s", e)
            return {"error": str(e)}
