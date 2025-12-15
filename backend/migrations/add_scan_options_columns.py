"""
Migration: Add scan options columns to job_templates table

This migration adds the scan_resolve_dns, scan_ping_count, scan_timeout_ms,
scan_retries, and scan_interval_ms columns to the job_templates table to
support the "Scan Prefixes" job template type.

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
    """Add scan options columns to job_templates table"""
    logger.info("Starting migration: add_scan_options_columns")

    session = get_db_session()

    try:
        # Check if columns already exist
        logger.info("Checking if columns already exist...")
        result = session.execute(
            text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'job_templates'
            AND column_name IN ('scan_resolve_dns', 'scan_ping_count', 'scan_timeout_ms', 'scan_retries', 'scan_interval_ms', 'scan_custom_field_name', 'scan_custom_field_value')
        """)
        )
        existing_columns = [row[0] for row in result]

        if (
            "scan_resolve_dns" in existing_columns
            and "scan_ping_count" in existing_columns
            and "scan_timeout_ms" in existing_columns
            and "scan_retries" in existing_columns
            and "scan_interval_ms" in existing_columns
            and "scan_custom_field_name" in existing_columns
            and "scan_custom_field_value" in existing_columns
        ):
            logger.info("✓ Columns already exist, skipping migration")
            return

        # Add scan_resolve_dns column if it doesn't exist
        if "scan_resolve_dns" not in existing_columns:
            logger.info("Adding scan_resolve_dns column...")
            session.execute(
                text("""
                ALTER TABLE job_templates
                ADD COLUMN scan_resolve_dns BOOLEAN NOT NULL DEFAULT FALSE
            """)
            )
            logger.info("✓ Added scan_resolve_dns column")

        # Add scan_ping_count column if it doesn't exist
        if "scan_ping_count" not in existing_columns:
            logger.info("Adding scan_ping_count column...")
            session.execute(
                text("""
                ALTER TABLE job_templates
                ADD COLUMN scan_ping_count INTEGER
            """)
            )
            logger.info("✓ Added scan_ping_count column")

        # Add scan_timeout_ms column if it doesn't exist
        if "scan_timeout_ms" not in existing_columns:
            logger.info("Adding scan_timeout_ms column...")
            session.execute(
                text("""
                ALTER TABLE job_templates
                ADD COLUMN scan_timeout_ms INTEGER
            """)
            )
            logger.info("✓ Added scan_timeout_ms column")

        # Add scan_retries column if it doesn't exist
        if "scan_retries" not in existing_columns:
            logger.info("Adding scan_retries column...")
            session.execute(
                text("""
                ALTER TABLE job_templates
                ADD COLUMN scan_retries INTEGER
            """)
            )
            logger.info("✓ Added scan_retries column")

        # Add scan_interval_ms column if it doesn't exist
        if "scan_interval_ms" not in existing_columns:
            logger.info("Adding scan_interval_ms column...")
            session.execute(
                text("""
                ALTER TABLE job_templates
                ADD COLUMN scan_interval_ms INTEGER
            """)
            )
            logger.info("✓ Added scan_interval_ms column")

        # Add scan_custom_field_name column if it doesn't exist
        if "scan_custom_field_name" not in existing_columns:
            logger.info("Adding scan_custom_field_name column...")
            session.execute(
                text("""
                ALTER TABLE job_templates
                ADD COLUMN scan_custom_field_name VARCHAR(255)
            """)
            )
            logger.info("✓ Added scan_custom_field_name column")

        # Add scan_custom_field_value column if it doesn't exist
        if "scan_custom_field_value" not in existing_columns:
            logger.info("Adding scan_custom_field_value column...")
            session.execute(
                text("""
                ALTER TABLE job_templates
                ADD COLUMN scan_custom_field_value VARCHAR(255)
            """)
            )
            logger.info("✓ Added scan_custom_field_value column")

        session.commit()
        logger.info("✅ Migration completed successfully")

    except Exception as e:
        session.rollback()
        logger.error(f"❌ Migration failed: {e}")
        raise
    finally:
        session.close()


def downgrade():
    """Remove scan options columns from job_templates table"""
    logger.info("Starting downgrade: remove_scan_options_columns")

    session = get_db_session()

    try:
        logger.info("Removing scan options columns...")
        session.execute(
            text("""
            ALTER TABLE job_templates
            DROP COLUMN IF EXISTS scan_resolve_dns,
            DROP COLUMN IF EXISTS scan_ping_count,
            DROP COLUMN IF EXISTS scan_timeout_ms,
            DROP COLUMN IF EXISTS scan_retries,
            DROP COLUMN IF EXISTS scan_interval_ms,
            DROP COLUMN IF EXISTS scan_custom_field_name,
            DROP COLUMN IF EXISTS scan_custom_field_value
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
