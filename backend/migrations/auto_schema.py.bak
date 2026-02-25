"""
Automatic schema migration.
Compares SQLAlchemy models with actual database schema and applies changes.
"""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from typing import Dict, Set
import logging

logger = logging.getLogger(__name__)


class AutoSchemaMigration:
    """
    Automatic database schema synchronization.
    Detects missing tables, columns, and indexes and creates them.
    """

    def __init__(self, engine: Engine, base):
        self.engine = engine
        self.base = base
        self.inspector = inspect(engine)

    def get_existing_tables(self) -> Set[str]:
        """Get all existing table names in the database."""
        return set(self.inspector.get_table_names())

    def get_existing_columns(self, table_name: str) -> Set[str]:
        """Get all existing column names for a table."""
        try:
            columns = self.inspector.get_columns(table_name)
            return {col["name"] for col in columns}
        except Exception:
            return set()

    def get_existing_indexes(self, table_name: str) -> Set[str]:
        """Get all existing index names for a table."""
        try:
            indexes = self.inspector.get_indexes(table_name)
            return {idx["name"] for idx in indexes}
        except Exception:
            return set()

    def sqlalchemy_type_to_sql(self, column) -> str:
        """Convert SQLAlchemy column type to PostgreSQL SQL type."""
        from sqlalchemy import (
            Integer,
            String,
            Text,
            Boolean,
            DateTime,
            LargeBinary,
        )

        col_type = column.type

        # Handle String types with length
        if isinstance(col_type, String):
            if col_type.length:
                sql_type = f"VARCHAR({col_type.length})"
            else:
                sql_type = "VARCHAR(255)"
        elif isinstance(col_type, Integer):
            sql_type = "INTEGER"
        elif isinstance(col_type, Text):
            sql_type = "TEXT"
        elif isinstance(col_type, Boolean):
            sql_type = "BOOLEAN"
        elif isinstance(col_type, DateTime):
            if getattr(col_type, "timezone", False):
                sql_type = "TIMESTAMP WITH TIME ZONE"
            else:
                sql_type = "TIMESTAMP"
        elif isinstance(col_type, LargeBinary):
            sql_type = "BYTEA"
        else:
            # Fallback to string representation
            sql_type = str(col_type)

        return sql_type

    def get_column_definition(self, column) -> str:
        """Generate SQL column definition from SQLAlchemy column."""
        sql_type = self.sqlalchemy_type_to_sql(column)

        # Build column definition
        parts = [sql_type]

        # Handle nullable
        if not column.nullable:
            parts.append("NOT NULL")

        # Handle defaults
        if column.default is not None:
            default_value = column.default
            if hasattr(default_value, "arg"):
                # Handle server_default with func.now()
                if "now()" in str(default_value.arg).lower():
                    parts.append("DEFAULT CURRENT_TIMESTAMP")
                elif isinstance(default_value.arg, bool):
                    parts.append(f"DEFAULT {str(default_value.arg).upper()}")
                elif isinstance(default_value.arg, (int, float)):
                    parts.append(f"DEFAULT {default_value.arg}")
                elif isinstance(default_value.arg, str):
                    parts.append(f"DEFAULT '{default_value.arg}'")
        elif column.server_default is not None:
            # Handle server defaults
            default_text = str(column.server_default.arg)
            if "now()" in default_text.lower():
                parts.append("DEFAULT CURRENT_TIMESTAMP")

        return " ".join(parts)

    def create_missing_tables(self) -> int:
        """Create tables that exist in models but not in database."""
        existing_tables = self.get_existing_tables()
        model_tables = set(self.base.metadata.tables.keys())
        missing_tables = model_tables - existing_tables

        if not missing_tables:
            return 0

        created_count = 0
        for table_name in missing_tables:
            # Skip the migration tracking table (created separately)
            if table_name == "schema_migrations":
                continue

            try:
                logger.info(f"Creating missing table: {table_name}")
                table = self.base.metadata.tables[table_name]
                table.create(bind=self.engine)
                created_count += 1
                logger.info(f"✓ Created table: {table_name}")
            except Exception as e:
                logger.error(f"✗ Failed to create table {table_name}: {e}")

        return created_count

    def add_missing_columns(self) -> int:
        """Add columns that exist in models but not in database."""
        existing_tables = self.get_existing_tables()
        added_count = 0

        for table_name, table in self.base.metadata.tables.items():
            # Skip if table doesn't exist yet
            if table_name not in existing_tables:
                continue

            # Skip migration tracking table
            if table_name == "schema_migrations":
                continue

            existing_columns = self.get_existing_columns(table_name)
            model_columns = {col.name: col for col in table.columns}
            missing_columns = set(model_columns.keys()) - existing_columns

            if not missing_columns:
                continue

            for col_name in missing_columns:
                try:
                    column = model_columns[col_name]

                    # Skip primary key columns
                    if column.primary_key:
                        logger.warning(
                            f"Skipping primary key column {col_name} in {table_name}"
                        )
                        continue

                    col_def = self.get_column_definition(column)
                    alter_sql = (
                        f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_def}"
                    )

                    logger.info(f"Adding column {table_name}.{col_name}")
                    logger.debug(f"SQL: {alter_sql}")

                    with self.engine.connect() as conn:
                        conn.execute(text(alter_sql))
                        conn.commit()

                    added_count += 1
                    logger.info(f"✓ Added column: {table_name}.{col_name}")

                except Exception as e:
                    logger.error(f"✗ Failed to add column {table_name}.{col_name}: {e}")

        return added_count

    def create_missing_indexes(self) -> int:
        """Create indexes that exist in models but not in database."""
        existing_tables = self.get_existing_tables()
        created_count = 0

        for table_name, table in self.base.metadata.tables.items():
            # Skip if table doesn't exist
            if table_name not in existing_tables:
                continue

            # Skip migration tracking table
            if table_name == "schema_migrations":
                continue

            existing_indexes = self.get_existing_indexes(table_name)

            # Get model indexes
            for index in table.indexes:
                if index.name and index.name not in existing_indexes:
                    try:
                        logger.info(f"Creating index {index.name} on {table_name}")
                        index.create(bind=self.engine)
                        created_count += 1
                        logger.info(f"✓ Created index: {index.name}")
                    except Exception as e:
                        logger.warning(f"✗ Failed to create index {index.name}: {e}")

        return created_count

    def run(self) -> Dict[str, int]:
        """
        Execute the automatic schema migration.
        Returns statistics about changes made.
        """
        results = {
            "tables_created": 0,
            "columns_added": 0,
            "indexes_created": 0,
        }

        try:
            # Step 1: Create missing tables
            results["tables_created"] = self.create_missing_tables()

            # Step 2: Add missing columns
            results["columns_added"] = self.add_missing_columns()

            # Step 3: Create missing indexes
            results["indexes_created"] = self.create_missing_indexes()

        except Exception as e:
            logger.error(f"Schema migration failed: {e}")
            raise

        return results
