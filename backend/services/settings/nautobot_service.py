"""Nautobot settings and defaults service."""

from __future__ import annotations

import logging
from dataclasses import asdict
from typing import Any, Dict

from repositories.settings.settings_repository import (
    NautobotDefaultRepository,
    NautobotSettingRepository,
)
from services.settings.defaults import NautobotDefaults, NautobotSettings

logger = logging.getLogger(__name__)


class NautobotSettingsService:
    def __init__(
        self, default: NautobotSettings, default_nautobot_defaults: NautobotDefaults
    ) -> None:
        self._default = default
        self._default_nb_defaults = default_nautobot_defaults

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

    def get_defaults(self) -> Dict[str, Any]:
        try:
            repo = NautobotDefaultRepository()
            settings = repo.get_defaults()
            if settings:
                return {
                    "location": settings.location,
                    "platform": settings.platform,
                    "interface_status": settings.interface_status,
                    "device_status": settings.device_status,
                    "ip_address_status": settings.ip_address_status,
                    "ip_prefix_status": settings.ip_prefix_status,
                    "namespace": settings.namespace,
                    "device_role": settings.device_role,
                    "secret_group": settings.secret_group,
                    "csv_delimiter": settings.csv_delimiter or ",",
                    "csv_quote_char": settings.csv_quote_char or '"',
                }
            return asdict(self._default_nb_defaults)
        except Exception as e:
            logger.error("Error getting Nautobot defaults: %s", e, exc_info=True)
            return asdict(self._default_nb_defaults)

    def update_defaults(self, data: Dict[str, Any]) -> bool:
        try:
            repo = NautobotDefaultRepository()
            existing = repo.get_defaults()
            kwargs = {
                "location": data.get("location", ""),
                "platform": data.get("platform", ""),
                "interface_status": data.get("interface_status", ""),
                "device_status": data.get("device_status", ""),
                "ip_address_status": data.get("ip_address_status", ""),
                "ip_prefix_status": data.get("ip_prefix_status", ""),
                "namespace": data.get("namespace", ""),
                "device_role": data.get("device_role", ""),
                "secret_group": data.get("secret_group", ""),
                "csv_delimiter": data.get("csv_delimiter", ","),
                "csv_quote_char": data.get("csv_quote_char", '"'),
            }
            if existing:
                repo.update(existing.id, **kwargs)
            else:
                repo.create(**kwargs)
            logger.info("Nautobot defaults updated successfully")
            return True
        except Exception as e:
            logger.error("Error updating Nautobot defaults: %s", e)
            return False
