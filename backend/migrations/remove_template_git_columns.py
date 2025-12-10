"""
Migration: Remove unused git columns from templates table

This migration removes the git_repo_url, git_branch, git_username, git_token,
git_path, and git_verify_ssl columns from the templates table as they are no
longer used. Templates now use the git_repositories table for git configuration.

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

# Columns to remove
COLUMNS_TO_REMOVE = [
    "git_repo_url",
    "git_branch",
    "git_username",
    "git_token",
    "git_path",
    "git_verify_ssl",
]


def upgrade():
    """Remove git columns from templates table"""
    logger.info("Starting migration: remove_template_git_columns")

    session = get_db_session()

    try:
        # Check which columns exist
        logger.info("Checking for columns to remove...")
        result = session.execute(
            text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'templates'
            AND column_name = ANY(:columns)
        """),
            {"columns": COLUMNS_TO_REMOVE},
        )
        existing_columns = [row[0] for row in result]

        if not existing_columns:
            logger.info("✓ No columns to remove, skipping migration")
            return

        logger.info(f"Found columns to remove: {existing_columns}")

        # Remove each column
        for column in existing_columns:
            logger.info(f"Removing column: {column}")
            session.execute(
                text(f"ALTER TABLE templates DROP COLUMN IF EXISTS {column}")
            )
            logger.info(f"✓ Removed column: {column}")

        session.commit()
        logger.info("✓ Migration completed successfully")

    except Exception as e:
        session.rollback()
        logger.error(f"✗ Migration failed: {e}")
        raise
    finally:
        session.close()


def downgrade():
    """Re-add git columns to templates table (rollback)"""
    logger.info("Starting rollback: remove_template_git_columns")

    session = get_db_session()

    try:
        # Add columns back
        columns_to_add = [
            ("git_repo_url", "TEXT"),
            ("git_branch", "VARCHAR(255) DEFAULT 'main'"),
            ("git_username", "VARCHAR(255)"),
            ("git_token", "TEXT"),
            ("git_path", "TEXT"),
            ("git_verify_ssl", "BOOLEAN DEFAULT TRUE NOT NULL"),
        ]

        for column_name, column_type in columns_to_add:
            logger.info(f"Adding column: {column_name}")
            session.execute(
                text(
                    f"ALTER TABLE templates ADD COLUMN IF NOT EXISTS {column_name} {column_type}"
                )
            )
            logger.info(f"✓ Added column: {column_name}")

        session.commit()
        logger.info("✓ Rollback completed successfully")

    except Exception as e:
        session.rollback()
        logger.error(f"✗ Rollback failed: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Remove unused git columns from templates table"
    )
    parser.add_argument(
        "--rollback", action="store_true", help="Rollback the migration"
    )
    args = parser.parse_args()

    if args.rollback:
        downgrade()
    else:
        upgrade()
