"""Profile service: named, reusable sets of Nautobot device/IP default values."""

from __future__ import annotations

import logging
from dataclasses import asdict
from typing import Any, Dict, List, Optional

from repositories.settings.profile_repository import ProfileRepository
from repositories.settings.settings_repository import (
    NetworkDefaultRepository,
    ServerDefaultRepository,
)
from services.settings.defaults import NetworkDefaults, ServerDefaults
from services.settings.exceptions import ProfileValidationError

logger = logging.getLogger(__name__)

FIELD_KEYS = (
    "location",
    "platform",
    "interface_status",
    "interface_type",
    "device_status",
    "device_type",
    "ip_address_status",
    "ip_prefix_status",
    "namespace",
    "device_role",
    "secret_group",
    "csv_delimiter",
    "csv_quote_char",
)

BUILT_IN_KEYS = {"network": "Network", "server": "Server"}


class ProfileService:
    def __init__(self) -> None:
        self._repo = ProfileRepository()

    def list(self) -> List[Dict[str, Any]]:
        return [self._to_dict(row) for row in self._repo.list_all()]

    def get(self, profile_id: int) -> Optional[Dict[str, Any]]:
        row = self._repo.get_by_id(profile_id)
        return self._to_dict(row) if row else None

    def get_by_built_in_key(self, key: str) -> Optional[Dict[str, Any]]:
        row = self._repo.get_by_built_in_key(key)
        return self._to_dict(row) if row else None

    def create(self, name: str, fields: Dict[str, Any]) -> Dict[str, Any]:
        name = (name or "").strip()
        if not name:
            raise ProfileValidationError("Profile name is required")
        if self._repo.name_exists(name):
            raise ProfileValidationError(f"A profile named '{name}' already exists")
        kwargs = {key: fields.get(key) for key in FIELD_KEYS}
        row = self._repo.create(name=name, built_in_key=None, **kwargs)
        logger.info("Profile '%s' created", name)
        return self._to_dict(row)

    def update(
        self, profile_id: int, name: Optional[str], fields: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        existing = self._repo.get_by_id(profile_id)
        if not existing:
            return None

        update_kwargs = {key: fields[key] for key in FIELD_KEYS if key in fields}

        if name is not None:
            new_name = name.strip()
            if new_name and new_name.lower() != existing.name.lower():
                if existing.built_in_key:
                    raise ProfileValidationError("Built-in profiles cannot be renamed")
                if not new_name:
                    raise ProfileValidationError("Profile name is required")
                if self._repo.name_exists(new_name, exclude_id=profile_id):
                    raise ProfileValidationError(
                        f"A profile named '{new_name}' already exists"
                    )
                update_kwargs["name"] = new_name

        row = self._repo.update(profile_id, **update_kwargs)
        logger.info("Profile %s updated", profile_id)
        return self._to_dict(row)

    def delete(self, profile_id: int) -> bool:
        existing = self._repo.get_by_id(profile_id)
        if not existing:
            return False
        if existing.built_in_key:
            raise ProfileValidationError("Built-in profiles cannot be deleted")
        deleted = self._repo.delete(profile_id)
        if deleted:
            logger.info("Profile %s deleted", profile_id)
        return deleted

    def ensure_builtin_profiles_seeded(self) -> None:
        """Idempotent startup seed: create 'Network'/'Server' rows from the
        legacy singleton tables if they don't exist yet. Safe to call on
        every startup - a no-op once both built-in rows exist."""
        for key, display_name in BUILT_IN_KEYS.items():
            if self._repo.get_by_built_in_key(key):
                continue

            if key == "network":
                legacy_row = NetworkDefaultRepository().get_defaults()
                fallback = asdict(NetworkDefaults())
            else:
                legacy_row = ServerDefaultRepository().get_defaults()
                fallback = asdict(ServerDefaults())

            values: Dict[str, Any] = {}
            for field_key in FIELD_KEYS:
                value = getattr(legacy_row, field_key, None) if legacy_row else None
                values[field_key] = value if value is not None else fallback[field_key]
            values["csv_delimiter"] = values["csv_delimiter"] or ","
            values["csv_quote_char"] = values["csv_quote_char"] or '"'

            self._repo.create(name=display_name, built_in_key=key, **values)
            logger.info("Seeded built-in '%s' profile", display_name)

    def _to_dict(self, row) -> Dict[str, Any]:
        data = {key: getattr(row, key) for key in FIELD_KEYS}
        data.update(
            id=row.id,
            name=row.name,
            built_in_key=row.built_in_key,
            is_built_in=row.built_in_key is not None,
        )
        return data
