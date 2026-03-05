"""
Migration 019: Add csv_import_file_filter to job_templates

Adds a column to store a glob pattern for selecting multiple CSV files
at runtime during a CSV import job.
"""

from migrations.base import BaseMigration
from sqlalchemy import text

COLUMNS = [
    ("csv_import_file_filter", "VARCHAR(255)"),
]


class Migration(BaseMigration):
    """Add csv_import_file_filter column to job_templates table."""

    @property
    def name(self) -> str:
        return "019_add_csv_import_file_filter"

    @property
    def description(self) -> str:
        return (
            "Add csv_import_file_filter column to job_templates "
            "for glob-based multi-file CSV import at runtime"
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
