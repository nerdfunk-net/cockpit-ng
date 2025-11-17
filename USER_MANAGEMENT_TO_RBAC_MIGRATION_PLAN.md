# User Management to RBAC Migration Plan

## Executive Summary

This document outlines the plan to migrate remaining `/user-management` endpoints to the `/api/rbac` system. The RBAC system is already in place and provides role-based access control, but user CRUD operations are still handled by the legacy `/user-management` router.

**Goal**: Consolidate all user and permission management under the `/api/rbac` endpoints to create a unified, modern permission system.

---

## Current State Analysis

### `/user-management` Endpoints (Legacy System)

**Router**: `backend/routers/user_management.py`  
**Prefix**: `/user-management`  
**Database**: `data/settings/users.db` (managed by `user_db_manager.py`)  
**Permission System**: Old bitwise permission flags (PERMISSION_READ, PERMISSION_WRITE, etc.)

#### Endpoints:
1. **GET `/user-management`** - List all users
2. **POST `/user-management`** - Create new user
3. **GET `/user-management/{user_id}`** - Get specific user
4. **PUT `/user-management/{user_id}`** - Update user
5. **DELETE `/user-management/{user_id}`** - Delete user (hard delete)
6. **POST `/user-management/bulk-action`** - Bulk operations (delete, update permissions)
7. **PATCH `/user-management/{user_id}/toggle-status`** - Toggle user active status

#### Key Features:
- User CRUD operations
- Old role system (admin, user, viewer, custom)
- Bitwise permission flags (5 flags: READ, WRITE, ADMIN, DELETE, USER_MANAGE)
- Bulk operations
- User activation/deactivation
- Password management (hashing)
- Debug mode flag

#### Models (from `models/user_management.py`):
- `UserCreate` - username, realname, email, password, role, debug
- `UserUpdate` - realname, email, password, role, permissions, debug, is_active
- `UserResponse` - Full user data with role
- `UserRole` enum - admin, user, viewer, custom
- `BulkUserAction` - Bulk operations model

---

### `/api/rbac` Endpoints (Modern System)

**Router**: `backend/routers/rbac.py`  
**Prefix**: `/api/rbac`  
**Database**: `data/settings/rbac.db` (managed by `rbac_manager.py`)  
**Permission System**: Modern granular permissions (resource:action format)

#### Endpoints:

**Permissions:**
1. **GET `/api/rbac/permissions`** - List all permissions
2. **POST `/api/rbac/permissions`** - Create permission (admin only)
3. **GET `/api/rbac/permissions/{permission_id}`** - Get specific permission
4. **DELETE `/api/rbac/permissions/{permission_id}`** - Delete permission (admin only)

**Roles:**
5. **GET `/api/rbac/roles`** - List all roles
6. **POST `/api/rbac/roles`** - Create role (admin only)
7. **GET `/api/rbac/roles/{role_id}`** - Get role with permissions
8. **PUT `/api/rbac/roles/{role_id}`** - Update role (admin only)
9. **DELETE `/api/rbac/roles/{role_id}`** - Delete role (admin only)
10. **GET `/api/rbac/roles/{role_id}/permissions`** - Get role permissions
11. **POST `/api/rbac/roles/{role_id}/permissions`** - Assign permission to role
12. **POST `/api/rbac/roles/{role_id}/permissions/bulk`** - Bulk assign permissions
13. **DELETE `/api/rbac/roles/{role_id}/permissions/{permission_id}`** - Remove permission from role

**User-Role Assignments:**
14. **GET `/api/rbac/users/{user_id}/roles`** - Get user's roles
15. **POST `/api/rbac/users/{user_id}/roles`** - Assign role to user
16. **POST `/api/rbac/users/{user_id}/roles/bulk`** - Bulk assign roles
17. **DELETE `/api/rbac/users/{user_id}/roles/{role_id}`** - Remove role from user

**User-Permission Overrides:**
18. **GET `/api/rbac/users/{user_id}/permissions`** - Get all user permissions
19. **GET `/api/rbac/users/{user_id}/permissions/overrides`** - Get permission overrides
20. **POST `/api/rbac/users/{user_id}/permissions`** - Override permission for user
21. **DELETE `/api/rbac/users/{user_id}/permissions/{permission_id}`** - Remove permission override

**Permission Checks:**
22. **POST `/api/rbac/users/{user_id}/check-permission`** - Check if user has permission
23. **GET `/api/rbac/users/me/permissions`** - Get current user's permissions
24. **POST `/api/rbac/users/me/check-permission`** - Check current user's permission

#### Key Features:
- Granular permission management (44 permissions across all resources)
- Flexible role system (system roles + custom roles)
- User-role mapping (many-to-many)
- Direct permission overrides
- Permission inheritance from roles
- Permission checks and queries

#### What's Missing in RBAC:
- ❌ **No user CRUD operations** (create, read, update, delete users)
- ❌ **No user listing endpoint**
- ❌ **No user profile management** (realname, email, password)
- ❌ **No user activation/deactivation**
- ❌ **No bulk user operations**
- ❌ **No debug mode flag management**
- ❌ **No direct user creation with initial roles**

---

## Database Structure Analysis

### Users Database (`users.db`)
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    realname TEXT NOT NULL,
    email TEXT,
    password TEXT NOT NULL,  -- bcrypt hashed
    permissions INTEGER NOT NULL DEFAULT 1,  -- Legacy bitwise flags
    debug INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
)
```

**Notes**:
- Contains actual user accounts
- Stores passwords (hashed)
- Legacy `permissions` field (should be deprecated)
- `debug` flag for enabling debug mode per user
- `is_active` for account activation

### RBAC Database (`rbac.db`)
```sql
-- Roles table
CREATE TABLE roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    is_system INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
)

-- Permissions table
CREATE TABLE permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(resource, action)
)

-- Role-Permission mapping
CREATE TABLE role_permissions (
    role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    granted INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    PRIMARY KEY (role_id, permission_id)
)

-- User-Role mapping
CREATE TABLE user_roles (
    user_id INTEGER NOT NULL,  -- References users.db users.id
    role_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, role_id)
)

-- User-Permission overrides
CREATE TABLE user_permissions (
    user_id INTEGER NOT NULL,  -- References users.db users.id
    permission_id INTEGER NOT NULL,
    granted INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, permission_id)
)
```

**Notes**:
- Separate database for RBAC data
- `user_id` in RBAC tables references `users.id` from users.db
- Modern permission model
- No user account data stored here

---

## Gap Analysis

### What `/user-management` Has That `/api/rbac` Doesn't:

1. **User CRUD Operations**
   - Create user with username, password, email, realname
   - List all users (with/without inactive)
   - Get user by ID
   - Update user profile (realname, email, password)
   - Delete user (hard delete)
   - Toggle user active status

2. **User Profile Fields**
   - `username` (unique identifier)
   - `realname` (display name)
   - `email`
   - `password` (hashed)
   - `is_active` (account activation)
   - `debug` (debug mode flag)
   - `created_at`, `updated_at` timestamps

3. **Bulk Operations**
   - Bulk delete users
   - Bulk update permissions

4. **Password Management**
   - Secure password hashing (bcrypt)
   - Password updates
   - Password verification (used in auth)

5. **User Activation**
   - Enable/disable user accounts
   - Toggle status endpoint

### What `/api/rbac` Has That Could Be Enhanced:

1. **Advanced Permission Management**
   - ✅ Granular permissions (already implemented)
   - ✅ Role-based assignments (already implemented)
   - ✅ Permission overrides (already implemented)
   - ⚠️ Could add: Get all users with specific permission
   - ⚠️ Could add: Get all users with specific role

2. **User-Centric Queries**
   - ⚠️ Could add: Search users by name/email
   - ⚠️ Could add: Filter users by role
   - ⚠️ Could add: Filter users by permission
   - ⚠️ Could add: Get user activity status

---

## Migration Strategy

### Option 1: Add User CRUD to `/api/rbac` (Recommended)

**Approach**: Extend the RBAC router with user management endpoints while maintaining backward compatibility.

**Pros**:
- Unified API under `/api/rbac`
- Modern, consistent permission model
- Easier to maintain long-term
- Clear separation from old system

**Cons**:
- Requires frontend updates
- Temporary duplication during migration

**New Endpoints to Add**:
```
POST   /api/rbac/users                    # Create user with roles
GET    /api/rbac/users                    # List all users
GET    /api/rbac/users/{user_id}          # Get user details + roles
PUT    /api/rbac/users/{user_id}          # Update user profile
DELETE /api/rbac/users/{user_id}          # Delete user
PATCH  /api/rbac/users/{user_id}/activate # Toggle activation
PATCH  /api/rbac/users/{user_id}/debug    # Toggle debug mode
POST   /api/rbac/users/bulk-delete        # Bulk delete users
```

### Option 2: Keep Separate but Modernize (Not Recommended)

**Approach**: Keep `/user-management` but update it to use RBAC roles instead of bitwise permissions.

**Pros**:
- Less disruptive to frontend
- Faster initial implementation

**Cons**:
- Maintains fragmentation
- Confusing to have two user-related endpoints
- Harder to maintain
- Doesn't achieve the stated goal

### Option 3: Hybrid Approach (Not Recommended)

**Approach**: Keep `/user-management` for basic CRUD, use `/api/rbac` for permission/role management.

**Pros**:
- Clear separation of concerns

**Cons**:
- API is split across two routers
- Confusing for API consumers
- Difficult to manage relationships

---

## Recommended Implementation Plan

### Phase 1: Extend RBAC Models (Backend)

**File**: `backend/models/rbac.py`

Add new models for user management:

```python
class UserBase(BaseModel):
    """Base user model."""
    username: str = Field(..., min_length=3, max_length=50)
    realname: str = Field(..., min_length=1, max_length=100)
    email: Optional[str] = Field(None, max_length=255)
    debug: bool = Field(False, description="Enable debug mode for user")
    is_active: bool = Field(True, description="User account active status")

class UserCreate(UserBase):
    """Model for creating a new user."""
    password: str = Field(..., min_length=8)
    role_ids: List[int] = Field(default_factory=list, description="Initial roles to assign")

class UserUpdate(BaseModel):
    """Model for updating a user."""
    realname: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[str] = Field(None, max_length=255)
    password: Optional[str] = Field(None, min_length=8)
    debug: Optional[bool] = None
    is_active: Optional[bool] = None

class UserResponse(UserBase):
    """Full user model with ID and metadata."""
    id: int
    created_at: str
    updated_at: str
    roles: List[Role] = Field(default_factory=list)
    permissions: List[PermissionWithGrant] = Field(default_factory=list)

class UserListResponse(BaseModel):
    """User list response."""
    users: List[UserResponse]
    total: int

class BulkUserDelete(BaseModel):
    """Bulk delete users."""
    user_ids: List[int] = Field(..., min_items=1)
```

### Phase 2: Add User CRUD to RBAC Manager (Backend)

**File**: `backend/rbac_manager.py`

Add functions that bridge to user_db_manager:

```python
def create_user_with_roles(
    username: str,
    realname: str,
    password: str,
    email: Optional[str] = None,
    role_ids: List[int] = None,
    debug: bool = False,
    is_active: bool = True
) -> Dict[str, Any]:
    """Create user and assign roles in one transaction."""
    # Create user in users.db
    user = user_db.create_user(...)
    
    # Assign roles in rbac.db
    if role_ids:
        for role_id in role_ids:
            assign_role_to_user(user["id"], role_id)
    
    return user

def get_user_with_rbac(user_id: int) -> Optional[Dict[str, Any]]:
    """Get user with their roles and effective permissions."""
    user = user_db.get_user_by_id(user_id)
    if not user:
        return None
    
    user["roles"] = get_user_roles(user_id)
    user["permissions"] = get_user_permissions(user_id)
    return user

def list_users_with_rbac(include_inactive: bool = True) -> List[Dict[str, Any]]:
    """List all users with their roles."""
    users = user_db.get_all_users(include_inactive)
    for user in users:
        user["roles"] = get_user_roles(user["id"])
    return users

def update_user_profile(
    user_id: int,
    realname: Optional[str] = None,
    email: Optional[str] = None,
    password: Optional[str] = None,
    debug: Optional[bool] = None,
    is_active: Optional[bool] = None
) -> Optional[Dict[str, Any]]:
    """Update user profile (delegates to user_db_manager)."""
    return user_db.update_user(...)

def delete_user_with_rbac(user_id: int) -> bool:
    """Delete user and all RBAC associations."""
    # Remove all role assignments
    roles = get_user_roles(user_id)
    for role in roles:
        remove_role_from_user(user_id, role["id"])
    
    # Remove all permission overrides
    overrides = get_user_permission_overrides(user_id)
    for override in overrides:
        remove_permission_from_user(user_id, override["id"])
    
    # Delete user from users.db
    return user_db.hard_delete_user(user_id)

def bulk_delete_users_with_rbac(user_ids: List[int]) -> Tuple[int, List[str]]:
    """Bulk delete users with RBAC cleanup."""
    success_count = 0
    errors = []
    
    for user_id in user_ids:
        try:
            if delete_user_with_rbac(user_id):
                success_count += 1
            else:
                errors.append(f"User {user_id} not found")
        except Exception as e:
            errors.append(f"User {user_id}: {str(e)}")
    
    return success_count, errors

def toggle_user_activation(user_id: int) -> Optional[Dict[str, Any]]:
    """Toggle user active status."""
    user = user_db.get_user_by_id(user_id, include_inactive=True)
    if not user:
        return None
    return user_db.update_user(user_id, is_active=not user["is_active"])

def toggle_user_debug(user_id: int) -> Optional[Dict[str, Any]]:
    """Toggle user debug mode."""
    user = user_db.get_user_by_id(user_id)
    if not user:
        return None
    return user_db.update_user(user_id, debug=not user["debug"])
```

### Phase 3: Add User Endpoints to RBAC Router (Backend)

**File**: `backend/routers/rbac.py`

Add new endpoints to the existing RBAC router:

```python
# ============================================================================
# User Management Endpoints
# ============================================================================

@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate, 
    current_user: dict = Depends(require_role("admin"))
):
    """Create a new user with initial role assignments (admin only)."""
    try:
        user = rbac.create_user_with_roles(
            username=user_data.username,
            realname=user_data.realname,
            password=user_data.password,
            email=user_data.email,
            role_ids=user_data.role_ids,
            debug=user_data.debug,
            is_active=user_data.is_active
        )
        
        # Get full user with roles
        user_with_rbac = rbac.get_user_with_rbac(user["id"])
        return user_with_rbac
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/users", response_model=UserListResponse)
async def list_users(
    include_inactive: bool = True,
    current_user: dict = Depends(require_permission("users", "read"))
):
    """List all users with their roles."""
    users = rbac.list_users_with_rbac(include_inactive)
    return UserListResponse(users=users, total=len(users))


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int, 
    current_user: dict = Depends(require_permission("users", "read"))
):
    """Get user details with roles and permissions."""
    user = rbac.get_user_with_rbac(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="User not found"
        )
    return user


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    current_user: dict = Depends(require_permission("users", "write"))
):
    """Update user profile (admin only)."""
    user = rbac.update_user_profile(
        user_id=user_id,
        realname=user_data.realname,
        email=user_data.email,
        password=user_data.password,
        debug=user_data.debug,
        is_active=user_data.is_active
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="User not found"
        )
    
    # Get full user with roles
    return rbac.get_user_with_rbac(user_id)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int, 
    current_user: dict = Depends(require_permission("users", "delete"))
):
    """Delete a user and all RBAC associations (admin only)."""
    success = rbac.delete_user_with_rbac(user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="User not found"
        )


@router.patch("/users/{user_id}/activate", response_model=UserResponse)
async def toggle_user_activation(
    user_id: int, 
    current_user: dict = Depends(require_permission("users", "write"))
):
    """Toggle user active status."""
    user = rbac.toggle_user_activation(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="User not found"
        )
    return rbac.get_user_with_rbac(user_id)


@router.patch("/users/{user_id}/debug", response_model=UserResponse)
async def toggle_user_debug(
    user_id: int, 
    current_user: dict = Depends(require_permission("users", "write"))
):
    """Toggle user debug mode."""
    user = rbac.toggle_user_debug(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="User not found"
        )
    return rbac.get_user_with_rbac(user_id)


@router.post("/users/bulk-delete", status_code=status.HTTP_200_OK)
async def bulk_delete_users(
    bulk_data: BulkUserDelete,
    current_user: dict = Depends(require_permission("users", "delete"))
):
    """Bulk delete users with RBAC cleanup."""
    success_count, errors = rbac.bulk_delete_users_with_rbac(bulk_data.user_ids)
    return {
        "success_count": success_count,
        "errors": errors,
        "message": f"Successfully deleted {success_count} users"
    }
```

### Phase 4: Update Frontend Components

**Files to Update**:
1. `frontend/src/components/settings/user-management.tsx`
2. `frontend/src/components/settings/permissions/users-manager.tsx`
3. `frontend/src/components/settings/permissions/user-roles-manager.tsx`
4. `frontend/src/components/settings/permissions/user-permissions-manager.tsx`

**Changes**:
1. Replace `apiCall('user-management')` with `apiCall('api/rbac/users')`
2. Replace `apiCall('user-management/{id}')` with `apiCall('api/rbac/users/{id}')`
3. Replace `apiCall('user-management/bulk-action')` with `apiCall('api/rbac/users/bulk-delete')`
4. Replace `apiCall('user-management/{id}/toggle-status')` with `apiCall('api/rbac/users/{id}/activate')`
5. Update response models to match new structure (includes roles array)
6. Update create/edit forms to select roles instead of single role

**Example Change** (user-management.tsx):

```typescript
// OLD
const response = await apiCall<{users: User[], total: number}>('user-management')

// NEW
const response = await apiCall<{users: User[], total: number}>('api/rbac/users')

// OLD
await apiCall(`user-management/${userId}/toggle-status`, { method: 'PATCH' })

// NEW
await apiCall(`api/rbac/users/${userId}/activate`, { method: 'PATCH' })

// OLD - Create user with single role
await apiCall('user-management', {
  method: 'POST',
  body: JSON.stringify({
    username: formData.username,
    realname: formData.realname,
    email: formData.email,
    password: formData.password,
    role: formData.role,  // Single role enum
    debug: formData.debug
  })
})

// NEW - Create user with role IDs
await apiCall('api/rbac/users', {
  method: 'POST',
  body: JSON.stringify({
    username: formData.username,
    realname: formData.realname,
    email: formData.email,
    password: formData.password,
    role_ids: selectedRoleIds,  // Array of role IDs
    debug: formData.debug,
    is_active: true
  })
})
```

### Phase 5: Deprecate Old Endpoint (Backend)

**File**: `backend/routers/user_management.py`

Add deprecation warnings to all endpoints:

```python
@router.get("", response_model=UserListResponse, deprecated=True)
async def list_users(current_user: dict = Depends(require_permission("users", "write"))):
    """
    DEPRECATED: Use /api/rbac/users instead.
    This endpoint will be removed in a future version.
    """
    logger.warning("DEPRECATED: /user-management endpoint called. Use /api/rbac/users instead.")
    # ... existing implementation
```

Eventually (after frontend migration is complete):
- Comment out the router include in `main.py`
- Remove the router file after a deprecation period

### Phase 6: Update Documentation

**Files to Update**:
1. `PERMISSIONS.md` - Update endpoint references
2. `backend/RBAC_GUIDE.md` - Add user management examples
3. `ENDPOINT_USAGE.md` - Update API paths
4. `.github/instructions/copilot-instructions.md` - Update architecture docs

---

## Permission Requirements

### New Permissions Needed

The existing permissions are sufficient:
- `users:read` - View users (already exists)
- `users:write` - Create/modify users (already exists)
- `users:delete` - Delete users (already exists)

No new permissions need to be created.

### Permission Enforcement

All new endpoints will use the existing RBAC permission system:
- User listing: Requires `users:read`
- User creation: Requires `users:write`
- User updates: Requires `users:write`
- User deletion: Requires `users:delete`
- Bulk operations: Requires `users:delete`

---

## Testing Strategy

### Unit Tests
1. Test user creation with role assignment
2. Test user listing with role data
3. Test user update preserves roles
4. Test user deletion cascades to RBAC tables
5. Test bulk delete with RBAC cleanup
6. Test activation toggle
7. Test debug mode toggle

### Integration Tests
1. Test full user lifecycle (create → update → delete)
2. Test user with multiple roles
3. Test user with permission overrides
4. Test permission checks after user role changes
5. Test bulk operations

### Frontend Tests
1. Test user management UI with new endpoints
2. Test role selection in user creation form
3. Test user list displays roles correctly
4. Test backward compatibility during migration

---

## Rollback Plan

### If Issues Arise

1. **Frontend Issues**: 
   - Revert frontend changes
   - Old `/user-management` endpoints still work

2. **Backend Issues**:
   - Comment out new endpoints in `rbac.py`
   - Keep old router active
   - No data loss (both databases intact)

3. **Data Integrity Issues**:
   - Both databases are separate
   - User data in `users.db` is unchanged
   - RBAC relationships in `rbac.db` can be rebuilt

---

## Timeline Estimate

| Phase | Estimated Time | Dependencies |
|-------|----------------|--------------|
| Phase 1: Models | 1-2 hours | None |
| Phase 2: RBAC Manager Functions | 3-4 hours | Phase 1 |
| Phase 3: RBAC Router Endpoints | 2-3 hours | Phase 2 |
| Phase 4: Frontend Updates | 4-6 hours | Phase 3 |
| Phase 5: Deprecation | 1 hour | Phase 4 |
| Phase 6: Documentation | 2 hours | Phase 5 |
| Testing | 4-6 hours | All phases |

**Total**: 17-24 hours

---

## Risks and Mitigations

### Risk 1: Frontend Breakage During Migration
**Mitigation**: 
- Keep old endpoints active during migration
- Update frontend components one at a time
- Test each component thoroughly before moving to next

### Risk 2: Data Inconsistency Between Databases
**Mitigation**: 
- RBAC already references users.db via user_id
- New functions maintain consistency
- Add transaction support for critical operations

### Risk 3: Permission Model Mismatch
**Mitigation**: 
- Map old bitwise permissions to RBAC roles
- Use existing `migrate_users_to_rbac.py` script
- Verify all users have appropriate role assignments

### Risk 4: Breaking Existing API Consumers
**Mitigation**: 
- Keep old endpoints with deprecation warnings
- Provide migration period (e.g., 2 versions)
- Update all documentation with migration guide

---

## Success Criteria

✅ **Completion Criteria**:
1. All user CRUD operations available under `/api/rbac/users`
2. User creation assigns roles instead of bitwise permissions
3. User listing includes role information
4. Frontend components use new endpoints
5. Old endpoints marked as deprecated
6. All tests pass
7. Documentation updated
8. No regression in existing functionality

✅ **Quality Criteria**:
1. Response times similar to old endpoints
2. Proper error handling and validation
3. Consistent with RBAC API patterns
4. Backward compatible during migration
5. Clean code following existing patterns

---

## Recommendation

**Proceed with Option 1: Add User CRUD to `/api/rbac`**

This approach:
- ✅ Achieves the stated goal of consolidating under RBAC
- ✅ Provides a modern, flexible permission system
- ✅ Maintains backward compatibility during migration
- ✅ Sets up the system for future enhancements
- ✅ Aligns with the existing RBAC architecture
- ✅ Reduces long-term maintenance burden

**Next Steps**:
1. Review and approve this plan
2. Create feature branch: `feature/rbac-user-management`
3. Implement Phase 1 (Models)
4. Create PR for review after each phase
5. Deploy to staging for testing
6. Gradual rollout to production

---

## Questions for Stakeholders

1. **Timeline**: Is the 17-24 hour estimate acceptable?
2. **Deprecation Period**: How long should we keep old endpoints active?
3. **Breaking Changes**: Can we accept minor breaking changes in user creation API (role vs role_ids)?
4. **Testing**: Do we need additional user acceptance testing?
5. **Documentation**: Are there other docs that need updating?

---

## Appendix: API Comparison

### Old API (user-management)
```
GET    /user-management              → List users
POST   /user-management              → Create user (single role)
GET    /user-management/{id}         → Get user
PUT    /user-management/{id}         → Update user
DELETE /user-management/{id}         → Delete user
POST   /user-management/bulk-action  → Bulk operations
PATCH  /user-management/{id}/toggle-status → Toggle activation
```

### New API (rbac)
```
GET    /api/rbac/users                   → List users (with roles)
POST   /api/rbac/users                   → Create user (with role_ids[])
GET    /api/rbac/users/{id}              → Get user (with roles + permissions)
PUT    /api/rbac/users/{id}              → Update user
DELETE /api/rbac/users/{id}              → Delete user (cascade RBAC)
POST   /api/rbac/users/bulk-delete       → Bulk delete users
PATCH  /api/rbac/users/{id}/activate     → Toggle activation
PATCH  /api/rbac/users/{id}/debug        → Toggle debug mode

# Plus existing RBAC endpoints for roles/permissions
GET    /api/rbac/users/{id}/roles        → Get user's roles
POST   /api/rbac/users/{id}/roles        → Assign role to user
DELETE /api/rbac/users/{id}/roles/{role_id} → Remove role from user
# ... etc (already implemented)
```

### Key Differences
1. **Prefix**: `/user-management` → `/api/rbac/users`
2. **Role Assignment**: Single `role` enum → Multiple `role_ids` array
3. **Response Structure**: Basic user data → User + roles + permissions
4. **Delete Behavior**: Hard delete → Cascade delete (RBAC cleanup)
5. **Bulk Operations**: Generic action → Specific bulk-delete endpoint
6. **Toggle Status**: Single endpoint → Separate activate/debug endpoints

