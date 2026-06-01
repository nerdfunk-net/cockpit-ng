"""
Migration 033: Add is_virtual column to servers table
"""

from migrations.auto_schema import AutoSchemaMigration
from migrations.base import BaseMigration


class Migration(BaseMigration):
    """Add is_virtual boolean column to servers table."""

    @property
    def name(self) -> str:
        return "033_add_server_is_virtual_column"

    @property
    def description(self) -> str:
        return "Add is_virtual boolean column to servers table"

    def upgrade(self) -> dict:
        self.log_info("Adding is_virtual column to servers table...")
        auto = AutoSchemaMigration(self.engine, self.base)
        return auto.run()
