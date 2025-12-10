"""
Migration script to add pre_run_command column to templates table.

This script adds a new column to store a command that should be executed on the device
before rendering the template. The output of this command is parsed with TextFSM
and made available as template context.

Usage:
    python migrations/add_pre_run_command_to_templates.py
"""

import sys
from pathlib import Path

# Add parent directory to path to import config
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
import config


def migrate():
    """Add pre_run_command column to templates table."""

    # Get database URL from config
    settings = config.Settings()
    db_path = Path(settings.data_directory) / "settings" / "templates.db"
    database_url = f"sqlite:///{db_path}"

    print(f"Connecting to database: {db_path}")
    engine = create_engine(database_url)

    try:
        with engine.connect() as conn:
            # Check if column already exists
            result = conn.execute(text("PRAGMA table_info(templates)"))
            columns = [row[1] for row in result]

            if "pre_run_command" in columns:
                print("✓ Column 'pre_run_command' already exists, skipping migration")
                return

            # Add the new column
            print("Adding 'pre_run_command' column to templates table...")
            conn.execute(text("ALTER TABLE templates ADD COLUMN pre_run_command TEXT"))
            conn.commit()

            print("✓ Migration completed successfully")
            print("  - Added 'pre_run_command' column (nullable TEXT)")

    except Exception as e:
        print(f"✗ Migration failed: {e}")
        raise


if __name__ == "__main__":
    migrate()
