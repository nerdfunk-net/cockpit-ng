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

            return query.order_by(self.model.updated_at.desc()).all()
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
