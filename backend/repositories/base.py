"""
Base repository with common CRUD operations.

This provides a generic base class that other repositories can extend.

Session management
------------------
Each public method opens its own short-lived session by default so existing
call-sites require no changes.  When you need multiple operations to share a
single database transaction, pass a ``db`` session obtained from
``core.database.db_transaction()`` into each call::

    from core.database import db_transaction

    with db_transaction() as db:
        obj = my_repo.get_by_id(obj_id, db=db)
        my_repo.update(obj_id, name="new", db=db)
        # Both operations share the same connection / transaction.
"""

from contextlib import contextmanager
from typing import Generic, Generator, TypeVar, Type, List, Optional
from sqlalchemy.orm import Session
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

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @contextmanager
    def _db_session(
        self, db: Optional[Session] = None
    ) -> Generator[Session, None, None]:
        """Yield *db* unchanged when provided (caller owns lifetime).

        Otherwise, open a new session and close it on exit.  This keeps every
        method to a single session-management code-path.
        """
        if db is not None:
            yield db
        else:
            session = get_db_session()
            try:
                yield session
            finally:
                session.close()

    # ------------------------------------------------------------------
    # Public CRUD methods
    # ------------------------------------------------------------------

    def get_by_id(self, id: int, db: Optional[Session] = None) -> Optional[T]:
        """
        Get a single record by ID.

        Args:
            id: Primary key ID
            db: Optional shared session (for transaction isolation)

        Returns:
            Model instance or None if not found
        """
        with self._db_session(db) as s:
            return s.query(self.model).filter(self.model.id == id).first()

    def get_all(self, db: Optional[Session] = None) -> List[T]:
        """
        Get all records.

        Args:
            db: Optional shared session (for transaction isolation)

        Returns:
            List of model instances
        """
        with self._db_session(db) as s:
            return s.query(self.model).all()

    def create(self, db: Optional[Session] = None, **kwargs) -> T:
        """
        Create a new record.

        Args:
            db: Optional shared session (for transaction isolation)
            **kwargs: Fields to set on the new record

        Returns:
            Created model instance
        """
        if db is not None:
            obj = self.model(**kwargs)
            db.add(obj)
            db.flush()  # assign PK without committing — caller commits
            db.refresh(obj)
            return obj

        # Owned session: commit immediately
        with self._db_session() as s:
            obj = self.model(**kwargs)
            s.add(obj)
            s.commit()
            s.refresh(obj)
            return obj

    def update(self, id: int, db: Optional[Session] = None, **kwargs) -> Optional[T]:
        """
        Update an existing record.

        Args:
            id: Primary key ID
            db: Optional shared session (for transaction isolation)
            **kwargs: Fields to update

        Returns:
            Updated model instance or None if not found
        """
        if db is not None:
            obj = db.query(self.model).filter(self.model.id == id).first()
            if obj:
                for key, value in kwargs.items():
                    if hasattr(obj, key):
                        setattr(obj, key, value)
                db.flush()
                db.refresh(obj)
            return obj

        with self._db_session() as s:
            obj = s.query(self.model).filter(self.model.id == id).first()
            if obj:
                for key, value in kwargs.items():
                    if hasattr(obj, key):
                        setattr(obj, key, value)
                s.commit()
                s.refresh(obj)
            return obj

    def delete(self, id: int, db: Optional[Session] = None) -> bool:
        """
        Delete a record by ID.

        Args:
            id: Primary key ID
            db: Optional shared session (for transaction isolation)

        Returns:
            True if deleted, False if not found
        """
        if db is not None:
            obj = db.query(self.model).filter(self.model.id == id).first()
            if obj:
                db.delete(obj)
                db.flush()
                return True
            return False

        with self._db_session() as s:
            obj = s.query(self.model).filter(self.model.id == id).first()
            if obj:
                s.delete(obj)
                s.commit()
                return True
            return False

    def filter(self, db: Optional[Session] = None, **kwargs) -> List[T]:
        """
        Filter records by field values.

        Args:
            db: Optional shared session (for transaction isolation)
            **kwargs: Field=value pairs to filter by

        Returns:
            List of matching model instances
        """
        with self._db_session(db) as s:
            query = s.query(self.model)
            for key, value in kwargs.items():
                if hasattr(self.model, key):
                    query = query.filter(getattr(self.model, key) == value)
            return query.all()

    def count(self, db: Optional[Session] = None) -> int:
        """
        Count total records.

        Args:
            db: Optional shared session (for transaction isolation)

        Returns:
            Number of records
        """
        with self._db_session(db) as s:
            return s.query(self.model).count()

    def exists(self, id: int, db: Optional[Session] = None) -> bool:
        """
        Check if a record exists.

        Args:
            id: Primary key ID
            db: Optional shared session (for transaction isolation)

        Returns:
            True if exists, False otherwise
        """
        with self._db_session(db) as s:
            return s.query(self.model).filter(self.model.id == id).count() > 0
