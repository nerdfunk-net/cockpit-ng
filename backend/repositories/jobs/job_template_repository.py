"""
JobTemplate Repository
Handles database operations for job templates.
"""

from typing import List, Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

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

    def get_by_created_by(
        self, created_by: str, db: Optional[Session] = None
    ) -> List[JobTemplate]:
        """All templates (global or private) recorded as created by this
        username. Used to preview/reassign a departing user's global
        templates — `created_by` is always populated (unlike `user_id`,
        which is nulled for global templates), so this is the reliable
        way to find "templates this user created" regardless of the
        template's current `is_global` value."""
        with self._db_session(db) as session:
            return (
                session.query(self.model)
                .filter(self.model.created_by == created_by)
                .order_by(self.model.name.asc())
                .all()
            )

    def reassign_global_by_created_by(
        self,
        old_created_by: str,
        new_created_by: str,
        db: Optional[Session] = None,
    ) -> int:
        """Bulk-reassign this user's global templates to a new creator.
        Only touches rows where is_global is True — private templates are
        handled by delete_by_user_id instead. Returns the number of rows
        updated."""
        with self._db_session(db) as session:
            count = (
                session.query(self.model)
                .filter(
                    self.model.created_by == old_created_by,
                    self.model.is_global.is_(True),
                )
                .update({"created_by": new_created_by}, synchronize_session=False)
            )
            if db is None:
                session.commit()
            return count

    def delete_by_user_id(
        self, user_id: int, db: Optional[Session] = None
    ) -> List[int]:
        """Hard-delete all private templates owned by user_id. Uses
        per-object session.delete() (not a bulk query.delete()) so the
        JobTemplate -> JobSchedule cascade (see
        core/models/jobs.py JobSchedule.template backref,
        cascade="all, delete-orphan") actually fires for any schedules
        still pointing at these templates. Returns the deleted template
        ids."""
        with self._db_session(db) as session:
            templates = (
                session.query(self.model)
                .filter(
                    self.model.user_id == user_id,
                    self.model.is_global.is_(False),
                )
                .all()
            )
            ids = [t.id for t in templates]
            for template in templates:
                session.delete(template)
            if db is None:
                session.commit()
            return ids
