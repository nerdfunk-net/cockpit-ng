"""
Migration 011: Add deploy_templates column to job_templates table.

Adds a JSON column for multi-template agent deployment:
- deploy_templates: JSON array of template entries, each with template_id,
  inventory_id, path, and custom_variables

This enables deploying multiple templates in a single agent deployment job,
each with its own inventory, path, and variable overrides.

Existing single-template columns (deploy_template_id, deploy_path,
deploy_custom_variables) are kept for backward compatibility.
"""

from migrations.base import BaseMigration
from migrations.auto_schema import AutoSchemaMigration


class Migration(BaseMigration):
    @property
    def name(self) -> str:
        return "011_add_deploy_templates_array"

    @property
    def description(self) -> str:
        return "Add deploy_templates JSON column for multi-template agent deployment"

    def upgrade(self) -> dict:
        auto = AutoSchemaMigration(self.engine, self.base)
        return auto.run()
