"""
Saved Server Search Repository for database operations.
Manages saved server search queries stored in PostgreSQL.
"""

from typing import List, Optional

from core.database import get_db_session
from core.models import SavedServerSearch
from repositories.base import BaseRepository


class SavedSearchRepository(BaseRepository[SavedServerSearch]):
    """Repository for managing saved server search configurations."""

    def __init__(self):
        super().__init__(SavedServerSearch)

    def get_by_name(
        self, name: str, username: str, active_only: bool = True
    ) -> Optional[SavedServerSearch]:
        """
        Get a saved search by name accessible to a user.

        Returns global searches or private searches owned by the user.

        Args:
            name: Search name
            username: Username for access control
            active_only: Only return active searches

        Returns:
            SavedServerSearch instance or None
        """
        db = get_db_session()
        try:
            query = db.query(self.model).filter(
                self.model.name == name,
                (self.model.scope == "global")
                | (
                    (self.model.scope == "private")
                    & (self.model.created_by == username)
                ),
            )

            if active_only:
                query = query.filter(self.model.is_active)

            return query.first()
        finally:
            db.close()

    def list_searches(
        self,
        username: str,
        active_only: bool = True,
        scope: Optional[str] = None,
        group_path_filter: Optional[str] = None,
    ) -> List[SavedServerSearch]:
        """
        List saved searches accessible to a user.

        Returns:
        - Global searches (scope='global')
        - Private searches owned by the user (scope='private' AND created_by=username)

        Args:
            username: Username to filter by
            active_only: Only return active searches
            scope: Filter by scope ('global', 'private', or None for both)
            group_path_filter: When set, return only searches whose group_path
                               matches exactly or is a descendant (e.g. 'net' also
                               matches 'net/dc1').

        Returns:
            List of SavedServerSearch instances
        """
        db = get_db_session()
        try:
            if scope == "global":
                query = db.query(self.model).filter(self.model.scope == "global")
            elif scope == "private":
                query = db.query(self.model).filter(
                    self.model.scope == "private", self.model.created_by == username
                )
            else:
                query = db.query(self.model).filter(
                    (self.model.scope == "global")
                    | (
                        (self.model.scope == "private")
                        & (self.model.created_by == username)
                    )
                )

            if active_only:
                query = query.filter(self.model.is_active)

            if group_path_filter is not None:
                query = query.filter(
                    (self.model.group_path == group_path_filter)
                    | (self.model.group_path.like(f"{group_path_filter}/%"))
                )

            return query.order_by(self.model.updated_at.desc()).all()
        finally:
            db.close()

    def get_distinct_group_paths(self, username: str) -> List[str]:
        """
        Return all distinct non-null group_path values accessible to a user.

        Args:
            username: Username for access control

        Returns:
            List of distinct group_path strings (unsorted, without derived ancestors)
        """
        from sqlalchemy import distinct

        db = get_db_session()
        try:
            rows = (
                db.query(distinct(self.model.group_path))
                .filter(
                    self.model.is_active,
                    self.model.group_path.isnot(None),
                    (self.model.scope == "global")
                    | (
                        (self.model.scope == "private")
                        & (self.model.created_by == username)
                    ),
                )
                .all()
            )
            return [row[0] for row in rows]
        finally:
            db.close()

    def rename_group(self, old_path: str, new_path: str, username: str) -> int:
        """
        Bulk-update group_path for saved searches in old_path (exact match or descendants).

        Only updates global searches or private searches owned by username.

        Args:
            old_path: The existing group path prefix to replace
            new_path: The replacement prefix
            username: Username for private-search access control

        Returns:
            Number of rows updated
        """
        db = get_db_session()
        try:
            searches = (
                db.query(self.model)
                .filter(
                    (self.model.group_path == old_path)
                    | self.model.group_path.like(old_path + "/%"),
                    self.model.is_active,
                    (self.model.scope == "global")
                    | (
                        (self.model.scope == "private")
                        & (self.model.created_by == username)
                    ),
                )
                .all()
            )
            for search in searches:
                if search.group_path == old_path:
                    search.group_path = new_path
                else:
                    search.group_path = new_path + search.group_path[len(old_path) :]
            db.commit()
            return len(searches)
        finally:
            db.close()

    def search_searches(
        self, query_text: str, username: str, active_only: bool = True
    ) -> List[SavedServerSearch]:
        """
        Search saved searches by name or description.

        Args:
            query_text: Search text
            username: Username to filter accessible searches
            active_only: Only return active searches

        Returns:
            List of matching SavedServerSearch instances
        """
        db = get_db_session()
        try:
            search_pattern = f"%{query_text}%"

            query = db.query(self.model).filter(
                (
                    (self.model.name.ilike(search_pattern))
                    | (self.model.description.ilike(search_pattern))
                ),
                (
                    (self.model.scope == "global")
                    | (
                        (self.model.scope == "private")
                        & (self.model.created_by == username)
                    )
                ),
            )

            if active_only:
                query = query.filter(self.model.is_active)

            return query.order_by(self.model.updated_at.desc()).all()
        finally:
            db.close()

    def get_active_count(self) -> int:
        """Get count of active saved searches."""
        db = get_db_session()
        try:
            return db.query(self.model).filter(self.model.is_active).count()
        finally:
            db.close()

    def get_total_count(self) -> int:
        """Get total count of all saved searches."""
        db = get_db_session()
        try:
            return db.query(self.model).count()
        finally:
            db.close()
