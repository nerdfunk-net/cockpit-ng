# Refactoring Plan: Automation Templates Page

**Component:** `frontend/src/app/(dashboard)/automation/templates/page.tsx`
**Created:** 2026-02-07
**Status:** Planning
**Lines of Code:** 1,609

## TL;DR - What's Wrong & How to Fix It

**Problems:**
1. :no_entry: **Monolithic file** - 1,609 lines in a single file (should be <300 per component)
2. :warning: **Architecture violation** - Manual `useState`/`useEffect` instead of mandatory TanStack Query
3. :warning: **Query keys exist but unused** - `queryKeys.templates.*` and `queryKeys.credentials.*` already defined in `lib/query-keys.ts` but page uses manual `apiCall`
4. :triangular_flag_on_post: **No form validation** - Manual `handleFormChange` instead of react-hook-form + zod
5. :speech_balloon: **Custom message bar** - `setMessage()` with `setTimeout` instead of `useToast()`
6. :page_facing_up: **~450 lines of static help content inline** - `HelpAndExamplesContent` embedded in page file
7. :repeat: **Duplicate API logic** - `loadTemplates()` and `loadCredentials()` with identical patterns
8. :mag: **Manual device search with custom debounce** - `useEffect` + `setTimeout` instead of TanStack Query with `enabled` flag
9. :card_index: **24 useState hooks** - Mixed server data, form state, UI state, and dialog state in one component

**Solution:**
1. **Migrate to TanStack Query** - Replaces ~80 lines of manual state + API calls with built-in caching
2. **Create 4 query/mutation hooks** - Templates CRUD, credentials list, device search, template render
3. **Extract ~450 lines of help content** - Zero-logic static component to its own file
4. **Decompose into 5 components** - Template list, template form, device search panel, pre-run panel, view dialog
5. **Add form validation** - react-hook-form + zod for template create/edit form
6. **Replace `setMessage()` with `useToast()`** - Standard Shadcn UI notification pattern
7. **Extract types and constants** - Shared interfaces and default values

**Critical Path:** Phase 1 (foundation) -> Phase 2 (TanStack Query) -> Phase 3 (decomposition)

**Minimum Viable:** Phases 1-2 establishes proper architecture per CLAUDE.md

---

## Executive Summary

The Automation Templates page (`page.tsx`) is a **1,609-line monolithic component** that manages Jinja2 template CRUD, device search, template rendering, Nautobot data preview, pre-run command configuration, and ~450 lines of inline help documentation. It has **24 `useState` hooks** and violates multiple mandatory CLAUDE.md patterns:

1. **Architecture Violation** - Uses manual `useState` + `useEffect` for all data fetching despite `queryKeys.templates.*` and `queryKeys.credentials.*` already existing in the query key factory
2. **No Form Validation** - Template create/edit form uses manual `handleFormChange` with no validation schema
3. **No Component Decomposition** - Single component handles list, form, device search, rendering, dialogs, and help content
4. **Custom Notification** - Uses `setMessage()` + `setTimeout(() => setMessage(''), 5000)` instead of `useToast()`
5. **Manual Debounced Search** - Custom `useEffect` + `setTimeout` for device search instead of TanStack Query with `enabled` flag
6. **Duplicate API Patterns** - `loadTemplates()` and `loadCredentials()` follow identical fetch/setState/catch patterns
7. **Inline Static Content** - ~450 lines of help/examples content (lines 52-540) with zero business logic bloating the file

**Bottom Line:** TanStack Query migration is mandatory per CLAUDE.md. The query keys already exist but are unused. Component decomposition will reduce the main file from 1,609 lines to ~200 lines.

## Key Changes Summary

| Current Approach | Required Approach (CLAUDE.md) |
|------------------|-------------------------------|
| Manual `useState` + `useEffect` for templates/credentials | **TanStack Query with auto-caching** |
| 24 separate `useState` hooks | **TanStack Query states + react-hook-form + minimal UI state** |
| Manual API calls with error handling | **useQuery/useMutation hooks** |
| `setMessage()` + `setTimeout` | **useToast() from Shadcn UI** |
| Single 1,609-line file | **7+ focused files < 300 lines each** |
| Manual `handleFormChange` + direct state updates | **react-hook-form + zod** |
| Custom debounced device search in `useEffect` | **TanStack Query with `enabled` flag** |
| `queryKeys.templates.*` defined but unused | **Used in all query/mutation hooks** |
| `confirm()` for delete confirmation | **AlertDialog from Shadcn UI** |
| `eslint-disable-next-line` suppressing dependency warnings | **Proper dependency management** |

## Quick Wins (Can Start Immediately)

These tasks can be done right now without breaking existing functionality:

### 1. Extract Help & Examples Content (15 min)
- Move `CodeExample` component and `HelpAndExamplesContent` (lines 52-540) to `components/features/network/automation/netmiko/components/help-and-examples.tsx`
- ~450 lines of static content with zero business logic
- **Immediate reduction:** Page goes from 1,609 to ~1,160 lines

### 2. Extract Type Definitions (15 min)
- Create `components/features/network/automation/netmiko/types/templates.ts`
- Move `Template` and `DeviceSearchResult` interfaces (lines 24-49)
- No behavioral changes

### 3. Extract Constants (15 min)
- Create `components/features/network/automation/netmiko/utils/constants.ts`
- Move default form data, stale times, default file path
- Fixes potential re-render issues from inline object literals

### 4. Replace `setMessage()` with `useToast()` (30 min)
- Replace all `showMessage()` calls with `toast()` from `@/hooks/use-toast`
- Remove custom message state and inline Alert rendering (lines 555, 628-631, 1006-1014)
- No structural changes needed

**Total:** ~1.25 hours
**Risk:** Zero (no behavioral changes)
**Benefit:** Immediate code quality improvement, sets up for TanStack Query migration

---

## Current Architecture

```
frontend/src/app/(dashboard)/automation/templates/
└── page.tsx                  # 1,609 lines - Everything in one file
```

**Responsibilities crammed into one file:**
- `CodeExample` component (lines 52-86) - Copy-to-clipboard code block
- `HelpAndExamplesContent` component (lines 89-540) - ~450 lines of static Jinja2 documentation
- `UserTemplatesContent` component (lines 542-1605) - ALL business logic:
  - Template list with search (lines 1025-1116)
  - Template create/edit form (lines 1118-1476)
  - Device search with debounced dropdown (lines 1323-1433)
  - Pre-run command panel (lines 1154-1232)
  - Template view dialog (lines 1484-1588)
  - Template rendering logic (lines 721-810)
  - 24 `useState` hooks (lines 550-594)
  - 12 handler functions (lines 633-978)
- Page export (lines 1607-1609)

**Existing shared components already used (from netmiko feature):**
- `useVariableManager` hook (37 lines, stays as-is)
- `VariableManagerPanel` component
- `TemplateRenderResultDialog` component
- `NautobotDataDialog` component

**Total:** 1,609 lines with heavily mixed concerns

---

## Problem Analysis

### Problem 1: Monolithic File (1,609 lines)

**Severity:** HIGH

The file handles 6+ distinct UI areas and their associated logic in a single component. Per CLAUDE.md, components should be <300 lines with feature-based decomposition.

**Current structure:**
- Lines 52-540: Static help content (~450 lines, zero business logic)
- Lines 542-1605: Main component with everything else (~1,060 lines)

**Impact:** Impossible to test individual parts, difficult to navigate, blocks parallel development.

---

### Problem 2: Manual useState/useEffect Instead of TanStack Query

**Severity:** CRITICAL
**Affected Lines:** 550-600, 596-626

```tsx
// Lines 550-553: Manual state for server data
const [templates, setTemplates] = useState<Template[]>([])
const [loading, setLoading] = useState(false)

// Lines 596-600: Manual fetch on mount with eslint suppression
useEffect(() => {
  loadTemplates()
  loadCredentials()
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [])

// Lines 602-613: Manual API call pattern
const loadTemplates = async () => {
  setLoading(true)
  try {
    const response = await apiCall<{ templates: Template[] }>('templates?category=netmiko')
    setTemplates(response.templates || [])
  } catch (error) {
    console.error('Error loading templates:', error)
    showMessage('Failed to load templates')
  } finally {
    setLoading(false)
  }
}
```

**Issues:**
- Manual loading state management
- Manual error handling
- No caching - refetches on every mount
- `eslint-disable-next-line` suppressing legitimate dependency warning
- Violates CLAUDE.md mandatory TanStack Query requirement
- `queryKeys.templates.*` already defined in `lib/query-keys.ts` (lines 293-313) but unused

---

### Problem 3: No react-hook-form + zod for Template Form

**Severity:** HIGH
**Affected Lines:** 560-566, 633-643, 835-877

```tsx
// Lines 560-566: Manual form state
const [formData, setFormData] = useState({
  name: '',
  description: '',
  content: '',
  scope: (isAdmin ? 'global' : 'private') as 'global' | 'private',
  execution_mode: 'run_on_device' as 'run_on_device' | 'write_to_file' | 'sync_to_nautobot'
})

// Lines 633-635: Manual change handler (no validation)
const handleFormChange = (field: string, value: string | boolean) => {
  setFormData(prev => ({ ...prev, [field]: value }))
}

// Lines 835-838: Manual validation (only checks name and content)
const handleCreateTemplate = async () => {
  if (!formData.name.trim() || !formData.content.trim()) {
    showMessage('Please fill in name and content')
    return
  }
```

**Issues:**
- No validation schema
- Field names are untyped strings (`field: string`)
- Manual validation only checks for empty values
- No field-level validation or error messages
- Violates CLAUDE.md mandatory react-hook-form + zod requirement

---

### Problem 4: Custom `setMessage()` Instead of `useToast()`

**Severity:** MEDIUM
**Affected Lines:** 555, 628-631, 1006-1014

```tsx
// Line 555: Custom message state
const [message, setMessage] = useState('')

// Lines 628-631: Custom implementation with timeout
const showMessage = (msg: string) => {
  setMessage(msg)
  setTimeout(() => setMessage(''), 5000)
}

// Lines 1006-1014: Custom inline rendering
{message && (
  <div className={`p-4 rounded-lg border ${
    message.includes('success')
      ? 'bg-green-50 border-green-200 text-green-800'
      : 'bg-red-50 border-red-200 text-red-800'
  }`}>
    {message}
  </div>
)}
```

**Issues:**
- Success/error detection based on string matching (`message.includes('success')`)
- Custom UI instead of standard Shadcn `useToast()` hook
- Manual timeout cleanup (no cancel on unmount)

---

### Problem 5: ~450 Lines of Static Help Content Inline

**Severity:** MEDIUM
**Affected Lines:** 52-540

The `CodeExample` component (35 lines) and `HelpAndExamplesContent` component (~450 lines) contain zero business logic - they are pure static content with Jinja2 documentation and template examples.

**Impact:** Inflates the file by ~30% with content that has no interaction with the business logic in `UserTemplatesContent`.

---

### Problem 6: Duplicate API Logic

**Severity:** MEDIUM
**Affected Lines:** 602-626

```tsx
// loadTemplates() - Lines 602-613
const loadTemplates = async () => {
  setLoading(true)
  try {
    const response = await apiCall<{ templates: Template[] }>('templates?category=netmiko')
    setTemplates(response.templates || [])
  } catch (error) {
    console.error('Error loading templates:', error)
    showMessage('Failed to load templates')
  } finally {
    setLoading(false)
  }
}

// loadCredentials() - Lines 615-626 (identical pattern)
const loadCredentials = async () => {
  try {
    const response = await apiCall<Array<...>>('credentials?include_expired=false')
    const sshCredentials = response.filter(cred => cred.type === 'ssh')
    setStoredCredentials(sshCredentials)
  } catch (error) {
    console.error('Error loading credentials:', error)
    setStoredCredentials([])
  }
}
```

Both follow the identical: try/apiCall/setState/catch/console.error pattern. TanStack Query eliminates this entirely.

---

### Problem 7: Manual Device Search with Custom Debounce

**Severity:** MEDIUM
**Affected Lines:** 661-692

```tsx
// Lines 661-692: Manual debounced search in useEffect
useEffect(() => {
  const loadDevices = async () => {
    if (deviceSearchTerm.length < 3) {
      setDevices([])
      setShowDeviceDropdown(false)
      return
    }
    if (selectedDevice) return

    setIsLoadingDevices(true)
    try {
      const response = await apiCall<{ devices: DeviceSearchResult[] }>(
        `nautobot/devices?filter_type=name__ic&filter_value=${encodeURIComponent(deviceSearchTerm)}`
      )
      setDevices(response.devices || [])
      setShowDeviceDropdown(true)
    } catch (error) {
      setDevices([])
    } finally {
      setIsLoadingDevices(false)
    }
  }

  const debounceTimer = setTimeout(loadDevices, 300)
  return () => clearTimeout(debounceTimer)
}, [deviceSearchTerm, apiCall, selectedDevice])
```

**Issues:**
- Manual debounce with `setTimeout` in `useEffect`
- 5 `useState` hooks just for device search (search term, devices, loading, dropdown, selected)
- No caching of search results
- Should use TanStack Query with `enabled: searchTerm.length >= 3 && !selectedDevice`

---

### Problem 8: Query Keys Exist But Are Unused

**Severity:** CRITICAL
**Affected Lines:** `lib/query-keys.ts` lines 293-313 and 219-226

The centralized query key factory already defines keys for both templates and credentials:

```tsx
// Already defined in lib/query-keys.ts:

// Templates (lines 293-313)
templates: {
  all: ['templates'] as const,
  list: (filters?: { category?: string; source?: string; search?: string }) => ...,
  detail: (id: number) => ...,
  content: (id: number) => ...,
  categories: () => ...,
  importable: () => ...,
},

// Credentials (lines 219-226)
credentials: {
  all: ['credentials'] as const,
  list: (filters?: { source?: string; includeExpired?: boolean; git?: boolean }) => ...,
  detail: (id: number) => ...,
},
```

The page ignores these entirely and uses raw `apiCall()` with manual state management.

---

### Problem 9: 24 useState Hooks

**Severity:** HIGH
**Affected Lines:** 550-594

```tsx
// Server data (should be TanStack Query)
const [templates, setTemplates] = useState<Template[]>([])
const [storedCredentials, setStoredCredentials] = useState<Array<...>>([])
const [devices, setDevices] = useState<DeviceSearchResult[]>([])

// Loading states (eliminated by TanStack Query)
const [loading, setLoading] = useState(false)
const [isLoadingDevices, setIsLoadingDevices] = useState(false)
const [isRenderingTemplate, setIsRenderingTemplate] = useState(false)

// Form state (should be react-hook-form)
const [formData, setFormData] = useState({...})
const [preRunCommand, setPreRunCommand] = useState('')
const [selectedCredentialId, setSelectedCredentialId] = useState<number | null>(null)
const [filePath, setFilePath] = useState('...')

// UI state (some remain, some eliminated)
const [searchTerm, setSearchTerm] = useState('')
const [activeTab, setActiveTab] = useState('list')
const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
const [message, setMessage] = useState('')
const [viewingTemplate, setViewingTemplate] = useState<Template | null>(null)
const [showViewDialog, setShowViewDialog] = useState(false)
const [deviceSearchTerm, setDeviceSearchTerm] = useState('')
const [showDeviceDropdown, setShowDeviceDropdown] = useState(false)
const [selectedDevice, setSelectedDevice] = useState<DeviceSearchResult | null>(null)
const [showNautobotDataDialog, setShowNautobotDataDialog] = useState(false)
const [nautobotData, setNautobotData] = useState<Record<string, unknown> | null>(null)
const [showRenderResultDialog, setShowRenderResultDialog] = useState(false)
const [renderResult, setRenderResult] = useState<TemplateRenderResult | null>(null)
const [isPreRunPanelExpanded, setIsPreRunPanelExpanded] = useState(false)
```

**After refactoring, many of these are eliminated:**
- 3 server data states -> TanStack Query
- 3 loading states -> TanStack Query `isLoading`/`isPending`
- 5 form states -> react-hook-form
- 1 message state -> `useToast()`
- Remaining ~12 UI states distributed across focused components

---

## Proposed Refactoring Plan

### Phase 1: Foundation & Setup

**1.1: Extract Type Definitions**

**File:** `components/features/network/automation/netmiko/types/templates.ts` (new)

```tsx
export interface Template {
  id: number
  name: string
  description: string
  content: string
  scope: 'global' | 'private'
  variables?: Record<string, string>
  use_nautobot_context?: boolean
  pre_run_command?: string
  credential_id?: number
  execution_mode?: 'run_on_device' | 'write_to_file' | 'sync_to_nautobot'
  file_path?: string
  created_by?: string
  category: string
  template_type: string
  source: string
  updated_at: string
}

export interface DeviceSearchResult {
  id: string
  name: string
  primary_ip4?: { address: string } | string
  location?: { name: string }
}

export interface TemplateFormData {
  name: string
  description: string
  content: string
  scope: 'global' | 'private'
  execution_mode: 'run_on_device' | 'write_to_file' | 'sync_to_nautobot'
}

export interface TemplatesListResponse {
  templates: Template[]
}

export interface SSHCredential {
  id: number
  name: string
  username: string
  type: string
}

export interface TemplateRenderRequest {
  template_content: string
  category: string
  device_id: string
  user_variables: Record<string, string>
  use_nautobot_context: boolean
  pre_run_command?: string
  credential_id?: number
}

export interface TemplateRenderResponse {
  rendered_content: string
  variables_used: string[]
  context_data?: Record<string, unknown>
  warnings?: string[]
  pre_run_output?: string
  pre_run_parsed?: Array<Record<string, unknown>>
}
```

**Estimated effort:** 15 minutes

---

**1.2: Extract Constants**

**File:** `components/features/network/automation/netmiko/utils/template-constants.ts` (new)

```tsx
import type { TemplateFormData } from '../types/templates'

export const DEFAULT_FILE_PATH = 'templates/{device_name}-{template_name}.txt'

export const DEFAULT_FORM_DATA: TemplateFormData = {
  name: '',
  description: '',
  content: '',
  scope: 'global',
  execution_mode: 'run_on_device',
}

export const STALE_TIME = {
  TEMPLATES: 30 * 1000,       // 30 seconds - templates change infrequently
  CREDENTIALS: 2 * 60 * 1000, // 2 minutes - credentials rarely change
  DEVICE_SEARCH: 10 * 1000,   // 10 seconds - search results can be cached briefly
} as const

export const DEVICE_SEARCH_MIN_CHARS = 3
export const DEVICE_SEARCH_DEBOUNCE_MS = 300

export const EMPTY_TEMPLATES: Template[] = []
export const EMPTY_CREDENTIALS: SSHCredential[] = []
```

**Estimated effort:** 15 minutes

---

**1.3: Extract Help & Examples Content**

**File:** `components/features/network/automation/netmiko/components/help-and-examples.tsx` (new)

Move `CodeExample` (lines 52-86) and `HelpAndExamplesContent` (lines 89-540) verbatim. These are pure static components with zero business logic dependencies.

```tsx
// Move lines 52-540 from page.tsx
// ~450 lines of static documentation content
// Only dependency: lucide-react icons and Shadcn Badge, Button
export { HelpAndExamplesContent }
```

**Estimated effort:** 15 minutes
**Immediate impact:** Page drops from 1,609 to ~1,160 lines

---

### Phase 2: TanStack Query Migration (CRITICAL - Mandatory)

**2.1: Create Templates Query Hook**

**File:** `hooks/queries/use-templates-queries.ts` (new)

Uses existing `queryKeys.templates.*` from `lib/query-keys.ts` (lines 293-313).

```tsx
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { Template, TemplatesListResponse } from
  '@/components/features/network/automation/netmiko/types/templates'
import { STALE_TIME } from
  '@/components/features/network/automation/netmiko/utils/template-constants'

const EMPTY_TEMPLATES: Template[] = []

interface UseTemplatesQueryOptions {
  category?: string
  source?: string
  search?: string
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseTemplatesQueryOptions = {}

/**
 * Fetch templates list with automatic caching.
 * Uses existing queryKeys.templates.list() from lib/query-keys.ts.
 *
 * @example
 * ```tsx
 * const { data, isLoading, refetch } = useTemplatesQuery({ category: 'netmiko' })
 * const templates = data?.templates || []
 * ```
 */
export function useTemplatesQuery(options: UseTemplatesQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { category, source, search, enabled = true } = options

  const filters = { category, source, search }

  return useQuery({
    queryKey: queryKeys.templates.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (category) params.set('category', category)
      if (source) params.set('source', source)
      if (search) params.set('search', search)
      const qs = params.toString()
      return apiCall<TemplatesListResponse>(`templates${qs ? `?${qs}` : ''}`)
    },
    enabled,
    staleTime: STALE_TIME.TEMPLATES,
    select: (data) => data.templates || EMPTY_TEMPLATES,
  })
}

/**
 * Fetch a single template by ID.
 * Uses existing queryKeys.templates.detail() from lib/query-keys.ts.
 */
export function useTemplateDetailQuery(templateId: number | null, enabled = false) {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.templates.detail(templateId!),
    queryFn: async () => apiCall<Template>(`templates/${templateId}`),
    enabled: !!templateId && enabled,
    staleTime: 0,
  })
}
```

**Estimated effort:** 1 hour

---

**2.2: Create Templates Mutation Hook**

**File:** `hooks/queries/use-templates-mutations.ts` (new)

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import { useMemo } from 'react'
import type { Template, TemplateRenderRequest, TemplateRenderResponse }
  from '@/components/features/network/automation/netmiko/types/templates'

/**
 * CRUD + render mutations for templates.
 * Automatically invalidates queryKeys.templates.list() after create/update/delete.
 *
 * Pattern reference: use-saved-inventories-queries.ts (hooks/queries/)
 *
 * @example
 * ```tsx
 * const { createTemplate, updateTemplate, deleteTemplate, renderTemplate } = useTemplatesMutations()
 *
 * createTemplate.mutate({ name: 'my-template', content: '...' })
 * ```
 */
export function useTemplatesMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const createTemplate = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return apiCall('templates', { method: 'POST', body: data })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.list() })
      toast({ title: 'Success', description: 'Template created successfully' })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create template',
        variant: 'destructive',
      })
    },
  })

  const updateTemplate = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      return apiCall(`templates/${id}`, { method: 'PUT', body: data })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.list() })
      toast({ title: 'Success', description: 'Template updated successfully' })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update template',
        variant: 'destructive',
      })
    },
  })

  const deleteTemplate = useMutation({
    mutationFn: async (id: number) => {
      return apiCall(`templates/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.list() })
      toast({ title: 'Success', description: 'Template deleted successfully' })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete template',
        variant: 'destructive',
      })
    },
  })

  const renderTemplate = useMutation({
    mutationFn: async (data: TemplateRenderRequest) => {
      return apiCall<TemplateRenderResponse>('templates/render', {
        method: 'POST',
        body: data,
      })
    },
    // No toast on success - result shown in dialog
    onError: (error: Error) => {
      toast({
        title: 'Render Error',
        description: error.message || 'Failed to render template',
        variant: 'destructive',
      })
    },
  })

  return useMemo(() => ({
    createTemplate,
    updateTemplate,
    deleteTemplate,
    renderTemplate,
  }), [createTemplate, updateTemplate, deleteTemplate, renderTemplate])
}
```

**Estimated effort:** 1.5 hours

---

**2.3: Create Credentials Query Hook**

**File:** `hooks/queries/use-credentials-query.ts` (new)

This is a **reusable hook** - credentials are used by templates, pre-run commands, and potentially other features.

Uses existing `queryKeys.credentials.*` from `lib/query-keys.ts` (lines 219-226).

```tsx
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

interface Credential {
  id: number
  name: string
  username: string
  type: string
}

const EMPTY_CREDENTIALS: Credential[] = []

interface UseCredentialsQueryOptions {
  source?: string
  includeExpired?: boolean
  type?: string // Filter client-side by type (e.g., 'ssh')
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseCredentialsQueryOptions = {}

/**
 * Fetch credentials with automatic caching.
 * Uses existing queryKeys.credentials.list() from lib/query-keys.ts.
 *
 * Backend: GET /api/credentials?include_expired=false
 * Auth: require_permission("settings.credentials", "read")
 *
 * @example
 * ```tsx
 * // SSH credentials only
 * const { data: credentials } = useCredentialsQuery({ type: 'ssh' })
 * ```
 */
export function useCredentialsQuery(options: UseCredentialsQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { source, includeExpired = false, type, enabled = true } = options

  return useQuery({
    queryKey: queryKeys.credentials.list({ source, includeExpired }),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (includeExpired) params.set('include_expired', 'true')
      if (source) params.set('source', source)
      const qs = params.toString()
      return apiCall<Credential[]>(`credentials${qs ? `?${qs}` : ''}`)
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
    select: (data) => {
      const credentials = data || EMPTY_CREDENTIALS
      return type ? credentials.filter(c => c.type === type) : credentials
    },
  })
}

export type { Credential }
```

**Estimated effort:** 30 minutes

---

**2.4: Create Device Search Query Hook**

**File:** `hooks/queries/use-device-search-query.ts` (new)

Replaces the manual debounced `useEffect` (lines 661-692) with a TanStack Query hook.

```tsx
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import type { DeviceSearchResult } from
  '@/components/features/network/automation/netmiko/types/templates'

interface DeviceSearchResponse {
  devices: DeviceSearchResult[]
}

const EMPTY_DEVICES: DeviceSearchResult[] = []

/**
 * Debounced device search using TanStack Query.
 * Replaces manual useEffect + setTimeout debounce pattern.
 *
 * Backend: GET /api/nautobot/devices?filter_type=name__ic&filter_value=...
 * Auth: require_permission("nautobot.devices", "read")
 *
 * The `enabled` flag controls when the query fires:
 * - Search term must be >= 3 characters
 * - No device should already be selected
 *
 * @example
 * ```tsx
 * const { data: devices, isLoading } = useDeviceSearchQuery(searchTerm, {
 *   enabled: searchTerm.length >= 3 && !selectedDevice
 * })
 * ```
 */
export function useDeviceSearchQuery(searchTerm: string, options: { enabled?: boolean } = {}) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: ['devices', 'search', searchTerm],
    queryFn: async () => {
      const response = await apiCall<DeviceSearchResponse>(
        `nautobot/devices?filter_type=name__ic&filter_value=${encodeURIComponent(searchTerm)}`
      )
      return response.devices || EMPTY_DEVICES
    },
    enabled: enabled && searchTerm.length >= 3,
    staleTime: 10 * 1000,  // 10 seconds
    gcTime: 30 * 1000,     // 30 seconds
  })
}
```

**Note:** The debounce behavior is handled at the component level using a `useDeferredValue` or a simple debounced state pattern, not inside the query hook. The `enabled` flag prevents unnecessary requests.

**Estimated effort:** 30 minutes

---

**Benefits of Phase 2:**
- Eliminates `loadTemplates()`, `loadCredentials()`, and device search `useEffect` (~80 lines)
- Eliminates 6 `useState` hooks (templates, storedCredentials, devices, loading, isLoadingDevices, showDeviceDropdown)
- Built-in caching - switching tabs doesn't refetch
- Automatic background refetching on window focus
- Uses existing `queryKeys.templates.*` and `queryKeys.credentials.*`
- Reusable `useCredentialsQuery` hook for other features

**Total estimated effort for Phase 2:** 3.5 hours

---

### Phase 3: Component Decomposition

**3.1: Extract Template List Component**

**File:** `components/features/network/automation/netmiko/components/template-list.tsx` (new)

Extracts the "My Templates" tab content (lines 1025-1116).

```tsx
'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { FileCode, Eye, Edit, Trash2, Search, RefreshCw } from 'lucide-react'
import type { Template } from '../types/templates'

interface TemplateListProps {
  templates: Template[]
  isLoading: boolean
  username?: string
  onView: (templateId: number) => void
  onEdit: (template: Template) => void
  onDelete: (templateId: number) => void
}

export function TemplateList({
  templates,
  isLoading,
  username,
  onView,
  onEdit,
  onDelete,
}: TemplateListProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredTemplates = useMemo(() =>
    templates.filter(t =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [templates, searchTerm]
  )

  const canEditTemplate = (template: Template) => template.created_by === username

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      {/* Header + Search + Template cards */}
      {/* ~90 lines - extracted from lines 1025-1116 */}
    </div>
  )
}
```

**Estimated effort:** 45 minutes

---

**3.2: Extract Template Form Component with react-hook-form + zod**

**File:** `components/features/network/automation/netmiko/components/template-form.tsx` (new)

Extracts the "Create/Edit Template" tab content (lines 1118-1476). Adds proper form validation.

```tsx
'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import type { Template, DeviceSearchResult } from '../types/templates'
import type { TemplateVariable } from '../types'

// Validation schema
const templateFormSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(255),
  description: z.string().max(1000).optional().default(''),
  content: z.string().min(1, 'Template content is required'),
  scope: z.enum(['global', 'private']),
  execution_mode: z.enum(['run_on_device', 'write_to_file', 'sync_to_nautobot']),
})

type TemplateFormValues = z.infer<typeof templateFormSchema>

interface TemplateFormProps {
  editingTemplate: Template | null
  isAdmin: boolean
  onSubmit: (data: TemplateFormValues & {
    variables: Record<string, string>
    useNautobotContext: boolean
    preRunCommand?: string
    credentialId?: number
    filePath?: string
  }) => void
  onCancel: () => void
  isPending: boolean
}

export function TemplateForm({
  editingTemplate,
  isAdmin,
  onSubmit,
  onCancel,
  isPending,
}: TemplateFormProps) {
  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: '',
      description: '',
      content: '',
      scope: isAdmin ? 'global' : 'private',
      execution_mode: 'run_on_device',
    },
  })

  // Reset form when editing a different template
  useEffect(() => {
    if (editingTemplate) {
      form.reset({
        name: editingTemplate.name,
        description: editingTemplate.description || '',
        content: editingTemplate.content || '',
        scope: editingTemplate.scope || 'global',
        execution_mode: editingTemplate.execution_mode || 'run_on_device',
      })
    }
  }, [editingTemplate, form])

  // ... form fields, VariableManagerPanel, DeviceSearchPanel, PreRunPanel
  // ~250 lines
}
```

**Estimated effort:** 2 hours

---

**3.3: Extract Device Search Panel**

**File:** `components/features/network/automation/netmiko/components/device-search-panel.tsx` (new)

Extracts the device selection area (lines 1323-1433) into a self-contained component that uses `useDeviceSearchQuery`.

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, RefreshCw } from 'lucide-react'
import { useDeviceSearchQuery } from '@/hooks/queries/use-device-search-query'
import type { DeviceSearchResult } from '../types/templates'

interface DeviceSearchPanelProps {
  selectedDevice: DeviceSearchResult | null
  onDeviceSelect: (device: DeviceSearchResult) => void
  onDeviceClear: () => void
  onShowNautobotData: () => void
  onRenderTemplate: () => void
  canRender: boolean
  isRendering: boolean
}

export function DeviceSearchPanel({
  selectedDevice,
  onDeviceSelect,
  onDeviceClear,
  onShowNautobotData,
  onRenderTemplate,
  canRender,
  isRendering,
}: DeviceSearchPanelProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  const { data: devices = [], isLoading } = useDeviceSearchQuery(searchTerm, {
    enabled: searchTerm.length >= 3 && !selectedDevice,
  })

  // Show dropdown when results arrive
  // ... ~110 lines
}
```

**Estimated effort:** 1 hour

---

**3.4: Extract Pre-Run Command Panel**

**File:** `components/features/network/automation/netmiko/components/pre-run-command-panel.tsx` (new)

Extracts the collapsible pre-run command section (lines 1154-1232).

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Terminal, ChevronDown, ChevronUp, Key } from 'lucide-react'
import { useCredentialsQuery, type Credential } from '@/hooks/queries/use-credentials-query'

interface PreRunCommandPanelProps {
  command: string
  onCommandChange: (command: string) => void
  credentialId: number | null
  onCredentialChange: (id: number | null) => void
}

export function PreRunCommandPanel({
  command,
  onCommandChange,
  credentialId,
  onCredentialChange,
}: PreRunCommandPanelProps) {
  const [isExpanded, setIsExpanded] = useState(!!command)
  const { data: credentials = [] } = useCredentialsQuery({ type: 'ssh' })

  // ... ~80 lines
}
```

**Estimated effort:** 45 minutes

---

**3.5: Extract Template View Dialog**

**File:** `components/features/network/automation/netmiko/dialogs/template-view-dialog.tsx` (new)

Extracts the view template dialog (lines 1484-1588).

```tsx
'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileCode, Globe, Lock, User, Calendar, Edit } from 'lucide-react'
import type { Template } from '../types/templates'

interface TemplateViewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: Template | null
  canEdit: boolean
  onEdit: () => void
}

export function TemplateViewDialog({
  open, onOpenChange, template, canEdit, onEdit
}: TemplateViewDialogProps) {
  // ... ~100 lines
}
```

**Estimated effort:** 30 minutes

---

**Total estimated effort for Phase 3:** 5 hours

---

### Phase 4: Refactor Main Page

**File:** `frontend/src/app/(dashboard)/automation/templates/page.tsx` (refactored)

After phases 1-3, the page becomes a thin orchestrator:

```tsx
'use client'

import { useState, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileCode } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'

// TanStack Query hooks
import { useTemplatesQuery } from '@/hooks/queries/use-templates-queries'
import { useTemplatesMutations } from '@/hooks/queries/use-templates-mutations'

// Feature components
import { TemplateList } from '@/components/features/network/automation/netmiko/components/template-list'
import { TemplateForm } from '@/components/features/network/automation/netmiko/components/template-form'
import { TemplateViewDialog } from '@/components/features/network/automation/netmiko/dialogs/template-view-dialog'
import { HelpAndExamplesContent } from '@/components/features/network/automation/netmiko/components/help-and-examples'

// Shared netmiko components (already exist)
import { TemplateRenderResultDialog } from '@/components/features/network/automation/netmiko/dialogs/template-render-result-dialog'
import { NautobotDataDialog } from '@/components/features/network/automation/netmiko/dialogs/nautobot-data-dialog'

import type { Template } from '@/components/features/network/automation/netmiko/types/templates'

export default function UserTemplatesPage() {
  const user = useAuthStore((state) => state.user)
  const username = user?.username
  const permissions = typeof user?.permissions === 'number' ? user.permissions : 0
  const isAdmin = (permissions & 16) !== 0

  // Data
  const { data: templates = [], isLoading } = useTemplatesQuery({ category: 'netmiko' })
  const { deleteTemplate } = useTemplatesMutations()

  // UI state (minimal)
  const [activeTab, setActiveTab] = useState('list')
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [viewDialogState, setViewDialogState] = useState<{ open: boolean; template: Template | null }>({
    open: false, template: null
  })

  // Handlers
  const handleEdit = useCallback((template: Template) => {
    setEditingTemplate(template)
    setActiveTab('create')
  }, [])

  const handleFormComplete = useCallback(() => {
    setEditingTemplate(null)
    setActiveTab('list')
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <FileCode className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Netmiko Templates</h1>
            <p className="text-gray-600 mt-1">Create and manage your Jinja2 templates for network automation</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="list">My Templates</TabsTrigger>
          <TabsTrigger value="create">{editingTemplate ? 'Edit Template' : 'Create Template'}</TabsTrigger>
          <TabsTrigger value="help">Help & Examples</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <TemplateList
            templates={templates}
            isLoading={isLoading}
            username={username}
            onView={(id) => { /* open view dialog */ }}
            onEdit={handleEdit}
            onDelete={(id) => deleteTemplate.mutate(id)}
          />
        </TabsContent>

        <TabsContent value="create">
          <TemplateForm
            editingTemplate={editingTemplate}
            isAdmin={isAdmin}
            onSubmit={/* ... */}
            onCancel={handleFormComplete}
            isPending={false}
          />
        </TabsContent>

        <TabsContent value="help">
          <HelpAndExamplesContent />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <TemplateViewDialog ... />
      <NautobotDataDialog ... />
      <TemplateRenderResultDialog ... />
    </div>
  )
}
```

**Before:** 1,609 lines
**After:** ~150 lines (main page)
**Reduction:** ~1,460 lines (-91%)

**Estimated effort:** 1.5 hours

---

## Final Directory Structure (After Refactoring)

```
frontend/src/
├── app/(dashboard)/automation/templates/
│   └── page.tsx                            # ~150 lines (was 1,609, -91%)
│
├── hooks/queries/
│   ├── use-templates-queries.ts            # ~70 lines (NEW)
│   ├── use-templates-mutations.ts          # ~100 lines (NEW)
│   ├── use-credentials-query.ts            # ~60 lines (NEW, reusable)
│   └── use-device-search-query.ts          # ~40 lines (NEW)
│
└── components/features/network/automation/netmiko/
    ├── components/
    │   ├── help-and-examples.tsx            # ~485 lines (EXTRACTED, zero logic)
    │   ├── template-list.tsx               # ~120 lines (NEW)
    │   ├── template-form.tsx               # ~280 lines (NEW, react-hook-form + zod)
    │   ├── device-search-panel.tsx          # ~110 lines (NEW)
    │   ├── pre-run-command-panel.tsx        # ~80 lines (NEW)
    │   └── variable-manager-panel.tsx       # (existing, unchanged)
    ├── dialogs/
    │   ├── template-view-dialog.tsx         # ~100 lines (NEW)
    │   ├── template-render-result-dialog.tsx # (existing, unchanged)
    │   └── nautobot-data-dialog.tsx         # (existing, unchanged)
    ├── hooks/
    │   └── use-variable-manager.ts          # (existing, unchanged, 37 lines)
    ├── types/
    │   ├── index.ts                         # (existing, unchanged)
    │   └── templates.ts                     # ~60 lines (NEW)
    └── utils/
        ├── netmiko-utils.ts                 # (existing, unchanged)
        └── template-constants.ts            # ~30 lines (NEW)
```

---

## Summary of Changes

| File | Before | After | Change |
|------|--------|-------|--------|
| `page.tsx` | 1,609 | ~150 | **-1,459 lines (-91%)** |
| New query/mutation hooks | 0 | ~270 | **+270 lines** |
| New components (excl. help) | 0 | ~690 | **+690 lines** |
| Help content (extracted) | 0 | ~485 | **+485 lines (moved, not new)** |
| New types/constants | 0 | ~90 | **+90 lines** |
| **Total (excl. moved help)** | **1,609** | **~1,200** | **-409 lines (-25%)** |
| **Total (incl. moved help)** | **1,609** | **~1,685** | **+76 lines (+5%)** |

Net increase of ~76 lines when counting moved help content, but with significantly better architecture:
- **Every file under 300 lines** (except help content which is pure static documentation)
- Proper TanStack Query compliance (mandatory)
- Uses existing `queryKeys.templates.*` and `queryKeys.credentials.*`
- Form validation with react-hook-form + zod
- Reusable hooks (`useCredentialsQuery`, `useDeviceSearchQuery`)
- Standard `useToast()` instead of custom message system
- Better testability - each component can be tested in isolation

---

## Architecture Compliance (CLAUDE.md)

### Success Metrics

**Code Quality:**
- [ ] Page component < 200 lines
- [ ] All sub-components < 300 lines each
- [ ] No manual `useState` for server data (TanStack Query only)
- [ ] Template form uses react-hook-form + zod
- [ ] No inline arrays/objects in default parameters
- [ ] No `eslint-disable` comments for exhaustive-deps
- [ ] No `confirm()` calls (use AlertDialog)
- [ ] Zero ESLint warnings

**Architecture Compliance:**
- [ ] All data fetching uses TanStack Query
- [ ] Query keys from centralized factory (`queryKeys.templates.*`, `queryKeys.credentials.*`)
- [ ] API calls via `useApi()` hook through proxy pattern
- [ ] Feature-based folder structure (components/, hooks/, types/, utils/)
- [ ] All UI components from Shadcn
- [ ] `useToast()` for all notifications
- [ ] Custom hooks return memoized objects

**User Experience:**
- [ ] Template list cached across tab switches (no refetch)
- [ ] Credentials cached and reused
- [ ] Device search results cached briefly
- [ ] No regression in functionality
- [ ] Improved form validation with field-level errors
- [ ] Faster perceived performance (automatic caching)

**Developer Experience:**
- [ ] Isolated, testable components
- [ ] Clear component boundaries with typed props
- [ ] Reusable query hooks (`useCredentialsQuery` for other features)
- [ ] Type safety throughout (no `field: string` in form handlers)

---

## Anti-Patterns to Avoid

### DO NOT Do These During Refactoring

**1. Don't Keep Manual State for Server Data**
- :x: `const [templates, setTemplates] = useState<Template[]>([])`
- :x: `useEffect(() => { loadTemplates() }, [])`
- :white_check_mark: **Instead:** `const { data: templates = [] } = useTemplatesQuery({ category: 'netmiko' })`

**2. Don't Keep Manual Debounce in useEffect**
- :x: `useEffect(() => { const timer = setTimeout(loadDevices, 300); return () => clearTimeout(timer) }, [searchTerm])`
- :white_check_mark: **Instead:** `useDeviceSearchQuery(searchTerm, { enabled: searchTerm.length >= 3 })`

**3. Don't Use Custom Message State**
- :x: `const [message, setMessage] = useState('')`
- :x: `const showMessage = (msg) => { setMessage(msg); setTimeout(() => setMessage(''), 5000) }`
- :white_check_mark: **Instead:** `const { toast } = useToast()`

**4. Don't Use Untyped Form Handlers**
- :x: `const handleFormChange = (field: string, value: string | boolean) => { ... }`
- :white_check_mark: **Instead:** `form.register('name')` with zod schema validation

**5. Don't Keep Manual Loading States**
- :x: `const [loading, setLoading] = useState(false)`
- :x: `const [isLoadingDevices, setIsLoadingDevices] = useState(false)`
- :x: `const [isRenderingTemplate, setIsRenderingTemplate] = useState(false)`
- :white_check_mark: **Instead:** TanStack Query `isLoading` / mutation `isPending`

**6. Don't Use `confirm()` for Destructive Actions**
- :x: `if (!confirm('Are you sure?')) return`
- :white_check_mark: **Instead:** Shadcn `AlertDialog` component

**7. Don't Suppress ESLint Warnings**
- :x: `// eslint-disable-next-line react-hooks/exhaustive-deps`
- :white_check_mark: **Instead:** Fix the dependency array or restructure the effect

**8. Don't Create Inline Query Keys**
- :x: `queryKey: ['templates', 'list', category]`
- :white_check_mark: **Instead:** `queryKey: queryKeys.templates.list({ category })`

**9. Don't Duplicate Existing Hooks**
- :x: Creating a new `useVariableManager` or `VariableManagerPanel`
- :white_check_mark: **Instead:** Reuse existing ones from `netmiko/hooks/` and `netmiko/components/`

---

## Backend API Reference

The following backend endpoints are used by this page:

| Endpoint | Method | Auth | Used For |
|----------|--------|------|----------|
| `/api/templates?category=netmiko` | GET | `network.templates:read` | List templates |
| `/api/templates/{id}` | GET | `network.templates:read` | Get template detail (for edit/view) |
| `/api/templates` | POST | `network.templates:write` | Create template |
| `/api/templates/{id}` | PUT | `network.templates:write` | Update template |
| `/api/templates/{id}` | DELETE | `network.templates:delete` | Delete template |
| `/api/templates/render` | POST | `network.templates:read` | Render template with variables |
| `/api/credentials?include_expired=false` | GET | `settings.credentials:read` | List SSH credentials |
| `/api/nautobot/devices?filter_type=name__ic&filter_value=...` | GET | `nautobot.devices:read` | Search devices |
| `/api/nautobot/devices/{id}/details` | GET | `nautobot.devices:read` | Get Nautobot device data |

**Backend source files:**
- Templates router: `backend/routers/settings/templates.py`
- Credentials router: `backend/routers/settings/credentials.py`
- Nautobot devices router: `backend/routers/nautobot/devices.py`

---

## Recommended Refactoring Order

1. **Phase 1.3** - Extract help content (15 min, zero risk, -450 lines immediately)
2. **Phase 1.1** - Extract types (15 min, zero risk)
3. **Phase 1.2** - Extract constants (15 min, zero risk)
4. **Quick Win** - Replace `setMessage()` with `useToast()` (30 min, zero risk)
5. **Phase 2.1** - Create templates query hook (1 hour)
6. **Phase 2.3** - Create credentials query hook (30 min)
7. **Phase 2.4** - Create device search query hook (30 min)
8. **Phase 2.2** - Create templates mutation hooks (1.5 hours)
9. **Phase 3.1** - Extract template list component (45 min)
10. **Phase 3.4** - Extract pre-run command panel (45 min)
11. **Phase 3.3** - Extract device search panel (1 hour)
12. **Phase 3.5** - Extract template view dialog (30 min)
13. **Phase 3.2** - Extract template form with react-hook-form + zod (2 hours)
14. **Phase 4** - Refactor main page (1.5 hours)
15. **Testing & Integration** - Verify all functionality (2 hours)

**Total Estimated Effort:** ~12.5 hours

---

## Comparison with Other Refactorings

| Metric | Celery Settings | Check IP | **Automation Templates** |
|--------|-----------------|----------|--------------------------|
| Lines of Code | 693 | 545 | **1,609** |
| useState Hooks | 8 | 9 | **24** |
| Manual API Calls | 4 | 3 | **6** |
| Query Keys Exist? | No (needed) | No (needed) | **Yes (unused!)** |
| Components After | 5 | 4 | **7** |
| Main Component After | ~170 | ~160 | **~150** |
| Code Reduction (main) | -75% | -74% | **-91%** |
| Critical Bug? | Polling risk | Polling bug | **No** |
| Primary Issue | Polling + monolith | Polling + monolith | **Monolith + unused infra** |
| Refactoring Priority | HIGH | HIGH | **HIGH** |

**Unique challenge:** This page has the most `useState` hooks (24) of any component analyzed, and uniquely has query keys already defined but completely unused - making it an especially good candidate for TanStack Query migration since the foundation is already laid.

---

## Notes

- This refactoring is **MANDATORY** to align with CLAUDE.md standards
- **Query keys already exist** - `queryKeys.templates.*` (lines 293-313) and `queryKeys.credentials.*` (lines 219-226) in `lib/query-keys.ts` are ready to use
- **Pattern reference:** `use-saved-inventories-queries.ts` (271 lines) demonstrates the exact CRUD pattern needed
- TanStack Query migration is **mandatory** per architecture requirements
- Form validation with react-hook-form + zod is **mandatory** per standards
- **Reuse existing netmiko components** - `useVariableManager`, `VariableManagerPanel`, `TemplateRenderResultDialog`, `NautobotDataDialog` are already extracted and should not be duplicated
- `useCredentialsQuery` hook should be reusable across features (pre-run commands, network automation, etc.)

---

**Document Version:** 1.0
**Created:** 2026-02-07
**Status:** Planning
**Priority:** High (architecture compliance + 24 useState hooks + unused query keys)
