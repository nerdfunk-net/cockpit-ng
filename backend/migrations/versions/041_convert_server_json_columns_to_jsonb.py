"""
Migration 041: Convert servers cluster/ansible_facts/selected_interfaces from JSON to JSONB.

servers.location was already converted in migration 035.
"""

from sqlalchemy import inspect, text

from migrations.base import BaseMigration

_COLUMNS = ("cluster", "ansible_facts", "selected_interfaces")


class Migration(BaseMigration):
    """Convert remaining servers JSON columns to JSONB."""

    @property
    def name(self) -> str:
        return "041_convert_server_json_columns_to_jsonb"

    @property
    def description(self) -> str:
        return "Convert servers cluster/ansible_facts/selected_interfaces from JSON to JSONB"

    def upgrade(self) -> dict:
        inspector = inspect(self.engine)
        columns = {c["name"]: c for c in inspector.get_columns("servers")}
        converted = []

        with self.engine.connect() as conn:
            for col in _COLUMNS:
                if col not in columns:
                    self.log_info(f"Column {col} not found — skipping")
                    continue
                col_type = str(columns[col]["type"]).upper()
                if col_type == "JSONB":
                    self.log_info(f"Column {col} is already JSONB — skipping")
                    continue
                self.log_info(f"Converting servers.{col} to JSONB...")
                conn.execute(
                    text(f"ALTER TABLE servers ALTER COLUMN {col} TYPE JSONB USING {col}::JSONB")
                )
                converted.append(col)
            conn.commit()

        return {
            "status": "ok",
            "changes": [f"servers.{c}: json → jsonb" for c in converted],
        }
