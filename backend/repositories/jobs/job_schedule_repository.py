"""
JobSchedule Repository
Handles database operations for job schedules.
"""

from typing import List, Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from core.models import JobSchedule
from repositories.base import BaseRepository


class JobScheduleRepository(BaseRepository[JobSchedule]):
    """Repository for job schedule operations"""

    def __init__(self):
        super().__init__(JobSchedule)

    def get_by_identifier(self, job_identifier: str) -> Optional[JobSchedule]:
        """Get job schedule by job identifier"""
        from core.database import get_db_session

        session = get_db_session()
        try:
            return (
                session.query(self.model)
                .filter(self.model.job_identifier == job_identifier)
                .first()
            )
        finally:
            session.close()

    def get_user_schedules(
        self, user_id: int, is_active: Optional[bool] = None
    ) -> List[JobSchedule]:
        """Get all job schedules accessible by a user (global + their private jobs)"""
        from core.database import get_db_session

        session = get_db_session()
        try:
            query = session.query(self.model).filter(
                or_(self.model.user_id == user_id, self.model.is_global)
            )

            if is_active is not None:
                query = query.filter(self.model.is_active == is_active)

            query = query.order_by(self.model.created_at.desc())
            return query.all()
        finally:
            session.close()

    def get_global_schedules(
        self, is_active: Optional[bool] = None
    ) -> List[JobSchedule]:
        """Get all global job schedules"""
        from core.database import get_db_session

        session = get_db_session()
        try:
            query = session.query(self.model).filter(self.model.is_global)

            if is_active is not None:
                query = query.filter(self.model.is_active == is_active)

            query = query.order_by(self.model.created_at.desc())
            return query.all()
        finally:
            session.close()

    def get_by_owner(
        self, user_id: int, db: Optional[Session] = None
    ) -> List[JobSchedule]:
        """All schedules (global or private) recorded as created by this
        user_id — a strict `user_id == X` match with no `OR is_global`
        widening, unlike get_user_schedules/get_with_filters which are
        for "accessible to X", not "created by X"."""
        with self._db_session(db) as session:
            return (
                session.query(self.model)
                .filter(self.model.user_id == user_id)
                .order_by(self.model.created_at.desc())
                .all()
            )

    def reassign_global_by_owner(
        self, old_user_id: int, new_user_id: int, db: Optional[Session] = None
    ) -> int:
        """Bulk-reassign this user's global schedules to a new owner.
        Only touches rows where is_global is True — private schedules are
        handled by delete_by_user_id instead. Returns rows updated."""
        with self._db_session(db) as session:
            count = (
                session.query(self.model)
                .filter(
                    self.model.user_id == old_user_id,
                    self.model.is_global.is_(True),
                )
                .update({"user_id": new_user_id}, synchronize_session=False)
            )
            if db is None:
                session.commit()
            return count

    def delete_by_user_id(
        self, user_id: int, db: Optional[Session] = None
    ) -> List[int]:
        """Hard-delete all private schedules owned by user_id. Returns the
        deleted schedule ids."""
        with self._db_session(db) as session:
            schedules = (
                session.query(self.model)
                .filter(
                    self.model.user_id == user_id,
                    self.model.is_global.is_(False),
                )
                .all()
            )
            ids = [s.id for s in schedules]
            for schedule in schedules:
                session.delete(schedule)
            if db is None:
                session.commit()
            return ids

    def get_by_template_ids(
        self, template_ids: List[int], db: Optional[Session] = None
    ) -> List[JobSchedule]:
        """All schedules referencing any of the given template ids,
        regardless of owner. Used to detect the cross-owner cascade risk
        described in core/models/jobs.py JobSchedule.template's
        cascade="all, delete-orphan" before a user's private templates
        are deleted."""
        if not template_ids:
            return []
        with self._db_session(db) as session:
            return (
                session.query(self.model)
                .filter(self.model.job_template_id.in_(template_ids))
                .all()
            )

    def get_active_schedules(self) -> List[JobSchedule]:
        """Get all active job schedules"""
        from core.database import get_db_session

        session = get_db_session()
        try:
            return (
                session.query(self.model)
                .filter(self.model.is_active)
                .order_by(self.model.created_at.desc())
                .all()
            )
        finally:
            session.close()

    def get_with_filters(
        self,
        user_id: Optional[int] = None,
        is_global: Optional[bool] = None,
        is_active: Optional[bool] = None,
    ) -> List[JobSchedule]:
        """Get job schedules with optional filters"""
        from core.database import get_db_session

        session = get_db_session()
        try:
            query = session.query(self.model)

            if user_id is not None:
                query = query.filter(
                    or_(self.model.user_id == user_id, self.model.is_global)
                )

            if is_global is not None:
                query = query.filter(self.model.is_global == is_global)

            if is_active is not None:
                query = query.filter(self.model.is_active == is_active)

            query = query.order_by(self.model.created_at.desc())
            return query.all()
        finally:
            session.close()
