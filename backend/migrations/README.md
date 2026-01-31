# Database Migrations

This directory contains the versioned database migration system for Cockpit.

## Overview

The migration system uses numbered migration files that are automatically discovered and executed in order on application startup.

## Directory Structure

```
migrations/
├── __init__.py              # Package exports
├── runner.py                # Migration discovery and execution
├── base.py                  # Base migration class
├── auto_schema.py           # Automatic schema detection utilities
├── versions/                # Migration files (numbered)
│   ├── __init__.py
│   ├── 001_audit_log.py
│   ├── 002_next_feature.py
│   └── ...
├── README.md               # This file
└── AUDIT_LOG_USAGE.md      # Audit logging guide
```

## How It Works

On every application startup:

1. **Migration Runner** scans `migrations/versions/` directory
2. **Discovers** all files matching pattern `NNN_*.py` (e.g., `001_audit_log.py`)
3. **Sorts** migrations by numeric prefix
4. **Checks** `schema_migrations` table to see which have been applied
5. **Executes** pending migrations in order
6. **Records** each migration in `schema_migrations` table

## Migration Tracking

Applied migrations are tracked in the `schema_migrations` table:

```sql
CREATE TABLE schema_migrations (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    execution_time_ms INTEGER
);
```

## Creating a New Migration

### Step 1: Create Migration File

Create a new file in `migrations/versions/` with the next number:

```bash
# Example: Next migration is 002
touch migrations/versions/002_add_user_settings.py
```

**Naming convention:**
- Three-digit prefix: `001`, `002`, `003`, etc.
- Underscore separator: `_`
- Descriptive name: `add_user_settings`, `create_index`, etc.
- Extension: `.py`

### Step 2: Write Migration Class

```python
"""
Migration 002: Add user settings table

Description of what this migration does.
"""

from migrations.base import BaseMigration
from migrations.auto_schema import AutoSchemaMigration


class Migration(BaseMigration):
    """Brief description for logs."""

    @property
    def name(self) -> str:
        return "002_add_user_settings"

    @property
    def description(self) -> str:
        return "Add user_settings table for storing user preferences"

    def upgrade(self) -> dict:
        """
        Apply the migration.

        Returns:
            dict: Statistics (tables_created, columns_added, indexes_created)
        """
        self.log_info("Adding user_settings table...")

        # Option 1: Use automatic schema detection
        auto_migration = AutoSchemaMigration(self.engine, self.base)
        results = auto_migration.run()

        # Option 2: Manual SQL (for complex migrations)
        # from sqlalchemy import text
        # with self.engine.connect() as conn:
        #     conn.execute(text("CREATE TABLE ..."))
        #     conn.commit()
        # results = {"tables_created": 1, "columns_added": 0, "indexes_created": 0}

        return results
```

### Step 3: Update SQLAlchemy Models

Add your new table/columns to `/backend/core/models.py`:

```python
# In /backend/core/models.py

class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    theme = Column(String(50), default="light")
    language = Column(String(10), default="en")
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_user_settings_user_id", "user_id"),
    )
```

### Step 4: Restart Application

```bash
python start.py
```

The migration runs automatically!

## Migration Examples

### Example 1: Simple Table Creation (Automatic)

```python
"""Migration 003: Add api_tokens table"""

from migrations.base import BaseMigration
from migrations.auto_schema import AutoSchemaMigration


class Migration(BaseMigration):
    @property
    def name(self) -> str:
        return "003_api_tokens"

    @property
    def description(self) -> str:
        return "Add api_tokens table for API authentication"

    def upgrade(self) -> dict:
        # Automatic detection creates the table from models.py
        auto_migration = AutoSchemaMigration(self.engine, self.base)
        return auto_migration.run()
```

### Example 2: Adding Columns (Automatic)

```python
"""Migration 004: Add last_login to users"""

from migrations.base import BaseMigration
from migrations.auto_schema import AutoSchemaMigration


class Migration(BaseMigration):
    @property
    def name(self) -> str:
        return "004_user_last_login"

    @property
    def description(self) -> str:
        return "Add last_login column to users table"

    def upgrade(self) -> dict:
        # First, add the column to User model in models.py
        # Then this will auto-detect and add it
        auto_migration = AutoSchemaMigration(self.engine, self.base)
        return auto_migration.run()
```

### Example 3: Manual SQL Migration

```python
"""Migration 005: Custom data migration"""

from migrations.base import BaseMigration
from sqlalchemy import text


class Migration(BaseMigration):
    @property
    def name(self) -> str:
        return "005_populate_defaults"

    @property
    def description(self) -> str:
        return "Populate default values for existing records"

    def upgrade(self) -> dict:
        self.log_info("Updating existing records...")

        with self.engine.connect() as conn:
            # Update existing records
            conn.execute(
                text("UPDATE users SET theme = 'dark' WHERE theme IS NULL")
            )
            conn.commit()

        self.log_info("✓ Updated records successfully")

        return {
            "tables_created": 0,
            "columns_added": 0,
            "indexes_created": 0,
        }
```

## Startup Logs

When migrations run, you'll see:

```
============================================================
Starting database migration process
============================================================
Creating schema_migrations tracking table
✓ schema_migrations table created
Discovered 1 migration file(s)
▶ 001_audit_log: Add audit_logs table for tracking user activities and system events
[001_audit_log] Creating audit_logs table...
[001_audit_log] Creating missing table: audit_logs
[001_audit_log] ✓ Created table: audit_logs
[001_audit_log] Creating index idx_audit_logs_event_type_created_at on audit_logs
[001_audit_log] ✓ Created index: idx_audit_logs_event_type_created_at
✓ 001_audit_log: Completed in 45ms (tables: 1, columns: 0, indexes: 5)
============================================================
Migration summary: 1 migration(s) applied, 1 table(s) created, 0 column(s) added, 5 index(es) created
============================================================
```

On subsequent startups (when all migrations are applied):

```
============================================================
Starting database migration process
============================================================
Discovered 1 migration file(s)
⊘ 001_audit_log: Already applied, skipping
============================================================
Database schema is up to date - no migrations needed
============================================================
```

## Best Practices

### ✅ DO:
- **Always increment numbers** - Use next sequential number (001, 002, 003...)
- **One logical change per migration** - Keep migrations focused
- **Test migrations** - Verify they work on a test database first
- **Use descriptive names** - `002_add_user_settings` not `002_changes`
- **Document complex migrations** - Add comments explaining why
- **Update models.py first** - Then let auto-schema detect changes

### ❌ DON'T:
- **Don't skip numbers** - Use sequential numbers
- **Don't reuse numbers** - Once applied, never change/reuse
- **Don't modify applied migrations** - Create a new migration instead
- **Don't delete applied migrations** - They're in production DBs
- **Don't use git merge conflict markers** - Resolve conflicts properly

## Safety Features

- ✅ **Idempotent** - Migrations track what's applied, safe to run multiple times
- ✅ **Ordered** - Numeric prefix ensures correct execution order
- ✅ **Tracked** - Every migration recorded in database
- ✅ **Logged** - Full execution details in application logs
- ✅ **Atomic** - Each migration runs in a transaction (PostgreSQL)

## Troubleshooting

### Migration fails on startup

**Check the error message:**
- PostgreSQL connection issues?
- Syntax errors in migration file?
- Missing model definitions?

**Manual fix:**
```sql
-- Mark a migration as applied (if you applied it manually)
INSERT INTO schema_migrations (migration_name, description)
VALUES ('002_my_migration', 'Manual application');

-- Remove a failed migration record
DELETE FROM schema_migrations WHERE migration_name = '002_my_migration';
```

### Need to rollback a migration

Migrations are forward-only. To rollback:

1. Write a new migration that reverses the changes
2. Or manually execute SQL to undo changes

```python
# Example: 006_rollback_feature.py
class Migration(BaseMigration):
    def upgrade(self) -> dict:
        with self.engine.connect() as conn:
            conn.execute(text("DROP TABLE IF EXISTS feature_table"))
            conn.commit()
        return {"tables_created": 0, "columns_added": 0, "indexes_created": 0}
```

### Merge conflicts with migration numbers

If two developers create migration `002`:
1. One developer renames theirs to `003`
2. Both migrations get applied in order

## Advanced: Manual Migrations

For complex operations (data migrations, stored procedures, etc.):

```python
from migrations.base import BaseMigration
from sqlalchemy import text


class Migration(BaseMigration):
    @property
    def name(self) -> str:
        return "010_complex_migration"

    @property
    def description(self) -> str:
        return "Complex data transformation"

    def upgrade(self) -> dict:
        self.log_info("Starting complex migration...")

        with self.engine.connect() as conn:
            # Multi-step operation
            conn.execute(text("CREATE TEMP TABLE temp_data AS SELECT ..."))
            conn.execute(text("UPDATE main_table SET ... FROM temp_data ..."))
            conn.execute(text("DROP TABLE temp_data"))
            conn.commit()

        self.log_info("✓ Complex migration completed")

        return {"tables_created": 0, "columns_added": 0, "indexes_created": 0}
```

## Migration Utilities

Available utilities in migration classes:

```python
class Migration(BaseMigration):
    def upgrade(self) -> dict:
        # Logging with automatic prefix
        self.log_info("Info message")      # [001_my_migration] Info message
        self.log_debug("Debug message")    # [001_my_migration] Debug message
        self.log_warning("Warning")        # [001_my_migration] Warning
        self.log_error("Error")            # [001_my_migration] Error

        # Access to engine and base
        self.engine  # SQLAlchemy engine
        self.base    # Declarative base with all models
```

## Future Enhancements

Potential improvements:
- Rollback support with `downgrade()` method
- Migration dry-run mode
- Migration testing framework
- Schema comparison tools
