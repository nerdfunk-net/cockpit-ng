"""
Migration 005: Rename grafana_settings table to agents_settings

Renames the grafana_settings table to agents_settings to better reflect that it
manages deployment settings for all monitoring agents (Telegraf, InfluxDB, Grafana).
"""

from migrations.base import BaseMigration
from sqlalchemy import text


class Migration(BaseMigration):
    """Rename grafana_settings table to agents_settings."""

    @property
    def name(self) -> str:
        return "005_rename_grafana_to_agents"

    @property
    def description(self) -> str:
        return "Rename grafana_settings table to agents_settings"

    def upgrade(self) -> dict:
        """
        Rename grafana_settings table to agents_settings.
        """
        self.log_info("Renaming grafana_settings table to agents_settings...")

        try:
            with self.engine.connect() as conn:
                # Check if the old table exists
                result = conn.execute(
                    text(
                        """
                        SELECT table_name 
                        FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = 'grafana_settings'
                        """
                    )
                )

                if result.fetchone() is not None:
                    # Old table exists, rename it
                    conn.execute(
                        text("ALTER TABLE grafana_settings RENAME TO agents_settings")
                    )
                    conn.commit()
                    self.log_info(
                        "✓ Table renamed from grafana_settings to agents_settings"
                    )
                else:
                    # Check if new table already exists
                    result = conn.execute(
                        text(
                            """
                            SELECT table_name 
                            FROM information_schema.tables 
                            WHERE table_schema = 'public' 
                            AND table_name = 'agents_settings'
                            """
                        )
                    )
                    if result.fetchone() is not None:
                        self.log_debug("agents_settings table already exists")
                    else:
                        self.log_warning(
                            "Neither grafana_settings nor agents_settings table exists"
                        )

            return {
                "success": True,
                "tables_renamed": 1,
                "message": "Renamed grafana_settings table to agents_settings",
            }

        except Exception as e:
            self.log_error(f"Failed to rename table: {e}")
            raise

    def downgrade(self) -> dict:
        """
        Rename agents_settings table back to grafana_settings.
        """
        self.log_info("Renaming agents_settings table back to grafana_settings...")

        try:
            with self.engine.connect() as conn:
                # Check if the new table exists
                result = conn.execute(
                    text(
                        """
                        SELECT table_name 
                        FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = 'agents_settings'
                        """
                    )
                )

                if result.fetchone() is not None:
                    # New table exists, rename it back
                    conn.execute(
                        text("ALTER TABLE agents_settings RENAME TO grafana_settings")
                    )
                    conn.commit()
                    self.log_info(
                        "✓ Table renamed from agents_settings back to grafana_settings"
                    )
                else:
                    self.log_debug("agents_settings table doesn't exist")

            return {
                "success": True,
                "tables_renamed": 1,
                "message": "Renamed agents_settings table back to grafana_settings",
            }

        except Exception as e:
            self.log_error(f"Failed to rename table: {e}")
            raise
