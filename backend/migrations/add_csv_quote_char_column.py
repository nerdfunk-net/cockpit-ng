"""
Migration: Add csv_quote_char column to nautobot_defaults table

This migration adds the csv_quote_char column to the nautobot_defaults table
to support configurable CSV quote character for bulk device onboarding.

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
    """Add csv_quote_char column to nautobot_defaults table"""
    logger.info("Starting migration: add_csv_quote_char_column")

    session = get_db_session()

    try:
        # Check if column already exists
        logger.info("Checking if csv_quote_char column exists...")
        result = session.execute(
            text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'nautobot_defaults'
            AND column_name = 'csv_quote_char'
        """)
        )
        existing_columns = [row[0] for row in result]

        if "csv_quote_char" in existing_columns:
            logger.info("✓ Column already exists, skipping migration")
            return

        # Add csv_quote_char column
        logger.info("Adding csv_quote_char column to nautobot_defaults table...")
        session.execute(
            text("""
            ALTER TABLE nautobot_defaults
            ADD COLUMN csv_quote_char VARCHAR(10) DEFAULT '"'
        """)
        )

        session.commit()
        logger.info("✓ Successfully added csv_quote_char column")

    except Exception as e:
        session.rollback()
        logger.error(f"✗ Migration failed: {e}")
        raise
    finally:
        session.close()


def downgrade():
    """Remove csv_quote_char column from nautobot_defaults table"""
    logger.info("Starting downgrade: remove csv_quote_char column")

    session = get_db_session()

    try:
        # Check if column exists
        result = session.execute(
            text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'nautobot_defaults'
            AND column_name = 'csv_quote_char'
        """)
        )
        existing_columns = [row[0] for row in result]

        if "csv_quote_char" not in existing_columns:
            logger.info("✓ Column doesn't exist, skipping downgrade")
            return

        # Remove csv_quote_char column
        logger.info("Removing csv_quote_char column from nautobot_defaults table...")
        session.execute(
            text("""
            ALTER TABLE nautobot_defaults
            DROP COLUMN csv_quote_char
        """)
        )

        session.commit()
        logger.info("✓ Successfully removed csv_quote_char column")

    except Exception as e:
        session.rollback()
        logger.error(f"✗ Downgrade failed: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    upgrade()
