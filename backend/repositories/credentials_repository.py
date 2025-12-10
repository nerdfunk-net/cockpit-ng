"""
Credentials repository for encrypted credential storage.
"""

from typing import Optional, List
from repositories.base import BaseRepository
from core.models import Credential
from core.database import get_db_session


class CredentialsRepository(BaseRepository[Credential]):
    """Repository for Credential model operations."""

    def __init__(self):
        super().__init__(Credential)

    def get_by_name(self, name: str) -> Optional[Credential]:
        """Get credential by name."""
        db = get_db_session()
        try:
            return db.query(Credential).filter(Credential.name == name).first()
        finally:
            db.close()

    def get_active_credentials(self) -> List[Credential]:
        """Get all active credentials."""
        db = get_db_session()
        try:
            return db.query(Credential).filter(Credential.is_active).all()
        finally:
            db.close()

    def get_by_source(self, source: str) -> List[Credential]:
        """Get credentials by source (general/private)."""
        db = get_db_session()
        try:
            return db.query(Credential).filter(Credential.source == source).all()
        finally:
            db.close()

    def get_by_owner(self, owner: str) -> List[Credential]:
        """Get credentials by owner."""
        db = get_db_session()
        try:
            return db.query(Credential).filter(Credential.owner == owner).all()
        finally:
            db.close()

    def delete_by_owner(self, owner: str) -> int:
        """Delete all credentials owned by a specific user."""
        db = get_db_session()
        try:
            count = db.query(Credential).filter(Credential.owner == owner).count()
            db.query(Credential).filter(Credential.owner == owner).delete()
            db.commit()
            return count
        finally:
            db.close()

    def get_by_type(self, cred_type: str) -> List[Credential]:
        """Get credentials by type."""
        db = get_db_session()
        try:
            return db.query(Credential).filter(Credential.type == cred_type).all()
        finally:
            db.close()
