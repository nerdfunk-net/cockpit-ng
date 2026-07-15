"""Network defaults service (device/IP creation defaults).

Backed by the 'network' built-in row in the `profiles` table rather than the
legacy `network_defaults` singleton table. Public method signatures are kept
identical to before this change so callers (SettingsManager, the legacy
`/api/settings/network/defaults` router, and Celery tasks) require no
changes.
"""

from __future__ import annotations

import logging
from dataclasses import asdict
from typing import Any, Dict

from repositories.settings.profile_repository import ProfileRepository
from services.settings.defaults import NetworkDefaults

logger = logging.getLogger(__name__)

BUILT_IN_KEY = "network"
BUILT_IN_NAME = "Network"


class NetworkDefaultsService:
    def __init__(self, default: NetworkDefaults) -> None:
        self._default = default
        self._profile_repo = ProfileRepository()

    def get(self) -> Dict[str, Any]:
        try:
            profile = self._profile_repo.get_by_built_in_key(BUILT_IN_KEY)
            if profile:
                return {
                    "location": profile.location,
                    "platform": profile.platform,
                    "interface_status": profile.interface_status,
                    "interface_type": profile.interface_type,
                    "device_status": profile.device_status,
                    "device_type": profile.device_type,
                    "ip_address_status": profile.ip_address_status,
                    "ip_prefix_status": profile.ip_prefix_status,
                    "namespace": profile.namespace,
                    "device_role": profile.device_role,
                    "secret_group": profile.secret_group,
                    "csv_delimiter": profile.csv_delimiter or ",",
                    "csv_quote_char": profile.csv_quote_char or '"',
                }
            return asdict(self._default)
        except Exception as e:
            logger.error("Error getting network defaults: %s", e, exc_info=True)
            return asdict(self._default)

    def update(self, data: Dict[str, Any]) -> bool:
        try:
            existing = self._profile_repo.get_by_built_in_key(BUILT_IN_KEY)
            kwargs = {
                "location": data.get("location", ""),
                "platform": data.get("platform", ""),
                "interface_status": data.get("interface_status", ""),
                "interface_type": data.get("interface_type", ""),
                "device_status": data.get("device_status", ""),
                "device_type": data.get("device_type", ""),
                "ip_address_status": data.get("ip_address_status", ""),
                "ip_prefix_status": data.get("ip_prefix_status", ""),
                "namespace": data.get("namespace", ""),
                "device_role": data.get("device_role", ""),
                "secret_group": data.get("secret_group", ""),
                "csv_delimiter": data.get("csv_delimiter", ","),
                "csv_quote_char": data.get("csv_quote_char", '"'),
            }
            if existing:
                self._profile_repo.update(existing.id, **kwargs)
            else:
                # Defensive fallback - should not normally happen once the
                # startup seed has run.
                self._profile_repo.create(
                    name=BUILT_IN_NAME, built_in_key=BUILT_IN_KEY, **kwargs
                )
            logger.info("Network defaults updated successfully")
            return True
        except Exception as e:
            logger.error("Error updating network defaults: %s", e)
            return False
