# RBAC (Role-Based Access Control) System Guide

## Overview

The RBAC system provides flexible, granular permission management for the Cockpit application. It supports:

- **Roles**: Collections of permissions (admin, operator, network_engineer, viewer)
- **Permissions**: Fine-grained access control (resource + action combinations)
- **User-Role mapping**: Users can have multiple roles
- **Permission overrides**: Direct permission grants/denials for specific users

## Architecture

```
Users → Roles → Permissions
  ↓
Direct Permission Overrides
```

### Permission Resolution Order

1. **User-specific permission overrides** (highest priority)
2. **Role-based permissions**
3. **Default deny**

## Quick Start

### 1. Initialize RBAC System

```bash
cd backend
python seed_rbac.py
```

This creates:
- 44 permissions across all resources
- 4 system roles with appropriate permissions

### 2. Migrate Existing Users

```bash
python migrate_users_to_rbac.py
```

This assigns roles to existing users based on their old permission bits.

### 3. Use in API Endpoints

```python
from fastapi import Depends
from core.auth import require_permission, require_role

# Require specific permission
@router.get("/api/devices")
async def get_devices(
    user: dict = Depends(require_permission("nautobot.devices", "read"))
):
    return {"devices": []}

# Require role
@router.get("/api/admin")
async def admin_panel(
    user: dict = Depends(require_role("admin"))
):
    return {"message": "Admin panel"}

# Require any of multiple permissions
@router.get("/api/configs")
async def get_configs(
    user: dict = Depends(require_any_permission("configs", ["read", "write"]))
):
    return {"configs": []}
```

## Default Roles

### Admin
- **Permissions**: All 44 permissions
- **Use case**: System administrators
- **Can**: Everything

### Operator
- **Permissions**: 24 permissions
- **Use case**: Daily operations, device management
- **Can**:
  - Manage devices (Nautobot, CheckMK)
  - Backup and compare configs
  - Execute scans and onboarding
  - Read settings (cannot modify)

### Network Engineer
- **Permissions**: 24 permissions
- **Use case**: Network automation and configuration
- **Can**:
  - Full access to network tools (Netmiko, inventory, templates)
  - Manage configs (view, backup, compare)
  - Execute git operations
  - Read/write devices
  - Read settings (cannot modify)

### Viewer
- **Permissions**: 14 read permissions
- **Use case**: Read-only access
- **Can**: View everything, modify nothing

## Permission Structure

Permissions follow the format: `resource:action`

### Resources

- `nautobot.devices` - Nautobot device management
- `nautobot.locations` - Nautobot locations
- `checkmk.devices` - CheckMK device management
- `configs` - Device configurations
- `configs.backup` - Configuration backup
- `configs.compare` - Configuration comparison
- `network.inventory` - Ansible inventory
- `network.templates` - Configuration templates
- `network.netmiko` - Netmiko command execution
- `git.repositories` - Git repository management
- `git.operations` - Git operations
- `settings.nautobot` - Nautobot configuration
- `settings.checkmk` - CheckMK configuration
- `settings.cache` - Cache settings
- `settings.credentials` - Credential management
- `settings.templates` - Template settings
- `scan` - Network scanning
- `devices.onboard` - Device onboarding
- `devices.offboard` - Device offboarding
- `users` - User management
- `jobs` - Job management

### Actions

- `read` - View/list resources
- `write` - Create/update resources
- `delete` - Delete resources
- `execute` - Execute operations (scans, backups, etc.)

## API Endpoints

### Roles

```http
GET    /api/rbac/roles                    # List all roles
POST   /api/rbac/roles                    # Create role (admin)
GET    /api/rbac/roles/{id}               # Get role with permissions
PUT    /api/rbac/roles/{id}               # Update role (admin)
DELETE /api/rbac/roles/{id}               # Delete role (admin)
GET    /api/rbac/roles/{id}/permissions   # Get role permissions
POST   /api/rbac/roles/{id}/permissions   # Assign permission to role (admin)
DELETE /api/rbac/roles/{id}/permissions/{perm_id}  # Remove permission (admin)
```

### Permissions

```http
GET    /api/rbac/permissions              # List all permissions
POST   /api/rbac/permissions              # Create permission (admin)
GET    /api/rbac/permissions/{id}         # Get permission
DELETE /api/rbac/permissions/{id}         # Delete permission (admin)
```

### User Roles

```http
GET    /api/rbac/users/{id}/roles         # Get user's roles
POST   /api/rbac/users/{id}/roles         # Assign role to user (admin)
DELETE /api/rbac/users/{id}/roles/{role_id}  # Remove role (admin)
```

### User Permissions

```http
GET    /api/rbac/users/{id}/permissions   # Get all user permissions
POST   /api/rbac/users/{id}/permissions   # Override permission (admin)
DELETE /api/rbac/users/{id}/permissions/{perm_id}  # Remove override (admin)
```

### Permission Checks

```http
POST   /api/rbac/users/{id}/check-permission  # Check if user has permission
GET    /api/rbac/users/me/permissions     # Get my permissions
POST   /api/rbac/users/me/check-permission  # Check my permission
```

## Usage Examples

### Check Permission Programmatically

```python
from core.auth import has_permission_check

user_id = 1
if has_permission_check(user_id, "nautobot.devices", "write"):
    # User can write devices
    pass
```

### Create Custom Role

```python
import rbac_manager as rbac

# Create role
role = rbac.create_role(
    name="config_admin",
    description="Manages configurations only",
    is_system=False
)

# Get permissions
config_read = rbac.get_permission("configs", "read")
config_backup = rbac.get_permission("configs.backup", "execute")

# Assign permissions
rbac.assign_permission_to_role(role["id"], config_read["id"])
rbac.assign_permission_to_role(role["id"], config_backup["id"])
```

### Assign Role to User

```python
import rbac_manager as rbac

user_id = 5
operator_role = rbac.get_role_by_name("operator")

rbac.assign_role_to_user(user_id, operator_role["id"])
```

### Permission Override

```python
import rbac_manager as rbac

# Grant specific user access to delete credentials (override role)
user_id = 5
perm = rbac.get_permission("settings.credentials", "delete")

rbac.assign_permission_to_user(user_id, perm["id"], granted=True)

# Deny specific user from executing scans (override role)
perm = rbac.get_permission("scan", "execute")
rbac.assign_permission_to_user(user_id, perm["id"], granted=False)
```

### Get User's Effective Permissions

```python
import rbac_manager as rbac

user_id = 1
permissions = rbac.get_user_permissions(user_id)

for perm in permissions:
    print(f"{perm['resource']}:{perm['action']} - {perm['source']}")
```

## Frontend Integration

### Check Permission Before Rendering UI

```typescript
// Fetch user permissions
const response = await apiCall('rbac/users/me/permissions')
const userPermissions = response.permissions

// Check if user has permission
const hasPermission = (resource: string, action: string) => {
  return userPermissions.some(p =>
    p.resource === resource &&
    p.action === action &&
    p.granted
  )
}

// Conditionally render
{hasPermission('nautobot.devices', 'write') && (
  <Button>Add Device</Button>
)}
```

### Hide Menu Items

```typescript
const userRoles = response.roles.map(r => r.name)

{userRoles.includes('admin') && (
  <MenuItem>Admin Panel</MenuItem>
)}
```

## Best Practices

1. **Use roles for common patterns** - Don't assign 50 individual permissions, create a role
2. **Use overrides sparingly** - Only for exceptions to role permissions
3. **Follow least privilege** - Give users minimum required permissions
4. **Audit regularly** - Review who has what access
5. **Use descriptive names** - Make roles and permissions self-documenting
6. **Don't modify system roles** - Create custom roles instead

## Troubleshooting

### Permission Denied Errors

```python
# Check what permissions user has
import rbac_manager as rbac
perms = rbac.get_user_permissions(user_id)
print([f"{p['resource']}:{p['action']}" for p in perms])

# Check specific permission
has_it = rbac.has_permission(user_id, "nautobot.devices", "write")
print(f"Has permission: {has_it}")
```

### User Has No Roles

```bash
# Re-run migration
python migrate_users_to_rbac.py

# Or manually assign
python -c "import rbac_manager as rbac; rbac.assign_role_to_user(USER_ID, ROLE_ID)"
```

### Role Not Working

```python
# Check role permissions
import rbac_manager as rbac
role = rbac.get_role_by_name("operator")
perms = rbac.get_role_permissions(role["id"])
print(f"Role has {len(perms)} permissions")
```

## Database Schema

### Tables

- `roles` - Role definitions
- `permissions` - Permission definitions
- `role_permissions` - Role-permission mappings
- `user_roles` - User-role assignments
- `user_permissions` - User permission overrides

### Files

- `rbac_manager.py` - Core RBAC logic
- `models/rbac.py` - Pydantic models
- `routers/rbac.py` - API endpoints
- `core/auth.py` - Permission checking dependencies
- `seed_rbac.py` - Initialize system
- `migrate_users_to_rbac.py` - Migrate users

## Migration from Old System

The old system used bitwise permissions (1=read, 2=write, 4=admin, etc.)

Mapping:
- `31` (all bits) → `admin` role
- `8+` (has delete) → `operator` role
- `3` (read+write) → `network_engineer` role
- `1` (read only) → `viewer` role

Run `python migrate_users_to_rbac.py` to automatically convert all users.

## Future Enhancements

Potential additions:
- **Resource-level permissions** (e.g., can only edit devices in specific location)
- **Time-based permissions** (temporary access)
- **Permission groups** (collections of related permissions)
- **Audit logging** (who granted what to whom, when)
- **Permission inheritance** (sub-resources inherit parent permissions)
