"""
Migration 037: Add server_defaults table

Creates the server_defaults table for default values used when creating
servers in Nautobot (same schema as network_defaults).
"""

from migrations.auto_schema import AutoSchemaMigration
from migrations.base import BaseMigration


class Migration(BaseMigration):
    """Add server_defaults table."""

    @property
    def name(self) -> str:
        return "037_add_server_defaults_table"

    @property
    def description(self) -> str:
        return "Add server_defaults table for server creation defaults"

    def upgrade(self) -> dict:
        self.log_info("Creating server_defaults table...")

        auto_migration = AutoSchemaMigration(self.engine, self.base)
        results = auto_migration.run()

        return {
            "success": True,
            "tables_created": results.get("tables_created", 0),
            "columns_added": results.get("columns_added", 0),
            "indexes_created": results.get("indexes_created", 0),
            "message": "Created server_defaults table",
        }
