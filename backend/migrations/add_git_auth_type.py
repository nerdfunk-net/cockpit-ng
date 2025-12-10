#!/usr/bin/env python3
"""
Migration script to add auth_type column to git_repositories table.

Changes:
- Adds 'auth_type' column with default value 'token'
- Supports values: 'token', 'ssh_key', 'none'
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from core.database import engine


def run_migration():
    """Run the migration to add auth_type column."""
    print("Starting git_repositories auth_type migration...")

    with engine.connect() as conn:
        # Check if column already exists
        result = conn.execute(
            text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'git_repositories' 
                AND column_name = 'auth_type'
            """)
        )
        existing_columns = [row[0] for row in result.fetchall()]

        if "auth_type" in existing_columns:
            print("Column 'auth_type' already exists, skipping.")
        else:
            print("Adding 'auth_type' column to git_repositories table...")
            conn.execute(
                text("""
                    ALTER TABLE git_repositories 
                    ADD COLUMN auth_type VARCHAR(50) NOT NULL DEFAULT 'token'
                """)
            )
            print("Column 'auth_type' added successfully.")

            # Update existing rows: if no credential_name, set auth_type to 'none'
            print("Updating existing rows with no credentials to auth_type='none'...")
            conn.execute(
                text("""
                    UPDATE git_repositories 
                    SET auth_type = 'none' 
                    WHERE credential_name IS NULL OR credential_name = ''
                """)
            )
            print("Existing rows updated.")

        conn.commit()
        print("Migration completed successfully!")


if __name__ == "__main__":
    run_migration()
