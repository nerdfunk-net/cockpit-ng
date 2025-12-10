#!/usr/bin/env python3
"""
Migration script to update credentials table unique constraint.

Changes:
- Removes the unique constraint on 'name' column alone
- Adds a composite unique constraint on ('name', 'source')

This allows different sources (general vs private) to have credentials
with the same name.
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from core.database import engine


def run_migration():
    """Run the migration to update credentials unique constraint."""
    print("Starting credentials unique constraint migration...")

    with engine.connect() as conn:
        # Check if the old constraint exists
        result = conn.execute(
            text("""
                SELECT constraint_name 
                FROM information_schema.table_constraints 
                WHERE table_name = 'credentials' 
                AND constraint_type = 'UNIQUE'
            """)
        )
        existing_constraints = [row[0] for row in result.fetchall()]
        print(f"Existing unique constraints: {existing_constraints}")

        # Drop the old unique constraint on name if it exists
        if "credentials_name_key" in existing_constraints:
            print("Dropping old unique constraint 'credentials_name_key'...")
            conn.execute(
                text("ALTER TABLE credentials DROP CONSTRAINT credentials_name_key")
            )
            print("Old constraint dropped.")
        else:
            print("Old constraint 'credentials_name_key' not found, skipping drop.")

        # Check if new constraint already exists
        if "uq_credentials_name_source" in existing_constraints:
            print(
                "New constraint 'uq_credentials_name_source' already exists, skipping."
            )
        else:
            # Add the new composite unique constraint
            print(
                "Adding new composite unique constraint 'uq_credentials_name_source'..."
            )
            conn.execute(
                text("""
                    ALTER TABLE credentials 
                    ADD CONSTRAINT uq_credentials_name_source 
                    UNIQUE (name, source)
                """)
            )
            print("New constraint added.")

        conn.commit()
        print("Migration completed successfully!")


if __name__ == "__main__":
    run_migration()
