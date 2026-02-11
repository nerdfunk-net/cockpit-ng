"""
Migration 006: Add agents array column to agents_settings

Adds a JSON column to store multiple agent configurations (e.g., Grafana, Telegraf, Smokeping).
"""

from migrations.base import BaseMigration
from sqlalchemy import text


class Migration(BaseMigration):
    """Add agents array column to agents_settings table."""

    @property
    def name(self) -> str:
        return "006_add_agents_array"

    @property
    def description(self) -> str:
        return "Add agents JSON column to agents_settings table"

    def upgrade(self) -> dict:
        """
        Add agents column to agents_settings table.
        """
        self.log_info("Adding agents column to agents_settings table...")

        try:
            with self.engine.connect() as conn:
                # Check if column already exists
                result = conn.execute(
                    text(
                        """
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_schema = 'public' 
                        AND table_name = 'agents_settings'
                        AND column_name = 'agents'
                        """
                    )
                )

                if result.fetchone() is None:
                    # Column doesn't exist, add it
                    conn.execute(
                        text("ALTER TABLE agents_settings ADD COLUMN agents JSON")
                    )
                    conn.commit()
                    self.log_info("✓ Added agents column to agents_settings table")
                else:
                    self.log_debug("agents column already exists")

            return {
                "success": True,
                "columns_added": 1,
                "message": "Added agents column to agents_settings table",
            }

        except Exception as e:
            self.log_error(f"Failed to add agents column: {e}")
            raise

    def downgrade(self) -> dict:
        """
        Remove agents column from agents_settings table.
        """
        self.log_info("Removing agents column from agents_settings table...")

        try:
            with self.engine.connect() as conn:
                # Check if column exists
                result = conn.execute(
                    text(
                        """
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_schema = 'public' 
                        AND table_name = 'agents_settings'
                        AND column_name = 'agents'
                        """
                    )
                )

                if result.fetchone() is not None:
                    # Column exists, drop it
                    conn.execute(text("ALTER TABLE agents_settings DROP COLUMN agents"))
                    conn.commit()
                    self.log_info("✓ Removed agents column from agents_settings table")
                else:
                    self.log_debug("agents column doesn't exist")

            return {
                "success": True,
                "columns_removed": 1,
                "message": "Removed agents column from agents_settings table",
            }

        except Exception as e:
            self.log_error(f"Failed to remove agents column: {e}")
            raise
