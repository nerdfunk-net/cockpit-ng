"""
Migration 039: Add cluster JSON column to servers table
"""

from migrations.auto_schema import AutoSchemaMigration
from migrations.base import BaseMigration


class Migration(BaseMigration):
    """Add cluster JSON column to servers table (Nautobot cluster id + name)."""

    @property
    def name(self) -> str:
        return "039_add_server_cluster_column"

    @property
    def description(self) -> str:
        return "Add cluster JSON column to servers table"

    def upgrade(self) -> dict:
        self.log_info("Adding cluster column to servers table...")
        auto = AutoSchemaMigration(self.engine, self.base)
        return auto.run()
