"""
Migration 008: Add inventory_id column to templates table

This migration adds inventory_id column to store the selected inventory
for agent category templates. The column is nullable and has a foreign key
to the inventories table with SET NULL on delete.
"""

from migrations.base import BaseMigration
from sqlalchemy import text


class Migration(BaseMigration):
    @property
    def name(self) -> str:
        return "008_add_inventory_id_to_templates"

    @property
    def description(self) -> str:
        return "Add inventory_id column to templates table for agent templates"

    def upgrade(self) -> dict:
        """Execute the migration."""
        stats = {
            "columns_added": 0,
            "constraints_added": 0,
            "errors": 0,
        }

        with self.engine.begin() as conn:
            # Add inventory_id column
            self.log_info("Adding inventory_id column to templates table...")
            try:
                # Check if column already exists
                result = conn.execute(
                    text(
                        """
                        SELECT column_name
                        FROM information_schema.columns
                        WHERE table_name = 'templates'
                        AND column_name = 'inventory_id'
                        """
                    )
                )
                if result.fetchone() is None:
                    # Column doesn't exist, add it
                    conn.execute(
                        text(
                            """
                            ALTER TABLE templates
                            ADD COLUMN inventory_id INTEGER
                            """
                        )
                    )
                    self.log_info("✓ Added inventory_id column")
                    stats["columns_added"] += 1

                    # Add foreign key constraint
                    self.log_info("Adding foreign key constraint to inventories table...")
                    try:
                        conn.execute(
                            text(
                                """
                                ALTER TABLE templates
                                ADD CONSTRAINT fk_templates_inventory_id
                                FOREIGN KEY (inventory_id)
                                REFERENCES inventories(id)
                                ON DELETE SET NULL
                                """
                            )
                        )
                        self.log_info("✓ Added foreign key constraint")
                        stats["constraints_added"] += 1
                    except Exception as e:
                        self.log_warning(f"Foreign key constraint may already exist: {e}")
                else:
                    self.log_info("✓ inventory_id column already exists")
            except Exception as e:
                self.log_error(f"Failed to add inventory_id column: {e}")
                stats["errors"] += 1
                raise

        # Summary
        self.log_info("Migration completed:")
        self.log_info(f"  - Columns added: {stats['columns_added']}")
        self.log_info(f"  - Constraints added: {stats['constraints_added']}")
        if stats["errors"] > 0:
            self.log_warning(f"  - Errors encountered: {stats['errors']}")

        return stats
