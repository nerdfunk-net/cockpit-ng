"""
Migration: Add timestamp custom field columns to job_templates table

This migration adds the write_timestamp_to_custom_field and timestamp_custom_field_name
columns to the job_templates table to support writing backup timestamps to Nautobot custom fields.

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
    """Add timestamp custom field columns to job_templates table"""
    logger.info("Starting migration: add_timestamp_custom_field_columns")

    session = get_db_session()

    try:
        # Check if columns already exist
        logger.info("Checking if columns already exist...")
        result = session.execute(
            text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'job_templates'
            AND column_name IN ('write_timestamp_to_custom_field', 'timestamp_custom_field_name')
        """)
        )
        existing_columns = [row[0] for row in result]

        if (
            "write_timestamp_to_custom_field" in existing_columns
            and "timestamp_custom_field_name" in existing_columns
        ):
            logger.info("✓ Columns already exist, skipping migration")
            return

        # Add write_timestamp_to_custom_field column if it doesn't exist
        if "write_timestamp_to_custom_field" not in existing_columns:
            logger.info("Adding write_timestamp_to_custom_field column...")
            session.execute(
                text("""
                ALTER TABLE job_templates
                ADD COLUMN write_timestamp_to_custom_field BOOLEAN NOT NULL DEFAULT FALSE
            """)
            )
            logger.info("✓ Added write_timestamp_to_custom_field column")

        # Add timestamp_custom_field_name column if it doesn't exist
        if "timestamp_custom_field_name" not in existing_columns:
            logger.info("Adding timestamp_custom_field_name column...")
            session.execute(
                text("""
                ALTER TABLE job_templates
                ADD COLUMN timestamp_custom_field_name VARCHAR(255)
            """)
            )
            logger.info("✓ Added timestamp_custom_field_name column")

        session.commit()
        logger.info("✅ Migration completed successfully")

    except Exception as e:
        session.rollback()
        logger.error(f"❌ Migration failed: {e}")
        raise
    finally:
        session.close()


def downgrade():
    """Remove timestamp custom field columns from job_templates table"""
    logger.info("Starting downgrade: remove_timestamp_custom_field_columns")

    session = get_db_session()

    try:
        logger.info("Removing timestamp custom field columns...")
        session.execute(
            text("""
            ALTER TABLE job_templates
            DROP COLUMN IF EXISTS write_timestamp_to_custom_field,
            DROP COLUMN IF EXISTS timestamp_custom_field_name
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
