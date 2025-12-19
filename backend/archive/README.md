# Archive Directory

This directory contains deprecated and legacy code that has been removed from active use but preserved for reference.

## Contents

### `/legacy_tasks/`
Deprecated Celery tasks and routers that have been replaced:
- `cache_tasks.py` - Old cache task (replaced by Celery Beat periodic tasks)
- `sync_tasks.py` - Old CheckMK sync task
- `ansible_tasks.py` - Old Ansible playbook tasks
- `user_management.py` (router) - Deprecated user management endpoints

**Tasks replaced by:** Job templates with `dispatch_job` task and Celery Beat periodic tasks.
**Router replaced by:** `/api/rbac/users` endpoints in `routers/rbac.py`

### `/migration_scripts/`
One-time database migration scripts (should only be run once):
- `migrate_settings_manager.py` - Converts SQLite to PostgreSQL
- `migrate_permission_names.py` - Renames permission structure
- `migrate_templates_to_db.py` - Moves templates from filesystem to DB
- `migrate_users_to_rbac.py` - Converts old permission bits to RBAC roles

**Status:** These migrations have been completed. Scripts preserved for reference only.

### `/job_tasks_backup/`
Backup of original job tasks implementation:
- `job_tasks_original.py` - Original 1353-line implementation

**Replaced by:** Current `tasks/job_tasks.py` with improved architecture.

## Removal Timeline

All code in this archive was removed on: **December 18-19, 2025**

These files can be permanently deleted after:
- Confirming no production systems rely on legacy tasks
- All migrations have been successfully applied
- New task system is stable in production (6+ months)

## Notes

- Do not import from this archive in active code
- Refer to git history if you need to see the original context
- Consider removing this entire directory after 1 year if not needed
