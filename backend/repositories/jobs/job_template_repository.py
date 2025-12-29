"""
JobTemplate Repository
Handles database operations for job templates.
"""

from typing import Optional, List
from sqlalchemy import or_
from core.models import JobTemplate
from repositories.base import BaseRepository


class JobTemplateRepository(BaseRepository[JobTemplate]):
    """Repository for job template operations"""

    def __init__(self):
        super().__init__(JobTemplate)

    def get_by_name(
        self, name: str, user_id: Optional[int] = None
    ) -> Optional[JobTemplate]:
        """Get job template by name (checks user's private + global templates)"""
        from core.database import get_db_session

        session = get_db_session()
        try:
            query = session.query(self.model).filter(self.model.name == name)

            if user_id is not None:
                query = query.filter(
                    or_(self.model.user_id == user_id, self.model.is_global)
                )

            return query.first()
        finally:
            session.close()

    def get_user_templates(
        self, user_id: int, job_type: Optional[str] = None
    ) -> List[JobTemplate]:
        """Get all job templates accessible by a user (global + their private templates)"""
        from core.database import get_db_session

        session = get_db_session()
        try:
            query = session.query(self.model).filter(
                or_(self.model.user_id == user_id, self.model.is_global)
            )

            if job_type is not None:
                query = query.filter(self.model.job_type == job_type)

            query = query.order_by(self.model.name.asc())
            return query.all()
        finally:
            session.close()

    def get_global_templates(self, job_type: Optional[str] = None) -> List[JobTemplate]:
        """Get all global job templates"""
        from core.database import get_db_session

        session = get_db_session()
        try:
            query = session.query(self.model).filter(self.model.is_global)

            if job_type is not None:
                query = query.filter(self.model.job_type == job_type)

            query = query.order_by(self.model.name.asc())
            return query.all()
        finally:
            session.close()

    def get_by_type(
        self, job_type: str, user_id: Optional[int] = None
    ) -> List[JobTemplate]:
        """Get all job templates of a specific type"""
        from core.database import get_db_session

        session = get_db_session()
        try:
            query = session.query(self.model).filter(self.model.job_type == job_type)

            if user_id is not None:
                query = query.filter(
                    or_(self.model.user_id == user_id, self.model.is_global)
                )

            query = query.order_by(self.model.name.asc())
            return query.all()
        finally:
            session.close()

    def check_name_exists(
        self, name: str, user_id: Optional[int] = None, exclude_id: Optional[int] = None
    ) -> bool:
        """Check if a template name already exists for the user's scope"""
        from core.database import get_db_session

        session = get_db_session()
        try:
            query = session.query(self.model).filter(self.model.name == name)

            if user_id is not None:
                query = query.filter(
                    or_(self.model.user_id == user_id, self.model.is_global)
                )

            if exclude_id is not None:
                query = query.filter(self.model.id != exclude_id)

            return query.first() is not None
        finally:
            session.close()
