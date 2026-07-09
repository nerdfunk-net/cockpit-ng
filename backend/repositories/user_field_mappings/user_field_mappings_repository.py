"""
Repository for per-user, per-app field mapping storage.
"""

from typing import Dict, Optional

from core.database import get_db_session
from core.models import UserFieldMapping
from repositories.base import BaseRepository


class UserFieldMappingRepository(BaseRepository[UserFieldMapping]):
    """Repository for UserFieldMapping model operations."""

    def __init__(self):
        super().__init__(UserFieldMapping)

    def get_by_username_and_app(
        self, username: str, app_name: str
    ) -> Optional[UserFieldMapping]:
        """Get the saved mapping for a given user and app, if any."""
        db = get_db_session()
        try:
            return (
                db.query(UserFieldMapping)
                .filter(
                    UserFieldMapping.username == username,
                    UserFieldMapping.app_name == app_name,
                )
                .first()
            )
        finally:
            db.close()

    def upsert(
        self, username: str, app_name: str, mapping: Dict[str, Optional[str]]
    ) -> UserFieldMapping:
        """Create or replace the saved mapping for a given user and app."""
        db = get_db_session()
        try:
            record = (
                db.query(UserFieldMapping)
                .filter(
                    UserFieldMapping.username == username,
                    UserFieldMapping.app_name == app_name,
                )
                .first()
            )
            if record:
                record.mapping = mapping
            else:
                record = UserFieldMapping(
                    username=username, app_name=app_name, mapping=mapping
                )
                db.add(record)
            db.commit()
            db.refresh(record)
            return record
        finally:
            db.close()
