# Refactoring Plan: Cache Settings Component

**Component:** `frontend/src/components/features/settings/cache/cache-management.tsx`
**Created:** 2026-01-21
**Status:** Planning
**Lines of Code:** 976

## TL;DR - What's Wrong & How to Fix It

**Problems:**
1. 🚫 **Architecture violation** - Manual `useState`/`useEffect` instead of mandatory TanStack Query
2. 📏 **Too large** - 976 lines, should be < 300 per component
3. 🔁 **Code duplication** - 6 separate API call functions with identical error handling
4. ⚠️ **Missing standards** - No react-hook-form + zod, inline default objects, 11 loading states
5. 🗂️ **No component decomposition** - Settings, stats, entries, namespace all in one file

**Solution:**
1. ✅ **Migrate to TanStack Query** - Replaces 200+ lines of manual state with built-in caching
2. ✅ **Decompose into 5 components** - Settings form, stats panel, entries list, namespace details, header
3. ✅ **Add mutation hooks** - use-cache-mutations for save/clear/cleanup operations
4. ✅ **Form validation** - react-hook-form + zod for settings form
5. ✅ **Feature-based structure** - components/, hooks/, types/, utils/ subdirectories

**Critical Path:** Phase 1 (foundation) → Phase 3 (TanStack Query) → Phase 2 (decomposition)

**Minimum Viable:** Phases 1-3 establishes proper architecture per CLAUDE.md

---

## Executive Summary

The Cache Management component is a monolithic 976-line file with **critical architecture violations** and significant technical debt:

1. **Architecture Violation** - Uses manual `useState` + `useEffect` instead of mandatory TanStack Query
2. **No Component Decomposition** - Single component handles settings, stats, entries, and namespace details
3. **Manual State Management** - 11 separate `useState` hooks for data and loading states
4. **Duplicate API Logic** - 6 nearly identical API call functions with repeated error handling
5. **Missing Standards** - No react-hook-form, no zod validation, inline default objects
6. **No Shared State** - Each panel loads data independently without caching

**Bottom Line:** TanStack Query migration is mandatory per CLAUDE.md and eliminates 200+ lines of manual state management automatically.

## Key Changes Summary

| Current Approach | Required Approach (CLAUDE.md) |
|------------------|-------------------------------|
| Manual `useState` + `useEffect` | **TanStack Query with auto-caching** |
| 11 separate loading states | **TanStack Query built-in states** |
| Manual API calls with error handling | **useQuery/useMutation hooks** |
| Custom toast management | **TanStack Query onSuccess/onError** |
| Single 976-line component | **5 focused components < 200 lines** |
| Custom form validation | **react-hook-form + zod** |
| Inline default objects | **Module-level constants** |
| No query key factory | **Centralized query keys** |

## Quick Wins (Can Start Immediately)

These tasks can be done right now without breaking existing functionality:

### 1. Extract Type Definitions (30 min)
- Create `types/index.ts`
- Move CacheSettings, CacheStats, CacheEntry, NamespaceInfo interfaces
- No behavioral changes

### 2. Extract Constants (20 min)
- Create `utils/constants.ts`
- Move default prefetch_items object (line 102-109)
- Extract status message types
- Fixes potential re-render issues

### 3. Extract Utility Functions (45 min)
- Create `utils/cache-utils.ts`
- Move formatting functions (size conversion, time formatting)
- Add unit tests
- No UI changes

### 4. Add Query Keys (15 min)
- Add to `/lib/query-keys.ts`
- Set up foundation for TanStack Query migration

### 5. Verify Backend Architecture (30 min)
- Confirm backend endpoints use repository/service/router layers
- Check for proper auth (verify_admin_token)
- Ensure endpoints at `/api/proxy/cache/*` and `/api/proxy/settings/cache`

**Total:** ~2.5 hours
**Risk:** Zero (no behavioral changes)
**Benefit:** Immediate code quality improvement, sets up for TanStack Query migration

---

## Current Architecture

```
frontend/src/components/features/settings/cache/
└── cache-management.tsx       # 976 lines - Everything in one file
```

**Responsibilities:**
- Cache settings form (lines 368-543)
- Quick stats sidebar (lines 625-699)
- Detailed stats panel (lines 702-819)
- Cache entries panel (lines 821-923)
- Namespace details modal (lines 925-972)

**Total:** 976 lines with mixed concerns

---

## Problem Analysis

### Problem 1: Architecture Violation - Manual State Management

**Affected Lines:** 96-124, 131-290

**Current Pattern:**
```tsx
// Lines 96-124: Manual state management
const [settings, setSettings] = useState<CacheSettings>({...})
const [stats, setStats] = useState<CacheStats | null>(null)
const [entries, setEntries] = useState<CacheEntry[]>([])
const [loading, setLoading] = useState(false)
const [saving, setSaving] = useState(false)
const [clearingCache, setClearingCache] = useState(false)
const [loadingStats, setLoadingStats] = useState(false)
const [loadingEntries, setLoadingEntries] = useState(false)
const [loadingNamespace, setLoadingNamespace] = useState(false)

// Lines 131-154: Manual API call with error handling
const loadSettings = useCallback(async () => {
  setLoading(true)
  try {
    const response = await apiCall<{ success: boolean; data: CacheSettings }>('settings/cache')
    if (response?.success && response.data) {
      setSettings(loadedSettings)
      setOriginalSettings(loadedSettings)
    } else {
      showMessage('Failed to load cache settings', 'error')
    }
  } catch (error) {
    showMessage('Error loading cache settings', 'error')
  } finally {
    setLoading(false)
  }
}, [apiCall, showMessage])
```

**Issues:**
- Manual loading state management (11 states)
- Duplicate error handling pattern (6 functions)
- No caching mechanism
- Manual state updates
- Violates CLAUDE.md mandatory TanStack Query requirement

---

### Problem 2: Duplicate API Call Pattern (6 implementations)

**Affected Lines:**
- `loadSettings()` - Lines 131-154
- `saveSettings()` - Lines 156-178
- `loadStats()` - Lines 180-195
- `loadEntries()` - Lines 197-212
- `loadNamespaceInfo()` - Lines 214-229
- `cleanupExpired()` - Lines 231-255
- `clearCache()` - Lines 257-290

**Identical Pattern:**
```tsx
const loadX = async () => {
  setLoadingX(true)
  try {
    const response = await apiCall<ResponseType>('endpoint')
    if (response?.success && response.data) {
      setData(response.data)
    } else {
      showMessage('Failed to load X', 'error')
    }
  } catch (error) {
    showMessage('Error loading X', 'error')
  } finally {
    setLoadingX(false)
  }
}
```

**Issue:** Every API call has identical error handling, loading state management, and toast logic.

---

### Problem 3: Monolithic Component Structure

**Single component handles:**
1. Settings form management (lines 368-543)
2. Quick stats display (lines 625-699)
3. Detailed stats with namespace breakdown (lines 702-819)
4. Cache entries list with filtering (lines 821-923)
5. Namespace details modal (lines 925-972)
6. Status message management (lines 335-350)
7. Loading states (lines 298-317)

**Should be:** 5 separate components with clear boundaries

---

### Problem 4: No Form Validation Standard

**Location:** Lines 368-543 (settings form)

**Current:**
- No validation schema
- Manual onChange handlers
- No form state management
- Direct state updates

**Required:** react-hook-form + zod validation per CLAUDE.md

---

### Problem 5: Inline Default Objects

**Location:** Lines 102-109

```tsx
prefetch_items: {
  git: true,
  locations: false,
  devices: false
}
```

**Issue:** Creates new object every render, potential re-render trigger

**Solution:** Extract to module-level constant

---

### Problem 6: No Centralized Query Keys

**Issue:** Direct API calls without using query key factory pattern

**Example:**
```tsx
await apiCall<{ success: boolean; data: CacheSettings }>('settings/cache')
await apiCall<{ success: boolean; data: CacheStats }>('cache/stats')
```

**Required:** Use centralized query keys from `/lib/query-keys.ts`

---

### Problem 7: Conditional Data Loading Logic

**Lines:** 566-569, 581-583

```tsx
onClick={() => {
  setShowStats(!showStats)
  if (!showStats && !stats) {  // Manual check
    loadStats()
  }
}}
```

**Issue:** Manual conditional loading logic

**Solution:** TanStack Query with `enabled` parameter handles this automatically

---

## Proposed Refactoring Plan

### Phase 1: Foundation & Setup (CRITICAL)

**1.1: Verify Backend Architecture**

- [ ] Confirm backend endpoints use repository pattern
- [ ] Verify service layer exists for cache operations
- [ ] Check routers use `verify_admin_token()` dependency
- [ ] Ensure endpoints at `/api/proxy/cache/*` and `/api/proxy/settings/cache`

---

**1.2: Add Query Keys to Centralized Factory**

**File:** `/frontend/src/lib/query-keys.ts` (modify)

```tsx
// Add to existing queryKeys object
cache: {
  all: ['cache'] as const,

  // Settings
  settings: () => [...queryKeys.cache.all, 'settings'] as const,

  // Statistics
  stats: () => [...queryKeys.cache.all, 'stats'] as const,

  // Entries
  entries: (includeExpired?: boolean) =>
    includeExpired
      ? ([...queryKeys.cache.all, 'entries', { includeExpired }] as const)
      : ([...queryKeys.cache.all, 'entries'] as const),

  // Namespace
  namespace: (namespace: string) => [...queryKeys.cache.all, 'namespace', namespace] as const,
},
```

---

**1.3: Create Type Definitions**

**File:** `components/features/settings/cache/types/index.ts` (new)

```tsx
export interface CacheSettings {
  enabled: boolean
  ttl_seconds: number
  prefetch_on_startup: boolean
  refresh_interval_minutes: number
  max_commits: number
  prefetch_items?: {
    git?: boolean
    locations?: boolean
    devices?: boolean
  }
  devices_cache_interval_minutes?: number
  locations_cache_interval_minutes?: number
  git_commits_cache_interval_minutes?: number
}

export interface CacheStats {
  overview: {
    total_items: number
    valid_items: number
    expired_items: number
    total_size_bytes: number
    total_size_mb: number
    uptime_seconds: number
  }
  performance: {
    cache_hits: number
    cache_misses: number
    hit_rate_percent: number
    expired_entries: number
    entries_created: number
    entries_cleared: number
  }
  namespaces: Record<string, { count: number; size_bytes: number }>
  keys: string[]
}

export interface CacheEntry {
  key: string
  namespace: string
  created_at: number
  expires_at: number
  last_accessed: number
  access_count: number
  size_bytes: number
  age_seconds: number
  ttl_seconds: number
  last_accessed_ago: number
  is_expired: boolean
}

export interface NamespaceInfo {
  namespace: string
  total_entries: number
  valid_entries: number
  expired_entries: number
  total_size_bytes: number
  total_size_mb: number
  entries: CacheEntry[]
}

export interface StatusMessage {
  type: 'success' | 'error' | 'info'
  text: string
}

// API Response types
export interface CacheSettingsResponse {
  success: boolean
  data: CacheSettings
}

export interface CacheStatsResponse {
  success: boolean
  data: CacheStats
}

export interface CacheEntriesResponse {
  success: boolean
  data: CacheEntry[]
  count: number
}

export interface NamespaceInfoResponse {
  success: boolean
  data: NamespaceInfo
}

export interface CacheActionResponse {
  success: boolean
  message?: string
  removed_count?: number
  cleared_count?: number
}
```

---

**1.4: Create Constants**

**File:** `components/features/settings/cache/utils/constants.ts` (new)

```tsx
import type { CacheSettings } from '../types'

// React best practice: Extract default objects to prevent re-render loops
export const DEFAULT_PREFETCH_ITEMS = {
  git: true,
  locations: false,
  devices: false,
} as const

export const DEFAULT_CACHE_SETTINGS: Partial<CacheSettings> = {
  enabled: true,
  ttl_seconds: 600,
  prefetch_on_startup: true,
  refresh_interval_minutes: 15,
  max_commits: 500,
  prefetch_items: DEFAULT_PREFETCH_ITEMS,
  devices_cache_interval_minutes: 60,
  locations_cache_interval_minutes: 10,
  git_commits_cache_interval_minutes: 15,
} as const

export const STALE_TIME = {
  SETTINGS: 5 * 60 * 1000,  // 5 minutes - settings rarely change
  STATS: 0,                  // Always fresh - real-time stats
  ENTRIES: 10 * 1000,        // 10 seconds - moderate freshness
} as const
```

---

**1.5: Create Utility Functions**

**File:** `components/features/settings/cache/utils/cache-utils.ts` (new)

```tsx
/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * Format seconds to human-readable duration
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

/**
 * Convert MB to bytes
 */
export function mbToBytes(mb: number): number {
  return mb * 1024 * 1024
}

/**
 * Check if cache entry is about to expire (within 10% of TTL)
 */
export function isExpiringSoon(entry: { ttl_seconds: number; age_seconds: number }): boolean {
  return entry.age_seconds > entry.ttl_seconds * 0.9
}
```

---

### Phase 3: TanStack Query Migration (CRITICAL - Mandatory)

**Note:** TanStack Query is mandatory for all data fetching per CLAUDE.md. This replaces manual state management entirely.

**3.1: Create Query Hooks**

**File:** `hooks/use-cache-queries.ts` (new)

```tsx
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type {
  CacheSettings,
  CacheStats,
  CacheEntry,
  NamespaceInfo,
  CacheSettingsResponse,
  CacheStatsResponse,
  CacheEntriesResponse,
  NamespaceInfoResponse
} from '../types'
import { DEFAULT_CACHE_SETTINGS, STALE_TIME } from '../utils/constants'
import { useMemo } from 'react'

interface UseCacheSettingsOptions {
  enabled?: boolean
}

const DEFAULT_SETTINGS_OPTIONS: UseCacheSettingsOptions = { enabled: true }

/**
 * Fetch cache settings with automatic caching
 */
export function useCacheSettings(options: UseCacheSettingsOptions = DEFAULT_SETTINGS_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.cache.settings(),
    queryFn: async () => {
      const response = await apiCall<CacheSettingsResponse>('settings/cache', { method: 'GET' })
      if (!response?.success || !response.data) {
        throw new Error('Failed to load cache settings')
      }

      // Merge with defaults
      return {
        ...DEFAULT_CACHE_SETTINGS,
        ...response.data,
        prefetch_items: response.data.prefetch_items || DEFAULT_CACHE_SETTINGS.prefetch_items,
      } as CacheSettings
    },
    enabled,
    staleTime: STALE_TIME.SETTINGS,
  })
}

/**
 * Fetch cache statistics with automatic refresh
 */
export function useCacheStats(options: { enabled?: boolean } = {}) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.cache.stats(),
    queryFn: async () => {
      const response = await apiCall<CacheStatsResponse>('cache/stats', { method: 'GET' })
      if (!response?.success || !response.data) {
        throw new Error('Failed to load cache statistics')
      }
      return response.data
    },
    enabled,
    staleTime: STALE_TIME.STATS, // Always fresh
    refetchInterval: enabled ? 30000 : false, // Auto-refresh every 30s when visible
  })
}

/**
 * Fetch cache entries with filtering
 */
export function useCacheEntries(
  includeExpired: boolean = false,
  options: { enabled?: boolean } = {}
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.cache.entries(includeExpired),
    queryFn: async () => {
      const response = await apiCall<CacheEntriesResponse>(
        `cache/entries?include_expired=${includeExpired}`,
        { method: 'GET' }
      )
      if (!response?.success || !response.data) {
        throw new Error('Failed to load cache entries')
      }
      return response.data
    },
    enabled,
    staleTime: STALE_TIME.ENTRIES,
  })
}

/**
 * Fetch namespace information
 */
export function useCacheNamespace(
  namespace: string | null,
  options: { enabled?: boolean } = {}
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.cache.namespace(namespace!),
    queryFn: async () => {
      const response = await apiCall<NamespaceInfoResponse>(
        `cache/namespace/${namespace}`,
        { method: 'GET' }
      )
      if (!response?.success || !response.data) {
        throw new Error(`Failed to load namespace '${namespace}' information`)
      }
      return response.data
    },
    enabled: enabled && !!namespace,
    staleTime: STALE_TIME.ENTRIES,
  })
}
```

**Benefits:**
- ✅ Eliminates 200+ lines of manual state management
- ✅ Built-in caching (no manual `useState`)
- ✅ Built-in loading/error states
- ✅ Automatic background refetching
- ✅ Request deduplication
- ✅ Auto-refresh stats every 30s

---

**3.2: Create Mutation Hooks**

**File:** `hooks/use-cache-mutations.ts` (new)

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { CacheSettings, CacheActionResponse } from '../types'
import { useMemo } from 'react'

export function useCacheMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Save settings
  const saveSettings = useMutation({
    mutationFn: async (settings: CacheSettings) => {
      const response = await apiCall<CacheActionResponse>('settings/cache', {
        method: 'PUT',
        body: JSON.stringify(settings)
      })
      if (!response?.success) {
        throw new Error(response?.message || 'Failed to save settings')
      }
      return response
    },
    onSuccess: () => {
      // Invalidate settings to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.cache.settings() })
      toast({
        title: 'Success',
        description: 'Cache settings saved successfully',
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

  // Clear cache
  const clearCache = useMutation({
    mutationFn: async (namespace?: string) => {
      const body = namespace ? { namespace } : {}
      const response = await apiCall<CacheActionResponse>('cache/clear', {
        method: 'POST',
        body: JSON.stringify(body)
      })
      if (!response?.success) {
        throw new Error(response?.message || 'Failed to clear cache')
      }
      return response
    },
    onSuccess: (data) => {
      // Invalidate all cache queries
      queryClient.invalidateQueries({ queryKey: queryKeys.cache.stats() })
      queryClient.invalidateQueries({ queryKey: queryKeys.cache.entries() })
      toast({
        title: 'Success',
        description: data.message || 'Cache cleared successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to clear cache: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Cleanup expired entries
  const cleanupExpired = useMutation({
    mutationFn: async () => {
      const response = await apiCall<CacheActionResponse>('cache/cleanup', {
        method: 'POST'
      })
      if (!response?.success) {
        throw new Error(response?.message || 'Failed to cleanup expired entries')
      }
      return response
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cache.stats() })
      queryClient.invalidateQueries({ queryKey: queryKeys.cache.entries() })
      toast({
        title: 'Success',
        description: data.message || `Removed ${data.removed_count || 0} expired entries`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to cleanup: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Memoize return object to prevent re-renders
  return useMemo(() => ({
    saveSettings,
    clearCache,
    cleanupExpired,
  }), [saveSettings, clearCache, cleanupExpired])
}
```

**Benefits:**
- ✅ Automatic cache invalidation
- ✅ Consistent error/success handling
- ✅ Loading states for each mutation
- ✅ Toast notifications built-in

---

### Phase 2: Create Component Decomposition

**2.1: Create Settings Form Component with react-hook-form + zod**

**File:** `components/cache-settings-form.tsx` (new)

```tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Save, RefreshCw, Settings } from 'lucide-react'
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription } from '@/components/ui/form'
import { useCacheSettings } from '../hooks/use-cache-queries'
import { useCacheMutations } from '../hooks/use-cache-mutations'
import { useEffect } from 'react'
import type { CacheSettings } from '../types'

const cacheSettingsSchema = z.object({
  enabled: z.boolean(),
  ttl_seconds: z.number().min(30).max(3600),
  prefetch_on_startup: z.boolean(),
  refresh_interval_minutes: z.number().min(1).max(1440),
  max_commits: z.number().min(50).max(10000),
  prefetch_items: z.object({
    git: z.boolean().optional(),
    locations: z.boolean().optional(),
    devices: z.boolean().optional(),
  }).optional(),
  devices_cache_interval_minutes: z.number().min(0).max(1440),
  locations_cache_interval_minutes: z.number().min(0).max(1440),
  git_commits_cache_interval_minutes: z.number().min(0).max(1440),
})

type CacheSettingsFormData = z.infer<typeof cacheSettingsSchema>

export function CacheSettingsForm() {
  const { data: settings, isLoading } = useCacheSettings()
  const { saveSettings } = useCacheMutations()

  const form = useForm<CacheSettingsFormData>({
    resolver: zodResolver(cacheSettingsSchema),
    defaultValues: settings,
  })

  // Update form when settings load
  useEffect(() => {
    if (settings) {
      form.reset(settings)
    }
  }, [settings, form])

  const handleSubmit = form.handleSubmit((data) => {
    saveSettings.mutate(data as CacheSettings)
  })

  if (isLoading) {
    return <div className="text-center py-8">Loading settings...</div>
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Settings className="h-4 w-4" />
          <div>
            <h1 className="text-sm font-semibold">Cache Configuration</h1>
            <p className="text-blue-100 text-xs">Configure caching behavior to optimize performance</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Enable Cache */}
            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base font-medium">Enable Cache</FormLabel>
                    <FormDescription>
                      Turn caching on or off globally
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

            <Separator />

            {/* TTL */}
            <FormField
              control={form.control}
              name="ttl_seconds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>TTL (Time To Live) - Seconds</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={30}
                      step={30}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 600)}
                    />
                  </FormControl>
                  <FormDescription>
                    How long to keep cached items before refreshing (minimum 30 seconds)
                  </FormDescription>
                </FormItem>
              )}
            />

            {/* Prefetch on Startup */}
            <FormField
              control={form.control}
              name="prefetch_on_startup"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base font-medium">Prefetch on Startup</FormLabel>
                    <FormDescription>
                      Warm the cache when the backend starts
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

            {/* More form fields... */}

            <Separator />

            {/* Submit Button */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={saveSettings.isPending || !form.formState.isDirty}
                className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
              >
                {saveSettings.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Settings
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}
```

**Benefits:**
- ✅ Type-safe form validation with zod
- ✅ Automatic form state management
- ✅ Built-in dirty checking
- ✅ TanStack Query integration

---

**2.2: Create Stats Panel Component**

**File:** `components/cache-stats-panel.tsx` (new)

```tsx
'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { HardDrive, RefreshCw, Database, Trash2 } from 'lucide-react'
import { useCacheStats } from '../hooks/use-cache-queries'
import { useCacheMutations } from '../hooks/use-cache-mutations'

interface CacheStatsPanelProps {
  onLoadNamespace: (namespace: string) => void
}

export function CacheStatsPanel({ onLoadNamespace }: CacheStatsPanelProps) {
  const { data: stats, isLoading, refetch } = useCacheStats()
  const { clearCache } = useCacheMutations()

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading statistics...</span>
        </CardContent>
      </Card>
    )
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="text-center py-8 text-gray-500">
          Failed to load cache statistics
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Detailed Cache Statistics
        </CardTitle>
        <CardDescription>
          Comprehensive cache performance metrics and namespace breakdown
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Performance Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.overview.total_items}</div>
              <div className="text-sm text-blue-700">Total Entries</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.overview.valid_items}</div>
              <div className="text-sm text-green-700">Valid Entries</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{stats.overview.expired_items}</div>
              <div className="text-sm text-orange-700">Expired Entries</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {stats.performance.hit_rate_percent.toFixed(1)}%
              </div>
              <div className="text-sm text-purple-700">Hit Rate</div>
            </div>
          </div>

          {/* Namespace Breakdown */}
          {stats.namespaces && Object.keys(stats.namespaces).length > 0 && (
            <div>
              <h4 className="text-lg font-medium mb-3">Cache Namespaces</h4>
              <div className="space-y-2">
                {Object.entries(stats.namespaces).map(([namespace, info]) => (
                  <div key={namespace} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium">{namespace}</div>
                      <div className="text-sm text-gray-500">
                        {info.count} entries • {(info.size_bytes / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onLoadNamespace(namespace)}
                        className="text-blue-600 hover:text-blue-700 border-blue-200 hover:border-blue-300"
                      >
                        <Database className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Clear the "${namespace}" namespace?`)) {
                            clearCache.mutate(namespace)
                          }
                        }}
                        disabled={clearCache.isPending}
                        className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Refresh Button */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh Stats
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

---

**2.3: Create Cache Entries List Component**

**File:** `components/cache-entries-list.tsx` (new)

```tsx
'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Database, RefreshCw, Trash2 } from 'lucide-react'
import { useCacheEntries } from '../hooks/use-cache-queries'
import { useCacheMutations } from '../hooks/use-cache-mutations'

export function CacheEntriesList() {
  const [includeExpired, setIncludeExpired] = useState(false)
  const { data: entries = [], isLoading, refetch } = useCacheEntries(includeExpired)
  const { clearCache } = useCacheMutations()

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading cache entries...</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Cache Entries
        </CardTitle>
        <CardDescription>
          Detailed view of individual cache entries with access patterns
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                id="include-expired"
                checked={includeExpired}
                onCheckedChange={(checked) => {
                  setIncludeExpired(checked)
                }}
              />
              <Label htmlFor="include-expired" className="text-sm">
                Include expired entries
              </Label>
            </div>
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Entries List */}
          {entries.length > 0 ? (
            <>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {entries.map((entry) => (
                  <div
                    key={entry.key}
                    className={`p-3 rounded-lg border ${
                      entry.is_expired
                        ? 'bg-red-50 border-red-200'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm text-gray-900 truncate">
                          {entry.key}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                          <span>NS: {entry.namespace}</span>
                          <span>Size: {(entry.size_bytes / 1024).toFixed(1)}KB</span>
                          <span>Accessed: {entry.access_count}x</span>
                          <span>Age: {Math.floor(entry.age_seconds / 60)}m</span>
                          {!entry.is_expired && (
                            <span className="text-green-600">
                              TTL: {Math.floor(entry.ttl_seconds / 60)}m
                            </span>
                          )}
                          {entry.is_expired && (
                            <span className="text-red-600">EXPIRED</span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Clear namespace "${entry.namespace}"?`)) {
                            clearCache.mutate(entry.namespace)
                          }
                        }}
                        disabled={clearCache.isPending}
                        className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-sm text-gray-500 text-center">
                Showing {entries.length} entries
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No cache entries found
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

---

**2.4: Create Quick Stats Sidebar**

**File:** `components/cache-quick-stats.tsx` (new)

```tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { AlertCircle, Database } from 'lucide-react'
import { useCacheSettings } from '../hooks/use-cache-queries'
import { useCacheStats } from '../hooks/use-cache-queries'

interface CacheQuickStatsProps {
  hasChanges?: boolean
}

export function CacheQuickStats({ hasChanges = false }: CacheQuickStatsProps) {
  const { data: settings } = useCacheSettings()
  const { data: stats } = useCacheStats({ enabled: true })

  if (!settings) return null

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4" />
            Quick Stats
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Cache Status:</span>
            <span className={`font-medium ${settings.enabled ? 'text-green-600' : 'text-red-600'}`}>
              {settings.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">TTL:</span>
            <span className="font-medium">{settings.ttl_seconds}s</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Max Commits:</span>
            <span className="font-medium">{settings.max_commits}</span>
          </div>

          {stats && (
            <>
              <Separator />
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Cache Size:</span>
                <span className="font-medium">{stats.overview.total_size_mb.toFixed(2)} MB</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Total Entries:</span>
                <span className="font-medium">{stats.overview.total_items}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Valid Entries:</span>
                <span className="font-medium text-green-600">{stats.overview.valid_items}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Expired Entries:</span>
                <span className="font-medium text-red-600">{stats.overview.expired_items}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Hit Rate:</span>
                <span className="font-medium text-blue-600">{stats.performance.hit_rate_percent.toFixed(1)}%</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Changes indicator */}
      {hasChanges && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Unsaved Changes</span>
            </div>
            <p className="text-xs text-yellow-700 mt-1">
              Don&apos;t forget to save your changes!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

---

### Phase 4: Refactor Main Container

**File:** `cache-management.tsx` (refactored)

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Zap, BarChart3, Database, Clock, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { CacheSettingsForm } from './components/cache-settings-form'
import { CacheQuickStats } from './components/cache-quick-stats'
import { CacheStatsPanel } from './components/cache-stats-panel'
import { CacheEntriesList } from './components/cache-entries-list'
import { useCacheMutations } from './hooks/use-cache-mutations'
import { useCacheNamespace } from './hooks/use-cache-queries'

export default function CacheManagement() {
  const [showStats, setShowStats] = useState(false)
  const [showEntries, setShowEntries] = useState(false)
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(null)

  const { clearCache, cleanupExpired } = useCacheMutations()
  const { data: namespaceInfo } = useCacheNamespace(selectedNamespace)

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear the entire cache?')) {
      clearCache.mutate()
    }
  }

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center space-x-3">
          <div className="bg-yellow-100 p-2 rounded-lg">
            <Zap className="h-6 w-6 text-yellow-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Cache Settings</h1>
            <p className="text-gray-600">Control performance-related caching</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Settings */}
        <div className="lg:col-span-2 space-y-6">
          <CacheSettingsForm />

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => setShowStats(!showStats)}
              className="flex items-center gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              {showStats ? 'Hide' : 'Show'} Stats
              {showStats ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>

            <Button
              variant="outline"
              onClick={() => setShowEntries(!showEntries)}
              className="flex items-center gap-2"
            >
              <Database className="h-4 w-4" />
              {showEntries ? 'Hide' : 'Show'} Entries
              {showEntries ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>

            <Button
              variant="outline"
              onClick={() => cleanupExpired.mutate()}
              disabled={cleanupExpired.isPending}
              className="flex items-center gap-2"
            >
              <Clock className="h-4 w-4" />
              Cleanup Expired
            </Button>

            <Button
              variant="destructive"
              onClick={handleClearAll}
              disabled={clearCache.isPending}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Clear All Cache
            </Button>
          </div>

          {/* Conditional Panels */}
          {showStats && (
            <CacheStatsPanel onLoadNamespace={setSelectedNamespace} />
          )}

          {showEntries && (
            <CacheEntriesList />
          )}

          {/* Namespace Details (if selected) */}
          {namespaceInfo && (
            <div className="mt-6">
              {/* Render namespace details */}
            </div>
          )}
        </div>

        {/* Quick Stats Sidebar */}
        <div>
          <CacheQuickStats />
        </div>
      </div>
    </div>
  )
}
```

**Before:** 976 lines
**After:** ~150 lines (main container)
**Reduction:** ~826 lines (84%)

**Total with new components:** ~650 lines across 6 files
**Net reduction:** ~326 lines (33%)

---

## Final Directory Structure (After Refactoring)

```
frontend/src/components/features/settings/cache/
├── cache-management.tsx           # ~150 lines (was 976, -85%)
├── components/
│   ├── cache-settings-form.tsx    # ~200 lines (with react-hook-form)
│   ├── cache-stats-panel.tsx      # ~120 lines
│   ├── cache-entries-list.tsx     # ~100 lines
│   ├── cache-quick-stats.tsx      # ~80 lines
│   └── cache-namespace-details.tsx # ~60 lines (optional)
├── hooks/
│   ├── use-cache-queries.ts       # ~150 lines
│   └── use-cache-mutations.ts     # ~100 lines
├── types/
│   └── index.ts                   # ~80 lines
└── utils/
    ├── constants.ts               # ~30 lines
    └── cache-utils.ts             # ~40 lines
```

---

## Summary of Changes

| File | Before | After | Change |
|------|--------|-------|--------|
| `cache-management.tsx` | 976 | ~150 | **-826 lines (-85%)** |
| New components | 0 | ~560 | **+560 lines** |
| New hooks | 0 | ~250 | **+250 lines** |
| New types/utils | 0 | ~150 | **+150 lines** |
| **Total** | **976** | **~1,110** | **+134 lines (+14%)** |

**Net increase** of 134 lines, but with significantly better architecture:
- Proper separation of concerns
- TanStack Query compliance (mandatory)
- Reusable components and hooks
- Type-safe form validation
- Better testability
- Easier maintainability

---

## Architecture Compliance (CLAUDE.md)

### Success Metrics

**Code Quality:**
- [ ] Component size < 300 lines each (main container ~150 lines)
- [ ] No duplicate API call logic (unified in query/mutation hooks)
- [ ] No manual `useState` for server data (TanStack Query only)
- [ ] Settings form uses react-hook-form + zod
- [ ] No inline arrays/objects in default parameters
- [ ] Zero ESLint warnings

**Architecture Compliance:**
- [ ] All data fetching uses TanStack Query
- [ ] Query keys in centralized factory (`/lib/query-keys.ts`)
- [ ] API calls via `/api/proxy/cache/*` and `/api/proxy/settings/cache`
- [ ] Feature-based folder structure (components/, hooks/, types/, utils/)
- [ ] All UI components from Shadcn
- [ ] Backend has repository/service/router layers
- [ ] Backend routes use `verify_admin_token()` dependency

**User Experience:**
- [ ] Auto-refresh stats every 30s (TanStack Query automatic)
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
- ❌ `const [settings, setSettings] = useState<CacheSettings>({})`
- ❌ `useEffect(() => { loadSettings() }, [])`
- ✅ **Instead:** `const { data: settings } = useCacheSettings()`

**2. Don't Create Custom Loading State Management**
- ❌ `const [loading, setLoading] = useState(false)`
- ✅ **Instead:** TanStack Query provides `isLoading`

**3. Don't Manually Handle Conditional Loading**
- ❌ `if (!showStats && !stats) { loadStats() }`
- ✅ **Instead:** `useCacheStats({ enabled: showStats })`

**4. Don't Use Inline Default Objects**
- ❌ `prefetch_items: { git: true, locations: false }`
- ✅ **Instead:** `const DEFAULT_PREFETCH_ITEMS = {...} as const`

**5. Don't Skip Form Validation Library**
- ❌ Manual validation with `onChange` handlers
- ✅ **Instead:** react-hook-form + zod (mandatory)

**6. Don't Keep All Logic in One File**
- ❌ 976-line monolithic component
- ✅ **Instead:** Decompose into focused components < 300 lines

---

## Comparison with Other Refactorings

| Metric | Check IP | RBAC Settings | Cache Settings |
|--------|----------|---------------|----------------|
| Lines of Code | 545 | 1,869 | 976 |
| Components | 1 | 6 | 1 |
| Manual State Hooks | 9 | Multiple | 11 |
| Refactoring Priority | HIGH (bug) | MEDIUM | MEDIUM |
| Main Issue | Polling bug | Code duplication | Monolithic component |
| Primary Benefit | Fixes bug + decomposition | DRY + shared state | Decomposition + compliance |
| Code Reduction | -74% (main) | -40% per component | -85% (main) |

---

## Recommended Refactoring Order

1. **Phase 1.2** - Add query keys (15 min, zero risk)
2. **Phase 1.3** - Extract types (30 min, zero risk)
3. **Phase 1.4** - Extract constants (20 min, fixes re-render risks)
4. **Phase 1.5** - Extract utilities (45 min, zero risk)
5. **Phase 1.1** - Verify backend architecture (30 min)
6. **Phase 3.1** - Create query hooks (2 hours, sets foundation)
7. **Phase 3.2** - Create mutation hooks (2 hours, completes TanStack Query)
8. **Phase 2.1** - Create settings form with react-hook-form (3 hours)
9. **Phase 2.2-2.4** - Create other components (3 hours)
10. **Phase 4** - Refactor main container (1 hour)
11. **Testing & Integration** - Test all functionality (2 hours)

**Total Estimated Effort:** ~14 hours

---

## Notes

- This refactoring is **recommended** to align with CLAUDE.md standards
- TanStack Query migration is **mandatory** per architecture requirements
- Component decomposition improves testability and maintainability
- Form validation with react-hook-form + zod is **mandatory** per standards
- Consider this pattern for other large settings components

---

**Document Version:** 1.0
**Created:** 2026-01-21
**Status:** Planning
**Priority:** Medium (architecture compliance)
