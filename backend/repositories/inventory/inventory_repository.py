"""
Inventory Repository for database operations.
Manages Ansible inventory configurations stored in PostgreSQL.
"""

from typing import List, Optional
from core.models import Inventory
from core.database import get_db_session
from repositories.base import BaseRepository


class InventoryRepository(BaseRepository[Inventory]):
    """Repository for managing Ansible inventory configurations."""

    def __init__(self):
        super().__init__(Inventory)

    def get_by_name(
        self, name: str, username: str, active_only: bool = True
    ) -> Optional[Inventory]:
        """
        Get an inventory by name accessible to a user.

        Returns global inventories or private inventories owned by the user.

        Args:
            name: Inventory name
            username: Username for access control
            active_only: Only return active inventories

        Returns:
            Inventory instance or None
        """
        db = get_db_session()
        try:
            # Find inventory by name that is either:
            # 1. Global (accessible to all users)
            # 2. Private and owned by this user
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

    def list_inventories(
        self,
        username: str,
        active_only: bool = True,
        scope: Optional[str] = None,
        group_path_filter: Optional[str] = None,
    ) -> List[Inventory]:
        """
        List inventories accessible to a user.

        Returns:
        - Global inventories (scope='global')
        - Private inventories owned by the user (scope='private' AND created_by=username)

        Args:
            username: Username to filter by
            active_only: Only return active inventories
            scope: Filter by scope ('global', 'private', or None for both)
            group_path_filter: When set, return only inventories whose group_path
                               matches exactly or is a descendant (e.g. 'net' also
                               matches 'net/dc1').

        Returns:
            List of Inventory instances
        """
        db = get_db_session()
        try:
            # Build query based on scope
            if scope == "global":
                query = db.query(self.model).filter(self.model.scope == "global")
            elif scope == "private":
                query = db.query(self.model).filter(
                    self.model.scope == "private", self.model.created_by == username
                )
            else:
                # Both global and user's private inventories
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
        Bulk-update group_path for inventories in old_path (exact match or descendants).

        Only updates global inventories or private inventories owned by username.

        Args:
            old_path: The existing group path prefix to replace
            new_path: The replacement prefix
            username: Username for private-inventory access control

        Returns:
            Number of rows updated
        """
        db = get_db_session()
        try:
            inventories = (
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
            for inv in inventories:
                if inv.group_path == old_path:
                    inv.group_path = new_path
                else:
                    inv.group_path = new_path + inv.group_path[len(old_path) :]
            db.commit()
            return len(inventories)
        finally:
            db.close()

    def search_inventories(
        self, query_text: str, username: str, active_only: bool = True
    ) -> List[Inventory]:
        """
        Search inventories by name or description.

        Args:
            query_text: Search text
            username: Username to filter accessible inventories
            active_only: Only return active inventories

        Returns:
            List of matching Inventory instances
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
        """Get count of active inventories."""
        db = get_db_session()
        try:
            return db.query(self.model).filter(self.model.is_active).count()
        finally:
            db.close()

    def get_total_count(self) -> int:
        """Get total count of all inventories."""
        db = get_db_session()
        try:
            return db.query(self.model).count()
        finally:
            db.close()

    def delete_by_name(self, name: str, username: str) -> bool:
        """
        Delete (soft delete) an inventory by name.

        Only allows deletion of inventories owned by the user.

        Args:
            name: Inventory name
            username: Username of the user requesting deletion

        Returns:
            True if deleted, False if not found or not owned by user
        """
        inventory = self.get_by_name(name, username, active_only=False)
        if inventory and inventory.created_by == username:
            return self.update(inventory.id, is_active=False) is not None
        return False
