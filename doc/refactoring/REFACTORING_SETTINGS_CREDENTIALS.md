# Refactoring Plan: Credentials Management Component

**Component:** `frontend/src/components/features/settings/credentials/credentials-management.tsx`
**Created:** 2026-01-31
**Status:** Planning
**Lines of Code:** 670

## TL;DR - What's Wrong & How to Fix It

**Problems:**
1. 🚫 **Architecture violation** - Manual `useState`/`useEffect` instead of mandatory TanStack Query
2. ⚠️ **Missing form validation** - No react-hook-form + zod (mandatory per CLAUDE.md)
3. 📏 **Too large** - 670 lines, should be < 300 per component
4. 🔁 **Custom message state** - Manual toast implementation instead of useToast()
5. ⚠️ **Missing standards** - No component decomposition, 8 loading states, inline validation
6. 🗂️ **No feature organization** - Single monolithic file
7. 🐛 **Potential bugs** - Race conditions, memory leaks, unsafe type coercion
8. 🎨 **UI violations** - window.confirm(), arbitrary colors, native checkbox

**Solution:**
1. ✅ **Migrate to TanStack Query** - Replaces 100+ lines of manual state with built-in caching
2. ✅ **Add react-hook-form + zod** - Type-safe form validation (mandatory)
3. ✅ **Decompose into 4 components** - Form dialog, table list, table row, delete dialog
4. ✅ **Add mutation hooks** - use-credential-mutations for create/update/delete
5. ✅ **Replace custom toast** - Use Shadcn useToast() hook
6. ✅ **Feature-based structure** - components/, hooks/, dialogs/, types/, validation/
7. ✅ **Fix UI violations** - AlertDialog, Shadcn Checkbox, semantic colors

**Critical Path:** Phase 1 (foundation) → Phase 3 (TanStack Query) → Phase 2 (decomposition)

**Minimum Viable:** Phases 1-3 establishes proper architecture per CLAUDE.md

---

## Executive Summary

The Credentials Management component is a monolithic 670-line file with **critical architecture violations** and significant technical debt:

1. **Architecture Violation** - Uses manual `useState` + `useEffect` instead of mandatory TanStack Query
2. **No Form Validation** - Missing react-hook-form + zod validation (mandatory per CLAUDE.md)
3. **Custom Toast System** - Implements custom message state instead of Shadcn useToast()
4. **No Component Decomposition** - Single component handles table, form, validation, and state
5. **Manual State Management** - 7 separate `useState` hooks for data and loading states
6. **Manual API Logic** - 3 API call functions with repeated error handling
7. **UI Violations** - Uses window.confirm(), arbitrary colors, native inputs
8. **Potential Bugs** - Race conditions, memory leaks, unsafe type coercion

**Bottom Line:** TanStack Query migration is mandatory per CLAUDE.md and eliminates 100+ lines of manual state management automatically. The lack of form validation creates data integrity risks.

## Key Changes Summary

| Current Approach | Required Approach (CLAUDE.md) |
|------------------|-------------------------------|
| Manual `useState` + `useEffect` | **TanStack Query with auto-caching** |
| 7 separate loading states | **TanStack Query built-in states** |
| Manual API calls with error handling | **useQuery/useMutation hooks** |
| Custom message state | **useToast() from Shadcn UI** |
| Single 670-line component | **4 focused components < 200 lines** |
| Manual form validation | **react-hook-form + zod** |
| window.confirm() | **Shadcn AlertDialog** |
| Native checkbox | **Shadcn Checkbox** |
| Arbitrary colors (bg-yellow-100) | **Semantic classes (bg-background)** |
| No query key factory | **Centralized query keys** |

## Quick Wins (Can Start Immediately)

These tasks can be done right now without breaking existing functionality:

### 1. Extract Type Definitions
- Create `types.ts`
- Move Credential, CredentialFormData, StatusMessage interfaces
- No behavioral changes

### 2. Extract Constants
- Create `constants.ts`
- Move CREDENTIAL_TYPES
- Fixes potential re-render issues

### 3. Update Query Keys
- Add to `/lib/query-keys.ts`
- Set up foundation for TanStack Query migration

### 4. Create Validation Schema
- Create `validation.ts`
- Define zod schema for form validation
- Type-safe form values

**Risk:** Zero (no behavioral changes)
**Benefit:** Immediate code quality improvement, sets up for TanStack Query migration

---

## Current Architecture

```
frontend/src/components/features/settings/credentials/
└── credentials-management.tsx       # 670 lines - Everything in one file
```

**Responsibilities:**
- Credentials table (lines 404-503)
- Form dialog (lines 505-667)
- Data loading (lines 92-106)
- Data mutations (lines 188-255, 257-277)
- Form validation (lines 146-165)
- Message management (lines 87-90, 386-401)

**Total:** 670 lines with mixed concerns

---

## Problem Analysis

### Problem 1: Architecture Violation - Manual State Management

**Affected Lines:** 67-68, 71, 73-74, 92-106, 327-329

**Current Pattern:**
```tsx
// Lines 67-68: Manual state management
const [credentials, setCredentials] = useState<Credential[]>([])
const [loading, setLoading] = useState(false)

// Lines 92-106: Manual API call with error handling
const loadCredentials = useCallback(async () => {
  setLoading(true)
  try {
    const response = await apiCall<Credential[]>(`credentials?source=general&include_expired=${includeExpired}`)
    setCredentials(response || [])
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error loading credentials:', errorMessage)
    showMessage(errorMessage, 'error')
  } finally {
    setLoading(false)
  }
}, [includeExpired, apiCall, showMessage])

// Lines 327-329: Manual useEffect
useEffect(() => {
  loadCredentials()
}, [loadCredentials])
```

**Issues:**
- Manual loading state management (7 states!)
- Duplicate error handling pattern (3 functions)
- No caching mechanism
- Manual state updates
- Violates CLAUDE.md mandatory TanStack Query requirement
- Race condition: `loadCredentials` dependency can trigger multiple re-renders

---

### Problem 2: Missing react-hook-form + zod Validation (CRITICAL)

**Affected Lines:** 77-85, 146-165, 188-255

**Current Pattern:**
```tsx
// Lines 77-85: Manual form state
const [formData, setFormData] = useState<CredentialFormData>({
  name: '',
  username: '',
  type: 'ssh',
  password: '',
  ssh_private_key: '',
  ssh_passphrase: '',
  valid_until: ''
})

// Lines 146-165: Manual validation
const validateForm = (): string | null => {
  if (!formData.name.trim()) return 'Name is required'
  if (!formData.username.trim()) return 'Username is required'

  const type = formData.type || 'ssh'
  if (!type || type.trim() === '') return 'Type is required'

  // For SSH key type, require the SSH private key (unless editing)
  if (type === 'ssh_key') {
    if (!editingCredential && !formData.ssh_private_key.trim()) {
      return 'SSH private key is required'
    }
  } else {
    // For other types, require password (unless editing)
    if (!editingCredential && !formData.password.trim()) {
      return type === 'token' ? 'Token is required' : 'Password is required'
    }
  }
  return null
}
```

**Issues:**
- Manual validation logic (should use zod schema)
- No type safety for form values
- Complex conditional validation without schema
- Violates CLAUDE.md mandatory react-hook-form + zod requirement

---

### Problem 3: Custom Message State Instead of Toast

**Affected Lines:** 52-55, 71, 87-90, 386-401

```tsx
// Lines 52-55: Custom StatusMessage type
interface StatusMessage {
  type: 'success' | 'error' | 'info'
  text: string
}

// Line 71
const [message, setMessage] = useState<StatusMessage | null>(null)

// Lines 87-90: Custom showMessage implementation
const showMessage = useCallback((text: string, type: StatusMessage['type'] = 'success') => {
  setMessage({ text, type })
  setTimeout(() => setMessage(null), 4000)
}, [])

// Lines 386-401: Manual toast rendering
{message && (
  <div className={`p-4 rounded-md border ${
    message.type === 'success'
      ? 'bg-green-50 border-green-200 text-green-800'
      : message.type === 'error'
      ? 'bg-red-50 border-red-200 text-red-800'
      : 'bg-blue-50 border-blue-200 text-blue-800'
  }`}>
    <div className="flex items-center gap-2">
      {message.type === 'success' && <CheckCircle className="h-4 w-4" />}
      {message.type === 'error' && <AlertTriangle className="h-4 w-4" />}
      {message.type === 'info' && <Clock className="h-4 w-4" />}
      {message.text}
    </div>
  </div>
)}
```

**Issues:**
- Custom implementation instead of using Shadcn UI `useToast()` hook
- Memory leak: setTimeout on line 89 runs even if component unmounts
- Violates CLAUDE.md requirement to use Shadcn components

---

### Problem 4: UI Violations

**4.1: window.confirm() Instead of AlertDialog**

**Location:** Line 258

```tsx
if (!confirm(`Are you sure you want to delete the credential "${credential.name}"?`)) {
  return
}
```

**Issue:** CLAUDE.md line 351 requires using Shadcn AlertDialog instead of browser confirm()

**4.2: Native Checkbox Instead of Shadcn Checkbox**

**Location:** Lines 415-420

```tsx
<input
  type="checkbox"
  id="include-expired"
  checked={includeExpired}
  onChange={(e) => setIncludeExpired(e.target.checked)}
  className="rounded border-white/50 bg-white/20"
/>
```

**Issue:** Should use Shadcn Checkbox component

**4.3: Arbitrary Colors Instead of Semantic Classes**

**Location:** Lines 282-295, 405, 387-393

```tsx
<Badge variant="secondary" className="flex items-center gap-1 bg-yellow-100 text-yellow-800">
<div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
```

**Issue:** CLAUDE.md line 363 mandates semantic Tailwind classes (`bg-background`, `text-foreground`) instead of arbitrary colors

---

### Problem 5: Monolithic Component Structure

**Single component handles:**
1. Data fetching (lines 92-106)
2. Create/update logic (lines 188-255)
3. Delete logic (lines 257-277)
4. Form state management (lines 77-85, 108-144)
5. Message state (lines 71, 87-90)
6. Table rendering (lines 404-503)
7. Form dialog (lines 505-667)
8. Status badges (lines 279-297)
9. Type icons (lines 299-312)

**Should be:** 4-5 separate components with clear boundaries

---

### Problem 6: Duplicate API Call Pattern

**Affected Lines:**
- `loadCredentials()` - Lines 92-106
- `saveCredential()` - Lines 188-255
- `deleteCredential()` - Lines 257-277

**Identical Pattern:**
```tsx
const operation = async () => {
  setLoading(true)
  try {
    const response = await apiCall('endpoint')
    // Handle response
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error:', errorMessage)
    showMessage(errorMessage, 'error')
  } finally {
    setLoading(false)
  }
}
```

**Issue:** Every API call has identical error handling, loading state management, and data assignment logic.

---

### Problem 7: Potential Bugs

**Bug 1: Race Condition (Lines 327-329)**
```tsx
useEffect(() => {
  loadCredentials()
}, [loadCredentials])
```

**Issue:** `loadCredentials` is a `useCallback` with dependencies, can cause multiple re-renders

**Bug 2: Memory Leak (Line 89)**
```tsx
setTimeout(() => setMessage(null), 4000)
```

**Issue:** If component unmounts before 4 seconds, `setMessage` will be called on unmounted component

**Bug 3: Unsafe Type Coercion (Lines 131, 150)**
```tsx
type: credential.type || 'ssh', // Ensure valid type
type: formData.type || 'ssh'
```

**Issue:** Assumes fallback is safe, but backend validation may reject it

**Bug 4: File Input Ref Not Cleared Properly (Lines 183-185)**
```tsx
if (fileInputRef.current) {
  fileInputRef.current.value = ''
}
```

**Issue:** Clearing happens in onload callback which may not execute if file reading fails

**Bug 5: Missing Loading States During Mutations (Lines 471-479)**
```tsx
<Button
  variant="ghost"
  size="sm"
  onClick={() => openEditDialog(credential)}
  className="h-8 w-8 p-0"
  title="Edit"
>
  <Edit className="h-3 w-3" />
</Button>
```

**Issue:** No loading indicator while editing. User can click multiple times.

---

### Problem 8: No Centralized Query Keys

**Issue:** Direct API calls without using query key factory pattern

**Example:**
```tsx
await apiCall(`credentials?source=general&include_expired=${includeExpired}`)
```

**Required:** Use centralized query keys from `/lib/query-keys.ts`

**Current (incomplete):**
```tsx
// Line 216 in query-keys.ts
credentials: {
  all: ['credentials'] as const,
  list: (filters?: { git?: boolean }) =>
    filters
      ? ([...queryKeys.credentials.all, 'list', filters] as const)
      : ([...queryKeys.credentials.all, 'list'] as const),
},
```

**Missing:** `source` and `includeExpired` filters, detail key

---

## Proposed Refactoring Plan

### Phase 1: Foundation & Setup (CRITICAL)

**1.1: Update Query Keys to Support All Filters**

**File:** `/frontend/src/lib/query-keys.ts` (modify)

```tsx
// Update existing credentials key (line 216)
credentials: {
  all: ['credentials'] as const,

  // List with flexible filters
  list: (filters?: {
    source?: string
    includeExpired?: boolean
    git?: boolean
  }) =>
    filters
      ? ([...queryKeys.credentials.all, 'list', filters] as const)
      : ([...queryKeys.credentials.all, 'list'] as const),

  // Detail
  detail: (id: number) => [...queryKeys.credentials.all, 'detail', id] as const,
},
```

---

**1.2: Create Type Definitions**

**File:** `components/features/settings/credentials/types.ts` (new)

```tsx
export interface Credential {
  id: number
  name: string
  username: string
  type: string
  valid_until?: string
  status: 'active' | 'expiring' | 'expired'
  created_at?: string
  updated_at?: string
  has_ssh_key?: boolean
  has_ssh_passphrase?: boolean
}

export interface CredentialFormData {
  name: string
  username: string
  type: string
  password: string
  ssh_private_key: string
  ssh_passphrase: string
  valid_until?: string
}

export interface CredentialCreatePayload {
  name: string
  username: string
  type: string
  valid_until: string | null
  password?: string
  ssh_private_key?: string
  ssh_passphrase?: string
}

export interface CredentialUpdatePayload extends CredentialCreatePayload {
  id: number
}
```

---

**1.3: Create Constants**

**File:** `components/features/settings/credentials/constants.ts` (new)

```tsx
// React best practice: Extract default objects to prevent re-render loops
export const CREDENTIAL_TYPES = [
  { value: 'ssh', label: 'SSH' },
  { value: 'ssh_key', label: 'SSH Key' },
  { value: 'tacacs', label: 'TACACS' },
  { value: 'generic', label: 'Generic' },
  { value: 'token', label: 'Token' }
] as const

export const EMPTY_CREDENTIALS: Credential[] = []

export const STALE_TIME = {
  CREDENTIALS: 30 * 1000, // 30 seconds - credentials change moderately
} as const
```

---

**1.4: Create Validation Schema**

**File:** `components/features/settings/credentials/validation.ts` (new)

```tsx
import { z } from 'zod'

export const credentialFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(128),
  username: z.string().min(1, 'Username is required').max(128),
  type: z.enum(['ssh', 'ssh_key', 'tacacs', 'generic', 'token']),
  password: z.string().optional(),
  ssh_private_key: z.string().optional(),
  ssh_passphrase: z.string().optional(),
  valid_until: z.string().optional(),
}).refine(
  (data) => {
    // For SSH key type, require SSH private key
    if (data.type === 'ssh_key') {
      return !!data.ssh_private_key?.trim()
    }
    // For other types, require password
    return !!data.password?.trim()
  },
  {
    message: 'SSH private key required for SSH Key type, password required for other types',
    path: ['password'],
  }
)

export type CredentialFormValues = z.infer<typeof credentialFormSchema>

// For edit mode - all fields optional except name/username
export const credentialEditSchema = z.object({
  name: z.string().min(1, 'Name is required').max(128),
  username: z.string().min(1, 'Username is required').max(128),
  type: z.enum(['ssh', 'ssh_key', 'tacacs', 'generic', 'token']),
  password: z.string().optional(),
  ssh_private_key: z.string().optional(),
  ssh_passphrase: z.string().optional(),
  valid_until: z.string().optional(),
})

export type CredentialEditValues = z.infer<typeof credentialEditSchema>
```

---

### Phase 3: TanStack Query Migration (CRITICAL - Mandatory)

**Note:** TanStack Query is mandatory for all data fetching per CLAUDE.md. This replaces manual state management entirely.

**3.1: Create Query Hooks**

**File:** `hooks/queries/use-credentials-query.ts` (new)

```tsx
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { Credential } from '../../types'
import { STALE_TIME, EMPTY_CREDENTIALS } from '../../constants'

interface UseCredentialsQueryOptions {
  filters?: {
    source?: string
    includeExpired?: boolean
  }
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseCredentialsQueryOptions = {}

/**
 * Fetch credentials with automatic caching
 */
export function useCredentialsQuery(
  options: UseCredentialsQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { filters, enabled = true } = options

  return useQuery({
    queryKey: queryKeys.credentials.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters?.source) params.set('source', filters.source)
      if (filters?.includeExpired) params.set('include_expired', 'true')

      const response = await apiCall<Credential[]>(
        `credentials?${params.toString()}`
      )
      return response || EMPTY_CREDENTIALS
    },
    enabled,
    staleTime: STALE_TIME.CREDENTIALS,
  })
}
```

**Benefits:**
- ✅ Eliminates manual `useState` for credentials
- ✅ Eliminates manual `useState` for loading
- ✅ Built-in error handling
- ✅ Automatic caching
- ✅ Automatic refetch on window focus
- ✅ Request deduplication

---

**3.2: Create Mutation Hooks**

**File:** `hooks/queries/use-credential-mutations.ts` (new)

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type {
  CredentialCreatePayload,
  CredentialUpdatePayload,
  Credential
} from '../../types'
import { useMemo } from 'react'

export function useCredentialMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Create credential
  const createCredential = useMutation({
    mutationFn: async (data: CredentialCreatePayload) => {
      const response = await apiCall('credentials', {
        method: 'POST',
        body: JSON.stringify(data)
      })
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.credentials.all })
      toast({
        title: 'Success',
        description: 'Credential created successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message.includes('400')
          ? 'Invalid credential data. Please check your inputs.'
          : `Failed to create credential: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Update credential
  const updateCredential = useMutation({
    mutationFn: async (data: CredentialUpdatePayload) => {
      const { id, ...payload } = data
      const response = await apiCall(`credentials/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      })
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.credentials.all })
      toast({
        title: 'Success',
        description: 'Credential updated successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message.includes('400')
          ? 'Invalid credential data. Please check your inputs.'
          : `Failed to update credential: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Delete credential
  const deleteCredential = useMutation({
    mutationFn: async (id: number) => {
      await apiCall(`credentials/${id}`, {
        method: 'DELETE'
      })
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.credentials.all })
      toast({
        title: 'Success',
        description: 'Credential deleted successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })
    }
  })

  // Memoize return object to prevent re-renders
  return useMemo(() => ({
    createCredential,
    updateCredential,
    deleteCredential,
  }), [createCredential, updateCredential, deleteCredential])
}
```

**Benefits:**
- ✅ Automatic cache invalidation
- ✅ Consistent error/success handling with Toast
- ✅ Loading states for each mutation
- ✅ Replaces custom message state
- ✅ Centralized error handling

---

**3.3: Create Form Hook**

**File:** `hooks/use-credential-form.ts` (new)

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  credentialFormSchema,
  credentialEditSchema,
  type CredentialFormValues,
  type CredentialEditValues
} from '../validation'
import type { Credential } from '../types'

interface UseCredentialFormOptions {
  credential?: Credential  // For edit mode
}

const DEFAULT_OPTIONS: UseCredentialFormOptions = {}

export function useCredentialForm(
  options: UseCredentialFormOptions = DEFAULT_OPTIONS
) {
  const { credential } = options
  const isEditing = !!credential

  const defaultValues: CredentialFormValues = {
    name: credential?.name || '',
    username: credential?.username || '',
    type: credential?.type || 'ssh',
    password: '',
    ssh_private_key: '',
    ssh_passphrase: '',
    valid_until: credential?.valid_until || '',
  }

  return useForm<CredentialFormValues | CredentialEditValues>({
    resolver: zodResolver(
      isEditing ? credentialEditSchema : credentialFormSchema
    ),
    defaultValues,
    mode: 'onChange',
  })
}
```

---

### Phase 2: Create Component Decomposition

**2.1: Create Delete Confirmation Dialog**

**File:** `dialogs/delete-credential-dialog.tsx` (new)

```tsx
'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface DeleteCredentialDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  credentialName: string
  onConfirm: () => void
  isDeleting: boolean
}

export function DeleteCredentialDialog({
  open,
  onOpenChange,
  credentialName,
  onConfirm,
  isDeleting
}: DeleteCredentialDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Credential</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the credential "{credentialName}"?
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

---

**2.2: Create Credential Form Dialog**

**File:** `components/credential-form-dialog.tsx` (new)

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription
} from '@/components/ui/form'
import { Upload, RefreshCw, CheckCircle } from 'lucide-react'
import { useCredentialForm } from '../hooks/use-credential-form'
import { useCredentialMutations } from '../hooks/queries/use-credential-mutations'
import { CREDENTIAL_TYPES } from '../constants'
import type { Credential, CredentialCreatePayload } from '../types'
import { getTypeIcon } from '../utils/credential-utils'

interface CredentialFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  credential?: Credential
}

export function CredentialFormDialog({
  open,
  onOpenChange,
  credential
}: CredentialFormDialogProps) {
  const isEditing = !!credential
  const form = useCredentialForm({ credential })
  const { createCredential, updateCredential } = useCredentialMutations()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isSaving = createCredential.isPending || updateCredential.isPending

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      form.reset()
    }
  }, [open, form])

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      form.setValue('ssh_private_key', content)
    }
    reader.readAsText(file)

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const onSubmit = form.handleSubmit((data) => {
    const payload: CredentialCreatePayload = {
      name: data.name.trim(),
      username: data.username.trim(),
      type: data.type,
      valid_until: data.valid_until || null,
    }

    // Add type-specific credentials
    if (data.type === 'ssh_key') {
      if (data.ssh_private_key?.trim()) {
        payload.ssh_private_key = data.ssh_private_key
      }
      if (data.ssh_passphrase?.trim()) {
        payload.ssh_passphrase = data.ssh_passphrase
      }
    } else {
      if (data.password?.trim()) {
        payload.password = data.password
      }
    }

    if (isEditing) {
      updateCredential.mutate(
        { ...payload, id: credential.id },
        { onSuccess: () => onOpenChange(false) }
      )
    } else {
      createCredential.mutate(payload, {
        onSuccess: () => onOpenChange(false)
      })
    }
  })

  const watchedType = form.watch('type')
  const watchedSshKey = form.watch('ssh_private_key')

  const getPasswordLabel = () => {
    if (watchedType === 'token') {
      return isEditing ? 'Token (leave blank to keep current)' : 'Token'
    }
    return isEditing ? 'Password (leave blank to keep current)' : 'Password'
  }

  const getPasswordPlaceholder = () => {
    return watchedType === 'token' ? 'Enter token' : 'Enter password'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit System Credential' : 'New System Credential'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter credential name"
                      maxLength={128}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter username"
                      maxLength={128}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select credential type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CREDENTIAL_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            {getTypeIcon(type.value)}
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Conditional fields based on credential type */}
            {watchedType === 'ssh_key' ? (
              <>
                {/* SSH Key Upload Section */}
                <FormField
                  control={form.control}
                  name="ssh_private_key"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        SSH Private Key
                        {!isEditing && <span className="text-destructive ml-1">*</span>}
                      </FormLabel>
                      <div className="space-y-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          onChange={handleFileUpload}
                          className="hidden"
                          id="ssh-key-upload"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Upload SSH Key File
                        </Button>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder={
                              isEditing
                                ? 'Leave blank to keep current key'
                                : 'Paste SSH private key or upload file above'
                            }
                            rows={6}
                            className="font-mono text-xs"
                          />
                        </FormControl>
                        {watchedSshKey && (
                          <p className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            SSH key loaded ({watchedSshKey.length} characters)
                          </p>
                        )}
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                {/* SSH Passphrase */}
                <FormField
                  control={form.control}
                  name="ssh_passphrase"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SSH Key Passphrase (optional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder={
                            isEditing
                              ? 'Leave blank to keep current passphrase'
                              : 'Enter passphrase if key is encrypted'
                          }
                          autoComplete="new-password"
                        />
                      </FormControl>
                      <FormDescription>
                        Only required if your SSH key is protected with a passphrase
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            ) : (
              /* Password field for non-SSH key types */
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {getPasswordLabel()}
                      {!isEditing && <span className="text-destructive ml-1">*</span>}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder={getPasswordPlaceholder()}
                        autoComplete="new-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="valid_until"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valid Until (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

---

**2.3: Create Utility Functions**

**File:** `utils/credential-utils.tsx` (new)

```tsx
import { Shield, FileKey, UserCheck, Key, Lock } from 'lucide-react'

/**
 * Get icon for credential type
 */
export function getTypeIcon(type: string) {
  switch (type) {
    case 'ssh':
      return <Shield className="h-4 w-4 text-blue-600" />
    case 'ssh_key':
      return <FileKey className="h-4 w-4 text-indigo-600" />
    case 'tacacs':
      return <UserCheck className="h-4 w-4 text-purple-600" />
    case 'token':
      return <Key className="h-4 w-4 text-green-600" />
    default:
      return <Lock className="h-4 w-4 text-muted-foreground" />
  }
}
```

---

**2.4: Create Credentials Table Component**

**File:** `components/credentials-table.tsx` (new)

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Edit, Trash2, RefreshCw, Lock, Key } from 'lucide-react'
import { useCredentialMutations } from '../hooks/queries/use-credential-mutations'
import { DeleteCredentialDialog } from '../dialogs/delete-credential-dialog'
import type { Credential } from '../types'
import { getTypeIcon } from '../utils/credential-utils'
import { getStatusBadge } from './credential-status-badge'

interface CredentialsTableProps {
  credentials: Credential[]
  includeExpired: boolean
  onIncludeExpiredChange: (value: boolean) => void
  onEdit: (credential: Credential) => void
}

export function CredentialsTable({
  credentials,
  includeExpired,
  onIncludeExpiredChange,
  onEdit
}: CredentialsTableProps) {
  const { deleteCredential } = useCredentialMutations()
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    credential: Credential | null
  }>({ open: false, credential: null })

  const handleDelete = () => {
    if (deleteDialog.credential) {
      deleteCredential.mutate(deleteDialog.credential.id, {
        onSuccess: () => {
          setDeleteDialog({ open: false, credential: null })
        }
      })
    }
  }

  return (
    <>
      <div className="rounded-xl border shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Lock className="h-4 w-4" />
              <div>
                <h3 className="text-sm font-semibold">
                  System Credentials ({credentials.length})
                </h3>
                <p className="text-blue-100 text-xs">
                  Shared system credentials. Passwords are encrypted and never displayed.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-expired"
                checked={includeExpired}
                onCheckedChange={onIncludeExpiredChange}
              />
              <Label
                htmlFor="include-expired"
                className="text-sm text-blue-100 cursor-pointer"
              >
                Include expired
              </Label>
            </div>
          </div>
        </div>

        <div className="bg-white">
          {credentials.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto text-muted mb-4" />
              <p className="text-lg font-medium">No system credentials found</p>
              <p className="text-sm">Add your first system credential to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-semibold text-sm">Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">Username</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">Type</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">Valid Until</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {credentials.map((credential) => (
                    <tr key={credential.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <div className="font-medium">{credential.name}</div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {credential.username}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(credential.type)}
                          <span className="capitalize">{credential.type}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {credential.valid_until || '-'}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(credential.status)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(credential)}
                            className="h-8 w-8 p-0"
                            title="Edit"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDeleteDialog({ open: true, credential })
                            }
                            disabled={deleteCredential.isPending}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Delete"
                          >
                            {deleteCredential.isPending ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <DeleteCredentialDialog
        open={deleteDialog.open}
        onOpenChange={(open) =>
          setDeleteDialog({ open, credential: open ? deleteDialog.credential : null })
        }
        credentialName={deleteDialog.credential?.name || ''}
        onConfirm={handleDelete}
        isDeleting={deleteCredential.isPending}
      />
    </>
  )
}
```

---

**2.5: Create Status Badge Component**

**File:** `components/credential-status-badge.tsx` (new)

```tsx
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Clock, CheckCircle } from 'lucide-react'

export function getStatusBadge(status: string) {
  switch (status) {
    case 'expired':
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Expired
        </Badge>
      )
    case 'expiring':
      return (
        <Badge variant="secondary" className="flex items-center gap-1 bg-amber-100 text-amber-800 border-amber-300">
          <Clock className="h-3 w-3" />
          Expiring
        </Badge>
      )
    default:
      return (
        <Badge variant="default" className="flex items-center gap-1 bg-green-100 text-green-800 border-green-300">
          <CheckCircle className="h-3 w-3" />
          Active
        </Badge>
      )
  }
}
```

---

### Phase 4: Refactor Main Container

**File:** `credentials-management.tsx` (refactored)

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Key, Plus, RefreshCw } from 'lucide-react'
import { useCredentialsQuery } from './hooks/queries/use-credentials-query'
import { CredentialsTable } from './components/credentials-table'
import { CredentialFormDialog } from './components/credential-form-dialog'
import type { Credential } from './types'

export default function CredentialsManagement() {
  const [includeExpired, setIncludeExpired] = useState(false)
  const [formDialog, setFormDialog] = useState<{
    open: boolean
    credential?: Credential
  }>({ open: false })

  // TanStack Query hook - replaces all manual state management
  const { data, isLoading, refetch } = useCredentialsQuery({
    filters: {
      source: 'general',
      includeExpired
    }
  })

  const credentials = data || []

  const handleAddNew = () => {
    setFormDialog({ open: true })
  }

  const handleEdit = (credential: Credential) => {
    setFormDialog({ open: true, credential })
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="border-b pb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Key className="h-6 w-6 text-blue-600 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">System Credentials</h1>
              <p className="text-muted-foreground">Loading shared system credentials...</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-amber-100 p-2 rounded-lg">
            <Key className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">System Credentials</h1>
            <p className="text-muted-foreground mt-1">
              Manage shared system credentials for device access
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Reload
          </Button>
          <Button size="sm" onClick={handleAddNew}>
            <Plus className="h-4 w-4 mr-2" />
            Add Credential
          </Button>
        </div>
      </div>

      {/* Credentials Table */}
      <CredentialsTable
        credentials={credentials}
        includeExpired={includeExpired}
        onIncludeExpiredChange={setIncludeExpired}
        onEdit={handleEdit}
      />

      {/* Form Dialog */}
      <CredentialFormDialog
        open={formDialog.open}
        onOpenChange={(open) => setFormDialog({ open })}
        credential={formDialog.credential}
      />
    </div>
  )
}
```

**Before:** 670 lines
**After:** ~120 lines (main container)
**Reduction:** ~550 lines (82%)

**Total with new components:** ~800 lines across 10 files
**Net increase:** ~130 lines (19%)

---

## Final Directory Structure (After Refactoring)

```
frontend/src/components/features/settings/credentials/
├── credentials-management.tsx          # ~120 lines (was 670, -82%)
├── components/
│   ├── credentials-table.tsx          # ~130 lines
│   ├── credential-form-dialog.tsx     # ~280 lines (with react-hook-form)
│   └── credential-status-badge.tsx    # ~30 lines
├── dialogs/
│   └── delete-credential-dialog.tsx   # ~40 lines
├── hooks/
│   ├── use-credential-form.ts         # ~40 lines
│   └── queries/
│       ├── use-credentials-query.ts   # ~40 lines
│       └── use-credential-mutations.ts # ~90 lines
├── utils/
│   └── credential-utils.tsx           # ~20 lines
├── types.ts                           # ~40 lines
├── validation.ts                      # ~50 lines
└── constants.ts                       # ~20 lines
```

---

## Summary of Changes

| File | Before | After | Change |
|------|--------|-------|--------|
| `credentials-management.tsx` | 670 | ~120 | **-550 lines (-82%)** |
| New components | 0 | ~440 | **+440 lines** |
| New hooks | 0 | ~170 | **+170 lines** |
| New types/validation/utils | 0 | ~110 | **+110 lines** |
| **Total** | **670** | **~840** | **+170 lines (+25%)** |

**Net increase** of 170 lines, but with significantly better architecture:
- Proper separation of concerns
- TanStack Query compliance (mandatory)
- react-hook-form + zod validation (mandatory)
- Reusable components and hooks
- Type-safe form handling
- Better testability
- Easier maintainability
- No custom toast implementation
- Shadcn UI compliance

---

## Architecture Compliance (CLAUDE.md)

### Success Metrics

**Code Quality:**
- [ ] Component size < 300 lines each (main container ~120 lines)
- [ ] No duplicate API call logic (unified in query/mutation hooks)
- [ ] No manual `useState` for server data (TanStack Query only)
- [ ] Form uses react-hook-form + zod (mandatory)
- [ ] No inline arrays/objects in default parameters
- [ ] Zero ESLint warnings

**Architecture Compliance:**
- [ ] All data fetching uses TanStack Query
- [ ] Query keys in centralized factory (`/lib/query-keys.ts`)
- [ ] Feature-based folder structure (components/, hooks/, dialogs/, types/)
- [ ] All UI components from Shadcn
- [ ] No window.confirm() (using AlertDialog)
- [ ] No custom toast (using useToast())
- [ ] No arbitrary colors (using semantic Tailwind classes)

**User Experience:**
- [ ] Auto-refresh on window focus (TanStack Query)
- [ ] No regression in functionality
- [ ] Improved loading states (TanStack Query built-in)
- [ ] Better error messages (Toast notifications)
- [ ] Faster perceived performance (automatic caching)

**Developer Experience:**
- [ ] Easier to test (isolated hooks and components)
- [ ] Clear component boundaries
- [ ] Reusable hooks
- [ ] Type safety throughout
- [ ] No race conditions (TanStack Query handles state internally)
- [ ] No memory leaks (useToast() handles cleanup)

---

## Anti-Patterns to Avoid

### ❌ DO NOT Do These During Refactoring

**1. Don't Keep Manual State for Server Data**
- ❌ `const [credentials, setCredentials] = useState<Credential[]>([])`
- ❌ `useEffect(() => { loadCredentials() }, [])`
- ✅ **Instead:** `const { data: credentials } = useCredentialsQuery()`

**2. Don't Keep Manual Loading State Management**
- ❌ `const [loading, setLoading] = useState(false)`
- ❌ `const [saving, setSaving] = useState(false)`
- ✅ **Instead:** TanStack Query provides `isLoading`, `isPending`

**3. Don't Use Custom Message State**
- ❌ `const [message, setMessage] = useState<{type, text} | null>(null)`
- ✅ **Instead:** `useToast()` from Shadcn UI

**4. Don't Skip Form Validation Library**
- ❌ Manual validation with `onChange` handlers
- ❌ Direct state updates
- ✅ **Instead:** react-hook-form + zod (mandatory)

**5. Don't Use window.confirm()**
- ❌ `if (!confirm('Are you sure?')) return`
- ✅ **Instead:** Shadcn `AlertDialog` component

**6. Don't Use Native Inputs for Checkboxes**
- ❌ `<input type="checkbox" />`
- ✅ **Instead:** Shadcn `Checkbox` component

**7. Don't Use Arbitrary Colors**
- ❌ `className="bg-yellow-100 text-yellow-800"`
- ✅ **Instead:** `className="bg-background text-foreground"`

**8. Don't Keep All Logic in One File**
- ❌ 670-line monolithic component
- ✅ **Instead:** Decompose into focused components < 300 lines

---

## Comparison with Other Refactorings

| Metric | Check IP | Cache Settings | Celery Settings | **Credentials** |
|--------|----------|----------------|-----------------|-----------------|
| Lines of Code | 545 | 976 | 693 | **670** |
| Components | 1 | 1 | 1 | **1** |
| Manual State Hooks | 9 | 11 | 8 | **7** |
| Critical Bug | Polling stale closure | No | Polling stale closure risk | **Multiple (race, memory leak)** |
| Refactoring Priority | HIGH (bug) | MEDIUM | HIGH (bug risk) | **HIGH (mandatory compliance)** |
| Main Issue | Polling bug | Monolithic | Polling bug risk | **Missing validation + toast** |
| Primary Benefit | Fixes bug + decomposition | Decomposition + compliance | Fixes bug + decomposition | **Compliance + validation** |
| Code Reduction | -74% (main) | -85% (main) | -75% (main) | **-82% (main)** |
| TanStack Query Usage | Auto-polling, mutations | Queries, mutations, polling | Auto-polling, mutations | **Queries, mutations** |

---

## Recommended Refactoring Order

1. **Phase 1.1** - Update query keys (zero risk)
2. **Phase 1.2** - Extract types (zero risk)
3. **Phase 1.3** - Extract constants (fixes re-render risks)
4. **Phase 1.4** - Create validation schema (zero risk)
5. **Phase 3.1** - Create query hooks
6. **Phase 3.2** - Create mutation hooks
7. **Phase 3.3** - Create form hook
8. **Phase 2.1** - Create delete dialog
9. **Phase 2.2** - Create form dialog with react-hook-form
10. **Phase 2.3** - Create utility functions
11. **Phase 2.4** - Create table component
12. **Phase 2.5** - Create status badge component
13. **Phase 4** - Refactor main container
14. **Testing & Integration** - Test all functionality

---

## Notes

- This refactoring is **HIGHLY RECOMMENDED** to align with CLAUDE.md standards
- **CRITICAL:** The missing react-hook-form + zod validation is a data integrity risk
- **CRITICAL:** Custom toast implementation has memory leak bug
- **CRITICAL:** Multiple UI violations (window.confirm, native inputs, arbitrary colors)
- TanStack Query migration is **mandatory** per architecture requirements
- Form validation with react-hook-form + zod is **mandatory** per standards
- Component decomposition improves testability and maintainability
- Consider this pattern for other settings components

---

**Document Version:** 1.0
**Created:** 2026-01-31
**Status:** Planning
**Priority:** High (mandatory compliance + multiple bugs)
