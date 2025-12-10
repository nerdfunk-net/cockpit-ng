"""
Migration script to add use_nautobot_context column to templates table.

This script adds a new column to store whether templates should use Nautobot context
when rendering. This allows templates to have this setting saved with the template
rather than specified at render time.

Usage:
    python migrations/add_use_nautobot_context_to_templates.py
"""

import sys
from pathlib import Path

# Add parent directory to path to import config
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
import config


def migrate():
    """Add use_nautobot_context column to templates table."""

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

            if "use_nautobot_context" in columns:
                print(
                    "✓ Column 'use_nautobot_context' already exists, skipping migration"
                )
                return

            # Add the new column
            print("Adding 'use_nautobot_context' column to templates table...")
            conn.execute(
                text(
                    "ALTER TABLE templates ADD COLUMN use_nautobot_context BOOLEAN NOT NULL DEFAULT 0"
                )
            )
            conn.commit()

            print("✓ Migration completed successfully")
            print("  - Added 'use_nautobot_context' column (default: False)")

    except Exception as e:
        print(f"✗ Migration failed: {e}")
        raise


if __name__ == "__main__":
    migrate()
