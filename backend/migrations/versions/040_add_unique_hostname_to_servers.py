"""
Migration 040: Add unique constraint on servers.hostname

Deduplicates existing rows (keeping the lowest id per hostname) before
applying the constraint. Review duplicates manually on production before running.
"""

from sqlalchemy import inspect, text

from migrations.base import BaseMigration


class Migration(BaseMigration):
    """Add UNIQUE constraint on servers.hostname, deduplicating first."""

    @property
    def name(self) -> str:
        return "040_add_unique_hostname_to_servers"

    @property
    def description(self) -> str:
        return "Add unique constraint on servers.hostname (deduplicates existing rows)"

    def upgrade(self) -> dict:
        inspector = inspect(self.engine)
        constraints = {c["name"] for c in inspector.get_unique_constraints("servers")}
        if "uq_servers_hostname" in constraints:
            self.log_info("uq_servers_hostname already exists — skipping")
            return {"status": "skipped", "reason": "constraint already exists"}

        self.log_info("Deduplicating servers by hostname (keeping lowest id)...")
        with self.engine.connect() as conn:
            result = conn.execute(
                text(
                    "SELECT hostname, COUNT(*) AS cnt FROM servers "
                    "GROUP BY hostname HAVING COUNT(*) > 1"
                )
            )
            duplicates = result.fetchall()
            if duplicates:
                hostnames = [row[0] for row in duplicates]
                self.log_warning(
                    f"Found {len(duplicates)} duplicate hostname(s): {hostnames}"
                )
            conn.execute(
                text(
                    "DELETE FROM servers WHERE id NOT IN "
                    "(SELECT MIN(id) FROM servers GROUP BY hostname)"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE servers "
                    "ADD CONSTRAINT uq_servers_hostname UNIQUE (hostname)"
                )
            )
            conn.commit()

        return {
            "status": "ok",
            "changes": ["servers.hostname: added UNIQUE constraint"],
            "duplicates_removed": len(duplicates),
        }
