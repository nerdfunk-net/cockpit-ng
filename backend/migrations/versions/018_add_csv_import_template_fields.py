"""
Migration 018: Add csv_import job template fields to job_templates

Adds eight columns that store the configuration for the "CSV Import"
(csv_import) job type.
"""

from migrations.base import BaseMigration
from sqlalchemy import text

COLUMNS = [
    ("csv_import_repo_id", "INTEGER"),
    ("csv_import_file_path", "VARCHAR(500)"),
    ("csv_import_type", "VARCHAR(50)"),
    ("csv_import_primary_key", "VARCHAR(255)"),
    ("csv_import_update_existing", "BOOLEAN NOT NULL DEFAULT TRUE"),
    ("csv_import_delimiter", "VARCHAR(10)"),
    ("csv_import_quote_char", "VARCHAR(10)"),
    ("csv_import_column_mapping", "TEXT"),
]


class Migration(BaseMigration):
    """Add csv_import template columns to job_templates table."""

    @property
    def name(self) -> str:
        return "018_add_csv_import_template_fields"

    @property
    def description(self) -> str:
        return (
            "Add csv_import_repo_id, csv_import_file_path, csv_import_type, "
            "csv_import_primary_key, csv_import_update_existing, csv_import_delimiter, "
            "csv_import_quote_char, csv_import_column_mapping columns to job_templates "
            "for the CSV Import job type"
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
