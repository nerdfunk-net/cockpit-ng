"""
JobSchedule Repository
Handles database operations for job schedules.
"""

from typing import Optional, List
from sqlalchemy import or_
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
