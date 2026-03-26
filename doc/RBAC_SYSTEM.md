# RBAC System Documentation

## Overview

Cockpit-NG uses a Role-Based Access Control (RBAC) system with three layers:

1. **Role-based permissions** — Users get permissions via assigned roles
2. **Direct user overrides** — Grant or deny permissions per user (highest priority)
3. **Legacy bitmask** — Kept for backward compatibility (avoid in new code)

Permission resolution priority: `User override (grant/deny) > Role permissions > Default deny`

---

## Architecture

```
User
 ├── UserRole (junction) → Role → RolePermission (junction) → Permission
 └── UserPermission (junction) → Permission (direct override, grant or deny)
```

### Key Files

| File | Purpose |
|------|---------|
| `backend/core/models.py` | SQLAlchemy models for all RBAC tables |
| `backend/core/auth.py` | JWT creation, token verification, FastAPI dependencies |
| `backend/rbac_manager.py` | Core permission resolution, role/user management |
| `backend/user_db_manager.py` | User management + legacy bitmask constants |
| `backend/repositories/auth/rbac_repository.py` | Database access layer |
| `backend/models/rbac.py` | Pydantic request/response schemas |
| `backend/routers/settings/rbac.py` | RBAC REST API endpoints |
| `backend/routers/auth/auth.py` | Login, token refresh |
| `backend/routers/auth/oidc.py` | OIDC/SSO integration |
| `backend/tools/seed_rbac.py` | Seeds default roles and permissions at startup |
| `frontend/src/lib/auth-store.ts` | Zustand auth state management |
| `frontend/src/types/auth.ts` | Frontend TypeScript types |

---

## Database Schema

### `users` Table

```python
class User(Base):
    id: int (PK)
    username: str (unique)
    realname: str
    email: str
    password: str (bcrypt hashed)
    permissions: int (legacy bitmask, default=1)
    debug: bool (default=False)
    is_active: bool (default=True)
    last_login: DateTime (nullable)
    created_at: DateTime
    updated_at: DateTime

    # Relationships
    user_roles: List[UserRole]
    user_permissions: List[UserPermission]
```

### `roles` Table

```python
class Role(Base):
    id: int (PK)
    name: str (unique)
    description: str
    is_system: bool (default=False)  # System roles cannot be deleted
    created_at: DateTime
    updated_at: DateTime

    # Relationships
    role_permissions: List[RolePermission]
    user_roles: List[UserRole]
```

### `permissions` Table

```python
class Permission(Base):
    id: int (PK)
    resource: str         # e.g., "nautobot.devices"
    action: str           # e.g., "read"
    description: str
    created_at: DateTime

    # Constraints
    UniqueConstraint("resource", "action")
    Index("idx_permissions_resource", "resource", "action")
```

### `role_permissions` Junction Table

```python
class RolePermission(Base):
    role_id: int (FK → roles.id, CASCADE)
    permission_id: int (FK → permissions.id, CASCADE)
    granted: bool (default=True)  # False = explicit deny (future use)
    created_at: DateTime

    Index("idx_role_permissions_role", "role_id")
```

### `user_roles` Junction Table

```python
class UserRole(Base):
    user_id: int (FK → users.id, CASCADE)
    role_id: int (FK → roles.id, CASCADE)
    created_at: DateTime

    Index("idx_user_roles_user", "user_id")
```

### `user_permissions` Override Table

```python
class UserPermission(Base):
    user_id: int (FK → users.id, CASCADE)
    permission_id: int (FK → permissions.id, CASCADE)
    granted: bool (default=True)  # True=grant, False=deny (overrides role)
    created_at: DateTime

    Index("idx_user_permissions_user", "user_id")
```

---

## Permission Format

Permissions use the format `{resource}:{action}`.

### All Default Permissions (~45 total)

```
# Dashboard
dashboard.settings:read

# Nautobot
nautobot.devices:{read, write, delete}
nautobot.locations:{read, write}
nautobot.export:{execute, read}
nautobot.csv_updates:{read, write, execute}
settings.nautobot:{read, write}

# CheckMK
checkmk.devices:{read, write, delete}
settings.checkmk:{read, write}

# Compliance
settings.compliance:{read, write}
compliance.check:execute

# Configs
configs:read
configs.backup:execute
configs.compare:execute

# Network
network.backup:{read, write}
general.inventory:{read, write, delete}
network.templates:{read, write, delete}
network.netmiko:execute
network.ping:execute

# Snapshots
snapshots:{read, write, delete}

# Git
git.repositories:{read, write, delete}
git.operations:execute

# Devices
scan:execute
devices.onboard:execute
devices.offboard:execute

# Settings
settings.cache:{read, write}
settings.celery:{read, write}
settings.credentials:{read, write, delete}
settings.common:{read, write}
settings.templates:{read, write}

# Users & RBAC
users:{read, write, delete}
users.roles:write
users.permissions:write
rbac.roles:{read, write, delete}
rbac.permissions:read

# Jobs & Agents
jobs:{read, write, delete, execute}
cockpit_agents:{read, execute}

# Logs
general.logs:read
```

---

## Default System Roles

Four system roles are created at startup. System roles (`is_system=True`) cannot be deleted.

### `admin`
- Full access to ALL permissions
- Automatically assigned to the `admin` user at startup

### `operator`
- Manage devices, configs, compliance, backup
- Read-only for system settings
- No access to: RBAC management, user management, git write, celery settings

### `network_engineer`
- Full network operations access
- Read-only for system settings
- Includes: netmiko execute, git operations, onboarding

### `viewer`
- Read-only access to most resources
- No access to: users, settings.credentials, settings.common, RBAC management

---

## JWT Token

### Structure

```json
{
  "sub": "admin",
  "user_id": 1,
  "permissions": 31,
  "exp": 1234567890
}
```

- `sub` — username
- `user_id` — database user ID
- `permissions` — legacy bitmask integer (kept for backward compat)
- `exp` — expiration timestamp

### Legacy Bitmask Constants (`user_db_manager.py`)

```python
PERMISSION_READ         = 1   # 0b00001
PERMISSION_WRITE        = 2   # 0b00010
PERMISSION_ADMIN        = 4   # 0b00100
PERMISSION_DELETE       = 8   # 0b01000
PERMISSION_USER_MANAGE  = 16  # 0b10000

PERMISSIONS_VIEWER = PERMISSION_READ                            # 1
PERMISSIONS_USER   = PERMISSION_READ | PERMISSION_WRITE        # 3
PERMISSIONS_ADMIN  = all flags OR'd                            # 31
```

The bitmask is embedded in the JWT but **permission checks use the RBAC system** (not the bitmask) for all modern endpoints.

---

## Backend Auth Functions

**Location:** `backend/core/auth.py`

### `verify_token(credentials) → dict`
Verifies JWT signature, returns user info dict.

```python
# Returns:
{
    "username": "admin",
    "user_id": 1,
    "permissions": 31  # legacy bitmask
}
# Raises: HTTP 401 if token invalid/expired
```

### `verify_admin_token(user_info) → dict`
Checks legacy bitmask for PERMISSIONS_ADMIN. Use `require_role("admin")` instead for new code.

```python
# Usage (legacy):
@router.delete("/critical")
async def delete_critical(user: dict = Depends(verify_admin_token)):
    pass
```

### `require_permission(resource, action) → Depends`
FastAPI dependency. Verifies token + checks `rbac_manager.has_permission()`.

```python
# Usage:
@router.get(
    "/credentials",
    dependencies=[Depends(require_permission("settings.credentials", "read"))]
)
async def list_credentials():
    pass

# OR to get user_info in function:
@router.post("/credentials")
async def create_credential(
    payload: CredentialCreate,
    user: dict = Depends(require_permission("settings.credentials", "write"))
):
    pass
```

### `require_any_permission(resource, actions) → Depends`
Grants access if user has ANY of the listed actions.

```python
dependencies=[Depends(require_any_permission("nautobot.devices", ["read", "write"]))]
```

### `require_all_permissions(resource, actions) → Depends`
Grants access only if user has ALL listed actions.

```python
dependencies=[Depends(require_all_permissions("settings.credentials", ["read", "write"]))]
```

### `require_role(role_name) → Depends`
Grants access only if user has the specified role. Uses `rbac_manager.get_user_roles()`.

```python
@router.post("/permissions")
async def create_permission(
    permission: PermissionCreate,
    user: dict = Depends(require_role("admin"))
):
    pass
```

### `verify_api_key(x_api_key) → dict`
Validates `X-Api-Key` header. Looks up profile in ProfileRepository.

---

## Permission Resolution Algorithm

**Location:** `backend/rbac_manager.py` → `has_permission(user_id, resource, action)`

```python
def has_permission(user_id: int, resource: str, action: str) -> bool:
    # 1. Look up the permission object by resource:action
    permission = _rbac_repo.get_permission(resource, action)
    if not permission:
        return False  # Unknown permission = deny

    # 2. Check user-level override (highest priority)
    override = _rbac_repo.get_user_permission_override(user_id, permission.id)
    if override is not None:
        return override  # True=grant, False=deny — ignores roles

    # 3. Check all roles assigned to user
    user_roles = _rbac_repo.get_user_roles(user_id)
    for role in user_roles:
        role_permissions = _rbac_repo.get_role_permissions(role.id)
        if any(p.id == permission.id for p in role_permissions):
            return True  # Role grants it

    # 4. Default deny
    return False
```

---

## RBAC Manager API

**Location:** `backend/rbac_manager.py`

### Permissions

```python
create_permission(resource, action, description="") → Permission
get_permission(resource, action) → Permission | None
get_permission_by_id(permission_id) → Permission | None
list_permissions() → List[Permission]
delete_permission(permission_id) → None
```

### Roles

```python
create_role(name, description="", is_system=False) → Role
get_role(role_id) → Role | None
get_role_by_name(name) → Role | None
list_roles() → List[Role]
update_role(role_id, name=None, description=None) → Role
delete_role(role_id) → None  # Raises if is_system=True
```

### Role → Permission Assignment

```python
assign_permission_to_role(role_id, permission_id, granted=True)
remove_permission_from_role(role_id, permission_id)
get_role_permissions(role_id) → List[Permission]
```

### User → Role Assignment

```python
assign_role_to_user(user_id, role_id)
remove_role_from_user(user_id, role_id)
get_user_roles(user_id) → List[Role]
get_users_with_role(role_id) → List[int]  # user IDs
```

### User → Permission Overrides

```python
assign_permission_to_user(user_id, permission_id, granted=True)
remove_permission_from_user(user_id, permission_id)
get_user_permission_overrides(user_id) → List[Permission]
get_user_permissions(user_id) → List[Permission]  # All effective perms
```

### User Management Helpers

```python
get_user_with_rbac(user_id, include_inactive=False) → dict  # includes roles & perms
list_users_with_rbac(include_inactive=True) → List[dict]
create_user_with_roles(username, realname, password, email, role_ids, ...) → User
update_user_profile(user_id, realname=None, email=None, password=None, is_active=None) → User
delete_user_with_rbac(user_id) → bool
bulk_delete_users_with_rbac(user_ids) → (success_count, error_list)
toggle_user_activation(user_id) → User
toggle_user_debug(user_id) → User
check_any_permission(user_id, resource, actions) → bool  # OR
check_all_permissions(user_id, resource, actions) → bool  # AND
```

---

## REST API Endpoints

**Prefix:** `/api/rbac`
**Location:** `backend/routers/settings/rbac.py`

### Permissions

```
GET    /permissions                              List all permissions (auth required)
POST   /permissions                              Create permission (admin role)
GET    /permissions/{permission_id}              Get by ID (auth required)
DELETE /permissions/{permission_id}              Delete (admin role)
```

### Roles

```
GET    /roles                                    List all roles (auth required)
POST   /roles                                    Create role (admin role)
GET    /roles/{role_id}                          Get role with permissions (auth required)
PUT    /roles/{role_id}                          Update role (admin role)
DELETE /roles/{role_id}                          Delete non-system role (admin role)
GET    /roles/{role_id}/permissions              Get role's permissions (auth required)
```

### Role-Permission Assignment

```
POST   /roles/{role_id}/permissions              Assign single permission (admin role)
POST   /roles/{role_id}/permissions/bulk         Assign multiple permissions (admin role)
DELETE /roles/{role_id}/permissions/{perm_id}    Remove permission from role (admin role)
```

### User-Role Assignment

```
GET    /users/{user_id}/roles                    Get user's roles (self or admin)
POST   /users/{user_id}/roles                    Assign single role (admin role)
POST   /users/{user_id}/roles/bulk               Assign multiple roles (admin role)
DELETE /users/{user_id}/roles/{role_id}          Remove role from user (admin role)
```

### User-Permission Overrides

```
GET    /users/{user_id}/permissions              Get effective permissions + overrides
GET    /users/{user_id}/permissions/overrides    Get overrides only (self or admin)
POST   /users/{user_id}/permissions              Assign direct permission override (admin role)
DELETE /users/{user_id}/permissions/{perm_id}    Remove override (admin role)
```

### Permission Checks

```
POST   /users/{user_id}/check-permission         Check if user has a permission
POST   /users/me/check-permission                Check current user's permission
GET    /users/me/permissions                      Get current user's permissions
```

### User Management (via RBAC router)

```
POST   /users                                    Create user with roles (admin role)
GET    /users                                    List all users with RBAC data (auth required)
GET    /users/{user_id}                          Get user with roles/permissions (auth required)
PUT    /users/{user_id}                          Update user profile (admin role)
DELETE /users/{user_id}                          Delete user + all RBAC data (admin role)
PATCH  /users/{user_id}/activate                 Toggle active status (admin role)
PATCH  /users/{user_id}/debug                    Toggle debug mode (admin role)
POST   /users/bulk-delete                        Bulk delete with RBAC cleanup (admin role)
```

---

## API Response Formats

### Login Response (`POST /api/auth/login`)

```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "expires_in": 900,
  "user": {
    "id": 1,
    "username": "admin",
    "realname": "System Administrator",
    "email": "admin@localhost",
    "role": "admin",
    "roles": ["admin"],
    "permissions": [
      {
        "id": 1,
        "resource": "nautobot.devices",
        "action": "read",
        "granted": true,
        "source": "role"
      }
    ],
    "debug": false
  }
}
```

### User with RBAC Response

```json
{
  "id": 1,
  "username": "admin",
  "realname": "System Administrator",
  "email": "admin@localhost",
  "is_active": true,
  "last_login": "2026-03-26T10:30:00Z",
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-03-26T10:30:00Z",
  "roles": [
    {
      "id": 1,
      "name": "admin",
      "description": "Full system administrator",
      "is_system": true,
      "created_at": "2026-01-01T00:00:00Z",
      "updated_at": "2026-01-01T00:00:00Z"
    }
  ],
  "permissions": [
    {
      "id": 1,
      "resource": "nautobot.devices",
      "action": "read",
      "granted": true,
      "source": "role"
    }
  ]
}
```

---

## Frontend Auth

### Zustand Auth Store (`frontend/src/lib/auth-store.ts`)

```typescript
interface AuthState {
  token: string | null
  user: User | null
  isAuthenticated: boolean
  login: (token: string, user: User) => void
  logout: () => void
  setUser: (user: User) => void
  hydrate: () => void  // Load from cookies on app start
}

interface User {
  id: string
  username: string
  email?: string
  roles: string[]
  permissions?: number | Permission[]
}

interface Permission {
  id: number
  resource: string
  action: string
  description?: string
  granted: boolean
  source: 'role' | 'override'
}
```

**Cookie Storage:**
- Token: `cockpit_auth_token` (secure, 1 day TTL)
- User info: `cockpit_user_info` (minimal, no permissions array)
- Permissions are fetched fresh on hydration via token refresh

**Key methods:**
- `login(token, user)` — store token in cookie + Zustand state
- `logout()` — clear state, call backend `/api/proxy/auth/logout`
- `hydrate()` — called on app startup, reads cookies, refreshes token
- `setUser(user)` — update user info without full login

### Checking Permissions in Frontend

```typescript
import { useAuthStore } from '@/lib/auth-store'

// Get user and roles
const user = useAuthStore(state => state.user)
const token = useAuthStore(state => state.token)

// Check by role (simple)
const isAdmin = user?.roles.includes('admin')

// Check specific permission
const canWrite = user?.permissions?.some(
  p => p.resource === 'nautobot.devices' && p.action === 'write' && p.granted
)

// API calls always via proxy (never direct)
fetch('/api/proxy/my-endpoint', {
  headers: { 'Authorization': `Bearer ${token}` }
})
```

---

## OIDC/SSO Integration

**Location:** `backend/routers/auth/oidc.py`

### Endpoints

```
GET  /auth/oidc/enabled                   Check if OIDC is enabled
GET  /auth/oidc/providers                 List available OIDC providers
GET  /auth/oidc/{provider_id}/login       Initiate OIDC login flow (redirect)
POST /auth/oidc/{provider_id}/callback    Handle OIDC callback, issue JWT
```

### OIDC → RBAC Flow

1. User initiates login via OIDC provider
2. Provider redirects back with `code` + `state`
3. Backend exchanges `code` for user info (username, email)
4. Backend looks up or creates user in the `users` table
5. User is assigned default role(s) (or matched to existing roles)
6. Backend issues JWT token with `user_id` and role-based permissions
7. Frontend receives same token format as password login
8. All permission checks proceed normally via RBAC

**Pending Approval:** If approval is required for new OIDC users:

```json
{
  "status": "approval_pending",
  "message": "Account pending administrator approval",
  "username": "john.doe",
  "email": "john@example.com",
  "oidc_provider": "google"
}
```

---

## Startup & Seeding

**Location:** `backend/tools/seed_rbac.py`, `backend/main.py`

### Startup Sequence

1. Load `.env` configuration
2. Initialize database tables (create if missing)
3. Create default `admin` user if no users exist
4. Run RBAC seeding if admin role doesn't exist:
   - Create all ~45 default permissions
   - Create 4 system roles
   - Assign permissions to roles
   - Assign `admin` role to `admin` user
5. Export SSH keys to filesystem
6. Prefetch cache (if enabled in settings)
7. Start uvicorn server

### Seeding Function

```python
# backend/tools/seed_rbac.py
def main(verbose=True, remove_existing=False):
    """
    remove_existing=True: Drops all RBAC data in order:
      user_permissions → user_roles → role_permissions → roles → permissions
    Then recreates everything from scratch.
    """
```

### Re-running Seeding

To reset RBAC to defaults (e.g., after adding new permissions):

```python
# From backend/
from tools.seed_rbac import main
main(verbose=True, remove_existing=True)  # Warning: removes all custom roles/permissions
```

Or for additive update (add new, keep existing):
```python
main(verbose=True, remove_existing=False)
```

---

## How to Extend the RBAC System

### Add a New Permission

1. **Add to `seed_rbac.py`** in the `permissions` list:
   ```python
   ("my.resource", "read", "Read access to my resource"),
   ("my.resource", "write", "Write access to my resource"),
   ```

2. **Assign to roles** in the same file under each role's permission list.

3. **Run seeding** (additive, won't break existing):
   ```python
   from tools.seed_rbac import main
   main(verbose=True, remove_existing=False)
   ```

4. **Protect your endpoint**:
   ```python
   @router.get("/my-resource", dependencies=[Depends(require_permission("my.resource", "read"))])
   async def get_my_resource():
       pass
   ```

### Add a New Role

```python
from rbac_manager import rbac_manager

# Create the role
role = rbac_manager.create_role("network_ops", "Network operations team")

# Get permissions to assign
perms = rbac_manager.list_permissions()
target_perms = [p for p in perms if p.resource.startswith("network.")]

# Assign permissions
for perm in target_perms:
    rbac_manager.assign_permission_to_role(role.id, perm.id)

# Assign role to users
rbac_manager.assign_role_to_user(user_id=5, role_id=role.id)
```

### Grant/Deny a Specific Permission for One User

```python
from rbac_manager import rbac_manager

# Get the permission object
perm = rbac_manager.get_permission("settings.credentials", "delete")

# Grant directly (overrides any role-based deny)
rbac_manager.assign_permission_to_user(user_id=7, permission_id=perm.id, granted=True)

# Or deny directly (overrides any role-based grant)
rbac_manager.assign_permission_to_user(user_id=7, permission_id=perm.id, granted=False)

# Remove override (falls back to role-based)
rbac_manager.remove_permission_from_user(user_id=7, permission_id=perm.id)
```

### Protect a New Router

```python
from fastapi import APIRouter, Depends
from core.auth import require_permission, require_role, verify_token

router = APIRouter(prefix="/my-feature", tags=["My Feature"])

# Read — any authenticated user with the right permission
@router.get("", dependencies=[Depends(require_permission("my.resource", "read"))])
async def list_items():
    pass

# Write — need write permission, also get user info
@router.post("")
async def create_item(payload: MyCreate, user: dict = Depends(require_permission("my.resource", "write"))):
    # user = {"username": "admin", "user_id": 1, "permissions": 31}
    pass

# Admin only
@router.delete("/{item_id}", dependencies=[Depends(require_role("admin"))])
async def delete_item(item_id: int):
    pass
```

---

## Debugging RBAC Issues

### Check User's Effective Permissions

```bash
# Via API
GET /api/rbac/users/me/permissions
GET /api/rbac/users/{user_id}/permissions

# Check a specific permission
POST /api/rbac/users/me/check-permission
Body: {"resource": "nautobot.devices", "action": "write"}
```

### Check via Python

```python
from rbac_manager import rbac_manager

user_id = 5
# List all roles
roles = rbac_manager.get_user_roles(user_id)
print([r.name for r in roles])

# Check permission
has_access = rbac_manager.has_permission(user_id, "nautobot.devices", "write")
print(has_access)

# List all overrides
overrides = rbac_manager.get_user_permission_overrides(user_id)
print(overrides)
```

### Common Issues

| Issue | Likely Cause | Fix |
|-------|-------------|-----|
| HTTP 403 on endpoint | User missing required permission or role | Check user roles, assign correct role |
| HTTP 401 on all requests | JWT expired or invalid | Re-login, check `SECRET_KEY` env var |
| Permission exists but not working | User override is denying it | Check `user_permissions` table for deny override |
| New permission not found | Not seeded or typo in resource name | Run seed, verify resource:action string |
| System role cannot be deleted | `is_system=True` | Cannot delete; remove permissions instead |
| Admin user missing admin role | Seeding didn't run | Run `seed_rbac.main()` manually |

---

## Security Notes

- JWT tokens are signed with `SECRET_KEY` (from `.env`). Rotate this key to invalidate all sessions.
- Token expiration: 900 seconds (15 minutes) by default; override via `ACCESS_TOKEN_EXPIRE_MINUTES`.
- All RBAC-modifying endpoints require the `admin` role (not just any permission).
- `is_system=True` roles cannot be deleted via API.
- Direct user permission overrides should be used sparingly — prefer role-based access.
- The legacy bitmask in JWT is not used for modern permission checks; only the RBAC database is authoritative.
- OIDC users may require admin approval before being activated (configurable per provider).
