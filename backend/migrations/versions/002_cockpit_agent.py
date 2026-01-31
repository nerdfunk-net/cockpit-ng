"""
Migration 002: Add cockpit_agent_commands table

Adds the Cockpit Agent command tracking table for remote command execution audit trail.
"""

from migrations.base import BaseMigration
from migrations.auto_schema import AutoSchemaMigration


class Migration(BaseMigration):
    """Add cockpit_agent_commands table for remote command tracking."""

    @property
    def name(self) -> str:
        return "002_cockpit_agent"

    @property
    def description(self) -> str:
        return "Add cockpit_agent_commands table for tracking remote commands sent to Cockpit agents"

    def upgrade(self) -> dict:
        """
        Create cockpit_agent_commands table with all necessary columns and indexes.

        Uses automatic schema detection to create the table based on the
        CockpitAgentCommand model defined in core/models.py.
        """
        self.log_info("Creating cockpit_agent_commands table...")

        # Use automatic schema migration to detect and create the table
        auto_migration = AutoSchemaMigration(self.engine, self.base)
        results = auto_migration.run()

        if results.get("tables_created", 0) > 0:
            self.log_info("✓ cockpit_agent_commands table created successfully")
        else:
            self.log_debug("cockpit_agent_commands table already exists")

        return results
