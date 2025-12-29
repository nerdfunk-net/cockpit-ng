"""Repository for user profile operations."""

from typing import Optional
from core.models import UserProfile
from core.database import get_db_session
from repositories.base import BaseRepository


class ProfileRepository(BaseRepository[UserProfile]):
    """Repository for managing user profiles."""

    def __init__(self):
        super().__init__(UserProfile)

    def get_by_username(self, username: str) -> Optional[UserProfile]:
        """Get profile by username.

        Args:
            username: Username to search for

        Returns:
            UserProfile if found, None otherwise
        """
        db = get_db_session()
        try:
            return (
                db.query(UserProfile).filter(UserProfile.username == username).first()
            )
        finally:
            db.close()

    def username_exists(self, username: str) -> bool:
        """Check if a profile exists for the given username.

        Args:
            username: Username to check

        Returns:
            True if profile exists, False otherwise
        """
        db = get_db_session()
        try:
            return (
                db.query(UserProfile).filter(UserProfile.username == username).count()
                > 0
            )
        finally:
            db.close()

    def delete_by_username(self, username: str) -> bool:
        """Delete profile by username.

        Args:
            username: Username whose profile to delete

        Returns:
            True if profile was deleted, False if not found
        """
        profile = self.get_by_username(username)
        if profile:
            self.delete(profile.id)
            return True
        return False
