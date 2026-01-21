# Refactoring Plan: Celery Settings Component

**Component:** `frontend/src/components/features/settings/celery/celery-settings.tsx`
**Created:** 2026-01-21
**Status:** Planning
**Lines of Code:** 693

## TL;DR - What's Wrong & How to Fix It

**Problems:**
1. 🚫 **Architecture violation** - Manual `useState`/`useEffect` instead of mandatory TanStack Query
2. ⚠️ **Manual polling bug** - Custom `setInterval` logic for task status (similar to Check IP bug)
3. 📏 **Too large** - 693 lines, should be < 300 per component
4. 🔁 **Code duplication** - 4 separate API call functions with identical error handling
5. ⚠️ **Missing standards** - No react-hook-form + zod, 8 loading states, inline state updates
6. 🗂️ **No component decomposition** - Status, workers, schedules, test all in one file

**Solution:**
1. ✅ **Migrate to TanStack Query** - Replaces 150+ lines of manual state with built-in caching
2. ✅ **Use auto-polling** - TanStack Query `refetchInterval` for task status (fixes potential bug)
3. ✅ **Decompose into 5 components** - Status overview, settings form, workers list, schedules list, test panel
4. ✅ **Add mutation hooks** - use-celery-mutations for save/cleanup/test operations
5. ✅ **Form validation** - react-hook-form + zod for settings form
6. ✅ **Feature-based structure** - components/, hooks/, types/, utils/ subdirectories

**Critical Path:** Phase 1 (foundation) → Phase 3 (TanStack Query) → Phase 2 (decomposition)

**Minimum Viable:** Phases 1-3 establishes proper architecture per CLAUDE.md

---

## Executive Summary

The Celery Settings component is a monolithic 693-line file with **critical architecture violations** and significant technical debt:

1. **Architecture Violation** - Uses manual `useState` + `useEffect` instead of mandatory TanStack Query
2. **Manual Polling Bug Risk** - Custom `setInterval` for task status (similar to Check IP polling bug)
3. **No Component Decomposition** - Single component handles status, workers, schedules, settings, and testing
4. **Manual State Management** - 8 separate `useState` hooks for data and loading states
5. **Duplicate API Logic** - 4 nearly identical API call functions with repeated error handling
6. **Missing Standards** - No react-hook-form, no zod validation, custom message state
7. **No Shared State** - Each tab loads data independently without caching

**Bottom Line:** TanStack Query migration is mandatory per CLAUDE.md and eliminates 150+ lines of manual state management automatically. The manual polling logic is a critical bug risk.

## Key Changes Summary

| Current Approach | Required Approach (CLAUDE.md) |
|------------------|-------------------------------|
| Manual `useState` + `useEffect` | **TanStack Query with auto-caching** |
| 8 separate loading states | **TanStack Query built-in states** |
| Manual API calls with error handling | **useQuery/useMutation hooks** |
| Custom message state | **useToast() from Shadcn UI** |
| Single 693-line component | **5 focused components < 200 lines** |
| Custom form validation | **react-hook-form + zod** |
| Manual polling with setInterval | **TanStack Query refetchInterval** |
| No query key factory | **Centralized query keys** |

## Quick Wins (Can Start Immediately)

These tasks can be done right now without breaking existing functionality:

### 1. Extract Type Definitions (30 min)
- Create `types/index.ts`
- Move CeleryStatus, CelerySettings, Schedule, TaskStatus, WorkersData interfaces
- No behavioral changes

### 2. Extract Constants (15 min)
- Create `utils/constants.ts`
- Move DEFAULT_CELERY_SETTINGS, EMPTY_ARRAY
- Fixes potential re-render issues

### 3. Extract Utility Functions (30 min)
- Create `utils/celery-utils.ts`
- Status formatting functions
- Duration formatting
- Add unit tests

### 4. Add Query Keys (15 min)
- Add to `/lib/query-keys.ts`
- Set up foundation for TanStack Query migration

### 5. Verify Backend Architecture (30 min)
- Confirm backend endpoints use repository/service/router layers
- Check for proper auth (verify_admin_token)
- Verify proxy pattern: `/api/proxy/celery/*` vs `/api/celery/*`

**Total:** ~2 hours
**Risk:** Zero (no behavioral changes)
**Benefit:** Immediate code quality improvement, sets up for TanStack Query migration

---

## Current Architecture

```
frontend/src/components/features/settings/celery/
└── celery-settings.tsx       # 693 lines - Everything in one file
```

**Responsibilities:**
- Celery status overview (lines 260-327, 338-394)
- Settings form (lines 397-538)
- Workers list (lines 540-587)
- Schedules list (lines 589-628)
- Test panel (lines 630-688)

**Total:** 693 lines with mixed concerns

---

## Problem Analysis

### Problem 1: Architecture Violation - Manual State Management

**Affected Lines:** 85-97, 100-236

**Current Pattern:**
```tsx
// Lines 85-97: Manual state management
const [celeryStatus, setCeleryStatus] = useState<CeleryStatus | null>(null)
const [workers, setWorkers] = useState<WorkersData | null>(null)
const [schedules, setSchedules] = useState<Schedule[]>(EMPTY_ARRAY)
const [testTaskId, setTestTaskId] = useState<string>('')
const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null)
const [isLoading, setIsLoading] = useState(false)
const [message, setMessage] = useState<{type: 'success' | 'error'; text: string} | null>(null)
const [celerySettings, setCelerySettings] = useState<CelerySettings>(DEFAULT_CELERY_SETTINGS)
const [settingsLoading, setSettingsLoading] = useState(false)
const [settingsSaving, setSettingsSaving] = useState(false)
const [cleanupRunning, setCleanupRunning] = useState(false)

// Lines 100-112: Manual API call with error handling
const loadStatus = useCallback(async () => {
  setIsLoading(true)
  try {
    const response = await apiCall('/api/celery/status') as { success: boolean; status: CeleryStatus }
    if (response.success) {
      setCeleryStatus(response.status)
    }
  } catch (error) {
    console.error('Failed to load Celery status:', error)
  } finally {
    setIsLoading(false)
  }
}, [apiCall])
```

**Issues:**
- Manual loading state management (8 states!)
- Duplicate error handling pattern (4 functions)
- No caching mechanism
- Manual state updates
- Violates CLAUDE.md mandatory TanStack Query requirement

---

### Problem 2: Manual Polling Logic (CRITICAL BUG RISK)

**Affected Lines:** 230-236

```tsx
// Auto-refresh task status
useEffect(() => {
  if (testTaskId && taskStatus?.status !== 'SUCCESS' && taskStatus?.status !== 'FAILURE') {
    const interval = setInterval(checkTaskStatus, 2000)
    return () => clearInterval(interval)
  }
  return undefined
}, [testTaskId, taskStatus, checkTaskStatus])
```

**Issues:**
- **SAME PATTERN AS CHECK IP BUG** - Manual polling with useEffect + setInterval
- `checkTaskStatus` dependency could cause stale closure bug
- Should use TanStack Query `refetchInterval` instead
- Potential memory leak if cleanup fails
- No automatic stop on component unmount

**This is a critical bug risk** - similar to the Check IP component polling bug that was already identified.

---

### Problem 3: Duplicate API Call Pattern (4 implementations)

**Affected Lines:**
- `loadStatus()` - Lines 100-112
- `loadWorkers()` - Lines 115-124
- `loadSchedules()` - Lines 127-136
- `loadSettings()` - Lines 139-151

**Identical Pattern:**
```tsx
const loadX = useCallback(async () => {
  setLoadingX(true)
  try {
    const response = await apiCall('endpoint') as ResponseType
    if (response.success) {
      setData(response.data)
    }
  } catch (error) {
    console.error('Failed to load X:', error)
  } finally {
    setLoadingX(false)
  }
}, [apiCall])
```

**Issue:** Every API call has identical error handling, loading state management, and data assignment logic.

---

### Problem 4: Monolithic Component Structure

**Single component handles:**
1. Status overview with 4 status cards (lines 260-327)
2. Detailed status panel (lines 338-394)
3. Settings form management (lines 397-538)
4. Workers list (lines 540-587)
5. Schedules list (lines 589-628)
6. Test task panel (lines 630-688)
7. Custom message management (lines 252-258)
8. Multiple loading states (lines 85-97)

**Should be:** 5 separate components with clear boundaries

---

### Problem 5: No Form Validation Standard

**Location:** Lines 397-538 (settings form)

**Current:**
- No validation schema
- Manual onChange handlers
- No form state management
- Direct state updates

**Required:** react-hook-form + zod validation per CLAUDE.md

---

### Problem 6: Custom Message State Instead of Toast

**Location:** Lines 91, 252-258

```tsx
const [message, setMessage] = useState<{type: 'success' | 'error'; text: string} | null>(null)

{message && (
  <Alert className={message.type === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
    <AlertDescription className={message.type === 'error' ? 'text-red-800' : 'text-green-800'}>
      {message.text}
    </AlertDescription>
  </Alert>
)}
```

**Issue:** Custom implementation instead of using Shadcn UI `useToast()` hook

---

### Problem 7: API Endpoint Pattern Verification Needed

**Location:** Throughout component

**Current endpoints:**
- `/api/celery/status`
- `/api/celery/workers`
- `/api/celery/schedules`
- `/api/celery/settings`

**Question:** Should these be `/api/proxy/celery/*` per CLAUDE.md proxy pattern?

**Need to verify:** Backend routing and proxy configuration

---

### Problem 8: No Centralized Query Keys

**Issue:** Direct API calls without using query key factory pattern

**Example:**
```tsx
await apiCall('/api/celery/status')
await apiCall('/api/celery/workers')
```

**Required:** Use centralized query keys from `/lib/query-keys.ts`

---

## Proposed Refactoring Plan

### Phase 1: Foundation & Setup (CRITICAL)

**1.1: Verify Backend Architecture & API Pattern**

- [ ] Confirm backend endpoints use repository pattern
- [ ] Verify service layer exists for Celery operations
- [ ] Check routers use `verify_admin_token()` dependency
- [ ] **CRITICAL:** Verify API endpoints - should they be `/api/proxy/celery/*` or `/api/celery/*`?
- [ ] Check if proxy is configured for Celery endpoints

**Estimated effort:** 45 minutes

---

**1.2: Add Query Keys to Centralized Factory**

**File:** `/frontend/src/lib/query-keys.ts` (modify)

```tsx
// Add to existing queryKeys object
celery: {
  all: ['celery'] as const,

  // Status
  status: () => [...queryKeys.celery.all, 'status'] as const,

  // Settings
  settings: () => [...queryKeys.celery.all, 'settings'] as const,

  // Workers
  workers: () => [...queryKeys.celery.all, 'workers'] as const,

  // Schedules
  schedules: () => [...queryKeys.celery.all, 'schedules'] as const,

  // Task status
  task: (taskId: string) => [...queryKeys.celery.all, 'task', taskId] as const,
},
```

**Estimated effort:** 15 minutes

---

**1.3: Create Type Definitions**

**File:** `components/features/settings/celery/types/index.ts` (new)

```tsx
export interface CeleryStatus {
  redis_connected: boolean
  worker_count: number
  active_tasks: number
  beat_running: boolean
}

export interface Schedule {
  name: string
  task: string
  schedule: string
  options: Record<string, unknown>
}

export interface TaskStatus {
  task_id: string
  status: string
  result?: Record<string, unknown>
  error?: string
  progress?: Record<string, unknown>
}

export interface WorkersData {
  active_tasks?: Record<string, unknown[]>
  stats?: Record<string, unknown>
  registered_tasks?: Record<string, string[]>
}

export interface WorkerStats {
  pool?: {
    'max-concurrency'?: number | string
    implementation?: string
  }
}

export interface CelerySettings {
  max_workers: number
  cleanup_enabled: boolean
  cleanup_interval_hours: number
  cleanup_age_hours: number
  result_expires_hours: number
}

// API Response types
export interface CeleryStatusResponse {
  success: boolean
  status: CeleryStatus
}

export interface CeleryWorkersResponse {
  success: boolean
  workers: WorkersData
}

export interface CelerySchedulesResponse {
  success: boolean
  schedules?: Schedule[]
}

export interface CelerySettingsResponse {
  success: boolean
  settings?: CelerySettings
}

export interface CeleryActionResponse {
  success: boolean
  message?: string
  task_id?: string
}
```

**Estimated effort:** 30 minutes

---

**1.4: Create Constants**

**File:** `components/features/settings/celery/utils/constants.ts` (new)

```tsx
import type { CelerySettings, Schedule } from '../types'

// React best practice: Extract default objects to prevent re-render loops
export const DEFAULT_CELERY_SETTINGS: CelerySettings = {
  max_workers: 4,
  cleanup_enabled: true,
  cleanup_interval_hours: 6,
  cleanup_age_hours: 24,
  result_expires_hours: 24
} as const

export const EMPTY_SCHEDULES: Schedule[] = []

export const STALE_TIME = {
  STATUS: 10 * 1000,      // 10 seconds - frequently changing
  SETTINGS: 5 * 60 * 1000, // 5 minutes - rarely changes
  WORKERS: 30 * 1000,      // 30 seconds - moderate frequency
  SCHEDULES: 2 * 60 * 1000, // 2 minutes - rarely changes
  TASK: 0,                 // Always fresh for active tasks
} as const

export const TASK_POLL_INTERVAL = 2000 // 2 seconds for task polling
```

**Estimated effort:** 15 minutes

---

**1.5: Create Utility Functions**

**File:** `components/features/settings/celery/utils/celery-utils.ts` (new)

```tsx
/**
 * Check if task is still active (needs polling)
 */
export function isTaskActive(status: string | undefined): boolean {
  if (!status) return false
  return !['SUCCESS', 'FAILURE', 'REVOKED'].includes(status)
}

/**
 * Get status badge variant based on task status
 */
export function getTaskStatusVariant(status: string): 'default' | 'destructive' | 'secondary' {
  switch (status) {
    case 'SUCCESS':
      return 'default'
    case 'FAILURE':
      return 'destructive'
    default:
      return 'secondary'
  }
}

/**
 * Format duration in hours to human-readable string
 */
export function formatHours(hours: number): string {
  if (hours < 24) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`
  }
  const days = Math.floor(hours / 24)
  return `${days} day${days !== 1 ? 's' : ''}`
}
```

**Estimated effort:** 30 minutes

---

### Phase 3: TanStack Query Migration (CRITICAL - Mandatory)

**Note:** TanStack Query is mandatory for all data fetching per CLAUDE.md. This replaces manual state management entirely and fixes the polling bug.

**3.1: Create Query Hooks**

**File:** `hooks/use-celery-queries.ts` (new)

```tsx
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type {
  CeleryStatus,
  CelerySettings,
  WorkersData,
  Schedule,
  TaskStatus,
  CeleryStatusResponse,
  CelerySettingsResponse,
  CeleryWorkersResponse,
  CelerySchedulesResponse
} from '../types'
import { STALE_TIME, DEFAULT_CELERY_SETTINGS, EMPTY_SCHEDULES, TASK_POLL_INTERVAL } from '../utils/constants'
import { isTaskActive } from '../utils/celery-utils'

interface UseCeleryStatusOptions {
  enabled?: boolean
}

const DEFAULT_STATUS_OPTIONS: UseCeleryStatusOptions = { enabled: true }

/**
 * Fetch Celery status with automatic caching
 */
export function useCeleryStatus(options: UseCeleryStatusOptions = DEFAULT_STATUS_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.celery.status(),
    queryFn: async () => {
      const response = await apiCall<CeleryStatusResponse>('/api/celery/status', { method: 'GET' })
      if (!response?.success) {
        throw new Error('Failed to load Celery status')
      }
      return response.status
    },
    enabled,
    staleTime: STALE_TIME.STATUS,
  })
}

/**
 * Fetch Celery settings with automatic caching
 */
export function useCelerySettings(options: { enabled?: boolean } = {}) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.celery.settings(),
    queryFn: async () => {
      const response = await apiCall<CelerySettingsResponse>('/api/celery/settings', { method: 'GET' })
      if (!response?.success || !response.settings) {
        throw new Error('Failed to load Celery settings')
      }
      return {
        ...DEFAULT_CELERY_SETTINGS,
        ...response.settings
      } as CelerySettings
    },
    enabled,
    staleTime: STALE_TIME.SETTINGS,
  })
}

/**
 * Fetch Celery workers with automatic caching
 */
export function useCeleryWorkers(options: { enabled?: boolean } = {}) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.celery.workers(),
    queryFn: async () => {
      const response = await apiCall<CeleryWorkersResponse>('/api/celery/workers', { method: 'GET' })
      if (!response?.success || !response.workers) {
        throw new Error('Failed to load Celery workers')
      }
      return response.workers
    },
    enabled,
    staleTime: STALE_TIME.WORKERS,
  })
}

/**
 * Fetch Celery schedules with automatic caching
 */
export function useCelerySchedules(options: { enabled?: boolean } = {}) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.celery.schedules(),
    queryFn: async () => {
      const response = await apiCall<CelerySchedulesResponse>('/api/celery/schedules', { method: 'GET' })
      if (!response?.success) {
        throw new Error('Failed to load Celery schedules')
      }
      return response.schedules || EMPTY_SCHEDULES
    },
    enabled,
    staleTime: STALE_TIME.SCHEDULES,
  })
}

/**
 * Fetch task status with automatic polling
 * CRITICAL: Fixes manual polling bug - uses TanStack Query refetchInterval
 */
export function useTaskStatus(taskId: string | null, options: { enabled?: boolean } = {}) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.celery.task(taskId!),
    queryFn: async () => {
      const response = await apiCall<TaskStatus>(`/api/celery/tasks/${taskId}`, { method: 'GET' })
      return response
    },
    enabled: enabled && !!taskId,
    staleTime: STALE_TIME.TASK,
    // Auto-polling: stops when task completes (SUCCESS, FAILURE, REVOKED)
    refetchInterval: (query) => {
      const status = query.state.data?.status
      // Stop polling if task is done, otherwise poll every 2s
      return isTaskActive(status) ? TASK_POLL_INTERVAL : false
    },
  })
}
```

**Benefits:**
- ✅ Eliminates 150+ lines of manual state management
- ✅ Built-in caching (no manual `useState`)
- ✅ Built-in loading/error states
- ✅ **FIXES POLLING BUG** - Auto-stop polling when task completes
- ✅ Automatic background refetching
- ✅ Request deduplication

**Estimated effort:** 2 hours

---

**3.2: Create Mutation Hooks**

**File:** `hooks/use-celery-mutations.ts` (new)

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { CelerySettings, CeleryActionResponse } from '../types'
import { useMemo } from 'react'

export function useCeleryMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Save settings
  const saveSettings = useMutation({
    mutationFn: async (settings: CelerySettings) => {
      const response = await apiCall<CeleryActionResponse>('/api/celery/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      })
      if (!response?.success) {
        throw new Error(response?.message || 'Failed to save settings')
      }
      return response
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.celery.settings() })
      toast({
        title: 'Success',
        description: data.message || 'Settings saved successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to save settings: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Trigger cleanup
  const triggerCleanup = useMutation({
    mutationFn: async () => {
      const response = await apiCall<CeleryActionResponse>('/api/celery/cleanup', {
        method: 'POST'
      })
      if (!response?.task_id) {
        throw new Error(response?.message || 'Failed to trigger cleanup')
      }
      return response
    },
    onSuccess: (data) => {
      toast({
        title: 'Success',
        description: data.task_id ? `Cleanup task started: ${data.task_id}` : 'Cleanup started',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to trigger cleanup: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Submit test task
  const submitTestTask = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiCall<CeleryActionResponse>('/api/celery/test', {
        method: 'POST',
        body: JSON.stringify({ message })
      })
      if (!response?.task_id) {
        throw new Error('Failed to submit test task')
      }
      return response
    },
    onSuccess: (data) => {
      toast({
        title: 'Success',
        description: `Test task submitted: ${data.task_id}`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to submit test task: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Memoize return object to prevent re-renders
  return useMemo(() => ({
    saveSettings,
    triggerCleanup,
    submitTestTask,
  }), [saveSettings, triggerCleanup, submitTestTask])
}
```

**Benefits:**
- ✅ Automatic cache invalidation
- ✅ Consistent error/success handling with Toast
- ✅ Loading states for each mutation
- ✅ Replaces custom message state

**Estimated effort:** 2 hours

---

### Phase 2: Create Component Decomposition

**2.1: Create Status Overview Component**

**File:** `components/celery-status-overview.tsx` (new)

```tsx
'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Database,
  Server,
  Clock,
  Activity,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react'
import { useCeleryStatus } from '../hooks/use-celery-queries'

export function CeleryStatusOverview() {
  const { data: status, isLoading, refetch } = useCeleryStatus()

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading status...</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-lg border-0 overflow-hidden p-0">
      <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4">
        <CardTitle className="flex items-center space-x-2 text-sm font-medium">
          <Activity className="h-4 w-4" />
          <span>System Status</span>
        </CardTitle>
        <CardDescription className="text-blue-100 text-xs">
          Current state of the Celery task queue system
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50">
        <div className="space-y-3">
          {/* Redis Connection */}
          <div className={`flex items-center justify-between p-3 rounded-lg ${
            status?.redis_connected
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center gap-3">
              <Database className={status?.redis_connected ? 'h-5 w-5 text-green-600' : 'h-5 w-5 text-red-600'} />
              <span className="text-sm font-medium">Redis Connection</span>
            </div>
            <Badge className={
              status?.redis_connected
                ? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-100'
                : 'bg-red-100 text-red-800 border-red-300 hover:bg-red-100'
            }>
              {status?.redis_connected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>

          {/* Workers */}
          <div className={`flex items-center justify-between p-3 rounded-lg ${
            (status?.worker_count ?? 0) > 0
              ? 'bg-blue-50 border border-blue-200'
              : 'bg-gray-50 border border-gray-200'
          }`}>
            <div className="flex items-center gap-3">
              <Server className={(status?.worker_count ?? 0) > 0 ? 'h-5 w-5 text-blue-600' : 'h-5 w-5 text-gray-400'} />
              <span className="text-sm font-medium">Celery Workers</span>
            </div>
            <Badge className={
              (status?.worker_count ?? 0) > 0
                ? 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-100'
                : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-100'
            }>
              {status?.worker_count || 0} Active
            </Badge>
          </div>

          {/* Beat Scheduler */}
          <div className={`flex items-center justify-between p-3 rounded-lg ${
            status?.beat_running
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center gap-3">
              <Clock className={status?.beat_running ? 'h-5 w-5 text-green-600' : 'h-5 w-5 text-red-600'} />
              <span className="text-sm font-medium">Beat Scheduler</span>
            </div>
            <Badge className={
              status?.beat_running
                ? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-100'
                : 'bg-red-100 text-red-800 border-red-300 hover:bg-red-100'
            }>
              {status?.beat_running ? 'Running' : 'Stopped'}
            </Badge>
          </div>

          {/* Active Tasks */}
          <div className={`flex items-center justify-between p-3 rounded-lg ${
            (status?.active_tasks ?? 0) > 0
              ? 'bg-purple-50 border border-purple-200'
              : 'bg-gray-50 border border-gray-200'
          }`}>
            <div className="flex items-center gap-3">
              <Activity className={(status?.active_tasks ?? 0) > 0 ? 'h-5 w-5 text-purple-600' : 'h-5 w-5 text-gray-400'} />
              <span className="text-sm font-medium">Active Tasks</span>
            </div>
            <Badge className={
              (status?.active_tasks ?? 0) > 0
                ? 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-100'
                : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-100'
            }>
              {status?.active_tasks || 0} Running
            </Badge>
          </div>
        </div>

        <div className="mt-6">
          <Button onClick={() => refetch()} disabled={isLoading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Status
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

**Estimated effort:** 1.5 hours

---

**2.2: Create Settings Form Component with react-hook-form + zod**

**File:** `components/celery-settings-form.tsx` (new)

```tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form'
import { Server, Trash2, Save, RefreshCw, AlertTriangle } from 'lucide-react'
import { useCelerySettings } from '../hooks/use-celery-queries'
import { useCeleryMutations } from '../hooks/use-celery-mutations'
import { useEffect } from 'react'
import type { CelerySettings } from '../types'

const celerySettingsSchema = z.object({
  max_workers: z.number().min(1).max(32),
  cleanup_enabled: z.boolean(),
  cleanup_interval_hours: z.number().min(1).max(168),
  cleanup_age_hours: z.number().min(1).max(720),
  result_expires_hours: z.number().min(1).max(720),
})

type CelerySettingsFormData = z.infer<typeof celerySettingsSchema>

export function CelerySettingsForm() {
  const { data: settings, isLoading } = useCelerySettings()
  const { saveSettings, triggerCleanup } = useCeleryMutations()

  const form = useForm<CelerySettingsFormData>({
    resolver: zodResolver(celerySettingsSchema),
    defaultValues: settings,
  })

  // Update form when settings load
  useEffect(() => {
    if (settings) {
      form.reset(settings)
    }
  }, [settings, form])

  const handleSubmit = form.handleSubmit((data) => {
    saveSettings.mutate(data as CelerySettings)
  })

  if (isLoading) {
    return <div className="text-center py-8">Loading settings...</div>
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Worker Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-blue-500" />
              <div>
                <CardTitle>Worker Configuration</CardTitle>
                <CardDescription>Configure Celery worker settings</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form className="space-y-4">
                <FormField
                  control={form.control}
                  name="max_workers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Workers (Concurrency)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={32}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 4)}
                        />
                      </FormControl>
                      <FormDescription>
                        Number of concurrent worker processes. Default: 4
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Alert className="bg-amber-50 border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    <span className="font-medium">Restart Required:</span> Changes to worker configuration require restarting the Celery worker to take effect.
                  </AlertDescription>
                </Alert>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Cleanup Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              <div>
                <CardTitle>Data Cleanup</CardTitle>
                <CardDescription>Configure automatic cleanup of old task data</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form className="space-y-4">
                <FormField
                  control={form.control}
                  name="cleanup_enabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel>Enable Automatic Cleanup</FormLabel>
                        <FormDescription>
                          Automatically remove old task results and logs
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cleanup_interval_hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cleanup Interval (Hours)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={168}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 6)}
                          disabled={!form.watch('cleanup_enabled')}
                        />
                      </FormControl>
                      <FormDescription>
                        How often to run the cleanup task. Default: 6 hours
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cleanup_age_hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Retention (Hours)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={720}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 24)}
                          disabled={!form.watch('cleanup_enabled')}
                        />
                      </FormControl>
                      <FormDescription>
                        Remove task results and logs older than this. Default: 24 hours
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => triggerCleanup.mutate()}
                    disabled={triggerCleanup.isPending}
                    className="w-full"
                  >
                    {triggerCleanup.isPending ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Run Cleanup Now
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={saveSettings.isPending || !form.formState.isDirty}>
          {saveSettings.isPending ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Settings
        </Button>
      </div>
    </div>
  )
}
```

**Estimated effort:** 2 hours

---

**2.3: Create Workers List Component**

**File:** `components/celery-workers-list.tsx` (new)

```tsx
'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RefreshCw } from 'lucide-react'
import { useCeleryWorkers } from '../hooks/use-celery-queries'
import type { WorkerStats } from '../types'

export function CeleryWorkersList() {
  const { data: workers, isLoading, refetch } = useCeleryWorkers()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Celery Workers</CardTitle>
            <CardDescription>Active worker processes and their statistics</CardDescription>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {workers?.stats && Object.keys(workers.stats).length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Max Concurrency</TableHead>
                <TableHead>Pool</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(workers.stats).map(([name, stats]: [string, unknown]) => {
                const workerStats = stats as WorkerStats | undefined
                const pool = workerStats?.pool
                return (
                  <TableRow key={name}>
                    <TableCell className="font-mono text-sm">{name}</TableCell>
                    <TableCell>
                      <Badge variant="default">Active</Badge>
                    </TableCell>
                    <TableCell>{String(pool?.['max-concurrency'] ?? 'N/A')}</TableCell>
                    <TableCell>{String(pool?.implementation || 'N/A')}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground py-8">No workers found</p>
        )}
      </CardContent>
    </Card>
  )
}
```

**Estimated effort:** 1 hour

---

**2.4: Create Schedules List Component**

**File:** `components/celery-schedules-list.tsx` (new)

```tsx
'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RefreshCw } from 'lucide-react'
import { useCelerySchedules } from '../hooks/use-celery-queries'

export function CelerySchedulesList() {
  const { data: schedules = [], isLoading, refetch } = useCelerySchedules()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Periodic Task Schedules</CardTitle>
            <CardDescription>Tasks configured to run on a schedule via Celery Beat</CardDescription>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {schedules.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Schedule Name</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Schedule</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((schedule) => (
                <TableRow key={schedule.name}>
                  <TableCell className="font-medium">{schedule.name}</TableCell>
                  <TableCell className="font-mono text-sm">{schedule.task}</TableCell>
                  <TableCell className="text-sm">{schedule.schedule}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground py-8">No schedules configured</p>
        )}
      </CardContent>
    </Card>
  )
}
```

**Estimated effort:** 45 minutes

---

**2.5: Create Test Panel Component**

**File:** `components/celery-test-panel.tsx` (new)

```tsx
'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PlayCircle, RefreshCw } from 'lucide-react'
import { useCeleryMutations } from '../hooks/use-celery-mutations'
import { useTaskStatus } from '../hooks/use-celery-queries'
import { getTaskStatusVariant } from '../utils/celery-utils'

export function CeleryTestPanel() {
  const [testTaskId, setTestTaskId] = useState<string | null>(null)
  const { submitTestTask } = useCeleryMutations()
  const { data: taskStatus, refetch: refetchStatus } = useTaskStatus(testTaskId)

  const handleSubmitTest = async () => {
    const result = await submitTestTask.mutateAsync('Test from Settings UI')
    if (result.task_id) {
      setTestTaskId(result.task_id)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Celery</CardTitle>
        <CardDescription>Submit a test task to verify Celery is working</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleSubmitTest} disabled={submitTestTask.isPending}>
          <PlayCircle className="h-4 w-4 mr-2" />
          Submit Test Task
        </Button>

        {testTaskId && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">Task ID:</p>
              <code className="text-sm bg-muted px-2 py-1 rounded">{testTaskId}</code>
            </div>

            {taskStatus && (
              <div className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status:</span>
                  <Badge variant={getTaskStatusVariant(taskStatus.status)}>
                    {taskStatus.status}
                  </Badge>
                </div>

                {taskStatus.result && (
                  <div>
                    <p className="text-sm font-medium">Result:</p>
                    <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                      {JSON.stringify(taskStatus.result, null, 2)}
                    </pre>
                  </div>
                )}

                {taskStatus.error && (
                  <div>
                    <p className="text-sm font-medium text-red-600">Error:</p>
                    <p className="text-sm text-red-600">{taskStatus.error}</p>
                  </div>
                )}

                <Button onClick={() => refetchStatus()} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Status
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

**Estimated effort:** 1 hour

---

### Phase 4: Refactor Main Container

**File:** `celery-settings.tsx` (refactored)

```tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Server, Database, CheckCircle, XCircle, Activity, Clock } from 'lucide-react'
import { useCeleryStatus } from './hooks/use-celery-queries'
import { CeleryStatusOverview } from './components/celery-status-overview'
import { CelerySettingsForm } from './components/celery-settings-form'
import { CeleryWorkersList } from './components/celery-workers-list'
import { CelerySchedulesList } from './components/celery-schedules-list'
import { CeleryTestPanel } from './components/celery-test-panel'

export function CelerySettingsPage() {
  const { data: celeryStatus } = useCeleryStatus()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="bg-purple-100 p-2 rounded-lg">
          <Server className="h-6 w-6 text-purple-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Celery Task Queue</h1>
          <p className="text-muted-foreground mt-2">
            Monitor and manage Celery workers, tasks, and schedules
          </p>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={celeryStatus?.redis_connected ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Redis</CardTitle>
            <Database className={celeryStatus?.redis_connected ? 'h-4 w-4 text-green-600' : 'h-4 w-4 text-red-600'} />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {celeryStatus?.redis_connected ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-xl font-bold text-green-700">Connected</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="text-xl font-bold text-red-700">Disconnected</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={(celeryStatus?.worker_count ?? 0) > 0 ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workers</CardTitle>
            <Server className={(celeryStatus?.worker_count ?? 0) > 0 ? 'h-4 w-4 text-blue-600' : 'h-4 w-4 text-gray-400'} />
          </CardHeader>
          <CardContent>
            <div className={(celeryStatus?.worker_count ?? 0) > 0 ? 'text-2xl font-bold text-blue-700' : 'text-2xl font-bold text-gray-500'}>
              {celeryStatus?.worker_count || 0}
            </div>
            <p className="text-xs text-muted-foreground">Active workers</p>
          </CardContent>
        </Card>

        <Card className={(celeryStatus?.active_tasks ?? 0) > 0 ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-200'}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
            <Activity className={(celeryStatus?.active_tasks ?? 0) > 0 ? 'h-4 w-4 text-purple-600' : 'h-4 w-4 text-gray-400'} />
          </CardHeader>
          <CardContent>
            <div className={(celeryStatus?.active_tasks ?? 0) > 0 ? 'text-2xl font-bold text-purple-700' : 'text-2xl font-bold text-gray-500'}>
              {celeryStatus?.active_tasks || 0}
            </div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>

        <Card className={celeryStatus?.beat_running ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Beat Scheduler</CardTitle>
            <Clock className={celeryStatus?.beat_running ? 'h-4 w-4 text-green-600' : 'h-4 w-4 text-red-600'} />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {celeryStatus?.beat_running ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-xl font-bold text-green-700">Running</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="text-xl font-bold text-red-700">Stopped</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="workers">Workers</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
          <TabsTrigger value="test">Test</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <CeleryStatusOverview />
        </TabsContent>

        <TabsContent value="settings">
          <CelerySettingsForm />
        </TabsContent>

        <TabsContent value="workers">
          <CeleryWorkersList />
        </TabsContent>

        <TabsContent value="schedules">
          <CelerySchedulesList />
        </TabsContent>

        <TabsContent value="test">
          <CeleryTestPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

**Before:** 693 lines
**After:** ~170 lines (main container)
**Reduction:** ~523 lines (75%)

**Total with new components:** ~700 lines across 7 files
**Net increase:** ~7 lines (1%)

**Estimated effort:** 1 hour

---

## Final Directory Structure (After Refactoring)

```
frontend/src/components/features/settings/celery/
├── celery-settings.tsx            # ~170 lines (was 693, -75%)
├── components/
│   ├── celery-status-overview.tsx # ~120 lines
│   ├── celery-settings-form.tsx   # ~180 lines (with react-hook-form)
│   ├── celery-workers-list.tsx    # ~70 lines
│   ├── celery-schedules-list.tsx  # ~60 lines
│   └── celery-test-panel.tsx      # ~80 lines
├── hooks/
│   ├── use-celery-queries.ts      # ~140 lines
│   └── use-celery-mutations.ts    # ~80 lines
├── types/
│   └── index.ts                   # ~60 lines
└── utils/
    ├── constants.ts               # ~30 lines
    └── celery-utils.ts            # ~30 lines
```

---

## Summary of Changes

| File | Before | After | Change |
|------|--------|-------|--------|
| `celery-settings.tsx` | 693 | ~170 | **-523 lines (-75%)** |
| New components | 0 | ~510 | **+510 lines** |
| New hooks | 0 | ~220 | **+220 lines** |
| New types/utils | 0 | ~120 | **+120 lines** |
| **Total** | **693** | **~1,020** | **+327 lines (+47%)** |

**Net increase** of 327 lines, but with significantly better architecture:
- Proper separation of concerns
- TanStack Query compliance (mandatory)
- **Fixes polling bug** (auto-stop on task completion)
- Reusable components and hooks
- Type-safe form validation
- Better testability
- Easier maintainability

---

## Architecture Compliance (CLAUDE.md)

### Success Metrics

**Code Quality:**
- [ ] Component size < 300 lines each (main container ~170 lines)
- [ ] No duplicate API call logic (unified in query/mutation hooks)
- [ ] No manual `useState` for server data (TanStack Query only)
- [ ] Settings form uses react-hook-form + zod
- [ ] No inline arrays/objects in default parameters
- [ ] **CRITICAL:** No manual polling with setInterval (TanStack Query refetchInterval)
- [ ] Zero ESLint warnings

**Architecture Compliance:**
- [ ] All data fetching uses TanStack Query
- [ ] Query keys in centralized factory (`/lib/query-keys.ts`)
- [ ] API calls via correct endpoint pattern (verify proxy vs direct)
- [ ] Feature-based folder structure (components/, hooks/, types/, utils/)
- [ ] All UI components from Shadcn
- [ ] Backend has repository/service/router layers
- [ ] Backend routes use `verify_admin_token()` dependency

**User Experience:**
- [ ] Auto-refresh status and workers
- [ ] **Auto-polling task status** with automatic stop on completion
- [ ] No regression in functionality
- [ ] Improved loading states (TanStack Query built-in)
- [ ] Better error messages (Toast notifications)
- [ ] Faster perceived performance (automatic caching)

**Developer Experience:**
- [ ] Easier to test (isolated hooks and components)
- [ ] Clear component boundaries
- [ ] Reusable hooks
- [ ] Type safety throughout
- [ ] No stale closure bugs (TanStack Query handles state internally)

---

## Anti-Patterns to Avoid

### ❌ DO NOT Do These During Refactoring

**1. Don't Keep Manual State for Server Data**
- ❌ `const [celeryStatus, setCeleryStatus] = useState<CeleryStatus | null>(null)`
- ❌ `useEffect(() => { loadStatus() }, [])`
- ✅ **Instead:** `const { data: celeryStatus } = useCeleryStatus()`

**2. Don't Keep Manual Polling Logic**
- ❌ `useEffect(() => { const interval = setInterval(checkTaskStatus, 2000) }, [])`
- ✅ **Instead:** TanStack Query `refetchInterval`

**3. Don't Create Custom Loading State Management**
- ❌ `const [isLoading, setIsLoading] = useState(false)`
- ❌ `const [settingsLoading, setSettingsLoading] = useState(false)`
- ✅ **Instead:** TanStack Query provides `isLoading`

**4. Don't Use Custom Message State**
- ❌ `const [message, setMessage] = useState<{type, text} | null>(null)`
- ✅ **Instead:** `useToast()` from Shadcn UI

**5. Don't Skip Form Validation Library**
- ❌ Manual validation with `onChange` handlers
- ❌ Direct state updates
- ✅ **Instead:** react-hook-form + zod (mandatory)

**6. Don't Use Inline Default Objects**
- ❌ `const [settings, setSettings] = useState({ max_workers: 4, ... })`
- ✅ **Instead:** `const DEFAULT_CELERY_SETTINGS = {...} as const`

**7. Don't Keep All Logic in One File**
- ❌ 693-line monolithic component
- ✅ **Instead:** Decompose into focused components < 300 lines

---

## Comparison with Other Refactorings

| Metric | Check IP | Cache Settings | Celery Settings |
|--------|----------|----------------|-----------------|
| Lines of Code | 545 | 976 | 693 |
| Components | 1 | 1 | 1 |
| Manual State Hooks | 9 | 11 | 8 |
| Critical Bug | Polling stale closure | No | **Polling stale closure risk** |
| Refactoring Priority | HIGH (bug) | MEDIUM | **HIGH (bug risk)** |
| Main Issue | Polling bug | Monolithic | **Polling bug risk** |
| Primary Benefit | Fixes bug + decomposition | Decomposition + compliance | **Fixes bug + decomposition** |
| Code Reduction | -74% (main) | -85% (main) | -75% (main) |
| TanStack Query Usage | Auto-polling, mutations | Queries, mutations, polling | **Auto-polling, mutations** |

---

## Recommended Refactoring Order

1. **Phase 1.2** - Add query keys (15 min, zero risk)
2. **Phase 1.3** - Extract types (30 min, zero risk)
3. **Phase 1.4** - Extract constants (15 min, fixes re-render risks)
4. **Phase 1.5** - Extract utilities (30 min, zero risk)
5. **Phase 1.1** - Verify backend architecture + API pattern (45 min)
6. **Phase 3.1** - Create query hooks with auto-polling (2 hours, **FIXES BUG**)
7. **Phase 3.2** - Create mutation hooks (2 hours)
8. **Phase 2.1** - Create status overview (1.5 hours)
9. **Phase 2.2** - Create settings form with react-hook-form (2 hours)
10. **Phase 2.3-2.5** - Create other components (2.75 hours)
11. **Phase 4** - Refactor main container (1 hour)
12. **Testing & Integration** - Test all functionality (2 hours)

**Total Estimated Effort:** ~14.5 hours

---

## Notes

- This refactoring is **RECOMMENDED** to align with CLAUDE.md standards
- **CRITICAL:** The manual polling logic (lines 230-236) is a bug risk similar to Check IP
- TanStack Query migration is **mandatory** per architecture requirements
- Component decomposition improves testability and maintainability
- Form validation with react-hook-form + zod is **mandatory** per standards
- **Must verify API endpoint pattern:** `/api/proxy/celery/*` vs `/api/celery/*`
- Consider this pattern for other settings components

---

**Document Version:** 1.0
**Created:** 2026-01-21
**Status:** Planning
**Priority:** High (polling bug risk + architecture compliance)
