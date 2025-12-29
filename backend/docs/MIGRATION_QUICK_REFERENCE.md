# Backend Restructure - Quick Reference Guide

**Quick lookup for file locations during and after migration**

---

## Feature Domain Overview

| Domain | Router Path | Service Path | Repository Path | Description |
|--------|-------------|--------------|-----------------|-------------|
| **Auth** | `routers/auth/` | `services/auth/` | `repositories/auth/` | Authentication, OIDC, profiles |
| **Nautobot** | `routers/nautobot/` | `services/nautobot/` | - | Device management, IPAM |
| **CheckMK** | `routers/checkmk/` | `services/checkmk/` | `repositories/checkmk/` | Monitoring, NB→CMK sync |
| **Network** | `routers/network/` | `services/network/` | - | Configs, automation, compliance |
| **Jobs** | `routers/jobs/` | - | `repositories/jobs/` | Job templates, schedules, runs |
| **Settings** | `routers/settings/` | `services/settings/` | `repositories/settings/` | App settings, Git, credentials |
| **Inventory** | `routers/inventory/` | - | `repositories/inventory/` | Inventory, certificates |

---

## Quick File Finder

### "Where is...?" Lookup

#### Git-Related Files
**Old**: `routers/git*.py` (7 scattered files)
**New**: `routers/settings/git/*.py`
```
git.py                 → settings/git/main.py
git_repositories.py    → settings/git/repositories.py
git_operations.py      → settings/git/operations.py
git_compare.py         → settings/git/compare.py
git_files.py           → settings/git/files.py
git_version_control.py → settings/git/version_control.py
git_debug.py           → settings/git/debug.py
```

#### Job-Related Files
**Old**: `routers/job*.py`, `routers/celery_api.py`
**New**: `routers/jobs/*.py`
```
job_templates.py → jobs/templates.py
job_schedules.py → jobs/schedules.py
job_runs.py      → jobs/runs.py
celery_api.py    → jobs/celery_api.py
```

#### Device Operation Services
**Old**: `services/device_*.py` (7 files)
**New**: `services/nautobot/devices/*.py`, `services/nautobot/configs/*.py`
```
device_creation_service.py → nautobot/devices/creation.py
device_update_service.py   → nautobot/devices/update.py
device_query_service.py    → nautobot/devices/query.py
device_import_service.py   → nautobot/devices/import.py
device_common_service.py   → nautobot/devices/common.py
device_backup_service.py   → nautobot/configs/backup.py
device_config_service.py   → nautobot/configs/config.py
```

#### CheckMK Sync Services
**Old**: `services/nb2cmk_*.py` (3 files)
**New**: `services/checkmk/sync/*.py`
```
nb2cmk_base_service.py       → checkmk/sync/base.py
nb2cmk_background_service.py → checkmk/sync/background.py
nb2cmk_database_service.py   → checkmk/sync/database.py
```

#### Network Automation
**Old**: Various scattered files
**New**: `routers/network/automation/*.py`, `services/network/automation/*.py`
```
routers/ansible_inventory.py  → network/automation/ansible_inventory.py
routers/netmiko.py            → network/automation/netmiko.py
routers/templates.py          → settings/templates.py
services/netmiko_service.py   → network/automation/netmiko.py
services/render_service.py    → network/automation/render.py
```

#### Config Management
**Old**: `routers/file_compare.py`, backup endpoints
**New**: `routers/network/configs/*.py`
```
file_compare.py → network/configs/compare.py
(backup logic) → network/configs/backup.py
(view logic)   → network/configs/view.py
```

#### Compliance
**Old**: `routers/compliance*.py`
**New**: `routers/network/compliance/*.py`, `routers/settings/compliance/*.py`
```
compliance.py       → settings/compliance/rules.py (settings)
compliance_check.py → network/compliance/checks.py (execution)
```

---

## Import Path Changes

### Routers

**Before**:
```python
from routers.git import router as git_router
from routers.git_repositories import router as git_repositories_router
# ... 5 more git imports
```

**After**:
```python
# Option 1: Import from feature __init__.py
from routers.settings.git import router as git_router

# Option 2: Import specific routers
from routers.settings.git.main import router as git_router
from routers.settings.git.repositories import router as git_repositories_router
```

### Services

**Before**:
```python
from services.device_creation_service import DeviceCreationService
from services.device_update_service import DeviceUpdateService
```

**After**:
```python
from services.nautobot.devices.creation import DeviceCreationService
from services.nautobot.devices.update import DeviceUpdateService

# OR if __init__.py re-exports
from services.nautobot.devices import DeviceCreationService, DeviceUpdateService
```

### Repositories

**Before**:
```python
from repositories.user_repository import UserRepository
from repositories.job_template_repository import JobTemplateRepository
```

**After**:
```python
from repositories.auth.user_repository import UserRepository
from repositories.jobs.job_template_repository import JobTemplateRepository

# OR with __init__.py re-exports
from repositories.auth import UserRepository
from repositories.jobs import JobTemplateRepository
```

---

## Domain-Specific Lookups

### Auth Domain
```
routers/auth/
├── auth.py        # Login, logout, refresh, password reset
├── oidc.py        # SSO/OpenID Connect
└── profile.py     # User profile operations

services/auth/
├── user_management.py  # User CRUD
└── oidc.py            # OIDC logic

repositories/auth/
├── user_repository.py
├── rbac_repository.py
└── profile_repository.py
```

### Nautobot Domain
```
routers/nautobot/
├── main.py              # Proxy endpoints
├── devices.py           # Device CRUD
├── interfaces.py        # Interface management
├── ip_addresses.py      # IP management
├── prefixes.py          # Prefix management
├── metadata.py          # Metadata endpoints
└── tools/
    ├── scan_and_add.py
    └── bulk_edit.py

services/nautobot/
├── client.py
├── devices/
│   ├── creation.py
│   ├── update.py
│   ├── query.py
│   ├── import.py
│   └── common.py
├── configs/
│   ├── backup.py
│   └── config.py
├── offboarding.py
└── helpers/
```

### Network Domain
```
routers/network/
├── configs/
│   ├── backup.py
│   ├── compare.py
│   └── view.py
├── automation/
│   ├── ansible_inventory.py
│   ├── netmiko.py
│   └── templates.py
├── compliance/
│   ├── rules.py
│   └── checks.py
└── tools/
    └── ping.py

services/network/
├── automation/
│   ├── ansible_inventory.py
│   ├── netmiko.py
│   └── render.py
├── compliance/
│   └── check.py
└── scanning/
    ├── network_scan.py
    └── scan.py
```

### Settings Domain
```
routers/settings/
├── common.py
├── cache.py
├── credentials.py
├── templates.py
├── rbac.py
├── compliance/
│   ├── rules.py
│   └── checks.py
├── connections/
│   └── config.py
└── git/
    ├── main.py
    ├── repositories.py
    ├── operations.py
    ├── compare.py
    ├── files.py
    ├── version_control.py
    └── debug.py

services/settings/
├── cache.py
└── git/
    ├── service.py
    ├── auth.py
    ├── cache.py
    ├── config.py
    ├── connection.py
    ├── diff.py
    ├── operations.py
    ├── env.py
    ├── paths.py
    └── shared_utils.py
```

---

## Common Import Patterns

### Pattern 1: Direct Import
```python
from routers.settings.git.main import router as git_router
```

### Pattern 2: Import from __init__.py
```python
# If __init__.py re-exports
from routers.settings.git import router as git_router
```

### Pattern 3: Import Multiple
```python
from services.nautobot.devices import (
    DeviceCreationService,
    DeviceUpdateService,
    DeviceQueryService
)
```

### Pattern 4: Import with Alias
```python
from services.checkmk.sync import base as nb2cmk_base
from services.network.automation import netmiko as netmiko_service
```

---

## During Migration

### Mixed State Handling

During migration, you may have both old and new paths:

```python
# Phase 3.1: Git migrated
from routers.settings.git import router as git_router  # NEW

# Phase 3.2: Jobs not yet migrated
from routers.job_templates import router as job_templates_router  # OLD

# This is expected and OK during migration!
```

### Finding Old Imports

```bash
# Find all imports of old git routers
grep -r "from routers.git import" backend/

# Find all imports of device services
grep -r "from services.device_" backend/

# Find specific file imports
grep -r "git_service.py" backend/
```

---

## Rollback Lookup

If you need to rollback:

```bash
# Check git history for old structure
git log --oneline --all -- backend/routers/git.py

# Restore a specific file
git checkout <commit-hash> -- backend/routers/git.py

# Restore entire directory
git checkout <commit-hash> -- backend/routers/
```

---

## API Route Reference

**IMPORTANT**: API routes do NOT change, only internal file organization

| Old File | New File | API Route (unchanged) |
|----------|----------|----------------------|
| `routers/git.py` | `routers/settings/git/main.py` | `/git/*` |
| `routers/job_templates.py` | `routers/jobs/templates.py` | `/job-templates/*` |
| `routers/nautobot.py` | `routers/nautobot/main.py` | `/nautobot/*` |
| `routers/checkmk.py` | `routers/checkmk/main.py` | `/checkmk/*` |

**Frontend calls remain unchanged!** No frontend changes needed.

---

## Help & Support

- **Full Migration Plan**: `/backend/docs/BACKEND_RESTRUCTURE_PLAN.md`
- **Phase 1 Summary**: `/backend/docs/PHASE_1_SUMMARY.md`
- **This Guide**: `/backend/docs/MIGRATION_QUICK_REFERENCE.md`

---

**Last Updated**: 2025-12-29 (Phase 1)
**Next Update**: After Phase 2 (directory structure creation)
