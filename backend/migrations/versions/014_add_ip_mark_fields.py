"""
Migration 014: Add ip_mark fields to job_templates

Adds three columns that store the configuration for the "mark" action of the
"Maintain IP-Addresses" (ip_addresses) job type.
  ip_mark_status      - Nautobot status UUID to apply to matching IPs
  ip_mark_tag         - Nautobot tag UUID to add to matching IPs
  ip_mark_description - Description text to write to matching IPs
"""

from migrations.base import BaseMigration
from sqlalchemy import text

COLUMNS = [
    ("ip_mark_status",      "VARCHAR(255)"),
    ("ip_mark_tag",         "VARCHAR(255)"),
    ("ip_mark_description", "TEXT"),
]


class Migration(BaseMigration):
    """Add ip_mark_status, ip_mark_tag, ip_mark_description to job_templates."""

    @property
    def name(self) -> str:
        return "014_add_ip_mark_fields"

    @property
    def description(self) -> str:
        return (
            "Add ip_mark_status, ip_mark_tag, ip_mark_description columns to "
            "job_templates for the 'mark' action of the Maintain IP-Addresses job type"
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
                    conn.commit()
                    added += 1

        return {
            "columns_added": added,
            "columns_checked": len(COLUMNS),
            "message": f"Added {added} new column(s) to job_templates",
        }

    def downgrade(self) -> dict:
        dropped = 0
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
                    conn.commit()
                    dropped += 1

        return {
            "columns_dropped": dropped,
            "message": f"Dropped {dropped} column(s) from job_templates",
        }
