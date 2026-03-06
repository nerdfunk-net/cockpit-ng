"""
Migration 020: Add csv_import_defaults to job_templates

Adds a JSON column to store default values used when CSV rows are missing
mandatory Nautobot fields during CSV import. CSV data always takes priority.
"""

from migrations.base import BaseMigration
from sqlalchemy import text

COLUMNS = [
    ("csv_import_defaults", "TEXT"),
]


class Migration(BaseMigration):
    """Add csv_import_defaults column to job_templates table."""

    @property
    def name(self) -> str:
        return "020_add_csv_import_defaults"

    @property
    def description(self) -> str:
        return (
            "Add csv_import_defaults column to job_templates "
            "for fallback values when CSV rows are missing mandatory Nautobot fields"
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
