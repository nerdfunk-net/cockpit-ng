"""
Migration 022: Add csv_import_add_prefixes and csv_import_default_prefix_length to job_templates

Enables automatic creation of missing parent IP prefixes during CSV import,
and a configurable default CIDR prefix length for IPs that have no mask in the CSV.
"""

from migrations.base import BaseMigration
from migrations.auto_schema import AutoSchemaMigration


class Migration(BaseMigration):
    """Add CSV import prefix options to job_templates table."""

    @property
    def name(self) -> str:
        return "022_add_csv_import_prefix_options"

    @property
    def description(self) -> str:
        return (
            "Add csv_import_add_prefixes and csv_import_default_prefix_length "
            "columns to job_templates for automatic IP prefix creation during CSV import"
        )

    def upgrade(self) -> dict:
        auto = AutoSchemaMigration(self.engine, self.base)
        return auto.run()
