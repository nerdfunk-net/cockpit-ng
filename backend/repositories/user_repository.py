"""
User repository for user-specific database operations.
"""

from typing import Optional, List
from sqlalchemy import or_
from repositories.base import BaseRepository
from core.models import User
from core.database import get_db_session


class UserRepository(BaseRepository[User]):
    """Repository for User model operations."""

    def __init__(self):
        super().__init__(User)

    def get_by_username(self, username: str) -> Optional[User]:
        """
        Get a user by username.

        Args:
            username: Username to search for

        Returns:
            User instance or None if not found
        """
        db = get_db_session()
        try:
            return db.query(User).filter(User.username == username).first()
        finally:
            db.close()

    def get_by_email(self, email: str) -> Optional[User]:
        """
        Get a user by email.

        Args:
            email: Email to search for

        Returns:
            User instance or None if not found
        """
        db = get_db_session()
        try:
            return db.query(User).filter(User.email == email).first()
        finally:
            db.close()

    def get_by_username_or_email(self, identifier: str) -> Optional[User]:
        """
        Get a user by username or email.

        Args:
            identifier: Username or email to search for

        Returns:
            User instance or None if not found
        """
        db = get_db_session()
        try:
            return (
                db.query(User)
                .filter(or_(User.username == identifier, User.email == identifier))
                .first()
            )
        finally:
            db.close()

    def get_active_users(self) -> List[User]:
        """
        Get all active users.

        Returns:
            List of active User instances
        """
        db = get_db_session()
        try:
            return db.query(User).filter(User.is_active).all()
        finally:
            db.close()

    def username_exists(self, username: str) -> bool:
        """
        Check if a username exists.

        Args:
            username: Username to check

        Returns:
            True if exists, False otherwise
        """
        db = get_db_session()
        try:
            return db.query(User).filter(User.username == username).count() > 0
        finally:
            db.close()

    def email_exists(self, email: str) -> bool:
        """
        Check if an email exists.

        Args:
            email: Email to check

        Returns:
            True if exists, False otherwise
        """
        db = get_db_session()
        try:
            return db.query(User).filter(User.email == email).count() > 0
        finally:
            db.close()

    def update_password(self, user_id: int, hashed_password: str) -> bool:
        """
        Update a user's password.

        Args:
            user_id: User ID
            hashed_password: New hashed password

        Returns:
            True if updated, False if user not found
        """
        db = get_db_session()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                user.password = hashed_password
                db.commit()
                return True
            return False
        finally:
            db.close()

    def set_active_status(self, user_id: int, is_active: bool) -> bool:
        """
        Set a user's active status.

        Args:
            user_id: User ID
            is_active: New active status

        Returns:
            True if updated, False if user not found
        """
        db = get_db_session()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                user.is_active = is_active
                db.commit()
                return True
            return False
        finally:
            db.close()

    def search_users(self, query: str) -> List[User]:
        """
        Search users by username, email, or real name.

        Args:
            query: Search query

        Returns:
            List of matching User instances
        """
        db = get_db_session()
        try:
            search_pattern = f"%{query}%"
            return (
                db.query(User)
                .filter(
                    or_(
                        User.username.ilike(search_pattern),
                        User.email.ilike(search_pattern),
                        User.realname.ilike(search_pattern),
                    )
                )
                .all()
            )
        finally:
            db.close()
