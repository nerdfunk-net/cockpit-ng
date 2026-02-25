"""
Migration runner that discovers and executes versioned migration files.
"""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
import logging
from typing import Dict, List
import importlib
import re
from pathlib import Path

logger = logging.getLogger(__name__)


class MigrationRunner:
    """
    Discovers and executes database migrations from the versions/ directory.
    Tracks applied migrations in the schema_migrations table.
    """

    def __init__(self, engine: Engine, base):
        self.engine = engine
        self.base = base
        self.inspector = inspect(engine)
        self.migrations_dir = Path(__file__).parent / "versions"

    def ensure_migration_table(self):
        """
        Ensure the migration tracking table exists with all required columns.
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
                execution_time_ms INTEGER
            )
            """
            with self.engine.connect() as conn:
                conn.execute(text(create_sql))
                conn.commit()
            logger.info("✓ schema_migrations table created")
        else:
            # Table exists, check if it has all required columns
            existing_columns = {
                col["name"] for col in self.inspector.get_columns(table_name)
            }

            # Add missing columns if needed
            columns_to_add = []

            if "execution_time_ms" not in existing_columns:
                columns_to_add.append(("execution_time_ms", "INTEGER"))

            if "description" not in existing_columns:
                columns_to_add.append(("description", "TEXT"))

            if columns_to_add:
                logger.info("Updating schema_migrations table with missing columns")
                with self.engine.connect() as conn:
                    for col_name, col_type in columns_to_add:
                        alter_sql = f"ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS {col_name} {col_type}"
                        conn.execute(text(alter_sql))
                        logger.debug(f"Added column {col_name} to schema_migrations")
                    conn.commit()
                logger.info("✓ schema_migrations table updated")

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
        self,
        migration_name: str,
        description: str = None,
        execution_time_ms: int = None,
    ):
        """Record that a migration has been applied."""
        insert_sql = text(
            """
            INSERT INTO schema_migrations (migration_name, description, execution_time_ms, applied_at)
            VALUES (:name, :description, :execution_time_ms, CURRENT_TIMESTAMP)
            ON CONFLICT (migration_name) DO NOTHING
            """
        )

        with self.engine.connect() as conn:
            conn.execute(
                insert_sql,
                {
                    "name": migration_name,
                    "description": description,
                    "execution_time_ms": execution_time_ms,
                },
            )
            conn.commit()

    def get_applied_migrations(self) -> List[Dict]:
        """Get list of all applied migrations."""
        query = text(
            """
            SELECT migration_name, applied_at, description
            FROM schema_migrations
            ORDER BY migration_name
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

    def discover_migrations(self) -> List[str]:
        """
        Discover migration files in the versions/ directory.

        Returns:
            List of migration file names sorted by numeric prefix
            e.g., ['001_audit_log.py', '002_add_column.py']
        """
        if not self.migrations_dir.exists():
            logger.warning(f"Migrations directory not found: {self.migrations_dir}")
            return []

        # Find all Python files matching pattern: NNN_*.py
        migration_files = []
        pattern = re.compile(r"^\d{3}_.*\.py$")

        for file in self.migrations_dir.iterdir():
            if (
                file.is_file()
                and pattern.match(file.name)
                and file.name != "__init__.py"
            ):
                migration_files.append(file.name)

        # Sort by numeric prefix
        migration_files.sort()
        return migration_files

    def load_migration(self, filename: str):
        """
        Load a migration module and return its Migration class instance.

        Args:
            filename: e.g., '001_audit_log.py'

        Returns:
            Migration class instance
        """
        module_name = filename[:-3]  # Remove .py extension
        module_path = f"migrations.versions.{module_name}"

        try:
            module = importlib.import_module(module_path)
            migration_class = getattr(module, "Migration")
            return migration_class(self.engine, self.base)
        except Exception as e:
            logger.error(f"Failed to load migration {filename}: {e}")
            raise

    def run_migrations(self) -> Dict[str, int]:
        """
        Discover and run all pending migrations in order.

        Returns:
            Statistics about applied migrations
        """
        logger.info("=" * 60)
        logger.info("Starting database migration process")
        logger.info("=" * 60)

        # Ensure migration tracking table exists
        self.ensure_migration_table()

        # Discover migration files
        migration_files = self.discover_migrations()

        if not migration_files:
            logger.info("No migration files found in versions/ directory")
            return {
                "migrations_applied": 0,
                "tables_created": 0,
                "columns_added": 0,
                "indexes_created": 0,
            }

        logger.info(f"Discovered {len(migration_files)} migration file(s)")

        # Track overall results
        total_results = {
            "migrations_applied": 0,
            "tables_created": 0,
            "columns_added": 0,
            "indexes_created": 0,
        }

        # Execute migrations in order
        for filename in migration_files:
            try:
                # Load migration
                migration = self.load_migration(filename)

                # Check if already applied
                if self.is_migration_applied(migration.name):
                    logger.debug(f"⊘ {migration.name}: Already applied, skipping")
                    continue

                # Execute migration
                logger.info(f"▶ {migration.name}: {migration.description}")

                import time

                start_time = time.time()

                results = migration.upgrade()

                execution_time_ms = int((time.time() - start_time) * 1000)

                # Record migration
                self.record_migration(
                    migration.name,
                    migration.description,
                    execution_time_ms,
                )

                # Update totals
                total_results["migrations_applied"] += 1
                total_results["tables_created"] += results.get("tables_created", 0)
                total_results["columns_added"] += results.get("columns_added", 0)
                total_results["indexes_created"] += results.get("indexes_created", 0)

                logger.info(
                    f"✓ {migration.name}: Completed in {execution_time_ms}ms "
                    f"(tables: {results.get('tables_created', 0)}, "
                    f"columns: {results.get('columns_added', 0)}, "
                    f"indexes: {results.get('indexes_created', 0)})"
                )

            except Exception as e:
                logger.error(f"✗ Migration {filename} failed: {e}")
                raise

        # Summary
        logger.info("=" * 60)
        if total_results["migrations_applied"] > 0:
            logger.info(
                f"Migration summary: "
                f"{total_results['migrations_applied']} migration(s) applied, "
                f"{total_results['tables_created']} table(s) created, "
                f"{total_results['columns_added']} column(s) added, "
                f"{total_results['indexes_created']} index(es) created"
            )
        else:
            logger.info("Database schema is up to date - no migrations needed")
        logger.info("=" * 60)

        return total_results
