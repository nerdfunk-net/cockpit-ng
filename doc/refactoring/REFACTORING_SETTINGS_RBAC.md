# Refactoring Plan: RBAC Settings Components

**Component Group:** `frontend/src/components/features/settings/permissions/`
**Created:** 2026-01-19
**Updated:** 2026-01-19
**Status:** Planning
**Total Lines of Code:** 1,864 (container + 5 managers)

## TL;DR - What's Wrong & How to Fix It

**Problems:**
1. 🚫 **Architecture violation** - Custom Context instead of mandatory TanStack Query
2. 🔁 **Code duplication** - Data loading logic repeated 5+ times across components
3. 📏 **No shared state** - Each component loads same data independently (users, roles, permissions)
4. ⚠️ **Missing standards** - No react-hook-form + zod, wrong folder structure, no memoization
5. 🗂️ **Type duplication** - Same interfaces defined 4 times across components

**Solution:**
1. ✅ **Migrate to TanStack Query** - Replaces 250+ lines of custom context with built-in caching/state
2. ✅ **Extract shared hooks** - use-rbac-users, use-rbac-roles, use-rbac-permissions queries
3. ✅ **Add mutation hooks** - use-rbac-mutations for all CRUD operations
4. ✅ **Consolidate types** - Single source of truth in `types/index.ts`
5. ✅ **Feature-based structure** - components/, hooks/, types/, utils/ (not lib/, shared/)
6. ✅ **Form validation** - react-hook-form + zod for all dialogs

**Critical Path:** Phase 1 (foundation) → Phase 3 (TanStack Query) → Phase 2 (components) → Phase 4 (refactor managers)

**Minimum Viable:** Phases 1-3 establishes proper architecture per CLAUDE.md

---

## Executive Summary

The RBAC (Role-Based Access Control) settings components contain **1,864 lines** across 5 manager components with **critical architecture violations** and massive code duplication:

1. **Architecture Violation** - Uses custom Context/Provider instead of mandatory TanStack Query
2. **Data Loading Duplication** - Same endpoints called separately in 3-5 different components
3. **No Shared State** - Creating a user in one tab doesn't update other tabs
4. **Type Duplication** - Same interfaces defined 4 times
5. **Missing Standards** - No react-hook-form, wrong folder structure, no React best practices

**Bottom Line:** TanStack Query migration is not optional—it's mandatory per CLAUDE.md and eliminates 250+ lines of custom context code automatically.

## Key Changes Summary

| Current Approach | Required Approach (CLAUDE.md) |
|------------------|-------------------------------|
| Custom Context with manual state | **TanStack Query with auto-caching** |
| Manual `useEffect` + `useState` | **useQuery hooks with built-in states** |
| Custom loading/error handling | **TanStack Query built-in states** |
| Manual cache invalidation | **queryClient.invalidateQueries()** |
| `lib/rbac-types.ts` | **types/index.ts (feature-based)** |
| `components/shared/rbac-*` | **components/* (within feature)** |
| Custom form validation | **react-hook-form + zod** |
| Inline default objects/arrays | **Module-level constants** |

## Quick Wins (Can Start Immediately)

These tasks can be done right now without breaking existing functionality:

### 1. Extract Type Definitions (45 min)
- Create `types/index.ts`
- Consolidate 4 duplicate User interface definitions
- Consolidate Role and Permission interfaces
- No behavioral changes

### 2. Extract Utility Functions (30 min)
- Create `utils/rbac-utils.ts`
- Move `groupPermissionsByResource()` (duplicated 3 times)
- Move `getActionColor()` badge logic
- Add unit tests

### 3. Extract Constants (15 min)
- Create `utils/constants.ts`
- Extract empty array defaults
- Fixes potential re-render issues

### 4. Add Query Keys (20 min)
- Add to `/lib/query-keys.ts`
- Set up foundation for Phase 3

### 5. Verify API Architecture (30 min)
- Confirm all components use `/api/proxy/rbac/*`
- Check for direct backend URLs
- Verify backend has repository/service/router layers

**Total Time: ~2.5 hours**
**Risk: Zero** (no behavioral changes)
**Benefit:** Immediate code quality improvement, sets up for TanStack Query migration

---

## Current Architecture

```
frontend/src/components/features/settings/permissions/
├── permissions-management.tsx       # 133 lines - Main container (5 tabs)
└── permissions/
    ├── users-manager.tsx            # 431 lines - User CRUD
    ├── roles-manager.tsx            # 467 lines - Role CRUD + permissions
    ├── user-roles-manager.tsx       # 335 lines - User-role assignments
    ├── permissions-viewer.tsx       # 159 lines - Read-only permissions list
    └── user-permissions-manager.tsx # 344 lines - User permission overrides
```

**Total:** 1,864 lines

---

## Problem Analysis

### Problem 1: Repeated Data Loading Pattern (5 implementations)

**Affected Files:** ALL manager components

**Identical Pattern:**
```tsx
// users-manager.tsx:70-87
const loadUsers = useCallback(async () => {
  try {
    setLoading(true)
    const response = await apiCall<{ users: User[] }>('rbac/users')
    setUsers(response.users || [])
  } catch {
    toast({
      title: 'Error',
      description: 'Failed to load users',
      variant: 'destructive',
    })
  } finally {
    setLoading(false)
  }
}, [apiCall, toast])

// roles-manager.tsx:63-78
const loadRoles = useCallback(async () => {
  try {
    setLoading(true)
    const data = await apiCall<Role[]>('rbac/roles')
    setRoles(data)
  } catch {
    toast({
      title: 'Error',
      description: 'Failed to load roles',
      variant: 'destructive',
    })
  } finally {
    setLoading(false)
  }
}, [apiCall, toast])

// permissions-viewer.tsx:33-48
const loadPermissions = useCallback(async () => {
  try {
    setLoading(true)
    const data = await apiCall<Permission[]>('rbac/permissions')
    setPermissions(data)
  } catch {
    toast({
      title: 'Error',
      description: 'Failed to load permissions',
      variant: 'destructive',
    })
  } finally {
    setLoading(false)
  }
}, [apiCall, toast])
```

**Issue:** Every component has its own `loadUsers()`, `loadRoles()`, or `loadPermissions()` with identical error handling and loading state management.

---

### Problem 2: Duplicate User Loading (3 components)

**Affected Files:**
- `users-manager.tsx:70-87` - `loadUsers()`
- `user-roles-manager.tsx:73-87` - `loadUsers()`
- `user-permissions-manager.tsx:58-70` - `loadUsers()`

**All three load users from the same endpoint:**
```tsx
const response = await apiCall<{ users: User[] }>('rbac/users')
```

**Why This is Bad:**
- If a user is created in `users-manager.tsx`, other components don't know about it
- Three separate loading states for the same data
- No caching or shared state
- Each component makes its own API call

---

### Problem 3: Duplicate Role Loading (3 components)

**Affected Files:**
- `roles-manager.tsx:63-78` - `loadRoles()`
- `user-roles-manager.tsx:89-99` - `loadRoles()`
- Implicitly used in user-permissions through role display

**Same issue as users - no shared state.**

---

### Problem 4: Duplicate Permission Loading (3 components)

**Affected Files:**
- `permissions-viewer.tsx:33-48` - `loadPermissions()`
- `roles-manager.tsx:79-87` - `loadAllPermissions()`
- `user-permissions-manager.tsx:71-79` - `loadAllPermissions()`

**Identical implementations:**
```tsx
const data = await apiCall<Permission[]>('rbac/permissions')
```

---

### Problem 5: Repeated Table Structure (4 implementations)

**All components use nearly identical table layouts:**

```tsx
// Generic pattern repeated 4 times:
<div className="border rounded-lg">
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Column 1</TableHead>
        <TableHead>Column 2</TableHead>
        <TableHead className="text-right">Actions</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {items.map((item) => (
        <TableRow key={item.id}>
          <TableCell>{item.property}</TableCell>
          <TableCell className="text-right">
            <Button onClick={...}>Action</Button>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
```

**Components:**
- users-manager.tsx:264-335
- roles-manager.tsx:264-337
- user-roles-manager.tsx:206-301
- user-permissions-manager.tsx:201-230

---

### Problem 6: Repeated Dialog Pattern (4 implementations)

**All CRUD components use the same dialog structure:**

```tsx
<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>{editMode ? 'Edit' : 'Create'} Item</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
    <div className="space-y-4">
      {/* Form fields */}
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
        Cancel
      </Button>
      <Button onClick={saveItem}>
        {editMode ? 'Update' : 'Create'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Components:**
- users-manager.tsx:341-427 (87 lines)
- roles-manager.tsx:339-392 (54 lines for create) + 395-435 (41 lines for edit)
- roles-manager.tsx:438-467 (30 lines for permissions)

---

### Problem 7: Repeated Permission Grouping Logic (3 implementations)

**Affected Files:**
- `permissions-viewer.tsx:61-68`
- `roles-manager.tsx:246-253`
- `user-permissions-manager.tsx:142-149`

**Identical grouping logic:**
```tsx
const groupedPermissions = permissions.reduce((acc, perm) => {
  if (!acc[perm.resource]) {
    acc[perm.resource] = []
  }
  acc[perm.resource]!.push(perm)
  return acc
}, {} as Record<string, Permission[]>)
```

**Should be a utility function.**

---

### Problem 8: Repeated Permission Toggle Logic (2 implementations)

**Affected Files:**
- `roles-manager.tsx:206-242` - Toggle permission on role
- `user-permissions-manager.tsx:116-140` - Set permission override

**Similar patterns:**
```tsx
// roles-manager.tsx
const togglePermission = async (permissionId: number, currentlyGranted: boolean) => {
  if (currentlyGranted) {
    await apiCall(`rbac/roles/${roleId}/permissions/${permissionId}`, { method: 'DELETE' })
  } else {
    await apiCall(`rbac/roles/${roleId}/permissions`, {
      method: 'POST',
      body: JSON.stringify({ role_id, permission_id, granted: true }),
    })
  }
  // Reload...
}

// user-permissions-manager.tsx
const setPermissionOverride = async (permissionId: number, granted: boolean) => {
  await apiCall(`rbac/users/${userId}/permissions/overrides`, {
    method: 'POST',
    body: JSON.stringify({ permission_id: permissionId, granted }),
  })
  // Reload...
}
```

---

### Problem 9: Container Component Card Duplication (5 times)

**File:** `permissions-management.tsx:56-128`

**Repeated 5 times:**
```tsx
<TabsContent value="users">
  <Card className="shadow-lg border-0 overflow-hidden p-0">
    <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-t-lg m-0 py-2 px-4">
      <CardTitle className="flex items-center space-x-2 text-sm font-medium">
        <Icon className="h-5 w-5" />
        <span>Title</span>
      </CardTitle>
    </CardHeader>
    <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50">
      <Component />
    </CardContent>
  </Card>
</TabsContent>
```

**70+ lines of repetitive wrapping code.**

---

### Problem 10: No Shared State Management

**Current Issues:**
- When a user is created in UsersManager, UserRolesManager doesn't know
- When a role is created in RolesManager, UserRolesManager must reload manually
- No real-time updates between tabs
- Each component manages its own loading state independently

**Needs:** Shared RBAC context or state management solution.

---

### Problem 11: Inconsistent Type Definitions (4 variations)

**User interface defined 4 times:**

```tsx
// users-manager.tsx:32-41
interface User {
  id: number
  username: string
  realname: string
  email?: string
  roles?: Role[]
  debug: boolean
  is_active: boolean
  created_at: string
}

// user-roles-manager.tsx:24-28
interface User {
  id: number
  username: string
  realname: string
  email: string
}

// user-permissions-manager.tsx:33-37
interface User {
  id: number
  username: string
  realname: string
}
```

**Similar duplication for Role and Permission interfaces.**

---

### Problem 12: No Loading Skeleton/Fallback Consistency

**Different loading patterns:**
```tsx
// users-manager.tsx:230
if (loading) {
  return <div className="text-center py-8">Loading users...</div>
}

// roles-manager.tsx:255
if (loading) {
  return <div className="text-center py-8">Loading roles...</div>
}

// permissions-viewer.tsx:83
if (loading) {
  return <div className="text-center py-8">Loading permissions...</div>
}
```

**Should use consistent loading component.**

---

## Proposed Refactoring Plan

### Phase 1: Foundation & Setup (CRITICAL)

**1.1: Verify Backend Architecture**

- [ ] Confirm backend endpoints use repository pattern
- [ ] Verify service layer exists for RBAC operations
- [ ] Check routers use `require_permission()` or `verify_admin_token()`
- [ ] Ensure all endpoints are at `/api/rbac/*`

**Estimated effort:** 30 minutes

---

**1.2: Add Query Keys to Centralized Factory**

**File:** `/frontend/src/lib/query-keys.ts` (modify)

```tsx
// Add to existing queryKeys object
rbac: {
  all: ['rbac'] as const,

  // Users
  users: () => [...queryKeys.rbac.all, 'users'] as const,
  user: (id: number) => [...queryKeys.rbac.all, 'user', id] as const,
  userRoles: (userId: number) => [...queryKeys.rbac.all, 'user', userId, 'roles'] as const,
  userPermissions: (userId: number) => [...queryKeys.rbac.all, 'user', userId, 'permissions'] as const,

  // Roles
  roles: () => [...queryKeys.rbac.all, 'roles'] as const,
  role: (id: number) => [...queryKeys.rbac.all, 'role', id] as const,
  rolePermissions: (roleId: number) => [...queryKeys.rbac.all, 'role', roleId, 'permissions'] as const,

  // Permissions
  permissions: () => [...queryKeys.rbac.all, 'permissions'] as const,
},
```

**Estimated effort:** 20 minutes

---

**1.3: Create Type Definitions**

**File:** `components/features/settings/permissions/types/index.ts` (new)

**NOTE:** Feature-based folder structure, NOT `lib/rbac-types.ts`

```tsx
export interface User {
  id: number
  username: string
  realname: string
  email: string
  roles?: Role[]
  debug: boolean
  is_active: boolean
  created_at: string
  updated_at?: string
}

export interface Role {
  id: number
  name: string
  description: string
  is_system: boolean
  created_at: string
  updated_at: string
}

export interface Permission {
  id: number
  resource: string
  action: string
  description: string
  granted?: boolean
  source?: string
  created_at: string
}

export interface RoleWithPermissions extends Role {
  permissions: Permission[]
}

export interface UserWithRoles extends User {
  roles: Role[]
}

export interface PermissionOverride {
  permission_id: number
  user_id: number
  granted: boolean
}

export interface UsersResponse {
  users: User[]
}

// Form data types for validation
export interface CreateUserData {
  username: string
  realname: string
  email: string
  password: string
  is_active: boolean
  debug: boolean
}

export interface UpdateUserData {
  realname?: string
  email?: string
  password?: string
  is_active?: boolean
  debug?: boolean
}

export interface CreateRoleData {
  name: string
  description: string
}

export interface UpdateRoleData {
  name?: string
  description?: string
}
```

**Estimated effort:** 45 minutes

---

**1.4: Create Constants**

**File:** `components/features/settings/permissions/utils/constants.ts` (new)

```tsx
import type { User, Role, Permission } from '../types'

// React best practice: Extract default arrays/objects to prevent re-render loops
export const EMPTY_USERS: User[] = []
export const EMPTY_ROLES: Role[] = []
export const EMPTY_PERMISSIONS: Permission[] = []

export const DEFAULT_USER: Partial<CreateUserData> = {
  is_active: true,
  debug: false,
} as const

export const CACHE_TIME = {
  USERS: 2 * 60 * 1000,      // 2 minutes
  ROLES: 5 * 60 * 1000,      // 5 minutes (more static)
  PERMISSIONS: 10 * 60 * 1000, // 10 minutes (very static)
} as const
```

**Estimated effort:** 15 minutes

---

**1.5: Create Utility Functions**

**File:** `components/features/settings/permissions/utils/rbac-utils.ts` (new)

```tsx
/**
 * Group permissions by resource
 */
export function groupPermissionsByResource(
  permissions: Permission[]
): Record<string, Permission[]> {
  return permissions.reduce((acc, perm) => {
    if (!acc[perm.resource]) {
      acc[perm.resource] = []
    }
    acc[perm.resource]!.push(perm)
    return acc
  }, {} as Record<string, Permission[]>)
}

/**
 * Get action badge color based on permission action
 */
export function getActionColor(action: string): string {
  switch (action) {
    case 'read':
      return 'bg-green-100 text-green-800'
    case 'write':
      return 'bg-blue-100 text-blue-800'
    case 'delete':
      return 'bg-red-100 text-red-800'
    case 'execute':
      return 'bg-purple-100 text-purple-800'
    default:
      return 'bg-slate-100 text-slate-800'
  }
}

/**
 * Filter items by search term across multiple fields
 */
export function filterBySearchTerm<T>(
  items: T[],
  searchTerm: string,
  fields: (keyof T)[]
): T[] {
  if (!searchTerm) return items
  
  const lowerSearch = searchTerm.toLowerCase()
  return items.filter(item =>
    fields.some(field => {
      const value = item[field]
      return typeof value === 'string' && value.toLowerCase().includes(lowerSearch)
    })
  )
}
```

**Estimated effort:** 1 hour

---

### Phase 3: TanStack Query Migration (CRITICAL - Mandatory)

**Note:** TanStack Query is mandatory for all data fetching per CLAUDE.md. This replaces the proposed custom Context/Provider approach entirely and provides built-in caching, loading states, error handling, and optimistic updates.

**3.1: Create Query Hooks**

**File:** `hooks/use-rbac-queries.ts` (new)

```tsx
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { User, Role, Permission, UsersResponse, RoleWithPermissions } from '../types'
import { CACHE_TIME, EMPTY_USERS, EMPTY_ROLES, EMPTY_PERMISSIONS } from '../utils/constants'
import { useMemo } from 'react'

interface UseRbacUsersOptions {
  enabled?: boolean
}

const DEFAULT_USERS_OPTIONS: UseRbacUsersOptions = { enabled: true }

/**
 * Fetch all users with automatic caching
 */
export function useRbacUsers(options: UseRbacUsersOptions = DEFAULT_USERS_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.rbac.users(),
    queryFn: async () => {
      const response = await apiCall<UsersResponse>('rbac/users', { method: 'GET' })
      return response.users || EMPTY_USERS
    },
    enabled,
    staleTime: CACHE_TIME.USERS,
  })
}

/**
 * Fetch all roles with automatic caching
 */
export function useRbacRoles(options: { enabled?: boolean } = {}) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.rbac.roles(),
    queryFn: async () => {
      const response = await apiCall<Role[]>('rbac/roles', { method: 'GET' })
      return response || EMPTY_ROLES
    },
    enabled,
    staleTime: CACHE_TIME.ROLES,
  })
}

/**
 * Fetch all permissions with automatic caching
 */
export function useRbacPermissions(options: { enabled?: boolean } = {}) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.rbac.permissions(),
    queryFn: async () => {
      const response = await apiCall<Permission[]>('rbac/permissions', { method: 'GET' })
      return response || EMPTY_PERMISSIONS
    },
    enabled,
    staleTime: CACHE_TIME.PERMISSIONS, // Permissions are very static
  })
}

/**
 * Fetch role with its permissions
 */
export function useRolePermissions(roleId: number | null, options: { enabled?: boolean } = {}) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.rbac.rolePermissions(roleId!),
    queryFn: async () => {
      const response = await apiCall<RoleWithPermissions>(`rbac/roles/${roleId}`, { method: 'GET' })
      return response
    },
    enabled: enabled && !!roleId,
    staleTime: CACHE_TIME.ROLES,
  })
}

/**
 * Fetch user's permission overrides
 */
export function useUserPermissions(userId: number | null, options: { enabled?: boolean } = {}) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.rbac.userPermissions(userId!),
    queryFn: async () => {
      const response = await apiCall<Permission[]>(`rbac/users/${userId}/permissions`, { method: 'GET' })
      return response || EMPTY_PERMISSIONS
    },
    enabled: enabled && !!userId,
    staleTime: CACHE_TIME.USERS,
  })
}
```

**Benefits:**
- ✅ Eliminates 250+ lines of custom context code
- ✅ Built-in caching (no manual `useState`)
- ✅ Built-in loading/error states
- ✅ Automatic background refetching
- ✅ Request deduplication
- ✅ Stale-while-revalidate pattern

**Estimated effort:** 2 hours

---

**3.2: Create Mutation Hooks**

**File:** `hooks/use-rbac-mutations.ts` (new)

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { CreateUserData, UpdateUserData, CreateRoleData, UpdateRoleData, PermissionOverride } from '../types'
import { useMemo } from 'react'

export function useRbacMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // User mutations
  const createUser = useMutation({
    mutationFn: async (data: CreateUserData) => {
      return apiCall('rbac/users', {
        method: 'POST',
        body: JSON.stringify(data)
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rbac.users() })
      toast({
        title: 'Success',
        description: 'User created successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to create user: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  const updateUser = useMutation({
    mutationFn: async ({ userId, data }: { userId: number; data: UpdateUserData }) => {
      return apiCall(`rbac/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rbac.users() })
      toast({
        title: 'Success',
        description: 'User updated successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to update user: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  const deleteUser = useMutation({
    mutationFn: async (userId: number) => {
      return apiCall(`rbac/users/${userId}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rbac.users() })
      toast({
        title: 'Success',
        description: 'User deleted successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to delete user: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Role mutations
  const createRole = useMutation({
    mutationFn: async (data: CreateRoleData) => {
      return apiCall('rbac/roles', {
        method: 'POST',
        body: JSON.stringify(data)
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rbac.roles() })
      toast({ title: 'Success', description: 'Role created successfully' })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to create role: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  const updateRole = useMutation({
    mutationFn: async ({ roleId, data }: { roleId: number; data: UpdateRoleData }) => {
      return apiCall(`rbac/roles/${roleId}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rbac.roles() })
      toast({ title: 'Success', description: 'Role updated successfully' })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to update role: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  const deleteRole = useMutation({
    mutationFn: async (roleId: number) => {
      return apiCall(`rbac/roles/${roleId}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rbac.roles() })
      toast({ title: 'Success', description: 'Role deleted successfully' })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to delete role: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Permission assignment mutations
  const toggleRolePermission = useMutation({
    mutationFn: async ({ roleId, permissionId, granted }: { roleId: number; permissionId: number; granted: boolean }) => {
      if (granted) {
        // Remove permission
        return apiCall(`rbac/roles/${roleId}/permissions/${permissionId}`, { method: 'DELETE' })
      } else {
        // Add permission
        return apiCall(`rbac/roles/${roleId}/permissions`, {
          method: 'POST',
          body: JSON.stringify({ role_id: roleId, permission_id: permissionId, granted: true })
        })
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rbac.rolePermissions(variables.roleId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.rbac.roles() })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to update permission: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  const setUserPermissionOverride = useMutation({
    mutationFn: async ({ userId, permissionId, granted }: PermissionOverride & { userId: number }) => {
      return apiCall(`rbac/users/${userId}/permissions/overrides`, {
        method: 'POST',
        body: JSON.stringify({ permission_id: permissionId, granted })
      })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rbac.userPermissions(variables.userId) })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to set permission override: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Memoize return object to prevent re-renders
  return useMemo(() => ({
    createUser,
    updateUser,
    deleteUser,
    createRole,
    updateRole,
    deleteRole,
    toggleRolePermission,
    setUserPermissionOverride,
  }), [createUser, updateUser, deleteUser, createRole, updateRole, deleteRole, toggleRolePermission, setUserPermissionOverride])
}
```

**Benefits:**
- ✅ Automatic cache invalidation
- ✅ Built-in optimistic updates support
- ✅ Consistent error/success handling
- ✅ Loading states for each mutation

**Estimated effort:** 3 hours

---

### Phase 2: Create Reusable Components

**2.1: Create Data Table Component**

**File:** `components/rbac-data-table.tsx` (new)

**NOTE:** Within feature directory, NOT `components/shared/`

```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ReactNode } from 'react'

interface Column<T> {
  header: string
  accessor: keyof T | ((item: T) => ReactNode)
  className?: string
}

interface RBACDataTableProps<T extends { id: number }> {
  data: T[]
  columns: Column<T>[]
  actions?: (item: T) => ReactNode
  emptyMessage?: string
}

export function RBACDataTable<T extends { id: number }>({
  data,
  columns,
  actions,
  emptyMessage = 'No data available',
}: RBACDataTableProps<T>) {
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col, idx) => (
              <TableHead key={idx} className={col.className}>
                {col.header}
              </TableHead>
            ))}
            {actions && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length + (actions ? 1 : 0)} className="text-center py-8 text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((item) => (
              <TableRow key={item.id}>
                {columns.map((col, idx) => (
                  <TableCell key={idx} className={col.className}>
                    {typeof col.accessor === 'function'
                      ? col.accessor(item)
                      : String(item[col.accessor])}
                  </TableCell>
                ))}
                {actions && (
                  <TableCell className="text-right">
                    {actions(item)}
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
```

**Estimated effort:** 1.5 hours

---

**2.2: Create Tab Card Wrapper**

**File:** `components/rbac-tab-card.tsx` (new)

**NOTE:** Within feature directory, NOT `components/shared/`

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LucideIcon } from 'lucide-react'
import { ReactNode } from 'react'

interface RBACTabCardProps {
  icon: LucideIcon
  title: string
  children: ReactNode
}

export function RBACTabCard({ icon: Icon, title, children }: RBACTabCardProps) {
  return (
    <Card className="shadow-lg border-0 overflow-hidden p-0">
      <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-t-lg m-0 py-2 px-4">
        <CardTitle className="flex items-center space-x-2 text-sm font-medium">
          <Icon className="h-5 w-5" />
          <span>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50">
        {children}
      </CardContent>
    </Card>
  )
}
```

**Estimated effort:** 30 minutes

---

**2.3: Create Loading State Component**

**File:** `components/rbac-loading.tsx` (new)

```tsx
export function RBACLoading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="text-center py-8">
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  )
}
```

**Estimated effort:** 15 minutes

---

**2.4: Create Form Dialogs with react-hook-form + zod (CRITICAL)**

**Note:** MUST use react-hook-form + zod per CLAUDE.md standards

**File:** `components/dialogs/user-dialog.tsx` (new)

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Checkbox } from '@/components/ui/checkbox'
import type { User } from '../types'
import { useCallback } from 'react'

const createUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(50),
  realname: z.string().min(1, 'Real name is required').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  is_active: z.boolean(),
  debug: z.boolean(),
})

const updateUserSchema = createUserSchema.partial().omit({ username: true })

type CreateUserFormData = z.infer<typeof createUserSchema>
type UpdateUserFormData = z.infer<typeof updateUserSchema>

interface UserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: CreateUserFormData | UpdateUserFormData) => void
  user?: User | null
  isEdit?: boolean
}

export function UserDialog({ open, onOpenChange, onSubmit, user, isEdit = false }: UserDialogProps) {
  const form = useForm<CreateUserFormData | UpdateUserFormData>({
    resolver: zodResolver(isEdit ? updateUserSchema : createUserSchema),
    defaultValues: isEdit && user
      ? {
          realname: user.realname,
          email: user.email,
          is_active: user.is_active,
          debug: user.debug,
        }
      : {
          username: '',
          realname: '',
          email: '',
          password: '',
          is_active: true,
          debug: false,
        }
  })

  const handleSubmit = form.handleSubmit((data) => {
    onSubmit(data)
    form.reset()
  })

  const handleCancel = useCallback(() => {
    form.reset()
    onOpenChange(false)
  }, [form, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit User' : 'Create New User'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update user information' : 'Add a new user to the system'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isEdit && (
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="johndoe" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="realname"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Real Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="John Doe" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" placeholder="john@example.com" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isEdit && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" placeholder="••••••••" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Active</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="debug"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Debug Mode</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit">
                {isEdit ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

**File:** `components/dialogs/role-dialog.tsx` (new)

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import type { Role } from '../types'
import { useCallback } from 'react'

const roleSchema = z.object({
  name: z.string().min(3, 'Role name must be at least 3 characters').max(50),
  description: z.string().min(1, 'Description is required').max(255),
})

type RoleFormData = z.infer<typeof roleSchema>

interface RoleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: RoleFormData) => void
  role?: Role | null
  isEdit?: boolean
}

export function RoleDialog({ open, onOpenChange, onSubmit, role, isEdit = false }: RoleDialogProps) {
  const form = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: isEdit && role
      ? {
          name: role.name,
          description: role.description,
        }
      : {
          name: '',
          description: '',
        }
  })

  const handleSubmit = form.handleSubmit((data) => {
    onSubmit(data)
    form.reset()
  })

  const handleCancel = useCallback(() => {
    form.reset()
    onOpenChange(false)
  }, [form, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Role' : 'Create New Role'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update role information' : 'Add a new role to the system'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Administrator" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Full system access" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit">
                {isEdit ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

**Estimated effort:** 2.5 hours

---

### Phase 4: Refactor Container Component

**File:** `permissions-management.tsx`

**Changes:**
1. **NO RBACProvider needed** - TanStack Query handles all state
2. Use RBACTabCard for all tabs
3. Reduce from 133 lines to ~80 lines

```tsx
'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Shield, Users, Key, UserCog, UserPlus } from 'lucide-react'
import { RBACTabCard } from './components/rbac-tab-card'
import { RolesManager } from './permissions/roles-manager'
import { UserRolesManager } from './permissions/user-roles-manager'
import { PermissionsViewer } from './permissions/permissions-viewer'
import { UserPermissionsManager } from './permissions/user-permissions-manager'
import { UsersManager } from './permissions/users-manager'

const TABS = [
  { id: 'users', icon: UserPlus, label: 'Users', title: 'User Accounts', component: UsersManager },
  { id: 'user-roles', icon: Users, label: 'User Roles', title: 'User Role Assignments', component: UserRolesManager },
  { id: 'roles', icon: Shield, label: 'Roles', title: 'Role Management', component: RolesManager },
  { id: 'permissions', icon: Key, label: 'Permissions', title: 'All Permissions', component: PermissionsViewer },
  { id: 'user-overrides', icon: UserCog, label: 'Overrides', title: 'User Permission Overrides', component: UserPermissionsManager },
] as const

export function PermissionsManagement() {
  const [activeTab, setActiveTab] = useState('users')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Shield className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Users & Permissions</h1>
            <p className="text-gray-600 mt-1">Manage users, roles, permissions, and access control</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          {TABS.map(tab => (
            <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map(({ id, icon, title, component: Component }) => (
          <TabsContent key={id} value={id}>
            <RBACTabCard icon={icon} title={title}>
              <Component />
            </RBACTabCard>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
```

**Key Changes:**
- ✅ No RBACProvider wrapper (TanStack Query handles state globally)
- ✅ Extracted tabs to TABS constant (prevents re-creation)
- ✅ Simplified imports (no custom context)

**Estimated effort:** 30 minutes

---

### Phase 5: Refactor Individual Managers with TanStack Query

**5.1: Refactor UsersManager**

**File:** `permissions/users-manager.tsx`

**Changes:**
- Remove `loadUsers()`, `useState<User[]>`, `loading` state
- Use `useRbacUsers()` and `useRbacMutations()` hooks
- Use `RBACDataTable` component
- Use `UserDialog` component (react-hook-form + zod)
- Remove duplicate API calls

**Example refactored code:**

```tsx
'use client'

import { useState, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { UserPlus, Pencil, Trash2 } from 'lucide-react'
import { useRbacUsers } from '../hooks/use-rbac-queries'
import { useRbacMutations } from '../hooks/use-rbac-mutations'
import { UserDialog } from '../components/dialogs/user-dialog'
import { RBACDataTable } from '../components/rbac-data-table'
import { RBACLoading } from '../components/rbac-loading'
import type { User } from '../types'
import { EMPTY_USERS } from '../utils/constants'

export function UsersManager() {
  // TanStack Query hooks - no manual state management needed
  const { data: users = EMPTY_USERS, isLoading } = useRbacUsers()
  const { createUser, updateUser, deleteUser } = useRbacMutations()

  // Client-side UI state only
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  // Derived state with useMemo
  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users
    const lower = searchTerm.toLowerCase()
    return users.filter(u =>
      u.username.toLowerCase().includes(lower) ||
      u.realname.toLowerCase().includes(lower)
    )
  }, [users, searchTerm])

  // Callbacks with useCallback
  const handleCreate = useCallback(() => {
    setSelectedUser(null)
    setIsDialogOpen(true)
  }, [])

  const handleEdit = useCallback((user: User) => {
    setSelectedUser(user)
    setIsDialogOpen(true)
  }, [])

  const handleDelete = useCallback(async (userId: number) => {
    if (confirm('Are you sure you want to delete this user?')) {
      deleteUser.mutate(userId)
    }
  }, [deleteUser])

  const handleSubmit = useCallback((data: any) => {
    if (selectedUser) {
      updateUser.mutate({ userId: selectedUser.id, data })
    } else {
      createUser.mutate(data)
    }
    setIsDialogOpen(false)
  }, [selectedUser, createUser, updateUser])

  if (isLoading) {
    return <RBACLoading message="Loading users..." />
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <input
          type="search"
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="..."
        />
        <Button onClick={handleCreate}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      <RBACDataTable
        data={filteredUsers}
        columns={[
          { header: 'Username', accessor: 'username' },
          { header: 'Real Name', accessor: 'realname' },
          { header: 'Email', accessor: 'email' },
        ]}
        actions={(user) => (
          <>
            <Button size="sm" variant="ghost" onClick={() => handleEdit(user)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => handleDelete(user.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      />

      <UserDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSubmit={handleSubmit}
        user={selectedUser}
        isEdit={!!selectedUser}
      />
    </div>
  )
}
```

**Before:** 431 lines
**After:** ~180 lines
**Reduction:** ~251 lines (58%)

**Benefits:**
- ✅ No manual loading state
- ✅ Automatic cache invalidation on mutations
- ✅ Built-in error handling
- ✅ Proper form validation with zod

**Estimated effort:** 2 hours

---

**5.2: Refactor RolesManager**

**File:** `permissions/roles-manager.tsx`

**Changes:**
- Remove `loadRoles()`, `loadAllPermissions()`
- Use `useRbacRoles()` and `useRbacPermissions()` hooks
- Use `RBACDataTable` component
- Use `groupPermissionsByResource()` utility
- Use `RoleDialog` component

**Before:** 467 lines
**After:** ~220 lines
**Reduction:** ~247 lines (53%)

**Estimated effort:** 2.5 hours

---

**5.3: Refactor UserRolesManager**

**File:** `permissions/user-roles-manager.tsx`

**Changes:**
- Remove `loadUsers()`, `loadRoles()`
- Use `useRBACData()` hook
- Use `RBACDataTable` component
- Simplify with shared state

**Before:** 335 lines  
**After:** ~200 lines  
**Reduction:** ~135 lines (40%)

**Estimated effort:** 2 hours

---

**5.4: Refactor PermissionsViewer**

**File:** `permissions/permissions-viewer.tsx`

**Changes:**
- Remove `loadPermissions()`
- Use `useRBACData()` hook
- Use `groupPermissionsByResource()` utility
- Use `RBACDataTable` component

**Before:** 159 lines  
**After:** ~90 lines  
**Reduction:** ~69 lines (43%)

**Estimated effort:** 1 hour

---

**5.5: Refactor UserPermissionsManager**

**File:** `permissions/user-permissions-manager.tsx`

**Changes:**
- Remove `loadUsers()`, `loadAllPermissions()`
- Use `useRBACData()` hook
- Use `groupPermissionsByResource()` utility
- Use `RBACDataTable` component

**Before:** 344 lines  
**After:** ~220 lines  
**Reduction:** ~124 lines (36%)

**Estimated effort:** 2 hours

---

### Phase 6: Add Optimizations

**6.1: Add Optimistic Updates**

Update context to support optimistic updates for better UX:

```tsx
const createUser = useCallback(async (userData: Partial<User>) => {
  // Optimistically add user
  const tempUser = { ...userData, id: Date.now() } as User
  setUsers(prev => [...prev, tempUser])
  
  try {
    const newUser = await apiCall<User>('rbac/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    })
    // Replace temp user with real one
    setUsers(prev => prev.map(u => u.id === tempUser.id ? newUser : u))
  } catch (error) {
    // Rollback on error
    setUsers(prev => prev.filter(u => u.id !== tempUser.id))
    throw error
  }
}, [apiCall])
```

**Estimated effort:** 2 hours

---

**6.2: Add Caching Strategy**

Implement simple cache to avoid unnecessary reloads:

```tsx
// In RBACProvider
const [lastLoaded, setLastLoaded] = useState<{
  users: number
  roles: number
  permissions: number
}>({ users: 0, roles: 0, permissions: 0 })

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

const loadUsers = useCallback(async (force = false) => {
  const now = Date.now()
  if (!force && now - lastLoaded.users < CACHE_DURATION && users.length > 0) {
    return // Use cached data
  }
  
  // ... load from API
  setLastLoaded(prev => ({ ...prev, users: now }))
}, [lastLoaded, users])
```

**Estimated effort:** 1.5 hours

---

**6.3: Add Search/Filter Hooks**

Create reusable search hook:

**File:** `hooks/use-rbac-search.ts` (new)

```tsx
import { useState, useMemo } from 'react'

export function useRBACSearch<T>(
  items: T[],
  searchFields: (keyof T)[]
) {
  const [searchTerm, setSearchTerm] = useState('')
  
  const filteredItems = useMemo(() => {
    if (!searchTerm) return items
    
    const lower = searchTerm.toLowerCase()
    return items.filter(item =>
      searchFields.some(field => {
        const value = item[field]
        return typeof value === 'string' && value.toLowerCase().includes(lower)
      })
    )
  }, [items, searchTerm, searchFields])
  
  return { searchTerm, setSearchTerm, filteredItems }
}
```

**Estimated effort:** 1 hour

---

## Final Directory Structure (After Refactoring)

```
frontend/src/components/features/settings/permissions/
├── permissions-management.tsx       # ~80 lines (was 133, -40%)
└── permissions/
    ├── users-manager.tsx            # ~250 lines (was 431, -42%)
    ├── roles-manager.tsx            # ~280 lines (was 467, -40%)
    ├── user-roles-manager.tsx       # ~200 lines (was 335, -40%)
    ├── permissions-viewer.tsx       # ~90 lines (was 159, -43%)
    └── user-permissions-manager.tsx # ~220 lines (was 344, -36%)

hooks/
├── use-rbac-data.tsx                # ~250 lines (new)
└── use-rbac-search.ts               # ~30 lines (new)

lib/
├── rbac-types.ts                    # ~80 lines (new)
└── rbac-utils.ts                    # ~60 lines (new)

components/shared/
├── rbac-data-table.tsx              # ~50 lines (new)
├── rbac-tab-card.tsx                # ~20 lines (new)
├── rbac-loading.tsx                 # ~10 lines (new)
└── rbac-crud-dialog.tsx             # ~40 lines (new)
```

---

## Summary of Changes

| File | Before | After | Change |
|------|--------|-------|--------|
| `permissions-management.tsx` | 133 | ~80 | **-53 lines (-40%)** |
| `users-manager.tsx` | 431 | ~250 | **-181 lines (-42%)** |
| `roles-manager.tsx` | 467 | ~280 | **-187 lines (-40%)** |
| `user-roles-manager.tsx` | 335 | ~200 | **-135 lines (-40%)** |
| `permissions-viewer.tsx` | 159 | ~90 | **-69 lines (-43%)** |
| `user-permissions-manager.tsx` | 344 | ~220 | **-124 lines (-36%)** |
| **Subtotal (existing)** | **1,869** | **~1,120** | **-749 lines (-40%)** |
| **New files** | **0** | **+540** | **+540 lines** |
| **Grand Total** | **1,869** | **~1,660** | **-209 lines (-11%)** |

**Net reduction:** ~209 lines (11%), but with significantly better architecture:
- Single source of truth for RBAC data
- Reusable components
- Better type safety
- Easier testing
- Improved maintainability

---

## Estimated Total Effort (TanStack Query Approach)

| Phase | Description | Effort |
|-------|-------------|--------|
| 1.1 | Verify backend architecture | 30 min |
| 1.2 | Add query keys to factory | 20 min |
| 1.3 | Create type definitions | 45 min |
| 1.4 | Create constants | 15 min |
| 1.5 | Create utility functions | 1 hour |
| 3.1 | Create query hooks (TanStack Query) | 2 hours |
| 3.2 | Create mutation hooks (TanStack Query) | 3 hours |
| 2.1 | Create data table component | 1.5 hours |
| 2.2 | Create tab card wrapper | 30 min |
| 2.3 | Create loading component | 15 min |
| 2.4 | Create form dialogs with react-hook-form + zod | 2.5 hours |
| 4 | Refactor container component | 30 min |
| 5.1 | Refactor UsersManager | 2 hours |
| 5.2 | Refactor RolesManager | 2.5 hours |
| 5.3 | Refactor UserRolesManager | 2 hours |
| 5.4 | Refactor PermissionsViewer | 1 hour |
| 5.5 | Refactor UserPermissionsManager | 2 hours |
| - | Testing & Integration | 3 hours |
| **Total** | | **~25.5 hours** |

**Note:** No custom context needed (saves 3 hours), no manual caching/optimistic updates needed (built into TanStack Query, saves 3.5 hours), total saved: 6.5 hours

---

## Benefits After Refactoring

### Code Quality
1. **DRY Compliance**: Data loading logic implemented once in context
2. **Single Source of Truth**: All components share the same RBAC data
3. **Type Safety**: Centralized type definitions, no duplicates
4. **Consistency**: Uniform UI patterns across all managers

### User Experience
1. **Real-time Updates**: Changes in one tab immediately reflect in others
2. **Better Performance**: Caching reduces unnecessary API calls
3. **Optimistic UI**: Immediate feedback on user actions
4. **Consistent Loading States**: Uniform loading indicators

### Developer Experience
1. **Easier Testing**: Context can be mocked once for all components
2. **Simpler Components**: Less state management in individual files
3. **Reusable Patterns**: Common UI patterns extracted to shared components
4. **Better Maintainability**: Changes to RBAC logic only need updates in one place

### Performance
1. **Reduced Renders**: Shared context prevents unnecessary re-renders
2. **Data Caching**: Avoid repeated API calls for same data
3. **Lazy Loading**: Components only load data when needed
4. **Optimized Queries**: Can implement batching in context layer

---

## Recommended Refactoring Order

1. **Phase 1** - Create types and utilities (foundation, no breaking changes)
2. **Phase 3.2-3.3** - Create simple wrapper components (quick wins)
3. **Phase 2** - Create RBAC context (core infrastructure)
4. **Phase 3.1** - Create data table component (major reusable piece)
5. **Phase 4** - Refactor container (sets pattern for children)
6. **Phase 5.4** - Refactor PermissionsViewer (simplest, good test case)
7. **Phase 5.1** - Refactor UsersManager (core functionality)
8. **Phase 5.3** - Refactor UserRolesManager (depends on users/roles)
9. **Phase 5.2** - Refactor RolesManager (complex permissions logic)
10. **Phase 5.5** - Refactor UserPermissionsManager (most complex)
11. **Phase 6** - Add optimizations (polish)

---

## Testing Strategy

### Unit Tests Required

```tsx
// lib/rbac-utils.test.ts
describe('groupPermissionsByResource', () => {
  it('groups permissions by resource')
  it('handles empty array')
  it('handles single resource')
})

// hooks/use-rbac-data.test.tsx
describe('useRBACData', () => {
  it('loads users on mount')
  it('loads roles on mount')
  it('loads permissions on mount')
  it('creates user and refreshes list')
  it('updates user and refreshes list')
  it('deletes user and refreshes list')
  it('handles API errors gracefully')
  it('prevents duplicate loads with caching')
})

// hooks/use-rbac-search.test.ts
describe('useRBACSearch', () => {
  it('filters items by search term')
  it('searches across multiple fields')
  it('returns all items when search is empty')
})

// components/shared/rbac-data-table.test.tsx
describe('RBACDataTable', () => {
  it('renders table with data')
  it('renders empty state')
  it('renders actions column')
  it('applies column classNames')
})
```

### Integration Tests

- Load all managers and verify data sharing
- Create user in UsersManager, verify it appears in UserRolesManager
- Assign role to user, verify permissions propagate
- Update role permissions, verify user permissions update
- Test optimistic updates rollback on error

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing functionality | Medium | High | Comprehensive testing, incremental rollout |
| Context performance issues | Low | Medium | Use React.memo, implement proper memoization |
| State synchronization bugs | Medium | Medium | Thorough testing of all CRUD operations |
| Over-abstraction | Low | Low | Keep components simple, avoid premature optimization |

---

## Migration Strategy

### Approach: Incremental Migration

1. **Add new infrastructure** (types, utils, context) alongside existing code
2. **Migrate one component at a time** starting with simplest (PermissionsViewer)
3. **Test thoroughly after each migration**
4. **Keep old code as fallback** until all components migrated
5. **Remove old code** only after full testing and verification

### Rollback Plan

- Keep original files with `.backup` suffix during migration
- Use feature flag to toggle between old/new implementations
- Can revert individual components independently

---

## Success Metrics

### Code Quality Metrics
- [ ] Component size < 300 lines each
- [ ] No duplicate type definitions
- [ ] No duplicate API loading logic
- [ ] Test coverage > 80%
- [ ] Zero ESLint warnings

### Performance Metrics
- [ ] Reduced API calls (measure with network monitor)
- [ ] Faster tab switching (use cached data)
- [ ] Improved perceived performance with optimistic updates

### User Experience Metrics
- [ ] Real-time updates work correctly
- [ ] No regression in functionality
- [ ] Consistent loading/error states
- [ ] Better error messages

---

## Future Enhancements (Post-Refactoring)

1. **WebSocket Integration** - Real-time updates when other users make changes
2. **Advanced Search** - Filter by multiple criteria, saved searches
3. **Bulk Operations** - Assign roles to multiple users at once
4. **Audit Log** - Track all RBAC changes for compliance
5. **Role Templates** - Pre-defined role configurations
6. **Permission Groups** - Organize permissions into logical groups
7. **User Groups** - Assign roles to groups instead of individual users
8. **Export/Import** - Backup and restore RBAC configuration

---

## Notes

- This refactoring is **optional but recommended** - existing code works but has maintainability issues
- Consider this pattern for other similar manager pages in the application
- RBAC context pattern can be reused for other domain-specific contexts (e.g., DeviceContext, NetworkContext)
- Document the new patterns in coding guidelines for consistency

---

**Document Version:** 1.0  
**Created:** January 2026  
**Status:** Planning
**Priority:** Medium (after critical refactorings like Check IP)

---

## Anti-Patterns to Avoid

### ❌ DO NOT Do These During Refactoring

**1. Don't Create Custom Context/Provider for Server State**
- ❌ Writing 250+ lines of custom `RBACProvider` with `useState`/`useEffect`
- ❌ Manual loading/error state management
- ❌ Custom cache invalidation logic
- ✅ **Instead:** Use TanStack Query (provides all of this automatically)

**2. Don't Use Manual State for Cached Data**
- ❌ `const [users, setUsers] = useState<User[]>([])`
- ❌ `useEffect(() => { loadUsers() }, [])`
- ✅ **Instead:** `const { data: users } = useRbacUsers()`

**3. Don't Create Custom Validation Logic**
- ❌ Manual form validation with `useState` for errors
- ❌ Custom validation functions
- ✅ **Instead:** react-hook-form + zod (mandatory per CLAUDE.md)

**4. Don't Put Components in `/components/shared/`**
- ❌ `components/shared/rbac-data-table.tsx`
- ❌ `lib/rbac-types.ts`
- ✅ **Instead:** Feature-based structure:
  - `components/features/settings/permissions/components/`
  - `components/features/settings/permissions/types/`

**5. Don't Use Inline Default Arrays/Objects**
- ❌ `function Component({ items = [] }) { }`
- ❌ `const config = { key: 'value' }` inside component
- ✅ **Instead:** Module-level constants:
  ```tsx
  const EMPTY_USERS: User[] = []
  const DEFAULT_CONFIG = { key: 'value' } as const
  ```

**6. Don't Forget to Memoize Hook Returns**
- ❌ `return { state, setState }` (new object every render)
- ✅ `return useMemo(() => ({ state, setState }), [state])`

**7. Don't Skip Query Key Centralization**
- ❌ Inline query keys: `useQuery({ queryKey: ['users'] })`
- ✅ **Instead:** `useQuery({ queryKey: queryKeys.rbac.users() })`

**8. Don't Ignore Exhaustive Dependencies**
- ❌ Disabling `exhaustive-deps` ESLint rule
- ❌ Using `// eslint-disable-next-line` without good reason
- ✅ **Instead:** Fix the underlying issue (memoization, constants)

---

## Architecture Compliance (CLAUDE.md)

### Success Metrics

**Code Quality:**
- [ ] Component size < 300 lines each
- [ ] No duplicate type definitions
- [ ] No duplicate API loading logic
- [ ] Test coverage > 80%
- [ ] Zero ESLint warnings
- [ ] **CRITICAL:** No `useState` + `useEffect` for server data (TanStack Query only)
- [ ] **CRITICAL:** All forms use react-hook-form + zod
- [ ] **CRITICAL:** No inline arrays/objects in default parameters

**Architecture Compliance:**
- [ ] All data fetching uses TanStack Query
- [ ] Query keys in centralized factory (`/lib/query-keys.ts`)
- [ ] API calls via `/api/proxy/rbac/*` (not direct backend)
- [ ] Feature-based folder structure (components/, hooks/, types/, utils/)
- [ ] All UI components from Shadcn
- [ ] Backend has repository/service/router layers
- [ ] Backend routes use `require_permission()` dependency

**User Experience:**
- [ ] Real-time updates across tabs (automatic cache invalidation)
- [ ] No regression in functionality
- [ ] Improved loading states (TanStack Query built-in)
- [ ] Better error messages (Toast notifications)
- [ ] Faster perceived performance (automatic caching)
- [ ] Optimistic updates for instant feedback

**Developer Experience:**
- [ ] Easier to test (isolated hooks and components)
- [ ] Clear component boundaries
- [ ] Reusable hooks and utilities
- [ ] Good documentation
- [ ] Type safety throughout
- [ ] No custom context needed
- [ ] Predictable re-render behavior

---

## Comparison with Check IP Refactoring

| Metric | Check IP | RBAC Settings |
|--------|----------|---------------|
| Lines of Code | 545 | 1,869 |
| Critical Bugs | Yes (polling stale closure) | No (but architecture violation) |
| Components | 1 large monolith | 6 separate managers |
| Refactoring Priority | **HIGH** (critical bug) | **MEDIUM** (tech debt) |
| Estimated Effort | ~10 hours | ~25.5 hours |
| Main Approach | TanStack Query + decomposition | TanStack Query + consolidation |
| Main Issue | One huge file (545 lines) | Massive code duplication (5x) |
| Primary Benefit | Fixes critical bug + maintainability | DRY + shared state + type safety |
| TanStack Query Usage | Auto-polling, mutations, settings | Queries, mutations, cross-tab sync |
| Form Validation | react-hook-form + zod (upload) | react-hook-form + zod (all dialogs) |
| Architecture Violation | Manual polling with useEffect | Custom context instead of TanStack Query |
| Code Reduction | -74% (545 → 144 lines) | -40% per component avg |
| Infrastructure Added | ~400 lines (hooks, components, types, utils) | ~600 lines (hooks, components, types, utils, dialogs) |

### Key Similarities

Both refactorings follow the same pattern:
1. ✅ Migrate to TanStack Query (mandatory per CLAUDE.md)
2. ✅ Feature-based folder structure (components/, hooks/, types/, utils/)
3. ✅ react-hook-form + zod for all forms
4. ✅ Extract constants to prevent re-render loops
5. ✅ Component decomposition for reusability
6. ✅ Centralized query keys in `/lib/query-keys.ts`

### Key Differences

**Check IP:**
- Single component → multiple smaller components
- Fixes critical polling bug
- Simpler state (mostly task polling)

**RBAC Settings:**
- Multiple components with duplication → consolidated shared hooks
- No critical bugs, just poor architecture
- Complex relational state (users, roles, permissions, assignments)
- More mutations (CRUD for 3+ entities)
