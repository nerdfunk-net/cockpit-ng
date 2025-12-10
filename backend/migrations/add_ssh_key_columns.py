"""
Migration: Add SSH key columns to credentials table

This migration adds the ssh_key_encrypted and ssh_passphrase_encrypted
columns to the credentials table to support SSH key credential type.

It also makes the password_encrypted column nullable to support ssh_key
credentials that don't have a password.

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
    """Add SSH key columns to credentials table"""
    logger.info("Starting migration: add_ssh_key_columns")

    session = get_db_session()

    try:
        # Check if columns already exist
        logger.info("Checking if columns already exist...")
        result = session.execute(
            text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'credentials'
            AND column_name IN ('ssh_key_encrypted', 'ssh_passphrase_encrypted')
        """)
        )
        existing_columns = [row[0] for row in result]

        if (
            "ssh_key_encrypted" in existing_columns
            and "ssh_passphrase_encrypted" in existing_columns
        ):
            logger.info("✓ Columns already exist, skipping migration")
            return

        # Add ssh_key_encrypted column if it doesn't exist
        if "ssh_key_encrypted" not in existing_columns:
            logger.info("Adding ssh_key_encrypted column...")
            session.execute(
                text("""
                ALTER TABLE credentials
                ADD COLUMN ssh_key_encrypted BYTEA
            """)
            )
            logger.info("✓ Added ssh_key_encrypted column")

        # Add ssh_passphrase_encrypted column if it doesn't exist
        if "ssh_passphrase_encrypted" not in existing_columns:
            logger.info("Adding ssh_passphrase_encrypted column...")
            session.execute(
                text("""
                ALTER TABLE credentials
                ADD COLUMN ssh_passphrase_encrypted BYTEA
            """)
            )
            logger.info("✓ Added ssh_passphrase_encrypted column")

        # Make password_encrypted nullable (if not already)
        logger.info("Making password_encrypted column nullable...")
        session.execute(
            text("""
            ALTER TABLE credentials
            ALTER COLUMN password_encrypted DROP NOT NULL
        """)
        )
        logger.info("✓ Made password_encrypted column nullable")

        session.commit()
        logger.info("✅ Migration completed successfully")

    except Exception as e:
        session.rollback()
        logger.error(f"❌ Migration failed: {e}")
        raise
    finally:
        session.close()


def downgrade():
    """Remove SSH key columns from credentials table"""
    logger.info("Starting downgrade: remove_ssh_key_columns")

    session = get_db_session()

    try:
        logger.info("Dropping ssh_key_encrypted column...")
        session.execute(
            text("""
            ALTER TABLE credentials
            DROP COLUMN IF EXISTS ssh_key_encrypted
        """)
        )

        logger.info("Dropping ssh_passphrase_encrypted column...")
        session.execute(
            text("""
            ALTER TABLE credentials
            DROP COLUMN IF EXISTS ssh_passphrase_encrypted
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
    import argparse

    parser = argparse.ArgumentParser(description="SSH key columns migration")
    parser.add_argument(
        "--downgrade", action="store_true", help="Downgrade (remove columns)"
    )
    args = parser.parse_args()

    if args.downgrade:
        downgrade()
    else:
        upgrade()
