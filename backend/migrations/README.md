# Database Migrations

This directory contains the automatic database migration system for Cockpit.

## Overview

The migration system automatically detects and applies schema changes by comparing SQLAlchemy models (defined in `/backend/core/models.py`) with the actual PostgreSQL database schema.

## How It Works

On every application startup, the migration system:

1. **Loads all SQLAlchemy models** from `core/models.py`
2. **Compares with database schema** using SQLAlchemy's inspector
3. **Detects differences**:
   - Missing tables
   - Missing columns in existing tables
   - Missing indexes
4. **Applies changes automatically** (creates tables, adds columns, creates indexes)
5. **Tracks applied migrations** in the `schema_migrations` table

## Architecture

```
migrations/
├── __init__.py          # Package initialization
├── runner.py            # Migration runner (orchestrates migrations)
├── auto_schema.py       # Automatic schema detection and migration
└── README.md           # This file
```

### Migration Tracking

All migrations are tracked in the `schema_migrations` table:

```sql
CREATE TABLE schema_migrations (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    checksum VARCHAR(64)
);
```

## Usage

The migration system runs automatically on application startup via `init_db()` in `/backend/core/database.py`.

No manual intervention is required.

## Adding New Database Changes

To add new tables, columns, or indexes:

1. **Update the SQLAlchemy model** in `/backend/core/models.py`
2. **Restart the application** - migrations run automatically
3. **Check logs** to verify changes were applied

### Example: Adding a New Table

```python
# In /backend/core/models.py

class MyNewTable(Base):
    __tablename__ = "my_new_table"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_my_new_table_name", "name"),
    )
```

Restart the app → Table and index are created automatically.

### Example: Adding a Column

```python
# In existing model in /backend/core/models.py

class AuditLog(Base):
    __tablename__ = "audit_logs"

    # ... existing columns ...

    # Add new column
    session_id = Column(String(255), index=True)  # NEW
```

Restart the app → Column is added automatically.

## What Gets Migrated

✅ **Supported:**
- Creating new tables
- Adding new columns to existing tables
- Creating new indexes
- Column defaults and nullability

❌ **Not Supported (Manual SQL Required):**
- Renaming columns
- Changing column types
- Removing columns
- Complex constraints (check constraints, etc.)
- Data migrations

## Safety Features

The automatic migration system is **additive only**:
- ✅ Creates new tables
- ✅ Adds new columns
- ✅ Creates new indexes
- ❌ **Never removes** anything
- ❌ **Never modifies** existing columns

This ensures existing data is never destroyed.

## Logs

Migration activity is logged during startup:

```
INFO - Initializing database tables...
INFO - Loaded 45 model definitions
INFO - Starting database migration process...
INFO - Creating missing table: audit_logs
INFO - ✓ Created table: audit_logs
INFO - Adding column users.last_login
INFO - ✓ Added column: users.last_login
INFO - Database migration completed: 1 tables created, 1 columns added, 2 indexes created
INFO - Database initialized successfully (45 tables)
```

## Troubleshooting

### Migration fails on startup

Check the error message in the logs. Common issues:
- PostgreSQL connection failure
- Permission issues (user needs CREATE TABLE rights)
- Conflicting column definitions

### Need to rollback a migration

Since migrations are additive only, rollback requires manual SQL:

```sql
-- To remove a column
ALTER TABLE my_table DROP COLUMN my_column;

-- To remove a table
DROP TABLE my_table;
```

Then remove or comment out the corresponding model definition.

## Future Enhancements

Potential improvements:
- Support for data migrations (populate/transform data)
- Migration versioning with explicit version files
- Rollback support
- Migration dry-run mode
- Schema validation warnings
