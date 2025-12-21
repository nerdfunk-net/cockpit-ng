#!/usr/bin/env python3
"""
Migration script to update git repository category from 'configs' to 'device_configs'.

Changes:
- Updates existing 'configs' category values to 'device_configs'
- Maintains compatibility with renamed category structure
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from core.database import engine


def run_migration():
    """Run the migration to update category values."""
    print("Starting git_repositories category migration...")

    with engine.connect() as conn:
        # Check if there are any repositories with old 'configs' category
        result = conn.execute(
            text("""
                SELECT COUNT(*) 
                FROM git_repositories 
                WHERE category = 'configs'
            """)
        )
        count = result.scalar()

        if count > 0:
            print(f"Found {count} repository/repositories with category 'configs'")
            print("Updating category from 'configs' to 'device_configs'...")
            
            conn.execute(
                text("""
                    UPDATE git_repositories 
                    SET category = 'device_configs' 
                    WHERE category = 'configs'
                """)
            )
            
            conn.commit()
            print(f"Successfully updated {count} repository/repositories.")
        else:
            print("No repositories found with category 'configs', skipping.")

        print("Migration completed successfully!")


if __name__ == "__main__":
    run_migration()
