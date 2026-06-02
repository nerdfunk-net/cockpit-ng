"""Redis device cache loader and parser for inventory queries."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from models.inventory import DeviceInfo

if TYPE_CHECKING:
    from services.settings.cache import RedisCacheService

logger = logging.getLogger(__name__)
_BULK_CACHE_KEY = "nautobot:devices:all"


class DeviceCacheLoader:
    """Loads and parses the bulk device cache from Redis."""

    def __init__(self, cache_service: Optional[RedisCacheService] = None):
        self._cache_service = cache_service
        self._devices: Optional[List[DeviceInfo]] = None
        self._custom_field_types: Optional[Dict[str, str]] = None

    def invalidate(self) -> None:
        self._devices = None
        self._custom_field_types = None

    @property
    def is_populated(self) -> bool:
        """True once the device list has been loaded (from Redis or live fallback)."""
        return self._devices is not None

    def set_devices(self, devices: List[DeviceInfo]) -> None:
        self._devices = devices

    @staticmethod
    def parse_device(raw: Dict[str, Any]) -> DeviceInfo:
        """Convert a flat cache dict (from extract_device_essentials) to DeviceInfo."""
        tags = raw.get("tags") or []
        return DeviceInfo(
            id=raw.get("id", ""),
            name=raw.get("name"),
            serial=raw.get("serial"),
            primary_ip4=raw.get("primary_ip4"),
            status=raw.get("status"),
            device_type=raw.get("device_type"),
            role=raw.get("role"),
            location=raw.get("location"),
            platform=raw.get("platform"),
            tags=tags,
            manufacturer=raw.get("manufacturer"),
        )

    async def get_all(self) -> List[DeviceInfo]:
        """Return cached device list; populate from Redis on first call.

        Returns an empty list on cache miss — callers should fall back to a
        live Nautobot query and then call set_devices() to populate this loader.
        """
        if self._devices is not None:
            return self._devices

        if self._cache_service is not None:
            try:
                raw_list = self._cache_service.get(_BULK_CACHE_KEY)
                if raw_list:
                    devices = [self.parse_device(d) for d in raw_list]
                    logger.info(
                        "Cache hit for '%s': %s devices", _BULK_CACHE_KEY, len(devices)
                    )
                    self._devices = devices
                    return devices
                logger.info(
                    "Cache miss for '%s', falling back to Nautobot API", _BULK_CACHE_KEY
                )
            except Exception as exc:
                logger.warning(
                    "Redis read failed for '%s', falling back to Nautobot API: %s",
                    _BULK_CACHE_KEY,
                    exc,
                )

        return []

    async def get_custom_field_types(self) -> Dict[str, str]:
        """Return custom field type map; cached per loader instance."""
        if self._custom_field_types is not None:
            return self._custom_field_types

        try:
            import service_factory

            nautobot_metadata_service = (
                service_factory.build_nautobot_metadata_service()
            )

            logger.info("Fetching custom field types from Nautobot")

            custom_fields = await nautobot_metadata_service.get_device_custom_fields()

            type_mapping: Dict[str, str] = {}
            for field in custom_fields:
                field_key = field.get("key")
                field_type_dict = field.get("type", {})
                field_type_value = (
                    field_type_dict.get("value")
                    if isinstance(field_type_dict, dict)
                    else None
                )

                if field_key and field_type_value:
                    type_mapping[field_key] = field_type_value
                    logger.info(
                        "Custom field '%s' has type '%s'", field_key, field_type_value
                    )

            logger.info(
                "Loaded %s custom field types: %s", len(type_mapping), type_mapping
            )

            self._custom_field_types = type_mapping
            return type_mapping

        except Exception as e:
            logger.error("Error fetching custom field types: %s", e, exc_info=True)
            return {}
