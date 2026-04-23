"""
Migration 030: Add group_path column to inventories table

Adds a group_path column to support hierarchical organization of saved inventories
using slash-separated paths (e.g. "group_a", "group_b/sub_group").
"""

from migrations.base import BaseMigration
from sqlalchemy import text


class Migration(BaseMigration):
    """Add group_path column to inventories table for hierarchical organization."""

    @property
    def name(self) -> str:
        return "030_add_inventory_group_path"

    @property
    def description(self) -> str:
        return "Add group_path column to inventories for slash-separated group hierarchy"

    def upgrade(self) -> dict:
        self.log_info("Adding group_path column to inventories...")

        columns_added = 0
        indexes_created = 0

        try:
            with self.engine.connect() as conn:
                result = conn.execute(
                    text(
                        """
                        SELECT column_name
                        FROM information_schema.columns
                        WHERE table_name = 'inventories'
                        AND column_name = 'group_path'
                        """
                    )
                )
                if result.fetchone() is None:
                    conn.execute(
                        text(
                            """
                            ALTER TABLE inventories
                            ADD COLUMN group_path VARCHAR(1000) DEFAULT NULL
                            """
                        )
                    )
                    columns_added += 1
                    self.log_info("✓ group_path column added successfully")
                else:
                    self.log_debug("group_path column already exists")

                result = conn.execute(
                    text(
                        """
                        SELECT indexname
                        FROM pg_indexes
                        WHERE tablename = 'inventories'
                        AND indexname = 'idx_inventory_group_path'
                        """
                    )
                )
                if result.fetchone() is None:
                    conn.execute(
                        text(
                            """
                            CREATE INDEX idx_inventory_group_path
                            ON inventories (group_path)
                            """
                        )
                    )
                    indexes_created += 1
                    self.log_info("✓ idx_inventory_group_path index created")
                else:
                    self.log_debug("idx_inventory_group_path index already exists")

                conn.commit()

            return {
                "success": True,
                "columns_added": columns_added,
                "indexes_created": indexes_created,
                "message": "Added group_path column to inventories",
            }

        except Exception as e:
            self.log_error("Failed to add group_path column: %s", e)
            raise

    def downgrade(self) -> dict:
        self.log_info("Removing group_path column from inventories...")

        columns_removed = 0

        try:
            with self.engine.connect() as conn:
                result = conn.execute(
                    text(
                        """
                        SELECT column_name
                        FROM information_schema.columns
                        WHERE table_name = 'inventories'
                        AND column_name = 'group_path'
                        """
                    )
                )
                if result.fetchone() is not None:
                    conn.execute(
                        text("ALTER TABLE inventories DROP COLUMN group_path")
                    )
                    columns_removed += 1
                    self.log_info("✓ group_path column removed successfully")
                else:
                    self.log_debug("group_path column doesn't exist")

                conn.commit()

            return {
                "success": True,
                "columns_removed": columns_removed,
                "message": "Removed group_path column from inventories",
            }

        except Exception as e:
            self.log_error("Failed to remove group_path column: %s", e)
            raise
