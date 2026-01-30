# Refactoring Plan: Jobs Scheduler Component

**Component:** `frontend/src/components/features/jobs/scheduler/components/jobs-scheduler-page.tsx`
**Created:** 2026-01-29
**Updated:** 2026-01-30
**Status:** ✅ COMPLETE - All Phases Implemented
**Lines of Code:** Was 1,168 → Now ~90 (main), ~1,250 (total across 11 files)
**Priority:** HIGH

---

## ✅ STATUS UPDATE (2026-01-30)

**REFACTORING: COMPLETE**

All phases have been successfully implemented:
- ✅ Phase 1: Foundation & Setup (types, constants, utilities, query keys)
- ✅ Phase 2: TanStack Query Migration (query hooks, mutation hooks)
- ✅ Phase 3: Component Decomposition (debug dialog, form dialog, card, grid)
- ✅ Phase 4: Main Container Refactored

**Results:**
- Main page reduced from 1,168 lines to ~90 lines (-92%)
- Total codebase: ~1,250 lines across 11 properly structured files
- Full TanStack Query integration with automatic caching
- Form validation with react-hook-form + zod
- Consistent with job templates/runs architecture
- All CLAUDE.md standards met

---

## ✅ PREVIOUS UPDATE (2026-01-29)

**Directory Structure Refactoring: COMPLETE**

The jobs feature directory has been reorganized to match the standardized structure per CLAUDE.md:

**Completed Changes:**
- ✅ Created `components/` directory (renamed from `shared/`)
- ✅ Moved result views to `components/results/`
- ✅ Moved template types to `components/template-types/`
- ✅ Moved dialog to `dialogs/job-result-dialog.tsx`
- ✅ Organized sub-features with proper structure (components/, hooks/, types/, utils/)
- ✅ Updated all import paths throughout the codebase
- ✅ Git tracking preserved (using `git mv`)

**Current Structure:**
```
/components/features/jobs/
├── components/              # Shared components
├── dialogs/                 # Shared dialogs
├── hooks/                   # Shared hooks
├── types/                   # Shared types
├── utils/                   # Shared utilities
├── scheduler/               # Scheduler sub-feature
│   ├── components/
│   │   └── jobs-scheduler-page.tsx (1,168 lines)
│   ├── hooks/              # Ready for TanStack Query hooks
│   ├── types/              # Ready for type definitions
│   └── utils/              # Ready for utilities
├── templates/               # Templates sub-feature
└── view/                    # View sub-feature
```

**Remaining Work:**
- TanStack Query migration (Phase 2)
- Form validation with react-hook-form + zod (Phase 3)
- Component decomposition (Phase 3-4)

---

## TL;DR - What's Wrong & How to Fix It

**Problems:**
1. 🚫 **Architecture violation** - Manual `useState`/`useEffect` instead of mandatory TanStack Query
2. 📏 **EXCESSIVE SIZE** - 1,168 lines (largest component in codebase, target: < 300)
3. ⚠️ **No form validation** - Missing react-hook-form + zod (mandatory per CLAUDE.md)
4. 🔁 **Code duplication** - 4 identical API call functions with repeated error handling
5. 📊 **16 manual state variables** - Twice as many as Celery Settings component
6. 🗂️ **No component decomposition** - Everything in one massive file
7. ❌ **Inconsistent with codebase** - Job templates & runs already use TanStack Query correctly

**Solution:**
1. ✅ **Migrate to TanStack Query** - Replaces 200+ lines of manual state management
2. ✅ **Decompose into 5 components** - Debug dialog, form dialog, grid, card, main container
3. ✅ **Add react-hook-form + zod** - Proper form validation for schedule creation/editing
4. ✅ **Create mutation hooks** - Centralized create/update/delete/toggle/run operations
5. ✅ **Use existing patterns** - Follow job templates/runs implementation

**Critical Path:** Phase 1 (foundation) → Phase 2 (TanStack Query) → Phase 3 (decomposition) → Phase 4 (main container)

**Minimum Viable:** Phases 1-2 establishes proper architecture per CLAUDE.md

---

## Executive Summary

The Jobs Scheduler component is a **1,168-line monolithic file** with **critical architecture violations** that require mandatory refactoring per CLAUDE.md standards.

### Critical Issues

1. **Architecture Violation** - Uses manual `useState` + `useEffect` instead of mandatory TanStack Query
2. **Excessive Size** - 1,168 lines (largest component in codebase, should be < 300)
3. **Manual State Management** - 16 separate `useState` hooks for server data and UI state
4. **No Form Validation** - Missing required react-hook-form + zod validation
5. **Code Duplication** - 4 nearly identical API call functions
6. **No Component Decomposition** - Single component handles everything
7. **Pattern Inconsistency** - Job templates and runs already use TanStack Query correctly

**Bottom Line:** This component violates every major architecture standard in CLAUDE.md. TanStack Query migration is mandatory and will eliminate 200+ lines of manual state management automatically.

---

## Key Changes Summary

| Current Approach | Required Approach (CLAUDE.md) |
|------------------|-------------------------------|
| Manual `useState` + `useEffect` | **TanStack Query with auto-caching** |
| 16 manual state variables | **TanStack Query built-in states** |
| 4 duplicate fetch functions | **Centralized query hooks** |
| Manual form validation | **react-hook-form + zod** |
| 1,168-line monolithic component | **5 focused components < 300 lines** |
| No query key factory usage | **Centralized query keys** |
| Manual cache invalidation | **Automatic invalidation with mutations** |
| Inconsistent error handling | **Standardized with useToast** |

---

## Quick Wins (Can Start Immediately)

These tasks can be done right now without breaking existing functionality:

### ✅ 1. Directory Structure (COMPLETE)
- ✅ Created `scheduler/components/`, `scheduler/hooks/`, `scheduler/types/`, `scheduler/utils/` directories
- ✅ Moved page to `scheduler/components/jobs-scheduler-page.tsx`
- ✅ Updated all import paths throughout codebase
- **Status:** DONE (2026-01-29)

### 2. Extract Type Definitions (30 min)
- Create `scheduler/types/index.ts`
- Move JobSchedule, JobTemplate, Credential, SchedulerDebugInfo interfaces
- No behavioral changes

### 3. Extract Constants (15 min)
- Create `scheduler/utils/constants.ts`
- Move EMPTY_SCHEDULES, EMPTY_TEMPLATES, EMPTY_CREDENTIALS
- Fixes potential re-render issues

### 4. Extract Utility Functions (30 min)
- Create `scheduler/utils/schedule-utils.ts`
- Move getScheduleTypeLabel, getScheduleTypeColor, getJobTypeLabel
- Add unit tests

### 5. Expand Query Keys (15 min)
- Modify `/lib/query-keys.ts`
- Expand existing `jobs.schedules()` key with detail and debug keys
- Foundation for TanStack Query migration

### 6. Verify Backend Architecture (30 min)
- Confirm backend endpoints use repository/service/router layers
- Check for proper auth dependencies
- Verify endpoint pattern consistency

**Total:** ~2 hours (was 2.5 hours, directory work complete)
**Risk:** Zero (no behavioral changes)
**Benefit:** Immediate code quality improvement, sets up for TanStack Query migration

---

## Current Architecture (After Directory Reorg)

```
frontend/src/components/features/jobs/scheduler/
├── components/
│   └── jobs-scheduler-page.tsx       # 1,168 lines - Everything in one file
├── hooks/                            # EMPTY - Ready for TanStack Query hooks
├── types/                            # EMPTY - Ready for type definitions
└── utils/                            # EMPTY - Ready for constants/utilities
```

**Main Page Responsibilities:**
- Job schedules list with cards (lines 1044-1165)
- Schedule create/edit form (lines 740-1040, 300 lines!)
- Debug dialog (lines 557-737, 181 lines)
- 16 state variables (lines 125-146)
- 4 API fetch functions (lines 149-246)
- 6 event handlers (lines 288-469)
- 3 utility functions (lines 471-531)

**Total:** 1,168 lines with completely mixed concerns

**Note:** Directory structure is now correct, but the main component still needs refactoring.

---

## Problem Analysis

### Problem 1: Architecture Violation - Manual State Management

**Affected Lines:** 3, 125-146

**Current Pattern:**
```tsx
// Line 3: Manual imports
import { useEffect, useState, useCallback } from "react"

// Lines 125-146: 16 manual state variables
const [jobSchedules, setJobSchedules] = useState<JobSchedule[]>(EMPTY_SCHEDULES)
const [jobTemplates, setJobTemplates] = useState<JobTemplate[]>(EMPTY_TEMPLATES)
const [credentials, setCredentials] = useState<Credential[]>(EMPTY_CREDENTIALS)
const [loading, setLoading] = useState(true)
const [isDialogOpen, setIsDialogOpen] = useState(false)
const [editingJob, setEditingJob] = useState<JobSchedule | null>(null)
const [runningJobId, setRunningJobId] = useState<number | null>(null)
const [isDebugDialogOpen, setIsDebugDialogOpen] = useState(false)
const [debugInfo, setDebugInfo] = useState<SchedulerDebugInfo | null>(null)
const [debugLoading, setDebugLoading] = useState(false)
// ... 8 more form state variables
```

**Issues:**
- Manual loading state management (lines 128, 136)
- No caching mechanism
- Manual state updates throughout component
- Violates CLAUDE.md mandatory TanStack Query requirement
- **Server data** (lines 125-127, 135) should NEVER use useState
- **Loading states** (lines 128, 136) are built into TanStack Query
- **Form state** (lines 139-146) should use react-hook-form

---

### Problem 2: Duplicate API Call Pattern

**Affected Lines:**
- `fetchJobSchedules()` - Lines 149-169
- `fetchJobTemplates()` - Lines 172-190
- `fetchCredentials()` - Lines 193-211
- `fetchSchedulerDebug()` - Lines 214-246

**Identical Pattern (Repeated 4 Times):**
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
      setData(data)
    }
  } catch (error) {
    console.error("Error fetching X:", error)
  } finally {
    setLoading(false)
  }
}, [token])
```

**Issues:**
- 97 lines of duplicated fetch logic
- Inconsistent error handling (only fetchSchedulerDebug shows toast)
- Manual loading state management
- No caching
- No automatic refetch

**TanStack Query eliminates all of this:**
```tsx
export function useJobSchedules() {
  const { apiCall } = useApi()
  return useQuery({
    queryKey: queryKeys.jobs.schedules(),
    queryFn: async () => apiCall('api/job-schedules', { method: 'GET' }),
    staleTime: 30 * 1000,
  })
}
```

---

### Problem 3: Manual useEffect Orchestration

**Location:** Lines 282-286

```tsx
useEffect(() => {
  fetchJobSchedules()
  fetchJobTemplates()
  fetchCredentials()
}, [fetchJobSchedules, fetchJobTemplates, fetchCredentials])
```

**Issues:**
- Manual orchestration of data fetching
- Dependency on memoized callbacks
- No error handling
- No loading state coordination
- Runs on every render if callbacks aren't stable

**TanStack Query Replacement:**
```tsx
// Simply use the hooks - they manage themselves
const { data: schedules, isLoading: schedulesLoading } = useJobSchedules()
const { data: templates, isLoading: templatesLoading } = useJobTemplates()
const { data: credentials, isLoading: credentialsLoading } = useCredentials()

const loading = schedulesLoading || templatesLoading || credentialsLoading
```

---

### Problem 4: No Form Validation (86 Lines of Manual Logic)

**Affected Lines:** 300-385 (`handleSaveJob`)

**Current Pattern:**
```tsx
const handleSaveJob = useCallback(async () => {
  if (!token || !formIdentifier) return  // Only validation!

  try {
    if (editingJob) {
      // 33 lines of update logic
      const response = await fetch(`/api/proxy/api/job-schedules/${editingJob.id}`, {
        method: "PUT",
        body: JSON.stringify({
          job_identifier: formIdentifier,
          schedule_type: formScheduleType,
          interval_minutes: formScheduleType === "interval" ? formIntervalMinutes : undefined,
          // ... 6 more fields
        }),
      })

      if (response.ok) {
        setIsDialogOpen(false)
        resetForm()
        fetchJobSchedules()
        toast({ title: "Schedule Updated" })
      }
    } else {
      // 38 lines of create logic (duplicate pattern)
    }
  } catch (error) {
    console.error("Error saving job schedule:", error)
  }
}, [token, editingJob, formTemplateId, formIdentifier, formScheduleType,
    formIntervalMinutes, formStartTime, formIsActive, formIsGlobal,
    formCredentialId, fetchJobSchedules, toast, resetForm])  // 12 dependencies!
```

**Issues:**
- No validation schema (only checks `!formIdentifier`)
- No type validation for numbers, time format, etc.
- 86 lines for a single function
- 12 dependencies in useCallback
- Manual state reset
- Duplicate logic for create vs update
- Manual refetch after save

**Required Fix:**
```tsx
// 1. Define zod schema
const scheduleFormSchema = z.object({
  job_identifier: z.string().min(1, "Identifier is required").max(100),
  job_template_id: z.number().min(1, "Template is required"),
  schedule_type: z.enum(["now", "interval", "hourly", "daily", "weekly", "monthly", "custom"]),
  interval_minutes: z.number().min(1).max(1440).optional(),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format").optional(),
  is_active: z.boolean(),
  is_global: z.boolean(),
  credential_id: z.number().nullable().optional(),
})

// 2. Use react-hook-form
const form = useForm({
  resolver: zodResolver(scheduleFormSchema),
  defaultValues: editingJob || DEFAULT_SCHEDULE
})

// 3. Use mutation hooks
const { createSchedule, updateSchedule } = useScheduleMutations()

const onSubmit = form.handleSubmit((data) => {
  if (editingJob) {
    updateSchedule.mutate({ id: editingJob.id, data })
  } else {
    createSchedule.mutate(data)
  }
})
```

---

### Problem 5: Excessive Component Size (1,168 Lines)

**Current Structure:**
- Lines 1-120: Imports, interfaces, constants (120 lines)
- Lines 121-286: Component logic - state, effects, API calls (165 lines)
- Lines 288-469: Event handlers - 6 separate functions (181 lines)
- Lines 471-531: Utility functions - 3 helpers (60 lines)
- Lines 533-1168: **JSX rendering (635 lines!)**
  - Lines 557-737: Debug dialog (181 lines)
  - Lines 740-1040: Create/edit dialog (300 lines)
  - Lines 1044-1165: Schedules list (121 lines)

**Target:** < 300 lines per component

**Required Decomposition:**
1. `jobs-scheduler-page.tsx` - Main container (~150 lines)
2. `components/schedule-debug-dialog.tsx` - Debug panel (~200 lines)
3. `components/schedule-form-dialog.tsx` - Create/edit form (~250 lines)
4. `components/schedules-grid.tsx` - Grid layout (~100 lines)
5. `components/schedule-card.tsx` - Individual card (~80 lines)

---

### Problem 6: Query Keys Exist But Unused

**Current State:**
The `/frontend/src/lib/query-keys.ts` file already has `jobs.schedules()` key, but **it's not being used**.

**Existing (lines 38-66):**
```typescript
jobs: {
  all: ['jobs'] as const,
  list: (params?: {...}) => [...],
  detail: (id: number | string) => [...],
  progress: (id: number) => [...],
  templates: () => [...queryKeys.jobs.all, 'templates'] as const,
  schedules: () => [...queryKeys.jobs.all, 'schedules'] as const,  // EXISTS!
},
```

**Issue:**
- Component uses direct API calls instead of query keys
- No keys for individual schedule operations
- No keys for debug info

**Required Expansion:**
```typescript
jobs: {
  all: ['jobs'] as const,

  // ... existing keys ...

  // Schedules (expand existing)
  schedules: () => [...queryKeys.jobs.all, 'schedules'] as const,
  schedule: (id: number) => [...queryKeys.jobs.schedules(), id] as const,

  // Scheduler debug
  schedulerDebug: () => [...queryKeys.jobs.all, 'scheduler-debug'] as const,
},
```

---

### Problem 7: Inconsistent with Existing Job Components

**The job templates and runs features already use TanStack Query correctly!**

| Component | Lines | TanStack Query | Form Validation | Query Keys | Decomposed |
|-----------|-------|----------------|-----------------|------------|------------|
| Job Templates | ~400 | ✅ Yes | ✅ Yes (zod) | ✅ Yes | ✅ Yes |
| Job Runs | ~500 | ✅ Yes | ❌ No forms | ✅ Yes | ✅ Yes |
| **Scheduler** | **1,168** | **❌ NO** | **❌ NO** | **❌ NO** | **❌ NO** |

**Evidence:**
- `/frontend/src/components/features/jobs/view/hooks/use-jobs-query.ts` - Proper implementation
- `/frontend/src/components/features/jobs/view/hooks/use-job-mutations.ts` - Proper mutations
- Both use `queryKeys.jobs.*` from centralized factory

**The scheduler should follow the same pattern.**

---

### Problem 8: Inline Complex JSX

**Debug Dialog (Lines 557-737):**
- 181 lines of inline JSX
- Complex table rendering
- Nested tooltips and conditional rendering
- Should be `<ScheduleDebugDialog />`

**Form Dialog (Lines 740-1040):**
- 300 lines of inline JSX
- Complex form with conditional fields
- Manual state management mixed with presentation
- Should be `<ScheduleFormDialog />`

**Issues:**
- Impossible to test in isolation
- Difficult to read and maintain
- No component reuse
- Props drilling through inline callbacks

---

## Proposed Refactoring Plan

### Phase 1: Foundation & Setup (~1.5 hours remaining)

**✅ 1.0: Directory Structure (COMPLETE - 30 min)**
- ✅ Created `scheduler/components/`, `scheduler/hooks/`, `scheduler/types/`, `scheduler/utils/`
- ✅ Moved `jobs-scheduler-page.tsx` to `scheduler/components/`
- ✅ Updated all import paths
- **Status:** DONE (2026-01-29)

**1.1: Extract Type Definitions (30 min)**

**File:** `types/index.ts` (new)

```typescript
export interface JobSchedule {
  id: number
  job_identifier: string
  job_template_id: number
  template_name?: string
  template_job_type?: string
  schedule_type: "now" | "interval" | "hourly" | "daily" | "weekly" | "monthly" | "custom"
  cron_expression?: string
  interval_minutes?: number
  start_time?: string
  start_date?: string
  is_active: boolean
  is_global: boolean
  user_id?: number
  credential_id?: number
  job_parameters?: Record<string, unknown>
  created_at: string
  updated_at: string
  last_run?: string
  next_run?: string
}

export interface JobTemplate {
  id: number
  name: string
  job_type: string
  description?: string
  inventory_source: string
  inventory_repository_id?: number
  inventory_name?: string
  command_template_name?: string
  is_global: boolean
  user_id?: number
  created_by?: string
  created_at: string
  updated_at: string
}

export interface Credential {
  id: number
  name: string
  username: string
  type: string
  source: string
  owner?: string
}

export interface SchedulerDebugInfo {
  server_time: {
    utc: string
    local: string
    timezone_offset_hours: number
  }
  schedule_summary: {
    total_schedules: number
    active_schedules: number
    due_now: number
    upcoming: number
  }
  due_schedules: Array<{
    id: number
    job_identifier: string
    schedule_type: string
    start_time: string | null
    next_run: string | null
    next_run_local: string | null
    last_run: string | null
    seconds_until_next_run: number
    is_due: boolean
    template_name: string | null
  }>
  upcoming_schedules: Array<{
    id: number
    job_identifier: string
    schedule_type: string
    start_time: string | null
    next_run: string | null
    next_run_local: string | null
    last_run: string | null
    seconds_until_next_run: number
    is_due: boolean
    template_name: string | null
  }>
  celery_status: string
  note: string
}

// Form types
export interface ScheduleFormData {
  job_identifier: string
  job_template_id: number
  schedule_type: JobSchedule['schedule_type']
  interval_minutes?: number
  start_time?: string
  is_active: boolean
  is_global: boolean
  credential_id?: number | null
}
```

---

**1.2: Extract Constants (15 min)**

**File:** `utils/constants.ts` (new)

```typescript
import type { JobSchedule, JobTemplate, Credential } from '../types'

// React best practice: Extract default objects to prevent re-render loops
export const EMPTY_SCHEDULES: JobSchedule[] = []
export const EMPTY_TEMPLATES: JobTemplate[] = []
export const EMPTY_CREDENTIALS: Credential[] = []

export const DEFAULT_SCHEDULE: Partial<ScheduleFormData> = {
  schedule_type: 'daily',
  interval_minutes: 60,
  start_time: '00:00',
  is_active: true,
  is_global: false,
  credential_id: null,
} as const

export const SCHEDULE_TYPE_LABELS: Record<string, string> = {
  now: 'Run Once',
  interval: 'Interval',
  hourly: 'Hourly',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  custom: 'Custom',
} as const

export const SCHEDULE_TYPE_COLORS: Record<string, string> = {
  now: 'bg-blue-500',
  interval: 'bg-cyan-500',
  hourly: 'bg-green-500',
  daily: 'bg-purple-500',
  weekly: 'bg-orange-500',
  monthly: 'bg-pink-500',
  custom: 'bg-gray-500',
} as const

export const JOB_TYPE_LABELS: Record<string, string> = {
  backup: 'Backup',
  compare_devices: 'Compare Devices',
  run_commands: 'Run Commands',
  cache_devices: 'Cache Devices',
  sync_devices: 'Sync Devices',
} as const

export const STALE_TIME = {
  SCHEDULES: 30 * 1000,     // 30 seconds - moderately dynamic
  TEMPLATES: 5 * 60 * 1000,  // 5 minutes - rarely changes
  CREDENTIALS: 5 * 60 * 1000, // 5 minutes - rarely changes
  DEBUG: 10 * 1000,          // 10 seconds - frequently changing
} as const
```

---

**1.3: Extract Utility Functions (30 min)**

**File:** `utils/schedule-utils.ts` (new)

```typescript
import type { JobSchedule } from '../types'
import { SCHEDULE_TYPE_LABELS, SCHEDULE_TYPE_COLORS, JOB_TYPE_LABELS } from './constants'

/**
 * Get human-readable label for schedule type
 */
export function getScheduleTypeLabel(
  type: JobSchedule['schedule_type'],
  job?: JobSchedule
): string {
  if (type === 'interval' && job?.interval_minutes) {
    const hours = Math.floor(job.interval_minutes / 60)
    const mins = job.interval_minutes % 60
    if (hours > 0 && mins > 0) return `Every ${hours}h ${mins}m`
    if (hours > 0) return `Every ${hours} hour${hours > 1 ? 's' : ''}`
    return `Every ${mins} minute${mins > 1 ? 's' : ''}`
  }

  if ((type === 'hourly' || type === 'daily') && job?.start_time) {
    return `${type === 'hourly' ? 'Hourly' : 'Daily'} at ${job.start_time}`
  }

  return SCHEDULE_TYPE_LABELS[type] || type
}

/**
 * Get color class for schedule type badge
 */
export function getScheduleTypeColor(type: JobSchedule['schedule_type']): string {
  return SCHEDULE_TYPE_COLORS[type] || 'bg-gray-500'
}

/**
 * Get human-readable label for job type
 */
export function getJobTypeLabel(jobType: string): string {
  return JOB_TYPE_LABELS[jobType] || jobType
}

/**
 * Format time for display with timezone info
 */
export function formatTimeWithTimezone(time: string): string {
  const timezoneOffset = -new Date().getTimezoneOffset() / 60
  const parts = time.split(':').map(Number)
  const h = parts[0] ?? 0
  const m = parts[1] ?? 0
  const localH = (h + timezoneOffset + 24) % 24
  return `${String(Math.floor(localH)).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
```

---

**1.4: Expand Query Keys (15 min)**

**File:** `/frontend/src/lib/query-keys.ts` (modify)

```typescript
// Expand existing jobs section
jobs: {
  all: ['jobs'] as const,

  // ... existing keys ...

  // Schedules (expand existing)
  schedules: () => [...queryKeys.jobs.all, 'schedules'] as const,
  schedule: (id: number) => [...queryKeys.jobs.schedules(), id] as const,

  // Job templates for scheduler
  templates: () => [...queryKeys.jobs.all, 'templates'] as const,

  // Credentials for scheduler
  credentials: () => [...queryKeys.jobs.all, 'credentials'] as const,

  // Scheduler debug
  schedulerDebug: () => [...queryKeys.jobs.all, 'scheduler-debug'] as const,
},
```

---

**1.5: Verify Backend Architecture (30 min)**

**Tasks:**
- [ ] Confirm `/backend/routers/job_schedules.py` uses repository pattern
- [ ] Verify service layer exists
- [ ] Check auth dependencies (`verify_token`, `require_permission`)
- [ ] Verify endpoints: `/api/proxy/api/job-schedules`, `/api/proxy/api/job-templates`, `/api/proxy/api/credentials`
- [ ] Check debug endpoints: `/api/proxy/api/job-schedules/debug/scheduler-status`, `/api/proxy/api/job-schedules/debug/recalculate-next-runs`

---

### Phase 2: TanStack Query Migration (CRITICAL - 4 hours)

**2.1: Create Query Hooks (2 hours)**

**File:** `hooks/use-schedule-queries.ts` (new)

```typescript
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { JobSchedule, JobTemplate, Credential, SchedulerDebugInfo } from '../types'
import { STALE_TIME, EMPTY_SCHEDULES, EMPTY_TEMPLATES, EMPTY_CREDENTIALS } from '../utils/constants'

interface UseScheduleQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseScheduleQueryOptions = { enabled: true }

/**
 * Fetch all job schedules
 * Replaces: fetchJobSchedules() (lines 149-169)
 */
export function useJobSchedules(options: UseScheduleQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.schedules(),
    queryFn: async () => {
      const response = await apiCall<JobSchedule[]>('/api/job-schedules', { method: 'GET' })
      return response || EMPTY_SCHEDULES
    },
    enabled,
    staleTime: STALE_TIME.SCHEDULES,
  })
}

/**
 * Fetch all job templates
 * Replaces: fetchJobTemplates() (lines 172-190)
 */
export function useJobTemplates(options: UseScheduleQueryOptions = DEFAULT_OPTIONS) {
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
 * Fetch credentials for scheduler
 * Replaces: fetchCredentials() (lines 193-211)
 */
export function useCredentials(options: UseScheduleQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.credentials(),
    queryFn: async () => {
      const response = await apiCall<Credential[]>('/api/credentials', { method: 'GET' })
      return response || EMPTY_CREDENTIALS
    },
    enabled,
    staleTime: STALE_TIME.CREDENTIALS,
  })
}

/**
 * Fetch scheduler debug info
 * Replaces: fetchSchedulerDebug() (lines 214-246)
 */
export function useSchedulerDebug(options: UseScheduleQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.schedulerDebug(),
    queryFn: async () => {
      const response = await apiCall<SchedulerDebugInfo>(
        '/api/job-schedules/debug/scheduler-status',
        { method: 'GET' }
      )
      return response
    },
    enabled,
    staleTime: STALE_TIME.DEBUG,
  })
}
```

**Benefits:**
- Eliminates lines 125-127 (3 state variables)
- Eliminates lines 128, 136 (2 loading states)
- Eliminates lines 149-246 (97 lines of fetch logic)
- Eliminates lines 282-286 (useEffect orchestration)
- **Total reduction: ~105 lines**

---

**2.2: Create Mutation Hooks (2 hours)**

**File:** `hooks/use-schedule-mutations.ts` (new)

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { JobSchedule, ScheduleFormData } from '../types'
import { useMemo } from 'react'

export function useScheduleMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Create schedule
  const createSchedule = useMutation({
    mutationFn: async (data: ScheduleFormData) => {
      return apiCall<JobSchedule>('/api/job-schedules', {
        method: 'POST',
        body: JSON.stringify(data)
      })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.schedules() })
      toast({
        title: 'Success',
        description: `Schedule "${data.job_identifier}" created successfully`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Creation Failed',
        description: error.message || 'Failed to create schedule',
        variant: 'destructive'
      })
    }
  })

  // Update schedule
  const updateSchedule = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ScheduleFormData> }) => {
      return apiCall<JobSchedule>(`/api/job-schedules/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.schedules() })
      toast({
        title: 'Success',
        description: `Schedule "${data.job_identifier}" updated successfully`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update schedule',
        variant: 'destructive'
      })
    }
  })

  // Delete schedule
  const deleteSchedule = useMutation({
    mutationFn: async (id: number) => {
      return apiCall(`/api/job-schedules/${id}`, {
        method: 'DELETE'
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.schedules() })
      toast({
        title: 'Success',
        description: 'Schedule deleted successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Deletion Failed',
        description: error.message || 'Failed to delete schedule',
        variant: 'destructive'
      })
    }
  })

  // Toggle active/inactive
  const toggleActive = useMutation({
    mutationFn: async (job: JobSchedule) => {
      return apiCall<JobSchedule>(`/api/job-schedules/${job.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !job.is_active })
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.schedules() })
    },
    onError: (error: Error) => {
      toast({
        title: 'Toggle Failed',
        description: error.message || 'Failed to toggle schedule',
        variant: 'destructive'
      })
    }
  })

  // Run now
  const runNow = useMutation({
    mutationFn: async ({ id, identifier }: { id: number; identifier: string }) => {
      return apiCall(`/job-runs/execute/${id}`, {
        method: 'POST'
      })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.schedules() })
      toast({
        title: 'Job Started',
        description: `Schedule "${variables.identifier}" has been queued for execution`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Execution Failed',
        description: error.message || 'Failed to start job execution',
        variant: 'destructive'
      })
    }
  })

  // Recalculate next runs
  const recalculateNextRuns = useMutation({
    mutationFn: async () => {
      return apiCall<{ message: string }>('/api/job-schedules/debug/recalculate-next-runs', {
        method: 'POST'
      })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.schedules() })
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.schedulerDebug() })
      toast({
        title: 'Success',
        description: data.message || 'Next runs recalculated successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to recalculate next runs',
        variant: 'destructive'
      })
    }
  })

  // Memoize return object to prevent re-renders
  return useMemo(() => ({
    createSchedule,
    updateSchedule,
    deleteSchedule,
    toggleActive,
    runNow,
    recalculateNextRuns,
  }), [createSchedule, updateSchedule, deleteSchedule, toggleActive, runNow, recalculateNextRuns])
}
```

**Benefits:**
- Eliminates lines 300-385 (handleSaveJob - 86 lines)
- Eliminates lines 387-408 (handleToggleActive - 22 lines)
- Eliminates lines 410-428 (handleDeleteJob - 19 lines)
- Eliminates lines 430-469 (handleRunNow - 40 lines)
- Eliminates lines 249-280 (handleRecalculateNextRuns - 32 lines)
- **Total reduction: ~199 lines**
- Automatic cache invalidation
- Consistent error handling
- Built-in loading states

---

### Phase 3: Component Decomposition (6 hours)

**3.1: Extract Debug Dialog (1.5 hours)**

**File:** `components/schedule-debug-dialog.tsx` (new)

```typescript
'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { AlertTriangle, Calendar, CheckCircle2, Clock, RefreshCw, Server } from 'lucide-react'
import { useSchedulerDebug } from '../hooks/use-schedule-queries'
import { useScheduleMutations } from '../hooks/use-schedule-mutations'

interface ScheduleDebugDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ScheduleDebugDialog({ open, onOpenChange }: ScheduleDebugDialogProps) {
  const { data: debugInfo, isLoading, refetch } = useSchedulerDebug({ enabled: open })
  const { recalculateNextRuns } = useScheduleMutations()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-blue-500" />
            Scheduler Debug Info
          </DialogTitle>
          <DialogDescription>
            View scheduler database state and diagnose scheduling issues
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-600">Loading scheduler info...</span>
          </div>
        ) : debugInfo ? (
          <div className="space-y-4">
            {/* Server Time Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Server Time
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-blue-600">UTC:</span>
                  <span className="ml-2 font-mono">{new Date(debugInfo.server_time.utc).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-blue-600">Offset:</span>
                  <span className="ml-2 font-mono">
                    UTC{debugInfo.server_time.timezone_offset_hours >= 0 ? '+' : ''}
                    {debugInfo.server_time.timezone_offset_hours}h
                  </span>
                </div>
              </div>
              <p className="mt-2 text-xs text-blue-600">⚠️ Note: {debugInfo.note}</p>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 uppercase">Total</p>
                <p className="text-2xl font-bold text-gray-700">
                  {debugInfo.schedule_summary.total_schedules}
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-xs text-green-600 uppercase">Active</p>
                <p className="text-2xl font-bold text-green-700">
                  {debugInfo.schedule_summary.active_schedules}
                </p>
              </div>
              <div className={`${debugInfo.schedule_summary.due_now > 0 ? 'bg-amber-50' : 'bg-gray-50'} rounded-lg p-3 text-center`}>
                <p className={`text-xs uppercase ${debugInfo.schedule_summary.due_now > 0 ? 'text-amber-600' : 'text-gray-500'}`}>
                  Due Now
                </p>
                <p className={`text-2xl font-bold ${debugInfo.schedule_summary.due_now > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
                  {debugInfo.schedule_summary.due_now}
                </p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <p className="text-xs text-purple-600 uppercase">Celery</p>
                <p className={`text-sm font-medium ${debugInfo.celery_status.includes('active') ? 'text-green-600' : 'text-red-600'}`}>
                  {debugInfo.celery_status.includes('active') ? '✓ Active' : '✗ ' + debugInfo.celery_status}
                </p>
              </div>
            </div>

            {/* Due Schedules */}
            {debugInfo.due_schedules.length > 0 && (
              <div className="border border-amber-200 rounded-lg overflow-hidden">
                <div className="bg-amber-100 px-4 py-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <h4 className="font-semibold text-amber-800">Due Schedules (Should Be Running)</h4>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-amber-50">
                      <TableHead className="text-xs">ID</TableHead>
                      <TableHead className="text-xs">Name</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Next Run (UTC)</TableHead>
                      <TableHead className="text-xs">Overdue By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {debugInfo.due_schedules.map((schedule) => (
                      <TableRow key={schedule.id} className="bg-amber-50/50">
                        <TableCell className="font-mono text-xs">{schedule.id}</TableCell>
                        <TableCell className="font-medium">{schedule.job_identifier}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{schedule.schedule_type}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {schedule.next_run ? new Date(schedule.next_run).toLocaleString() : '-'}
                        </TableCell>
                        <TableCell className="text-amber-700 font-medium">
                          {Math.abs(Math.round(schedule.seconds_until_next_run / 60))} min
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Upcoming Schedules */}
            {debugInfo.upcoming_schedules.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-600" />
                  <h4 className="font-semibold text-gray-700">Upcoming Schedules</h4>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Name</TableHead>
                      <TableHead className="text-xs">Template</TableHead>
                      <TableHead className="text-xs">Next Run</TableHead>
                      <TableHead className="text-xs">Time Until</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {debugInfo.upcoming_schedules.map((schedule) => (
                      <TableRow key={schedule.id}>
                        <TableCell className="font-medium">{schedule.job_identifier}</TableCell>
                        <TableCell className="text-xs text-gray-600">
                          {schedule.template_name || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                {schedule.next_run ? new Date(schedule.next_run).toLocaleTimeString() : '-'}
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">UTC: {schedule.next_run}</p>
                                <p className="text-xs">Local: {schedule.next_run_local}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-green-600 font-medium">
                          {schedule.seconds_until_next_run < 60
                            ? `${schedule.seconds_until_next_run}s`
                            : schedule.seconds_until_next_run < 3600
                            ? `${Math.round(schedule.seconds_until_next_run / 60)}m`
                            : `${Math.round(schedule.seconds_until_next_run / 3600)}h`
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => recalculateNextRuns.mutate()}
                disabled={recalculateNextRuns.isPending}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Recalculate All Next Runs
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No debug information available
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

---

**3.2: Extract Form Dialog (2.5 hours)**

**File:** `components/schedule-form-dialog.tsx` (new)

```typescript
'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Plus, Edit, Globe, User } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import type { JobSchedule, JobTemplate, Credential, ScheduleFormData } from '../types'
import { useScheduleMutations } from '../hooks/use-schedule-mutations'
import { getJobTypeLabel, formatTimeWithTimezone } from '../utils/schedule-utils'
import { DEFAULT_SCHEDULE } from '../utils/constants'

// Zod validation schema
const scheduleFormSchema = z.object({
  job_identifier: z.string().min(1, "Identifier is required").max(100),
  job_template_id: z.number().min(1, "Template is required"),
  schedule_type: z.enum(["now", "interval", "hourly", "daily", "weekly", "monthly", "custom"]),
  interval_minutes: z.number().min(1).max(1440).optional(),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format").optional(),
  is_active: z.boolean(),
  is_global: z.boolean(),
  credential_id: z.number().nullable().optional(),
})

type FormData = z.infer<typeof scheduleFormSchema>

interface ScheduleFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingJob: JobSchedule | null
  templates: JobTemplate[]
  credentials: Credential[]
  onSuccess: () => void
}

export function ScheduleFormDialog({
  open,
  onOpenChange,
  editingJob,
  templates,
  credentials,
  onSuccess
}: ScheduleFormDialogProps) {
  const user = useAuthStore(state => state.user)
  const { createSchedule, updateSchedule } = useScheduleMutations()

  const form = useForm<FormData>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: editingJob ? {
      job_identifier: editingJob.job_identifier,
      job_template_id: editingJob.job_template_id,
      schedule_type: editingJob.schedule_type,
      interval_minutes: editingJob.interval_minutes || 60,
      start_time: editingJob.start_time || '00:00',
      is_active: editingJob.is_active,
      is_global: editingJob.is_global,
      credential_id: editingJob.credential_id ?? null,
    } : DEFAULT_SCHEDULE as FormData,
  })

  // Reset form when dialog opens with editing job
  useEffect(() => {
    if (open && editingJob) {
      form.reset({
        job_identifier: editingJob.job_identifier,
        job_template_id: editingJob.job_template_id,
        schedule_type: editingJob.schedule_type,
        interval_minutes: editingJob.interval_minutes || 60,
        start_time: editingJob.start_time || '00:00',
        is_active: editingJob.is_active,
        is_global: editingJob.is_global,
        credential_id: editingJob.credential_id ?? null,
      })
    } else if (open && !editingJob) {
      form.reset(DEFAULT_SCHEDULE as FormData)
    }
  }, [open, editingJob, form])

  const onSubmit = form.handleSubmit(async (data) => {
    if (editingJob) {
      await updateSchedule.mutateAsync({ id: editingJob.id, data })
    } else {
      await createSchedule.mutateAsync(data as ScheduleFormData)
    }
    onOpenChange(false)
    onSuccess()
  })

  const scheduleType = form.watch('schedule_type')
  const startTime = form.watch('start_time')
  const intervalMinutes = form.watch('interval_minutes')
  const selectedTemplateId = form.watch('job_template_id')
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId)

  const requiresCredential = selectedTemplate &&
    (selectedTemplate.job_type === 'backup' || selectedTemplate.job_type === 'run_commands')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 px-6 py-4">
          <DialogHeader className="text-white">
            <DialogTitle className="text-lg font-semibold text-white">
              {editingJob ? "Edit Schedule" : "Create Schedule"}
            </DialogTitle>
            <DialogDescription className="text-blue-50">
              {editingJob ? "Update schedule settings" : "Schedule a job template to run automatically"}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Form content */}
        <Form {...form}>
          <form onSubmit={onSubmit} className="px-6 py-4 space-y-4">
            {/* Template and Identifier */}
            <div className="grid grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="job_template_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Template</FormLabel>
                    <Select
                      value={field.value?.toString()}
                      onValueChange={(v) => field.onChange(parseInt(v))}
                      disabled={!!editingJob}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id.toString()}>
                            <div className="flex items-center gap-2">
                              {template.is_global ? (
                                <Globe className="h-3.5 w-3.5 text-blue-500" />
                              ) : (
                                <User className="h-3.5 w-3.5 text-gray-400" />
                              )}
                              <span className="font-medium">{template.name}</span>
                              <span className="text-xs text-muted-foreground">
                                ({getJobTypeLabel(template.job_type)})
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="job_identifier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Schedule Identifier</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., daily-backup-core" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Template description */}
            {selectedTemplate && (
              <div className="px-3 py-2 rounded-md bg-gray-50 border border-gray-200 text-sm text-gray-600">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">
                    {getJobTypeLabel(selectedTemplate.job_type)}
                  </Badge>
                  {selectedTemplate.is_global ? (
                    <Badge className="text-xs bg-blue-100 text-blue-700">Global</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Private</Badge>
                  )}
                </div>
                {selectedTemplate.description || "No description provided"}
              </div>
            )}

            {/* Schedule Type and Timing */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="schedule_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Schedule</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="now">Run Once</SelectItem>
                        <SelectItem value="interval">Every X Minutes</SelectItem>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {scheduleType === 'interval' && (
                <FormField
                  control={form.control}
                  name="interval_minutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Interval (minutes)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={1440}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 60)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {['hourly', 'daily', 'weekly', 'monthly'].includes(scheduleType) && (
                <FormField
                  control={form.control}
                  name="start_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time (UTC)</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Timezone notice */}
            {['hourly', 'daily', 'weekly', 'monthly'].includes(scheduleType) && startTime && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-blue-50 border border-blue-200 text-sm">
                <Globe className="h-4 w-4 text-blue-500 shrink-0" />
                <p className="text-blue-700">
                  <span className="font-medium">All times are in UTC.</span>
                  {' '}For {startTime} UTC, that&apos;s{' '}
                  <span className="font-mono font-medium">{formatTimeWithTimezone(startTime)}</span>
                  {' '}local time.
                </p>
              </div>
            )}

            {/* Credential selector */}
            {requiresCredential && (
              <FormField
                control={form.control}
                name="credential_id"
                render={({ field }) => (
                  <FormItem className="pt-3 border-t">
                    <FormLabel>
                      Device Credentials <span className="text-red-500">*</span>
                    </FormLabel>
                    <Select
                      value={field.value?.toString() || 'none'}
                      onValueChange={(v) => field.onChange(v === 'none' ? null : parseInt(v))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select credentials" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="text-gray-400">No credential selected</span>
                        </SelectItem>
                        {credentials.map((cred) => (
                          <SelectItem key={cred.id} value={cred.id.toString()}>
                            <div className="flex items-center gap-2">
                              {cred.source === 'general' ? (
                                <Globe className="h-3.5 w-3.5 text-blue-500" />
                              ) : (
                                <User className="h-3.5 w-3.5 text-gray-400" />
                              )}
                              <span className="font-medium">{cred.name}</span>
                              <span className="text-xs text-muted-foreground">({cred.username})</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Options */}
            <div className="flex items-center gap-6 pt-3 border-t">
              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="!mt-0 cursor-pointer">Active</FormLabel>
                  </FormItem>
                )}
              />

              {user?.roles?.includes('admin') && !editingJob && (
                <FormField
                  control={form.control}
                  name="is_global"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3 pl-6 border-l">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="!mt-0 cursor-pointer flex items-center gap-2">
                        Global Schedule
                        <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                          Admin
                        </Badge>
                      </FormLabel>
                    </FormItem>
                  )}
                />
              )}
            </div>

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
                disabled={createSchedule.isPending || updateSchedule.isPending}
              >
                {editingJob ? (
                  <>
                    <Edit className="mr-2 h-4 w-4" />
                    Update Schedule
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Schedule
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

---

**3.3: Extract Schedule Card (1 hour)**

**File:** `components/schedule-card.tsx` (new)

```typescript
'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Clock, Play, Pause, Edit, Trash2, RefreshCw } from 'lucide-react'
import type { JobSchedule } from '../types'
import { useScheduleMutations } from '../hooks/use-schedule-mutations'
import { getScheduleTypeLabel, getScheduleTypeColor, getJobTypeLabel } from '../utils/schedule-utils'

interface ScheduleCardProps {
  schedule: JobSchedule
  onEdit: (schedule: JobSchedule) => void
}

export function ScheduleCard({ schedule, onEdit }: ScheduleCardProps) {
  const { toggleActive, deleteSchedule, runNow } = useScheduleMutations()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <CardTitle className="flex items-center gap-2">
              {schedule.job_identifier}
              {schedule.is_global && (
                <Badge variant="secondary" className="text-xs">Global</Badge>
              )}
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              {schedule.template_name && (
                <>
                  <span className="font-medium">{schedule.template_name}</span>
                  <span className="text-xs">•</span>
                </>
              )}
              {schedule.template_job_type && (
                <Badge variant="outline" className="text-xs">
                  {getJobTypeLabel(schedule.template_job_type)}
                </Badge>
              )}
            </CardDescription>
          </div>
          {schedule.is_active ? (
            <Badge className="bg-green-500">Active</Badge>
          ) : (
            <Badge variant="secondary">Paused</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${getScheduleTypeColor(schedule.schedule_type)}`} />
          <span className="text-sm font-medium">
            {getScheduleTypeLabel(schedule.schedule_type, schedule)}
          </span>
        </div>

        {schedule.last_run && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Last run: {new Date(schedule.last_run).toLocaleString()}</span>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => runNow.mutate({ id: schedule.id, identifier: schedule.job_identifier })}
            disabled={runNow.isPending}
            className="flex-1"
          >
            {runNow.isPending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Run Now
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit(schedule)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => toggleActive.mutate(schedule)}
            disabled={toggleActive.isPending}
          >
            {schedule.is_active ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => deleteSchedule.mutate(schedule.id)}
            disabled={deleteSchedule.isPending}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

---

**3.4: Extract Schedules Grid (1 hour)**

**File:** `components/schedules-grid.tsx` (new)

```typescript
'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, Plus, RefreshCw } from 'lucide-react'
import type { JobSchedule } from '../types'
import { ScheduleCard } from './schedule-card'

interface SchedulesGridProps {
  schedules: JobSchedule[]
  isLoading: boolean
  hasTemplates: boolean
  onCreateClick: () => void
  onEditSchedule: (schedule: JobSchedule) => void
}

export function SchedulesGrid({
  schedules,
  isLoading,
  hasTemplates,
  onCreateClick,
  onEditSchedule
}: SchedulesGridProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading schedules...</span>
        </CardContent>
      </Card>
    )
  }

  if (schedules.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-96">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-xl font-semibold mb-2">No schedules yet</p>
          <p className="text-muted-foreground mb-4">
            Create your first schedule using a job template
          </p>
          {!hasTemplates ? (
            <p className="text-sm text-amber-600">
              Create a job template first in Jobs → Job Templates
            </p>
          ) : (
            <Button onClick={onCreateClick}>
              <Plus className="mr-2 h-4 w-4" />
              Create Schedule
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {schedules.map((schedule) => (
        <ScheduleCard
          key={schedule.id}
          schedule={schedule}
          onEdit={onEditSchedule}
        />
      ))}
    </div>
  )
}
```

---

### Phase 4: Refactor Main Container (1 hour)

**File:** `jobs-scheduler-page.tsx` (refactored)

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar, Plus, Bug } from 'lucide-react'
import { useJobSchedules, useJobTemplates, useCredentials } from './hooks/use-schedule-queries'
import { ScheduleDebugDialog } from './components/schedule-debug-dialog'
import { ScheduleFormDialog } from './components/schedule-form-dialog'
import { SchedulesGrid } from './components/schedules-grid'
import type { JobSchedule } from './types'

export function JobsSchedulerPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDebugDialogOpen, setIsDebugDialogOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<JobSchedule | null>(null)

  // TanStack Query hooks - replaces all manual state management
  const { data: schedules = [], isLoading } = useJobSchedules()
  const { data: templates = [] } = useJobTemplates()
  const { data: credentials = [] } = useCredentials()

  const handleCreateClick = () => {
    setEditingJob(null)
    setIsDialogOpen(true)
  }

  const handleEditSchedule = (schedule: JobSchedule) => {
    setEditingJob(schedule)
    setIsDialogOpen(true)
  }

  const handleDialogClose = () => {
    setIsDialogOpen(false)
    setEditingJob(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Calendar className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Job Scheduler</h1>
            <p className="text-gray-600 mt-1">
              Schedule automated tasks using job templates
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsDebugDialogOpen(true)}>
            <Bug className="mr-2 h-4 w-4" />
            Debug Scheduler
          </Button>
          <Button onClick={handleCreateClick}>
            <Plus className="mr-2 h-4 w-4" />
            New Schedule
          </Button>
        </div>
      </div>

      {/* Schedules Grid */}
      <SchedulesGrid
        schedules={schedules}
        isLoading={isLoading}
        hasTemplates={templates.length > 0}
        onCreateClick={handleCreateClick}
        onEditSchedule={handleEditSchedule}
      />

      {/* Debug Dialog */}
      <ScheduleDebugDialog
        open={isDebugDialogOpen}
        onOpenChange={setIsDebugDialogOpen}
      />

      {/* Form Dialog */}
      <ScheduleFormDialog
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        editingJob={editingJob}
        templates={templates}
        credentials={credentials}
        onSuccess={() => {
          // TanStack Query automatically refetches after mutation
        }}
      />
    </div>
  )
}
```

**Before:** 1,168 lines
**After:** ~150 lines
**Reduction:** -1,018 lines (-87%)

---

## Final Directory Structure

```
/components/features/jobs/scheduler/
├── jobs-scheduler-page.tsx           # ~150 lines (was 1,168, -87%)
├── components/
│   ├── schedule-debug-dialog.tsx     # ~200 lines
│   ├── schedule-form-dialog.tsx      # ~250 lines
│   ├── schedules-grid.tsx            # ~100 lines
│   └── schedule-card.tsx             # ~80 lines
├── hooks/
│   ├── use-schedule-queries.ts       # ~120 lines
│   └── use-schedule-mutations.ts     # ~150 lines
├── types/
│   └── index.ts                      # ~80 lines
└── utils/
    ├── constants.ts                  # ~70 lines
    └── schedule-utils.ts             # ~50 lines
```

**Total:** ~1,250 lines across 11 files (vs 1,168 in 1 file)
**Net change:** +82 lines (+7%), but vastly improved architecture

---

## Summary of Changes

| File | Before | After | Change |
|------|--------|-------|--------|
| `jobs-scheduler-page.tsx` | 1,168 | ~150 | **-1,018 lines (-87%)** |
| New components | 0 | ~630 | **+630 lines** |
| New hooks | 0 | ~270 | **+270 lines** |
| New types/utils | 0 | ~200 | **+200 lines** |
| **Total** | **1,168** | **~1,250** | **+82 lines (+7%)** |

**Net increase** of 82 lines, but with dramatically better architecture:
- Proper separation of concerns
- TanStack Query compliance (mandatory)
- Form validation with zod
- Reusable components and hooks
- Better testability
- Easier maintainability
- Consistent with job templates/runs components

---

## Architecture Compliance (CLAUDE.md)

### Success Metrics

**Code Quality:**
- [ ] Component size < 300 lines each (main container ~150 lines)
- [ ] No duplicate API call logic (unified in query/mutation hooks)
- [ ] No manual `useState` for server data (TanStack Query only)
- [ ] Forms use react-hook-form + zod
- [ ] No inline arrays/objects in default parameters
- [ ] Exhaustive useEffect dependencies
- [ ] Zero ESLint warnings

**Architecture Compliance:**
- [ ] All data fetching uses TanStack Query
- [ ] Query keys in centralized factory (`/lib/query-keys.ts`)
- [ ] API calls via proxy pattern
- [ ] Feature-based folder structure (components/, hooks/, types/, utils/)
- [ ] All UI components from Shadcn
- [ ] Backend has repository/service/router layers
- [ ] Backend routes use auth dependencies

**User Experience:**
- [ ] No regression in functionality
- [ ] Improved loading states (TanStack Query built-in)
- [ ] Better error messages (Toast notifications)
- [ ] Faster perceived performance (automatic caching)
- [ ] Form validation feedback

**Developer Experience:**
- [ ] Easier to test (isolated hooks and components)
- [ ] Clear component boundaries
- [ ] Reusable hooks
- [ ] Type safety throughout
- [ ] Consistent with other job components

---

## Anti-Patterns to Avoid

### ❌ DO NOT Do These During Refactoring

**1. Don't Keep Manual State for Server Data**
- ❌ `const [jobSchedules, setJobSchedules] = useState<JobSchedule[]>([])`
- ❌ `useEffect(() => { fetchJobSchedules() }, [])`
- ✅ **Instead:** `const { data: schedules } = useJobSchedules()`

**2. Don't Keep Manual Loading State Management**
- ❌ `const [loading, setLoading] = useState(false)`
- ❌ `const [debugLoading, setDebugLoading] = useState(false)`
- ✅ **Instead:** TanStack Query provides `isLoading`

**3. Don't Use Custom Form Validation**
- ❌ `if (!formIdentifier) return`
- ❌ Manual onChange handlers
- ✅ **Instead:** react-hook-form + zod

**4. Don't Skip Form Validation Library**
- ❌ Direct state updates with `setState`
- ✅ **Instead:** `useForm` with `zodResolver`

**5. Don't Keep All Logic in One File**
- ❌ 1,168-line monolithic component
- ✅ **Instead:** Decompose into focused components < 300 lines

**6. Don't Forget Query Key Factory**
- ❌ Direct API calls without query keys
- ✅ **Instead:** Use `queryKeys.jobs.*` from centralized factory

---

## Comparison with Other Job Components

| Metric | Job Templates | Job Runs | **Scheduler (Current)** | **Scheduler (After)** |
|--------|---------------|----------|-------------------------|----------------------|
| Lines of Code | ~400 | ~500 | 1,168 | ~150 (main) |
| TanStack Query | ✅ Yes | ✅ Yes | ❌ NO | ✅ Yes |
| Form Validation | ✅ Yes (zod) | N/A | ❌ NO | ✅ Yes (zod) |
| Query Keys | ✅ Yes | ✅ Yes | ❌ NO | ✅ Yes |
| Decomposed | ✅ Yes | ✅ Yes | ❌ NO | ✅ Yes |
| Compliance | ✅ Full | ✅ Full | ❌ **0/6** | ✅ Full |

**The scheduler will match the architecture of its sibling components.**

---

## Recommended Refactoring Order

1. **Phase 1.2** - Extract constants (15 min, zero risk)
2. **Phase 1.3** - Extract types (30 min, zero risk)
3. **Phase 1.4** - Extract utilities (30 min, zero risk)
4. **Phase 1.5** - Expand query keys (15 min)
5. **Phase 1.1** - Verify backend (30 min)
6. **Phase 2.1** - Create query hooks (2 hours)
7. **Phase 2.2** - Create mutation hooks (2 hours)
8. **Phase 3.1** - Extract debug dialog (1.5 hours)
9. **Phase 3.2** - Extract form dialog (2.5 hours)
10. **Phase 3.3-3.4** - Extract grid components (2 hours)
11. **Phase 4** - Refactor main container (1 hour)
12. **Testing** - Comprehensive testing (3 hours)

**Total:** ~16 hours (~2 days)

---

## Risk Assessment

### Breaking Changes
- ❌ **NONE** - TanStack Query is drop-in replacement
- ❌ **NONE** - Component decomposition is internal refactoring
- ❌ **NONE** - Form validation adds safety without removing functionality

### Testing Required
- ✅ Create schedule
- ✅ Edit schedule
- ✅ Delete schedule
- ✅ Toggle active/inactive
- ✅ Run now
- ✅ Debug dialog with recalculate
- ✅ Form validation
- ✅ Error handling
- ✅ Loading states

---

## Notes

- **Pattern Consistency:** Job templates and runs already use TanStack Query - follow their implementation
- **Form Complexity:** 300-line form dialog needs proper react-hook-form + zod validation
- **Debug Dialog:** Self-contained, easy to extract
- **Backend Verification:** Confirm `/api/proxy/api/job-schedules` endpoint pattern
- **Query Keys:** Expand existing `jobs.schedules()` key
- **No Polling:** Unlike Celery Settings, no manual polling bug to fix
- **Priority:** HIGH due to size and architecture violations

---

**Document Version:** 1.0
**Created:** 2026-01-29
**Status:** Planning
**Priority:** HIGH
**Complexity:** Medium-High (large file, complex form, but no critical bugs)
