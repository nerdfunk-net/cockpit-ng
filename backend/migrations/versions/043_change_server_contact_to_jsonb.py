"""
Migration 043: Convert servers.contact from varchar to JSONB.
"""

from sqlalchemy import inspect, text

from migrations.base import BaseMigration


class Migration(BaseMigration):
    """Convert servers.contact from varchar to JSONB."""

    @property
    def name(self) -> str:
        return "043_change_server_contact_to_jsonb"

    @property
    def description(self) -> str:
        return "Convert servers.contact column from varchar to JSONB"

    def upgrade(self) -> dict:
        inspector = inspect(self.engine)
        columns = {c["name"]: c for c in inspector.get_columns("servers")}

        if "contact" not in columns:
            self.log_info("contact column not found — skipping")
            return {"status": "skipped", "reason": "column not found"}

        col_type = str(columns["contact"]["type"]).upper()
        if col_type == "JSONB":
            self.log_info("contact column is already JSONB — skipping")
            return {"status": "skipped", "reason": "already jsonb"}

        self.log_info("Converting servers.contact from varchar to JSONB...")
        with self.engine.connect() as conn:
            conn.execute(
                text(
                    "ALTER TABLE servers ALTER COLUMN contact TYPE JSONB "
                    "USING NULL"
                )
            )
            conn.commit()

        return {"status": "ok", "changes": ["servers.contact: varchar → jsonb"]}
