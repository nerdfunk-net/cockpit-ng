# Refactoring Plan: Automation Templates Page

**Component:** `frontend/src/app/(dashboard)/automation/templates/page.tsx`
**Created:** 2026-02-07
**Status:** Planning
**Lines of Code:** 1,610

## TL;DR - What's Wrong & How to Fix It

**Problems:**
1. :no_entry: **Architecture violation** - Manual `useState`/`useEffect` instead of mandatory TanStack Query
2. :no_entry: **No react-hook-form** - Manual form state with `handleFormChange` and no zod validation
3. :warning: **Manual state management** - 20+ `useState` hooks for server data, loading, UI state
4. :triangular_ruler: **Too large** - 1,610 lines in a single file, should be < 300 per component
5. :repeat: **Duplicate types** - `Template` and `DeviceSearchResult` interfaces already exist in shared locations
6. :repeat: **Duplicate utils** - `variablesToObject`/`objectToVariables` duplicates `prepareVariablesObject` from netmiko utils
7. :warning: **Uses `confirm()`** - Native browser dialog instead of Shadcn AlertDialog (line 954)
8. :warning: **`console.log` in production** - Debug logging left in (lines 620, 934-936)
9. :warning: **`eslint-disable` suppression** - Disabled `react-hooks/exhaustive-deps` (line 599)
10. :warning: **Custom message banner** - Manual `setMessage` state instead of `useToast()`

**Solution:**
1. :white_check_mark: **Migrate to TanStack Query** - Reuse existing `queryKeys.templates.*` + create 3 new query hooks
2. :white_check_mark: **Add mutation hooks** - Create/update/delete/render mutations with cache invalidation
3. :white_check_mark: **Decompose into 9 components** - List, form, help, dialogs, device search, pre-run panel
4. :white_check_mark: **Reuse existing assets** - Netmiko types, utils, shared components already available
5. :white_check_mark: **Replace `confirm()`** - Use Shadcn `AlertDialog` for delete confirmation
6. :white_check_mark: **Replace message banner** - Use `useToast()` from Shadcn UI
7. :white_check_mark: **Feature-based structure** - components/, hooks/, types/, utils/ subdirectories

**Critical Path:** Phase 1 (types/utils) -> Phase 2 (TanStack Query hooks) -> Phase 3 (components) -> Phase 4 (page shell)

**Minimum Viable:** Phases 1-3 establishes proper architecture per CLAUDE.md

---

## Executive Summary

The Automation Templates page is a monolithic 1,610-line file with **critical architecture violations** and significant technical debt:

1. **Architecture Violation** - Uses manual `useState` + `useEffect` for all server data instead of mandatory TanStack Query
2. **No Form Library** - Manual form state management with `handleFormChange` instead of react-hook-form + zod
3. **Massive Monolith** - 1,610 lines with 3 tab contents, 2 helper components, and 3 dialogs all in one file
4. **Type/Utility Duplication** - Redeclares `Template` interface (lines 24-41) that already exists in `settings/templates/types` and `netmiko/types`
5. **Code Smell: Debug Logging** - `console.log` statements left in production code (lines 620, 934-936)
6. **Anti-pattern: `confirm()`** - Uses native browser `confirm()` instead of Shadcn AlertDialog
7. **Anti-pattern: Custom Messages** - Manual `setMessage` + `setTimeout` instead of `useToast()`
8. **Existing Assets Unused** - TanStack Query hooks (`use-template-queries.ts`, `use-template-mutations.ts`) and shared types/utils already exist but are not used

**Bottom Line:** This is the largest monolithic page in the frontend. Most of the infrastructure needed for the refactoring already exists in the codebase - this is primarily a migration to existing patterns, not new development.

## Key Changes Summary

| Current Approach | Required Approach (CLAUDE.md) |
|------------------|-------------------------------|
| Manual `useState` + `useEffect` | **TanStack Query with auto-caching** |
| 20+ separate state hooks | **TanStack Query + react-hook-form states** |
| Manual API calls with try/catch | **useQuery/useMutation hooks** |
| `setMessage()` + `setTimeout()` | **useToast() from Shadcn UI** |
| Single 1,610-line file | **9 focused components < 200 lines each** |
| Manual `handleFormChange()` | **react-hook-form + zod** |
| `confirm()` for delete | **Shadcn AlertDialog** |
| Inline `Template` interface | **Shared types from netmiko/types** |
| `variablesToObject()` inline | **`prepareVariablesObject()` from netmiko-utils** |
| `eslint-disable` suppression | **Proper dependency management** |

## Quick Wins (Can Start Immediately)

These tasks can be done right now without breaking existing functionality:

### 1. Remove `console.log` Statements (5 min)
- Delete debug logging on lines 620, 934-936
- Zero risk, no behavioral changes

### 2. Extract Types to Shared Location (15 min)
- Remove duplicate `Template` interface (lines 24-41)
- Remove duplicate `DeviceSearchResult` interface (lines 44-49)
- Import from existing `netmiko/types` + extend as needed
- No behavioral changes

### 3. Replace `variablesToObject()` (10 min)
- Replace inline `variablesToObject()` (lines 813-821) with `prepareVariablesObject()` from `netmiko/utils/netmiko-utils.ts`
- Same logic, already exists

### 4. Replace `confirm()` with AlertDialog (20 min)
- Replace `confirm()` on line 954 with Shadcn `AlertDialog`
- Improves UX consistency

### 5. Replace Message Banner with Toast (15 min)
- Replace `showMessage()` (lines 628-631) with `useToast()`
- Remove `message` state and the banner JSX (lines 1006-1014)

**Total:** ~1 hour
**Risk:** Zero (no behavioral changes beyond UX improvements)
**Benefit:** Immediate code quality improvement, removes anti-patterns

---

## Current Architecture

```
frontend/src/app/(dashboard)/automation/templates/
└── page.tsx       # 1,610 lines - Everything in one file
```

**Line-by-Line Breakdown:**

| Lines | Content | Size |
|-------|---------|------|
| 1-23 | Imports (React, UI, hooks, icons, netmiko components) | 23 |
| 24-49 | `Template` + `DeviceSearchResult` interfaces (DUPLICATE) | 26 |
| 52-86 | `CodeExample` component (copy-to-clipboard code block) | 35 |
| 89-540 | `HelpAndExamplesContent` component (Jinja2 documentation) | 452 |
| 542-605 | `UserTemplatesContent` - State declarations (20+ useState) | 63 |
| 596-600 | `useEffect` with eslint-disable for initial load | 5 |
| 602-658 | Data loading functions (`loadTemplates`, `loadCredentials`, `resetForm`) | 57 |
| 660-698 | Device search with debounced `useEffect` | 39 |
| 700-719 | Nautobot data fetching handlers | 20 |
| 721-810 | Template rendering handler (complex error parsing) | 90 |
| 813-833 | Variable conversion utilities (DUPLICATE) | 21 |
| 835-877 | Create template handler | 43 |
| 879-913 | Update template handler | 35 |
| 915-951 | Edit template loader (populates form from API) | 37 |
| 953-967 | Delete template handler (uses `confirm()`) | 15 |
| 969-978 | View template handler | 10 |
| 980-988 | Permission check + filtering | 9 |
| 990-1116 | List tab JSX (search, template cards) | 127 |
| 1117-1476 | Create/Edit tab JSX (form, variables, device selection) | 360 |
| 1478-1481 | Help tab JSX (renders HelpAndExamplesContent) | 4 |
| 1484-1603 | Dialogs JSX (View, Nautobot Data, Render Result) | 120 |
| 1607-1609 | Page export wrapper | 3 |

**Total:** 1,610 lines with heavily mixed concerns

---

## Problem Analysis

### Problem 1: Architecture Violation - No TanStack Query

**Affected Lines:** 550-554, 596-626, 660-692

**Current Pattern (WRONG):**
```tsx
// Lines 550-554: Manual state for server data
const [templates, setTemplates] = useState<Template[]>([])
const [loading, setLoading] = useState(false)
const [storedCredentials, setStoredCredentials] = useState<Array<...>>([])

// Lines 596-600: Manual data loading with eslint-disable
useEffect(() => {
  loadTemplates()
  loadCredentials()
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [])

// Lines 602-613: Manual fetch function
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

**Why this is wrong:**
- CLAUDE.md **mandates** TanStack Query for all data fetching
- No caching - every tab switch re-fetches
- Manual loading state management (TanStack Query provides this)
- `eslint-disable` hides a legitimate dependency issue
- Existing `useTemplates()` hook already exists in `settings/templates/hooks/use-template-queries.ts`

### Problem 2: No react-hook-form + zod Validation

**Affected Lines:** 560-566, 633-635

**Current Pattern (WRONG):**
```tsx
// Lines 560-566: Manual form state
const [formData, setFormData] = useState({
  name: '',
  description: '',
  content: '',
  scope: (isAdmin ? 'global' : 'private') as 'global' | 'private',
  execution_mode: 'run_on_device' as 'run_on_device' | 'write_to_file' | 'sync_to_nautobot'
})

// Lines 633-635: Generic change handler - no validation
const handleFormChange = (field: string, value: string | boolean) => {
  setFormData(prev => ({ ...prev, [field]: value }))
}
```

**Why this is wrong:**
- No field-level validation
- No type safety in `handleFormChange` (accepts any `field` string)
- CLAUDE.md mandates react-hook-form + zod for all forms
- Required fields (`name`, `content`) only validated on submit, not inline

### Problem 3: Manual State Explosion (20+ useState)

**Affected Lines:** 549-594

```tsx
// Server data
const [templates, setTemplates] = useState<Template[]>([])        // Line 550
const [loading, setLoading] = useState(false)                      // Line 552
const [storedCredentials, setStoredCredentials] = useState(...)    // Line 590

// UI state
const [searchTerm, setSearchTerm] = useState('')                   // Line 551
const [activeTab, setActiveTab] = useState('list')                 // Line 553
const [editingTemplate, setEditingTemplate] = useState(null)       // Line 554
const [message, setMessage] = useState('')                         // Line 555
const [viewingTemplate, setViewingTemplate] = useState(null)       // Line 556
const [showViewDialog, setShowViewDialog] = useState(false)        // Line 557

// Form state
const [formData, setFormData] = useState({...})                    // Line 560
const [preRunCommand, setPreRunCommand] = useState('')             // Line 588
const [selectedCredentialId, setSelectedCredentialId] = useState() // Line 589
const [isPreRunPanelExpanded, setIsPreRunPanelExpanded] = useState // Line 591
const [filePath, setFilePath] = useState(...)                      // Line 594

// Device search state
const [deviceSearchTerm, setDeviceSearchTerm] = useState('')       // Line 572
const [devices, setDevices] = useState([])                         // Line 573
const [isLoadingDevices, setIsLoadingDevices] = useState(false)    // Line 574
const [showDeviceDropdown, setShowDeviceDropdown] = useState(false)// Line 575
const [selectedDevice, setSelectedDevice] = useState(null)         // Line 576

// Dialog state
const [showNautobotDataDialog, setShowNautobotDataDialog] = useState// Line 579
const [nautobotData, setNautobotData] = useState(null)              // Line 580
const [isRenderingTemplate, setIsRenderingTemplate] = useState      // Line 583
const [showRenderResultDialog, setShowRenderResultDialog] = useState// Line 584
const [renderResult, setRenderResult] = useState(null)              // Line 585
```

**Why this is wrong:**
- Server data states (`templates`, `loading`, `storedCredentials`) should be TanStack Query
- Device search should be a separate hook
- Dialog state should be in respective dialog components
- Form state should be react-hook-form

### Problem 4: Duplicate Types

**Affected Lines:** 24-49

```tsx
// Lines 24-41: DUPLICATE of netmiko/types/index.ts Template interface
interface Template {
  id: number
  name: string
  description: string
  content: string
  scope: 'global' | 'private'
  // ... more fields
}

// Lines 44-49: Inline interface - should be shared
interface DeviceSearchResult {
  id: string
  name: string
  primary_ip4?: { address: string } | string
  location?: { name: string }
}
```

**Existing locations:**
- `netmiko/types/index.ts` - `Template` interface (lines 22-33)
- `settings/templates/types/index.ts` - `Template` interface (lines 2-17)

### Problem 5: Duplicate Utility Functions

**Affected Lines:** 813-833

```tsx
// Lines 813-821: DUPLICATE of prepareVariablesObject from netmiko-utils.ts
const variablesToObject = (): Record<string, string> => {
  const varsObject: Record<string, string> = {}
  variableManager.variables.forEach(v => {
    if (v.name && variableManager.validateVariableName(v.name)) {
      varsObject[v.name] = v.value
    }
  })
  return varsObject
}
```

**Already exists:** `netmiko/utils/netmiko-utils.ts` line 16-26 as `prepareVariablesObject()`

### Problem 6: Uses `confirm()` Instead of AlertDialog

**Affected Line:** 954

```tsx
// Line 954: Native browser dialog - violates CLAUDE.md UI standards
const handleDeleteTemplate = async (templateId: number) => {
  if (!confirm('Are you sure you want to delete this template?')) return
  // ...
}
```

**CLAUDE.md says:** "Never use `alert()` or `confirm()` (use Dialog/AlertDialog)"

### Problem 7: `console.log` in Production Code

**Affected Lines:** 620, 934-936

```tsx
// Line 620: Debug logging left in production
console.log('Loaded SSH credentials:', sshCredentials.map(c => ({ id: c.id, name: c.name })))

// Lines 934-936: Debug logging left in production
console.log('Loading credential_id from template:', response.credential_id, 'Type:', typeof response.credential_id)
setSelectedCredentialId(response.credential_id || null)
console.log('Set selectedCredentialId to:', response.credential_id || null)
```

### Problem 8: `eslint-disable` Suppression

**Affected Lines:** 599-600

```tsx
useEffect(() => {
  loadTemplates()
  loadCredentials()
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
```

**Why this is wrong:**
- Hides a real dependency issue
- `loadTemplates` and `loadCredentials` depend on `apiCall` which can change
- TanStack Query eliminates this entirely

---

## Existing Reusable Assets

### 1. Query Keys (Already Exist)

**File:** `/frontend/src/lib/query-keys.ts` (lines 292-313)

```typescript
templates: {
  all: ['templates'] as const,
  list: (filters?) => [...queryKeys.templates.all, 'list', filters] as const,
  detail: (id: number) => [...queryKeys.templates.all, 'detail', id] as const,
  content: (id: number) => [...queryKeys.templates.all, 'content', id] as const,
  categories: () => [...queryKeys.templates.all, 'categories'] as const,
  importable: () => [...queryKeys.templates.all, 'importable'] as const,
}
```

These keys can be reused directly. A new `render` key may be needed for template rendering.

### 2. TanStack Query Hooks (Already Exist)

**File:** `settings/templates/hooks/use-template-queries.ts`
- `useTemplates(options)` - Fetches templates with client-side filtering
- `useTemplateCategories(options)` - Fetches categories
- `useTemplateContent(templateId, options)` - Fetches template content

**File:** `settings/templates/hooks/use-template-mutations.ts`
- `createTemplate` - Creates templates (supports git, file, webeditor sources)
- `updateTemplate` - Updates templates
- `deleteTemplate` - Deletes templates with cache invalidation
- All include toast notifications on success/error

### 3. Netmiko Shared Components (Already Imported)

**Already imported by page.tsx:**
- `useVariableManager` - Variable CRUD with validation (`netmiko/hooks/use-variable-manager.ts`)
- `VariableManagerPanel` - Variable editor UI (`netmiko/components/variable-manager-panel.tsx`)
- `TemplateRenderResultDialog` - Render results display (`netmiko/dialogs/template-render-result-dialog.tsx`)
- `NautobotDataDialog` - Device data viewer (`netmiko/dialogs/nautobot-data-dialog.tsx`)

### 4. Netmiko Types (Already Exist)

**File:** `netmiko/types/index.ts`
- `Template` - Template interface with `execution_mode`, `file_path`, `credential_id`, `pre_run_command`
- `TemplateVariable` - `{ id, name, value }`
- `StoredCredential` - `{ id, name, username, type }`

### 5. Netmiko Utilities (Already Exist)

**File:** `netmiko/utils/netmiko-utils.ts`
- `validateVariableName()` - Validates Jinja2 variable names
- `prepareVariablesObject()` - Converts variable array to API object
- `parseTemplateError()` - Extracts useful error info from rendering failures

### 6. Settings Templates Constants (Already Exist)

**File:** `settings/templates/utils/constants.ts`
- `STALE_TIME` - Cache timing constants
- `EMPTY_TEMPLATES`, `EMPTY_CATEGORIES` - Default empty arrays
- `TEMPLATE_TYPES`, `TEMPLATE_SCOPES`, `CANONICAL_CATEGORIES`

---

## Target Directory Structure

```
frontend/src/components/features/network/automation/templates/
├── components/
│   ├── template-list.tsx              # ~120 lines - Search + template cards
│   ├── template-form.tsx              # ~200 lines - Create/edit form (react-hook-form)
│   ├── device-search.tsx              # ~100 lines - Device search with debounce
│   ├── pre-run-panel.tsx              # ~80 lines  - Collapsible pre-run command
│   ├── file-path-input.tsx            # ~50 lines  - File path with variables help
│   ├── code-example.tsx               # ~35 lines  - Code block with copy (extracted)
│   └── help-and-examples.tsx          # ~450 lines - Jinja2 documentation (extracted as-is)
├── dialogs/
│   ├── view-template-dialog.tsx       # ~100 lines - View template details
│   └── delete-confirm-dialog.tsx      # ~40 lines  - AlertDialog for delete confirmation
├── hooks/
│   ├── use-netmiko-templates-query.ts # ~50 lines  - Templates list filtered by category=netmiko
│   ├── use-credentials-query.ts       # ~30 lines  - SSH credentials query
│   ├── use-device-search.ts           # ~50 lines  - Debounced device search hook
│   ├── use-template-form.ts           # ~60 lines  - react-hook-form + zod schema
│   └── use-template-render.ts         # ~80 lines  - Template rendering mutation
├── types/
│   └── index.ts                       # ~30 lines  - Page-specific types (extend shared)
├── utils/
│   └── constants.ts                   # ~20 lines  - Default form values, stale times
└── templates-page.tsx                 # ~60 lines  - Page shell with tabs
```

**Total:** ~17 files, ~1,355 lines across all files

---

## Implementation Phases

### Phase 1: Types, Constants, Utils (30 min, zero risk)

**Step 1.1: Create Types**

**File:** `types/index.ts`

```typescript
// Re-export shared types
export type { TemplateVariable, StoredCredential } from '../../netmiko/types'

// Extend shared Template with page-specific fields
import type { Template as BaseTemplate } from '../../netmiko/types'

export interface AutomationTemplate extends BaseTemplate {
  description: string
  variables?: Record<string, string>
  use_nautobot_context?: boolean
  template_type: string
  source: string
  updated_at: string
  created_by?: string
}

// Device search result for Nautobot device picker
export interface DeviceSearchResult {
  id: string
  name: string
  primary_ip4?: { address: string } | string
  location?: { name: string }
}

// Form data for create/edit
export interface TemplateFormValues {
  name: string
  description: string
  content: string
  scope: 'global' | 'private'
  execution_mode: 'run_on_device' | 'write_to_file' | 'sync_to_nautobot'
}
```

**Step 1.2: Create Constants**

**File:** `utils/constants.ts`

```typescript
import type { TemplateFormValues } from '../types'

export const DEFAULT_FORM_VALUES: TemplateFormValues = {
  name: '',
  description: '',
  content: '',
  scope: 'global',
  execution_mode: 'run_on_device',
} as const

export const DEFAULT_FILE_PATH = 'templates/{device_name}-{template_name}.txt'

export const DEVICE_SEARCH_MIN_CHARS = 3
export const DEVICE_SEARCH_DEBOUNCE_MS = 300

export const STALE_TIME = {
  TEMPLATES: 30 * 1000,     // 30 seconds
  CREDENTIALS: 5 * 60 * 1000, // 5 minutes - rarely changes
} as const
```

**Estimated effort:** 30 minutes

---

### Phase 2: TanStack Query Hooks (2 hours)

**Step 2.1: Netmiko Templates Query Hook**

**File:** `hooks/use-netmiko-templates-query.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useMemo } from 'react'
import type { AutomationTemplate } from '../types'
import { STALE_TIME } from '../utils/constants'

const EMPTY_TEMPLATES: AutomationTemplate[] = []

interface UseNetmikoTemplatesOptions {
  search?: string
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseNetmikoTemplatesOptions = {}

export function useNetmikoTemplatesQuery(
  options: UseNetmikoTemplatesOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { search, enabled = true } = options

  const query = useQuery({
    queryKey: queryKeys.templates.list({ category: 'netmiko', search }),
    queryFn: async () => {
      const response = await apiCall<{ templates: AutomationTemplate[] }>(
        'templates?category=netmiko'
      )
      return response.templates || EMPTY_TEMPLATES
    },
    enabled,
    staleTime: STALE_TIME.TEMPLATES,
  })

  // Client-side search filtering
  const filteredTemplates = useMemo(() => {
    if (!query.data) return EMPTY_TEMPLATES
    if (!search) return query.data
    const term = search.toLowerCase()
    return query.data.filter(
      (t) =>
        t.name.toLowerCase().includes(term) ||
        t.description?.toLowerCase().includes(term)
    )
  }, [query.data, search])

  return useMemo(
    () => ({
      ...query,
      templates: filteredTemplates,
      allTemplates: query.data || EMPTY_TEMPLATES,
    }),
    [query, filteredTemplates]
  )
}
```

**Step 2.2: SSH Credentials Query Hook**

**File:** `hooks/use-credentials-query.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { StoredCredential } from '../types'
import { STALE_TIME } from '../utils/constants'

const EMPTY_CREDENTIALS: StoredCredential[] = []

export function useSSHCredentialsQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: [...queryKeys.templates.all, 'ssh-credentials'],
    queryFn: async () => {
      const response = await apiCall<StoredCredential[]>(
        'credentials?include_expired=false'
      )
      return (response || []).filter((cred) => cred.type === 'ssh')
    },
    staleTime: STALE_TIME.CREDENTIALS,
  })
}
```

**Step 2.3: Device Search Hook**

**File:** `hooks/use-device-search.ts`

```typescript
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import type { DeviceSearchResult } from '../types'
import { DEVICE_SEARCH_MIN_CHARS, DEVICE_SEARCH_DEBOUNCE_MS } from '../utils/constants'

const EMPTY_DEVICES: DeviceSearchResult[] = []

export function useDeviceSearch() {
  const { apiCall } = useApi()
  const [searchTerm, setSearchTerm] = useState('')
  const [devices, setDevices] = useState<DeviceSearchResult[]>(EMPTY_DEVICES)
  const [isLoading, setIsLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<DeviceSearchResult | null>(null)

  useEffect(() => {
    if (searchTerm.length < DEVICE_SEARCH_MIN_CHARS || selectedDevice) {
      setDevices(EMPTY_DEVICES)
      setShowDropdown(false)
      return
    }

    setIsLoading(true)
    const timer = setTimeout(async () => {
      try {
        const response = await apiCall<{ devices: DeviceSearchResult[] }>(
          `nautobot/devices?filter_type=name__ic&filter_value=${encodeURIComponent(searchTerm)}`
        )
        setDevices(response.devices || EMPTY_DEVICES)
        setShowDropdown(true)
      } catch {
        setDevices(EMPTY_DEVICES)
      } finally {
        setIsLoading(false)
      }
    }, DEVICE_SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [searchTerm, apiCall, selectedDevice])

  const selectDevice = useCallback((device: DeviceSearchResult) => {
    setSelectedDevice(device)
    setSearchTerm(device.name)
    setShowDropdown(false)
  }, [])

  const clearDevice = useCallback(() => {
    setSelectedDevice(null)
    setSearchTerm('')
  }, [])

  return useMemo(() => ({
    searchTerm,
    setSearchTerm,
    devices,
    isLoading,
    showDropdown,
    selectedDevice,
    selectDevice,
    clearDevice,
  }), [searchTerm, devices, isLoading, showDropdown, selectedDevice, selectDevice, clearDevice])
}
```

**Step 2.4: Template Form Hook (react-hook-form + zod)**

**File:** `hooks/use-template-form.ts`

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCallback, useMemo } from 'react'
import { DEFAULT_FORM_VALUES } from '../utils/constants'

const templateFormSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(100),
  description: z.string().max(500).optional().default(''),
  content: z.string().min(1, 'Template content is required'),
  scope: z.enum(['global', 'private']),
  execution_mode: z.enum(['run_on_device', 'write_to_file', 'sync_to_nautobot']),
})

export type TemplateFormValues = z.infer<typeof templateFormSchema>

export function useTemplateForm(isAdmin: boolean) {
  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      ...DEFAULT_FORM_VALUES,
      scope: isAdmin ? 'global' : 'private',
    },
  })

  const resetForm = useCallback(() => {
    form.reset({
      ...DEFAULT_FORM_VALUES,
      scope: isAdmin ? 'global' : 'private',
    })
  }, [form, isAdmin])

  return useMemo(() => ({ form, resetForm }), [form, resetForm])
}
```

**Step 2.5: Template Render Mutation Hook**

**File:** `hooks/use-template-render.ts`

```typescript
import { useMutation } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { useMemo } from 'react'
import type { TemplateRenderResult } from '../../netmiko/dialogs/template-render-result-dialog'

interface RenderTemplateInput {
  template_content: string
  device_id: string
  user_variables: Record<string, string>
  use_nautobot_context: boolean
  pre_run_command?: string
  credential_id?: number | null
}

interface RenderResponse {
  rendered_content: string
  variables_used: string[]
  context_data?: Record<string, unknown>
  warnings?: string[]
  pre_run_output?: string
  pre_run_parsed?: Array<Record<string, unknown>>
}

export function useTemplateRenderMutation() {
  const { apiCall } = useApi()

  const renderTemplate = useMutation({
    mutationFn: async (input: RenderTemplateInput): Promise<TemplateRenderResult> => {
      try {
        const response = await apiCall<RenderResponse>('templates/render', {
          method: 'POST',
          body: {
            ...input,
            category: 'netmiko',
          },
        })

        return {
          success: true,
          rendered_content: response.rendered_content,
          variables_used: response.variables_used,
          context_data: response.context_data,
          warnings: response.warnings,
        }
      } catch (error: unknown) {
        let errorMessage = 'Unknown error'
        let errorDetails: string[] = []

        if (error && typeof error === 'object') {
          if ('message' in error && typeof error.message === 'string') {
            errorMessage = error.message
          } else if ('detail' in error && typeof error.detail === 'string') {
            errorMessage = error.detail
          }
          if ('details' in error && Array.isArray(error.details)) {
            errorDetails = error.details
          }
        }

        return {
          success: false,
          error_title: 'Template Rendering Failed',
          error_message: errorMessage,
          error_details: errorDetails.length > 0 ? errorDetails : undefined,
          context_data: {
            user_variables: input.user_variables,
            use_nautobot_context: input.use_nautobot_context,
            device_id: input.device_id,
          },
        }
      }
    },
  })

  return useMemo(() => ({ renderTemplate }), [renderTemplate])
}
```

**Estimated effort:** 2 hours

---

### Phase 3: UI Components (3-4 hours)

**Step 3.1: Extract CodeExample Component**

**File:** `components/code-example.tsx`

Extract lines 52-86 as-is. This is a self-contained presentational component.

```typescript
// ~35 lines - exact copy from lines 52-86
// No changes needed, just file extraction
```

**Step 3.2: Extract HelpAndExamplesContent**

**File:** `components/help-and-examples.tsx`

Extract lines 89-540 as-is. This is a pure presentational component with no state dependencies.

```typescript
// ~450 lines - exact copy from lines 89-540
// Import CodeExample from ./code-example
// No other changes needed
```

**Step 3.3: Create Template List Component**

**File:** `components/template-list.tsx`

```typescript
'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { FileCode, Search, RefreshCw, Eye, Edit, Trash2 } from 'lucide-react'
import { useNetmikoTemplatesQuery } from '../hooks/use-netmiko-templates-query'
import { DeleteConfirmDialog } from '../dialogs/delete-confirm-dialog'
import type { AutomationTemplate } from '../types'

interface TemplateListProps {
  username?: string
  onView: (templateId: number) => void
  onEdit: (template: AutomationTemplate) => void
  onDelete: (templateId: number) => Promise<void>
}

export function TemplateList({ username, onView, onEdit, onDelete }: TemplateListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const { templates, isLoading } = useNetmikoTemplatesQuery({ search: searchTerm })

  const canEdit = (template: AutomationTemplate) => template.created_by === username

  // ~80 lines of JSX: search input + template card list + delete dialog
  // Uses AlertDialog instead of confirm()
}
```

**Step 3.4: Create Device Search Component**

**File:** `components/device-search.tsx`

Extract lines 1323-1433 into a self-contained component that uses `useDeviceSearch()` hook.

```typescript
interface DeviceSearchProps {
  selectedDevice: DeviceSearchResult | null
  onShowNautobotData: () => void
  onRenderTemplate: () => void
  isRendering: boolean
  canRender: boolean
  // Device search hook is used internally
}
```

**Step 3.5: Create Pre-Run Panel Component**

**File:** `components/pre-run-panel.tsx`

Extract lines 1155-1232 into a collapsible panel component.

```typescript
interface PreRunPanelProps {
  command: string
  onCommandChange: (value: string) => void
  credentialId: number | null
  onCredentialChange: (id: number | null) => void
  credentials: StoredCredential[]
}
```

**Step 3.6: Create File Path Input Component**

**File:** `components/file-path-input.tsx`

Extract lines 1256-1293 into a component with variable documentation.

**Step 3.7: Create Template Form Component**

**File:** `components/template-form.tsx`

Combines the create/edit tab content (lines 1119-1476) using react-hook-form.

```typescript
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { useVariableManager } from '../../netmiko/hooks/use-variable-manager'
import { VariableManagerPanel } from '../../netmiko/components/variable-manager-panel'
import { prepareVariablesObject } from '../../netmiko/utils/netmiko-utils'
import { DeviceSearch } from './device-search'
import { PreRunPanel } from './pre-run-panel'
import { FilePathInput } from './file-path-input'
import type { AutomationTemplate } from '../types'

interface TemplateFormProps {
  editingTemplate: AutomationTemplate | null
  isAdmin: boolean
  onSave: () => void
  onCancel: () => void
}

export function TemplateForm({ editingTemplate, isAdmin, onSave, onCancel }: TemplateFormProps) {
  // Uses react-hook-form + zod
  // Composes DeviceSearch, PreRunPanel, VariableManagerPanel, FilePathInput
  // ~200 lines
}
```

**Step 3.8: Create View Template Dialog**

**File:** `dialogs/view-template-dialog.tsx`

Extract lines 1484-1588 into a standalone dialog component.

```typescript
interface ViewTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: AutomationTemplate | null
  canEdit: boolean
  onEdit: () => void
}
```

**Step 3.9: Create Delete Confirm Dialog**

**File:** `dialogs/delete-confirm-dialog.tsx`

Replace `confirm()` with Shadcn AlertDialog.

```typescript
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

interface DeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  templateName?: string
}

export function DeleteConfirmDialog({
  open, onOpenChange, onConfirm, templateName
}: DeleteConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Template</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete {templateName ? `"${templateName}"` : 'this template'}?
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-red-600 hover:bg-red-700">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

**Estimated effort:** 3-4 hours

---

### Phase 4: Page Shell Rewrite (~60 lines)

**File:** `templates-page.tsx`

```typescript
'use client'

import { useState, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileCode } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { TemplateList } from './components/template-list'
import { TemplateForm } from './components/template-form'
import { HelpAndExamplesContent } from './components/help-and-examples'
import { ViewTemplateDialog } from './dialogs/view-template-dialog'
import { NautobotDataDialog } from '../netmiko/dialogs/nautobot-data-dialog'
import { TemplateRenderResultDialog } from '../netmiko/dialogs/template-render-result-dialog'
import type { AutomationTemplate } from './types'

export function TemplatesPage() {
  const user = useAuthStore((state) => state.user)
  const username = user?.username
  const permissions = typeof user?.permissions === 'number' ? user.permissions : 0
  const isAdmin = (permissions & 16) !== 0

  const [activeTab, setActiveTab] = useState('list')
  const [editingTemplate, setEditingTemplate] = useState<AutomationTemplate | null>(null)

  // Dialog state
  const [viewTemplate, setViewTemplate] = useState<AutomationTemplate | null>(null)

  const handleEdit = useCallback((template: AutomationTemplate) => {
    setEditingTemplate(template)
    setActiveTab('create')
  }, [])

  const handleSaved = useCallback(() => {
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
            <p className="text-gray-600 mt-1">
              Create and manage your Jinja2 templates for network automation
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="list">My Templates</TabsTrigger>
          <TabsTrigger value="create">
            {editingTemplate ? 'Edit Template' : 'Create Template'}
          </TabsTrigger>
          <TabsTrigger value="help">Help & Examples</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <TemplateList
            username={username}
            onView={(id) => {/* fetch and show dialog */}}
            onEdit={handleEdit}
            onDelete={async (id) => {/* delete mutation */}}
          />
        </TabsContent>

        <TabsContent value="create">
          <TemplateForm
            editingTemplate={editingTemplate}
            isAdmin={isAdmin}
            onSave={handleSaved}
            onCancel={() => { setEditingTemplate(null); setActiveTab('list') }}
          />
        </TabsContent>

        <TabsContent value="help">
          <HelpAndExamplesContent />
        </TabsContent>
      </Tabs>

      {/* Dialogs rendered at page level */}
      <ViewTemplateDialog
        open={!!viewTemplate}
        onOpenChange={(open) => !open && setViewTemplate(null)}
        template={viewTemplate}
        canEdit={viewTemplate?.created_by === username}
        onEdit={() => viewTemplate && handleEdit(viewTemplate)}
      />
    </div>
  )
}
```

Then update the route page:

**File:** `frontend/src/app/(dashboard)/automation/templates/page.tsx`

```typescript
import { TemplatesPage } from '@/components/features/network/automation/templates/templates-page'

export default function UserTemplatesPage() {
  return <TemplatesPage />
}
```

**Before:** 1,610 lines (single file)
**After:** ~60 lines (page shell) + ~5 lines (route page)
**Reduction:** ~1,545 lines (-96% in main file)

**Estimated effort:** 1 hour

---

### Phase 5: Cleanup & Verification (1 hour)

1. **Remove all `console.log` statements** - Lines 620, 774, 934-936
2. **Remove all `eslint-disable` comments** - Line 599
3. **Remove `confirm()` usage** - Line 954 (replaced by AlertDialog)
4. **Remove `showMessage()` pattern** - Lines 628-631 (replaced by `useToast()`)
5. **Verify no broken imports** - Ensure all netmiko shared imports resolve
6. **Run TypeScript compiler** - `npx tsc --noEmit`
7. **Run ESLint** - `npx eslint src/components/features/network/automation/templates/`
8. **Verify functionality** - Test all 3 tabs, CRUD operations, device search, template rendering

**Estimated effort:** 1 hour

---

## Summary of Changes

| File | Before | After | Change |
|------|--------|-------|--------|
| `page.tsx` (route) | 1,610 | ~5 | **-1,605 lines** |
| `templates-page.tsx` (shell) | 0 | ~60 | +60 lines |
| `components/` (7 files) | 0 | ~1,035 | +1,035 lines |
| `dialogs/` (2 files) | 0 | ~140 | +140 lines |
| `hooks/` (5 files) | 0 | ~270 | +270 lines |
| `types/index.ts` | 0 | ~30 | +30 lines |
| `utils/constants.ts` | 0 | ~20 | +20 lines |
| **Total** | **1,610** | **~1,560** | **-50 lines (-3%)** |

**Key metrics:**
- Largest single file: `help-and-examples.tsx` at ~450 lines (pure documentation, no logic)
- Largest logic file: `template-form.tsx` at ~200 lines
- Page shell: ~60 lines (96% reduction)
- New reusable hooks: 5
- New reusable components: 9
- Code duplication eliminated: ~50 lines (duplicate types + utils)
- Anti-patterns fixed: 5 (`confirm()`, `console.log`, `eslint-disable`, manual messages, manual state)

---

## Success Metrics

### Code Quality
- [ ] No component exceeds 300 lines (except help documentation)
- [ ] No duplicate type definitions
- [ ] No duplicate utility functions
- [ ] No manual `useState` for server data (TanStack Query only)
- [ ] Form uses react-hook-form + zod
- [ ] No `confirm()` or `alert()` calls
- [ ] No `console.log` in production code
- [ ] No `eslint-disable` comments
- [ ] Zero ESLint warnings

### Architecture Compliance (CLAUDE.md)
- [ ] All data fetching uses TanStack Query
- [ ] Query keys use centralized factory (`queryKeys.templates.*`)
- [ ] API calls via proxy pattern (`/api/proxy/*`)
- [ ] Feature-based folder structure (components/, hooks/, types/, utils/)
- [ ] All UI components from Shadcn
- [ ] Toast notifications via `useToast()`
- [ ] Delete confirmation via AlertDialog
- [ ] Memoized hook return values

### User Experience
- [ ] No regression in functionality (list, create, edit, delete, render, help)
- [ ] Improved loading states (TanStack Query built-in)
- [ ] Better form validation (inline errors with zod)
- [ ] Consistent delete confirmation (AlertDialog vs native confirm)
- [ ] Toast notifications instead of banner messages
- [ ] Faster navigation (cached data persists across tab switches)

### Developer Experience
- [ ] Clear component boundaries
- [ ] Reusable hooks (device search, credentials query)
- [ ] Type safety throughout
- [ ] Easy to test (isolated hooks and components)
- [ ] No stale closure risks

---

## Anti-Patterns to Avoid

### 1. Don't Keep Manual State for Server Data
- :x: `const [templates, setTemplates] = useState<Template[]>([])`
- :x: `useEffect(() => { loadTemplates() }, [])`
- :white_check_mark: `const { templates, isLoading } = useNetmikoTemplatesQuery()`

### 2. Don't Keep Manual Form State
- :x: `const [formData, setFormData] = useState({...})`
- :x: `const handleFormChange = (field, value) => setFormData(prev => ({...prev, [field]: value}))`
- :white_check_mark: `const form = useForm<TemplateFormValues>({ resolver: zodResolver(schema) })`

### 3. Don't Use Custom Message State
- :x: `const [message, setMessage] = useState('')`
- :x: `setTimeout(() => setMessage(''), 5000)`
- :white_check_mark: `const { toast } = useToast()`

### 4. Don't Use Native Browser Dialogs
- :x: `if (!confirm('Are you sure?')) return`
- :white_check_mark: `<AlertDialog>` from Shadcn UI

### 5. Don't Leave Debug Logging
- :x: `console.log('Loaded SSH credentials:', ...)`
- :x: `console.log('Loading credential_id from template:', ...)`
- :white_check_mark: Remove entirely or use proper logging

### 6. Don't Suppress ESLint Rules
- :x: `// eslint-disable-next-line react-hooks/exhaustive-deps`
- :white_check_mark: Fix the dependency issue (TanStack Query eliminates it)

### 7. Don't Duplicate Types Across Files
- :x: Defining `Template` interface inline when it exists in shared types
- :white_check_mark: Import from shared location, extend if needed

---

## Recommended Implementation Order

| Step | Task | Effort | Risk | Benefit |
|------|------|--------|------|---------|
| 1 | Remove `console.log` statements | 5 min | Zero | Clean code |
| 2 | Create `types/index.ts` | 15 min | Zero | Type deduplication |
| 3 | Create `utils/constants.ts` | 10 min | Zero | Default value extraction |
| 4 | Replace `variablesToObject` with shared util | 10 min | Zero | Code deduplication |
| 5 | Create `hooks/use-netmiko-templates-query.ts` | 30 min | Low | TanStack Query compliance |
| 6 | Create `hooks/use-credentials-query.ts` | 15 min | Low | TanStack Query compliance |
| 7 | Create `hooks/use-device-search.ts` | 30 min | Low | Encapsulates device search |
| 8 | Create `hooks/use-template-form.ts` | 20 min | Low | react-hook-form compliance |
| 9 | Create `hooks/use-template-render.ts` | 30 min | Low | Mutation hook |
| 10 | Extract `components/code-example.tsx` | 10 min | Zero | Pure extraction |
| 11 | Extract `components/help-and-examples.tsx` | 15 min | Zero | Pure extraction |
| 12 | Create `dialogs/delete-confirm-dialog.tsx` | 20 min | Zero | Replaces confirm() |
| 13 | Create `dialogs/view-template-dialog.tsx` | 30 min | Low | Dialog extraction |
| 14 | Create `components/pre-run-panel.tsx` | 30 min | Low | Panel extraction |
| 15 | Create `components/file-path-input.tsx` | 20 min | Low | Input extraction |
| 16 | Create `components/device-search.tsx` | 45 min | Medium | Composes useDeviceSearch |
| 17 | Create `components/template-form.tsx` | 60 min | Medium | Main form component |
| 18 | Create `components/template-list.tsx` | 45 min | Medium | List with search |
| 19 | Create `templates-page.tsx` (shell) | 30 min | Medium | Final assembly |
| 20 | Update route `page.tsx` | 5 min | Low | Import redirect |
| 21 | Testing & verification | 60 min | - | Full regression test |

**Total Estimated Effort:** ~8.5 hours

---

## Comparison with Other Refactorings

| Metric | Check IP | Celery Settings | **Automation Templates** |
|--------|----------|-----------------|--------------------------|
| Lines of Code | 545 | 693 | **1,610** |
| Components (before) | 1 | 1 | **3 (inline)** |
| Manual State Hooks | 9 | 8 | **20+** |
| Critical Bug | Polling stale closure | Polling risk | **No** |
| Architecture Violations | 3 | 6 | **8** |
| Duplicate Code | Minimal | Minimal | **Types + utils** |
| Anti-patterns | Polling, manual state | Polling, no form lib | **confirm(), console.log, eslint-disable** |
| Refactoring Priority | HIGH (bug) | HIGH (bug risk) | **MEDIUM (size + violations)** |
| Code Reduction (main) | -74% | -75% | **-96%** |
| New Files | 7 | 11 | **17** |
| Existing Assets Reusable | Few | Few | **Many (hooks, types, utils, components)** |

---

## Notes

- This is the **largest monolithic page** in the frontend codebase
- Unlike other refactorings, **most infrastructure already exists** (query hooks, types, utils, shared components)
- The `HelpAndExamplesContent` component (450 lines) is pure documentation and can be extracted as-is without any logic changes
- The netmiko shared components (`VariableManagerPanel`, `TemplateRenderResultDialog`, `NautobotDataDialog`) are already well-structured and simply need re-importing
- No polling logic exists in this page, so there is no critical bug risk (unlike Check IP and Celery)
- Priority is MEDIUM because while there are many violations, the page functions correctly

---

**Document Version:** 1.0
**Created:** 2026-02-07
**Status:** Planning
**Priority:** Medium (architecture compliance + code quality)
