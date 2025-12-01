"""
Compliance Repository
Handles database operations for regex patterns, login credentials, and SNMP mappings.
"""

from typing import Optional, List
from core.models import RegexPattern, LoginCredential, SNMPMapping
from .base import BaseRepository


class RegexPatternRepository(BaseRepository[RegexPattern]):
    """Repository for regex pattern operations"""

    def __init__(self):
        super().__init__(RegexPattern)

    def get_by_type(
        self, pattern_type: str, is_active: Optional[bool] = None
    ) -> List[RegexPattern]:
        """Get patterns by type (must_match or must_not_match)"""
        from core.database import get_db_session

        session = get_db_session()
        try:
            query = session.query(self.model).filter(
                self.model.pattern_type == pattern_type
            )

            if is_active is not None:
                query = query.filter(self.model.is_active == is_active)

            return query.all()
        finally:
            session.close()

    def get_active_patterns(self) -> List[RegexPattern]:
        """Get all active patterns"""
        from core.database import get_db_session

        session = get_db_session()
        try:
            return session.query(self.model).filter(self.model.is_active).all()
        finally:
            session.close()


class LoginCredentialRepository(BaseRepository[LoginCredential]):
    """Repository for login credential operations"""

    def __init__(self):
        super().__init__(LoginCredential)

    def get_by_name(self, name: str) -> Optional[LoginCredential]:
        """Get credential by name"""
        from core.database import get_db_session

        session = get_db_session()
        try:
            return session.query(self.model).filter(self.model.name == name).first()
        finally:
            session.close()

    def get_active_credentials(self) -> List[LoginCredential]:
        """Get all active credentials"""
        from core.database import get_db_session

        session = get_db_session()
        try:
            return session.query(self.model).filter(self.model.is_active).all()
        finally:
            session.close()

    def name_exists(self, name: str, exclude_id: Optional[int] = None) -> bool:
        """Check if credential name already exists"""
        from core.database import get_db_session

        session = get_db_session()
        try:
            query = session.query(self.model).filter(self.model.name == name)
            if exclude_id:
                query = query.filter(self.model.id != exclude_id)
            return session.query(query.exists()).scalar()
        finally:
            session.close()


class SNMPMappingRepository(BaseRepository[SNMPMapping]):
    """Repository for SNMP mapping operations"""

    def __init__(self):
        super().__init__(SNMPMapping)

    def get_by_name(self, name: str) -> Optional[SNMPMapping]:
        """Get SNMP mapping by name"""
        from core.database import get_db_session

        session = get_db_session()
        try:
            return session.query(self.model).filter(self.model.name == name).first()
        finally:
            session.close()

    def get_by_version(
        self, version: str, is_active: Optional[bool] = None
    ) -> List[SNMPMapping]:
        """Get SNMP mappings by version (v1, v2c, v3)"""
        from core.database import get_db_session

        session = get_db_session()
        try:
            query = session.query(self.model).filter(self.model.snmp_version == version)

            if is_active is not None:
                query = query.filter(self.model.is_active == is_active)

            return query.all()
        finally:
            session.close()

    def get_active_mappings(self) -> List[SNMPMapping]:
        """Get all active SNMP mappings"""
        from core.database import get_db_session

        session = get_db_session()
        try:
            return session.query(self.model).filter(self.model.is_active).all()
        finally:
            session.close()

    def name_exists(self, name: str, exclude_id: Optional[int] = None) -> bool:
        """Check if mapping name already exists"""
        from core.database import get_db_session

        session = get_db_session()
        try:
            query = session.query(self.model).filter(self.model.name == name)
            if exclude_id:
                query = query.filter(self.model.id != exclude_id)
            return session.query(query.exists()).scalar()
        finally:
            session.close()
