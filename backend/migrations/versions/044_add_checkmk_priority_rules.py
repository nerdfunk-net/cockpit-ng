"""
Migration 044: Add checkmk_priority_rules table.

Creates the checkmk_priority_rules table used to store ordered priority
rules that select which checkmk config file to use when syncing a device.
"""

from migrations.auto_schema import AutoSchemaMigration
from migrations.base import BaseMigration


class Migration(BaseMigration):
    """Add checkmk_priority_rules table."""

    @property
    def name(self) -> str:
        return "044_add_checkmk_priority_rules"

    @property
    def description(self) -> str:
        return "Add checkmk_priority_rules table for config prioritization"

    def upgrade(self) -> dict:
        self.log_info("Creating checkmk_priority_rules table...")
        auto = AutoSchemaMigration(self.engine, self.base)
        results = auto.run()
        return {
            "success": True,
            "tables_created": results.get("tables_created", 0),
            "columns_added": results.get("columns_added", 0),
            "message": "Created checkmk_priority_rules table",
        }
