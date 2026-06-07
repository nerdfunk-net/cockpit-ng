# Migration System - Overview

## How It Works

Schema changes are **automatic**. There are no numbered migration files to write.

On startup, `init_db()` calls `AutoSchemaMigration`, which compares the live PostgreSQL schema against the SQLAlchemy models registered in `Base.metadata` and applies any safe differences.

### To add or modify a table

1. **Edit the SQLAlchemy model** in `/backend/core/models/{domain}.py`
2. **Export it** from `/backend/core/models/__init__.py` (if new model)
3. **Restart the app** — tables, columns, and indexes are created automatically

That's it. No migration file required.

---

## File Structure

```
backend/
├── migrations/
│   ├── __init__.py          # Exports AutoSchemaMigration, ColumnDiff, SchemaDiff
│   └── auto_schema.py       # AutoSchemaMigration — detects and applies schema diffs
│
├── core/
│   ├── database.py          # init_db() — runs AutoSchemaMigration on startup
│   ├── schema_manager.py    # SchemaManager — used by API endpoint and sync script
│   └── models/              # SQLAlchemy model definitions (one file per domain)
│
└── scripts/database/
    └── sync.py              # CLI tool for manual inspection and migration
```

---

## What Gets Applied Automatically (on Startup)

| Change | Applied? |
|--------|----------|
| Create missing tables | ✅ Always |
| Add missing columns | ✅ Always |
| Create missing indexes | ✅ Always |
| Safe type widening (e.g. `VARCHAR→TEXT`, `INTEGER→BIGINT`) | ✅ Always |
| Risky type casts (may truncate data) | ⚠ Only when `APPLY_RISKY_DATABASE_MIGRATION=true` |
| Adding `NOT NULL` to nullable column | ⚠ Only when `APPLY_RISKY_DATABASE_MIGRATION=true` |
| Drop extra tables or columns | ❌ Never (use `sync.py --drop` manually) |

---

## CLI Sync Tool

For manual inspection and controlled migrations:

```bash
# From backend/

# Check: report all differences without touching the database
python scripts/database/sync.py

# Apply safe changes (same as startup)
python scripts/database/sync.py --migrate

# Also apply risky type changes (may cause data loss — use with care)
python scripts/database/sync.py --migrate --force

# Drop tables absent from models
python scripts/database/sync.py --migrate --drop

# Drop columns absent from models
python scripts/database/sync.py --migrate --drop-columns

# Focus on a single table
python scripts/database/sync.py --table users
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `APPLY_RISKY_DATABASE_MIGRATION` | `false` | When `true`, also applies risky type casts and NOT NULL additions on startup |

---

## Startup Log Example

```
Initializing database tables...
Loaded 48 model definitions
Schema sync: 1 table(s) created, 2 column(s) added, 3 index(es) created
Database initialized successfully (48 tables)
```

When the schema is already in sync:

```
Initializing database tables...
Loaded 48 model definitions
Database schema is up to date
Database initialized successfully (48 tables)
```

---

## Risky Changes

Changes that could cause data loss are **never applied automatically**. They appear in `sync.py` output as:

```
~ CHANGED   my_table.some_column   VARCHAR(100) → VARCHAR(50)  [risky — use --force to apply]
```

To apply risky changes:
- Manually via CLI: `python scripts/database/sync.py --migrate --force`
- At startup: set `APPLY_RISKY_DATABASE_MIGRATION=true` in `.env` (remove after the deployment)

---

## Production Checklist

Before deploying a model change:

1. Test on a staging database first (`sync.py` check mode)
2. Back up the production database
3. Review risky changes if any
4. Deploy — safe changes apply automatically on startup
5. If risky changes are needed, set `APPLY_RISKY_DATABASE_MIGRATION=true`, deploy, then unset it

---

## Key Components

### `AutoSchemaMigration` (`migrations/auto_schema.py`)
Core engine. Inspects the live database and compares it against `Base.metadata`. Exposes:
- `analyze(table_filter?)` → `SchemaDiff` — read-only diff, no DB changes
- `run()` → stats dict — applies safe changes (tables, columns, indexes)

### `SchemaManager` (`core/schema_manager.py`)
Wraps `AutoSchemaMigration` for use by the API endpoint and the sync script. Adds risky column change application (`perform_migration(force=True)`).

### `scripts/database/sync.py`
CLI for developers and operators. Check mode exits with code 1 if differences exist (useful in CI).
