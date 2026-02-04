"""
Migration 004: Add scan_set_reachable_ip_active column to job_templates

Adds a boolean column to control whether reachable IPs should be set to Active status
during scan_prefixes jobs.
"""

from migrations.base import BaseMigration
from sqlalchemy import text


class Migration(BaseMigration):
    """Add scan_set_reachable_ip_active column to job_templates table."""

    @property
    def name(self) -> str:
        return "004_add_scan_set_reachable_ip_active"

    @property
    def description(self) -> str:
        return "Add scan_set_reachable_ip_active column to job_templates for controlling IP status updates"

    def upgrade(self) -> dict:
        """
        Add scan_set_reachable_ip_active column to job_templates table.
        """
        self.log_info("Adding scan_set_reachable_ip_active column to job_templates...")

        try:
            # Add the new column with default value True
            with self.engine.connect() as conn:
                # Check if column already exists
                result = conn.execute(
                    text(
                        """
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_name = 'job_templates' 
                        AND column_name = 'scan_set_reachable_ip_active'
                        """
                    )
                )

                if result.fetchone() is None:
                    # Column doesn't exist, add it
                    conn.execute(
                        text(
                            """
                            ALTER TABLE job_templates 
                            ADD COLUMN scan_set_reachable_ip_active BOOLEAN NOT NULL DEFAULT TRUE
                            """
                        )
                    )
                    conn.commit()
                    self.log_info(
                        "✓ scan_set_reachable_ip_active column added successfully"
                    )
                else:
                    self.log_debug("scan_set_reachable_ip_active column already exists")

            return {
                "success": True,
                "columns_added": 1,
                "message": "Added scan_set_reachable_ip_active column to job_templates",
            }

        except Exception as e:
            self.log_error(f"Failed to add column: {e}")
            raise

    def downgrade(self) -> dict:
        """
        Remove scan_set_reachable_ip_active column from job_templates table.
        """
        self.log_info(
            "Removing scan_set_reachable_ip_active column from job_templates..."
        )

        try:
            with self.engine.connect() as conn:
                # Check if column exists before trying to drop it
                result = conn.execute(
                    text(
                        """
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_name = 'job_templates' 
                        AND column_name = 'scan_set_reachable_ip_active'
                        """
                    )
                )

                if result.fetchone() is not None:
                    # Column exists, drop it
                    conn.execute(
                        text(
                            """
                            ALTER TABLE job_templates 
                            DROP COLUMN scan_set_reachable_ip_active
                            """
                        )
                    )
                    conn.commit()
                    self.log_info(
                        "✓ scan_set_reachable_ip_active column removed successfully"
                    )
                else:
                    self.log_debug("scan_set_reachable_ip_active column doesn't exist")

            return {
                "success": True,
                "columns_removed": 1,
                "message": "Removed scan_set_reachable_ip_active column from job_templates",
            }

        except Exception as e:
            self.log_error(f"Failed to remove column: {e}")
            raise
