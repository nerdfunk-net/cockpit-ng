"""
Migration 036: Rename nautobot_defaults table to network_defaults

The table stores default values for network device/IP creation in Nautobot,
not Nautobot connection settings. Renamed to distinguish from future server_defaults.
"""

from migrations.auto_schema import AutoSchemaMigration
from migrations.base import BaseMigration
from sqlalchemy import text


class Migration(BaseMigration):
    """Rename nautobot_defaults table to network_defaults."""

    @property
    def name(self) -> str:
        return "036_rename_nautobot_defaults_to_network_defaults"

    @property
    def description(self) -> str:
        return "Rename nautobot_defaults table to network_defaults"

    def upgrade(self) -> dict:
        self.log_info("Renaming nautobot_defaults table to network_defaults...")

        tables_renamed = 0

        try:
            with self.engine.connect() as conn:
                result = conn.execute(
                    text(
                        """
                        SELECT table_name
                        FROM information_schema.tables
                        WHERE table_schema = 'public'
                        AND table_name = 'nautobot_defaults'
                        """
                    )
                )

                if result.fetchone() is not None:
                    conn.execute(
                        text(
                            "ALTER TABLE nautobot_defaults RENAME TO network_defaults"
                        )
                    )
                    conn.commit()
                    tables_renamed = 1
                    self.log_info(
                        "✓ Table renamed from nautobot_defaults to network_defaults"
                    )
                else:
                    result = conn.execute(
                        text(
                            """
                            SELECT table_name
                            FROM information_schema.tables
                            WHERE table_schema = 'public'
                            AND table_name = 'network_defaults'
                            """
                        )
                    )
                    if result.fetchone() is not None:
                        self.log_debug("network_defaults table already exists")
                    else:
                        self.log_warning(
                            "Neither nautobot_defaults nor network_defaults exists; "
                            "running AutoSchemaMigration to create network_defaults"
                        )

            if tables_renamed == 0:
                auto = AutoSchemaMigration(self.engine, self.base)
                auto_results = auto.run()
                return {
                    "success": True,
                    "tables_renamed": 0,
                    "tables_created": auto_results.get("tables_created", 0),
                    "columns_added": auto_results.get("columns_added", 0),
                    "indexes_created": auto_results.get("indexes_created", 0),
                    "message": "Ensured network_defaults table exists",
                }

            return {
                "success": True,
                "tables_renamed": tables_renamed,
                "message": "Renamed nautobot_defaults table to network_defaults",
            }

        except Exception as e:
            self.log_error(f"Failed to rename table: {e}")
            raise

    def downgrade(self) -> dict:
        self.log_info("Renaming network_defaults table back to nautobot_defaults...")

        try:
            with self.engine.connect() as conn:
                result = conn.execute(
                    text(
                        """
                        SELECT table_name
                        FROM information_schema.tables
                        WHERE table_schema = 'public'
                        AND table_name = 'network_defaults'
                        """
                    )
                )

                if result.fetchone() is not None:
                    conn.execute(
                        text(
                            "ALTER TABLE network_defaults RENAME TO nautobot_defaults"
                        )
                    )
                    conn.commit()
                    self.log_info(
                        "✓ Table renamed from network_defaults to nautobot_defaults"
                    )

            return {
                "success": True,
                "tables_renamed": 1,
                "message": "Renamed network_defaults table back to nautobot_defaults",
            }

        except Exception as e:
            self.log_error(f"Failed to rename table: {e}")
            raise
