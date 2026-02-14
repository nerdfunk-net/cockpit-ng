"""
Migration 007: Add template variable metadata and pass_snmp_mapping field

This migration:
1. Adds pass_snmp_mapping column to templates table
2. Migrates template variables from simple string format to structured format with type and metadata

Before: {"var_name": "value"}
After:  {"var_name": {"value": "value", "type": "custom", "metadata": {}}}
"""

import json
from migrations.base import BaseMigration
from sqlalchemy import text


class Migration(BaseMigration):
    @property
    def name(self) -> str:
        return "007_template_variables_metadata"

    @property
    def description(self) -> str:
        return "Add pass_snmp_mapping column and migrate template variables to include type and metadata"

    def upgrade(self) -> dict:
        """Execute the migration."""
        stats = {
            "columns_added": 0,
            "templates_migrated": 0,
            "templates_skipped": 0,
            "errors": 0,
        }

        with self.engine.begin() as conn:
            # Step 1: Add pass_snmp_mapping column
            self.log_info("Adding pass_snmp_mapping column to templates table...")
            try:
                # Check if column already exists
                result = conn.execute(
                    text(
                        """
                        SELECT column_name
                        FROM information_schema.columns
                        WHERE table_name = 'templates'
                        AND column_name = 'pass_snmp_mapping'
                        """
                    )
                )
                if result.fetchone() is None:
                    # Column doesn't exist, add it
                    conn.execute(
                        text(
                            """
                            ALTER TABLE templates
                            ADD COLUMN pass_snmp_mapping BOOLEAN NOT NULL DEFAULT FALSE
                            """
                        )
                    )
                    self.log_info("✓ Added pass_snmp_mapping column")
                    stats["columns_added"] += 1
                else:
                    self.log_info("✓ pass_snmp_mapping column already exists")
            except Exception as e:
                self.log_error(f"Failed to add pass_snmp_mapping column: {e}")
                stats["errors"] += 1
                raise

            # Step 2: Migrate template variables to new format
            self.log_info("Migrating template variables to new format...")

            try:
                # Fetch all templates with variables
                result = conn.execute(
                    text(
                        """
                        SELECT id, name, variables
                        FROM templates
                        WHERE variables IS NOT NULL
                        AND variables != '{}'
                        AND variables != ''
                        """
                    )
                )
                templates = result.fetchall()

                self.log_info(f"Found {len(templates)} templates to check")

                for template_id, template_name, variables_json in templates:
                    try:
                        if not variables_json or variables_json.strip() in ("{}", ""):
                            continue

                        variables = json.loads(variables_json)

                        # Check if already in new format
                        if variables:
                            first_value = next(iter(variables.values()))
                            if isinstance(first_value, dict) and "type" in first_value:
                                self.log_debug(
                                    f"Template '{template_name}' (ID: {template_id}) already migrated"
                                )
                                stats["templates_skipped"] += 1
                                continue

                        # Transform to new format
                        new_variables = {}
                        for var_name, var_value in variables.items():
                            # Ensure value is a string
                            if isinstance(var_value, str):
                                value = var_value
                            else:
                                value = json.dumps(var_value)

                            new_variables[var_name] = {
                                "value": value,
                                "type": "custom",  # Default to custom for existing variables
                                "metadata": {},
                            }

                        new_variables_json = json.dumps(new_variables)

                        # Update database
                        conn.execute(
                            text("UPDATE templates SET variables = :vars WHERE id = :id"),
                            {"vars": new_variables_json, "id": template_id},
                        )

                        self.log_info(
                            f"✓ Migrated template '{template_name}' (ID: {template_id})"
                        )
                        stats["templates_migrated"] += 1

                    except Exception as e:
                        self.log_error(
                            f"Error migrating template '{template_name}' (ID: {template_id}): {e}"
                        )
                        stats["errors"] += 1
                        # Continue with next template instead of failing entire migration

            except Exception as e:
                self.log_error(f"Failed to migrate template variables: {e}")
                stats["errors"] += 1
                raise

        # Summary
        self.log_info("Migration completed:")
        self.log_info(f"  - Columns added: {stats['columns_added']}")
        self.log_info(f"  - Templates migrated: {stats['templates_migrated']}")
        self.log_info(f"  - Templates skipped (already migrated): {stats['templates_skipped']}")
        if stats["errors"] > 0:
            self.log_warning(f"  - Errors encountered: {stats['errors']}")

        return stats
