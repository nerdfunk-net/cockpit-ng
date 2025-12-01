"""
Base repository with common CRUD operations.

This provides a generic base class that other repositories can extend.
"""

from typing import Generic, TypeVar, Type, List, Optional
from core.database import get_db_session

T = TypeVar("T")


class BaseRepository(Generic[T]):
    """Base repository with common CRUD operations."""

    def __init__(self, model: Type[T]):
        """
        Initialize repository with a SQLAlchemy model.

        Args:
            model: SQLAlchemy model class
        """
        self.model = model

    def get_by_id(self, id: int) -> Optional[T]:
        """
        Get a single record by ID.

        Args:
            id: Primary key ID

        Returns:
            Model instance or None if not found
        """
        db = get_db_session()
        try:
            return db.query(self.model).filter(self.model.id == id).first()
        finally:
            db.close()

    def get_all(self) -> List[T]:
        """
        Get all records.

        Returns:
            List of model instances
        """
        db = get_db_session()
        try:
            return db.query(self.model).all()
        finally:
            db.close()

    def create(self, **kwargs) -> T:
        """
        Create a new record.

        Args:
            **kwargs: Fields to set on the new record

        Returns:
            Created model instance
        """
        db = get_db_session()
        try:
            obj = self.model(**kwargs)
            db.add(obj)
            db.commit()
            db.refresh(obj)
            return obj
        finally:
            db.close()

    def update(self, id: int, **kwargs) -> Optional[T]:
        """
        Update an existing record.

        Args:
            id: Primary key ID
            **kwargs: Fields to update

        Returns:
            Updated model instance or None if not found
        """
        db = get_db_session()
        try:
            obj = db.query(self.model).filter(self.model.id == id).first()
            if obj:
                for key, value in kwargs.items():
                    if hasattr(obj, key):
                        setattr(obj, key, value)
                db.commit()
                db.refresh(obj)
            return obj
        finally:
            db.close()

    def delete(self, id: int) -> bool:
        """
        Delete a record by ID.

        Args:
            id: Primary key ID

        Returns:
            True if deleted, False if not found
        """
        db = get_db_session()
        try:
            obj = db.query(self.model).filter(self.model.id == id).first()
            if obj:
                db.delete(obj)
                db.commit()
                return True
            return False
        finally:
            db.close()

    def filter(self, **kwargs) -> List[T]:
        """
        Filter records by field values.

        Args:
            **kwargs: Field=value pairs to filter by

        Returns:
            List of matching model instances
        """
        db = get_db_session()
        try:
            query = db.query(self.model)
            for key, value in kwargs.items():
                if hasattr(self.model, key):
                    query = query.filter(getattr(self.model, key) == value)
            return query.all()
        finally:
            db.close()

    def count(self) -> int:
        """
        Count total records.

        Returns:
            Number of records
        """
        db = get_db_session()
        try:
            return db.query(self.model).count()
        finally:
            db.close()

    def exists(self, id: int) -> bool:
        """
        Check if a record exists.

        Args:
            id: Primary key ID

        Returns:
            True if exists, False otherwise
        """
        db = get_db_session()
        try:
            return db.query(self.model).filter(self.model.id == id).count() > 0
        finally:
            db.close()
