"""
Migration 021: Add csv_import_format to job_templates

Adds a VARCHAR(50) column to store the CSV import format:
  'cockpit'  - multi-row per device (one row per interface)
  'nautobot' - single-row export with NULL/NoObject sentinel filtering
  'generic'  - plain single-row CSV (default / existing behaviour)
"""

from migrations.base import BaseMigration
from migrations.auto_schema import AutoSchemaMigration


class Migration(BaseMigration):
    """Add csv_import_format column to job_templates table."""

    @property
    def name(self) -> str:
        return "021_add_csv_import_format"

    @property
    def description(self) -> str:
        return (
            "Add csv_import_format column to job_templates "
            "to select between cockpit, nautobot, and generic CSV row formats"
        )

    def upgrade(self) -> dict:
        auto = AutoSchemaMigration(self.engine, self.base)
        return auto.run()
