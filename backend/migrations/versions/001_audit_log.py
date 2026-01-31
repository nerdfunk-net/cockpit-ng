"""
Migration 001: Add audit_logs table

Adds the audit logging table to track user activities and system events.
"""

from migrations.base import BaseMigration
from migrations.auto_schema import AutoSchemaMigration


class Migration(BaseMigration):
    """Add audit_logs table for activity tracking."""

    @property
    def name(self) -> str:
        return "001_audit_log"

    @property
    def description(self) -> str:
        return "Add audit_logs table for tracking user activities and system events"

    def upgrade(self) -> dict:
        """
        Create audit_logs table with all necessary columns and indexes.

        Uses automatic schema detection to create the table based on the
        AuditLog model defined in core/models.py.
        """
        self.log_info("Creating audit_logs table...")

        # Use automatic schema migration to detect and create the table
        auto_migration = AutoSchemaMigration(self.engine, self.base)
        results = auto_migration.run()

        if results.get("tables_created", 0) > 0:
            self.log_info("✓ audit_logs table created successfully")
        else:
            self.log_debug("audit_logs table already exists")

        return results
