"""
Migration 034: Change servers.location from varchar to JSON
"""

from migrations.auto_schema import AutoSchemaMigration
from migrations.base import BaseMigration


class Migration(BaseMigration):
    """Change location column from varchar to JSON to store id, name, and hierarchical path."""

    @property
    def name(self) -> str:
        return "034_change_server_location_to_json"

    @property
    def description(self) -> str:
        return "Change servers.location from varchar to JSON"

    def upgrade(self) -> dict:
        self.log_info("Converting servers.location column to JSON...")
        auto = AutoSchemaMigration(self.engine, self.base)
        return auto.run()
