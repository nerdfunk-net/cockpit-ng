"""Celery settings service."""

from __future__ import annotations

import json
import logging
from dataclasses import asdict
from typing import Any, Dict

from repositories.settings.settings_repository import CelerySettingRepository
from services.settings.defaults import CelerySettings

logger = logging.getLogger(__name__)

BUILTIN_QUEUES = [
    {
        "name": "default",
        "description": "Default queue for general tasks",
        "built_in": True,
    },
    {
        "name": "backup",
        "description": "Queue for device backup operations",
        "built_in": True,
    },
    {
        "name": "network",
        "description": "Queue for network scanning and discovery tasks",
        "built_in": True,
    },
    {
        "name": "heavy",
        "description": "Queue for bulk operations and heavy processing tasks",
        "built_in": True,
    },
]


class CelerySettingsService:
    def __init__(self, default: CelerySettings) -> None:
        self._default = default

    def get(self) -> Dict[str, Any]:
        try:
            repo = CelerySettingRepository()
            settings = repo.get_settings()
            if settings:
                queues = []
                if settings.queues:
                    try:
                        queues = json.loads(settings.queues)
                    except json.JSONDecodeError:
                        logger.warning("Failed to parse queues JSON, using empty list")
                return {
                    "max_workers": settings.max_workers,
                    "cleanup_enabled": settings.cleanup_enabled,
                    "cleanup_interval_hours": settings.cleanup_interval_hours,
                    "cleanup_age_hours": settings.cleanup_age_hours,
                    "client_data_cleanup_enabled": settings.client_data_cleanup_enabled,
                    "client_data_cleanup_interval_hours": settings.client_data_cleanup_interval_hours,
                    "client_data_cleanup_age_hours": settings.client_data_cleanup_age_hours,
                    "result_expires_hours": settings.result_expires_hours,
                    "queues": queues,
                }
            return asdict(self._default)
        except Exception as e:
            logger.error("Error getting Celery settings: %s", e)
            return asdict(self._default)

    def update(self, data: Dict[str, Any]) -> bool:
        try:
            repo = CelerySettingRepository()
            existing = repo.get_settings()
            queues = data.get("queues", [])
            kwargs = {
                "max_workers": data.get("max_workers", self._default.max_workers),
                "cleanup_enabled": data.get(
                    "cleanup_enabled", self._default.cleanup_enabled
                ),
                "cleanup_interval_hours": data.get(
                    "cleanup_interval_hours", self._default.cleanup_interval_hours
                ),
                "cleanup_age_hours": data.get(
                    "cleanup_age_hours", self._default.cleanup_age_hours
                ),
                "client_data_cleanup_enabled": data.get(
                    "client_data_cleanup_enabled",
                    self._default.client_data_cleanup_enabled,
                ),
                "client_data_cleanup_interval_hours": data.get(
                    "client_data_cleanup_interval_hours",
                    self._default.client_data_cleanup_interval_hours,
                ),
                "client_data_cleanup_age_hours": data.get(
                    "client_data_cleanup_age_hours",
                    self._default.client_data_cleanup_age_hours,
                ),
                "result_expires_hours": data.get(
                    "result_expires_hours", self._default.result_expires_hours
                ),
                "queues": json.dumps(queues) if queues else None,
            }
            if existing:
                repo.update(existing.id, **kwargs)
            else:
                repo.create(**kwargs)
            logger.info("Celery settings updated successfully")
            return True
        except Exception as e:
            logger.error("Error updating Celery settings: %s", e)
            return False

    def ensure_builtin_queues(self) -> bool:
        """Ensure built-in queues exist in the database. Called on application startup."""
        try:
            current = self.get()
            current_queues = current.get("queues", [])
            existing_names = {q["name"] for q in current_queues}

            queues_added = []
            for builtin in BUILTIN_QUEUES:
                if builtin["name"] not in existing_names:
                    current_queues.append(builtin)
                    queues_added.append(builtin["name"])
                    logger.info("Restored missing built-in queue: %s", builtin["name"])
                else:
                    for q in current_queues:
                        if q["name"] == builtin["name"] and not q.get("built_in"):
                            q["built_in"] = True
                            logger.info(
                                "Set built_in flag for queue: %s", builtin["name"]
                            )

            builtin_names = {bq["name"] for bq in BUILTIN_QUEUES}
            needs_update = queues_added or any(
                not q.get("built_in")
                for q in current_queues
                if q["name"] in builtin_names
            )

            if needs_update:
                current["queues"] = current_queues
                success = self.update(current)
                if success and queues_added:
                    logger.info(
                        "Restored %s built-in queue(s): %s",
                        len(queues_added),
                        ", ".join(queues_added),
                    )
                return success

            logger.debug("All built-in queues present and configured correctly")
            return True
        except Exception as e:
            logger.error("Error ensuring built-in queues: %s", e)
            return False
