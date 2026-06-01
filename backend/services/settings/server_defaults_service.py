"""Server defaults service (defaults stored in server_defaults)."""

from __future__ import annotations

import logging
from dataclasses import asdict
from typing import Any, Dict

from repositories.settings.settings_repository import ServerDefaultRepository
from services.settings.defaults import ServerDefaults

logger = logging.getLogger(__name__)


class ServerDefaultsService:
    def __init__(self, default: ServerDefaults) -> None:
        self._default = default

    def get(self) -> Dict[str, Any]:
        try:
            repo = ServerDefaultRepository()
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
            return asdict(self._default)
        except Exception as e:
            logger.error("Error getting server defaults: %s", e, exc_info=True)
            return asdict(self._default)

    def update(self, data: Dict[str, Any]) -> bool:
        try:
            repo = ServerDefaultRepository()
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
            logger.info("Server defaults updated successfully")
            return True
        except Exception as e:
            logger.error("Error updating server defaults: %s", e)
            return False
