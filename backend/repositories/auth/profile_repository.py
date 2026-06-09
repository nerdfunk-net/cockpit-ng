"""Repository for user profile operations."""

from typing import Optional

from core.database import get_db_session
from core.models import UserProfile
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

    def get_by_api_key_hash(self, api_key_hash: str) -> Optional[UserProfile]:
        """Get profile by API key hash.

        Args:
            api_key_hash: sha256 hex digest of the presented API key

        Returns:
            UserProfile if found, None otherwise
        """
        db = get_db_session()
        try:
            return (
                db.query(UserProfile)
                .filter(
                    UserProfile.api_key == api_key_hash,
                    UserProfile.api_key.isnot(None),
                )
                .first()
            )
        finally:
            db.close()

    def hash_plaintext_api_keys(self) -> int:
        """One-time data migration: replace plaintext API keys with hashes.

        Idempotent — values that already look like sha256 hex digests are
        left untouched, so this is safe to run on every startup.

        Returns:
            Number of profiles whose api_key was hashed.
        """
        from core.api_keys import hash_api_key, is_api_key_hash

        db = get_db_session()
        try:
            profiles = (
                db.query(UserProfile)
                .filter(
                    UserProfile.api_key.isnot(None),
                    UserProfile.api_key != "",
                )
                .all()
            )
            migrated = 0
            for profile in profiles:
                if is_api_key_hash(profile.api_key):
                    continue
                profile.api_key = hash_api_key(profile.api_key)
                migrated += 1
            if migrated:
                db.commit()
            return migrated
        except Exception:
            db.rollback()
            raise
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
