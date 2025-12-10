"""
Migration: Add backup path columns to job_templates table

This migration adds the backup_running_config_path and backup_startup_config_path
columns to the job_templates table to support templated backup paths.

Run this migration once to update existing databases.
"""

import logging
import sys
from pathlib import Path

# Add parent directory to path to import core modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.database import get_db_session
from sqlalchemy import text

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def upgrade():
    """Add backup path columns to job_templates table"""
    logger.info("Starting migration: add_backup_path_columns")

    session = get_db_session()

    try:
        # Check if columns already exist
        logger.info("Checking if columns already exist...")
        result = session.execute(
            text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'job_templates'
            AND column_name IN ('backup_running_config_path', 'backup_startup_config_path')
        """)
        )
        existing_columns = [row[0] for row in result]

        if (
            "backup_running_config_path" in existing_columns
            and "backup_startup_config_path" in existing_columns
        ):
            logger.info("✓ Columns already exist, skipping migration")
            return

        # Add backup_running_config_path column if it doesn't exist
        if "backup_running_config_path" not in existing_columns:
            logger.info("Adding backup_running_config_path column...")
            session.execute(
                text("""
                ALTER TABLE job_templates
                ADD COLUMN backup_running_config_path VARCHAR(500)
            """)
            )
            logger.info("✓ Added backup_running_config_path column")

        # Add backup_startup_config_path column if it doesn't exist
        if "backup_startup_config_path" not in existing_columns:
            logger.info("Adding backup_startup_config_path column...")
            session.execute(
                text("""
                ALTER TABLE job_templates
                ADD COLUMN backup_startup_config_path VARCHAR(500)
            """)
            )
            logger.info("✓ Added backup_startup_config_path column")

        session.commit()
        logger.info("✅ Migration completed successfully")

    except Exception as e:
        session.rollback()
        logger.error(f"❌ Migration failed: {e}")
        raise
    finally:
        session.close()


def downgrade():
    """Remove backup path columns from job_templates table"""
    logger.info("Starting downgrade: remove_backup_path_columns")

    session = get_db_session()

    try:
        logger.info("Removing backup path columns...")
        session.execute(
            text("""
            ALTER TABLE job_templates
            DROP COLUMN IF EXISTS backup_running_config_path,
            DROP COLUMN IF EXISTS backup_startup_config_path
        """)
        )
        session.commit()
        logger.info("✅ Downgrade completed successfully")

    except Exception as e:
        session.rollback()
        logger.error(f"❌ Downgrade failed: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        downgrade()
    else:
        upgrade()
