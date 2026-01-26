# Refactoring Plan: Jobs View Page

**Component:** `frontend/src/components/features/jobs/view/jobs-view-page.tsx`
**Created:** 2026-01-25
**Status:** Planning
**Lines of Code:** 919

## TL;DR - What's Wrong & How to Fix It

**Problems:**
1.  🚫 **Architecture Violation** - extensive use of manual `fetch`, `useState`, and `useEffect` for data fetching instead of mandatory TanStack Query.
2.  ⚠️ **Manual Polling Risk** - Custom `setInterval` used for auto-refreshing job list and progress (lines 281-291, 294-347).
3.  📏 **Monolithic Component** - Over 900 lines handling UI, filtering logic, data fetching, and complex interactions.
4.  🔁 **Code Duplication** - Repeated headers and error handling logic in multiple `fetch` calls.
5.  🧩 **Complex State Management** - Manual management of multiple filters, pagination, and 15+ loading states.
6.  🪵 **Console Logs** - Production code contains `console.log` (lines 286, 336, 415).
7.  🚨 **Confirm Dialog** - Uses native `confirm()` (line 225) instead of Shadcn AlertDialog.

**Solution:**
1.  ✅ **Migrate to TanStack Query** - Replace manual `fetch` with custom hooks (`useJobsQuery`, `useJobMutations`).
2.  ✅ **Use Auto-Polling** - Leverage TanStack Query's `refetchInterval` to handle background updates safely.
3.  ✅ **Decompose Component** - Break down into `JobsFilter`, `JobsTable`, `JobStatusBadge`, and `JobActionsMenu`.
4.  ✅ **Centralize Logic** - Move filter state management to URL search params for shareable links.
5.  ✅ **Standardize Keys** - Expand `queryKeys.jobs` to support all filter combinations.
6.  ✅ **Replace Confirm** - Use AlertDialog component instead of native `confirm()`.

**Critical Path:** Phase 1 (Foundation) → Phase 3 (TanStack Query) → Phase 2 (Decomposition) → Phase 4 (Integration)

---

## Executive Summary

The `JobsViewPage` is a core operational component that has grown into a 919-line monolith. It violates the core architectural requirement of using TanStack Query for server state. The current manual polling implementation for job progress is fragile and prone to race conditions or memory leaks if not handled perfectly.

Migrating to TanStack Query is not just a style choice; it is mandatory per `CLAUDE.md` to ensure consistent caching, deduping, and auto-revalidation across the application.

### Critical Issues

1. **Architecture Violation** - Uses manual `useState` + `useEffect` instead of mandatory TanStack Query
2. **Manual Polling Bug Risk** - Two separate `setInterval` loops (lines 281-291, 294-347) for auto-refresh
3. **No Component Decomposition** - Single 919-line component handles everything
4. **15+ Manual State Hooks** - Separate `useState` for data, loading states, and filters
5. **Missing Standards** - Uses native `confirm()` instead of AlertDialog, has `console.log` in production
6. **No Query Key Factory** - Direct API calls without centralized query keys
7. **No URL Persistence** - Filter state not in URL (non-shareable links)

**Bottom Line:** TanStack Query migration is mandatory per CLAUDE.md and eliminates 200+ lines of manual state management automatically. The manual polling logic is a critical bug risk similar to Check IP component.

## Key Changes Summary

| Current Approach | Required Approach (CLAUDE.md) |
|------------------|-------------------------------|
| Manual `fetch` + `useEffect` | **TanStack Query hooks** |
| `setInterval` for polling | **`refetchInterval` in useQuery** |
| 919-line monolithic file | **< 300 lines per component** |
| Manual filter state | **URL-based state (shareable)** |
| `console.log` for debugging | **Proper logging or removal** |
| Inline duplication of API logic | **Centralized query/mutation hooks** |
| Native `confirm()` | **Shadcn AlertDialog** |
| 15+ manual loading states | **TanStack Query built-in states** |

---

## Quick Wins (Can Start Immediately)

These tasks can be done right now without breaking existing functionality:

### 1. Extract Type Definitions
- File already exists: `types/job-results.ts`
- Add missing interfaces for filters and API responses
- No behavioral changes

### 2. Extract Constants
- Create `utils/constants.ts`
- Move `statusOptions`, `jobTypeOptions`, `triggerOptions` (lines 476-499)
- Move `EMPTY_ARRAY` and add other constant arrays
- Fixes potential re-render issues

### 3. Extract Utility Functions
- Create `utils/job-utils.ts`
- Move `getStatusBadgeClasses` (lines 349-358)
- Move `getTriggerBadgeClasses` (lines 360-367)
- Move `formatDuration` (lines 369-387)
- Move `formatDateTime` (lines 389-398)
- Add new utilities: `isJobActive()`, `hasActiveJobs()`

### 4. Add Query Keys
- Add to `/lib/query-keys.ts`
- Set up foundation for TanStack Query migration

### 5. Verify Backend Architecture
- Confirm backend endpoints use repository/service/router layers
- Check for proper auth (`verify_token`, `require_permission`)
- Verify API endpoints support all filter combinations
- Check pagination support

**Total:** ~2 hours
**Risk:** Zero (no behavioral changes)
**Benefit:** Immediate code quality improvement, sets up for TanStack Query migration

---

## Current Architecture

```
frontend/src/components/features/jobs/view/
├── jobs-view-page.tsx       # 919 lines - Everything
└── types/
    └── job-results.ts       # 459 lines - Type definitions
```

**Responsibilities:**
-   Fetching job list with pagination & filters (lines 79-120)
-   Fetching templates for filter dropdown (lines 57-77)
-   Managing filter state - 4 separate filters (lines 45-48)
-   Polling for active jobs every 3s (lines 281-291)
-   Polling for backup progress every 3s (lines 294-347)
-   Cancelling/Deleting/Clearing jobs (lines 122-274)
-   Rendering the main table and all filter UI (lines 501-918)
-   15+ manual loading states (lines 40-54)

---

## Problem Analysis

### Problem 1: Manual Data Fetching & State

**Affected Lines:** 39-55 (State), 79-120 (Fetching), 57-77 (Templates)

The component manually manages extensive state:

```typescript
// Lines 39-54: Manual state management
const [jobRuns, setJobRuns] = useState<JobRun[]>(EMPTY_ARRAY)
const [loading, setLoading] = useState(true)
const [page, setPage] = useState(1)
const [pageSize] = useState(25)
const [totalPages, setTotalPages] = useState(1)
const [total, setTotal] = useState(0)
const [statusFilter, setStatusFilter] = useState<string[]>([])
const [jobTypeFilter, setJobTypeFilter] = useState<string[]>([])
const [triggerFilter, setTriggerFilter] = useState<string[]>([])
const [templateFilter, setTemplateFilter] = useState<string[]>([])
const [availableTemplates, setAvailableTemplates] = useState<Array<{id: number, name: string}>>([])
const [cancellingId, setCancellingId] = useState<number | null>(null)
const [deletingId, setDeletingId] = useState<number | null>(null)
const [clearing, setClearing] = useState(false)
const [viewingResult, setViewingResult] = useState<JobRun | null>(null)
const [jobProgress, setJobProgress] = useState<Record<number, { completed: number; total: number; percentage: number }>>({})
```

**Issues:**
- 16 separate `useState` hooks!
- Manual loading state management
- No caching mechanism - data refetched on every filter change
- Manual state updates
- Violates CLAUDE.md mandatory TanStack Query requirement

**Manual Fetch Example (Lines 79-120):**
```typescript
const fetchJobRuns = useCallback(async () => {
  if (!token) return

  try {
    setLoading(true)
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
    })

    if (statusFilter.length > 0) {
      params.append("status", statusFilter.join(","))
    }
    // ... more filters

    const response = await fetch(`/api/proxy/job-runs?${params.toString()}`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (response.ok) {
      const data: PaginatedResponse = await response.json()
      setJobRuns(data.items || [])
      setTotal(data.total)
      setTotalPages(data.total_pages)
    }
  } catch (error) {
    console.error("Error fetching job runs:", error)
  } finally {
    setLoading(false)
  }
}, [token, page, pageSize, statusFilter, jobTypeFilter, triggerFilter, templateFilter])
```

This bypasses the caching and stale-time optimization provided by TanStack Query.

---

### Problem 2: Manual Polling Logic (CRITICAL BUG RISK)

**Affected Lines:** 281-347

Two separate `useEffect` hooks manage polling:

**1. Auto-refresh job list (Lines 281-291):**
```typescript
// Auto-refresh for running jobs
useEffect(() => {
  const hasRunningJobs = jobRuns.some(run => run.status === "running" || run.status === "pending")
  if (!hasRunningJobs) return

  const interval = setInterval(() => {
    console.log('[Jobs] Auto-refreshing job list...')
    fetchJobRuns()
  }, 3000) // Refresh every 3 seconds for faster updates

  return () => clearInterval(interval)
}, [jobRuns, fetchJobRuns])
```

**Issues:**
- **SAME PATTERN AS CHECK IP BUG** - Manual polling with useEffect + setInterval
- `fetchJobRuns` dependency could cause stale closure bug
- Should use TanStack Query `refetchInterval` instead
- Potential memory leak if cleanup fails
- `console.log` in production code

**2. Poll backup progress (Lines 294-347):**
```typescript
// Poll progress for running backup jobs
useEffect(() => {
  if (!token) return

  const runningBackupJobs = jobRuns.filter(run =>
    run.status === "running" &&
    (run.job_type === "backup" || run.job_type === "Backup")
  )

  if (runningBackupJobs.length === 0) {
    setJobProgress({})
    return
  }

  const fetchProgress = async () => {
    const progressPromises = runningBackupJobs.map(async (run) => {
      try {
        const response = await fetch(`/api/proxy/job-runs/${run.id}/progress`, {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        })
        if (response.ok) {
          const data = await response.json()
          return { runId: run.id, progress: data }
        }
      } catch (error) {
        console.error(`Error fetching progress for job ${run.id}:`, error)
      }
      return null
    })

    const results = await Promise.all(progressPromises)
    const newProgress: Record<number, { completed: number; total: number; percentage: number }> = {}

    results.forEach(result => {
      if (result && result.progress.completed !== null && result.progress.total !== null) {
        newProgress[result.runId] = {
          completed: result.progress.completed,
          total: result.progress.total,
          percentage: result.progress.percentage || 0,
        }
        console.log(`[Job ${result.runId}] Progress: ${result.progress.completed}/${result.progress.total} (${result.progress.percentage}%)`)
      }
    })

    setJobProgress(newProgress)
  }

  fetchProgress()
  const interval = setInterval(fetchProgress, 3000) // Poll every 3 seconds

  return () => clearInterval(interval)
}, [jobRuns, token])
```

**Issues:**
- Multiple API calls per polling cycle (one per backup job)
- Complex async logic in useEffect
- `console.log` in production
- Dependency on `jobRuns` and `token` could cause re-subscription issues
- No automatic stop on component unmount

**This is a critical bug risk** - similar to the Check IP component polling bug.

---

### Problem 3: Duplicate API Call Pattern

**Affected Lines:**
- `fetchTemplates()` - Lines 57-77
- `fetchJobRuns()` - Lines 79-120
- `cancelJobRun()` - Lines 122-159
- `deleteJobRun()` - Lines 161-198
- `clearHistory()` - Lines 217-274
- `viewJobResult()` - Lines 400-431

**Pattern Repetition:**
```typescript
// Every function has identical structure:
try {
  setLoadingX(true)
  const response = await fetch('endpoint', {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  })
  if (response.ok) {
    // handle success
  } else {
    // handle error with toast
  }
} catch (error) {
  console.error('Error:', error)
  toast({ /* error */ })
} finally {
  setLoadingX(false)
}
```

**Issue:** Every API call has identical error handling, loading state management, and header logic.

---

### Problem 4: Filter Logic Complexity

**Affected Lines:** 447-473, 476-499

Manual toggle functions for 4 different filter types:

```typescript
// Lines 447-473: Toggle functions
const toggleStatusFilter = (value: string) => {
  setStatusFilter(prev =>
    prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
  )
  setPage(1)
}

const toggleJobTypeFilter = (value: string) => {
  setJobTypeFilter(prev =>
    prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
  )
  setPage(1)
}

const toggleTriggerFilter = (value: string) => {
  setTriggerFilter(prev =>
    prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
  )
  setPage(1)
}

const toggleTemplateFilter = (value: string) => {
  setTemplateFilter(prev =>
    prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
  )
  setPage(1)
}
```

**Issues:**
- Repetitive code (same pattern 4 times)
- Filter state is local and resets on unmount
- Not in URL (links not shareable)
- Resets page to 1 on every filter change

**Filter Options (Lines 476-499):**
```typescript
const statusOptions = [
  { value: "pending", label: "Pending" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
]

const jobTypeOptions = [
  { value: "backup", label: "Backup" },
  { value: "cache_devices", label: "Cache Devices" },
  // ... 6 more
]

const triggerOptions = [
  { value: "manual", label: "Manual" },
  { value: "schedule", label: "Schedule" },
  { value: "system", label: "System" },
]
```

**Issue:** Inline arrays recreated on every render (should be constants).

---

### Problem 5: Monolithic Component Structure

**Single component (919 lines) handles:**
1. Header and page layout (lines 501-677)
2. Filter dropdowns with complex state (lines 517-651)
3. Empty state rendering (lines 679-699)
4. Table with all job data (lines 701-874)
5. Pagination controls (lines 877-906)
6. Dialog for viewing results (lines 911-915)
7. Utility functions (lines 349-398, 447-473)
8. API calls (lines 57-274, 400-431)
9. Complex badge rendering logic (inline in table)
10. Progress bar rendering for backup jobs (inline in table)

**Should be:** 6-8 separate components with clear boundaries

---

### Problem 6: Native Confirm Dialog

**Affected Lines:** 225

```typescript
if (!confirm(confirmMsg)) return
```

**Issue:** Uses browser native `confirm()` instead of Shadcn UI `AlertDialog` component per CLAUDE.md standards.

---

### Problem 7: Console Logs in Production

**Affected Lines:** 71, 116, 150, 189, 265, 286, 336, 415, 424

Multiple `console.error()` and `console.log()` calls throughout:
- Line 71: `console.error("Error fetching templates:", error)`
- Line 116: `console.error("Error fetching job runs:", error)`
- Line 286: `console.log('[Jobs] Auto-refreshing job list...')`
- Line 336: `console.log(\`[Job ${result.runId}] Progress: ...`)`
- Line 415: `console.log('[Jobs] Opened result dialog...')`

**Issue:** Production code should not have console logging.

---

## Proposed Refactoring Plan

### Phase 1: Foundation & Setup (CRITICAL)

**1.1: Verify Backend Architecture & API Pattern**

Check the following backend endpoints:

- `GET /api/proxy/job-runs` - List jobs with pagination & filters
  - Query params: `page`, `page_size`, `status`, `job_type`, `triggered_by`, `template_id`
  - All params support comma-separated values for multi-select
  - Response format: `{ items: JobRun[], total: number, page: number, page_size: number, total_pages: number }`

- `GET /api/proxy/job-runs/templates` - Get available templates
  - Response format: `{ templates: Array<{ id: number, name: string }> }`

- `GET /api/proxy/job-runs/{id}` - Get single job details
  - Response format: `JobRun`

- `GET /api/proxy/job-runs/{id}/progress` - Get backup job progress
  - Response format: `{ completed: number, total: number, percentage: number }`

- `POST /api/proxy/job-runs/{id}/cancel` - Cancel running job
  - Permissions: `jobs:write`
  - Response format: `{ success: boolean, message?: string }`

- `DELETE /api/proxy/job-runs/{id}` - Delete job entry
  - Permissions: `jobs:delete`
  - Response format: `{ success: boolean, message?: string }`

- `DELETE /api/proxy/job-runs/clear-filtered` - Clear filtered jobs
  - Query params: same as list endpoint
  - Permissions: `jobs:delete`
  - Response format: `{ success: boolean, message: string, deleted_count: number }`

- `DELETE /api/proxy/job-runs/clear-all` - Clear all job history
  - Permissions: `jobs:delete` (or `admin`)
  - Response format: `{ success: boolean, message: string, deleted_count: number }`

**Verify:**
- [ ] Backend uses repository pattern
- [ ] Service layer exists for job operations
- [ ] Routers use `verify_token()` and `require_permission()`
- [ ] All filter combinations supported
- [ ] Pagination works correctly
- [ ] Progress endpoint only for backup jobs?

---

**1.2: Add Query Keys to Centralized Factory**

**File:** `/frontend/src/lib/query-keys.ts` (modify)

```typescript
// Add to existing queryKeys object
jobs: {
  all: ['jobs'] as const,

  // List with all filter combinations
  list: (params?: JobSearchParams) =>
    params
      ? ([...queryKeys.jobs.all, 'list', params] as const)
      : ([...queryKeys.jobs.all, 'list'] as const),

  // Individual job detail
  detail: (id: number) => [...queryKeys.jobs.all, 'detail', id] as const,

  // Progress endpoint (for backup jobs)
  progress: (id: number) => [...queryKeys.jobs.all, 'progress', id] as const,

  // Templates dropdown
  templates: () => [...queryKeys.jobs.all, 'templates'] as const,
},
```

---

**1.3: Update Type Definitions**

**File:** `components/features/jobs/view/types/index.ts` (new - supplement existing job-results.ts)

```typescript
// Re-export from job-results.ts
export * from './job-results'

// Filter and API request types
export interface JobSearchParams {
  page?: number
  page_size?: number
  status?: string | string[]
  job_type?: string | string[]
  triggered_by?: string | string[]
  template_id?: string | string[]
}

// Template list response
export interface TemplatesResponse {
  templates: JobTemplate[]
}

export interface JobTemplate {
  id: number
  name: string
}

// Progress response (for backup jobs)
export interface JobProgressResponse {
  completed: number
  total: number
  percentage: number
}

// Mutation responses
export interface JobActionResponse {
  success: boolean
  message?: string
}

export interface ClearHistoryResponse {
  success: boolean
  message: string
  deleted_count: number
}

// Filter option type
export interface FilterOption {
  value: string
  label: string
}
```

---

**1.4: Create Constants**

**File:** `components/features/jobs/view/utils/constants.ts` (new)

```typescript
import type { FilterOption, JobRun, JobTemplate } from '../types'

// React best practice: Extract default arrays to prevent re-render loops
export const EMPTY_ARRAY: JobRun[] = []
export const EMPTY_TEMPLATES: JobTemplate[] = []

// Filter options
export const STATUS_OPTIONS: readonly FilterOption[] = [
  { value: "pending", label: "Pending" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
] as const

export const JOB_TYPE_OPTIONS: readonly FilterOption[] = [
  { value: "backup", label: "Backup" },
  { value: "cache_devices", label: "Cache Devices" },
  { value: "cache_locations", label: "Cache Locations" },
  { value: "cache_git_commits", label: "Cache Git Commits" },
  { value: "sync_devices", label: "Sync Devices" },
  { value: "run_commands", label: "Run Commands" },
  { value: "compare_devices", label: "Compare Devices" },
  { value: "scan_prefixes", label: "Scan Prefixes" },
] as const

export const TRIGGER_OPTIONS: readonly FilterOption[] = [
  { value: "manual", label: "Manual" },
  { value: "schedule", label: "Schedule" },
  { value: "system", label: "System" },
] as const

// Cache durations for TanStack Query
export const STALE_TIME = {
  JOBS_LIST: 10 * 1000,      // 10s - frequently changing when jobs running
  TEMPLATES: 5 * 60 * 1000,  // 5 min - rarely changes
  PROGRESS: 0,               // Always fresh for active jobs
  DETAIL: 30 * 1000,         // 30s - for job detail view
} as const

// Polling intervals
export const JOB_POLL_INTERVAL = 3000 // 3 seconds for auto-refresh
export const PROGRESS_POLL_INTERVAL = 3000 // 3 seconds for backup progress

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 25
export const DEFAULT_PAGE = 1
```

---

**1.5: Create Utility Functions**

**File:** `components/features/jobs/view/utils/job-utils.ts` (new)

```typescript
import type { JobRun } from '../types'
import type { BadgeProps } from '@/components/ui/badge'

/**
 * Check if job is still active (running or pending)
 */
export function isJobActive(status: string): boolean {
  return status === 'running' || status === 'pending'
}

/**
 * Check if any jobs in the list are active
 */
export function hasActiveJobs(jobs: JobRun[]): boolean {
  return jobs.some(job => isJobActive(job.status))
}

/**
 * Check if job is a backup job
 */
export function isBackupJob(jobType: string): boolean {
  return jobType.toLowerCase() === 'backup'
}

/**
 * Get badge CSS classes for job status
 */
export function getStatusBadgeClasses(status: string): string {
  const classes: Record<string, string> = {
    completed: "bg-green-100 text-green-700 border-green-200",
    running: "bg-blue-100 text-blue-700 border-blue-200 animate-pulse",
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    failed: "bg-red-100 text-red-700 border-red-200",
    cancelled: "bg-slate-100 text-slate-600 border-slate-200",
  }
  return classes[status.toLowerCase()] || "bg-slate-100 text-slate-600 border-slate-200"
}

/**
 * Get badge variant for job status
 */
export function getStatusBadgeVariant(status: string): BadgeProps['variant'] {
  const normalized = status.toLowerCase()
  if (normalized === 'completed') return 'default'
  if (normalized === 'failed') return 'destructive'
  return 'secondary'
}

/**
 * Get badge CSS classes for trigger type
 */
export function getTriggerBadgeClasses(triggeredBy: string): string {
  const classes: Record<string, string> = {
    manual: "bg-purple-100 text-purple-700 border-purple-200",
    system: "bg-cyan-100 text-cyan-700 border-cyan-200",
    schedule: "bg-slate-100 text-slate-600 border-slate-200",
  }
  return classes[triggeredBy.toLowerCase()] || "bg-slate-100 text-slate-600 border-slate-200"
}

/**
 * Format job duration in human-readable form
 */
export function formatDuration(
  durationSeconds: number | null,
  startedAt: string | null,
  completedAt: string | null
): string {
  if (durationSeconds !== null) {
    const duration = Math.round(durationSeconds)
    if (duration < 60) return `${duration}s`
    if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`
    return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`
  }

  if (startedAt && !completedAt) {
    // Still running - calculate from start
    const start = new Date(startedAt).getTime()
    const duration = Math.floor((Date.now() - start) / 1000)
    if (duration < 60) return `${duration}s`
    if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`
    return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`
  }

  return "-"
}

/**
 * Format timestamp to localized string
 */
export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "-"
  const date = new Date(dateStr)
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Calculate progress percentage from completed/total
 */
export function calculateProgress(completed: number, total: number): number {
  if (total === 0) return 0
  return Math.round((completed / total) * 100)
}
```

---

### Phase 3: TanStack Query Migration (CRITICAL - Mandatory)

**Note:** TanStack Query is mandatory for all data fetching per CLAUDE.md. This replaces manual state management entirely and fixes the polling bug.

**3.1: Create Query Hooks**

**File:** `hooks/use-jobs-query.ts` (new)

```typescript
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { PaginatedResponse, JobSearchParams } from '../types'
import { STALE_TIME, JOB_POLL_INTERVAL } from '../utils/constants'
import { hasActiveJobs } from '../utils/job-utils'

interface UseJobsQueryOptions {
  params?: JobSearchParams
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseJobsQueryOptions = { enabled: true }

/**
 * Fetch paginated job runs with filters and auto-refresh
 * CRITICAL: Uses TanStack Query refetchInterval to replace manual setInterval polling
 */
export function useJobsQuery(options: UseJobsQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { params, enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.list(params),
    queryFn: async () => {
      // Build query string from params
      const searchParams = new URLSearchParams()

      if (params?.page) searchParams.append('page', params.page.toString())
      if (params?.page_size) searchParams.append('page_size', params.page_size.toString())

      // Handle multi-select filters
      if (params?.status) {
        const statusArr = Array.isArray(params.status) ? params.status : [params.status]
        if (statusArr.length > 0) searchParams.append('status', statusArr.join(','))
      }
      if (params?.job_type) {
        const typeArr = Array.isArray(params.job_type) ? params.job_type : [params.job_type]
        if (typeArr.length > 0) searchParams.append('job_type', typeArr.join(','))
      }
      if (params?.triggered_by) {
        const triggerArr = Array.isArray(params.triggered_by) ? params.triggered_by : [params.triggered_by]
        if (triggerArr.length > 0) searchParams.append('triggered_by', triggerArr.join(','))
      }
      if (params?.template_id) {
        const templateArr = Array.isArray(params.template_id) ? params.template_id : [params.template_id]
        if (templateArr.length > 0) searchParams.append('template_id', templateArr.join(','))
      }

      const queryString = searchParams.toString()
      const endpoint = queryString ? `job-runs?${queryString}` : 'job-runs'

      const response = await apiCall<PaginatedResponse>(endpoint, { method: 'GET' })
      return response
    },
    enabled,
    staleTime: STALE_TIME.JOBS_LIST,
    // Keep previous data while fetching next page (prevents UI flicker)
    placeholderData: keepPreviousData,

    // Auto-refresh when jobs are running
    // CRITICAL: Replaces manual setInterval (lines 281-291)
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data?.items) return false

      // Auto-poll every 3s if any job is running/pending
      return hasActiveJobs(data.items) ? JOB_POLL_INTERVAL : false
    },
  })
}
```

---

**3.2: Create Templates Query Hook**

**File:** `hooks/use-job-templates-query.ts` (new)

```typescript
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { TemplatesResponse } from '../types'
import { STALE_TIME } from '../utils/constants'

interface UseJobTemplatesQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseJobTemplatesQueryOptions = { enabled: true }

/**
 * Fetch available job templates for filter dropdown
 */
export function useJobTemplatesQuery(options: UseJobTemplatesQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.templates(),
    queryFn: async () => {
      const response = await apiCall<TemplatesResponse>('job-runs/templates', { method: 'GET' })
      return response.templates || []
    },
    enabled,
    staleTime: STALE_TIME.TEMPLATES,
  })
}
```

---

**3.3: Create Job Progress Query Hook**

**File:** `hooks/use-job-progress-query.ts` (new)

```typescript
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { JobRun, JobProgressResponse } from '../types'
import { STALE_TIME, PROGRESS_POLL_INTERVAL } from '../utils/constants'
import { isJobActive, isBackupJob } from '../utils/job-utils'

interface UseJobProgressQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseJobProgressQueryOptions = { enabled: true }

/**
 * Fetch progress for a specific backup job
 * CRITICAL: Uses TanStack Query refetchInterval to replace manual setInterval polling (lines 294-347)
 *
 * Only enabled for running backup jobs
 * Auto-stops polling when job completes
 */
export function useJobProgressQuery(
  job: JobRun | null,
  options: UseJobProgressQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  const shouldPoll = !!(
    job &&
    enabled &&
    isJobActive(job.status) &&
    isBackupJob(job.job_type)
  )

  return useQuery({
    queryKey: queryKeys.jobs.progress(job?.id ?? 0),
    queryFn: async () => {
      if (!job) throw new Error('No job provided')

      const response = await apiCall<JobProgressResponse>(
        `job-runs/${job.id}/progress`,
        { method: 'GET' }
      )
      return response
    },
    enabled: shouldPoll,
    staleTime: STALE_TIME.PROGRESS,

    // Poll every 3s for active backup jobs
    // Auto-stops when job completes (shouldPoll becomes false)
    refetchInterval: shouldPoll ? PROGRESS_POLL_INTERVAL : false,
  })
}

/**
 * Hook for fetching progress of ALL running backup jobs at once
 * Better performance than polling each job individually
 */
export function useAllJobsProgress(jobs: JobRun[]) {
  const { apiCall } = useApi()

  const runningBackupJobs = jobs.filter(job =>
    isJobActive(job.status) && isBackupJob(job.job_type)
  )

  const hasRunningBackups = runningBackupJobs.length > 0

  return useQuery({
    queryKey: [...queryKeys.jobs.all, 'all-progress', runningBackupJobs.map(j => j.id)],
    queryFn: async () => {
      // Fetch progress for all running backup jobs in parallel
      const progressPromises = runningBackupJobs.map(async (job) => {
        try {
          const response = await apiCall<JobProgressResponse>(
            `job-runs/${job.id}/progress`,
            { method: 'GET' }
          )
          return { jobId: job.id, progress: response }
        } catch (error) {
          return { jobId: job.id, progress: null }
        }
      })

      const results = await Promise.all(progressPromises)

      // Convert to map for easy lookup
      const progressMap: Record<number, JobProgressResponse> = {}
      results.forEach(({ jobId, progress }) => {
        if (progress) {
          progressMap[jobId] = progress
        }
      })

      return progressMap
    },
    enabled: hasRunningBackups,
    staleTime: STALE_TIME.PROGRESS,
    refetchInterval: hasRunningBackups ? PROGRESS_POLL_INTERVAL : false,
  })
}
```

---

**3.4: Create Job Detail Query Hook**

**File:** `hooks/use-job-detail-query.ts` (new)

```typescript
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { JobRun } from '../types'
import { STALE_TIME } from '../utils/constants'

interface UseJobDetailQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseJobDetailQueryOptions = { enabled: true }

/**
 * Fetch single job details (for viewing result dialog)
 */
export function useJobDetailQuery(
  jobId: number | null,
  options: UseJobDetailQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.detail(jobId ?? 0),
    queryFn: async () => {
      if (!jobId) throw new Error('No job ID provided')

      const response = await apiCall<JobRun>(`job-runs/${jobId}`, { method: 'GET' })
      return response
    },
    enabled: enabled && !!jobId,
    staleTime: STALE_TIME.DETAIL,
  })
}
```

---

**3.5: Create Mutation Hooks**

**File:** `hooks/use-job-mutations.ts` (new)

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { JobActionResponse, ClearHistoryResponse, JobSearchParams } from '../types'
import { useMemo } from 'react'

export function useJobMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Cancel job
  const cancelJob = useMutation({
    mutationFn: async (jobId: number) => {
      const response = await apiCall<JobActionResponse>(`job-runs/${jobId}/cancel`, {
        method: 'POST'
      })
      if (!response?.success) {
        throw new Error(response?.message || 'Failed to cancel job')
      }
      return response
    },
    onSuccess: (data) => {
      // Invalidate job list to refresh
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.list() })
      toast({
        title: 'Job cancelled',
        description: data.message || 'The job has been cancelled.',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to cancel job',
        description: error.message,
        variant: 'destructive'
      })
    }
  })

  // Delete job
  const deleteJob = useMutation({
    mutationFn: async (jobId: number) => {
      const response = await apiCall<JobActionResponse>(`job-runs/${jobId}`, {
        method: 'DELETE'
      })
      if (!response?.success) {
        throw new Error(response?.message || 'Failed to delete job')
      }
      return response
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.list() })
      toast({
        title: 'Entry deleted',
        description: data.message || 'The job run has been removed from history.',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete entry',
        description: error.message,
        variant: 'destructive'
      })
    }
  })

  // Clear filtered history
  const clearFilteredHistory = useMutation({
    mutationFn: async (filters: JobSearchParams) => {
      // Build query params from filters
      const params = new URLSearchParams()

      if (filters.status) {
        const statusArr = Array.isArray(filters.status) ? filters.status : [filters.status]
        if (statusArr.length > 0) params.append('status', statusArr.join(','))
      }
      if (filters.job_type) {
        const typeArr = Array.isArray(filters.job_type) ? filters.job_type : [filters.job_type]
        if (typeArr.length > 0) params.append('job_type', typeArr.join(','))
      }
      if (filters.triggered_by) {
        const triggerArr = Array.isArray(filters.triggered_by) ? filters.triggered_by : [filters.triggered_by]
        if (triggerArr.length > 0) params.append('triggered_by', triggerArr.join(','))
      }
      if (filters.template_id) {
        const templateArr = Array.isArray(filters.template_id) ? filters.template_id : [filters.template_id]
        if (templateArr.length > 0) params.append('template_id', templateArr.join(','))
      }

      const queryString = params.toString()
      const endpoint = `job-runs/clear-filtered${queryString ? `?${queryString}` : ''}`

      const response = await apiCall<ClearHistoryResponse>(endpoint, {
        method: 'DELETE'
      })
      if (!response?.success) {
        throw new Error(response?.message || 'Failed to clear history')
      }
      return response
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.list() })
      toast({
        title: 'History cleared',
        description: data.message || `${data.deleted_count} job(s) cleared.`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to clear history',
        description: error.message,
        variant: 'destructive'
      })
    }
  })

  // Clear all history
  const clearAllHistory = useMutation({
    mutationFn: async () => {
      const response = await apiCall<ClearHistoryResponse>('job-runs/clear-all', {
        method: 'DELETE'
      })
      if (!response?.success) {
        throw new Error(response?.message || 'Failed to clear all history')
      }
      return response
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all })
      toast({
        title: 'History cleared',
        description: data.message || `All job history (${data.deleted_count} jobs) cleared.`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to clear history',
        description: error.message,
        variant: 'destructive'
      })
    }
  })

  // Memoize return object to prevent re-renders
  return useMemo(() => ({
    cancelJob,
    deleteJob,
    clearFilteredHistory,
    clearAllHistory,
  }), [cancelJob, deleteJob, clearFilteredHistory, clearAllHistory])
}
```

**Benefits:**
- ✅ Eliminates 200+ lines of manual state management
- ✅ Built-in caching (no manual `useState`)
- ✅ Built-in loading/error states
- ✅ **FIXES POLLING BUG** - Auto-stop polling when jobs complete
- ✅ Automatic background refetching
- ✅ Request deduplication
- ✅ Consistent error/success handling with Toast

---

### Phase 2: Create Component Decomposition

**2.1: Create Job Status Badge Component**

**File:** `components/job-status-badge.tsx` (new)

```typescript
'use client'

import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import { getStatusBadgeClasses } from '../utils/job-utils'

interface JobStatusBadgeProps {
  status: string
  progress?: {
    completed: number
    total: number
    percentage: number
  }
}

export function JobStatusBadge({ status, progress }: JobStatusBadgeProps) {
  const hasProgress = status === 'running' && progress

  return (
    <div className="space-y-1.5">
      <Badge className={`text-xs border ${getStatusBadgeClasses(status)}`}>
        {hasProgress ? (
          <span className="flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="font-semibold">{progress.percentage}%</span>
          </span>
        ) : (
          status
        )}
      </Badge>

      {hasProgress && (
        <div className="flex items-center gap-1.5 text-xs">
          <div className="h-1.5 flex-1 bg-gray-200 rounded-full overflow-hidden max-w-[80px]">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          <span className="text-gray-600 font-mono text-xs whitespace-nowrap">
            {progress.completed}/{progress.total}
          </span>
        </div>
      )}
    </div>
  )
}
```

---

**2.2: Create Job Actions Menu Component**

**File:** `components/job-actions-menu.tsx` (new)

```typescript
'use client'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Eye, XCircle, Trash2 } from 'lucide-react'
import { isJobActive } from '../utils/job-utils'

interface JobActionsMenuProps {
  jobId: number
  status: string
  hasResult: boolean
  onViewResult: (jobId: number) => void
  onCancel: (jobId: number) => void
  onDelete: (jobId: number) => void
  isCancelling: boolean
  isDeleting: boolean
}

export function JobActionsMenu({
  jobId,
  status,
  hasResult,
  onViewResult,
  onCancel,
  onDelete,
  isCancelling,
  isDeleting,
}: JobActionsMenuProps) {
  const jobIsActive = isJobActive(status)
  const showViewButton = status === 'completed' && hasResult
  const showCancelButton = jobIsActive
  const showDeleteButton = !jobIsActive

  return (
    <div className="flex items-center justify-end gap-1">
      {showViewButton && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              onClick={() => onViewResult(jobId)}
            >
              <Eye className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>View result</p>
          </TooltipContent>
        </Tooltip>
      )}

      {showCancelButton && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              onClick={() => onCancel(jobId)}
              disabled={isCancelling}
            >
              <XCircle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Cancel job</p>
          </TooltipContent>
        </Tooltip>
      )}

      {showDeleteButton && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              onClick={() => onDelete(jobId)}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Delete entry</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
```

---

**2.3: Create Jobs Filter Component**

**File:** `components/jobs-filter.tsx` (new)

```typescript
'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { RefreshCw, Trash2, ChevronDown } from 'lucide-react'
import { STATUS_OPTIONS, JOB_TYPE_OPTIONS, TRIGGER_OPTIONS } from '../utils/constants'
import type { JobTemplate } from '../types'

interface JobsFilterProps {
  statusFilter: string[]
  jobTypeFilter: string[]
  triggerFilter: string[]
  templateFilter: string[]
  availableTemplates: JobTemplate[]
  onStatusChange: (values: string[]) => void
  onJobTypeChange: (values: string[]) => void
  onTriggerChange: (values: string[]) => void
  onTemplateChange: (values: string[]) => void
  onRefresh: () => void
  onClearHistory: () => void
  isRefreshing: boolean
  isClearing: boolean
  hasJobs: boolean
  hasActiveFilters: boolean
  filterDescription: string
}

export function JobsFilter({
  statusFilter,
  jobTypeFilter,
  triggerFilter,
  templateFilter,
  availableTemplates,
  onStatusChange,
  onJobTypeChange,
  onTriggerChange,
  onTemplateChange,
  onRefresh,
  onClearHistory,
  isRefreshing,
  isClearing,
  hasJobs,
  hasActiveFilters,
  filterDescription,
}: JobsFilterProps) {
  const toggleFilter = (currentValues: string[], value: string) => {
    return currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value]
  }

  return (
    <div className="flex items-center gap-3">
      {/* Status Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-[130px] justify-between">
            {statusFilter.length === 0 ? "All Status" : `${statusFilter.length} selected`}
            <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[150px]">
          <DropdownMenuLabel>Status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {STATUS_OPTIONS.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={statusFilter.includes(option.value)}
              onCheckedChange={() => onStatusChange(toggleFilter(statusFilter, option.value))}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
          {statusFilter.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={false}
                onCheckedChange={() => onStatusChange([])}
                className="text-red-600"
              >
                Clear all
              </DropdownMenuCheckboxItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Job Type Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-[150px] justify-between">
            {jobTypeFilter.length === 0 ? "All Types" : `${jobTypeFilter.length} selected`}
            <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[180px]">
          <DropdownMenuLabel>Job Type</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {JOB_TYPE_OPTIONS.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={jobTypeFilter.includes(option.value)}
              onCheckedChange={() => onJobTypeChange(toggleFilter(jobTypeFilter, option.value))}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
          {jobTypeFilter.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={false}
                onCheckedChange={() => onJobTypeChange([])}
                className="text-red-600"
              >
                Clear all
              </DropdownMenuCheckboxItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Trigger Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-[130px] justify-between">
            {triggerFilter.length === 0 ? "All Triggers" : `${triggerFilter.length} selected`}
            <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[150px]">
          <DropdownMenuLabel>Trigger</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {TRIGGER_OPTIONS.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={triggerFilter.includes(option.value)}
              onCheckedChange={() => onTriggerChange(toggleFilter(triggerFilter, option.value))}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
          {triggerFilter.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={false}
                onCheckedChange={() => onTriggerChange([])}
                className="text-red-600"
              >
                Clear all
              </DropdownMenuCheckboxItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Template Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-[150px] justify-between">
            {templateFilter.length === 0 ? "All Templates" : `${templateFilter.length} selected`}
            <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[200px]">
          <DropdownMenuLabel>Template</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {availableTemplates.map((template) => (
            <DropdownMenuCheckboxItem
              key={template.id}
              checked={templateFilter.includes(template.id.toString())}
              onCheckedChange={() => onTemplateChange(toggleFilter(templateFilter, template.id.toString()))}
            >
              {template.name}
            </DropdownMenuCheckboxItem>
          ))}
          {templateFilter.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={false}
                onCheckedChange={() => onTemplateChange([])}
                className="text-red-600"
              >
                Clear all
              </DropdownMenuCheckboxItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Refresh Button */}
      <Button onClick={onRefresh} variant="outline" size="sm" disabled={isRefreshing}>
        <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        Refresh
      </Button>

      {/* Clear History Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={onClearHistory}
            variant="outline"
            size="sm"
            disabled={isClearing || !hasJobs}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
          >
            <Trash2 className={`mr-2 h-4 w-4 ${isClearing ? 'animate-spin' : ''}`} />
            {hasActiveFilters ? "Clear Filtered" : "Clear All"}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{hasActiveFilters ? `Clear jobs matching: ${filterDescription}` : "Clear all job history"}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
```

---

**2.4: Create Jobs Table Component**

**File:** `components/jobs-table.tsx` (new)

```typescript
'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { History } from 'lucide-react'
import { JobStatusBadge } from './job-status-badge'
import { JobActionsMenu } from './job-actions-menu'
import { formatDuration, formatDateTime, getTriggerBadgeClasses } from '../utils/job-utils'
import type { JobRun, JobProgressResponse } from '../types'

interface JobsTableProps {
  jobs: JobRun[]
  total: number
  jobProgress: Record<number, JobProgressResponse>
  onViewResult: (jobId: number) => void
  onCancelJob: (jobId: number) => void
  onDeleteJob: (jobId: number) => void
  cancellingId: number | null
  deletingId: number | null
}

export function JobsTable({
  jobs,
  total,
  jobProgress,
  onViewResult,
  onCancelJob,
  onDeleteJob,
  cancellingId,
  deletingId,
}: JobsTableProps) {
  if (jobs.length === 0) {
    return (
      <div className="rounded-xl border shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
          <div className="flex items-center space-x-2">
            <History className="h-4 w-4" />
            <div>
              <h3 className="text-sm font-semibold">Job Runs</h3>
              <p className="text-blue-100 text-xs">Background job execution history</p>
            </div>
          </div>
        </div>
        <div className="bg-white flex flex-col items-center justify-center py-16">
          <div className="p-4 bg-gray-100 rounded-full mb-4">
            <History className="h-10 w-10 text-gray-400" />
          </div>
          <p className="text-lg font-semibold text-gray-700 mb-1">No job runs found</p>
          <p className="text-sm text-gray-500">
            Job execution history will appear here when jobs are scheduled or run manually
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <History className="h-4 w-4" />
            <div>
              <h3 className="text-sm font-semibold">Job Runs ({total})</h3>
              <p className="text-blue-100 text-xs">Background job execution history</p>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-white">
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="w-[180px] text-gray-600 font-semibold">Job Name</TableHead>
                <TableHead className="w-[120px] text-gray-600 font-semibold">Type</TableHead>
                <TableHead className="w-[90px] text-gray-600 font-semibold">Status</TableHead>
                <TableHead className="w-[80px] text-gray-600 font-semibold">Trigger</TableHead>
                <TableHead className="w-[110px] text-gray-600 font-semibold">Started</TableHead>
                <TableHead className="w-[80px] text-gray-600 font-semibold">Duration</TableHead>
                <TableHead className="w-[100px] text-gray-600 font-semibold">Template</TableHead>
                <TableHead className="w-[60px] text-right text-gray-600 font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((run, index) => (
                <TableRow
                  key={run.id}
                  className={`hover:bg-blue-50/50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                >
                  {/* Job Name */}
                  <TableCell className="font-medium text-gray-700">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help truncate block max-w-[160px] hover:text-blue-600 transition-colors">
                          {run.job_name}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-sm">
                        <div className="space-y-1 text-xs">
                          <p><strong>ID:</strong> {run.id}</p>
                          <p><strong>Schedule:</strong> {run.schedule_name || '-'}</p>
                          {run.celery_task_id && (
                            <p><strong>Task ID:</strong> {run.celery_task_id.slice(0, 8)}...</p>
                          )}
                          {run.executed_by && (
                            <p><strong>Executed by:</strong> {run.executed_by}</p>
                          )}
                          {run.error_message && (
                            <p className="text-red-400 mt-2">{run.error_message}</p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>

                  {/* Job Type */}
                  <TableCell>
                    <span className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                      {run.job_type}
                    </span>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <JobStatusBadge
                      status={run.status}
                      progress={jobProgress[run.id]}
                    />
                  </TableCell>

                  {/* Trigger */}
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${getTriggerBadgeClasses(run.triggered_by)}`}>
                      {run.triggered_by}
                    </Badge>
                  </TableCell>

                  {/* Started */}
                  <TableCell className="text-sm text-gray-600">
                    {formatDateTime(run.started_at || run.queued_at)}
                  </TableCell>

                  {/* Duration */}
                  <TableCell className="text-sm text-gray-600">
                    <span className="font-mono text-xs">
                      {formatDuration(run.duration_seconds, run.started_at, run.completed_at)}
                    </span>
                  </TableCell>

                  {/* Template */}
                  <TableCell className="text-sm text-gray-600">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="truncate block max-w-[90px] cursor-help">
                          {run.template_name || '-'}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{run.template_name || 'No template'}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <JobActionsMenu
                      jobId={run.id}
                      status={run.status}
                      hasResult={!!(run.status === 'completed' && run.result)}
                      onViewResult={onViewResult}
                      onCancel={onCancelJob}
                      onDelete={onDeleteJob}
                      isCancelling={cancellingId === run.id}
                      isDeleting={deletingId === run.id}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TooltipProvider>
      </div>
    </div>
  )
}
```

---

**2.5: Create Pagination Component**

**File:** `components/jobs-pagination.tsx` (new)

```typescript
'use client'

import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface JobsPaginationProps {
  currentPage: number
  totalPages: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export function JobsPagination({
  currentPage,
  totalPages,
  pageSize,
  total,
  onPageChange,
}: JobsPaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t">
      <div className="text-sm text-gray-600">
        Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, total)} of {total} runs
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <span className="text-sm text-gray-600 px-2">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
```

---

**2.6: Create Clear History Confirmation Dialog**

**File:** `components/clear-history-dialog.tsx` (new)

```typescript
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

interface ClearHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  hasActiveFilters: boolean
  filterDescription: string
}

export function ClearHistoryDialog({
  open,
  onOpenChange,
  onConfirm,
  hasActiveFilters,
  filterDescription,
}: ClearHistoryDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear Job History</AlertDialogTitle>
          <AlertDialogDescription>
            {hasActiveFilters ? (
              <>
                Are you sure you want to clear job history matching: <strong>{filterDescription}</strong>?
                <br /><br />
                This action cannot be undone.
              </>
            ) : (
              <>
                Are you sure you want to clear <strong>all</strong> job history?
                <br /><br />
                This action cannot be undone.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-red-600 hover:bg-red-700">
            Clear History
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

---

### Phase 4: Refactor Main Container

**File:** `jobs-view-page.tsx` (refactored)

```typescript
'use client'

import { useState, useCallback, useMemo } from 'react'
import { History, RefreshCw } from 'lucide-react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { JobResultDialog } from '../job-result-dialog'
import { JobsFilter } from './components/jobs-filter'
import { JobsTable } from './components/jobs-table'
import { JobsPagination } from './components/jobs-pagination'
import { ClearHistoryDialog } from './components/clear-history-dialog'
import { useJobsQuery } from './hooks/use-jobs-query'
import { useJobTemplatesQuery } from './hooks/use-job-templates-query'
import { useJobDetailQuery } from './hooks/use-job-detail-query'
import { useAllJobsProgress } from './hooks/use-job-progress-query'
import { useJobMutations } from './hooks/use-job-mutations'
import { DEFAULT_PAGE_SIZE, DEFAULT_PAGE, EMPTY_ARRAY, EMPTY_TEMPLATES } from './utils/constants'
import type { JobSearchParams } from './types'

export function JobsViewPage() {
  // Filter state (TODO: Move to URL search params in future enhancement)
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [jobTypeFilter, setJobTypeFilter] = useState<string[]>([])
  const [triggerFilter, setTriggerFilter] = useState<string[]>([])
  const [templateFilter, setTemplateFilter] = useState<string[]>([])
  const [page, setPage] = useState(DEFAULT_PAGE)

  // Dialog state
  const [viewingJobId, setViewingJobId] = useState<number | null>(null)
  const [clearHistoryDialogOpen, setClearHistoryDialogOpen] = useState(false)

  // Mutation loading states
  const [cancellingId, setCancellingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Build query params from filter state
  const queryParams: JobSearchParams = useMemo(() => ({
    page,
    page_size: DEFAULT_PAGE_SIZE,
    ...(statusFilter.length > 0 && { status: statusFilter }),
    ...(jobTypeFilter.length > 0 && { job_type: jobTypeFilter }),
    ...(triggerFilter.length > 0 && { triggered_by: triggerFilter }),
    ...(templateFilter.length > 0 && { template_id: templateFilter }),
  }), [page, statusFilter, jobTypeFilter, triggerFilter, templateFilter])

  // TanStack Query hooks
  const { data: jobsData, isLoading, refetch } = useJobsQuery({ params: queryParams })
  const { data: templates = EMPTY_TEMPLATES } = useJobTemplatesQuery()
  const { data: viewingJob } = useJobDetailQuery(viewingJobId)
  const { data: jobProgress = {} } = useAllJobsProgress(jobsData?.items || EMPTY_ARRAY)

  // Mutations
  const { cancelJob, deleteJob, clearFilteredHistory, clearAllHistory } = useJobMutations()

  // Derived data
  const jobs = jobsData?.items || EMPTY_ARRAY
  const total = jobsData?.total || 0
  const totalPages = jobsData?.total_pages || 1

  // Filter helpers
  const hasActiveFilters = statusFilter.length > 0 || jobTypeFilter.length > 0 ||
                          triggerFilter.length > 0 || templateFilter.length > 0

  const getFilterDescription = useCallback(() => {
    const parts: string[] = []
    if (statusFilter.length > 0) parts.push(`status: ${statusFilter.join(", ")}`)
    if (jobTypeFilter.length > 0) parts.push(`type: ${jobTypeFilter.length > 0}`)
    if (triggerFilter.length > 0) parts.push(`trigger: ${triggerFilter.join(", ")}`)
    if (templateFilter.length > 0) {
      const templateNames = templateFilter.map(id => {
        const template = templates.find(t => t.id.toString() === id)
        return template?.name || id
      })
      parts.push(`template: ${templateNames.join(", ")}`)
    }
    return parts.length > 0 ? parts.join(", ") : "all"
  }, [statusFilter, jobTypeFilter, triggerFilter, templateFilter, templates])

  // Event handlers
  const handleFilterChange = useCallback((setter: (value: string[]) => void) => {
    return (values: string[]) => {
      setter(values)
      setPage(DEFAULT_PAGE) // Reset to page 1 on filter change
    }
  }, [])

  const handleCancelJob = useCallback(async (jobId: number) => {
    setCancellingId(jobId)
    try {
      await cancelJob.mutateAsync(jobId)
    } finally {
      setCancellingId(null)
    }
  }, [cancelJob])

  const handleDeleteJob = useCallback(async (jobId: number) => {
    setDeletingId(jobId)
    try {
      await deleteJob.mutateAsync(jobId)
    } finally {
      setDeletingId(null)
    }
  }, [deleteJob])

  const handleClearHistory = useCallback(() => {
    setClearHistoryDialogOpen(true)
  }, [])

  const handleConfirmClearHistory = useCallback(async () => {
    setClearHistoryDialogOpen(false)

    if (hasActiveFilters) {
      await clearFilteredHistory.mutateAsync(queryParams)
    } else {
      await clearAllHistory.mutateAsync()
    }
  }, [hasActiveFilters, queryParams, clearFilteredHistory, clearAllHistory])

  // Loading state
  if (isLoading && jobs.length === 0) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-3" />
            <p className="text-gray-600">Loading job history...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <TooltipProvider>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-100 p-2 rounded-lg">
              <History className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Job History</h1>
              <p className="text-gray-600 mt-1">View running and completed background jobs</p>
            </div>
          </div>

          {/* Filters */}
          <JobsFilter
            statusFilter={statusFilter}
            jobTypeFilter={jobTypeFilter}
            triggerFilter={triggerFilter}
            templateFilter={templateFilter}
            availableTemplates={templates}
            onStatusChange={handleFilterChange(setStatusFilter)}
            onJobTypeChange={handleFilterChange(setJobTypeFilter)}
            onTriggerChange={handleFilterChange(setTriggerFilter)}
            onTemplateChange={handleFilterChange(setTemplateFilter)}
            onRefresh={() => refetch()}
            onClearHistory={handleClearHistory}
            isRefreshing={isLoading}
            isClearing={clearFilteredHistory.isPending || clearAllHistory.isPending}
            hasJobs={jobs.length > 0}
            hasActiveFilters={hasActiveFilters}
            filterDescription={getFilterDescription()}
          />
        </div>
      </TooltipProvider>

      {/* Jobs Table */}
      <JobsTable
        jobs={jobs}
        total={total}
        jobProgress={jobProgress}
        onViewResult={setViewingJobId}
        onCancelJob={handleCancelJob}
        onDeleteJob={handleDeleteJob}
        cancellingId={cancellingId}
        deletingId={deletingId}
      />

      {/* Pagination */}
      <JobsPagination
        currentPage={page}
        totalPages={totalPages}
        pageSize={DEFAULT_PAGE_SIZE}
        total={total}
        onPageChange={setPage}
      />

      {/* View Result Dialog */}
      <JobResultDialog
        jobRun={viewingJob}
        open={viewingJobId !== null}
        onOpenChange={(open) => !open && setViewingJobId(null)}
      />

      {/* Clear History Confirmation Dialog */}
      <ClearHistoryDialog
        open={clearHistoryDialogOpen}
        onOpenChange={setClearHistoryDialogOpen}
        onConfirm={handleConfirmClearHistory}
        hasActiveFilters={hasActiveFilters}
        filterDescription={getFilterDescription()}
      />
    </div>
  )
}
```

**Before:** 919 lines
**After:** ~200 lines (main container)
**Reduction:** ~719 lines (78%)

---

## Final Directory Structure

```
frontend/src/components/features/jobs/view/
├── jobs-view-page.tsx             # ~200 lines (was 919, -78%)
├── components/
│   ├── jobs-filter.tsx            # ~160 lines
│   ├── jobs-table.tsx             # ~220 lines
│   ├── jobs-pagination.tsx        # ~40 lines
│   ├── job-status-badge.tsx       # ~50 lines
│   ├── job-actions-menu.tsx       # ~80 lines
│   └── clear-history-dialog.tsx   # ~45 lines
├── hooks/
│   ├── use-jobs-query.ts          # ~80 lines
│   ├── use-job-templates-query.ts # ~30 lines
│   ├── use-job-detail-query.ts    # ~35 lines
│   ├── use-job-progress-query.ts  # ~110 lines
│   └── use-job-mutations.ts       # ~140 lines
├── types/
│   ├── job-results.ts             # 459 lines (existing)
│   └── index.ts                   # ~50 lines (new)
└── utils/
    ├── constants.ts               # ~60 lines
    └── job-utils.ts               # ~90 lines

Total: ~1,849 lines across 17 files (was 919 in 1 file)
Net increase: +930 lines (+101%) but with proper architecture
```

---

## Summary of Changes

| File | Before | After | Change |
|------|--------|-------|--------|
| `jobs-view-page.tsx` | 919 | ~200 | **-719 lines (-78%)** |
| New components | 0 | ~595 | **+595 lines** |
| New hooks | 0 | ~395 | **+395 lines** |
| New types/utils | 0 | ~150 | **+150 lines** |
| **Total** | **919** | **~1,340** | **+421 lines (+46%)** |

**Note:** Type definitions file already exists (459 lines), so actual net new lines: ~881 (+96%)

**Net increase** of 421 lines (or 881 including existing types), but with significantly better architecture:
- Proper separation of concerns
- TanStack Query compliance (mandatory)
- **Fixes polling bugs** (auto-stop on job completion)
- Reusable components and hooks
- URL-based filters (future enhancement)
- Better testability
- Easier maintainability
- No console.log in production
- Uses AlertDialog instead of native confirm()

---

## Architecture Compliance (CLAUDE.md)

### Success Metrics

**Code Quality:**
- [ ] Component size < 300 lines each (main page ~200 lines)
- [ ] No duplicate fetch logic (unified in query/mutation hooks)
- [ ] No manual `useState` for server data (TanStack Query only)
- [ ] No inline arrays/objects in default parameters
- [ ] No manual polling with setInterval (refetchInterval)
- [ ] No console.log in production
- [ ] No native confirm() (uses AlertDialog)
- [ ] Zero ESLint warnings

**Architecture Compliance:**
- [ ] All data fetching uses TanStack Query
- [ ] Query keys in centralized factory (`/lib/query-keys.ts`)
- [ ] API calls via `/api/proxy/*` (not direct backend)
- [ ] Feature-based folder structure (components/, hooks/, types/, utils/)
- [ ] All UI components from Shadcn
- [ ] Backend endpoints verified (repository/service/router)
- [ ] Permission checks in backend routes

**User Experience:**
- [ ] List auto-refreshes when jobs are running (every 3s)
- [ ] Backup progress updates in real-time (every 3s)
- [ ] Auto-polling stops when all jobs complete
- [ ] Pagination works correctly
- [ ] All filters work (status, type, trigger, template)
- [ ] Multi-select filters supported
- [ ] Cancel job works immediately
- [ ] Delete job removes from list
- [ ] Clear history works (filtered and all)
- [ ] Confirmation dialog for destructive actions
- [ ] No UI flicker during refetch (keepPreviousData)
- [ ] Loading states feel responsive

**Developer Experience:**
- [ ] Easy to add new filters
- [ ] Easy to add new job actions
- [ ] Components are testable
- [ ] Types are complete and accurate
- [ ] No stale closure bugs (TanStack Query handles state)
- [ ] Clear component boundaries
- [ ] Reusable hooks

---

## Anti-Patterns to Avoid

### ❌ DO NOT Do These During Refactoring

**1. Don't Keep Manual State for Server Data**
- ❌ `const [jobRuns, setJobRuns] = useState<JobRun[]>([])`
- ❌ `const [loading, setLoading] = useState(false)`
- ✅ **Instead:** `const { data: jobRuns = [], isLoading } = useJobsQuery()`

**2. Don't Keep Manual Polling Logic**
- ❌ `useEffect(() => { const interval = setInterval(fetchJobRuns, 3000) }, [])`
- ✅ **Instead:** TanStack Query `refetchInterval: hasActiveJobs ? 3000 : false`

**3. Don't Keep Manual Loading States**
- ❌ `const [cancellingId, setCancellingId] = useState<number | null>(null)`
- ✅ **Instead:** `cancelJob.isPending` from mutation hook (but keep for UI-specific loading like which row is cancelling)

**4. Don't Keep Manual Pagination State Without URL Sync**
- ❌ `const [page, setPage] = useState(1)` (local only)
- ⚠️ **Better:** Use URL search params (`useSearchParams()`)
- ✅ **For now:** Keep local state, plan URL migration later

**5. Don't Keep Filter Logic in Main Component**
- ❌ All toggle functions in main component
- ✅ **Instead:** Extract to `JobsFilter` component

**6. Don't Forget to Handle Empty States**
- ❌ Just map over array
- ✅ **Instead:** Check `jobs.length === 0` and show EmptyState

**7. Don't Poll All Jobs Individually**
- ❌ Each backup job row polling progress endpoint
- ✅ **Instead:** `useAllJobsProgress()` hook polls all at once

**8. Don't Use Native Confirm**
- ❌ `if (!confirm(message)) return`
- ✅ **Instead:** Use Shadcn `AlertDialog` component

**9. Don't Leave Console Logs**
- ❌ `console.log('[Jobs] Auto-refreshing...')`
- ✅ **Instead:** Remove all console logging from production code

**10. Don't Create Inline Arrays/Objects**
- ❌ `const statusOptions = [{ value: 'pending', ... }]` (inside component)
- ✅ **Instead:** `export const STATUS_OPTIONS = [...] as const` (in constants file)

---

## Verification Plan

### Functional Tests

**1. Data Loading**
- [ ] List loads on mount with default pagination
- [ ] Templates load in filter dropdown
- [ ] Pagination controls appear when `total > page_size`
- [ ] Empty state shown when no jobs

**2. Filtering**
- [ ] Status filter (single selection)
- [ ] Status filter (multi-selection)
- [ ] Job type filter
- [ ] Trigger filter
- [ ] Template filter
- [ ] Combined filters (status + type + trigger + template)
- [ ] Clear individual filter
- [ ] Clear all filters

**3. Pagination**
- [ ] Next page works
- [ ] Previous page works
- [ ] Page numbers display correctly
- [ ] Shows correct "X - Y of Z" range
- [ ] Pagination state resets to page 1 on filter change
- [ ] keepPreviousData prevents UI flicker when changing pages

**4. Auto-Refresh (CRITICAL)**
- [ ] List refreshes every 3s when any job is running or pending
- [ ] Refresh stops when all jobs complete
- [ ] Backup progress updates every 3s for running backup jobs
- [ ] Progress polling stops when backup completes
- [ ] No memory leaks from polling
- [ ] Polling survives component re-renders

**5. Actions**
- [ ] View result button appears for completed jobs with results
- [ ] View result opens dialog with fresh data
- [ ] Cancel button appears for running/pending jobs
- [ ] Cancel succeeds and updates status immediately
- [ ] Delete button appears for completed/failed/cancelled jobs
- [ ] Delete removes job from list
- [ ] Clear History button disabled when no jobs
- [ ] Clear History shows confirmation dialog
- [ ] Clear Filtered only clears matching jobs
- [ ] Clear All clears entire history

**6. Edge Cases**
- [ ] No templates available (empty dropdown)
- [ ] All filters return empty result set
- [ ] Job completes during polling (status updates automatically)
- [ ] Network error during fetch (shows error toast)
- [ ] Unauthorized error (401) redirects to login
- [ ] Concurrent mutations (cancel while list refreshing)
- [ ] Job deleted while viewing result dialog
- [ ] Large job list (1000+ items) renders smoothly
- [ ] Very long job names truncate correctly

**7. UI/UX**
- [ ] Status badges have correct colors and animations
- [ ] Progress bar animates smoothly
- [ ] Tooltips show on hover
- [ ] Loading spinners appear during actions
- [ ] Toast notifications for all mutations
- [ ] Responsive layout on mobile/tablet
- [ ] Keyboard navigation works
- [ ] Screen reader accessible

**8. Performance**
- [ ] Initial load < 2s
- [ ] Filter change < 500ms
- [ ] Pagination change < 300ms (with keepPreviousData)
- [ ] No unnecessary re-renders
- [ ] Cache invalidation doesn't cause flash
- [ ] Multiple backup jobs polling doesn't degrade performance

---

## Backend Endpoint Documentation

**Required Endpoints:**

### `GET /api/proxy/job-runs`
- **Purpose:** List jobs with pagination and filters
- **Query Params:**
  - `page` (number, default: 1)
  - `page_size` (number, default: 25)
  - `status` (string, comma-separated: "pending,running,completed,failed,cancelled")
  - `job_type` (string, comma-separated)
  - `triggered_by` (string, comma-separated: "manual,schedule,system")
  - `template_id` (string, comma-separated: "1,2,3")
- **Response:**
  ```typescript
  {
    items: JobRun[]
    total: number
    page: number
    page_size: number
    total_pages: number
  }
  ```
- **Permissions:** `jobs:read` or `verify_token()`

### `GET /api/proxy/job-runs/templates`
- **Purpose:** Get available job templates for filter dropdown
- **Response:**
  ```typescript
  {
    templates: Array<{ id: number, name: string }>
  }
  ```
- **Permissions:** `jobs:read`

### `GET /api/proxy/job-runs/{id}`
- **Purpose:** Get single job details (for result dialog)
- **Response:** `JobRun`
- **Permissions:** `jobs:read`

### `GET /api/proxy/job-runs/{id}/progress`
- **Purpose:** Get backup job progress
- **Response:**
  ```typescript
  {
    completed: number
    total: number
    percentage: number
  }
  ```
- **Permissions:** `jobs:read`
- **Note:** Only works for backup jobs

### `POST /api/proxy/job-runs/{id}/cancel`
- **Purpose:** Cancel running/pending job
- **Response:**
  ```typescript
  {
    success: boolean
    message?: string
  }
  ```
- **Permissions:** `jobs:write`

### `DELETE /api/proxy/job-runs/{id}`
- **Purpose:** Delete single job entry
- **Response:**
  ```typescript
  {
    success: boolean
    message?: string
  }
  ```
- **Permissions:** `jobs:delete`

### `DELETE /api/proxy/job-runs/clear-filtered`
- **Purpose:** Clear jobs matching filters
- **Query Params:** Same as list endpoint
- **Response:**
  ```typescript
  {
    success: boolean
    message: string
    deleted_count: number
  }
  ```
- **Permissions:** `jobs:delete`

### `DELETE /api/proxy/job-runs/clear-all`
- **Purpose:** Clear all job history
- **Response:**
  ```typescript
  {
    success: boolean
    message: string
    deleted_count: number
  }
  ```
- **Permissions:** `jobs:delete` or `admin`

---

## Error Handling Strategy

### HTTP Status Codes

**401 Unauthorized (Expired token)**
- TanStack Query onError: Redirect to login page
- Clear auth store
- Show toast: "Session expired, please login again"

**403 Forbidden (Insufficient permissions)**
- Show toast: "You don't have permission to perform this action"
- Don't retry
- Keep user on page

**404 Not Found (Job deleted)**
- Show toast: "Job not found (may have been deleted)"
- Invalidate job list to refresh
- Close result dialog if open

**500 Internal Server Error**
- Show toast: "Server error, please try again"
- TanStack Query will retry 3 times automatically
- If all retries fail, show error state

**Network Error (No connection)**
- Show toast: "Network error, check your connection"
- TanStack Query will retry
- Keep stale data visible

### Error Display

- **Mutations:** Use toast notifications (already in mutation hooks)
- **Queries:** Show inline error state in table (empty state with error message)
- **Polling:** Silent failures (don't spam toasts), log to console in dev mode only

---

## Migration Path

### Phase 1: Foundation (Zero Risk)
1. Extract constants ✅
2. Extract utilities ✅
3. Extract types ✅
4. Add query keys ✅
5. Verify backend ✅

**Checkpoint:** No changes to UI/behavior, just organization

### Phase 2: TanStack Query (Critical)
1. Create all query hooks ✅
2. Create all mutation hooks ✅
3. Test hooks in isolation (unit tests)

**Checkpoint:** Hooks tested and ready

### Phase 3: Component Decomposition
1. Create all sub-components ✅
2. Test components in isolation (Storybook or unit tests)

**Checkpoint:** Components tested and ready

### Phase 4: Integration
1. Refactor main page to use hooks + components ✅
2. Test full integration
3. Fix any bugs
4. Deploy to staging

**Checkpoint:** Full refactoring complete

### Phase 5: Enhancements (Optional)
1. Move filters to URL search params (shareable links)
2. Add sorting support
3. Add job search
4. Add export to CSV

---

## Recommended Refactoring Order

1. **Phase 1.4** - Extract constants (zero risk)
2. **Phase 1.5** - Extract utilities (zero risk)
3. **Phase 1.3** - Update type definitions (zero risk)
4. **Phase 1.2** - Add query keys (zero risk)
5. **Phase 1.1** - Verify backend architecture (investigation)
6. **Phase 3.1** - Create query hooks (**FIXES POLLING BUG**)
7. **Phase 3.2-3.5** - Create remaining hooks
8. **Phase 2.1-2.6** - Create all components
9. **Phase 4** - Refactor main page
10. **Testing** - Comprehensive functional testing

---

## Notes

- This refactoring is **MANDATORY** to align with CLAUDE.md standards
- **CRITICAL:** The manual polling logic (lines 281-291, 294-347) is a bug risk similar to Check IP
- TanStack Query migration is **mandatory** per architecture requirements
- Component decomposition improves testability and maintainability
- Native `confirm()` must be replaced with Shadcn AlertDialog
- Console logs must be removed from production code
- **Must migrate filters to URL search params** (future enhancement for shareable links)
- Consider this pattern for other view components

---

**Document Version:** 2.0
**Updated:** 2026-01-25
**Status:** Planning - Comprehensive
**Priority:** High (polling bug risk + architecture compliance + production code quality)
