"""
Migration 024: Add ping_agent and set_primary_ip job template fields

Adds columns needed for:
  - ping_agent job type: ping_agent_id
  - set_primary_ip job type: set_primary_ip_strategy, set_primary_ip_agent_id
"""

from migrations.base import BaseMigration
from sqlalchemy import text

COLUMNS = [
    ("ping_agent_id", "VARCHAR(255)"),
    ("set_primary_ip_strategy", "VARCHAR(50)"),
    ("set_primary_ip_agent_id", "VARCHAR(255)"),
]


class Migration(BaseMigration):
    """Add ping_agent_id and set_primary_ip columns to job_templates table."""

    @property
    def name(self) -> str:
        return "024_add_ping_and_set_primary_ip_fields"

    @property
    def description(self) -> str:
        return (
            "Add ping_agent_id for ping_agent job type and "
            "set_primary_ip_strategy, set_primary_ip_agent_id for set_primary_ip job type "
            "to job_templates table"
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
