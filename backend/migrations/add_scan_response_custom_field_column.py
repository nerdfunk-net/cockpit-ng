"""
Migration: Add scan_response_custom_field_name column to job_templates table

This migration adds the scan_response_custom_field_name column to the job_templates 
table to support writing scan results to a custom field in the "Scan Prefixes" job type.

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
    """Add scan_response_custom_field_name column to job_templates table"""
    logger.info("Starting migration: add_scan_response_custom_field_column")

    session = get_db_session()

    try:
        # Check if column already exists
        logger.info("Checking if column already exists...")
        result = session.execute(
            text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'job_templates'
            AND column_name = 'scan_response_custom_field_name'
        """)
        )
        existing_columns = [row[0] for row in result]

        if "scan_response_custom_field_name" in existing_columns:
            logger.info("Column scan_response_custom_field_name already exists, skipping migration")
            return

        # Add scan_response_custom_field_name column
        logger.info("Adding scan_response_custom_field_name column...")
        session.execute(
            text("""
            ALTER TABLE job_templates
            ADD COLUMN scan_response_custom_field_name VARCHAR(255)
        """)
        )

        session.commit()
        logger.info("Migration completed successfully")
        logger.info("Added column: scan_response_custom_field_name")

    except Exception as e:
        logger.error(f"Migration failed: {e}", exc_info=True)
        session.rollback()
        raise

    finally:
        session.close()


def downgrade():
    """Remove scan_response_custom_field_name column from job_templates table"""
    logger.info("Starting downgrade: remove scan_response_custom_field_column")

    session = get_db_session()

    try:
        # Check if column exists
        result = session.execute(
            text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'job_templates'
            AND column_name = 'scan_response_custom_field_name'
        """)
        )
        existing_columns = [row[0] for row in result]

        if "scan_response_custom_field_name" not in existing_columns:
            logger.info("Column scan_response_custom_field_name does not exist, skipping downgrade")
            return

        # Remove scan_response_custom_field_name column
        logger.info("Removing scan_response_custom_field_name column...")
        session.execute(
            text("""
            ALTER TABLE job_templates
            DROP COLUMN scan_response_custom_field_name
        """)
        )

        session.commit()
        logger.info("Downgrade completed successfully")

    except Exception as e:
        logger.error(f"Downgrade failed: {e}", exc_info=True)
        session.rollback()
        raise

    finally:
        session.close()


if __name__ == "__main__":
    upgrade()
