"""
Database connection and session management using SQLAlchemy with PostgreSQL.
Replaces all SQLite-based database operations.
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
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
        # This is required for the schema migration tool to work correctly
        from core.models import (
            # User Management
            User,
            UserProfile,
            Role,
            Permission,
            RolePermission,
            UserRole,
            UserPermission,
            # Settings
            Setting,
            SettingsMetadata,
            CacheSetting,
            CelerySetting,
            CheckMKSetting,
            GitSetting,
            NautobotSetting,
            NautobotDefault,
            DeviceOffboardingSetting,
            # Credentials & Auth
            Credential,
            LoginCredential,
            # Git
            GitRepository,
            # Jobs & Scheduling
            Job,
            JobSchedule,
            JobTemplate,
            JobRun,
            # Nautobot to CheckMK Sync
            NB2CMKSync,
            NB2CMKJob,
            NB2CMKJobResult,
            # Compliance
            ComplianceRule,
            ComplianceCheck,
            RegexPattern,
            SNMPMapping,
            # Templates
            Template,
            TemplateVersion,
            # Inventory
            Inventory,
        )

        logger.info(f"Loaded {len(Base.metadata.tables)} model definitions")
        Base.metadata.create_all(bind=engine)
        # Run migrations for existing tables
        migrate_cache_settings_table()
        migrate_job_templates_table()
        migrate_nb2cmk_job_results_table()
        migrate_git_repositories_table()
        # Commit the DDL changes
        engine.dispose()
        logger.info(
            f"Database tables initialized successfully ({len(Base.metadata.tables)} tables)"
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


def migrate_cache_settings_table():
    """
    Add new columns to cache_settings table if they don't exist.
    Called during application startup.
    """
    from sqlalchemy import text, inspect

    columns_to_add = [
        ("devices_cache_interval_minutes", "INTEGER DEFAULT 60 NOT NULL"),
        ("locations_cache_interval_minutes", "INTEGER DEFAULT 10 NOT NULL"),
        ("git_commits_cache_interval_minutes", "INTEGER DEFAULT 15 NOT NULL"),
    ]

    try:
        # Use inspector to check existing columns
        inspector = inspect(engine)

        # Check if table exists
        if "cache_settings" not in inspector.get_table_names():
            logger.debug("cache_settings table doesn't exist yet, skipping migration")
            return

        existing_columns = {
            col["name"] for col in inspector.get_columns("cache_settings")
        }

        with engine.connect() as conn:
            for column_name, column_def in columns_to_add:
                if column_name not in existing_columns:
                    logger.info(f"Adding column {column_name} to cache_settings table")
                    conn.execute(
                        text(
                            f"ALTER TABLE cache_settings ADD COLUMN {column_name} {column_def}"
                        )
                    )
                    conn.commit()
                    logger.info(f"Successfully added column {column_name}")
                else:
                    logger.debug(
                        f"Column {column_name} already exists in cache_settings"
                    )

    except Exception as e:
        logger.warning(f"Could not migrate cache_settings table: {e}")


def migrate_job_templates_table():
    """
    Add new columns to job_templates table if they don't exist.
    Called during application startup.
    """
    from sqlalchemy import text, inspect

    columns_to_add = [
        ("config_repository_id", "INTEGER"),
        ("activate_changes_after_sync", "BOOLEAN DEFAULT TRUE NOT NULL"),
    ]

    try:
        # Use inspector to check existing columns
        inspector = inspect(engine)

        # Check if table exists
        if "job_templates" not in inspector.get_table_names():
            logger.debug("job_templates table doesn't exist yet, skipping migration")
            return

        existing_columns = {
            col["name"] for col in inspector.get_columns("job_templates")
        }

        with engine.connect() as conn:
            for column_name, column_def in columns_to_add:
                if column_name not in existing_columns:
                    logger.info(f"Adding column {column_name} to job_templates table")
                    conn.execute(
                        text(
                            f"ALTER TABLE job_templates ADD COLUMN {column_name} {column_def}"
                        )
                    )
                    conn.commit()
                    logger.info(f"Successfully added column {column_name}")
                else:
                    logger.debug(
                        f"Column {column_name} already exists in job_templates"
                    )

    except Exception as e:
        logger.warning(f"Could not migrate job_templates table: {e}")


def migrate_nb2cmk_job_results_table():
    """
    Add ignored_attributes column to nb2cmk_job_results table if it doesn't exist.
    Called during application startup.
    """
    from sqlalchemy import text, inspect

    columns_to_add = [
        ("ignored_attributes", "TEXT"),
    ]

    try:
        # Use inspector to check existing columns
        inspector = inspect(engine)

        # Check if table exists
        if "nb2cmk_job_results" not in inspector.get_table_names():
            logger.debug(
                "nb2cmk_job_results table doesn't exist yet, skipping migration"
            )
            return

        existing_columns = {
            col["name"] for col in inspector.get_columns("nb2cmk_job_results")
        }

        with engine.connect() as conn:
            for column_name, column_def in columns_to_add:
                if column_name not in existing_columns:
                    logger.info(
                        f"Adding column {column_name} to nb2cmk_job_results table"
                    )
                    conn.execute(
                        text(
                            f"ALTER TABLE nb2cmk_job_results ADD COLUMN {column_name} {column_def}"
                        )
                    )
                    conn.commit()
                    logger.info(f"Successfully added column {column_name}")
                else:
                    logger.debug(
                        f"Column {column_name} already exists in nb2cmk_job_results"
                    )

    except Exception as e:
        logger.warning(f"Could not migrate nb2cmk_job_results table: {e}")


def migrate_git_repositories_table():
    """
    Add git_author_name and git_author_email columns to git_repositories table if they don't exist.
    Called during application startup.
    """
    from sqlalchemy import text, inspect

    columns_to_add = [
        ("git_author_name", "VARCHAR(255)"),
        ("git_author_email", "VARCHAR(255)"),
    ]

    try:
        # Use inspector to check existing columns
        inspector = inspect(engine)

        # Check if table exists
        if "git_repositories" not in inspector.get_table_names():
            logger.debug("git_repositories table doesn't exist yet, skipping migration")
            return

        existing_columns = {
            col["name"] for col in inspector.get_columns("git_repositories")
        }

        with engine.connect() as conn:
            for column_name, column_def in columns_to_add:
                if column_name not in existing_columns:
                    logger.info(
                        f"Adding column {column_name} to git_repositories table"
                    )
                    conn.execute(
                        text(
                            f"ALTER TABLE git_repositories ADD COLUMN {column_name} {column_def}"
                        )
                    )
                    conn.commit()
                    logger.info(f"Successfully added column {column_name}")
                else:
                    logger.debug(
                        f"Column {column_name} already exists in git_repositories"
                    )

    except Exception as e:
        logger.warning(f"Could not migrate git_repositories table: {e}")
