"""
Per-user, per-app field mapping business logic.
"""

from __future__ import annotations

from typing import Dict, Optional

from repositories.user_field_mappings.user_field_mappings_repository import (
    UserFieldMappingRepository,
)


class UserFieldMappingService:
    def __init__(self) -> None:
        self._repo = UserFieldMappingRepository()

    def get_mapping(
        self, username: str, app_name: str
    ) -> Optional[Dict[str, Optional[str]]]:
        """Return the saved mapping for this user and app, or None if unset."""
        record = self._repo.get_by_username_and_app(username, app_name)
        return record.mapping if record else None

    def save_mapping(
        self, username: str, app_name: str, mapping: Dict[str, Optional[str]]
    ) -> Dict[str, Optional[str]]:
        """Create or overwrite the saved mapping for this user and app."""
        record = self._repo.upsert(username, app_name, mapping)
        return record.mapping
