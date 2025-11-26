"""
Database connection and session management using SQLAlchemy with PostgreSQL.
Replaces all SQLite-based database operations.
"""

from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool
from config import settings
from typing import Generator
import logging

logger = logging.getLogger(__name__)

# Create database engine
DATABASE_URL = settings.database_url
logger.info(f"Connecting to database: postgresql://{settings.database_username}:***@{settings.database_host}:{settings.database_port}/{settings.database_name}")

engine = create_engine(
    DATABASE_URL,
    poolclass=NullPool,  # Use NullPool for simplicity, can be changed to QueuePool later
    echo=settings.debug,  # Log all SQL statements in debug mode
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
    Initialize database - create all tables.
    This should be called on application startup.
    """
    try:
        logger.info("Initializing database tables...")
        # Import all models to ensure they're registered with Base.metadata
        from core import models
        Base.metadata.create_all(bind=engine)
        # Commit the DDL changes
        engine.dispose()
        logger.info(f"Database tables initialized successfully ({len(Base.metadata.tables)} tables)")
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
