"""
Migration runner that tracks and executes database migrations.
"""

from sqlalchemy import inspect, text, Column, String, DateTime
from sqlalchemy.orm import Session
from sqlalchemy.engine import Engine
from sqlalchemy.sql import func
import logging
from typing import Dict, List
from datetime import datetime

logger = logging.getLogger(__name__)


class MigrationRunner:
    """
    Manages and executes database migrations.
    Tracks applied migrations in a dedicated table.
    """

    def __init__(self, engine: Engine, base):
        self.engine = engine
        self.base = base
        self.inspector = inspect(engine)

    def ensure_migration_table(self):
        """
        Ensure the migration tracking table exists.
        This table stores which migrations have been applied.
        """
        table_name = "schema_migrations"

        if table_name not in self.inspector.get_table_names():
            logger.info("Creating schema_migrations tracking table")
            create_sql = """
            CREATE TABLE schema_migrations (
                id SERIAL PRIMARY KEY,
                migration_name VARCHAR(255) UNIQUE NOT NULL,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
                description TEXT,
                checksum VARCHAR(64)
            )
            """
            with self.engine.connect() as conn:
                conn.execute(text(create_sql))
                conn.commit()
            logger.info("schema_migrations table created")

    def is_migration_applied(self, migration_name: str) -> bool:
        """Check if a migration has already been applied."""
        query = text(
            "SELECT COUNT(*) FROM schema_migrations WHERE migration_name = :name"
        )

        with self.engine.connect() as conn:
            result = conn.execute(query, {"name": migration_name})
            count = result.scalar()
            return count > 0

    def record_migration(
        self, migration_name: str, description: str = None, checksum: str = None
    ):
        """Record that a migration has been applied."""
        insert_sql = text(
            """
            INSERT INTO schema_migrations (migration_name, description, checksum, applied_at)
            VALUES (:name, :description, :checksum, CURRENT_TIMESTAMP)
            ON CONFLICT (migration_name) DO NOTHING
            """
        )

        with self.engine.connect() as conn:
            conn.execute(
                insert_sql,
                {
                    "name": migration_name,
                    "description": description,
                    "checksum": checksum,
                },
            )
            conn.commit()

    def get_applied_migrations(self) -> List[Dict]:
        """Get list of all applied migrations."""
        query = text(
            """
            SELECT migration_name, applied_at, description
            FROM schema_migrations
            ORDER BY applied_at
            """
        )

        with self.engine.connect() as conn:
            result = conn.execute(query)
            return [
                {
                    "name": row[0],
                    "applied_at": row[1],
                    "description": row[2],
                }
                for row in result
            ]

    def run_migrations(self) -> Dict[str, int]:
        """
        Run all pending migrations.
        Returns statistics about applied migrations.
        """
        logger.info("Starting database migration process...")

        # Ensure migration tracking table exists
        self.ensure_migration_table()

        # Import and run automatic schema migration
        from .auto_schema import AutoSchemaMigration

        migration_name = "auto_schema_sync"
        results = {
            "tables_created": 0,
            "columns_added": 0,
            "indexes_created": 0,
            "migrations_applied": 0,
        }

        # Always run automatic schema migration (it's idempotent)
        try:
            logger.info(f"Running migration: {migration_name}")
            auto_migration = AutoSchemaMigration(self.engine, self.base)
            migration_results = auto_migration.run()

            results["tables_created"] = migration_results.get("tables_created", 0)
            results["columns_added"] = migration_results.get("columns_added", 0)
            results["indexes_created"] = migration_results.get("indexes_created", 0)

            # Record migration (will be skipped if already recorded)
            self.record_migration(
                migration_name,
                description="Automatic schema synchronization",
            )

            total_changes = (
                results["tables_created"]
                + results["columns_added"]
                + results["indexes_created"]
            )

            if total_changes > 0:
                logger.info(
                    f"Migration '{migration_name}' completed: "
                    f"{results['tables_created']} tables, "
                    f"{results['columns_added']} columns, "
                    f"{results['indexes_created']} indexes"
                )
                results["migrations_applied"] = 1
            else:
                logger.info(
                    f"Migration '{migration_name}': No changes needed (schema is up to date)"
                )

        except Exception as e:
            logger.error(f"Migration '{migration_name}' failed: {e}")
            raise

        return results
