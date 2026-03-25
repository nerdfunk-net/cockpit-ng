"""
Migration 023: Add csv_export job template fields to job_templates

Adds columns that store the configuration for the "CSV Export"
(csv_export) job type.
"""

from migrations.base import BaseMigration
from sqlalchemy import text

COLUMNS = [
    ("csv_export_repo_id", "INTEGER"),
    ("csv_export_file_path", "VARCHAR(500)"),
    ("csv_export_properties", "TEXT"),
    ("csv_export_delimiter", "VARCHAR(10)"),
    ("csv_export_quote_char", "VARCHAR(10)"),
    ("csv_export_include_headers", "BOOLEAN NOT NULL DEFAULT TRUE"),
]


class Migration(BaseMigration):
    """Add csv_export template columns to job_templates table."""

    @property
    def name(self) -> str:
        return "023_add_csv_export_template_fields"

    @property
    def description(self) -> str:
        return (
            "Add csv_export_repo_id, csv_export_file_path, csv_export_properties, "
            "csv_export_delimiter, csv_export_quote_char, csv_export_include_headers "
            "columns to job_templates for the CSV Export job type"
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
