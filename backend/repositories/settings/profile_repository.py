"""
Profile Repository
Handles database operations for named default-value profiles.
"""

from typing import List, Optional

from sqlalchemy import func

from core.database import get_db_session
from core.models import Profile
from repositories.base import BaseRepository


class ProfileRepository(BaseRepository[Profile]):
    """Repository for profile operations"""

    def __init__(self):
        super().__init__(Profile)

    def get_by_name(self, name: str) -> Optional[Profile]:
        """Get profile by name (case-insensitive)"""
        session = get_db_session()
        try:
            return (
                session.query(self.model)
                .filter(func.lower(self.model.name) == name.lower())
                .first()
            )
        finally:
            session.close()

    def get_by_built_in_key(self, key: str) -> Optional[Profile]:
        """Get the built-in profile for the given key ('network' or 'server')"""
        session = get_db_session()
        try:
            return (
                session.query(self.model).filter(self.model.built_in_key == key).first()
            )
        finally:
            session.close()

    def name_exists(self, name: str, exclude_id: Optional[int] = None) -> bool:
        """Check if profile name already exists (case-insensitive)"""
        session = get_db_session()
        try:
            query = session.query(self.model).filter(
                func.lower(self.model.name) == name.lower()
            )
            if exclude_id:
                query = query.filter(self.model.id != exclude_id)
            return session.query(query.exists()).scalar()
        finally:
            session.close()

    def list_all(self) -> List[Profile]:
        """Get all profiles, ordered by name"""
        session = get_db_session()
        try:
            return session.query(self.model).order_by(self.model.name).all()
        finally:
            session.close()
