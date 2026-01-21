# Refactoring Plan: Common Settings (SNMP Mapping) Component

**Component:** `frontend/src/components/features/settings/common/common-settings.tsx`
**Created:** 2026-01-21
**Updated:** 2026-01-21
**Status:** Planning
**Total Lines of Code:** 796 (single monolithic component)

## TL;DR - What's Wrong & How to Fix It

**Problems:**
1. 🚫 **Architecture violation** - Manual `useState` + `useEffect` instead of mandatory TanStack Query
2. 📦 **Monolithic component** - 796 lines with multiple responsibilities (YAML editing, Git import, validation, help)
3. ⚠️ **Missing standards** - No react-hook-form + zod, custom message system instead of toast
4. 🔁 **Code duplication** - Git repository/file selection logic could be shared across app
5. 🗂️ **Poor structure** - Single file instead of feature-based organization (components/, hooks/, dialogs/)
6. 🎨 **Inline dialogs** - Three dialogs (validation, help, import) embedded in main component

**Solution:**
1. ✅ **Migrate to TanStack Query** - Replaces manual loading/saving with automatic caching/mutations
2. ✅ **Decompose component** - Extract dialogs, create reusable components
3. ✅ **Add mutation hooks** - use-snmp-mutations for save/validate operations
4. ✅ **Use toast notifications** - Replace custom message state with `useToast()`
5. ✅ **Feature-based structure** - components/, hooks/, dialogs/, types/, utils/
6. ✅ **Form validation** - react-hook-form + zod for Git import dialog

**Critical Path:** Phase 1 (foundation) → Phase 3 (TanStack Query) → Phase 2 (components) → Phase 4 (refactor main component)

**Minimum Viable:** Phases 1-3 establishes proper architecture per CLAUDE.md

---

## Executive Summary

The Common Settings component contains **796 lines** in a single monolithic file with **critical architecture violations** and poor separation of concerns:

1. **Architecture Violation** - Uses manual state management (`useState` + `useEffect`) instead of mandatory TanStack Query
2. **Monolithic Structure** - Single 796-line component handling YAML editing, Git import, validation, and help dialogs
3. **Custom Message System** - Manual state with `setTimeout` instead of Shadcn toast notifications
4. **Missing Standards** - No react-hook-form + zod, inline dialogs, poor component boundaries
5. **Duplicate Logic** - Git repository/file selection could be shared with other features

**Bottom Line:** TanStack Query migration is not optional—it's mandatory per CLAUDE.md. Component decomposition will reduce from 796 lines to ~150-200 lines for main component plus reusable infrastructure.

## Key Changes Summary

| Current Approach | Required Approach (CLAUDE.md) |
|------------------|-------------------------------|
| Manual `useState` + `useEffect` | **TanStack Query with auto-caching** |
| Manual loading states | **useQuery/useMutation built-in states** |
| Custom message with `setTimeout` | **Toast notifications (useToast)** |
| Manual error handling | **TanStack Query built-in error handling** |
| 796-line monolithic component | **Feature-based structure with decomposed components** |
| Inline dialogs (3 dialogs) | **Separate dialog components in dialogs/** |
| Custom form state | **react-hook-form + zod** |
| Inline callbacks without memoization | **Proper useCallback with stable dependencies** |

---

## Current Architecture

```
frontend/src/components/features/settings/common/
└── common-settings.tsx              # 796 lines - Everything in one file
    ├── YAML Editor                  # ~150 lines
    ├── Git Import Dialog            # ~175 lines
    ├── Validation Error Dialog      # ~35 lines
    ├── SNMP Help Dialog             # ~115 lines
    ├── Loading/Message Logic        # ~50 lines
    └── State Management             # ~270 lines
```

**Total:** 796 lines in single file

---

## Problem Analysis

### Problem 1: Architecture Violation - Manual State Instead of TanStack Query

**Affected Lines:** 34-83, 121-141, 231-250

**Current Pattern:**
```tsx
// Lines 34-36
const [snmpMappingYaml, setSnmpMappingYaml] = useState('')
const [yamlLoading, setYamlLoading] = useState(false)

// Lines 69-83
const loadYamlFiles = useCallback(async () => {
  try {
    setYamlLoading(true)
    const snmpResponse = await apiCall('config/snmp_mapping.yaml')
    if (snmpResponse.success && snmpResponse.data) {
      setSnmpMappingYaml(snmpResponse.data)
    }
  } catch (error) {
    console.error('Error loading YAML files:', error)
    showMessage('Failed to load YAML files', 'error')
  } finally {
    setYamlLoading(false)
  }
}, [apiCall, showMessage])

// Lines 327-329
useEffect(() => {
  loadYamlFiles()
}, [loadYamlFiles])
```

**Issue:**
- Manual loading state management
- Custom error handling
- No caching
- No automatic refetching
- Violates CLAUDE.md mandate to use TanStack Query

**Should Be:**
```tsx
// With TanStack Query
const { data: snmpMapping, isLoading } = useSnmpMappingQuery()
const { mutate: saveMapping } = useSaveSnmpMappingMutation()
```

**Benefits:**
- ✅ Automatic caching
- ✅ Built-in loading/error states
- ✅ No manual `useEffect`
- ✅ Automatic background refetching
- ✅ Proper error handling with toast

---

### Problem 2: Custom Message System Instead of Toast

**Affected Lines:** 45-67

**Current Pattern:**
```tsx
const [message, setMessage] = useState('')
const [messageType, setMessageType] = useState<'success' | 'error'>('success')

const showMessage = useCallback((msg: string, type: 'success' | 'error') => {
  setMessage(msg)
  setMessageType(type)

  setTimeout(() => {
    setMessage('')
  }, 5000)
}, [])

// Usage
showMessage('Failed to load YAML files', 'error')
```

**Issue:**
- Custom state management for messages
- Manual `setTimeout` cleanup
- Potential memory leaks if component unmounts
- Not using Shadcn toast system
- Inconsistent with rest of app

**Should Be:**
```tsx
const { toast } = useToast()

// Usage
toast({
  title: 'Error',
  description: 'Failed to load YAML files',
  variant: 'destructive'
})
```

---

### Problem 3: Monolithic Component with Multiple Responsibilities

**Affected Lines:** Entire file (796 lines)

**Current Responsibilities:**
1. YAML editor (lines 545-613)
2. Git import workflow (lines 617-791)
3. Validation error dialog (lines 367-399)
4. SNMP help dialog (lines 402-513)
5. State management for all above (lines 34-56)
6. API calls for load/save/validate (lines 69-141)
7. Git repo management (lines 143-250)

**Issue:**
- Single component doing too many things
- Hard to test individual pieces
- Difficult to reuse Git import logic elsewhere
- Poor separation of concerns

**Should Be:**
```
components/
├── snmp-mapping-editor.tsx          # ~150 lines - Main YAML editor
└── dialogs/
    ├── snmp-validation-dialog.tsx   # ~50 lines - Validation errors
    ├── snmp-help-dialog.tsx         # ~120 lines - Help content
    └── git-import-dialog.tsx        # ~200 lines - Git import workflow

hooks/
├── use-snmp-mapping-query.ts        # ~40 lines - TanStack Query hook
└── use-snmp-mutations.ts            # ~80 lines - Save/validate mutations

types/
└── index.ts                         # ~30 lines - Type definitions

utils/
└── snmp-utils.ts                    # ~40 lines - Helper functions
```

---

### Problem 4: Git Import Dialog - No Form Validation

**Affected Lines:** 617-791

**Current Pattern:**
```tsx
// Manual state for each field
const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null)
const [selectedFile, setSelectedFile] = useState<string | null>(null)
const [fileFilter, setFileFilter] = useState('')

// Manual validation
if (!selectedRepoId || !selectedFile) return
```

**Issue:**
- No react-hook-form
- No zod validation
- Manual state management for form fields
- Violates CLAUDE.md form standards

**Should Be:**
```tsx
const importSchema = z.object({
  repositoryId: z.number().min(1),
  filePath: z.string().min(1),
})

const form = useForm({
  resolver: zodResolver(importSchema),
  defaultValues: DEFAULT_IMPORT_VALUES,
})
```

---

### Problem 5: Inline Dialogs - Poor Component Boundaries

**Affected Lines:** 367-399 (validation), 402-513 (help), 617-791 (import)

**Issue:**
- Three large dialogs embedded in main component
- ~325 lines of dialog code in main component
- Cannot reuse dialogs elsewhere
- Makes main component harder to read
- SNMP help dialog could be used in other contexts

**Should Be:**
```tsx
// In main component
<SnmpValidationDialog
  open={showValidationDialog}
  onOpenChange={setShowValidationDialog}
  error={validationError}
/>

<SnmpHelpDialog
  open={showHelpDialog}
  onOpenChange={setShowHelpDialog}
/>

<GitImportDialog
  open={showImportDialog}
  onOpenChange={setShowImportDialog}
  onImport={handleImport}
  fileType="yaml"
/>
```

---

### Problem 6: Missing Type Definitions

**Issue:**
- Inline type definitions scattered throughout
- No centralized types file
- Repeated type patterns for Git repos/files

**Current Types (inline):**
```tsx
// Line 50
Array<{id: number; name: string; category: string; is_active: boolean; last_sync?: string | null}>

// Line 53
Array<{name: string; path: string; directory: string}>

// Line 52
{ahead_count: number; behind_count: number; is_clean: boolean; is_synced?: boolean}
```

**Should Have:**
```tsx
// types/index.ts
export interface SnmpMapping {
  content: string
  filename: string
}

export interface ValidationError {
  message: string
  error?: string
  line?: number
  column?: number
}

export interface GitRepository {
  id: number
  name: string
  category: string
  is_active: boolean
  last_sync?: string | null
}

export interface GitFile {
  name: string
  path: string
  directory: string
}

export interface GitRepoStatus {
  ahead_count: number
  behind_count: number
  is_clean: boolean
  is_synced?: boolean
}
```

---

### Problem 7: No Query Keys Defined

**Issue:**
- No query keys in centralized factory (`/lib/query-keys.ts`)
- Cannot invalidate cache properly
- Missing foundation for TanStack Query

**Should Have:**
```tsx
// In /frontend/src/lib/query-keys.ts
commonSettings: {
  all: ['commonSettings'] as const,
  snmpMapping: () => [...queryKeys.commonSettings.all, 'snmpMapping'] as const,
},
```

---

### Problem 8: Repeated Git Repository Logic

**Affected Lines:** 143-250

**Issue:**
- Git repository selection/sync logic duplicated across app
- Could be extracted to shared hook
- Similar patterns in other features (templates, configs)

**Potential for Shared Hook:**
```tsx
// hooks/use-git-repo-selector.ts
export function useGitRepoSelector(category: string, options = {}) {
  const { data: repos, isLoading } = useGitRepositories({ category })
  const { mutate: syncRepo } = useSyncGitRepository()

  return {
    repos,
    isLoading,
    syncRepo,
    // ... shared logic
  }
}
```

---

## Proposed Refactoring Plan

### Phase 1: Foundation & Setup (CRITICAL)

**1.1: Verify Backend Architecture**

- [ ] Confirm backend endpoints use repository pattern
- [ ] Verify `/config/snmp_mapping.yaml` endpoint exists
- [ ] Check `/config/validate` endpoint for YAML validation
- [ ] Ensure proper error handling in backend

**Estimated effort:** 30 minutes

---

**1.2: Add Query Keys to Centralized Factory**

**File:** `/frontend/src/lib/query-keys.ts` (modify)

```tsx
// Add to existing queryKeys object
commonSettings: {
  all: ['commonSettings'] as const,
  snmpMapping: () => [...queryKeys.commonSettings.all, 'snmpMapping'] as const,
},
```

**Estimated effort:** 10 minutes

---

**1.3: Create Type Definitions**

**File:** `components/features/settings/common/types/index.ts` (new)

```tsx
export interface SnmpMapping {
  content: string
  filename: string
  last_modified?: string
}

export interface ValidationError {
  message: string
  error?: string
  line?: number
  column?: number
}

export interface ValidationResponse {
  success: boolean
  valid: boolean
  message?: string
  error?: string
  line?: number
  column?: number
}

export interface SaveResponse {
  success: boolean
  message?: string
}

export interface LoadResponse {
  success: boolean
  data?: string
}

export interface GitRepository {
  id: number
  name: string
  category: string
  is_active: boolean
  last_sync?: string | null
}

export interface GitFile {
  name: string
  path: string
  directory: string
}

export interface GitRepoStatus {
  ahead_count: number
  behind_count: number
  is_clean: boolean
  is_synced?: boolean
}

export interface GitImportFormData {
  repositoryId: number
  filePath: string
}

export type ImportStep = 'select-repo' | 'check-sync' | 'select-file'
```

**Estimated effort:** 30 minutes

---

**1.4: Create Constants**

**File:** `components/features/settings/common/utils/constants.ts` (new)

```tsx
import type { GitImportFormData } from '../types'

// React best practice: Extract default arrays/objects to prevent re-render loops
export const EMPTY_GIT_REPOS = []
export const EMPTY_GIT_FILES = []

export const DEFAULT_IMPORT_VALUES: Partial<GitImportFormData> = {
  repositoryId: undefined,
  filePath: '',
} as const

export const SNMP_FILE_NAME = 'snmp_mapping.yaml' as const

export const CACHE_TIME = {
  SNMP_MAPPING: 2 * 60 * 1000,  // 2 minutes
} as const

export const MESSAGE_TIMEOUT = 5000 as const

export const COCKPIT_CONFIGS_CATEGORY = 'cockpit_configs' as const
```

**Estimated effort:** 15 minutes

---

### Phase 3: TanStack Query Migration (CRITICAL - Mandatory)

**3.1: Create Query Hooks**

**File:** `hooks/use-snmp-mapping-query.ts` (new)

```tsx
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { LoadResponse } from '../types'
import { CACHE_TIME, SNMP_FILE_NAME } from '../utils/constants'

interface UseSnmpMappingOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseSnmpMappingOptions = { enabled: true }

/**
 * Fetch SNMP mapping YAML content with automatic caching
 */
export function useSnmpMappingQuery(options: UseSnmpMappingOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.commonSettings.snmpMapping(),
    queryFn: async () => {
      const response = await apiCall<LoadResponse>(`config/${SNMP_FILE_NAME}`)

      if (response.success && response.data) {
        return response.data
      }

      throw new Error('Failed to load SNMP mapping')
    },
    enabled,
    staleTime: CACHE_TIME.SNMP_MAPPING,
  })
}
```

**Benefits:**
- ✅ Eliminates manual `useState` + `useEffect`
- ✅ Built-in loading/error states
- ✅ Automatic caching
- ✅ Background refetching

**Estimated effort:** 45 minutes

---

**3.2: Create Mutation Hooks**

**File:** `hooks/use-snmp-mutations.ts` (new)

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { ValidationResponse, SaveResponse } from '../types'
import { SNMP_FILE_NAME } from '../utils/constants'
import { useMemo } from 'react'

export function useSnmpMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  /**
   * Validate YAML content
   */
  const validateYaml = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiCall<ValidationResponse>('config/validate', {
        method: 'POST',
        body: JSON.stringify({ content })
      })

      if (!response.success || !response.valid) {
        throw {
          message: response.message || 'Invalid YAML',
          error: response.error,
          line: response.line,
          column: response.column,
        }
      }

      return response
    },
    onSuccess: () => {
      toast({
        title: 'Validation Successful',
        description: `${SNMP_FILE_NAME} is valid YAML`,
      })
    },
    onError: (error: any) => {
      // Error will be handled by component (show dialog)
      console.error('YAML validation error:', error)
    }
  })

  /**
   * Save SNMP mapping YAML content
   */
  const saveMapping = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiCall<SaveResponse>(`config/${SNMP_FILE_NAME}`, {
        method: 'POST',
        body: JSON.stringify({ content })
      })

      if (!response.success) {
        throw new Error(response.message || `Failed to save ${SNMP_FILE_NAME}`)
      }

      return response
    },
    onSuccess: () => {
      // Invalidate cache to trigger refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.commonSettings.snmpMapping() })

      toast({
        title: 'Success',
        description: `${SNMP_FILE_NAME} saved successfully`,
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
    validateYaml,
    saveMapping,
  }), [validateYaml, saveMapping])
}
```

**Benefits:**
- ✅ Automatic cache invalidation
- ✅ Built-in optimistic updates support
- ✅ Consistent error/success handling with toast
- ✅ Loading states for each mutation

**Estimated effort:** 1.5 hours

---

### Phase 2: Create Reusable Components

**2.1: Create SNMP Validation Dialog**

**File:** `dialogs/snmp-validation-dialog.tsx` (new)

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AlertCircle } from 'lucide-react'
import type { ValidationError } from '../types'

interface SnmpValidationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  error: ValidationError | null
}

export function SnmpValidationDialog({
  open,
  onOpenChange,
  error
}: SnmpValidationDialogProps) {
  if (!error) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span>YAML Validation Error</span>
          </DialogTitle>
          <DialogDescription>
            <div className="space-y-2 mt-4">
              <p className="font-semibold">{error.message}</p>
              {error.error && (
                <p className="text-sm text-gray-600">{error.error}</p>
              )}
              {error.line && (
                <p className="text-sm text-gray-600">
                  Line {error.line}
                  {error.column && `, Column ${error.column}`}
                </p>
              )}
              <p className="text-sm text-gray-500 mt-4">
                Common YAML syntax issues:
              </p>
              <ul className="text-sm text-gray-500 list-disc list-inside">
                <li>Incorrect indentation (use spaces, not tabs)</li>
                <li>Missing quotes around special characters</li>
                <li>Invalid key-value pair format</li>
                <li>Unclosed brackets or braces</li>
              </ul>
            </div>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}
```

**Estimated effort:** 30 minutes

---

**2.2: Create SNMP Help Dialog**

**File:** `dialogs/snmp-help-dialog.tsx` (new)

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { HelpCircle } from 'lucide-react'

interface SnmpHelpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SnmpHelpDialog({ open, onOpenChange }: SnmpHelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[54rem] !max-w-[54rem] w-[85vw] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <HelpCircle className="h-5 w-5 text-blue-600" />
            <span>SNMP Mapping Configuration Help</span>
          </DialogTitle>
          <DialogDescription>
            Examples and guidelines for configuring SNMP credentials
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Overview */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">Overview</h3>
            <p className="text-sm text-gray-600">
              The SNMP mapping configuration defines credentials for accessing network devices via SNMP.
              Each entry is identified by a unique ID and contains authentication details based on the SNMP version.
            </p>
          </div>

          {/* Configuration Examples */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Configuration Examples</h3>

            {/* Example 1: SNMPv3 with Auth and Privacy */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-blue-700">
                Example 1: SNMPv3 with Authentication and Privacy
              </h4>
              <p className="text-xs text-gray-600">
                Most secure option - requires both authentication and encryption
              </p>
              <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs font-mono overflow-x-auto">
{`snmp-id-1:
  version: v3
  type: v3_auth_privacy
  username: snmp_username
  group: snmp_group
  auth_protocol_long: SHA-2-256
  auth_protocol: SHA-2-256
  auth_password: snmp_password
  privacy_protocol_long: AES-256
  privacy_protocol: AES
  privacy_password: snmp_password
  privacy_option: 256`}
              </pre>
              <ul className="text-xs text-gray-600 list-disc list-inside space-y-1">
                <li><code className="bg-gray-100 px-1 rounded">version: v3</code> - Uses SNMP version 3</li>
                <li><code className="bg-gray-100 px-1 rounded">type: v3_auth_privacy</code> - Requires both authentication and privacy (encryption)</li>
                <li><code className="bg-gray-100 px-1 rounded">auth_protocol</code> - Authentication algorithm (SHA-2-256, MD5, etc.)</li>
                <li><code className="bg-gray-100 px-1 rounded">privacy_protocol</code> - Encryption algorithm (AES, DES, etc.)</li>
                <li><code className="bg-gray-100 px-1 rounded">privacy_option</code> - Key size for encryption (128, 192, 256)</li>
              </ul>
            </div>

            {/* Example 2: SNMPv3 with Auth only */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-blue-700">
                Example 2: SNMPv3 with Authentication Only
              </h4>
              <p className="text-xs text-gray-600">
                Provides authentication without encryption - less secure than auth_privacy
              </p>
              <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs font-mono overflow-x-auto">
{`snmp-id-2:
  version: v3
  type: v3_auth_no_privacy
  username: snmp_username
  group: snmp_group
  auth_protocol_long: MD5-96
  auth_protocol: MD5
  auth_password: snmp_password`}
              </pre>
              <ul className="text-xs text-gray-600 list-disc list-inside space-y-1">
                <li><code className="bg-gray-100 px-1 rounded">type: v3_auth_no_privacy</code> - Authentication only, no encryption</li>
                <li>Privacy-related fields are omitted as encryption is not used</li>
                <li>More secure than SNMPv2c but less secure than v3_auth_privacy</li>
              </ul>
            </div>

            {/* Example 3: SNMPv2c */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-blue-700">
                Example 3: SNMPv2c with Community String
              </h4>
              <p className="text-xs text-gray-600">
                Legacy version - simple community-based authentication only
              </p>
              <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs font-mono overflow-x-auto">
{`snmp-id-3:
  version: v2
  community: snmp_community`}
              </pre>
              <ul className="text-xs text-gray-600 list-disc list-inside space-y-1">
                <li><code className="bg-gray-100 px-1 rounded">version: v2</code> - Uses SNMP version 2c</li>
                <li><code className="bg-gray-100 px-1 rounded">community</code> - Community string (acts as password)</li>
                <li>Simplest configuration but least secure - no encryption or strong authentication</li>
                <li>Recommended only for legacy devices or isolated networks</li>
              </ul>
            </div>
          </div>

          {/* Best Practices */}
          <div className="space-y-2 border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-900">Best Practices</h3>
            <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
              <li>Use SNMPv3 with auth_privacy whenever possible for maximum security</li>
              <li>Use strong, unique passwords for auth_password and privacy_password</li>
              <li>Each SNMP ID should have a unique identifier (e.g., snmp-id-1, snmp-id-2)</li>
              <li>Maintain consistent indentation (2 spaces) throughout the YAML file</li>
              <li>Test your configuration using the "Check YAML" button before saving</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Estimated effort:** 45 minutes

---

**2.3: Create Git Import Dialog (with react-hook-form + zod)**

**File:** `dialogs/git-import-dialog.tsx` (new)

**Note:** This component will be complex (~250 lines) and use proper form validation with react-hook-form + zod

```tsx
import { useState, useCallback, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage
} from '@/components/ui/form'
import {
  Download,
  Loader2,
  GitPullRequest,
  CheckCircle,
  AlertCircle,
  FileText
} from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { useAuthStore } from '@/lib/auth-store'
import { useToast } from '@/hooks/use-toast'
import type {
  GitRepository,
  GitFile,
  GitRepoStatus,
  ImportStep
} from '../types'
import {
  EMPTY_GIT_REPOS,
  EMPTY_GIT_FILES,
  COCKPIT_CONFIGS_CATEGORY
} from '../utils/constants'

const importSchema = z.object({
  repositoryId: z.number().min(1, 'Please select a repository'),
  filePath: z.string().min(1, 'Please select a file'),
})

type ImportFormData = z.infer<typeof importSchema>

const DEFAULT_VALUES: Partial<ImportFormData> = {
  repositoryId: undefined,
  filePath: '',
}

interface GitImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (content: string) => void
  fileType?: 'yaml' | 'json' | 'text'
}

export function GitImportDialog({
  open,
  onOpenChange,
  onImport,
  fileType = 'yaml',
}: GitImportDialogProps) {
  const { apiCall } = useApi()
  const { toast } = useToast()

  // State
  const [gitRepos, setGitRepos] = useState<GitRepository[]>(EMPTY_GIT_REPOS)
  const [repoStatus, setRepoStatus] = useState<GitRepoStatus | null>(null)
  const [repoFiles, setRepoFiles] = useState<GitFile[]>(EMPTY_GIT_FILES)
  const [fileFilter, setFileFilter] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const [importStep, setImportStep] = useState<ImportStep>('select-repo')

  // Form
  const form = useForm<ImportFormData>({
    resolver: zodResolver(importSchema),
    defaultValues: DEFAULT_VALUES,
  })

  const selectedRepoId = form.watch('repositoryId')
  const selectedFile = form.watch('filePath')

  // Filtered files based on search
  const filteredFiles = useMemo(() => {
    if (!fileFilter) return repoFiles
    const lower = fileFilter.toLowerCase()
    return repoFiles.filter(file =>
      file.path.toLowerCase().includes(lower)
    )
  }, [repoFiles, fileFilter])

  // Load Git repositories
  const loadGitRepos = useCallback(async () => {
    try {
      const response = await apiCall<{
        repositories: GitRepository[]
        total?: number
      }>('git-repositories/')

      if (response.repositories) {
        // Filter for cockpit_configs category
        const cockpitRepos = response.repositories.filter(repo =>
          repo.category?.toLowerCase() === COCKPIT_CONFIGS_CATEGORY && repo.is_active
        )
        setGitRepos(cockpitRepos)
      }
    } catch (error) {
      console.error('Error loading git repositories:', error)
      toast({
        title: 'Error',
        description: 'Failed to load git repositories',
        variant: 'destructive'
      })
    }
  }, [apiCall, toast])

  // Load repository files
  const loadRepoFiles = useCallback(async (repoId: number) => {
    try {
      const response = await apiCall<{
        success: boolean
        data?: {
          files: GitFile[]
          total_count?: number
          has_more?: boolean
        }
      }>(`git/${repoId}/files/search?query=&limit=5000`)

      if (response.success && response.data?.files) {
        setRepoFiles(response.data.files)

        if (response.data.has_more) {
          toast({
            title: 'Warning',
            description: `Repository has more than ${response.data.files.length} files. Only showing first ${response.data.files.length}. Use the filter to narrow results.`,
            variant: 'destructive'
          })
        }
      }
    } catch (error) {
      console.error('Error loading repository files:', error)
      toast({
        title: 'Error',
        description: 'Failed to load repository files',
        variant: 'destructive'
      })
    }
  }, [apiCall, toast])

  // Check repository status
  const checkRepoStatus = useCallback(async (repoId: number) => {
    try {
      setImportLoading(true)

      // Check if repo has been synced before
      const repoInfo = gitRepos.find(r => r.id === repoId)
      const hasBeenSynced = repoInfo?.last_sync !== null

      if (!hasBeenSynced) {
        // Repo never synced, needs initial clone
        setRepoStatus({ ahead_count: 0, behind_count: 1, is_clean: true })
        setImportStep('check-sync')
        return
      }

      const response = await apiCall<{
        success: boolean
        data?: GitRepoStatus
      }>(`git/${repoId}/status`)

      if (response.success && response.data) {
        setRepoStatus(response.data)

        // If repo is behind, stay on sync check step
        if (response.data.behind_count > 0) {
          setImportStep('check-sync')
        } else {
          // Load files if already synced
          await loadRepoFiles(repoId)
          setImportStep('select-file')
        }
      }
    } catch (error) {
      console.error('Error checking repo status:', error)
      // If status check fails, assume repo doesn't exist locally
      setRepoStatus({ ahead_count: 0, behind_count: 1, is_clean: true })
      setImportStep('check-sync')
    } finally {
      setImportLoading(false)
    }
  }, [apiCall, gitRepos, loadRepoFiles])

  // Sync repository
  const syncRepo = useCallback(async (repoId: number) => {
    try {
      setImportLoading(true)
      const response = await apiCall<{
        success: boolean
        message?: string
      }>(`git/${repoId}/sync`, {
        method: 'POST',
      })

      if (response.success) {
        toast({
          title: 'Success',
          description: 'Repository synced successfully',
        })
        // Reload status and files
        await checkRepoStatus(repoId)
      } else {
        toast({
          title: 'Error',
          description: response.message || 'Failed to sync repository',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error syncing repository:', error)
      toast({
        title: 'Error',
        description: 'Failed to sync repository',
        variant: 'destructive'
      })
    } finally {
      setImportLoading(false)
    }
  }, [apiCall, toast, checkRepoStatus])

  // Import file from Git
  const handleImport = form.handleSubmit(async (data) => {
    try {
      setImportLoading(true)

      // Get auth token
      const token = useAuthStore.getState().token
      if (!token) {
        toast({
          title: 'Error',
          description: 'Not authenticated',
          variant: 'destructive'
        })
        return
      }

      // Read file content
      const fileResponse = await fetch(
        `/api/proxy/git/${data.repositoryId}/file-content?path=${encodeURIComponent(data.filePath)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )

      if (!fileResponse.ok) {
        throw new Error('Failed to read file content from repository')
      }

      let fileContent = await fileResponse.text()

      // Check if content is double-encoded JSON string
      try {
        if (fileContent.startsWith('"') && fileContent.endsWith('"')) {
          fileContent = JSON.parse(fileContent)
        }
      } catch {
        // Not JSON, use as-is
      }

      // Call parent handler
      onImport(fileContent)

      // Close dialog and reset
      onOpenChange(false)
      form.reset(DEFAULT_VALUES)
      setFileFilter('')
      setRepoStatus(null)
      setRepoFiles(EMPTY_GIT_FILES)
      setImportStep('select-repo')

      toast({
        title: 'Success',
        description: `File "${data.filePath}" imported successfully. Click "Save Mapping" to persist changes.`,
      })
    } catch (error) {
      console.error('Error importing file:', error)
      toast({
        title: 'Error',
        description: 'Failed to import file from repository',
        variant: 'destructive'
      })
    } finally {
      setImportLoading(false)
    }
  })

  // Handle repository selection
  const handleRepoSelect = useCallback(async (repoId: string) => {
    const id = parseInt(repoId)
    form.setValue('repositoryId', id)
    await checkRepoStatus(id)
  }, [form, checkRepoStatus])

  // Load repos when dialog opens
  useEffect(() => {
    if (open) {
      loadGitRepos()
    }
  }, [open, loadGitRepos])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Download className="h-5 w-5" />
            <span>Import SNMP Mapping from Git</span>
          </DialogTitle>
          <DialogDescription>
            {importStep === 'select-repo' && 'Select a Cockpit Configs repository to import from'}
            {importStep === 'check-sync' && 'Check repository synchronization status'}
            {importStep === 'select-file' && 'Select a file to import'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleImport} className="space-y-4 py-4">
            {/* Step 1: Select Repository */}
            {importStep === 'select-repo' && (
              <FormField
                control={form.control}
                name="repositoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cockpit Configs Repository</FormLabel>
                    <FormControl>
                      {gitRepos.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No Cockpit Configs repositories found. Please add a repository with category "Cockpit Configs" first.
                        </p>
                      ) : (
                        <Select
                          value={field.value?.toString()}
                          onValueChange={handleRepoSelect}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a repository" />
                          </SelectTrigger>
                          <SelectContent>
                            {gitRepos.map((repo) => (
                              <SelectItem key={repo.id} value={repo.id.toString()}>
                                {repo.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Step 2: Check Sync Status */}
            {importStep === 'check-sync' && repoStatus && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-yellow-900">Repository Not Synced</h4>
                    <p className="text-sm text-yellow-800 mt-1">
                      This repository is {repoStatus.behind_count} commit(s) behind the remote.
                      Please sync the repository to get the latest files.
                    </p>
                    <Button
                      type="button"
                      onClick={() => selectedRepoId && syncRepo(selectedRepoId)}
                      disabled={importLoading}
                      className="mt-3 flex items-center space-x-2"
                    >
                      {importLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <GitPullRequest className="h-4 w-4" />
                      )}
                      <span>Sync Repository (Git Pull)</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Select File */}
            {importStep === 'select-file' && (
              <div className="space-y-4">
                {repoStatus && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-800">
                        Repository is up to date
                      </span>
                    </div>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="filePath"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select File to Import</FormLabel>
                      <FormControl>
                        {repoFiles.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No files found in this repository.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            <Input
                              type="text"
                              placeholder="Filter files..."
                              value={fileFilter}
                              onChange={(e) => setFileFilter(e.target.value)}
                            />
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select a file" />
                              </SelectTrigger>
                              <SelectContent className="max-h-[300px]">
                                {filteredFiles.map((file) => (
                                  <SelectItem key={file.path} value={file.path}>
                                    <div className="flex items-center space-x-2">
                                      <FileText className="h-4 w-4" />
                                      <span>{file.path}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {fileFilter && (
                              <p className="text-xs text-muted-foreground">
                                Showing {filteredFiles.length} of {repoFiles.length} files
                              </p>
                            )}
                          </div>
                        )}
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        The selected file content will be loaded into the editor.
                        You must click "Save Mapping" to persist the changes.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false)
                  form.reset(DEFAULT_VALUES)
                  setFileFilter('')
                  setRepoStatus(null)
                  setRepoFiles(EMPTY_GIT_FILES)
                  setImportStep('select-repo')
                }}
              >
                Cancel
              </Button>
              {importStep === 'select-file' && selectedFile && (
                <Button
                  type="submit"
                  disabled={importLoading || !selectedFile}
                  className="flex items-center space-x-2"
                >
                  {importLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  <span>Import File</span>
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

**Benefits:**
- ✅ Proper form validation with react-hook-form + zod
- ✅ Reusable component for Git imports across app
- ✅ Type-safe form data
- ✅ Built-in error handling
- ✅ Can be used for other file types (YAML, JSON, text)

**Estimated effort:** 3 hours

---

### Phase 4: Refactor Main Component

**File:** `common-settings.tsx`

**Changes:**
1. Remove manual state management (use TanStack Query)
2. Replace custom message system with toast
3. Extract dialogs to separate components
4. Reduce from 796 lines to ~150-200 lines
5. Use proper hooks and memoization

**Example refactored code:**

```tsx
'use client'

import { useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Loader2,
  CheckCircle,
  RotateCcw,
  Network,
  Settings,
  Download,
  HelpCircle
} from 'lucide-react'
import { useSnmpMappingQuery } from './hooks/use-snmp-mapping-query'
import { useSnmpMutations } from './hooks/use-snmp-mutations'
import { SnmpValidationDialog } from './dialogs/snmp-validation-dialog'
import { SnmpHelpDialog } from './dialogs/snmp-help-dialog'
import { GitImportDialog } from './dialogs/git-import-dialog'
import type { ValidationError } from './types'
import { SNMP_FILE_NAME } from './utils/constants'

const EMPTY_STRING = ''

export default function CommonSettingsForm() {
  // TanStack Query - no manual state management needed
  const { data: snmpMapping = EMPTY_STRING, isLoading, refetch } = useSnmpMappingQuery()
  const { validateYaml, saveMapping } = useSnmpMutations()

  // Local state for UI only (not server data)
  const [localContent, setLocalContent] = useState(snmpMapping)
  const [activeTab, setActiveTab] = useState('snmp-mapping')
  const [validationError, setValidationError] = useState<ValidationError | null>(null)
  const [showValidationDialog, setShowValidationDialog] = useState(false)
  const [showHelpDialog, setShowHelpDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)

  // Update local content when query data changes
  useMemo(() => {
    setLocalContent(snmpMapping)
  }, [snmpMapping])

  // Callbacks with useCallback for stability
  const handleValidate = useCallback(async () => {
    try {
      setValidationError(null)
      await validateYaml.mutateAsync(localContent)
    } catch (error: any) {
      setValidationError(error)
      setShowValidationDialog(true)
    }
  }, [localContent, validateYaml])

  const handleSave = useCallback(async () => {
    await saveMapping.mutateAsync(localContent)
  }, [localContent, saveMapping])

  const handleReload = useCallback(() => {
    refetch()
  }, [refetch])

  const handleImport = useCallback((content: string) => {
    setLocalContent(content)
  }, [])

  const handleOpenImportDialog = useCallback(() => {
    setShowImportDialog(true)
  }, [])

  const handleOpenHelpDialog = useCallback(() => {
    setShowHelpDialog(true)
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Settings className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Common Settings</h1>
            <p className="text-muted-foreground">
              Manage common settings used across multiple applications
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-1 w-full max-w-xs">
          <TabsTrigger value="snmp-mapping" className="flex items-center space-x-2">
            <Network className="h-4 w-4" />
            <span>SNMP Mapping</span>
          </TabsTrigger>
        </TabsList>

        {/* SNMP Mapping Tab */}
        <TabsContent value="snmp-mapping" className="space-y-6">
          <Card className="shadow-lg border-0 overflow-hidden p-0">
            <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-sm font-medium">
                  <Network className="h-4 w-4" />
                  <span>SNMP Mapping Configuration ({SNMP_FILE_NAME})</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenHelpDialog}
                  className="h-7 w-7 p-0 text-white hover:bg-white/20 hover:text-white"
                  title="Show help and examples"
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  SNMP Mapping Content
                </Label>
                <Textarea
                  value={localContent}
                  onChange={(e) => setLocalContent(e.target.value)}
                  placeholder="YAML content will be loaded here..."
                  className="w-full h-96 font-mono text-sm border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  disabled={isLoading}
                />
                <p className="text-xs text-gray-500">
                  Edit the SNMP mapping configuration YAML file. This defines SNMP credentials and mapping for different devices.
                </p>
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReload}
                  disabled={isLoading || validateYaml.isPending || saveMapping.isPending}
                  className="flex items-center space-x-2"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  <span>Reload</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleOpenImportDialog}
                  disabled={isLoading || validateYaml.isPending || saveMapping.isPending}
                  className="flex items-center space-x-2"
                >
                  <Download className="h-4 w-4" />
                  <span>Import from Git</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleValidate}
                  disabled={isLoading || validateYaml.isPending || saveMapping.isPending || !localContent}
                  className="flex items-center space-x-2"
                >
                  {validateYaml.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  <span>Check YAML</span>
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={isLoading || validateYaml.isPending || saveMapping.isPending}
                  className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  {saveMapping.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Network className="h-4 w-4" />
                  )}
                  <span>Save Mapping</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <SnmpValidationDialog
        open={showValidationDialog}
        onOpenChange={setShowValidationDialog}
        error={validationError}
      />

      <SnmpHelpDialog
        open={showHelpDialog}
        onOpenChange={setShowHelpDialog}
      />

      <GitImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImport={handleImport}
        fileType="yaml"
      />
    </div>
  )
}
```

**Before:** 796 lines
**After:** ~150-200 lines
**Reduction:** ~600 lines (75%)

**Key Changes:**
- ✅ No manual state management (TanStack Query)
- ✅ No custom message system (toast)
- ✅ Extracted dialogs (3 separate components)
- ✅ Proper memoization with constants
- ✅ Clean component boundaries

**Estimated effort:** 2 hours

---

## Final Directory Structure (After Refactoring)

```
frontend/src/components/features/settings/common/
├── common-settings.tsx              # ~150-200 lines (was 796, -75%)
├── components/
│   └── (future shared components)
├── dialogs/
│   ├── snmp-validation-dialog.tsx   # ~50 lines (new)
│   ├── snmp-help-dialog.tsx         # ~120 lines (new)
│   └── git-import-dialog.tsx        # ~250 lines (new, reusable)
├── hooks/
│   ├── use-snmp-mapping-query.ts    # ~40 lines (new)
│   └── use-snmp-mutations.ts        # ~80 lines (new)
├── types/
│   └── index.ts                     # ~50 lines (new)
└── utils/
    └── constants.ts                 # ~20 lines (new)
```

**Total:** ~760 lines (was 796)
**Main Component:** 150-200 lines (was 796, -75%)
**New Infrastructure:** ~560 lines (reusable across app)

---

## Summary of Changes

| File | Before | After | Change |
|------|--------|-------|--------|
| `common-settings.tsx` | 796 | ~150-200 | **-600 lines (-75%)** |
| **Subtotal (existing)** | **796** | **~150-200** | **-600 lines (-75%)** |
| **New files** | **0** | **~560** | **+560 lines** |
| **Grand Total** | **796** | **~710-760** | **-36 to -86 lines (-5% to -11%)** |

**Net reduction:** ~36-86 lines (5-11%), but with significantly better architecture:
- TanStack Query for server state management
- Reusable dialogs (Git import can be used elsewhere)
- Proper form validation with react-hook-form + zod
- Toast notifications instead of custom messages
- Better type safety
- Easier testing
- Improved maintainability

---

## Estimated Total Effort

| Phase | Description | Effort |
|-------|-------------|--------|
| 1.1 | Verify backend architecture | 30 min |
| 1.2 | Add query keys to factory | 10 min |
| 1.3 | Create type definitions | 30 min |
| 1.4 | Create constants | 15 min |
| 3.1 | Create query hooks (TanStack Query) | 45 min |
| 3.2 | Create mutation hooks (TanStack Query) | 1.5 hours |
| 2.1 | Create SNMP validation dialog | 30 min |
| 2.2 | Create SNMP help dialog | 45 min |
| 2.3 | Create Git import dialog (react-hook-form + zod) | 3 hours |
| 4 | Refactor main component | 2 hours |
| - | Testing & Integration | 2 hours |
| **Total** | | **~12-13 hours** |

**Note:** Git import dialog is reusable across app (can be used for other features), which adds value beyond this refactoring.

---

## Benefits After Refactoring

### Code Quality
1. **Architecture Compliance**: Uses TanStack Query as mandated by CLAUDE.md
2. **Separation of Concerns**: Clear component boundaries, single responsibility
3. **Type Safety**: Centralized type definitions, no inline types
4. **Consistency**: Uses standard patterns (toast, react-hook-form, zod)

### User Experience
1. **Better Error Handling**: Consistent toast notifications
2. **Improved Loading States**: TanStack Query built-in states
3. **No Regression**: All functionality preserved
4. **Reusable Git Import**: Can import configs from Git across app

### Developer Experience
1. **Easier Testing**: Isolated components and hooks
2. **Simpler Components**: Main component reduced by 75%
3. **Reusable Patterns**: Git import dialog can be used elsewhere
4. **Better Maintainability**: Changes isolated to specific files

### Performance
1. **Automatic Caching**: TanStack Query reduces API calls
2. **No Memory Leaks**: Proper cleanup with TanStack Query
3. **Optimized Renders**: Proper memoization with constants

---

## Success Metrics

**Code Quality:**
- [x] Main component < 250 lines (target: ~150-200)
- [ ] No manual `useState` + `useEffect` for server data
- [ ] All forms use react-hook-form + zod
- [ ] No inline arrays/objects in default parameters
- [ ] Toast notifications instead of custom messages
- [ ] Zero ESLint warnings

**Architecture Compliance:**
- [ ] All data fetching uses TanStack Query
- [ ] Query keys in centralized factory (`/lib/query-keys.ts`)
- [ ] API calls via `/api/proxy/config/*`
- [ ] Feature-based folder structure (components/, hooks/, dialogs/, types/, utils/)
- [ ] All UI components from Shadcn
- [ ] Backend has repository/service/router layers

**User Experience:**
- [ ] No regression in functionality
- [ ] Improved loading states (TanStack Query)
- [ ] Better error messages (toast)
- [ ] Faster perceived performance (caching)
- [ ] Git import workflow preserved

**Developer Experience:**
- [ ] Easier to test (isolated hooks and components)
- [ ] Clear component boundaries
- [ ] Reusable Git import dialog
- [ ] Good documentation
- [ ] Type safety throughout

---

## Comparison with RBAC Settings Refactoring

| Metric | RBAC Settings | Common Settings |
|--------|---------------|-----------------|
| Lines of Code | 1,869 (6 files) | 796 (1 file) |
| Critical Issue | Code duplication (5x) | Monolithic component |
| Components | 6 separate managers | 1 large component |
| Refactoring Priority | **MEDIUM** (tech debt) | **MEDIUM** (tech debt) |
| Estimated Effort | ~25.5 hours | ~12-13 hours |
| Main Approach | TanStack Query + consolidation | TanStack Query + decomposition |
| Main Issue | Massive code duplication | Single 796-line file |
| Primary Benefit | DRY + shared state | Separation of concerns + reusability |
| Code Reduction | -40% per component | -75% main component |
| New Infrastructure | ~600 lines | ~560 lines |
| Reusable Components | RBAC-specific | Git import (app-wide) |

### Key Similarities

Both refactorings follow the same pattern:
1. ✅ Migrate to TanStack Query (mandatory per CLAUDE.md)
2. ✅ Feature-based folder structure (components/, hooks/, types/, utils/)
3. ✅ react-hook-form + zod for all forms
4. ✅ Extract constants to prevent re-render loops
5. ✅ Component decomposition
6. ✅ Centralized query keys in `/lib/query-keys.ts`
7. ✅ Toast notifications instead of custom messages

### Key Differences

**RBAC Settings:**
- Multiple components with duplication → consolidated shared hooks
- Complex relational state (users, roles, permissions)
- More mutations (CRUD for 3+ entities)

**Common Settings:**
- Single monolithic component → decomposed into smaller components
- Simpler state (YAML content, Git repos/files)
- Fewer mutations (save, validate)
- Creates reusable Git import dialog (app-wide benefit)

---

## Notes

- This refactoring is **recommended** - improves maintainability and compliance with CLAUDE.md
- Git import dialog is **reusable** across app (templates, configs, other YAML files)
- Consider using the same Git import pattern for other features
- Document the new patterns in coding guidelines for consistency
- Priority: **MEDIUM** (after critical refactorings like Check IP, similar to RBAC)

---

**Document Version:** 1.0
**Created:** 2026-01-21
**Status:** Planning
**Priority:** Medium (tech debt, architecture compliance)
