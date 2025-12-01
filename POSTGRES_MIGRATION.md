# SQLite to PostgreSQL Migration Guide

## Overview
This document describes the migration from SQLite to PostgreSQL for the Cockpit-NG application.

## What Has Been Done

### 1. Database Configuration
- Added PostgreSQL settings to `.env` and `.env.example`:
  - `COCKPIT_DATABASE_HOST=localhost`
  - `COCKPIT_DATABASE_PORT=5432`
  - `COCKPIT_DATABASE_NAME=cockpit`
  - `COCKPIT_DATABASE_USERNAME=postgres`
  - `COCKPIT_DATABASE_PASSWORD=postgres`
  - `COCKPIT_DATABASE_SSL=false`

### 2. Dependencies
- Added `psycopg2-binary` to `requirements.txt`
- Updated `config.py` to include PostgreSQL database URL builder

### 3. New Files Created
- `backend/core/database.py` - SQLAlchemy engine and session management
- `backend/core/models.py` - SQLAlchemy ORM models for all tables
- `backend/migrate_to_postgres.py` - Migration script to transfer data from SQLite to PostgreSQL

### 4. Database Schema
Created PostgreSQL schema for:
- Users & Authentication
- RBAC (Roles, Permissions, User-Role mappings)
- Settings
- Credentials
- Templates
- Git Repositories
- Jobs
- NB2CMK Sync
- Compliance Rules & Checks

## Next Steps - Code Refactoring

### Files That Need to Be Updated

The following manager files need to be refactored to use SQLAlchemy instead of sqlite3:

1. **`user_db_manager.py`** - User management (~527 lines)
2. **`rbac_manager.py`** - RBAC management (~835 lines)
3. **`settings_manager.py`** - Application settings (~1286 lines)
4. **`credentials_manager.py`** - Credentials management
5. **`template_manager.py`** - Template management (~857 lines)
6. **`git_repositories_manager.py`** - Git repositories management
7. **`jobs_manager.py`** - Job management
8. **`profile_manager.py`** - User profiles
9. **`compliance_manager.py`** - Compliance management
10. **`services/nb2cmk_database_service.py`** - NB2CMK sync
11. **`services/apscheduler_job_service.py`** - APScheduler jobs

### Migration Strategy

#### Phase 1: Run Data Migration ✓
```bash
cd backend
python migrate_to_postgres.py
```

**Status**: COMPLETED
- Successfully migrated:
  - 1 user
  - 4 roles
  - 49 permissions
  - 118 role permissions
  - 1 user role
  - Settings (11 tables)
  - 2 credentials
  - 0 templates
  - NB2CMK and Compliance data

#### Phase 2: Create Database Repository Layer (RECOMMENDED)
Instead of modifying each manager file individually, create a repository pattern:

Create `backend/repositories/` directory with:
- `user_repository.py` - User CRUD operations using SQLAlchemy
- `rbac_repository.py` - RBAC operations
- `settings_repository.py` - Settings operations
- etc.

This approach:
- Keeps business logic separate from database access
- Makes testing easier
- Allows gradual migration
- Provides type safety with SQLAlchemy models

#### Phase 3: Update Manager Files
Update each manager file to use the new repository layer:
1. Replace `sqlite3.connect()` with `get_db_session()`
2. Replace SQL queries with SQLAlchemy ORM queries
3. Remove all sqlite3 imports and references
4. Update error handling

#### Phase 4: Testing
1. Test each module individually
2. Run integration tests
3. Verify all CRUD operations work
4. Check performance

#### Phase 5: Cleanup
1. Remove all SQLite database files
2. Remove sqlite3 imports from all files
3. Update documentation

## Migration Examples

### Before (SQLite):
```python
import sqlite3

def get_user(username):
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    row = cursor.execute(
        "SELECT * FROM users WHERE username = ?", (username,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None
```

### After (PostgreSQL with SQLAlchemy):
```python
from core.database import get_db_session
from core.models import User

def get_user(username):
    db = get_db_session()
    try:
        user = db.query(User).filter(User.username == username).first()
        return user
    finally:
        db.close()
```

## Important Notes

### ⚠️ Breaking Changes
- All SQLite database paths are no longer used
- Database connection string must be configured in `.env`
- Application requires PostgreSQL to be running

### ✅ Advantages
- Better performance with indexes
- Proper foreign key constraints
- Better concurrent access handling
- Industry-standard database
- Better for production deployments

### 🔧 Rollback Plan
If you need to rollback:
1. SQLite databases are backed up in `data/settings/` (not deleted)
2. Revert changes to manager files
3. Remove PostgreSQL configuration from `.env`

## Testing the Migration

```bash
# 1. Check PostgreSQL connection
python -c "from core.database import check_connection; check_connection()"

# 2. Verify data
python -c "
from core.database import get_db_session
from core.models import User
db = get_db_session()
users = db.query(User).all()
print(f'Found {len(users)} users')
for u in users:
    print(f'  - {u.username} ({u.realname})')
db.close()
"

# 3. Test RBAC
python -c "
from core.database import get_db_session
from core.models import Role, Permission
db = get_db_session()
roles = db.query(Role).all()
print(f'Found {len(roles)} roles')
db.close()
"
```

## Performance Considerations

- Use connection pooling (already configured in `database.py`)
- Add indexes for frequently queried columns (already done in models)
- Use bulk operations for large datasets
- Consider read replicas for scaling

## Security

- Never expose database credentials in logs
- Use environment variables for all sensitive data
- Enable SSL for production databases
- Regular database backups
- Use least-privilege database users

## Contact

If you encounter issues during migration, check:
1. PostgreSQL is running: `pg_isready -h localhost -p 5432`
2. Database exists: `psql -U postgres -l | grep cockpit`
3. Credentials are correct in `.env`
4. Network connectivity to database

## Status

- [x] Configuration files updated
- [x] PostgreSQL driver installed
- [x] Database models created
- [x] Migration script created
- [x] Data migrated successfully
- [ ] Manager files refactored (IN PROGRESS - requires extensive work)
- [ ] All sqlite3 references removed
- [ ] Testing completed
- [ ] Production deployment
