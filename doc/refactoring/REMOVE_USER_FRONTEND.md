# Refactoring plan — Frontend confirmation flow for user deletion

Companion to `doc/refactoring/REMOVE_USER_CLEANUP.md` (backend, already
implemented). That plan added `GET /api/rbac/users/{id}/deletion-impact`
and made `DELETE /api/rbac/users/{id}` require two extra query
parameters whenever the user being deleted owns job templates/schedules:

- `reassign_global_items_to_user_id` — required when the user created
  any **global** template/schedule (there is no way to leave a global
  item ownerless).
- `delete_private_items=true` — required when the user owns any
  **private** template/schedule (confirms they should be hard-deleted).

Without both, `DELETE` now returns `409` with body
`{"detail": {"message": "...", "impact": <UserDeletionImpact>}}`
instead of either silently doing nothing useful or (pre-refactor)
crashing with a 500. The current frontend has no idea any of this
exists — it still calls `DELETE /api/rbac/users/{id}` with no
parameters after a generic yes/no confirm, so every delete of a user
who owns any global/private job item will now hit that 409 and show a
raw, unhelpful error toast.

This document is self-contained: every change lists the exact
"Code before" / "Code after" so it can be implemented without
re-reading the surrounding modules.

---

## 1. Goal & non-goals

### 1.1 Goal

1. Before deleting a user, fetch `GET /rbac/users/{id}/deletion-impact`
   and show the admin what it found.
2. If the user created any **global** templates/schedules, require the
   admin to pick a **different user** to reassign them to before the
   delete button is enabled.
3. If the user owns any **private** templates/schedules, list them
   (plus the `cascade_schedules_from_other_users` warning, if any) and
   require an explicit checkbox confirmation before the delete button
   is enabled.
4. If neither applies, keep today's simple "are you sure?" confirm.
5. Call `DELETE /rbac/users/{id}` with the resolved
   `reassign_global_items_to_user_id` / `delete_private_items`
   parameters once the admin confirms.
6. Handle the case where the impact changes between the preview fetch
   and the delete call (a concurrent template/schedule
   creation/deletion elsewhere) — a `409` at delete time should
   re-fetch the impact and re-prompt with the updated data, not show a
   dead-end error toast.

### 1.2 Non-goals

- No changes to the **bulk delete** UI
  (`POST /rbac/users/bulk-delete`) — per
  `REMOVE_USER_CLEANUP.md` §1.2, that endpoint intentionally has no
  reassignment flow; a blocked user in a bulk delete just shows up in
  its existing per-user error list. Deleting a user who owns
  global/private job items must go through the single-user delete flow
  built here.
- No changes to how templates/schedules are displayed/managed outside
  of this delete-confirmation dialog.
- No changes to `toggle_user_activation` (deactivation) — per
  `REMOVE_USER_CLEANUP.md` §7, surfacing a similar warning there is a
  documented follow-up, not part of this plan.

---

## 2. Current state (verified)

### 2.1 Delete is a single generic confirm, no impact awareness

```54:64:frontend/src/components/features/settings/permissions/permissions/users-manager.tsx
  const handleDelete = useCallback(
    (userId: number) => {
      openConfirm({
        title: 'Delete User',
        description: 'Are you sure you want to delete this user?',
        variant: 'destructive',
        onConfirm: () => deleteUser.mutate(userId),
      })
    },
    [deleteUser, openConfirm]
  )
```

`openConfirm`/`ConfirmDialog` (`@/hooks/use-confirm-dialog`,
`@/components/shared/confirm-dialog`) wrap shadcn's `AlertDialog` and
only support a plain string `description` — there is no slot for a
dynamic impact list, a user-picker `Select`, or a checkbox, so this
dialog cannot be extended in place. A new dialog, built on
`@/components/ui/dialog` (the same primitive `UserDialog` already uses
for create/edit), is needed instead.

### 2.2 The delete mutation takes a bare `userId`, no query params

```65:83:frontend/src/components/features/settings/permissions/hooks/use-rbac-mutations.ts
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
        variant: 'destructive',
      })
    },
  })
```

Confirmed (`grep -rn "deleteUser\b" src`) that this mutation is only
referenced from `users-manager.tsx` — its call signature can change
freely.

### 2.3 `apiCall` throws a plain `Error`, discarding the `detail.impact` body

```57:87:frontend/src/hooks/use-api.ts
      if (!response.ok) {
        const errorText = await response.text()

        if (response.status === 401) {
          logoutRef.current()
          if (typeof window !== 'undefined') {
            setTimeout(() => {
              window.location.replace('/login')
            }, 100)
          }
          return Promise.reject(new Error('Session expired, redirecting to login...'))
        }

        let errorMessage = `API Error ${response.status}`
        try {
          const errorData = JSON.parse(errorText)
          if (errorData.detail) {
            const detail = errorData.detail
            if (typeof detail === 'object' && detail !== null && typeof detail.message === 'string') {
              errorMessage = detail.message
            } else {
              errorMessage = String(detail)
            }
          } else if (errorText) {
            errorMessage = `${errorMessage}: ${errorText}`
          }
        } catch {
          if (errorText) errorMessage = `${errorMessage}: ${errorText}`
        }
        throw new Error(errorMessage)
      }
```

The backend's 409 body is
`{"detail": {"message": "...", "impact": {...}}}` — today only
`detail.message` survives; `detail.impact` (the `UserDeletionImpact`
payload) is thrown away. There is also no `status` on the thrown
error, so callers can't distinguish "409, needs confirmation" from any
other failure. This needs to become a typed `ApiError` carrying both.

### 2.4 No `UserDeletionImpact` type, query key, or query hook exist yet

`frontend/src/components/features/settings/permissions/types/index.ts`
(74 lines, full file already read) has `User`, `Role`, `Permission`,
etc., but nothing modeling the backend's `UserDeletionImpact` response.

`frontend/src/lib/query-keys.ts` (`rbac` block,
lines 315–335) has `users`, `user`, `userRoles`, `userPermissions`,
`roles`, `role`, `rolePermissions`, `permissions` — no
`deletionImpact`.

`frontend/src/components/features/settings/permissions/hooks/use-rbac-queries.ts`
has `useRbacUsers`, `useRbacRoles`, `useRbacPermissions`,
`useRolePermissions`, `useUserPermissions`, `useUserPermissionOverrides`
— no query hook for `GET /rbac/users/{id}/deletion-impact`.

---

## 3. Design

### 3.1 `use-api.ts` — throw a typed `ApiError` carrying `status` + `detail`

**File:** `frontend/src/hooks/use-api.ts`

**Code before**

```typescript
import { useAuthStore } from '@/lib/auth-store'
import { useRouter } from 'next/navigation'
import { useCallback, useRef, useEffect, useMemo } from 'react'

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: unknown
  headers?: Record<string, string>
}
```

**Code after**

```typescript
import { useAuthStore } from '@/lib/auth-store'
import { useRouter } from 'next/navigation'
import { useCallback, useRef, useEffect, useMemo } from 'react'

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: unknown
  headers?: Record<string, string>
}

/**
 * Thrown by apiCall on any non-2xx response. `status` and `detail` let
 * callers branch on structured error bodies (e.g. a 409 whose
 * `detail` is `{ message, impact }`) instead of parsing `error.message`.
 */
export class ApiError extends Error {
  status: number
  detail: unknown

  constructor(message: string, status: number, detail: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}
```

**Code before**

```typescript
      if (!response.ok) {
        const errorText = await response.text()

        if (response.status === 401) {
          logoutRef.current()
          if (typeof window !== 'undefined') {
            setTimeout(() => {
              window.location.replace('/login')
            }, 100)
          }
          return Promise.reject(new Error('Session expired, redirecting to login...'))
        }

        let errorMessage = `API Error ${response.status}`
        try {
          const errorData = JSON.parse(errorText)
          if (errorData.detail) {
            const detail = errorData.detail
            if (typeof detail === 'object' && detail !== null && typeof detail.message === 'string') {
              errorMessage = detail.message
            } else {
              errorMessage = String(detail)
            }
          } else if (errorText) {
            errorMessage = `${errorMessage}: ${errorText}`
          }
        } catch {
          if (errorText) errorMessage = `${errorMessage}: ${errorText}`
        }
        throw new Error(errorMessage)
      }
```

**Code after**

```typescript
      if (!response.ok) {
        const errorText = await response.text()

        if (response.status === 401) {
          logoutRef.current()
          if (typeof window !== 'undefined') {
            setTimeout(() => {
              window.location.replace('/login')
            }, 100)
          }
          return Promise.reject(new Error('Session expired, redirecting to login...'))
        }

        let errorMessage = `API Error ${response.status}`
        let errorDetail: unknown = undefined
        try {
          const errorData = JSON.parse(errorText)
          if (errorData.detail) {
            const detail = errorData.detail
            errorDetail = detail
            if (typeof detail === 'object' && detail !== null && typeof detail.message === 'string') {
              errorMessage = detail.message
            } else {
              errorMessage = String(detail)
            }
          } else if (errorText) {
            errorMessage = `${errorMessage}: ${errorText}`
          }
        } catch {
          if (errorText) errorMessage = `${errorMessage}: ${errorText}`
        }
        throw new ApiError(errorMessage, response.status, errorDetail)
      }
```

`ApiError extends Error`, so every existing `onError: (error: Error) =>`
handler across the codebase keeps working unchanged (`error.message`
is unaffected) — this is additive, not breaking.

---

### 3.2 New types — mirror the backend's `UserDeletionImpact` shapes

**File:**
`frontend/src/components/features/settings/permissions/types/index.ts`

**Code before**

```typescript
export interface CreateRoleData {
  name: string
  description: string
}

export interface UpdateRoleData {
  name?: string
  description?: string
}
```

**Code after**

```typescript
export interface CreateRoleData {
  name: string
  description: string
}

export interface UpdateRoleData {
  name?: string
  description?: string
}

// User deletion impact preview (GET /rbac/users/{id}/deletion-impact)
export interface UserDeletionImpactTemplate {
  id: number
  name: string
  job_type: string
}

export interface UserDeletionImpactSchedule {
  id: number
  job_identifier: string
  template_name: string | null
}

export interface UserDeletionImpactCascadeSchedule {
  id: number
  job_identifier: string
  owner_user_id: number | null
  is_global: boolean
}

export interface UserDeletionImpact {
  user_id: number
  username: string
  global_templates: UserDeletionImpactTemplate[]
  global_schedules: UserDeletionImpactSchedule[]
  private_templates: UserDeletionImpactTemplate[]
  private_schedules: UserDeletionImpactSchedule[]
  cascade_schedules_from_other_users: UserDeletionImpactCascadeSchedule[]
  private_credentials_count: number
  requires_global_reassignment: boolean
  requires_private_confirmation: boolean
}
```

---

### 3.3 Query key for the impact preview

**File:** `frontend/src/lib/query-keys.ts`

**Code before**

```typescript
  // RBAC (Role-Based Access Control)
  rbac: {
    all: ['rbac'] as const,

    // Users
    users: () => [...queryKeys.rbac.all, 'users'] as const,
    user: (id: number) => [...queryKeys.rbac.all, 'user', id] as const,
    userRoles: (userId: number) =>
      [...queryKeys.rbac.all, 'user', userId, 'roles'] as const,
    userPermissions: (userId: number) =>
      [...queryKeys.rbac.all, 'user', userId, 'permissions'] as const,

    // Roles
```

**Code after**

```typescript
  // RBAC (Role-Based Access Control)
  rbac: {
    all: ['rbac'] as const,

    // Users
    users: () => [...queryKeys.rbac.all, 'users'] as const,
    user: (id: number) => [...queryKeys.rbac.all, 'user', id] as const,
    userRoles: (userId: number) =>
      [...queryKeys.rbac.all, 'user', userId, 'roles'] as const,
    userPermissions: (userId: number) =>
      [...queryKeys.rbac.all, 'user', userId, 'permissions'] as const,
    deletionImpact: (userId: number) =>
      [...queryKeys.rbac.all, 'user', userId, 'deletion-impact'] as const,

    // Roles
```

---

### 3.4 New query hook: `useUserDeletionImpact`

**File:**
`frontend/src/components/features/settings/permissions/hooks/use-rbac-queries.ts`

**Code before**

```typescript
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { Role, Permission, UsersResponse, RoleWithPermissions } from '../types'
import {
  CACHE_TIME,
  EMPTY_USERS,
  EMPTY_ROLES,
  EMPTY_PERMISSIONS,
} from '../utils/constants'
```

**Code after**

```typescript
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type {
  Role,
  Permission,
  UsersResponse,
  RoleWithPermissions,
  UserDeletionImpact,
} from '../types'
import {
  CACHE_TIME,
  EMPTY_USERS,
  EMPTY_ROLES,
  EMPTY_PERMISSIONS,
} from '../utils/constants'
```

**Code before**

```typescript
interface UseUserPermissionOverridesOptions {
  enabled?: boolean
}

const DEFAULT_USER_OVERRIDES_OPTIONS: UseUserPermissionOverridesOptions = {
  enabled: true,
}

/**
 * Fetch user's explicit permission overrides
 */
export function useUserPermissionOverrides(
  userId: number | null,
  options: UseUserPermissionOverridesOptions = DEFAULT_USER_OVERRIDES_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.rbac.userPermissions(userId!),
    queryFn: async () => {
      const response = await apiCall<Permission[]>(
        `rbac/users/${userId}/permissions/overrides`,
        { method: 'GET' }
      )
      return response || EMPTY_PERMISSIONS
    },
    enabled: enabled && !!userId,
    staleTime: 0, // Always fetch fresh for overrides
  })
}
```

**Code after**

```typescript
interface UseUserPermissionOverridesOptions {
  enabled?: boolean
}

const DEFAULT_USER_OVERRIDES_OPTIONS: UseUserPermissionOverridesOptions = {
  enabled: true,
}

/**
 * Fetch user's explicit permission overrides
 */
export function useUserPermissionOverrides(
  userId: number | null,
  options: UseUserPermissionOverridesOptions = DEFAULT_USER_OVERRIDES_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.rbac.userPermissions(userId!),
    queryFn: async () => {
      const response = await apiCall<Permission[]>(
        `rbac/users/${userId}/permissions/overrides`,
        { method: 'GET' }
      )
      return response || EMPTY_PERMISSIONS
    },
    enabled: enabled && !!userId,
    staleTime: 0, // Always fetch fresh for overrides
  })
}

interface UseUserDeletionImpactOptions {
  enabled?: boolean
}

const DEFAULT_DELETION_IMPACT_OPTIONS: UseUserDeletionImpactOptions = {
  enabled: true,
}

/**
 * Preview what deleting a user would affect (global/private job
 * templates and schedules) — fetched on demand when the delete-user
 * dialog opens, always fresh since it gates a destructive action.
 */
export function useUserDeletionImpact(
  userId: number | null,
  options: UseUserDeletionImpactOptions = DEFAULT_DELETION_IMPACT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.rbac.deletionImpact(userId!),
    queryFn: async () => {
      return apiCall<UserDeletionImpact>(`rbac/users/${userId}/deletion-impact`, {
        method: 'GET',
      })
    },
    enabled: enabled && !!userId,
    staleTime: 0,
  })
}
```

---

### 3.5 Rewrite the `deleteUser` mutation to accept reassignment/confirmation params

**File:**
`frontend/src/components/features/settings/permissions/hooks/use-rbac-mutations.ts`

**Code before**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type {
  CreateUserData,
  UpdateUserData,
  CreateRoleData,
  UpdateRoleData,
} from '../types'
import { useMemo } from 'react'
```

**Code after**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi, ApiError } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type {
  CreateUserData,
  UpdateUserData,
  CreateRoleData,
  UpdateRoleData,
} from '../types'
import { useMemo } from 'react'
```

**Code before**

```typescript
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
        variant: 'destructive',
      })
    },
  })
```

**Code after**

```typescript
  interface DeleteUserParams {
    userId: number
    reassignGlobalItemsToUserId?: number
    deletePrivateItems?: boolean
  }

  const deleteUser = useMutation({
    mutationFn: async ({
      userId,
      reassignGlobalItemsToUserId,
      deletePrivateItems,
    }: DeleteUserParams) => {
      const params = new URLSearchParams()
      if (reassignGlobalItemsToUserId != null) {
        params.set(
          'reassign_global_items_to_user_id',
          String(reassignGlobalItemsToUserId)
        )
      }
      if (deletePrivateItems) {
        params.set('delete_private_items', 'true')
      }
      const qs = params.toString()
      return apiCall(`rbac/users/${userId}${qs ? `?${qs}` : ''}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rbac.users() })
      toast({
        title: 'Success',
        description: 'User deleted successfully',
      })
    },
    onError: (error: Error) => {
      // 409 means the delete-user dialog needs another round of input
      // (reassignment/confirmation) — it handles that inline itself,
      // so don't also pop a dead-end error toast for it.
      if (error instanceof ApiError && error.status === 409) {
        return
      }
      toast({
        title: 'Error',
        description: `Failed to delete user: ${error.message}`,
        variant: 'destructive',
      })
    },
  })
```

`DeleteUserParams` is declared just above the mutation (matching how
`updateUser`/`assignRoleToUser`/etc. inline their param object types
directly in the `mutationFn` signature elsewhere in this same file —
pulling it out here only because `DeleteUserDialog` in §3.6 also needs
to reference the shape when calling `mutateAsync`).

---

### 3.6 New `DeleteUserDialog` component

**File (new):**
`frontend/src/components/features/settings/permissions/components/dialogs/delete-user-dialog.tsx`

Modeled on `UserDialog` (`components/dialogs/user-dialog.tsx`) for the
`Dialog`/`DialogContent`/`DialogFooter` shell — the generic
`ConfirmDialog` can't render a `Select` or a dynamic impact list (see
§2.1), so this is a purpose-built dialog rather than an extension of
the shared confirm dialog.

```typescript
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useUserDeletionImpact, useRbacUsers } from '../../hooks/use-rbac-queries'
import { useRbacMutations } from '../../hooks/use-rbac-mutations'
import { RBACLoading } from '../rbac-loading'
import { ApiError } from '@/hooks/use-api'
import type { User } from '../../types'
import { EMPTY_USERS } from '../../utils/constants'

interface DeleteUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
}

export function DeleteUserDialog({ open, onOpenChange, user }: DeleteUserDialogProps) {
  const { deleteUser } = useRbacMutations()
  const { data: allUsers = EMPTY_USERS } = useRbacUsers({ enabled: open })
  const {
    data: impact,
    isLoading: isImpactLoading,
    isError: isImpactError,
    refetch: refetchImpact,
  } = useUserDeletionImpact(user?.id ?? null, { enabled: open && !!user })

  const [reassignToUserId, setReassignToUserId] = useState('')
  const [confirmPrivateDelete, setConfirmPrivateDelete] = useState(false)
  const [conflictMessage, setConflictMessage] = useState<string | null>(null)

  // Reset local state each time the dialog is (re)opened for a user
  useEffect(() => {
    if (open) {
      setReassignToUserId('')
      setConfirmPrivateDelete(false)
      setConflictMessage(null)
    }
  }, [open, user])

  const reassignCandidates = useMemo(
    () => allUsers.filter(candidate => candidate.id !== user?.id),
    [allUsers, user]
  )

  const requiresReassignment = impact?.requires_global_reassignment ?? false
  const requiresPrivateConfirmation = impact?.requires_private_confirmation ?? false
  const canConfirm =
    !!impact &&
    (!requiresReassignment || reassignToUserId !== '') &&
    (!requiresPrivateConfirmation || confirmPrivateDelete)

  const handleCancel = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const handleConfirm = useCallback(async () => {
    if (!user) return
    setConflictMessage(null)
    try {
      await deleteUser.mutateAsync({
        userId: user.id,
        reassignGlobalItemsToUserId: reassignToUserId
          ? Number(reassignToUserId)
          : undefined,
        deletePrivateItems: confirmPrivateDelete,
      })
      onOpenChange(false)
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setConflictMessage(
          "This user's templates/schedules changed since this dialog opened " +
            '— review the updated impact below and confirm again.'
        )
        refetchImpact()
        return
      }
      // Any other error already surfaced via the mutation's onError toast.
    }
  }, [
    user,
    reassignToUserId,
    confirmPrivateDelete,
    deleteUser,
    onOpenChange,
    refetchImpact,
  ])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Delete User{user ? `: ${user.username}` : ''}</DialogTitle>
          <DialogDescription>
            This permanently deletes the user account and its RBAC assignments.
          </DialogDescription>
        </DialogHeader>

        {isImpactLoading && (
          <RBACLoading message="Checking owned templates and schedules..." />
        )}

        {isImpactError && (
          <Alert className="status-error">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Could not determine what this deletion would affect. Try again.
            </AlertDescription>
          </Alert>
        )}

        {impact && (
          <div className="space-y-4">
            {conflictMessage && (
              <Alert className="status-error">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{conflictMessage}</AlertDescription>
              </Alert>
            )}

            {!requiresReassignment && !requiresPrivateConfirmation && (
              <p className="text-sm text-muted-foreground">
                This user owns no global or private job templates/schedules. Are
                you sure you want to delete <strong>{user?.username}</strong>?
              </p>
            )}

            {requiresReassignment && (
              <div className="space-y-2">
                <p className="text-sm">
                  <strong>{user?.username}</strong> created{' '}
                  {impact.global_templates.length} global template(s) and{' '}
                  {impact.global_schedules.length} global schedule(s). Choose who
                  should become the new owner:
                </p>
                <ul className="text-sm text-muted-foreground list-disc pl-5">
                  {impact.global_templates.map(template => (
                    <li key={`tmpl-${template.id}`}>Template: {template.name}</li>
                  ))}
                  {impact.global_schedules.map(schedule => (
                    <li key={`sched-${schedule.id}`}>
                      Schedule: {schedule.job_identifier}
                    </li>
                  ))}
                </ul>
                <div className="space-y-1">
                  <Label htmlFor="reassign-to-user">Reassign to</Label>
                  <Select value={reassignToUserId} onValueChange={setReassignToUserId}>
                    <SelectTrigger id="reassign-to-user">
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {reassignCandidates.map(candidate => (
                        <SelectItem key={candidate.id} value={String(candidate.id)}>
                          {candidate.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {requiresPrivateConfirmation && (
              <div className="space-y-2">
                <p className="text-sm">
                  <strong>{user?.username}</strong> owns{' '}
                  {impact.private_templates.length} private template(s) and{' '}
                  {impact.private_schedules.length} private schedule(s). These
                  will be permanently deleted:
                </p>
                <ul className="text-sm text-muted-foreground list-disc pl-5">
                  {impact.private_templates.map(template => (
                    <li key={`ptmpl-${template.id}`}>Template: {template.name}</li>
                  ))}
                  {impact.private_schedules.map(schedule => (
                    <li key={`psched-${schedule.id}`}>
                      Schedule: {schedule.job_identifier}
                    </li>
                  ))}
                </ul>

                {impact.cascade_schedules_from_other_users.length > 0 && (
                  <Alert className="status-error">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {impact.cascade_schedules_from_other_users.length} schedule(s)
                      belonging to other users reference these templates and will
                      also be removed.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="confirm-private-delete"
                    checked={confirmPrivateDelete}
                    onCheckedChange={checked =>
                      setConfirmPrivateDelete(checked === true)
                    }
                  />
                  <Label
                    htmlFor="confirm-private-delete"
                    className="text-sm font-normal"
                  >
                    I understand these will be permanently deleted
                  </Label>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canConfirm || deleteUser.isPending}
            onClick={handleConfirm}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

Notes:

- `useRbacUsers({ enabled: open })` reuses the existing users-list
  query (already cached from the table behind this dialog in the
  common case) purely to populate the reassignment `Select` — no new
  endpoint needed for that part.
- `useUserDeletionImpact(..., { staleTime: 0 })` (from §3.4) always
  refetches when the dialog opens, so stale impact data from a
  previous open can't leak into a new one.
- The reassignment `Select` excludes the user being deleted
  (`reassignCandidates`) but intentionally does **not** filter out
  inactive users or the `admin` account — the backend's
  `reassign_global_items_to_user_id` only requires the target user to
  exist (`RBACService.delete_user_with_rbac` → `get_user_by_id`, no
  active/role check), so over-filtering here would just make valid
  targets unreachable without any real safety benefit.
- `handleConfirm` uses `deleteUser.mutateAsync` (not `.mutate`) so it
  can `try/catch` the specific 409-conflict case locally, while any
  other error still gets the shared toast from the mutation's
  `onError` (§3.5).

---

### 3.7 Wire the new dialog into `UsersManager`

**File:**
`frontend/src/components/features/settings/permissions/permissions/users-manager.tsx`

**Code before**

```tsx
'use client'

import { useState, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { UserPlus, Edit, Trash2, RefreshCw } from 'lucide-react'
import { useRbacUsers } from '../hooks/use-rbac-queries'
import { useRbacMutations } from '../hooks/use-rbac-mutations'
import { UserDialog } from '../components/dialogs/user-dialog'
import { RBACDataTable } from '../components/rbac-data-table'
import { RBACLoading } from '../components/rbac-loading'
import type { User, CreateUserData, UpdateUserData } from '../types'
import { EMPTY_USERS } from '../utils/constants'
import { useConfirmDialog } from '@/hooks/use-confirm-dialog'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'

export function UsersManager() {
  // TanStack Query hooks - no manual state management needed
  const { data: users = EMPTY_USERS, isLoading, refetch } = useRbacUsers()
  const { createUser, updateUser, deleteUser } = useRbacMutations()

  // Confirm dialog
  const { confirmDialog, openConfirm } = useConfirmDialog()

  // Client-side UI state only
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
```

**Code after**

```tsx
'use client'

import { useState, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { UserPlus, Edit, Trash2, RefreshCw } from 'lucide-react'
import { useRbacUsers } from '../hooks/use-rbac-queries'
import { useRbacMutations } from '../hooks/use-rbac-mutations'
import { UserDialog } from '../components/dialogs/user-dialog'
import { DeleteUserDialog } from '../components/dialogs/delete-user-dialog'
import { RBACDataTable } from '../components/rbac-data-table'
import { RBACLoading } from '../components/rbac-loading'
import type { User, CreateUserData, UpdateUserData } from '../types'
import { EMPTY_USERS } from '../utils/constants'

export function UsersManager() {
  // TanStack Query hooks - no manual state management needed
  const { data: users = EMPTY_USERS, isLoading, refetch } = useRbacUsers()
  const { createUser, updateUser } = useRbacMutations()

  // Client-side UI state only
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [userPendingDelete, setUserPendingDelete] = useState<User | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
```

`deleteUser` is no longer destructured here — `DeleteUserDialog` calls
`useRbacMutations()` itself (§3.6), the same way `UserDialog`'s
sibling components own their own data needs rather than having
everything threaded through `UsersManager` props.
`useConfirmDialog`/`ConfirmDialog` are dropped entirely: `handleDelete`
was their only caller in this file.

**Code before**

```tsx
  const handleDelete = useCallback(
    (userId: number) => {
      openConfirm({
        title: 'Delete User',
        description: 'Are you sure you want to delete this user?',
        variant: 'destructive',
        onConfirm: () => deleteUser.mutate(userId),
      })
    },
    [deleteUser, openConfirm]
  )
```

**Code after**

```tsx
  const handleDeleteClick = useCallback((user: User) => {
    setUserPendingDelete(user)
  }, [])
```

**Code before**

```tsx
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDelete(user.id)}
              disabled={user.username === 'admin'}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
```

**Code after**

```tsx
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDeleteClick(user)}
              disabled={user.username === 'admin'}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
```

**Code before**

```tsx
      <UserDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSubmit={handleSubmit}
        user={selectedUser}
        isEdit={!!selectedUser}
      />
      <ConfirmDialog {...confirmDialog} />
    </div>
  )
}
```

**Code after**

```tsx
      <UserDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSubmit={handleSubmit}
        user={selectedUser}
        isEdit={!!selectedUser}
      />
      <DeleteUserDialog
        open={!!userPendingDelete}
        onOpenChange={open => {
          if (!open) setUserPendingDelete(null)
        }}
        user={userPendingDelete}
      />
    </div>
  )
}
```

`open` is derived from `!!userPendingDelete` (no separate boolean)
so there's exactly one source of truth for "which user, if any, is
pending deletion" — matching the `selectedUser`/`isDialogOpen` split
already used for create/edit would require keeping two pieces of
state in sync for no benefit here, since (unlike edit) there's no
"create" case that needs the dialog open with a `null` user.

---

## 4. Manual verification

No frontend unit-test harness exists for this feature area today
(confirmed: no `*.test.tsx`/`*.spec.tsx` under
`components/features/settings/permissions/`), and per `CLAUDE.md`
frontend's Definition of Done is `npm run lint` plus hands-on
verification in the browser. Steps:

1. `cd frontend && npm run lint` — must be clean.
2. Start backend + frontend (`cd backend && python start.py`,
   `cd frontend && npm run dev`), log in as `admin`.
3. **Clean user, no owned items:** create a throwaway user with no
   templates/schedules, delete it → dialog shows the plain "are you
   sure?" text, no Select/checkbox, delete succeeds.
4. **Global template/schedule owner:** as the throwaway user, create a
   global job template (and optionally a global schedule), then as
   `admin` attempt to delete that user → dialog shows the global
   items list and a required "Reassign to" picker; Delete stays
   disabled until a target user is picked; after confirming, verify
   (via `/settings/jobs` templates list) the template's `created_by`
   changed to the picked user.
5. **Private template/schedule owner:** as the throwaway user, create
   a *private* job template, then as `admin` attempt to delete → dialog
   shows the private items list and a required checkbox; Delete stays
   disabled until checked; after confirming, verify the template is
   gone from the templates list.
6. **Both at once:** a user with one global and one private template
   → dialog shows both sections; Delete requires both the picker and
   the checkbox.
7. **Conflict retry:** open the delete dialog for a user with a
   private template (leave it open), in another tab/session delete
   that template directly, then confirm in the still-open dialog →
   backend impact no longer requires private confirmation by the time
   `DELETE` runs, so this specific case won't 409 as a *false*
   positive; to actually exercise the 409 path, instead *add* a new
   private template for that user in the other tab while the dialog
   is open, then confirm without re-opening — expect the inline
   conflict banner, an impact refetch showing the new item, and the
   dialog staying open rather than a bare error toast.
8. Confirm the `admin` account itself still can't be targeted (delete
   button stays disabled per the existing
   `disabled={user.username === 'admin'}` guard, untouched by this
   plan).

---

## 5. Rollout steps

1. Implement §3.1 first (`ApiError`) — everything else depends on it
   for 409 detection.
2. §3.2–§3.4 (types, query key, query hook) — additive, no behavior
   change yet.
3. §3.5 (mutation rewrite) — still additive from the caller's
   perspective until §3.7 lands, since nothing calls `deleteUser` with
   the new shape yet.
4. §3.6 (new dialog component).
5. §3.7 (wire into `UsersManager`) — this is the only step that changes
   observable behavior.
6. `cd frontend && npm run lint` — must be clean.
7. Manual verification per §4.
