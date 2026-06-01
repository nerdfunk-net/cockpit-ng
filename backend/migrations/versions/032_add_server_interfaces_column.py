"""
Migration 032: Add selected_interfaces column to servers table
"""

from migrations.auto_schema import AutoSchemaMigration
from migrations.base import BaseMigration


class Migration(BaseMigration):
    """Add selected_interfaces JSON column to servers table."""

    @property
    def name(self) -> str:
        return "032_add_server_interfaces_column"

    @property
    def description(self) -> str:
        return "Add selected_interfaces JSON column to servers table"

    def upgrade(self) -> dict:
        self.log_info("Adding selected_interfaces column to servers table...")
        auto = AutoSchemaMigration(self.engine, self.base)
        return auto.run()
