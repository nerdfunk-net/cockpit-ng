"""
Migration 025: Add rack_device_mappings table

Persists CSV-to-Nautobot device name mappings per rack and location so
future imports can auto-resolve known names without user interaction.
"""

from migrations.base import BaseMigration
from migrations.auto_schema import AutoSchemaMigration


class Migration(BaseMigration):
    """Add rack_device_mappings table."""

    @property
    def name(self) -> str:
        return "025_add_rack_device_mappings"

    @property
    def description(self) -> str:
        return (
            "Add rack_device_mappings table for persisting CSV-to-Nautobot "
            "device name mappings per rack and location"
        )

    def upgrade(self) -> dict:
        self.log_info("Creating rack_device_mappings table...")
        auto = AutoSchemaMigration(self.engine, self.base)
        results = auto.run()
        if results.get("tables_created", 0) > 0:
            self.log_info("rack_device_mappings table created successfully")
        else:
            self.log_debug("rack_device_mappings table already exists")
        return results
