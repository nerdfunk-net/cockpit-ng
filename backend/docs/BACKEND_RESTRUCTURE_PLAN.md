# Backend Directory Restructure Plan

## Overview

This document outlines the complete plan to reorganize the backend directory structure to mirror the frontend's feature-based organization and align with the application's sidebar navigation.

**Goal**: Transform flat directory structure into feature-based organization for better maintainability, discoverability, and consistency with frontend.

**Status**: Phase 1 - Planning & Documentation
**Started**: 2025-12-29
**Estimated Duration**: 6-7 days

---

## Migration Phases

### Phase 1: Plan & Document ✅ (Day 1)
**Status**: In Progress

**Tasks**:
- [x] Create this migration plan
- [ ] Document all file mappings (old → new paths)
- [ ] Update CLAUDE.md with new structure
- [ ] Get team/stakeholder approval
- [ ] Create checkpoint/backup strategy

**Deliverables**:
- Migration plan document (this file)
- Updated CLAUDE.md
- File mapping reference
- Rollback procedure

---

### Phase 2: Create Directory Structure (Day 2)
**Status**: Not Started

**Tasks**:
- [ ] Create new directory structure (empty directories)
- [ ] Add `__init__.py` files with proper re-exports
- [ ] Verify import structure (no actual moves yet)
- [ ] Create test harness to verify imports work

**Validation**:
- All new directories exist
- All `__init__.py` files are valid Python
- Import paths are accessible (even though empty)

**Rollback**: Simple - delete new directories

---

### Phase 3: Migrate Routers (Days 3-4)
**Status**: Not Started

**Migration Order** (low-risk to high-risk):

#### 3.1: Settings/Git Domain (Highest Priority)
**Files to Move**: 7 files
```
routers/git.py                    → routers/settings/git/main.py
routers/git_repositories.py       → routers/settings/git/repositories.py
routers/git_operations.py         → routers/settings/git/operations.py
routers/git_compare.py            → routers/settings/git/compare.py
routers/git_files.py              → routers/settings/git/files.py
routers/git_version_control.py    → routers/settings/git/version_control.py
routers/git_debug.py              → routers/settings/git/debug.py
```

**Validation**: Run git-related API endpoints, verify all routes work

#### 3.2: Jobs Domain
**Files to Move**: 4 files
```
routers/job_templates.py          → routers/jobs/templates.py
routers/job_schedules.py          → routers/jobs/schedules.py
routers/job_runs.py               → routers/jobs/runs.py
routers/celery_api.py             → routers/jobs/celery_api.py
```

**Validation**: Test job creation, scheduling, and execution

#### 3.3: Settings Domain (excluding git)
**Files to Move**: 8 files
```
routers/settings.py               → routers/settings/common.py
routers/cache.py                  → routers/settings/cache.py
routers/credentials.py            → routers/settings/credentials.py
routers/templates.py              → routers/settings/templates.py
routers/rbac.py                   → routers/settings/rbac.py
routers/config.py                 → routers/settings/connections/config.py
routers/compliance.py             → routers/settings/compliance/rules.py
routers/compliance_check.py       → routers/settings/compliance/checks.py
```

**Validation**: Test settings pages, credential management, RBAC

#### 3.4: Network Domain
**Files to Move**: 7 files
```
routers/file_compare.py           → routers/network/configs/compare.py
routers/ansible_inventory.py      → routers/network/automation/ansible_inventory.py
routers/netmiko.py                → routers/network/automation/netmiko.py
routers/tools.py                  → routers/network/tools/ping.py
```

**Note**: Some endpoints may need to be split from existing files
- backup functionality → `routers/network/configs/backup.py`
- config viewing → `routers/network/configs/view.py`

**Validation**: Test config backup, comparison, netmiko connections, ping

#### 3.5: Nautobot Domain
**Files to Move**: 3 files + reorganize existing subdirectory
```
routers/nautobot.py               → routers/nautobot/main.py (proxy endpoints)
routers/scan_and_add.py           → routers/nautobot/tools/scan_and_add.py

routers/nautobot_endpoints/       → routers/nautobot/ (merge up)
  devices.py                      → routers/nautobot/devices.py
  dcim_interfaces.py              → routers/nautobot/interfaces.py
  ipam_addresses.py               → routers/nautobot/ip_addresses.py
  ipam_prefixes.py                → routers/nautobot/prefixes.py
  ipam_ip_address_to_interface.py → routers/nautobot/ip_interface_mapping.py
  metadata.py                     → routers/nautobot/metadata.py
```

**Additional**: Consider adding these endpoints
```
routers/nautobot/export.py        (from export functionality)
routers/nautobot/sync.py          (from sync functionality)
```

**Validation**: Test device CRUD, IP management, sync operations

#### 3.6: CheckMK Domain
**Files to Move**: 2 files
```
routers/checkmk.py                → routers/checkmk/main.py
routers/nb2cmk.py                 → routers/checkmk/sync.py
```

**Validation**: Test CheckMK host management, NB→CMK sync

#### 3.7: Auth Domain
**Files to Move**: 3 files
```
routers/auth.py                   → routers/auth/auth.py
routers/oidc.py                   → routers/auth/oidc.py
routers/profile.py                → routers/auth/profile.py
```

**Validation**: Test login, OIDC, profile operations (CRITICAL - test thoroughly)

#### 3.8: Inventory Domain
**Files to Move**: 2 files
```
routers/inventory.py              → routers/inventory/main.py
routers/certificates.py           → routers/inventory/certificates.py
```

**Validation**: Test inventory management, certificate operations

---

### Phase 4: Migrate Services (Day 5)
**Status**: Not Started

**Migration Order**: Follow same domain grouping as routers

#### 4.1: Settings/Git Services
```
services/git_service.py           → services/settings/git/service.py
services/git_auth_service.py      → services/settings/git/auth.py
services/git_cache_service.py     → services/settings/git/cache.py
services/git_config_service.py    → services/settings/git/config.py
services/git_connection_service.py → services/settings/git/connection.py
services/git_diff_service.py      → services/settings/git/diff.py
services/git_operations_service.py → services/settings/git/operations.py
services/git_env.py               → services/settings/git/env.py
services/git_paths.py             → services/settings/git/paths.py
services/git_shared_utils.py      → services/settings/git/shared_utils.py
```

#### 4.2: Nautobot Services
```
services/nautobot.py              → services/nautobot/client.py

# Device operations
services/device_creation_service.py → services/nautobot/devices/creation.py
services/device_update_service.py   → services/nautobot/devices/update.py
services/device_query_service.py    → services/nautobot/devices/query.py
services/device_import_service.py   → services/nautobot/devices/import.py
services/device_common_service.py   → services/nautobot/devices/common.py

# Config operations
services/device_backup_service.py   → services/nautobot/configs/backup.py
services/device_config_service.py   → services/nautobot/configs/config.py

# Offboarding
services/offboarding_service.py     → services/nautobot/offboarding.py

# Keep helpers directory as-is
services/nautobot_helpers/          → services/nautobot/helpers/
```

#### 4.3: CheckMK Services
```
services/checkmk.py                     → services/checkmk/client.py
services/cmk_config_service.py          → services/checkmk/config.py
services/cmk_device_normalization_service.py → services/checkmk/normalization.py
services/cmk_folder_service.py          → services/checkmk/folder.py

# Sync services
services/nb2cmk_base_service.py         → services/checkmk/sync/base.py
services/nb2cmk_background_service.py   → services/checkmk/sync/background.py
services/nb2cmk_database_service.py     → services/checkmk/sync/database.py
```

#### 4.4: Network Services
```
# Automation
services/ansible_inventory.py           → services/network/automation/ansible_inventory.py
services/netmiko_service.py             → services/network/automation/netmiko.py
services/render_service.py              → services/network/automation/render.py

# Compliance
services/compliance_check_service.py    → services/network/compliance/check.py

# Scanning
services/network_scan_service.py        → services/network/scanning/network_scan.py
services/scan_service.py                → services/network/scanning/scan.py
```

#### 4.5: Auth Services
```
services/user_management.py             → services/auth/user_management.py
services/oidc_service.py                → services/auth/oidc.py
```

#### 4.6: Settings Services
```
services/cache_service.py               → services/settings/cache.py
```

**Validation**: Run full test suite after each domain migration

---

### Phase 5: Migrate Repositories (Day 5)
**Status**: Not Started

**Migration Strategy**: Group repositories by domain

```
# Auth
repositories/user_repository.py         → repositories/auth/user_repository.py
repositories/rbac_repository.py         → repositories/auth/rbac_repository.py
repositories/profile_repository.py      → repositories/auth/profile_repository.py

# Jobs
repositories/job_template_repository.py → repositories/jobs/job_template_repository.py
repositories/job_schedule_repository.py → repositories/jobs/job_schedule_repository.py
repositories/job_run_repository.py      → repositories/jobs/job_run_repository.py

# Settings
repositories/settings_repository.py     → repositories/settings/settings_repository.py
repositories/credentials_repository.py  → repositories/settings/credentials_repository.py
repositories/git_repository_repository.py → repositories/settings/git_repository_repository.py
repositories/template_repository.py     → repositories/settings/template_repository.py

# Compliance
repositories/compliance_repository.py   → repositories/compliance/compliance_repository.py

# Inventory
repositories/inventory_repository.py    → repositories/inventory/inventory_repository.py

# CheckMK
repositories/nb2cmk_repository.py       → repositories/checkmk/nb2cmk_repository.py

# Keep base.py at root
repositories/base.py                    → repositories/base.py
```

**Validation**: Test database operations for each domain

---

### Phase 6: Update main.py Router Registrations (Day 6)
**Status**: Not Started

**Tasks**:
- [ ] Update all router imports in `main.py`
- [ ] Verify router prefixes are correct
- [ ] Test all API endpoints
- [ ] Update API documentation if needed

**Example Changes**:
```python
# OLD
from routers.git import router as git_router
from routers.git_repositories import router as git_repositories_router
# ... 7 separate imports

# NEW
from routers.settings.git import (
    main_router as git_router,
    repositories_router,
    operations_router,
    compare_router,
    files_router,
    version_control_router,
    debug_router
)

# OR import from __init__.py
from routers.settings.git import router as git_router
```

**Validation**:
- Backend starts without import errors
- All routes are registered (check with FastAPI docs at /docs)
- All API endpoints respond correctly

---

### Phase 7: Update Documentation (Day 6-7)
**Status**: Not Started

**Tasks**:
- [ ] Update CLAUDE.md with new file structure
- [ ] Update all import examples in documentation
- [ ] Update development setup guides
- [ ] Update architecture diagrams if any
- [ ] Create import reference guide for common patterns

**Files to Update**:
- `/CLAUDE.md` (main tech stack documentation)
- `/backend/README.md` (if exists)
- `/doc/**/*.md` (all documentation files)
- API documentation
- Development guides

---

### Phase 8: Cleanup & Finalization (Day 7)
**Status**: Not Started

**Tasks**:
- [ ] Remove old empty directories
- [ ] Verify no broken imports remain
- [ ] Run full test suite
- [ ] Update CI/CD pipelines if needed
- [ ] Performance check (ensure no regression)
- [ ] Create migration summary document

**Final Validation Checklist**:
- [ ] All API endpoints work correctly
- [ ] All frontend pages load and function
- [ ] Authentication/authorization works
- [ ] Database operations succeed
- [ ] Background jobs (Celery) work
- [ ] OIDC login works
- [ ] All tests pass
- [ ] No import errors in logs
- [ ] Documentation is up-to-date

---

## Complete File Mapping Reference

### Routers Migration Map

| Current Path | New Path | Domain |
|-------------|----------|--------|
| `routers/git.py` | `routers/settings/git/main.py` | Settings/Git |
| `routers/git_repositories.py` | `routers/settings/git/repositories.py` | Settings/Git |
| `routers/git_operations.py` | `routers/settings/git/operations.py` | Settings/Git |
| `routers/git_compare.py` | `routers/settings/git/compare.py` | Settings/Git |
| `routers/git_files.py` | `routers/settings/git/files.py` | Settings/Git |
| `routers/git_version_control.py` | `routers/settings/git/version_control.py` | Settings/Git |
| `routers/git_debug.py` | `routers/settings/git/debug.py` | Settings/Git |
| `routers/job_templates.py` | `routers/jobs/templates.py` | Jobs |
| `routers/job_schedules.py` | `routers/jobs/schedules.py` | Jobs |
| `routers/job_runs.py` | `routers/jobs/runs.py` | Jobs |
| `routers/celery_api.py` | `routers/jobs/celery_api.py` | Jobs |
| `routers/settings.py` | `routers/settings/common.py` | Settings |
| `routers/cache.py` | `routers/settings/cache.py` | Settings |
| `routers/credentials.py` | `routers/settings/credentials.py` | Settings |
| `routers/templates.py` | `routers/settings/templates.py` | Settings |
| `routers/rbac.py` | `routers/settings/rbac.py` | Settings |
| `routers/config.py` | `routers/settings/connections/config.py` | Settings |
| `routers/compliance.py` | `routers/settings/compliance/rules.py` | Settings |
| `routers/compliance_check.py` | `routers/settings/compliance/checks.py` | Settings |
| `routers/file_compare.py` | `routers/network/configs/compare.py` | Network |
| `routers/ansible_inventory.py` | `routers/network/automation/ansible_inventory.py` | Network |
| `routers/netmiko.py` | `routers/network/automation/netmiko.py` | Network |
| `routers/tools.py` | `routers/network/tools/ping.py` | Network |
| `routers/nautobot.py` | `routers/nautobot/main.py` | Nautobot |
| `routers/scan_and_add.py` | `routers/nautobot/tools/scan_and_add.py` | Nautobot |
| `routers/nautobot_endpoints/devices.py` | `routers/nautobot/devices.py` | Nautobot |
| `routers/nautobot_endpoints/dcim_interfaces.py` | `routers/nautobot/interfaces.py` | Nautobot |
| `routers/nautobot_endpoints/ipam_addresses.py` | `routers/nautobot/ip_addresses.py` | Nautobot |
| `routers/nautobot_endpoints/ipam_prefixes.py` | `routers/nautobot/prefixes.py` | Nautobot |
| `routers/nautobot_endpoints/ipam_ip_address_to_interface.py` | `routers/nautobot/ip_interface_mapping.py` | Nautobot |
| `routers/nautobot_endpoints/metadata.py` | `routers/nautobot/metadata.py` | Nautobot |
| `routers/checkmk.py` | `routers/checkmk/main.py` | CheckMK |
| `routers/nb2cmk.py` | `routers/checkmk/sync.py` | CheckMK |
| `routers/auth.py` | `routers/auth/auth.py` | Auth |
| `routers/oidc.py` | `routers/auth/oidc.py` | Auth |
| `routers/profile.py` | `routers/auth/profile.py` | Auth |
| `routers/inventory.py` | `routers/inventory/main.py` | Inventory |
| `routers/certificates.py` | `routers/inventory/certificates.py` | Inventory |

### Services Migration Map

| Current Path | New Path | Domain |
|-------------|----------|--------|
| `services/git_service.py` | `services/settings/git/service.py` | Settings/Git |
| `services/git_auth_service.py` | `services/settings/git/auth.py` | Settings/Git |
| `services/git_cache_service.py` | `services/settings/git/cache.py` | Settings/Git |
| `services/git_config_service.py` | `services/settings/git/config.py` | Settings/Git |
| `services/git_connection_service.py` | `services/settings/git/connection.py` | Settings/Git |
| `services/git_diff_service.py` | `services/settings/git/diff.py` | Settings/Git |
| `services/git_operations_service.py` | `services/settings/git/operations.py` | Settings/Git |
| `services/git_env.py` | `services/settings/git/env.py` | Settings/Git |
| `services/git_paths.py` | `services/settings/git/paths.py` | Settings/Git |
| `services/git_shared_utils.py` | `services/settings/git/shared_utils.py` | Settings/Git |
| `services/nautobot.py` | `services/nautobot/client.py` | Nautobot |
| `services/device_creation_service.py` | `services/nautobot/devices/creation.py` | Nautobot |
| `services/device_update_service.py` | `services/nautobot/devices/update.py` | Nautobot |
| `services/device_query_service.py` | `services/nautobot/devices/query.py` | Nautobot |
| `services/device_import_service.py` | `services/nautobot/devices/import.py` | Nautobot |
| `services/device_common_service.py` | `services/nautobot/devices/common.py` | Nautobot |
| `services/device_backup_service.py` | `services/nautobot/configs/backup.py` | Nautobot |
| `services/device_config_service.py` | `services/nautobot/configs/config.py` | Nautobot |
| `services/offboarding_service.py` | `services/nautobot/offboarding.py` | Nautobot |
| `services/checkmk.py` | `services/checkmk/client.py` | CheckMK |
| `services/cmk_config_service.py` | `services/checkmk/config.py` | CheckMK |
| `services/cmk_device_normalization_service.py` | `services/checkmk/normalization.py` | CheckMK |
| `services/cmk_folder_service.py` | `services/checkmk/folder.py` | CheckMK |
| `services/nb2cmk_base_service.py` | `services/checkmk/sync/base.py` | CheckMK |
| `services/nb2cmk_background_service.py` | `services/checkmk/sync/background.py` | CheckMK |
| `services/nb2cmk_database_service.py` | `services/checkmk/sync/database.py` | CheckMK |
| `services/ansible_inventory.py` | `services/network/automation/ansible_inventory.py` | Network |
| `services/netmiko_service.py` | `services/network/automation/netmiko.py` | Network |
| `services/render_service.py` | `services/network/automation/render.py` | Network |
| `services/compliance_check_service.py` | `services/network/compliance/check.py` | Network |
| `services/network_scan_service.py` | `services/network/scanning/network_scan.py` | Network |
| `services/scan_service.py` | `services/network/scanning/scan.py` | Network |
| `services/user_management.py` | `services/auth/user_management.py` | Auth |
| `services/oidc_service.py` | `services/auth/oidc.py` | Auth |
| `services/cache_service.py` | `services/settings/cache.py` | Settings |

### Repositories Migration Map

| Current Path | New Path | Domain |
|-------------|----------|--------|
| `repositories/user_repository.py` | `repositories/auth/user_repository.py` | Auth |
| `repositories/rbac_repository.py` | `repositories/auth/rbac_repository.py` | Auth |
| `repositories/profile_repository.py` | `repositories/auth/profile_repository.py` | Auth |
| `repositories/job_template_repository.py` | `repositories/jobs/job_template_repository.py` | Jobs |
| `repositories/job_schedule_repository.py` | `repositories/jobs/job_schedule_repository.py` | Jobs |
| `repositories/job_run_repository.py` | `repositories/jobs/job_run_repository.py` | Jobs |
| `repositories/settings_repository.py` | `repositories/settings/settings_repository.py` | Settings |
| `repositories/credentials_repository.py` | `repositories/settings/credentials_repository.py` | Settings |
| `repositories/git_repository_repository.py` | `repositories/settings/git_repository_repository.py` | Settings |
| `repositories/template_repository.py` | `repositories/settings/template_repository.py` | Settings |
| `repositories/compliance_repository.py` | `repositories/compliance/compliance_repository.py` | Compliance |
| `repositories/inventory_repository.py` | `repositories/inventory/inventory_repository.py` | Inventory |
| `repositories/nb2cmk_repository.py` | `repositories/checkmk/nb2cmk_repository.py` | CheckMK |

---

## Rollback Strategy

### Quick Rollback (if caught early)
1. Git revert to commit before migration started
2. Restart backend server
3. Verify functionality

### Partial Rollback (mid-migration)
1. Keep completed domains
2. Copy back files from git history for incomplete domains
3. Update `main.py` imports to use mix of old/new paths
4. Continue migration later

### Emergency Rollback
1. Git reset to last known good commit
2. Force restore from backup if needed
3. Document what went wrong
4. Plan remediation

---

## Testing Strategy

### Per-Domain Testing (after each migration)
1. **Unit Tests**: Run domain-specific tests
2. **Integration Tests**: Test cross-domain interactions
3. **API Tests**: Hit all endpoints in domain with Postman/curl
4. **Frontend Tests**: Verify UI pages that use these endpoints
5. **Manual QA**: Test critical user flows

### Full Testing (after complete migration)
1. Run entire test suite
2. Full regression testing
3. Load testing (verify no performance regression)
4. Security scan (verify no new vulnerabilities)
5. Accessibility check (if applicable)

### Test Environments
- **Local Development**: First validation
- **Staging**: Full integration testing
- **Production**: Deploy with rollback plan ready

---

## Success Criteria

### Technical Success
- [ ] All files moved to new structure
- [ ] All imports updated correctly
- [ ] All tests pass
- [ ] No import errors in logs
- [ ] API documentation updated
- [ ] No performance regression

### Business Success
- [ ] Zero downtime during migration
- [ ] No broken functionality
- [ ] Improved developer velocity
- [ ] Reduced onboarding time for new developers
- [ ] Better code discoverability

---

## Risk Assessment

### High Risk Areas
1. **Auth Domain**: Critical path, test thoroughly
2. **Main.py Router Registration**: Single point of failure
3. **Circular Imports**: May emerge during reorganization
4. **Database Migrations**: If any schema changes needed

### Mitigation Strategies
1. Migrate auth domain last (after practice with others)
2. Validate main.py router registration after each domain
3. Run import checker after each move
4. Avoid schema changes during this migration
5. Keep backups at each phase
6. Test in staging before production
7. Have rollback plan ready

---

## Communication Plan

### Before Migration
- Notify team of planned migration
- Share this document
- Get approval from stakeholders
- Schedule migration window

### During Migration
- Daily status updates
- Slack notifications before each phase
- Immediate notification if issues arise
- Document any deviations from plan

### After Migration
- Summary email/message
- Update team wiki/docs
- Retrospective meeting
- Celebrate success! 🎉

---

## Notes

### Decisions Made
- Git domain chosen as proof-of-concept (7 scattered files)
- Following same feature grouping as frontend
- Using `main.py` or domain name for main routers
- Keeping `__init__.py` files for clean imports

### Open Questions
- Should we consolidate router exports in `__init__.py`?
- Do we need API versioning during this change?
- Should we update API route paths or keep them the same?
  - **Decision**: Keep route paths the same, only change file organization

### Lessons Learned
(To be filled during migration)

---

## Appendix

### Useful Commands

```bash
# Find all imports of a specific module
grep -r "from routers.git import" backend/

# Check for circular imports
python -c "import routers.settings.git"

# Run specific domain tests
pytest backend/tests/test_git*.py

# Verify all routes are registered
# Visit: http://localhost:8000/docs

# Check for unused imports
ruff check backend/ --select F401

# Format code after migration
ruff format backend/
```

### Reference Links
- FastAPI Router Documentation
- Python Import System
- Project CLAUDE.md

---

**Document Version**: 1.0
**Last Updated**: 2025-12-29
**Next Review**: After Phase 1 completion
