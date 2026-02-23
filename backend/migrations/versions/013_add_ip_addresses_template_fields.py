"""
Migration 013: Add ip_addresses job template fields to job_templates

Adds five columns that store the configuration for the "Maintain IP-Addresses"
(ip_addresses) job type.
"""

from migrations.base import BaseMigration
from sqlalchemy import text

COLUMNS = [
    ("ip_action", "VARCHAR(50)"),
    ("ip_filter_field", "VARCHAR(255)"),
    ("ip_filter_type", "VARCHAR(50)"),
    ("ip_filter_value", "VARCHAR(255)"),
    ("ip_include_null", "BOOLEAN NOT NULL DEFAULT FALSE"),
]


class Migration(BaseMigration):
    """Add ip_addresses template columns to job_templates table."""

    @property
    def name(self) -> str:
        return "013_add_ip_addresses_template_fields"

    @property
    def description(self) -> str:
        return (
            "Add ip_action, ip_filter_field, ip_filter_type, ip_filter_value, "
            "ip_include_null columns to job_templates for the Maintain IP-Addresses job type"
        )

    def upgrade(self) -> dict:
        added = 0
        with self.engine.connect() as conn:
            for col_name, col_def in COLUMNS:
                result = conn.execute(
                    text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_name = 'job_templates' AND column_name = :col"
                    ),
                    {"col": col_name},
                )
                if result.fetchone() is None:
                    conn.execute(
                        text(
                            f"ALTER TABLE job_templates ADD COLUMN {col_name} {col_def}"
                        )
                    )
                    self.log_info(f"Added column: {col_name}")
                    added += 1
                else:
                    self.log_debug(f"Column already exists: {col_name}")
            conn.commit()

        return {"success": True, "columns_added": added}

    def downgrade(self) -> dict:
        removed = 0
        with self.engine.connect() as conn:
            for col_name, _ in COLUMNS:
                result = conn.execute(
                    text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_name = 'job_templates' AND column_name = :col"
                    ),
                    {"col": col_name},
                )
                if result.fetchone() is not None:
                    conn.execute(
                        text(f"ALTER TABLE job_templates DROP COLUMN {col_name}")
                    )
                    self.log_info(f"Dropped column: {col_name}")
                    removed += 1
            conn.commit()

        return {"success": True, "columns_removed": removed}
