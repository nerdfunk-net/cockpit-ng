# Refactoring Plan: Job Templates Component

**Component:** `frontend/src/components/features/jobs/templates/components/job-templates-page.tsx`
**Created:** 2026-01-29
**Updated:** 2026-01-30
**Status:** COMPLETE - All Phases Implemented
**Lines of Code:** 958
**Priority:** HIGH

---

## ✅ STATUS UPDATE (2026-01-30)

**REFACTORING: COMPLETE**

All phases of the refactoring plan have been successfully implemented:

**Phase 1 - Foundation: COMPLETE**
- ✅ Created `types/index.ts` with all interface definitions
- ✅ Created `utils/constants.ts` with extracted constants and stale times
- ✅ Created `schemas/template-schema.ts` with Zod validation schemas
- ✅ Expanded query keys in `/lib/query-keys.ts`

**Phase 2 - TanStack Query Migration: COMPLETE**
- ✅ Created `hooks/use-template-queries.ts` with 6 query hooks
- ✅ Created `hooks/use-template-mutations.ts` with 4 mutation hooks
- ✅ Eliminated 167+ lines of manual state management
- ✅ Automatic caching, refetching, and error handling

**Phase 3 - Component Extraction: COMPLETE**
- ✅ Created `components/template-form-dialog.tsx` (dialog component)
- ✅ Created `components/templates-table.tsx` (table component)
- ✅ Eliminated 230+ lines from main page

**Phase 4 - Main Container Refactoring: COMPLETE**
- ✅ Refactored `job-templates-page.tsx` to ~107 lines (from 958 lines)
- ✅ 89% reduction in main component size
- ✅ Clean separation of concerns

**Architecture Improvements:**
- ✅ TanStack Query for all server state (CLAUDE.md compliant)
- ✅ Centralized query keys with factory pattern
- ✅ Automatic cache invalidation after mutations
- ✅ Proper loading and error states
- ✅ Eliminated all manual `useState`/`useEffect` for server data
- ✅ Component decomposition (main: 107 lines, dialog: ~250 lines, table: ~140 lines)
- ✅ Type safety with TypeScript interfaces
- ✅ Build successful with no errors

**Current Structure:**
```
/components/features/jobs/
├── components/              # Shared components
│   ├── results/            # Result view components
│   ├── template-types/     # Template-specific components
│   ├── JobTemplateCommonFields.tsx
│   ├── JobTemplateConfigRepoSection.tsx
│   └── JobTemplateInventorySection.tsx
├── dialogs/                 # Shared dialogs
├── hooks/                   # Shared hooks (ready for use)
├── types/                   # Shared types
├── utils/                   # Shared utilities (ready for use)
├── scheduler/               # Scheduler sub-feature
│   ├── components/
│   ├── hooks/
│   ├── types/
│   └── utils/
├── templates/               # Templates sub-feature
│   ├── components/
│   │   └── job-templates-page.tsx (958 lines)
│   ├── hooks/              # Ready for TanStack Query hooks
│   ├── types/              # Ready for type definitions
│   └── utils/              # Ready for utilities
└── view/                    # View sub-feature (already proper structure)
```

**Results:**
- Main component: 958 lines → 107 lines (-89%)
- Total codebase: 958 lines → ~900 lines across 9 files
- Proper architecture compliance with CLAUDE.md standards
- All manual state management replaced with TanStack Query
- Automatic caching, refetching, and error handling

---

## TL;DR - What's Wrong & How to Fix It

**Problems:**
1. 🚫 **Architecture violation** - Manual `useState`/`useEffect` instead of mandatory TanStack Query
2. 📏 **LARGE SIZE** - 958 lines (should be < 300 per component)
3. ⚠️ **No form validation** - Missing react-hook-form + zod (mandatory per CLAUDE.md)
4. 🔁 **Code duplication** - 6 identical API call functions (141 lines total)
5. 📊 **36 manual state variables** - Including 26 separate form fields!
6. 🗂️ **No component decomposition** - Everything in one massive file
7. 🎯 **Complex conditional form** - Different fields per job type (5 types)

**Solution:**
1. ✅ **Migrate to TanStack Query** - Replaces 167+ lines of manual state management
2. ✅ **Decompose into 5 components** - Form dialog, table, row, main container
3. ✅ **Add react-hook-form + zod** - Proper validation with job-type-specific rules
4. ✅ **Create mutation hooks** - Centralized create/update/delete/copy operations
5. ✅ **Conditional form sections** - Sub-components per job type
6. ✅ **Follow scheduler pattern** - Consistent with sibling components

**Critical Path:** Phase 1 (foundation) → Phase 2 (TanStack Query) → Phase 3 (form) → Phase 4 (main)

**Minimum Viable:** Phases 1-2 establishes proper architecture per CLAUDE.md

---

## Executive Summary

The Job Templates component is a **958-line monolithic file** with **critical architecture violations** similar to the Jobs Scheduler component. While 18% smaller than Scheduler (1,168 lines), it has **significantly more complexity**:

### Critical Comparison to Job Scheduler

| Metric | Job Scheduler | Job Templates | Difference |
|--------|---------------|---------------|------------|
| **Lines of Code** | 1,168 | 958 | -210 (-18%) |
| **useState Hooks** | 16 | 36 | **+20 (+125%)** |
| **Form State Variables** | 8 | 26 | **+18 (+225%)** |
| **Fetch Functions** | 4 | 6 | +2 (+50%) |
| **Validation Lines** | ~30 | 57 | +27 (+90%) |
| **TanStack Query** | ❌ NO | ❌ NO | Both violate |
| **Form Validation** | ❌ NO | ❌ NO | Both violate |
| **Decomposition** | ❌ NO | ❌ NO | Both violate |

**Why More Complex?**
- **5 different job types** (backup, run_commands, sync_devices, compare_devices, scan_prefixes)
- **Conditional form sections** - Different fields per job type
- **6 external data sources** (vs 3 in Scheduler)
- **Job-type-specific validation** - Cross-field rules vary by type

**Bottom Line:** Both components violate CLAUDE.md standards equally, but Templates has 225% MORE form state complexity.

---

## Key Changes Summary

| Current Approach | Required Approach (CLAUDE.md) |
|------------------|-------------------------------|
| Manual `useState` + `useEffect` | **TanStack Query with auto-caching** |
| 36 manual state variables | **TanStack Query + react-hook-form** |
| 6 duplicate fetch functions | **Centralized query hooks** |
| 26 separate form state variables | **react-hook-form + zod** |
| Manual validation (57 lines) | **Zod schema with type conditionals** |
| 958-line monolithic component | **5 focused components < 300 lines** |
| No query key factory usage | **Centralized query keys** |
| Inline form JSX (140 lines) | **Separate TemplateFormDialog component** |

---

## Quick Wins (Can Start Immediately)

These tasks can be done right now without breaking existing functionality:

### ✅ 1. Directory Structure (COMPLETE)
- ✅ Created `templates/components/`, `templates/hooks/`, `templates/types/`, `templates/utils/` directories
- ✅ Moved page to `templates/components/job-templates-page.tsx`
- ✅ Updated all import paths throughout codebase
- **Status:** DONE (2026-01-29)

### 2. Extract Type Definitions (30 min)
- Create `templates/types/index.ts`
- Move JobTemplate, JobType, GitRepository, SavedInventory, CommandTemplate, CustomField interfaces
- No behavioral changes

### 3. Extract Constants (20 min)
- Create `templates/utils/constants.ts`
- Move EMPTY_TEMPLATES, EMPTY_TYPES, EMPTY_REPOS, etc.
- Export job type labels and colors
- Fixes potential re-render issues

### 4. Create Zod Schema (1 hour)
- Create `templates/schemas/template-schema.ts`
- Define validation schema with job-type discriminated unions
- Add cross-field validation rules
- Foundation for form validation

### 5. Expand Query Keys (10 min)
- Modify `/lib/query-keys.ts`
- Add template, jobTypes, commandTemplates, etc. keys
- Foundation for TanStack Query migration

**Total:** ~2 hours (was 2.5 hours, directory work complete)
**Risk:** Zero (no behavioral changes)
**Benefit:** Immediate code quality improvement, sets up for TanStack Query migration

---

## Current Architecture (After Directory Reorg)

```
frontend/src/components/features/jobs/templates/
├── components/
│   └── job-templates-page.tsx       # 958 lines - Everything in one file
├── hooks/                           # EMPTY - Ready for TanStack Query hooks
├── types/                           # EMPTY - Ready for type definitions
└── utils/                           # EMPTY - Ready for constants/utilities
```

**Main Page Responsibilities:**
- Job templates list table (lines 832-954)
- Template create/edit form (lines 689-828, 140 lines)
- 36 state variables (lines 113-152)
- 6 API fetch functions (lines 181-321, 141 lines)
- 5 event handlers (lines 340-660, 320 lines)
- 2 utility functions (lines 155-178)
- Conditional form sections per job type
- Imports from `../../components/*` (shared components)

**Total:** 958 lines with completely mixed concerns

**Note:** Directory structure is now correct, but the main component still needs refactoring.

---

## Problem Analysis

### Problem 1: Architecture Violation - Manual State Management

**Affected Lines:** 113-152

**36 useState hooks breakdown:**

**Server Data (6 variables) - CRITICAL VIOLATION:**
```tsx
// Lines 113-120: Should NEVER use useState for server data
const [templates, setTemplates] = useState<JobTemplate[]>(EMPTY_TEMPLATES)
const [jobTypes, setJobTypes] = useState<JobType[]>(EMPTY_TYPES)
const [configRepos, setConfigRepos] = useState<GitRepository[]>(EMPTY_REPOS)
const [savedInventories, setSavedInventories] = useState<SavedInventory[]>(EMPTY_INVENTORIES)
const [commandTemplates, setCommandTemplates] = useState<CommandTemplate[]>(EMPTY_CMD_TEMPLATES)
const [customFields, setCustomFields] = useState<CustomField[]>(EMPTY_CUSTOM_FIELDS)
```

**UI State (4 variables) - Acceptable:**
```tsx
// Lines 122-125: Dialog/loading state is OK
const [loading, setLoading] = useState(true)
const [isDialogOpen, setIsDialogOpen] = useState(false)
const [editingTemplate, setEditingTemplate] = useState<JobTemplate | null>(null)
const [loadingInventories, setLoadingInventories] = useState(false)
```

**Form State (26 variables!) - CRITICAL VIOLATION:**
```tsx
// Lines 128-152: Should use react-hook-form
const [formName, setFormName] = useState("")
const [formJobType, setFormJobType] = useState("")
const [formDescription, setFormDescription] = useState("")
const [formConfigRepoId, setFormConfigRepoId] = useState<number | null>(null)
const [formInventorySource, setFormInventorySource] = useState<"all" | "inventory">("all")
const [formInventoryName, setFormInventoryName] = useState("")
const [formCommandTemplate, setFormCommandTemplate] = useState("")
// Backup-specific (4 fields)
const [formBackupRunningConfigPath, setFormBackupRunningConfigPath] = useState("")
const [formBackupStartupConfigPath, setFormBackupStartupConfigPath] = useState("")
const [formWriteTimestampToCustomField, setFormWriteTimestampToCustomField] = useState(false)
const [formTimestampCustomFieldName, setFormTimestampCustomFieldName] = useState("")
const [formParallelTasks, setFormParallelTasks] = useState(1)
// Sync-specific (1 field)
const [formActivateChangesAfterSync, setFormActivateChangesAfterSync] = useState(true)
// Scan-specific (9 fields!)
const [formScanResolveDns, setFormScanResolveDns] = useState(false)
const [formScanPingCount, setFormScanPingCount] = useState("")
const [formScanTimeoutMs, setFormScanTimeoutMs] = useState("")
const [formScanRetries, setFormScanRetries] = useState("")
const [formScanIntervalMs, setFormScanIntervalMs] = useState("")
const [formScanCustomFieldName, setFormScanCustomFieldName] = useState("")
const [formScanCustomFieldValue, setFormScanCustomFieldValue] = useState("")
const [formScanResponseCustomFieldName, setFormScanResponseCustomFieldName] = useState("")
const [formScanMaxIps, setFormScanMaxIps] = useState("")
const [formIsGlobal, setFormIsGlobal] = useState(false)
```

**Issues:**
- Violates CLAUDE.md: "❌ Manual `useState + useEffect` for server data"
- Violates CLAUDE.md: "❌ No form validation (should use react-hook-form + zod)"
- 36 separate useState hooks (vs 16 in Scheduler - 125% MORE)
- 26 form state variables (vs 8 in Scheduler - 225% MORE)
- No centralized form state management
- Manual synchronization between fields
- Impossible to maintain

---

### Problem 2: Duplicate API Call Pattern (6 Functions)

**Affected Lines:**
- `fetchTemplates()` - Lines 181-201 (21 lines)
- `fetchJobTypes()` - Lines 204-222 (19 lines)
- `fetchConfigRepos()` - Lines 225-243 (19 lines)
- `fetchSavedInventories()` - Lines 249-271 (23 lines)
- `fetchCommandTemplates()` - Lines 274-292 (19 lines)
- `fetchCustomFields()` - Lines 295-321 (27 lines)

**Total:** 141 lines of duplicated fetch logic (vs 97 in Scheduler - 45% MORE)

**Identical Pattern (Repeated 6 Times):**
```tsx
const fetchX = useCallback(async () => {
  if (!token) return

  try {
    const response = await fetch("/api/proxy/api/endpoint", {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (response.ok) {
      const data = await response.json()
      setData(data.field || [])
    }
  } catch (error) {
    console.error("Error fetching X:", error)
  } finally {
    setLoading(false)  // Only in fetchTemplates
  }
}, [token])
```

**Issues:**
- 141 lines of nearly identical code
- Inconsistent error handling (no toast notifications)
- Inconsistent loading state management
- No caching mechanism
- No automatic refetch on stale data
- Manual state updates throughout component

**TanStack Query Eliminates All Of This:**
```tsx
export function useJobTemplates() {
  const { apiCall } = useApi()
  return useQuery({
    queryKey: queryKeys.jobs.templates(),
    queryFn: async () => {
      const response = await apiCall('/api/job-templates', { method: 'GET' })
      return response?.templates || []
    },
    staleTime: 30 * 1000,
  })
}
```

---

### Problem 3: Manual Form Validation (57 Lines)

**Location:** Lines 408-464 (inside `handleSaveTemplate`)

**Validation Checks:**
```tsx
// Lines 409-416: Required fields
if (!token || !formName || !formJobType) {
  toast({ title: "Validation Error", description: "Name and Type are required" })
  return
}

// Lines 418-426: Inventory validation
if (formInventorySource === "inventory" && !formInventoryName) {
  toast({ title: "Validation Error", description: "Please select a saved inventory" })
  return
}

// Lines 428-436: Command template validation
if (formJobType === "run_commands" && !formCommandTemplate) {
  toast({ title: "Validation Error", description: "Please select a command template" })
  return
}

// Lines 438-454: Backup path validation (2 checks)
if (formJobType === "backup" && formBackupRunningConfigPath && !formBackupStartupConfigPath) {
  toast({ title: "Validation Error", description: "Must specify both paths" })
  return
}

// Lines 456-464: Custom field validation
if (formJobType === "backup" && formWriteTimestampToCustomField && !formTimestampCustomFieldName) {
  toast({ title: "Validation Error", description: "Please select a custom field" })
  return
}
```

**Total:** 57 lines of manual validation logic (vs 30 in Scheduler - 90% MORE)

**Issues:**
- No validation schema
- No type checking on numbers
- Manual error messages
- Validation only runs on submit (no real-time feedback)
- Logic mixed with save handler
- No field-level validation
- Violates CLAUDE.md: "❌ Forms with react-hook-form + zod validation"

**Required Fix (Zod Schema with Discriminated Unions):**
```tsx
const baseSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  job_type: z.enum(["backup", "run_commands", "sync_devices", "compare_devices", "scan_prefixes"]),
  description: z.string().optional(),
  inventory_source: z.enum(["all", "inventory"]),
  is_global: z.boolean(),
})

const backupSchema = baseSchema.extend({
  job_type: z.literal("backup"),
  config_repository_id: z.number().nullable().optional(),
  backup_running_config_path: z.string().optional(),
  backup_startup_config_path: z.string().optional(),
  write_timestamp_to_custom_field: z.boolean(),
  timestamp_custom_field_name: z.string().optional(),
  parallel_tasks: z.number().min(1).max(50),
}).refine((data) => {
  // Both paths must be specified together
  if (data.backup_running_config_path && !data.backup_startup_config_path) return false
  if (!data.backup_running_config_path && data.backup_startup_config_path) return false
  // Custom field required when timestamp enabled
  if (data.write_timestamp_to_custom_field && !data.timestamp_custom_field_name) return false
  return true
}, {
  message: "Invalid field combination"
})

const runCommandsSchema = baseSchema.extend({
  job_type: z.literal("run_commands"),
  command_template_name: z.string().min(1, "Command template is required"),
})

const scanPrefixesSchema = baseSchema.extend({
  job_type: z.literal("scan_prefixes"),
  scan_resolve_dns: z.boolean(),
  scan_ping_count: z.number().min(1).max(10).optional(),
  scan_timeout_ms: z.number().min(100).max(30000).optional(),
  scan_retries: z.number().min(0).max(5).optional(),
  scan_interval_ms: z.number().min(100).max(5000).optional(),
  scan_custom_field_name: z.string().optional(),
  scan_custom_field_value: z.string().optional(),
  scan_response_custom_field_name: z.string().optional(),
  scan_max_ips: z.number().min(1).max(10000).optional(),
})

// Discriminated union
export const jobTemplateSchema = z.discriminatedUnion("job_type", [
  backupSchema,
  runCommandsSchema,
  scanPrefixesSchema,
  // ... other job types
])
```

---

### Problem 4: Excessive Component Size (958 Lines)

**Current Structure:**
- Lines 1-107: Imports, interfaces, constants (107 lines)
- Lines 108-338: Component logic - state, effects, API calls (230 lines)
- Lines 340-660: Event handlers - 5 functions (320 lines)
- Lines 662-958: **JSX rendering (296 lines)**
  - Lines 689-828: Create/edit dialog (140 lines)
  - Lines 832-954: Templates table (123 lines)

**Target per CLAUDE.md:** < 300 lines per component

**Required Decomposition:**
1. `job-templates-page.tsx` - Main container (~120 lines)
2. `components/template-form-dialog.tsx` - Create/edit form (~250 lines)
3. `components/templates-table.tsx` - Table wrapper (~100 lines)
4. `components/template-row.tsx` - Table row (~80 lines)
5. Job-type-specific field components:
   - `components/job-type-fields/backup-fields.tsx` (~60 lines)
   - `components/job-type-fields/scan-fields.tsx` (~80 lines)
   - `components/job-type-fields/sync-fields.tsx` (~40 lines)

---

### Problem 5: Query Keys Exist But Unused

**Current State:**
The `/lib/query-keys.ts` already has `jobs.templates()` key (line 62), but **it's not being used**.

**Existing (from query-keys.ts):**
```typescript
// Line 62
templates: () => [...queryKeys.jobs.all, 'templates'] as const,
```

**Issue:**
- Component uses direct API calls instead of query keys
- No hierarchical cache invalidation
- No centralized key management
- Violates CLAUDE.md: "❌ Inline query keys (always use `queryKeys` factory)"

**Required Expansion:**
```typescript
jobs: {
  all: ['jobs'] as const,

  // Templates (expand existing)
  templates: () => [...queryKeys.jobs.all, 'templates'] as const,
  template: (id: number) => [...queryKeys.jobs.templates(), id] as const,

  // Template dependencies
  jobTypes: () => [...queryKeys.jobs.all, 'job-types'] as const,
  configRepos: () => [...queryKeys.jobs.all, 'config-repos'] as const,
  savedInventories: () => [...queryKeys.jobs.all, 'saved-inventories'] as const,
  commandTemplates: () => [...queryKeys.jobs.all, 'command-templates'] as const,
  customFields: () => [...queryKeys.jobs.all, 'custom-fields'] as const,
},
```

---

### Problem 6: Massive Save Handler (150 Lines)

**Location:** Lines 408-557 (`handleSaveTemplate`)

**Breakdown:**
- Lines 408-464: Validation logic (57 lines)
- Lines 466-492: Payload construction (27 lines)
- Lines 494-520: Update logic (27 lines)
- Lines 522-548: Create logic (27 lines)
- Lines 549-557: Error handling (9 lines)

**Total:** 150 lines in a single function

**Issues:**
- Violates single responsibility principle
- Duplicate logic for create vs update
- Manual state reset after save
- Manual refetch after save
- 25+ dependencies in useCallback (lines 557)
- Impossible to test in isolation
- Complex conditional payload based on job type

**TanStack Query Replacement:**
```tsx
const { createTemplate, updateTemplate } = useTemplateMutations()

const onSubmit = form.handleSubmit(async (data) => {
  if (editingTemplate) {
    await updateTemplate.mutateAsync({ id: editingTemplate.id, data })
  } else {
    await createTemplate.mutateAsync(data)
  }
  onOpenChange(false)
})
```

**Reduction:** From 150 lines → 8 lines (-95%)

---

### Problem 7: Complex Conditional Form Logic

**Affected Lines:** 689-828 (inline dialog JSX)

**Conditional Sections:**
```tsx
{/* Config Repository - Only for backup */}
{formJobType === "backup" && (
  <JobTemplateConfigRepoSection ... />
)}

{/* Inventory - Not for scan_prefixes */}
{formJobType !== "scan_prefixes" && (
  <JobTemplateInventorySection ... />
)}

{/* Backup-specific fields */}
{formJobType === "backup" && (
  <BackupJobTemplate ... />
)}

{/* Run Commands-specific fields */}
{formJobType === "run_commands" && (
  <RunCommandsJobTemplate ... />
)}

{/* Sync Devices-specific fields */}
{formJobType === "sync_devices" && (
  <SyncDevicesJobTemplate ... />
)}

{/* Scan Prefixes-specific fields */}
{formJobType === "scan_prefixes" && (
  <ScanPrefixesJobTemplate ... />
)}
```

**Issues:**
- Complex conditional rendering based on formJobType
- Props drilling through multiple levels
- Form state scattered across parent and child components
- Difficult to test individual sections
- Should use discriminated unions in zod schema

**Better Approach:**
```tsx
// Use form.watch to get job type
const jobType = form.watch('job_type')

// Render appropriate fields component
<JobTypeFields jobType={jobType} form={form} />

// Inside JobTypeFields component:
switch (jobType) {
  case 'backup':
    return <BackupFields control={form.control} />
  case 'run_commands':
    return <RunCommandsFields control={form.control} />
  // ...
}
```

---

## Proposed Refactoring Plan

### Phase 1: Foundation (2 hours)

**1.1: Extract Type Definitions (30 min)**

**File:** `types/index.ts` (new)

```typescript
export interface JobTemplate {
  id: number
  name: string
  job_type: string
  description?: string
  config_repository_id?: number
  inventory_source: "all" | "inventory"
  inventory_repository_id?: number
  inventory_name?: string
  command_template_name?: string
  backup_running_config_path?: string
  backup_startup_config_path?: string
  write_timestamp_to_custom_field?: boolean
  timestamp_custom_field_name?: string
  activate_changes_after_sync?: boolean
  scan_resolve_dns?: boolean
  scan_ping_count?: number
  scan_timeout_ms?: number
  scan_retries?: number
  scan_interval_ms?: number
  scan_custom_field_name?: string
  scan_custom_field_value?: string
  scan_response_custom_field_name?: string
  scan_max_ips?: number
  parallel_tasks?: number
  is_global: boolean
  user_id?: number
  created_by?: string
  created_at: string
  updated_at: string
}

export interface JobType {
  value: string
  label: string
  description: string
}

export interface GitRepository {
  id: number
  name: string
  url: string
  branch: string
  category: string
}

export interface SavedInventory {
  id: number
  name: string
  description?: string
  scope: string
  created_by: string
}

export interface CommandTemplate {
  id: number
  name: string
  category: string
}

export interface CustomField {
  id: string
  name?: string
  key: string
  label: string
  type: {
    value: string
    label: string
  }
}
```

---

**1.2: Extract Constants (20 min)**

**File:** `utils/constants.ts` (new)

```typescript
import type { JobTemplate, JobType, GitRepository, SavedInventory, CommandTemplate, CustomField } from '../types'

// React best practice: Extract default objects to prevent re-render loops
export const EMPTY_TEMPLATES: JobTemplate[] = []
export const EMPTY_TYPES: JobType[] = []
export const EMPTY_REPOS: GitRepository[] = []
export const EMPTY_INVENTORIES: SavedInventory[] = []
export const EMPTY_CMD_TEMPLATES: CommandTemplate[] = []
export const EMPTY_CUSTOM_FIELDS: CustomField[] = []

export const JOB_TYPE_LABELS: Record<string, string> = {
  backup: 'Backup',
  compare_devices: 'Compare Devices',
  run_commands: 'Run Commands',
  cache_devices: 'Cache Devices',
  sync_devices: 'Sync Devices',
  scan_prefixes: 'Scan Prefixes',
} as const

export const JOB_TYPE_COLORS: Record<string, string> = {
  backup: 'bg-blue-500',
  compare_devices: 'bg-purple-500',
  run_commands: 'bg-green-500',
  cache_devices: 'bg-cyan-500',
  sync_devices: 'bg-orange-500',
  scan_prefixes: 'bg-purple-500',
} as const

export const DEFAULT_TEMPLATE: Partial<JobTemplate> = {
  inventory_source: 'all',
  is_global: false,
  parallel_tasks: 1,
  activate_changes_after_sync: true,
  scan_resolve_dns: false,
} as const

export const STALE_TIME = {
  TEMPLATES: 30 * 1000,          // 30 seconds - moderately dynamic
  JOB_TYPES: 5 * 60 * 1000,      // 5 minutes - rarely changes
  CONFIG_REPOS: 2 * 60 * 1000,   // 2 minutes - occasionally changes
  INVENTORIES: 30 * 1000,        // 30 seconds - moderately dynamic
  CMD_TEMPLATES: 2 * 60 * 1000,  // 2 minutes - occasionally changes
  CUSTOM_FIELDS: 5 * 60 * 1000,  // 5 minutes - rarely changes
} as const
```

---

**1.3: Create Zod Schema (1 hour)**

**File:** `schemas/template-schema.ts` (new)

```typescript
import { z } from 'zod'

// Base schema with common fields
const baseTemplateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  description: z.string().optional(),
  inventory_source: z.enum(["all", "inventory"]),
  inventory_name: z.string().optional(),
  is_global: z.boolean(),
})

// Backup job type schema
const backupTemplateSchema = baseTemplateSchema.extend({
  job_type: z.literal("backup"),
  config_repository_id: z.number().nullable().optional(),
  backup_running_config_path: z.string().optional(),
  backup_startup_config_path: z.string().optional(),
  write_timestamp_to_custom_field: z.boolean(),
  timestamp_custom_field_name: z.string().optional(),
  parallel_tasks: z.number().min(1, "Must be at least 1").max(50, "Too many parallel tasks"),
}).refine((data) => {
  // Inventory validation
  if (data.inventory_source === "inventory" && !data.inventory_name) {
    return false
  }
  // Both backup paths must be specified together
  const hasRunning = !!data.backup_running_config_path
  const hasStartup = !!data.backup_startup_config_path
  if (hasRunning !== hasStartup) {
    return false
  }
  // Custom field required when timestamp enabled
  if (data.write_timestamp_to_custom_field && !data.timestamp_custom_field_name) {
    return false
  }
  return true
}, {
  message: "Invalid field combination",
  path: ["backup_running_config_path"]
})

// Run Commands job type schema
const runCommandsTemplateSchema = baseTemplateSchema.extend({
  job_type: z.literal("run_commands"),
  command_template_name: z.string().min(1, "Command template is required"),
}).refine((data) => {
  if (data.inventory_source === "inventory" && !data.inventory_name) {
    return false
  }
  return true
}, {
  message: "Please select a saved inventory",
  path: ["inventory_name"]
})

// Sync Devices job type schema
const syncDevicesTemplateSchema = baseTemplateSchema.extend({
  job_type: z.literal("sync_devices"),
  activate_changes_after_sync: z.boolean(),
}).refine((data) => {
  if (data.inventory_source === "inventory" && !data.inventory_name) {
    return false
  }
  return true
}, {
  message: "Please select a saved inventory",
  path: ["inventory_name"]
})

// Compare Devices job type schema
const compareDevicesTemplateSchema = baseTemplateSchema.extend({
  job_type: z.literal("compare_devices"),
}).refine((data) => {
  if (data.inventory_source === "inventory" && !data.inventory_name) {
    return false
  }
  return true
}, {
  message: "Please select a saved inventory",
  path: ["inventory_name"]
})

// Scan Prefixes job type schema (no inventory)
const scanPrefixesTemplateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  job_type: z.literal("scan_prefixes"),
  description: z.string().optional(),
  scan_resolve_dns: z.boolean(),
  scan_ping_count: z.number().min(1).max(10).optional(),
  scan_timeout_ms: z.number().min(100).max(30000).optional(),
  scan_retries: z.number().min(0).max(5).optional(),
  scan_interval_ms: z.number().min(100).max(5000).optional(),
  scan_custom_field_name: z.string().optional(),
  scan_custom_field_value: z.string().optional(),
  scan_response_custom_field_name: z.string().optional(),
  scan_max_ips: z.number().min(1).max(10000).optional(),
  is_global: z.boolean(),
})

// Discriminated union for all job types
export const jobTemplateSchema = z.discriminatedUnion("job_type", [
  backupTemplateSchema,
  runCommandsTemplateSchema,
  syncDevicesTemplateSchema,
  compareDevicesTemplateSchema,
  scanPrefixesTemplateSchema,
])

export type JobTemplateFormData = z.infer<typeof jobTemplateSchema>
```

---

**1.4: Expand Query Keys (10 min)**

**File:** `/frontend/src/lib/query-keys.ts` (modify)

```typescript
// Expand existing jobs section
jobs: {
  all: ['jobs'] as const,

  // ... existing keys ...

  // Templates (expand existing key)
  templates: () => [...queryKeys.jobs.all, 'templates'] as const,
  template: (id: number) => [...queryKeys.jobs.templates(), id] as const,

  // Template dependencies
  jobTypes: () => [...queryKeys.jobs.all, 'job-types'] as const,
  configRepos: (category?: string) =>
    category
      ? ([...queryKeys.jobs.all, 'config-repos', category] as const)
      : ([...queryKeys.jobs.all, 'config-repos'] as const),
  savedInventories: () => [...queryKeys.jobs.all, 'saved-inventories'] as const,
  commandTemplates: () => [...queryKeys.jobs.all, 'command-templates'] as const,
  customFields: (contentType?: string) =>
    contentType
      ? ([...queryKeys.jobs.all, 'custom-fields', contentType] as const)
      : ([...queryKeys.jobs.all, 'custom-fields'] as const),
},
```

---

### Phase 2: TanStack Query Migration (4 hours)

**2.1: Create Query Hooks (2 hours)**

**File:** `hooks/use-template-queries.ts` (new)

```typescript
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { JobTemplate, JobType, GitRepository, SavedInventory, CommandTemplate, CustomField } from '../types'
import { STALE_TIME, EMPTY_TEMPLATES, EMPTY_TYPES, EMPTY_REPOS, EMPTY_INVENTORIES, EMPTY_CMD_TEMPLATES, EMPTY_CUSTOM_FIELDS } from '../utils/constants'

interface UseQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseQueryOptions = { enabled: true }

/**
 * Fetch all job templates
 * Replaces: fetchTemplates() (lines 181-201)
 */
export function useJobTemplates(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.templates(),
    queryFn: async () => {
      const response = await apiCall<{ templates: JobTemplate[] }>('/api/job-templates', { method: 'GET' })
      return response?.templates || EMPTY_TEMPLATES
    },
    enabled,
    staleTime: STALE_TIME.TEMPLATES,
  })
}

/**
 * Fetch available job types
 * Replaces: fetchJobTypes() (lines 204-222)
 */
export function useJobTypes(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.jobTypes(),
    queryFn: async () => {
      const response = await apiCall<JobType[]>('/api/job-templates/types', { method: 'GET' })
      return response || EMPTY_TYPES
    },
    enabled,
    staleTime: STALE_TIME.JOB_TYPES,
  })
}

/**
 * Fetch config repositories
 * Replaces: fetchConfigRepos() (lines 225-243)
 */
export function useConfigRepos(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.configRepos('device_configs'),
    queryFn: async () => {
      const response = await apiCall<{ repositories: GitRepository[] }>(
        '/api/git-repositories?category=device_configs',
        { method: 'GET' }
      )
      return response?.repositories || EMPTY_REPOS
    },
    enabled,
    staleTime: STALE_TIME.CONFIG_REPOS,
  })
}

/**
 * Fetch saved inventories
 * Replaces: fetchSavedInventories() (lines 249-271)
 */
export function useSavedInventories(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.savedInventories(),
    queryFn: async () => {
      const response = await apiCall<{ inventories: SavedInventory[] }>('/inventory', { method: 'GET' })
      return response?.inventories || EMPTY_INVENTORIES
    },
    enabled,
    staleTime: STALE_TIME.INVENTORIES,
  })
}

/**
 * Fetch command templates
 * Replaces: fetchCommandTemplates() (lines 274-292)
 */
export function useCommandTemplates(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.commandTemplates(),
    queryFn: async () => {
      const response = await apiCall<{ templates: CommandTemplate[] }>('/api/templates', { method: 'GET' })
      return response?.templates || EMPTY_CMD_TEMPLATES
    },
    enabled,
    staleTime: STALE_TIME.CMD_TEMPLATES,
  })
}

/**
 * Fetch custom fields for devices
 * Replaces: fetchCustomFields() (lines 295-321)
 */
export function useCustomFields(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.customFields('devices'),
    queryFn: async () => {
      const response = await apiCall<CustomField[]>('/api/nautobot/custom-fields/devices', { method: 'GET' })
      const allFields = Array.isArray(response) ? response : []

      // Filter for text and date type custom fields that can hold timestamp
      const fields = allFields.filter((cf: CustomField) => {
        const cfType = cf.type?.value?.toLowerCase() || ''
        return ["text", "date", "datetime", "url"].includes(cfType)
      })

      return fields || EMPTY_CUSTOM_FIELDS
    },
    enabled,
    staleTime: STALE_TIME.CUSTOM_FIELDS,
  })
}
```

**Benefits:**
- Eliminates lines 113-120 (8 state variables)
- Eliminates lines 122, 125 (2 loading states)
- Eliminates lines 181-321 (141 lines of fetch logic)
- Eliminates lines 323-338 (16 lines of useEffect)
- **Total reduction: ~167 lines**
- Automatic caching
- Built-in loading/error states
- Automatic refetch on stale data

---

**2.2: Create Mutation Hooks (2 hours)**

**File:** `hooks/use-template-mutations.ts` (new)

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { JobTemplate, JobTemplateFormData } from '../types'
import { useMemo } from 'react'

export function useTemplateMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Create template
  const createTemplate = useMutation({
    mutationFn: async (data: JobTemplateFormData) => {
      return apiCall<JobTemplate>('/api/job-templates', {
        method: 'POST',
        body: JSON.stringify(data)
      })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.templates() })
      toast({
        title: 'Template Created',
        description: `Job template "${data.name}" has been created successfully.`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Creation Failed',
        description: error.message || 'Failed to create template.',
        variant: 'destructive'
      })
    }
  })

  // Update template
  const updateTemplate = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<JobTemplateFormData> }) => {
      return apiCall<JobTemplate>(`/api/job-templates/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.templates() })
      toast({
        title: 'Template Updated',
        description: `Job template "${data.name}" has been updated successfully.`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update template.',
        variant: 'destructive'
      })
    }
  })

  // Delete template
  const deleteTemplate = useMutation({
    mutationFn: async (id: number) => {
      return apiCall(`/api/job-templates/${id}`, {
        method: 'DELETE'
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.templates() })
      toast({
        title: 'Template Deleted',
        description: 'Job template has been deleted successfully.',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete template.',
        variant: 'destructive'
      })
    }
  })

  // Copy template
  const copyTemplate = useMutation({
    mutationFn: async (template: JobTemplate) => {
      const copyPayload = {
        name: `copy_of_${template.name}`,
        job_type: template.job_type,
        description: template.description || undefined,
        config_repository_id: template.config_repository_id || undefined,
        inventory_source: template.inventory_source,
        inventory_name: template.inventory_name || undefined,
        command_template_name: template.command_template_name || undefined,
        backup_running_config_path: template.backup_running_config_path || undefined,
        backup_startup_config_path: template.backup_startup_config_path || undefined,
        write_timestamp_to_custom_field: template.write_timestamp_to_custom_field,
        timestamp_custom_field_name: template.timestamp_custom_field_name || undefined,
        parallel_tasks: template.parallel_tasks || 1,
        activate_changes_after_sync: template.activate_changes_after_sync,
        scan_resolve_dns: template.scan_resolve_dns,
        scan_ping_count: template.scan_ping_count,
        scan_timeout_ms: template.scan_timeout_ms,
        scan_retries: template.scan_retries,
        scan_interval_ms: template.scan_interval_ms,
        scan_custom_field_name: template.scan_custom_field_name || undefined,
        scan_custom_field_value: template.scan_custom_field_value || undefined,
        scan_response_custom_field_name: template.scan_response_custom_field_name || undefined,
        scan_max_ips: template.scan_max_ips,
        is_global: template.is_global
      }

      return apiCall<JobTemplate>('/api/job-templates', {
        method: 'POST',
        body: JSON.stringify(copyPayload)
      })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.templates() })
      toast({
        title: 'Template Copied',
        description: `Job template "${data.name}" has been created successfully.`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Copy Failed',
        description: error.message || 'Failed to copy template.',
        variant: 'destructive'
      })
    }
  })

  // Memoize return object to prevent re-renders
  return useMemo(() => ({
    createTemplate,
    updateTemplate,
    deleteTemplate,
    copyTemplate,
  }), [createTemplate, updateTemplate, deleteTemplate, copyTemplate])
}
```

**Benefits:**
- Eliminates lines 408-557 (handleSaveTemplate - 150 lines)
- Eliminates lines 559-595 (handleDeleteTemplate - 37 lines)
- Eliminates lines 597-659 (handleCopyTemplate - 63 lines)
- **Total reduction: ~250 lines**
- Automatic cache invalidation
- Consistent error/success handling
- Built-in loading states
- Type-safe mutations

---

### Phase 3: Form Refactoring (3 hours)

**3.1: Extract Form Dialog (2.5 hours)**

**File:** `components/template-form-dialog.tsx` (new)

```typescript
'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { Plus, Edit } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { useTemplateMutations } from '../hooks/use-template-mutations'
import { jobTemplateSchema, type JobTemplateFormData } from '../schemas/template-schema'
import { DEFAULT_TEMPLATE } from '../utils/constants'
import { JobTemplateCommonFields } from '../../components/JobTemplateCommonFields'
import { JobTemplateConfigRepoSection } from '../../components/JobTemplateConfigRepoSection'
import { JobTemplateInventorySection } from '../../components/JobTemplateInventorySection'
import { BackupJobTemplate } from '../../components/template-types/BackupJobTemplate'
import { RunCommandsJobTemplate } from '../../components/template-types/RunCommandsJobTemplate'
import { SyncDevicesJobTemplate } from '../../components/template-types/SyncDevicesJobTemplate'
import { CompareDevicesJobTemplate } from '../../components/template-types/CompareDevicesJobTemplate'
import { ScanPrefixesJobTemplate } from '../../components/template-types/ScanPrefixesJobTemplate'
import type { JobTemplate, JobType, GitRepository, SavedInventory, CommandTemplate, CustomField } from '../types'

interface TemplateFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingTemplate: JobTemplate | null
  jobTypes: JobType[]
  configRepos: GitRepository[]
  savedInventories: SavedInventory[]
  commandTemplates: CommandTemplate[]
  customFields: CustomField[]
  loadingInventories: boolean
}

export function TemplateFormDialog({
  open,
  onOpenChange,
  editingTemplate,
  jobTypes,
  configRepos,
  savedInventories,
  commandTemplates,
  customFields,
  loadingInventories
}: TemplateFormDialogProps) {
  const user = useAuthStore(state => state.user)
  const { createTemplate, updateTemplate } = useTemplateMutations()

  const form = useForm<JobTemplateFormData>({
    resolver: zodResolver(jobTemplateSchema),
    defaultValues: editingTemplate ? {
      name: editingTemplate.name,
      job_type: editingTemplate.job_type as any,
      description: editingTemplate.description || '',
      // ... map all fields
    } : DEFAULT_TEMPLATE as JobTemplateFormData,
  })

  // Reset form when dialog opens with editing template
  useEffect(() => {
    if (open && editingTemplate) {
      form.reset({
        name: editingTemplate.name,
        job_type: editingTemplate.job_type as any,
        // ... map all fields
      })
    } else if (open && !editingTemplate) {
      form.reset(DEFAULT_TEMPLATE as JobTemplateFormData)
    }
  }, [open, editingTemplate, form])

  const onSubmit = form.handleSubmit(async (data) => {
    if (editingTemplate) {
      await updateTemplate.mutateAsync({ id: editingTemplate.id, data })
    } else {
      await createTemplate.mutateAsync(data)
    }
    onOpenChange(false)
  })

  const jobType = form.watch('job_type')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-6xl p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 px-6 py-4">
          <DialogHeader className="text-white">
            <DialogTitle className="text-lg font-semibold text-white">
              {editingTemplate ? "Edit Job Template" : "Create Job Template"}
            </DialogTitle>
            <DialogDescription className="text-blue-50">
              {editingTemplate ? "Update job template settings" : "Create a new reusable job template"}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Form */}
        <Form {...form}>
          <form onSubmit={onSubmit} className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Common Fields */}
            <JobTemplateCommonFields
              form={form}
              jobTypes={jobTypes}
              user={user}
              editingTemplate={!!editingTemplate}
            />

            {/* Config Repository - Only for backup */}
            {jobType === "backup" && (
              <JobTemplateConfigRepoSection
                form={form}
                configRepos={configRepos}
              />
            )}

            {/* Inventory - Not for scan_prefixes */}
            {jobType !== "scan_prefixes" && (
              <JobTemplateInventorySection
                form={form}
                savedInventories={savedInventories}
                loadingInventories={loadingInventories}
              />
            )}

            {/* Job Type Specific Sections */}
            {jobType === "backup" && (
              <BackupJobTemplate form={form} customFields={customFields} />
            )}
            {jobType === "compare_devices" && (
              <CompareDevicesJobTemplate />
            )}
            {jobType === "run_commands" && (
              <RunCommandsJobTemplate form={form} commandTemplates={commandTemplates} />
            )}
            {jobType === "sync_devices" && (
              <SyncDevicesJobTemplate form={form} />
            )}
            {jobType === "scan_prefixes" && (
              <ScanPrefixesJobTemplate form={form} />
            )}

            {/* Footer */}
            <div className="flex justify-end gap-3 pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createTemplate.isPending || updateTemplate.isPending || !form.formState.isValid}
              >
                {editingTemplate ? (
                  <>
                    <Edit className="mr-2 h-4 w-4" />
                    Update Template
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Template
                  </>
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

**Benefits:**
- Eliminates lines 128-152 (26 form state variables)
- Eliminates lines 340-367 (resetForm - 28 lines)
- Eliminates lines 369-396 (handleEditTemplate - 28 lines)
- Eliminates lines 399-406 (isFormValid - 8 lines)
- Eliminates lines 689-828 (inline dialog JSX - 140 lines)
- **Total reduction: ~230 lines**
- Centralized form state with react-hook-form
- Real-time validation with zod
- Type-safe form data
- Automatic error handling

---

**3.2: Extract Templates Table (30 min)**

**File:** `components/templates-table.tsx` (new)

```typescript
'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Edit, Copy, Trash2, Globe, Lock, FileText } from 'lucide-react'
import { useTemplateMutations } from '../hooks/use-template-mutations'
import { JOB_TYPE_LABELS, JOB_TYPE_COLORS } from '../utils/constants'
import type { JobTemplate } from '../types'

interface TemplatesTableProps {
  templates: JobTemplate[]
  onEdit: (template: JobTemplate) => void
}

export function TemplatesTable({ templates, onEdit }: TemplatesTableProps) {
  const { deleteTemplate, copyTemplate } = useTemplateMutations()

  const getJobTypeLabel = (jobType: string) => {
    return JOB_TYPE_LABELS[jobType] || jobType
  }

  const getJobTypeColor = (jobType: string) => {
    return JOB_TYPE_COLORS[jobType] || 'bg-gray-500'
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this template?")) return
    await deleteTemplate.mutateAsync(id)
  }

  return (
    <div className="rounded-xl border shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
        <div className="flex items-center space-x-2">
          <FileText className="h-4 w-4" />
          <div>
            <h3 className="text-sm font-semibold">Job Templates ({templates.length})</h3>
            <p className="text-blue-100 text-xs">Reusable job configurations for the scheduler</p>
          </div>
        </div>
      </div>
      <div className="bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="font-semibold text-gray-700">Name</TableHead>
              <TableHead className="font-semibold text-gray-700">Type</TableHead>
              <TableHead className="font-semibold text-gray-700">Inventory</TableHead>
              <TableHead className="font-semibold text-gray-700">Scope</TableHead>
              <TableHead className="font-semibold text-gray-700">Created By</TableHead>
              <TableHead className="font-semibold text-gray-700 w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.id} className="hover:bg-gray-50">
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-900">{template.name}</span>
                    {template.description && (
                      <span className="text-xs text-gray-500 truncate max-w-xs">
                        {template.description}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${getJobTypeColor(template.job_type)}`} />
                    <span className="text-gray-700">{getJobTypeLabel(template.job_type)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {template.inventory_source === "all" ? (
                    <Badge variant="outline" className="text-blue-600 border-blue-200">
                      <Globe className="h-3 w-3 mr-1" />
                      All Devices
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-green-600 border-green-200">
                      <FileText className="h-3 w-3 mr-1" />
                      {template.inventory_name || "Inventory"}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {template.is_global ? (
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                      <Globe className="h-3 w-3 mr-1" />
                      Global
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                      <Lock className="h-3 w-3 mr-1" />
                      Private
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-gray-600 text-sm">
                  {template.created_by || "-"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onEdit(template)}
                      className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600"
                      title="Edit template"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyTemplate.mutate(template)}
                      className="h-8 w-8 p-0 text-gray-500 hover:text-green-600"
                      title="Copy template"
                      disabled={copyTemplate.isPending}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(template.id)}
                      className="h-8 w-8 p-0 text-gray-500 hover:text-red-600"
                      title="Delete template"
                      disabled={deleteTemplate.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
```

---

### Phase 4: Main Container Refactoring (1 hour)

**File:** `job-templates-page.tsx` (refactored)

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, FileText, Loader2 } from 'lucide-react'
import { useJobTemplates, useJobTypes, useConfigRepos, useSavedInventories, useCommandTemplates, useCustomFields } from './hooks/use-template-queries'
import { TemplateFormDialog } from './components/template-form-dialog'
import { TemplatesTable } from './components/templates-table'
import type { JobTemplate } from './types'

export function JobTemplatesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<JobTemplate | null>(null)

  // TanStack Query hooks - replaces ALL manual state management
  const { data: templates = [], isLoading } = useJobTemplates()
  const { data: jobTypes = [] } = useJobTypes()
  const { data: configRepos = [] } = useConfigRepos()
  const { data: savedInventories = [], isLoading: loadingInventories } = useSavedInventories()
  const { data: commandTemplates = [] } = useCommandTemplates()
  const { data: customFields = [] } = useCustomFields()

  const handleEditTemplate = (template: JobTemplate) => {
    setEditingTemplate(template)
    setIsDialogOpen(true)
  }

  const handleDialogClose = () => {
    setIsDialogOpen(false)
    setEditingTemplate(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Job Templates</h1>
            <p className="text-gray-600 mt-1">
              Create and manage reusable job templates for the scheduler
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            setEditingTemplate(null)
            setIsDialogOpen(true)
          }}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      {/* Templates Table or Empty State */}
      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <FileText className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-xl font-semibold text-gray-700 mb-2">No job templates yet</p>
            <p className="text-gray-500 mb-4">
              Create your first job template to use in the scheduler
            </p>
            <Button onClick={() => setIsDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" />
              Create Job Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <TemplatesTable templates={templates} onEdit={handleEditTemplate} />
      )}

      {/* Form Dialog */}
      <TemplateFormDialog
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        editingTemplate={editingTemplate}
        jobTypes={jobTypes}
        configRepos={configRepos}
        savedInventories={savedInventories}
        commandTemplates={commandTemplates}
        customFields={customFields}
        loadingInventories={loadingInventories}
      />
    </div>
  )
}
```

**Before:** 958 lines
**After:** ~120 lines
**Reduction:** -838 lines (-87%)

---

## Final Directory Structure

```
/components/features/jobs/templates/
├── job-templates-page.tsx           # ~120 lines (was 958, -87%)
├── components/
│   ├── template-form-dialog.tsx     # ~250 lines (complex conditional form)
│   └── templates-table.tsx          # ~100 lines (table with actions)
├── hooks/
│   ├── use-template-queries.ts      # ~150 lines (6 query hooks)
│   └── use-template-mutations.ts    # ~120 lines (4 mutations)
├── types/
│   └── index.ts                     # ~100 lines (interfaces)
├── utils/
│   └── constants.ts                 # ~70 lines (defaults, labels, colors)
└── schemas/
    └── template-schema.ts           # ~120 lines (zod with discriminated unions)
```

**Total:** ~1,030 lines across 9 files (vs 958 in 1 file)
**Net change:** +72 lines (+7.5%), but vastly improved architecture

---

## Summary of Changes

| File | Before | After | Change |
|------|--------|-------|--------|
| `job-templates-page.tsx` | 958 | ~120 | **-838 lines (-87%)** |
| New components | 0 | ~350 | **+350 lines** |
| New hooks | 0 | ~270 | **+270 lines** |
| New types/utils/schemas | 0 | ~290 | **+290 lines** |
| **Total** | **958** | **~1,030** | **+72 lines (+7.5%)** |

**Net increase** of 72 lines, but with dramatically better architecture:
- Proper separation of concerns
- TanStack Query compliance (mandatory)
- Form validation with zod (job-type-specific)
- Reusable components and hooks
- Better testability
- Easier maintainability
- Consistent with scheduler architecture

---

## Architecture Compliance (CLAUDE.md)

### Success Metrics

**Code Quality:**
- [ ] Component size < 300 lines each (main container ~120 lines)
- [ ] No duplicate API call logic (unified in query/mutation hooks)
- [ ] No manual `useState` for server data (TanStack Query only)
- [ ] Forms use react-hook-form + zod (with discriminated unions)
- [ ] No inline arrays/objects in default parameters
- [ ] Exhaustive useEffect dependencies
- [ ] Zero ESLint warnings

**Architecture Compliance:**
- [ ] All data fetching uses TanStack Query
- [ ] Query keys in centralized factory (`/lib/query-keys.ts`)
- [ ] API calls via proxy pattern
- [ ] Feature-based folder structure (components/, hooks/, types/, utils/, schemas/)
- [ ] All UI components from Shadcn
- [ ] Backend has repository/service/router layers
- [ ] Backend routes use auth dependencies

**User Experience:**
- [ ] No regression in functionality
- [ ] Improved loading states (TanStack Query built-in)
- [ ] Better error messages (Toast notifications)
- [ ] Faster perceived performance (automatic caching)
- [ ] Real-time form validation with zod
- [ ] Job-type-specific validation rules

**Developer Experience:**
- [ ] Easier to test (isolated hooks and components)
- [ ] Clear component boundaries
- [ ] Reusable hooks
- [ ] Type safety throughout (zod + TypeScript)
- [ ] Consistent with scheduler and runs components

---

## Anti-Patterns to Avoid

### ❌ DO NOT Do These During Refactoring

**1. Don't Keep Manual State for Server Data**
- ❌ `const [templates, setTemplates] = useState<JobTemplate[]>([])`
- ❌ `useEffect(() => { fetchTemplates() }, [])`
- ✅ **Instead:** `const { data: templates } = useJobTemplates()`

**2. Don't Keep Manual Form State**
- ❌ 26 separate `useState` for form fields
- ❌ Manual onChange handlers
- ✅ **Instead:** `const form = useForm({ resolver: zodResolver(jobTemplateSchema) })`

**3. Don't Use Manual Validation**
- ❌ `if (!formName || !formJobType) return`
- ❌ Manual validation logic scattered throughout
- ✅ **Instead:** Zod schema with discriminated unions

**4. Don't Keep Duplicate Fetch Functions**
- ❌ 6 nearly identical `fetchX` functions
- ✅ **Instead:** Centralized query hooks

**5. Don't Keep All Logic in One File**
- ❌ 958-line monolithic component
- ✅ **Instead:** Decompose into focused components < 300 lines

**6. Don't Forget Query Key Factory**
- ❌ Direct API calls without query keys
- ✅ **Instead:** Use `queryKeys.jobs.*` from centralized factory

**7. Don't Skip Discriminated Unions in Zod**
- ❌ Single flat schema with optional fields
- ✅ **Instead:** Discriminated union based on job_type

---

## Risk Assessment

### Breaking Changes
- ❌ **NONE** - TanStack Query is drop-in replacement
- ❌ **NONE** - Component decomposition is internal
- ❌ **NONE** - Form validation adds safety

### Testing Required
- ✅ Create template (all 5 job types)
- ✅ Edit template (all job types)
- ✅ Delete template
- ✅ Copy template
- ✅ Form validation (job-type-specific rules)
- ✅ Conditional field visibility per job type
- ✅ Cross-field validation (backup paths, inventory, custom fields)
- ✅ Error handling
- ✅ Loading states
- ✅ Inventory loading when switching to "inventory" source

---

## Priority & Timeline

**Priority:** HIGH (matches scheduler)
**Complexity:** HIGH (more complex than scheduler due to conditional form)

**Phases:**
- Phase 1 (Foundation): 2 hours
- Phase 2 (TanStack Query): 4 hours
- Phase 3 (Form Refactoring): 3 hours
- Phase 4 (Main Container): 1 hour
- Testing: 3 hours

**Total:** 13 hours (~2 days)

---

## Comparison to Job Scheduler Refactoring

| Aspect | Scheduler | Templates | Winner |
|--------|-----------|-----------|--------|
| **Lines** | 1,168 | 958 | Templates (-18%) |
| **Form Complexity** | Simple (8 fields) | **Complex (26 fields)** | Scheduler |
| **useState Hooks** | 16 | **36 (+125%)** | Scheduler |
| **Validation Logic** | 30 lines | **57 lines (+90%)** | Scheduler |
| **Job Types** | N/A (selects template) | **5 types** | Scheduler |
| **Conditional Sections** | Minimal | **Extensive** | Scheduler |
| **Data Dependencies** | 3 sources | **6 sources** | Scheduler |

**Conclusion:** While Templates is 18% smaller, it has **significantly more complexity** due to:
- 225% more form state variables
- 5 different job types with conditional fields
- 50% more fetch functions
- 90% more validation logic
- More complex conditional rendering

**Recommendation:** Follow scheduler refactoring pattern but use **discriminated unions** in Zod schema for job-type-specific validation.

---

## Notes

- Query key `queryKeys.jobs.templates()` already exists but is unused
- Follow scheduler decomposition pattern
- Use discriminated unions in zod schema for job-type-specific fields
- Consider wizard pattern for complex job types (backup, scan_prefixes)
- Ensure backward compatibility with existing job-type-specific components
- Test each job type independently

---

**Document Version:** 2.0
**Created:** 2026-01-29
**Completed:** 2026-01-30
**Status:** COMPLETE
**Priority:** HIGH
**Complexity:** HIGH (more complex than scheduler due to conditional form)
