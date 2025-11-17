# User Management Migration to RBAC

## Overview

This document describes the migration of user management functionality from the legacy `/user-management` endpoints to the modern `/api/rbac/users` endpoints.

**Status**: ✅ **COMPLETED**  
**Date**: 2025-01-XX  
**Migration Type**: Backend + Frontend (No Database Schema Changes)

## Migration Goals

1. **Consolidate user management** under the RBAC API for consistency
2. **Enable multi-role support** - Users can now have multiple roles instead of a single role
3. **Maintain backward compatibility** - Legacy endpoints still work but are deprecated
4. **Improve API design** - RESTful endpoints with clear responsibilities
5. **Simplify frontend** - All user operations through single API path

## Changes Summary

### Backend Changes

#### 1. Extended RBAC Models (`backend/models/rbac.py`)

Added 5 new Pydantic models:

```python
class UserCreate(BaseModel):
    username: str
    realname: str
    email: str
    password: str
    role_ids: List[int] = []  # Multiple roles!
    debug: bool = False
    is_active: bool = True

class UserUpdate(BaseModel):
    realname: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role_ids: Optional[List[int]] = None
    debug: Optional[bool] = None
    is_active: Optional[bool] = None

class UserResponse(BaseModel):
    id: int
    username: str
    realname: str
    email: str
    roles: List[RoleResponse]  # Includes full role details
    debug: bool
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

class UserListResponse(BaseModel):
    users: List[UserResponse]
    total: int

class BulkUserDelete(BaseModel):
    user_ids: List[int]
```

#### 2. Added Bridge Functions (`backend/rbac_manager.py`)

Added 8 new functions bridging RBAC to user database:

1. **`create_user_with_roles()`** - Creates user + assigns roles atomically
2. **`get_user_with_rbac()`** - Fetches user with full role/permission data
3. **`list_users_with_rbac()`** - Lists all users with their roles
4. **`update_user_profile()`** - Updates user profile and role assignments
5. **`delete_user_with_rbac()`** - Deletes user + cascades role cleanup
6. **`bulk_delete_users_with_rbac()`** - Batch deletion with cascade
7. **`toggle_user_activation()`** - Enable/disable user login
8. **`toggle_user_debug()`** - Toggle debug mode per user

**Key Features**:
- Atomic operations with rollback on error
- Cascade deletion (user → role assignments → permission overrides)
- Enriched response data (includes roles and permissions)
- Error handling with appropriate exceptions

#### 3. Added RBAC Router Endpoints (`backend/routers/rbac.py`)

Added 8 new REST endpoints:

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/rbac/users` | List all users with roles | Admin |
| `GET` | `/api/rbac/users/{id}` | Get user details with roles | Admin |
| `POST` | `/api/rbac/users` | Create user with role assignments | Admin |
| `PUT` | `/api/rbac/users/{id}` | Update user + roles | Admin |
| `DELETE` | `/api/rbac/users/{id}` | Delete user + cascade cleanup | Admin |
| `POST` | `/api/rbac/users/bulk-delete` | Delete multiple users | Admin |
| `PATCH` | `/api/rbac/users/{id}/activate` | Toggle activation status | Admin |
| `PATCH` | `/api/rbac/users/{id}/debug` | Toggle debug mode | Admin |

**Permission Requirements**: All endpoints require admin role (`require_admin_token()`)

#### 4. Deprecated Legacy Endpoints (`backend/routers/user_management.py`)

All 7 endpoints marked as deprecated with `deprecated=True` and warning logs:

- `GET /user-management` → Use `GET /api/rbac/users`
- `POST /user-management` → Use `POST /api/rbac/users`
- `GET /user-management/{id}` → Use `GET /api/rbac/users/{id}`
- `PUT /user-management/{id}` → Use `PUT /api/rbac/users/{id}`
- `DELETE /user-management/{id}` → Use `DELETE /api/rbac/users/{id}`
- `POST /user-management/bulk-action` → Use `POST /api/rbac/users/bulk-delete`
- `PATCH /user-management/{id}/toggle-status` → Use `PATCH /api/rbac/users/{id}/activate`

**Deprecation Strategy**:
- Endpoints still functional (backward compatibility maintained)
- Logs warning message on each call
- FastAPI marks as `deprecated=True` in OpenAPI spec
- Documentation updated to show migration path
- Future removal planned (TBD)

### Frontend Changes

Updated 4 components to use new RBAC endpoints:

#### 1. Main User Management (`frontend/src/components/settings/user-management.tsx`)

**Changes**:
- ✅ Updated `Role` interface to use RBAC role structure
- ✅ Updated `User` interface with `roles: Role[]` (multiple roles)
- ✅ All 7 API calls updated from `user-management/*` → `api/rbac/users/*`
- ✅ Added multi-role selector UI with checkboxes
- ✅ Create/update logic now sends `role_ids: number[]`
- ✅ Table displays role badges for all assigned roles
- ✅ Toggle activation uses `PATCH .../activate` endpoint
- ✅ Removed bulk permission edit (no longer relevant with RBAC)

**API Call Changes**:
```typescript
// Before:
apiCall('user-management')
apiCall('user-management', { method: 'POST', body: {...} })
apiCall(`user-management/${id}`, { method: 'PUT', body: {...} })
apiCall(`user-management/${id}/toggle-status`, { method: 'PATCH' })

// After:
apiCall('api/rbac/users')
apiCall('api/rbac/users', { method: 'POST', body: { ...data, role_ids: [...] } })
apiCall(`api/rbac/users/${id}`, { method: 'PUT', body: { ...data, role_ids: [...] } })
apiCall(`api/rbac/users/${id}/activate`, { method: 'PATCH', body: { is_active: ... } })
```

#### 2. Permissions Users Manager (`frontend/src/components/settings/permissions/users-manager.tsx`)

**Changes**:
- ✅ Added `Role` interface
- ✅ Updated `User` interface with `roles: Role[]`
- ✅ `loadUsers()` → `api/rbac/users`
- ✅ `saveUser()` create → `POST api/rbac/users` with `role_ids: []`
- ✅ `saveUser()` update → `PUT api/rbac/users/${id}`
- ✅ `deleteUser()` → `DELETE api/rbac/users/${id}`
- ✅ `toggleUserStatus()` → `PATCH api/rbac/users/${id}/activate`

#### 3. User Roles Manager (`frontend/src/components/settings/permissions/user-roles-manager.tsx`)

**Changes**:
- ✅ `loadUsers()` → `api/rbac/users`

#### 4. User Permissions Manager (`frontend/src/components/settings/permissions/user-permissions-manager.tsx`)

**Changes**:
- ✅ `loadUsers()` → `api/rbac/users`

**Status**: All frontend components compile without TypeScript errors ✅

### Documentation Updates

#### 1. ENDPOINT_USAGE.md

- ✅ Marked `/user-management` section as **DEPRECATED**
- ✅ Added new `/api/rbac/users` section with all endpoints documented
- ✅ Listed all 4 frontend files using new endpoints

#### 2. PERMISSIONS.md

- ✅ Split user management into two sections:
  - **Section 8**: Legacy `/user-management` (marked DEPRECATED with migration paths)
  - **Section 8b**: Modern `/api/rbac/users` (marked RECOMMENDED)
- ✅ Added table showing migration path for each old endpoint

#### 3. backend/RBAC_GUIDE.md

- ✅ Added new "User Management" section under API Endpoints
- ✅ Documented all 8 new user endpoints with examples
- ✅ Added note about legacy endpoint deprecation

## Database Impact

**No database schema changes required!** 🎉

- Users still stored in `data/settings/users.db` (user_db_manager)
- Roles and permissions in `data/settings/rbac.db` (rbac_manager)
- User-role mappings already exist in `user_roles` table
- Migration works by bridging between existing tables

## Migration Benefits

### For Developers

1. **Unified API surface** - All RBAC operations under `/api/rbac/*`
2. **Multi-role support** - Users can have multiple roles (admin + operator)
3. **Enriched responses** - User endpoints return full role/permission data
4. **Better separation of concerns** - RBAC router handles all RBAC logic
5. **Type safety** - New Pydantic models ensure request/response validation

### For Users

1. **More flexible permissions** - Assign multiple roles per user
2. **Consistent UI** - All user management through single interface
3. **Better visibility** - See all roles assigned to each user
4. **Simpler workflows** - Create user with roles in one step

## Testing Checklist

### Backend Tests

- [ ] Create user with multiple roles (`POST /api/rbac/users`)
- [ ] Create user with no roles (empty `role_ids`)
- [ ] Get user with roles included in response (`GET /api/rbac/users/{id}`)
- [ ] Update user roles (`PUT /api/rbac/users/{id}` with new `role_ids`)
- [ ] Toggle user activation (`PATCH /api/rbac/users/{id}/activate`)
- [ ] Toggle debug mode (`PATCH /api/rbac/users/{id}/debug`)
- [ ] Delete user (verify cascade to roles/permissions) (`DELETE /api/rbac/users/{id}`)
- [ ] Bulk delete users (`POST /api/rbac/users/bulk-delete`)
- [ ] List users with pagination/filtering (`GET /api/rbac/users`)
- [ ] Verify legacy endpoints still work (backward compatibility)
- [ ] Verify deprecation warnings logged for legacy endpoints

### Frontend Tests

- [ ] Open `/settings/permissions` - verify users load
- [ ] Create new user with multiple roles selected
- [ ] Edit existing user - verify roles load in checkboxes
- [ ] Update user roles (add/remove)
- [ ] Toggle user active status
- [ ] Delete single user
- [ ] Verify user list shows all role badges
- [ ] Check permissions/users-manager.tsx renders correctly
- [ ] Check permissions/user-roles-manager.tsx renders correctly
- [ ] Check permissions/user-permissions-manager.tsx renders correctly

### Integration Tests

- [ ] Create user via new API → verify appears in UI
- [ ] Update user roles via UI → verify stored correctly in DB
- [ ] Delete user via UI → verify cascade cleanup (roles/permissions removed)
- [ ] Verify legacy `/user-management` endpoints still callable (backward compat)
- [ ] Verify all API calls use `/api/rbac/users` (no `user-management` calls in browser network tab)

## Rollback Plan

If issues arise, rollback is simple:

1. **No database changes** - nothing to revert in DB
2. **Legacy endpoints still work** - frontend can switch back to `user-management/*`
3. **Revert frontend changes**:
   ```bash
   git revert <migration-commit-hash>
   ```
4. **Remove new backend endpoints** (optional - can leave them)

## Future Work

### Short-term (Next Sprint)

- [ ] Add frontend tests for new user management UI
- [ ] Add backend unit tests for new RBAC user endpoints
- [ ] Add integration tests for full user lifecycle
- [ ] Monitor usage logs to verify migration adoption

### Medium-term (1-2 months)

- [ ] Add user activity audit logs
- [ ] Implement user role history tracking
- [ ] Add bulk role assignment UI
- [ ] Add role templates for common user types

### Long-term (3-6 months)

- [ ] Remove deprecated `/user-management` endpoints
- [ ] Remove legacy permission bitwise system completely
- [ ] Add LDAP/AD user sync with role mapping
- [ ] Implement permission inheritance hierarchies

## References

### Modified Files

**Backend** (3 files):
- `backend/models/rbac.py` - Added 5 models
- `backend/rbac_manager.py` - Added 8 functions
- `backend/routers/rbac.py` - Added 8 endpoints
- `backend/routers/user_management.py` - Deprecated 7 endpoints

**Frontend** (4 files):
- `frontend/src/components/settings/user-management.tsx` - Full refactor
- `frontend/src/components/settings/permissions/users-manager.tsx` - Updated API calls
- `frontend/src/components/settings/permissions/user-roles-manager.tsx` - Updated API calls
- `frontend/src/components/settings/permissions/user-permissions-manager.tsx` - Updated API calls

**Documentation** (3 files):
- `ENDPOINT_USAGE.md` - Added new section
- `PERMISSIONS.md` - Split user management section
- `backend/RBAC_GUIDE.md` - Added user management endpoints

### API Endpoint Comparison

| Operation | Legacy Endpoint | New RBAC Endpoint |
|-----------|----------------|-------------------|
| List users | `GET /user-management` | `GET /api/rbac/users` |
| Get user | `GET /user-management/{id}` | `GET /api/rbac/users/{id}` |
| Create user | `POST /user-management` | `POST /api/rbac/users` |
| Update user | `PUT /user-management/{id}` | `PUT /api/rbac/users/{id}` |
| Delete user | `DELETE /user-management/{id}` | `DELETE /api/rbac/users/{id}` |
| Bulk delete | `POST /user-management/bulk-action` | `POST /api/rbac/users/bulk-delete` |
| Toggle status | `PATCH /user-management/{id}/toggle-status` | `PATCH /api/rbac/users/{id}/activate` |
| Toggle debug | N/A (not in legacy) | `PATCH /api/rbac/users/{id}/debug` |

### Key Differences

| Aspect | Legacy System | New RBAC System |
|--------|---------------|-----------------|
| **Roles per user** | Single role enum | Multiple roles (array) |
| **Permission model** | Bitwise flags (5 flags) | Granular permissions (44 perms) |
| **Role assignment** | Via user update | Via `role_ids` array |
| **Response data** | User + role enum | User + full role objects with permissions |
| **Bulk operations** | Generic "bulk-action" | Specific endpoint per action |
| **Activation toggle** | Full PUT with all fields | Lightweight PATCH with single field |
| **Debug mode** | N/A | Dedicated endpoint |
| **API consistency** | `/user-management` (root level) | `/api/rbac/users` (under RBAC namespace) |

## Questions & Answers

### Q: Why not migrate data to single table?

**A**: Keeping separate databases allows easy rollback and maintains backward compatibility. The bridge functions in `rbac_manager.py` provide seamless integration without schema changes.

### Q: Can users still have single role?

**A**: Yes! `role_ids` is an array but can contain one role: `role_ids: [1]`. Frontend UI supports selecting single or multiple roles.

### Q: When will legacy endpoints be removed?

**A**: After monitoring logs and confirming zero usage for 2-3 months. Deprecation warnings will help identify any remaining callers.

### Q: What about API clients outside frontend?

**A**: Legacy endpoints remain functional for backward compatibility. External clients should update to new endpoints but have time to migrate.

### Q: How to test both systems side-by-side?

**A**: Use different user accounts - create one via legacy endpoint, another via new endpoint, and verify both work correctly.

## Conclusion

This migration successfully consolidates user management under the RBAC API, enabling multi-role support and improving API consistency. All changes are backward compatible with no database schema modifications required.

**Status**: ✅ **COMPLETED**  
**Next Steps**: Testing, monitoring, and eventual deprecation removal

---

**Migration Completed By**: GitHub Copilot  
**Last Updated**: 2025-01-XX
