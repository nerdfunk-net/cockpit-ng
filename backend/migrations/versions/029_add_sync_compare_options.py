"""
Migration 029: Add use_last_compare_run and sync_not_found_devices columns to job_templates

Adds two boolean columns to support filtering the sync device list using
the results of the last compare job run.
"""

from migrations.base import BaseMigration
from sqlalchemy import text


class Migration(BaseMigration):
    """Add use_last_compare_run and sync_not_found_devices columns to job_templates table."""

    @property
    def name(self) -> str:
        return "029_add_sync_compare_options"

    @property
    def description(self) -> str:
        return "Add use_last_compare_run and sync_not_found_devices columns to job_templates for compare-run-based sync filtering"

    def upgrade(self) -> dict:
        self.log_info("Adding use_last_compare_run and sync_not_found_devices columns to job_templates...")

        columns_added = 0

        try:
            with self.engine.connect() as conn:
                result = conn.execute(
                    text(
                        """
                        SELECT column_name
                        FROM information_schema.columns
                        WHERE table_name = 'job_templates'
                        AND column_name = 'use_last_compare_run'
                        """
                    )
                )
                if result.fetchone() is None:
                    conn.execute(
                        text(
                            """
                            ALTER TABLE job_templates
                            ADD COLUMN use_last_compare_run BOOLEAN NOT NULL DEFAULT TRUE
                            """
                        )
                    )
                    columns_added += 1
                    self.log_info("✓ use_last_compare_run column added successfully")
                else:
                    self.log_debug("use_last_compare_run column already exists")

                result = conn.execute(
                    text(
                        """
                        SELECT column_name
                        FROM information_schema.columns
                        WHERE table_name = 'job_templates'
                        AND column_name = 'sync_not_found_devices'
                        """
                    )
                )
                if result.fetchone() is None:
                    conn.execute(
                        text(
                            """
                            ALTER TABLE job_templates
                            ADD COLUMN sync_not_found_devices BOOLEAN NOT NULL DEFAULT FALSE
                            """
                        )
                    )
                    columns_added += 1
                    self.log_info("✓ sync_not_found_devices column added successfully")
                else:
                    self.log_debug("sync_not_found_devices column already exists")

                conn.commit()

            return {
                "success": True,
                "columns_added": columns_added,
                "message": "Added use_last_compare_run and sync_not_found_devices columns to job_templates",
            }

        except Exception as e:
            self.log_error(f"Failed to add columns: {e}")
            raise

    def downgrade(self) -> dict:
        self.log_info("Removing use_last_compare_run and sync_not_found_devices columns from job_templates...")

        columns_removed = 0

        try:
            with self.engine.connect() as conn:
                for column in ("use_last_compare_run", "sync_not_found_devices"):
                    result = conn.execute(
                        text(
                            f"""
                            SELECT column_name
                            FROM information_schema.columns
                            WHERE table_name = 'job_templates'
                            AND column_name = '{column}'
                            """
                        )
                    )
                    if result.fetchone() is not None:
                        conn.execute(
                            text(f"ALTER TABLE job_templates DROP COLUMN {column}")
                        )
                        columns_removed += 1
                        self.log_info("✓ %s column removed successfully", column)
                    else:
                        self.log_debug("%s column doesn't exist", column)

                conn.commit()

            return {
                "success": True,
                "columns_removed": columns_removed,
                "message": "Removed use_last_compare_run and sync_not_found_devices columns from job_templates",
            }

        except Exception as e:
            self.log_error(f"Failed to remove columns: {e}")
            raise
