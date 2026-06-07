"""
Database connection and session management using SQLAlchemy with PostgreSQL.
Replaces all SQLite-based database operations.
"""

import logging
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from config import settings

logger = logging.getLogger(__name__)

# Create database engine
DATABASE_URL = settings.database_url
logger.info(
    "Connecting to database: postgresql://%s:***@%s:%s/%s",
    settings.database_username,
    settings.database_host,
    settings.database_port,
    settings.database_name,
)

engine = create_engine(
    DATABASE_URL,
    pool_size=5,  # Number of persistent connections in the pool
    max_overflow=10,  # Additional connections when pool is exhausted
    pool_pre_ping=True,  # Verify connections are alive before use
    pool_recycle=3600,  # Recycle connections after 1 hour
    echo=False,  # SQL logging disabled (use LOG_LEVEL for application logging)
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for all models
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    Get database session.
    Use as a dependency in FastAPI routes or context manager.

    Example:
        with get_db() as db:
            db.query(User).all()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_db_session() -> Session:
    """
    Get database session for direct use (not as generator).
    Remember to close the session after use!

    Example:
        db = get_db_session()
        try:
            users = db.query(User).all()
        finally:
            db.close()
    """
    return SessionLocal()


@contextmanager
def db_transaction() -> Generator[Session, None, None]:
    """
    Context manager for multi-step database transactions.

    Opens a single session shared across all operations inside the block,
    commits on exit, and rolls back on exception.

    Use this in service-layer code when you need multiple repository calls
    to participate in the same transaction::

        from core.database import db_transaction

        with db_transaction() as db:
            user = user_repo.get_by_id(user_id, db=db)
            profile = profile_repo.get_by_username(username, db=db)
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db():
    """
    Initialize database - create all tables and run automatic migrations.
    This should be called on application startup.
    """
    try:
        logger.info("Initializing database tables...")

        # Import all models to ensure they're registered with Base.metadata
        # This is required for the migration system to work correctly
        from core import models  # noqa: F401

        logger.info("Loaded %s model definitions", len(Base.metadata.tables))

        # Auto-sync schema: create missing tables, columns, and indexes.
        from config import settings
        from migrations.auto_schema import AutoSchemaMigration

        auto = AutoSchemaMigration(engine, Base)
        migration_results = auto.run()

        total_changes = (
            migration_results.get("tables_created", 0)
            + migration_results.get("columns_added", 0)
            + migration_results.get("indexes_created", 0)
        )

        if total_changes > 0:
            logger.info(
                "Schema sync: %s table(s) created, %s column(s) added, %s index(es) created",
                migration_results["tables_created"],
                migration_results["columns_added"],
                migration_results["indexes_created"],
            )
        else:
            logger.info("Database schema is up to date")

        # Optionally apply safe column type changes (e.g. VARCHAR widening).
        # Only when APPLY_SAFE_DATABASE_MIGRATION=true in .env — defaults to false.
        if settings.apply_safe_migrations and not settings.apply_risky_migrations:
            from core.schema_manager import SchemaManager

            logger.info(
                "APPLY_SAFE_DATABASE_MIGRATION=true — applying safe column type changes"
            )
            manager = SchemaManager()
            safe_result = manager.perform_migration(force=False)
            applied = safe_result.get("column_changes_applied", [])
            if applied:
                for change in applied:
                    logger.info("Safe column change applied: %s", change)
            skipped = safe_result.get("column_changes_skipped", [])
            if skipped:
                logger.warning(
                    "Risky column changes skipped (set APPLY_RISKY_DATABASE_MIGRATION=true to apply): %s",
                    skipped,
                )
            errors = safe_result.get("errors", [])
            for err in errors:
                logger.error("Safe migration error: %s", err)

        # Optionally apply risky column changes (type casts, NOT NULL additions).
        # Only when APPLY_RISKY_DATABASE_MIGRATION=true in .env — defaults to false.
        if settings.apply_risky_migrations:
            from core.schema_manager import SchemaManager

            logger.warning(
                "APPLY_RISKY_DATABASE_MIGRATION=true — applying risky column changes"
            )
            manager = SchemaManager()
            risky_result = manager.perform_migration(force=True)
            applied = risky_result.get("column_changes_applied", [])
            if applied:
                for change in applied:
                    logger.info("Risky change applied: %s", change)
            errors = risky_result.get("errors", [])
            for err in errors:
                logger.error("Risky migration error: %s", err)

        logger.info(
            "Database initialized successfully (%s tables)", len(Base.metadata.tables)
        )
    except Exception as e:
        logger.error("Error initializing database: %s", e)
        raise


def drop_all_tables():
    """
    Drop all tables - USE WITH CAUTION!
    This is primarily for development/testing.
    """
    logger.warning("Dropping all database tables...")
    Base.metadata.drop_all(bind=engine)
    logger.info("All tables dropped")


def check_connection():
    """
    Check if database connection is working.
    Returns True if connection successful, False otherwise.
    """
    try:
        from sqlalchemy import text

        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Database connection successful")
        return True
    except Exception as e:
        logger.error("Database connection failed: %s", e)
        return False
