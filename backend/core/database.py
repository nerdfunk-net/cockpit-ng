"""
Database connection and session management using SQLAlchemy with PostgreSQL.
Replaces all SQLite-based database operations.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from config import settings
from typing import Generator
import logging

logger = logging.getLogger(__name__)

# Create database engine
DATABASE_URL = settings.database_url
logger.info(
    f"Connecting to database: postgresql://{settings.database_username}:***@{settings.database_host}:{settings.database_port}/{settings.database_name}"
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

        logger.info(f"Loaded {len(Base.metadata.tables)} model definitions")

        # Run automatic migrations using the migration runner
        from migrations.runner import MigrationRunner

        runner = MigrationRunner(engine, Base)
        migration_results = runner.run_migrations()

        # Log migration results
        total_changes = (
            migration_results.get("tables_created", 0)
            + migration_results.get("columns_added", 0)
            + migration_results.get("indexes_created", 0)
        )

        if total_changes > 0:
            logger.info(
                f"Database migration completed: "
                f"{migration_results['tables_created']} tables created, "
                f"{migration_results['columns_added']} columns added, "
                f"{migration_results['indexes_created']} indexes created"
            )
        else:
            logger.info("Database schema is up to date - no migrations needed")

        logger.info(
            f"Database initialized successfully ({len(Base.metadata.tables)} tables)"
        )
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
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
        logger.error(f"Database connection failed: {e}")
        return False
