"""
Database Schema Manager
Handles comparison between defined SQLAlchemy models and actual database schema.
Executes migrations to add missing tables and columns.

Now coordinated with the versioned migration system to avoid conflicts.
"""

from sqlalchemy import inspect, text, Table, Column
from sqlalchemy.engine import Engine
from typing import List, Dict, Any
import logging
from core.database import engine, Base

logger = logging.getLogger(__name__)


class SchemaManager:
    def __init__(self, db_engine: Engine = engine):
        self.engine = db_engine
        self.inspector = inspect(self.engine)

        # Import all models to ensure they're registered with Base.metadata
        # This is required for schema detection to work correctly

        self.metadata = Base.metadata
        logger.info(
            f"SchemaManager initialized with {len(self.metadata.tables)} model definitions"
        )

    def _check_migration_system_exists(self) -> bool:
        """Check if the migration system tracking table exists."""
        return "schema_migrations" in self.inspector.get_table_names()

    def get_applied_migrations(self) -> List[Dict[str, Any]]:
        """
        Get list of migrations that have been applied by the migration system.
        Returns empty list if migration system hasn't been set up yet.
        """
        if not self._check_migration_system_exists():
            return []

        try:
            query = text("""
                SELECT migration_name, applied_at, description, execution_time_ms
                FROM schema_migrations
                ORDER BY migration_name
            """)

            with self.engine.connect() as conn:
                result = conn.execute(query)
                migrations = []
                for row in result:
                    migrations.append(
                        {
                            "name": row[0],
                            "applied_at": row[1].isoformat() if row[1] else None,
                            "description": row[2],
                            "execution_time_ms": row[3],
                        }
                    )
                return migrations
        except Exception as e:
            logger.error(f"Error fetching applied migrations: {e}")
            return []

    def get_schema_status(self) -> Dict[str, Any]:
        """
        Compare defined models with actual database schema.
        Returns a report of missing tables and columns, along with migration system status.
        """
        missing_tables = []
        missing_columns = []

        # Get actual tables in DB
        existing_tables = self.inspector.get_table_names()

        # Check for missing tables
        for table_name, table in self.metadata.tables.items():
            if table_name not in existing_tables:
                missing_tables.append(table_name)
            else:
                # Check for missing columns in existing tables
                self._check_columns(table_name, table, missing_columns)

        is_up_to_date = len(missing_tables) == 0 and len(missing_columns) == 0

        # Check migration system status
        migration_system_active = self._check_migration_system_exists()
        applied_migrations = self.get_applied_migrations()

        # Generate warnings
        warnings = []
        if not migration_system_active:
            warnings.append(
                "Migration system not initialized. Versioned migrations haven't run yet."
            )
        elif is_up_to_date and len(applied_migrations) == 0:
            warnings.append(
                "No versioned migrations have been applied, but schema appears current."
            )
        elif not is_up_to_date:
            warnings.append(
                "Schema differences detected. Consider creating a versioned migration instead of using this tool. "
                "This ensures changes are tracked and reproducible."
            )

        return {
            "is_up_to_date": is_up_to_date,
            "missing_tables": missing_tables,
            "missing_columns": missing_columns,
            "migration_system": {
                "active": migration_system_active,
                "applied_migrations_count": len(applied_migrations),
                "last_migration": applied_migrations[-1]
                if applied_migrations
                else None,
            },
            "warnings": warnings,
        }

    def _check_columns(
        self, table_name: str, table: Table, missing_columns: List[Dict[str, str]]
    ):
        """Check for missing columns in a specific table."""
        existing_columns_info = self.inspector.get_columns(table_name)
        existing_column_names = {col["name"] for col in existing_columns_info}

        for column in table.columns:
            if column.name not in existing_column_names:
                # Determine basic type for display
                col_type = str(column.type)
                missing_columns.append(
                    {
                        "table": table_name,
                        "column": column.name,
                        "type": col_type,
                        "nullable": column.nullable,
                        "default": str(column.default.arg) if column.default else None,
                    }
                )

    def perform_migration(self) -> Dict[str, Any]:
        """
        Execute migrations to fix missing tables and columns.

        WARNING: This is for emergency fixes only. Prefer creating versioned migrations
        in the migrations/versions/ directory for production use.
        """
        status = self.get_schema_status()

        # Add warning if this is being used when migration system is active
        warnings = status.get("warnings", [])
        if status["migration_system"]["active"]:
            warnings.append(
                "You're using manual migration with the versioned migration system active. "
                "Changes made here won't be tracked in schema_migrations table."
            )

        if status["is_up_to_date"]:
            return {
                "success": True,
                "message": "Schema is already up to date.",
                "changes": [],
                "warnings": warnings,
            }

        changes_applied = []
        errors = []

        try:
            # 1. Create missing tables
            if status["missing_tables"]:
                logger.info(f"Creating missing tables: {status['missing_tables']}")
                # Base.metadata.create_all only creates missing tables
                Base.metadata.create_all(bind=self.engine)
                for table in status["missing_tables"]:
                    changes_applied.append(f"Created table: {table}")

            # 2. Add missing columns
            if status["missing_columns"]:
                with self.engine.connect() as conn:
                    for col_info in status["missing_columns"]:
                        table_name = col_info["table"]
                        column_name = col_info["column"]
                        model_table = self.metadata.tables[table_name]
                        column_obj = model_table.columns[column_name]

                        try:
                            # Generate SQL type string from SQLAlchemy type
                            # This is a basic implementation and might need refinement for complex types
                            type_compiler = self.engine.dialect.type_compiler
                            type_str = type_compiler.process(
                                column_obj.type, type_expression=column_obj
                            )

                            # Build ALTER TABLE statement
                            sql = f"ALTER TABLE {table_name} ADD COLUMN {column_name} {type_str}"

                            # Add nullable constraint
                            if not column_obj.nullable:
                                sql += " NOT NULL"

                                # If adding NOT NULL column to table with data, we need a default
                                if column_obj.default:
                                    default_val = self._get_default_value_sql(
                                        column_obj
                                    )
                                    if default_val is not None:
                                        sql += f" DEFAULT {default_val}"

                            # Add default if present (even if nullable)
                            elif column_obj.default:
                                default_val = self._get_default_value_sql(column_obj)
                                if default_val is not None:
                                    sql += f" DEFAULT {default_val}"

                            logger.info(f"Executing: {sql}")
                            conn.execute(text(sql))
                            changes_applied.append(
                                f"Added column: {table_name}.{column_name}"
                            )

                        except Exception as e:
                            error_msg = f"Failed to add column {table_name}.{column_name}: {str(e)}"
                            logger.error(error_msg)
                            errors.append(error_msg)

                    conn.commit()

            return {
                "success": len(errors) == 0,
                "message": "Migration completed"
                if len(errors) == 0
                else "Migration completed with errors",
                "changes": changes_applied,
                "errors": errors,
                "warnings": warnings,
            }

        except Exception as e:
            logger.error(f"Migration failed: {e}")
            return {
                "success": False,
                "message": f"Critical migration error: {str(e)}",
                "changes": changes_applied,
                "errors": [str(e)],
                "warnings": warnings,
            }

    def _get_default_value_sql(self, column: Column) -> Any:
        """Helper to extract SQL-safe default value."""
        arg = column.default.arg
        if isinstance(arg, (str, int, float, bool)):
            if isinstance(arg, str):
                return f"'{arg}'"
            if isinstance(arg, bool):
                return str(arg).lower()  # true/false for postgres
            return arg
        return None  # Skip function-based defaults for now
