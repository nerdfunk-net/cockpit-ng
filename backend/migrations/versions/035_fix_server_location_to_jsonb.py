"""
Migration 035: Force servers.location column type to JSONB via raw SQL.

AutoSchemaMigration (used in 034) only handles ADD COLUMN, not ALTER COLUMN TYPE,
so the location column remained VARCHAR(255). This migration applies the explicit
ALTER TABLE to convert it to JSONB.
"""

from sqlalchemy import inspect, text

from migrations.base import BaseMigration


class Migration(BaseMigration):
    """Convert servers.location from varchar to JSONB."""

    @property
    def name(self) -> str:
        return "035_fix_server_location_to_jsonb"

    @property
    def description(self) -> str:
        return "Convert servers.location column from varchar to JSONB"

    def upgrade(self) -> dict:
        inspector = inspect(self.engine)
        columns = {c["name"]: c for c in inspector.get_columns("servers")}

        if "location" not in columns:
            self.log_info("location column not found — skipping")
            return {"status": "skipped", "reason": "column not found"}

        col_type = str(columns["location"]["type"]).upper()
        if "JSON" in col_type:
            self.log_info("location column is already JSON/JSONB — skipping")
            return {"status": "skipped", "reason": "already jsonb"}

        self.log_info("Converting servers.location from varchar to JSONB...")
        with self.engine.connect() as conn:
            conn.execute(
                text(
                    "ALTER TABLE servers ALTER COLUMN location TYPE JSONB "
                    "USING CASE "
                    "  WHEN location IS NULL OR location = '' OR location = 'null' "
                    "  THEN NULL "
                    "  ELSE location::JSONB "
                    "END"
                )
            )
            conn.commit()

        return {"status": "ok", "changes": ["servers.location: varchar → jsonb"]}
