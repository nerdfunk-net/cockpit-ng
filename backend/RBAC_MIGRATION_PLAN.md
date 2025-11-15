# RBAC Migration Plan for Endpoints

## Summary

This document outlines the migration of all API endpoints from the old bitwise permission system to the new RBAC system.

## Migration Strategy

### Phase 1: High-Priority Routers (Started)
- [x] `nautobot.py` - Device management (partially done)
  - [x] GET `/devices` → `nautobot.devices:read`
  - [x] PUT `/devices/{id}` → `nautobot.devices:write`
  - [x] POST `/devices/onboard` → `devices.onboard:execute`
  - [ ] POST `/devices/search` → `nautobot.devices:read`
  - [ ] POST `/check-ip` → `nautobot.devices:read`
  - [ ] POST `/sync-network-data` → `nautobot.devices:write`
  - [ ] GET `/locations` → `nautobot.locations:read`
  - [ ] GET `/roles` → `nautobot.devices:read`
  - [ ] GET `/platforms` → `nautobot.devices:read`
  - [ ] GET `/statuses/*` → `nautobot.devices:read`

### Phase 2: Configuration & Git
- [ ] `config.py` - Config backups
  - GET `/configs` → `configs:read`
  - POST `/backup` → `configs.backup:execute`

- [ ] `file_compare.py` - Config comparison
  - GET `/list` → `configs:read`
  - POST `/compare` → `configs.compare:execute`

- [ ] `git_repositories.py` - Git management
  - GET `/` → `git.repositories:read`
  - POST `/` → `git.repositories:write`
  - DELETE `/{id}` → `git.repositories:delete`

### Phase 3: CheckMK
- [ ] `checkmk.py` - CheckMK integration
  - GET `/stats` → `checkmk.devices:read`
  - POST `/sync-devices` → `checkmk.devices:write`
  - DELETE `/devices/{id}` → `checkmk.devices:delete`

### Phase 4: Network Automation
- [ ] `ansible_inventory.py`
  - GET `/` → `network.inventory:read`
  - POST `/generate` → `network.inventory:write`

- [ ] `templates.py`
  - GET `/` → `network.templates:read`
  - POST `/` → `network.templates:write`
  - DELETE `/{id}` → `network.templates:delete`

- [ ] `netmiko.py`
  - POST `/execute` → `network.netmiko:execute`

### Phase 5: Settings & Admin
- [ ] `settings.py` - All settings endpoints
  - GET `/nautobot` → `nautobot.settings:read`
  - PUT `/nautobot` → `nautobot.settings:write`
  - GET `/checkmk` → `checkmk.settings:read`
  - PUT `/checkmk` → `checkmk.settings:write`

- [ ] `credentials.py`
  - GET `/` → `settings.credentials:read`
  - POST `/` → `settings.credentials:write`
  - DELETE `/{id}` → `settings.credentials:delete`

- [ ] `user_management.py`
  - GET `/users` → `users:read`
  - POST `/users` → `users:write`
  - DELETE `/users/{id}` → `users:delete`

- [ ] `cache.py`
  - GET `/stats` → `settings.cache:read`
  - POST `/clear` → `settings.cache:write`

- [ ] `jobs.py`
  - GET `/` → `jobs:read`
  - POST `/` → `jobs:write`
  - DELETE `/{id}` → `jobs:delete`

### Phase 6: Device Operations
- [ ] `scan_and_add.py`
  - POST `/scan` → `scan:execute`
  - POST `/add` → `devices.onboard:execute`

## Permission Mapping Reference

### Old System → New System
- `verify_token` (basic auth) → `require_permission(resource, action)`
- `verify_admin_token` → `require_role("admin")` or specific permission

### Common Patterns

**Read-only endpoints:**
```python
# Old
current_user: dict = Depends(verify_token)

# New
current_user: dict = Depends(require_permission("resource", "read"))
```

**Write endpoints:**
```python
# Old
current_user: dict = Depends(verify_token)

# New
current_user: dict = Depends(require_permission("resource", "write"))
```

**Admin-only endpoints:**
```python
# Old
current_user: dict = Depends(verify_admin_token)

# New
current_user: dict = Depends(require_role("admin"))
# OR more granular
current_user: dict = Depends(require_permission("users", "write"))
```

**Execute operations (scans, backups, etc.):**
```python
# Old
current_user: dict = Depends(verify_token)

# New
current_user: dict = Depends(require_permission("resource.operation", "execute"))
```

## Implementation Steps

1. **Import RBAC dependencies** in each router:
   ```python
   from core.auth import require_permission, require_role
   ```

2. **Replace endpoint dependencies** according to mapping above

3. **Test with different roles:**
   - Admin should have access to everything
   - Operator should have device/config access
   - Network Engineer should have automation access
   - Viewer should only read

4. **Update frontend** to handle 403 errors gracefully

## Testing Checklist

For each endpoint:
- [ ] Admin can access
- [ ] Operator has appropriate access
- [ ] Network Engineer has appropriate access
- [ ] Viewer is restricted appropriately
- [ ] 403 errors return meaningful messages
- [ ] Frontend handles permission errors

## Progress Tracking

- **Total Endpoints**: ~100+
- **Migrated**: 3
- **In Progress**: nautobot.py
- **Remaining**: All other routers

## Next Steps

1. Complete nautobot.py migration
2. Test nautobot endpoints with all roles
3. Move to config/git routers
4. Continue systematically through all routers
