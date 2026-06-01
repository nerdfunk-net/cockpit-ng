"""
Migration 042: Add ansible_credentials JSONB column to servers table.
"""

from migrations.auto_schema import AutoSchemaMigration
from migrations.base import BaseMigration


class Migration(BaseMigration):
    """Add ansible_credentials column to servers table."""

    @property
    def name(self) -> str:
        return "042_add_server_ansible_credentials_column"

    @property
    def description(self) -> str:
        return "Add ansible_credentials JSONB column to servers table"

    def upgrade(self) -> dict:
        self.log_info("Adding ansible_credentials column to servers table...")
        auto = AutoSchemaMigration(self.engine, self.base)
        return auto.run()
