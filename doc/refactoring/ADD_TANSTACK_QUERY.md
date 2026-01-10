# Implementation Plan: TanStack Query Migration

## Goal
Replace manual data fetching logic (`useApi` + `useEffect` + `useState`) with **TanStack Query (React Query)** to eliminate race conditions, remove boilerplate, enable intelligent caching, and standardize server state management.

## Benefits
- ✅ **Eliminate Race Conditions**: No more stale closure bugs from `useEffect`
- ✅ **Automatic Caching**: Reduce redundant API calls
- ✅ **Background Refetching**: Keep data fresh automatically
- ✅ **Request Deduplication**: Multiple components requesting same data = one API call
- ✅ **Optimistic Updates**: Instant UI feedback for mutations
- ✅ **Job Polling**: Replace `setInterval` with declarative `refetchInterval`
- ✅ **DevTools**: Visualize queries, mutations, and cache state

---

## 1. Installation

```bash
npm install @tanstack/react-query@latest @tanstack/react-query-devtools@latest
```

**Expected versions:**
- `@tanstack/react-query`: ^5.x
- `@tanstack/react-query-devtools`: ^5.x

---

## 2. Next.js 15 App Router Integration

### 2.1 Create Query Client Factory

**File:** `src/lib/query-client.ts`

```typescript
import {
  isServer,
  QueryClient,
  QueryCache,
  MutationCache,
  defaultShouldDehydrateQuery,
} from '@tanstack/react-query'

// IMPORTANT: Don't use module-level state for toast
// It causes race conditions and doesn't work with SSR/concurrent rendering
// Instead, we'll handle errors at the component level or use an event emitter

function makeQueryClient() {
  return new QueryClient({
    // Global query error handling - minimal, let components handle UI
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Skip auth errors (useApi handles logout/redirect)
        if (error instanceof Error &&
            (error.message.includes('Session expired') ||
             error.message.includes('401'))) {
          return
        }

        // Log errors for debugging (can add error tracking service here)
        console.error('Query error:', error, 'Query key:', query.queryKey)
        
        // Note: Toast notifications should be handled by components
        // using error boundaries or the error object from useQuery
      }
    }),

    // Global mutation error handling - minimal
    mutationCache: new MutationCache({
      onError: (error, variables, context, mutation) => {
        // Skip auth errors
        if (error instanceof Error &&
            (error.message.includes('Session expired') ||
             error.message.includes('401'))) {
          return
        }

        // Log errors (can add error tracking service here)
        console.error('Mutation error:', error)
        
        // Note: Toast notifications should be handled by individual mutations
        // This allows customized error messages per operation
      }
    }),

    defaultOptions: {
      queries: {
        // Consider data fresh for 30 seconds
        staleTime: 30 * 1000,

        // Keep unused data in cache for 5 minutes
        gcTime: 5 * 60 * 1000,

        // CRITICAL: Enable for network monitoring dashboard
        // Users frequently switch between Cockpit and CLI/SSH
        // staleTime prevents excessive requests
        // WARNING: Disable for forms/editors to prevent data loss
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        
        // Use placeholderData to prevent UI flicker during background refetches
        placeholderData: (previousData) => previousData,

        // Custom retry logic
        retry: (failureCount, error) => {
          // CRITICAL: Never retry auth errors
          // Prevents infinite loops when token expires
          if (error instanceof Error) {
            if (error.message.includes('401') ||
                error.message.includes('403') ||
                error.message.includes('Session expired')) {
              return false
            }
          }
          // Retry other errors once
          return failureCount < 1
        },
      },

      mutations: {
        // Don't retry mutations by default (idempotency concerns)
        retry: false,
      },

      dehydrate: {
        // Include pending queries in SSR/hydration
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === 'pending',
      },
    },
  })
}

// Singleton pattern for client-side
let browserQueryClient: QueryClient | undefined = undefined

export function getQueryClient() {
  if (isServer) {
    // Server: always make a new query client (no data leaking between requests)
    return makeQueryClient()
  } else {
    // Browser: create singleton (important for React suspense)
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient
  }
}
```

**Why this pattern?**
- Server: New client per request prevents data leaking between users
- Client: Singleton prevents re-creating client on React suspense
- Auth error retry logic prevents infinite 401 loops
- Window focus refetching keeps network status fresh

---

### 2.2 Create Query Provider

**File:** `src/providers/query-provider.tsx`

```typescript
'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { getQueryClient, setToastFunction } from '@/lib/query-client'
import { useToast } from '@/hooks/use-toast'
import { useEffect } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Only load DevTools in development to avoid bloating production bundle */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />
      )}
    </QueryClientProvider>
  )
}
```

---

### 2.3 Update Root Layout

**File:** `src/app/layout.tsx`

```typescript
import { QueryProvider } from '@/providers/query-provider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          {/* Your existing providers/components */}
          {children}
        </QueryProvider>
      </body>
    </html>
  )
}
```

**Note:** `QueryProvider` must be a Client Component (`'use client'`) but can wrap Server Components.

---

## 3. Query Key Strategy

Centralized, type-safe query keys prevent typos and enable powerful cache invalidation.

**File:** `src/lib/query-keys.ts`

```typescript
// Query key factory pattern
// Hierarchical structure enables targeted cache invalidation

// Helper to clean undefined values from filter objects
// Prevents cache misses from { folder: '/prod' } vs { folder: '/prod', name: undefined }
function cleanFilters<T extends Record<string, any>>(filters?: T): T | undefined {
  if (!filters) return undefined
  const cleaned = Object.fromEntries(
    Object.entries(filters).filter(([_, v]) => v !== undefined && v !== null && v !== '')
  )
  return Object.keys(cleaned).length > 0 ? cleaned as T : undefined
}

export const queryKeys = {
  // CheckMK
  checkmk: {
    all: ['checkmk'] as const,
    hosts: (filters?: { folder?: string; name?: string }) => {
      const cleaned = cleanFilters(filters)
      return cleaned 
        ? [...queryKeys.checkmk.all, 'hosts', cleaned] as const
        : [...queryKeys.checkmk.all, 'hosts'] as const
    },
    host: (id: string) => [...queryKeys.checkmk.all, 'host', id] as const,
    syncStatus: () => [...queryKeys.checkmk.all, 'sync-status'] as const,
  },

  // Git Repositories
  git: {
    all: ['git'] as const,
    repositories: (filters?: { category?: string }) => {
      const cleaned = cleanFilters(filters)
      return cleaned
        ? [...queryKeys.git.all, 'repositories', cleaned] as const
        : [...queryKeys.git.all, 'repositories'] as const
    },
    repository: (id: number) => [...queryKeys.git.all, 'repository', id] as const,
    status: (id: number) => [...queryKeys.git.repository(id), 'status'] as const,
  },

  // Celery Jobs
  jobs: {
    all: ['jobs'] as const,
    list: (filters?: { status?: string; template?: string }) => {
      const cleaned = cleanFilters(filters)
      return cleaned
        ? [...queryKeys.jobs.all, 'list', cleaned] as const
        : [...queryKeys.jobs.all, 'list'] as const
    },
    detail: (id: string) => [...queryKeys.jobs.all, 'detail', id] as const,
    templates: () => [...queryKeys.jobs.all, 'templates'] as const,
    schedules: () => [...queryKeys.jobs.all, 'schedules'] as const,
  },

  // Nautobot
  nautobot: {
    all: ['nautobot'] as const,
    devices: (filters?: { location?: string; role?: string; status?: string }) => {
      const cleaned = cleanFilters(filters)
      return cleaned
        ? [...queryKeys.nautobot.all, 'devices', cleaned] as const
        : [...queryKeys.nautobot.all, 'devices'] as const
    },
    device: (id: string) => [...queryKeys.nautobot.all, 'device', id] as const,
    locations: () => [...queryKeys.nautobot.all, 'locations'] as const,
    roles: () => [...queryKeys.nautobot.all, 'roles'] as const,
    deviceTypes: () => [...queryKeys.nautobot.all, 'device-types'] as const,
    platforms: () => [...queryKeys.nautobot.all, 'platforms'] as const,
    statuses: () => [...queryKeys.nautobot.all, 'statuses'] as const,
  },

  // Inventory
  inventory: {
    all: ['inventory'] as const,
    list: () => [...queryKeys.inventory.all, 'list'] as const,
    detail: (id: number) => [...queryKeys.inventory.all, 'detail', id] as const,
  },

  // Compliance
  compliance: {
    all: ['compliance'] as const,
    rules: () => [...queryKeys.compliance.all, 'rules'] as const,
    checks: (deviceId?: string) =>
      [...queryKeys.compliance.all, 'checks', deviceId].filter(Boolean) as const,
  },

  // Settings
  settings: {
    all: ['settings'] as const,
    nautobot: () => [...queryKeys.settings.all, 'nautobot'] as const,
    checkmk: () => [...queryKeys.settings.all, 'checkmk'] as const,
    credentials: () => [...queryKeys.settings.all, 'credentials'] as const,
    git: () => [...queryKeys.settings.all, 'git'] as const,
    celery: () => [...queryKeys.settings.all, 'celery'] as const,
  },
}
```

**Usage examples:**
```typescript
// Invalidate all CheckMK queries
queryClient.invalidateQueries(queryKeys.checkmk.all)

// Invalidate only host list queries
queryClient.invalidateQueries(queryKeys.checkmk.hosts())

// Invalidate hosts with specific filters
queryClient.invalidateQueries(queryKeys.checkmk.hosts({ folder: '/prod' }))
```

---

## 4. Custom Hook Conventions

### 4.1 Naming Convention

- **Query Hooks**: `use[Resource]Query` → `useHostsQuery()`, `useJobQuery(id)`
- **Mutation Hooks**: `use[Action][Resource]Mutation` → `useCreateRepositoryMutation()`, `useBulkUpdateDevicesMutation()`

### 4.2 File Structure

```
src/hooks/
  ├── queries/
  │   ├── use-hosts-query.ts          # CheckMK hosts
  │   ├── use-job-query.ts            # Single job with polling
  │   ├── use-git-repositories-query.ts
  │   └── use-nautobot-devices-query.ts
  └── mutations/
      ├── use-create-repository-mutation.ts
      ├── use-update-device-mutation.ts
      └── use-bulk-update-devices-mutation.ts
```

### 4.3 Basic Query Hook Pattern

```typescript
// Example: src/hooks/queries/use-hosts-query.ts
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { CheckMKHost } from '@/types/checkmk/types'

interface UseHostsQueryOptions {
  filters?: {
    folder?: string
    name?: string
  }
  staleTime?: number
}

export function useHostsQuery(options: UseHostsQueryOptions = {}) {
  const { apiCall } = useApi()
  const { filters, staleTime } = options

  return useQuery({
    queryKey: queryKeys.checkmk.hosts(filters),
    queryFn: async () => {
      const response = await apiCall<{ hosts: CheckMKHost[] }>('checkmk/hosts', {
        method: 'GET',
        // Pass filters as query params if needed
      })
      return response.hosts || []
    },
    staleTime: staleTime ?? 60 * 1000, // Override default if needed
  })
}

// Usage in components:
// const { data: hosts, isLoading, error } = useHostsQuery({ filters: { folder: '/prod' } })

// PERFORMANCE TIP: Use 'select' to prevent re-renders when you only need subset of data
// BAD: Re-renders whenever ANY host property changes
// const { data: hosts } = useHostsQuery()
// const hostNames = hosts?.map(h => h.name)

// GOOD: Only re-renders when host names change
// const { data: hostNames } = useHostsQuery({
//   select: (hosts) => hosts.map(h => h.name)
// })
```

---

## 5. Job Polling Pattern

Replace manual `setInterval` polling with declarative `refetchInterval`.

**File:** `src/hooks/queries/use-job-query.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

// Terminal job states that should stop polling
const TERMINAL_JOB_STATES = ['SUCCESS', 'FAILURE', 'REVOKED'] as const
type JobStatus = 'PENDING' | 'STARTED' | 'SUCCESS' | 'FAILURE' | 'REVOKED'

interface JobData {
  status: JobStatus
  result?: unknown
  error?: string
}

interface UseJobQueryOptions {
  jobId: string | null
  pollInterval?: number
  enabled?: boolean
}

export function useJobQuery(options: UseJobQueryOptions) {
  const { apiCall } = useApi()
  const { jobId, pollInterval = 2000, enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.detail(jobId || ''),

    queryFn: async () => {
      if (!jobId) return null
      return apiCall<JobData>(`celery/tasks/${jobId}`)
    },

    // Only run if jobId exists and enabled
    enabled: !!jobId && enabled,

    // Polling logic: stops automatically when job completes
    // Includes exponential backoff for network errors
    refetchInterval: (query) => {
      const data = query.state.data
      const hasError = query.state.error

      // If network error, retry with exponential backoff (max 10s)
      if (hasError) {
        const backoff = Math.min(pollInterval * Math.pow(2, query.state.errorUpdateCount), 10000)
        console.warn(`Job polling failed, retrying in ${backoff}ms`)
        return backoff
      }

      // If no data yet, keep polling
      if (!data) return pollInterval

      // Stop polling if job reached terminal state
      if (TERMINAL_JOB_STATES.includes(data.status as typeof TERMINAL_JOB_STATES[number])) {
        return false
      }

      // Continue polling
      return pollInterval
    },
    
    // Keep retrying failed polls (job might still be running)
    retry: true,

    // Don't cache job status (always fetch fresh)
    staleTime: 0,
  })
}

// Usage in components:
// const { data: job, isLoading } = useJobQuery({ jobId: '123' })
// Polling starts automatically and stops when job completes!
```

**Benefits over manual polling:**
- ✅ Declarative (no useEffect cleanup)
- ✅ Auto-stops when component unmounts
- ✅ Auto-stops when job completes
- ✅ Integrates with DevTools
- ✅ No memory leaks

---

## 6. GraphQL Integration

Wrap existing GraphQL service in `useQuery` for caching and deduplication.

**File:** `src/hooks/queries/use-nautobot-devices-query.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { fetchDevicesGraphQL } from '@/services/nautobot-graphql'
import type { DeviceFilters } from '@/types/nautobot'

export function useNautobotDevicesQuery(filters?: DeviceFilters) {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.nautobot.devices(filters),

    queryFn: async () => {
      // Reuse existing GraphQL service
      const devices = await fetchDevicesGraphQL(apiCall, filters)
      return devices
    },

    // GraphQL responses can be cached more aggressively
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Metadata queries (very stable, cache aggressively)
export function useNautobotLocationsQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.nautobot.locations(),
    queryFn: () => fetchLocationsGraphQL(apiCall),
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  })
}
```

**Benefits:**
- ✅ Deduplicates GraphQL requests across components
- ✅ Caches responses intelligently
- ✅ Auto-refetches when stale

---

## 6.5. SSR/Hydration Pattern (Next.js 15 App Router)

For Server Components that need to prefetch data for client components.

**File:** `src/app/(dashboard)/devices/page.tsx`

```typescript
import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { getQueryClient } from '@/lib/query-client'
import { queryKeys } from '@/lib/query-keys'
import { DevicesList } from '@/components/features/devices/devices-list'

export default async function DevicesPage() {
  const queryClient = getQueryClient()

  // Prefetch on server (runs at build time or request time)
  await queryClient.prefetchQuery({
    queryKey: queryKeys.nautobot.devices(),
    queryFn: async () => {
      // Use server-side fetch (no auth token needed on server)
      const res = await fetch(`${process.env.API_URL}/nautobot/devices`, {
        headers: {
          'Authorization': `Bearer ${process.env.SERVER_API_TOKEN}`,
        },
        // Important: opt out of Next.js cache for fresh data
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Failed to fetch devices')
      return res.json()
    },
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DevicesList />
    </HydrationBoundary>
  )
}
```

**Client Component:** `src/components/features/devices/devices-list.tsx`

```typescript
'use client'

import { useNautobotDevicesQuery } from '@/hooks/queries/use-nautobot-devices-query'

export function DevicesList() {
  // This will use the prefetched data from server (no loading state!)
  const { data: devices, isLoading } = useNautobotDevicesQuery()

  // isLoading will be false on first render (data already available)
  if (isLoading) return <div>Loading...</div>

  return (
    <div>
      {devices?.map(device => (
        <div key={device.id}>{device.name}</div>
      ))}
    </div>
  )
}
```

**Benefits:**
- ✅ No loading spinners (data ready on first paint)
- ✅ Better SEO (content in initial HTML)
- ✅ Automatic client-side hydration
- ✅ Background refetching still works

**Important:** Server and client must use identical query keys!

---

## 7. Mutation Patterns

### 7.1 Basic Mutation (Simple Invalidation)

**File:** `src/hooks/mutations/use-create-repository-mutation.ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { queryKeys } from '@/lib/query-keys'

interface GitRepositoryData {
  name: string
  url: string
  branch?: string
}

export function useCreateRepositoryMutation() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: (newRepo: GitRepositoryData) =>
      apiCall('git-repositories', {
        method: 'POST',
        body: newRepo
      }),

    onSuccess: () => {
      // Invalidate cache to trigger refetch
      queryClient.invalidateQueries(queryKeys.git.repositories())

      toast({
        title: 'Success',
        description: 'Repository created successfully'
      })
    },

    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create repository',
        variant: 'destructive'
      })
    }
  })
}

// Usage in components:
// const { mutate: createRepo, isPending } = useCreateRepositoryMutation()
//
// const handleSubmit = (data) => {
//   createRepo(data)
// }
```

---

### 7.2 Advanced Mutation (Optimistic Updates)

**For bulk operations where instant UI feedback is critical.**

**File:** `src/hooks/mutations/use-bulk-update-devices-mutation.ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { queryKeys } from '@/lib/query-keys'
import type { Device } from '@/types/nautobot'

interface BulkUpdatePayload {
  deviceIds: string[]
  updates: Partial<Device>
}

interface BulkUpdateResult {
  success: string[]  // IDs that updated successfully
  failed: Array<{ id: string; error: string }>  // IDs that failed with reasons
}

export function useBulkUpdateDevicesMutation() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (payload: BulkUpdatePayload) => {
      const result = await apiCall<BulkUpdateResult>('nautobot/devices/bulk-update', {
        method: 'POST',
        body: payload
      })
      
      // Throw if there are failures (but include result in error for partial handling)
      if (result.failed && result.failed.length > 0) {
        const error = new Error(`Failed to update ${result.failed.length} devices`) as any
        error.partialResult = result
        throw error
      }
      
      return result
    },

    // OPTIMISTIC UPDATE: Update cache before API responds
    onMutate: async (payload) => {
      // Cancel ALL queries that could race (not just devices list)
      await queryClient.cancelQueries(queryKeys.nautobot.all)

      // Snapshot the previous value for rollback
      const previousDevices = queryClient.getQueryData(
        queryKeys.nautobot.devices()
      )

      // Optimistically update the cache
      queryClient.setQueryData(
        queryKeys.nautobot.devices(),
        (old: Device[] = []) => {
          return old.map(device => {
            if (payload.deviceIds.includes(device.id)) {
              return { ...device, ...payload.updates }
            }
            return device
          })
        }
      )

      // Return context with snapshot for rollback
      return { previousDevices, payload }
    },

    // ROLLBACK: Handle full or partial failures
    onError: (error: any, payload, context) => {
      // Check if partial failure (some succeeded, some failed)
      if (error.partialResult) {
        const { success, failed } = error.partialResult
        
        toast({
          title: 'Partial update',
          description: `Updated ${success.length} devices, ${failed.length} failed`,
          variant: 'destructive'
        })
        
        // Invalidate to get fresh server state (includes successful updates)
        queryClient.invalidateQueries(queryKeys.nautobot.devices())
      } else {
        // Complete failure - rollback all changes
        if (context?.previousDevices) {
          queryClient.setQueryData(
            queryKeys.nautobot.devices(),
            context.previousDevices
          )
        }

        toast({
          title: 'Bulk update failed',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive'
        })
      }
    },

    // SYNC: After complete success, refetch to ensure sync with server
    onSuccess: (result) => {
      queryClient.invalidateQueries(queryKeys.nautobot.devices())

      toast({
        title: 'Success',
        description: `Updated ${result.success.length} devices successfully`
      })
    },
  })
}

// Usage:
// const { mutate: bulkUpdate, isPending } = useBulkUpdateDevicesMutation()
//
// bulkUpdate({
//   deviceIds: ['1', '2', '3'],
//   updates: { status: 'active' }
// })
//
// UI updates INSTANTLY (optimistic)
// If API fails, changes roll back automatically
```

**When to use optimistic updates:**
- ✅ Bulk device edits (high impact on UX)
- ✅ CheckMK sync operations
- ✅ Inventory updates
- ❌ Simple creates/deletes (just invalidate)
- ❌ Operations with complex validation

---

## 8. Dependent Queries Pattern

For workflows where one query depends on another.

```typescript
// Example: Device details → Config history
export function useDeviceWithConfig(deviceId: string) {
  const { apiCall } = useApi()

  // First query: Get device
  const deviceQuery = useQuery({
    queryKey: queryKeys.nautobot.device(deviceId),
    queryFn: () => apiCall(`nautobot/devices/${deviceId}`)
  })

  // Second query: Get config (only if device exists)
  const configQuery = useQuery({
    queryKey: ['device', deviceId, 'config'],
    queryFn: () => apiCall(`devices/${deviceId}/config`),
    enabled: !!deviceQuery.data, // Wait for device to load
  })

  return {
    device: deviceQuery.data,
    config: configQuery.data,
    isLoading: deviceQuery.isLoading || (deviceQuery.data && configQuery.isLoading),
    error: deviceQuery.error || configQuery.error
  }
}
```

---

## 8.5. Parallel Queries Pattern

For fetching multiple resources in parallel (e.g., multiple devices by ID).

```typescript
import { useQueries } from '@tanstack/react-query'

function useMultipleDevices(deviceIds: string[]) {
  const { apiCall } = useApi()

  const queries = useQueries({
    queries: deviceIds.map(id => ({
      queryKey: queryKeys.nautobot.device(id),
      queryFn: () => apiCall(`nautobot/devices/${id}`),
      staleTime: 60 * 1000,
    }))
  })

  return {
    devices: queries.map(q => q.data).filter(Boolean),
    isLoading: queries.some(q => q.isLoading),
    isError: queries.some(q => q.isError),
    errors: queries.map(q => q.error).filter(Boolean),
  }
}

// Usage:
// const { devices, isLoading } = useMultipleDevices(['1', '2', '3'])
// Fetches all 3 devices in parallel!
```

**Benefits:**
- ✅ All requests fire simultaneously (not sequential)
- ✅ Each device independently cached
- ✅ Can refetch individual devices
- ✅ Better performance than sequential fetches

---

## 8.6. Error Boundary Integration

**File:** `src/components/error-boundary.tsx`

```typescript
'use client'

import { useQueryErrorResetBoundary } from '@tanstack/react-query'
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface ErrorFallbackProps {
  error: Error
  resetErrorBoundary: () => void
}

function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
      <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
      <p className="text-muted-foreground mb-4 text-center max-w-md">
        {error.message || 'An unexpected error occurred'}
      </p>
      <Button onClick={resetErrorBoundary}>Try again</Button>
    </div>
  )
}

export function QueryErrorBoundary({ children }: { children: React.ReactNode }) {
  const { reset } = useQueryErrorResetBoundary()

  return (
    <ReactErrorBoundary
      onReset={reset}
      fallbackRender={ErrorFallback}
    >
      {children}
    </ReactErrorBoundary>
  )
}
```

**Usage in layout:**

```typescript
import { QueryErrorBoundary } from '@/components/error-boundary'

export default function DashboardLayout({ children }) {
  return (
    <QueryErrorBoundary>
      {children}
    </QueryErrorBoundary>
  )
}
```

**Benefits:**
- ✅ Catches query errors that aren't handled by components
- ✅ Integrates with TanStack Query's reset mechanism
- ✅ Provides user-friendly error UI
- ✅ Allows retry without page reload

---

## 8.7. WebSocket/Real-time Integration

For real-time updates from server via WebSocket.

```typescript
// src/hooks/use-realtime-updates.ts
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

interface WebSocketMessage {
  type: 'device_updated' | 'device_deleted' | 'job_completed'
  deviceId?: string
  jobId?: string
}

export function useRealtimeUpdates() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const socket = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws')

    socket.onmessage = (event) => {
      const message: WebSocketMessage = JSON.parse(event.data)

      switch (message.type) {
        case 'device_updated':
          if (message.deviceId) {
            // Invalidate specific device and device list
            queryClient.invalidateQueries(queryKeys.nautobot.device(message.deviceId))
            queryClient.invalidateQueries(queryKeys.nautobot.devices())
          }
          break

        case 'device_deleted':
          if (message.deviceId) {
            // Remove from cache and invalidate list
            queryClient.removeQueries(queryKeys.nautobot.device(message.deviceId))
            queryClient.invalidateQueries(queryKeys.nautobot.devices())
          }
          break

        case 'job_completed':
          if (message.jobId) {
            // Invalidate job query to get final status
            queryClient.invalidateQueries(queryKeys.jobs.detail(message.jobId))
          }
          break
      }
    }

    socket.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    return () => {
      socket.close()
    }
  }, [queryClient])
}

// Usage in root layout or provider:
// useRealtimeUpdates()
```

**Benefits:**
- ✅ Real-time cache updates from server
- ✅ Reduces need for polling
- ✅ Better UX (instant updates across tabs)
- ✅ Efficient (only invalidates affected queries)

---

## 9. Complete Migration Inventory & Tracking

This section provides a comprehensive list of all files to migrate, their current status, priority, and estimated effort.

### 9.1. Migration Status Legend

- ✅ **Migrated** - Already using TanStack Query
- 🚧 **In Progress** - Migration started but incomplete
- 📋 **Planned** - Scheduled for migration in roadmap phases
- ⏳ **Backlog** - Not yet scheduled, migrate after core phases
- ❌ **Do Not Migrate** - Should remain useEffect (timers, DOM, subscriptions)

### 9.2. Hooks Inventory

#### Already Migrated ✅
| File | Query/Mutation | Status | Notes |
|------|---------------|--------|-------|
| `src/hooks/queries/use-git-repositories-query.ts` | Query | ✅ | Git repos with caching |
| `src/hooks/queries/use-git-mutations-optimistic.ts` | Mutation | ✅ | Git sync with optimistic updates |
| `src/hooks/queries/use-nautobot-rest-queries.ts` | Query | ✅ | Nautobot REST API |
| `src/hooks/queries/use-nautobot-graphql-queries.ts` | Query | ✅ | Nautobot GraphQL |
| `src/hooks/queries/use-job-query.ts` | Query | ✅ | Job status with polling |

#### Phase 2: Job Polling 📋
| File | Current Pattern | New Hook | Priority | Effort |
|------|----------------|----------|----------|--------|
| `src/hooks/jobs/use-job-status.ts` | useEffect + setInterval | `use-job-query.ts` (enhance) | P0 | 2h |
| Components consuming job polling | Manual state | Use `useJobQuery` | P0 | 4h |

**Target Components:**
- `src/components/features/nautobot/onboard/components/onboarding-progress-modal.tsx`
- `src/components/features/jobs/view/jobs-view-page.tsx`
- `src/components/features/nautobot/onboard/hooks/use-job-tracking.ts`

#### Phase 3: CheckMK Hosts 📋
| File | Current Pattern | New Hook | Priority | Effort |
|------|----------------|----------|----------|--------|
| `src/hooks/checkmk/use-hosts-data.ts` | useEffect + fetch | `use-checkmk-hosts-query.ts` | P0 | 3h |
| `src/hooks/checkmk/use-host-details.ts` | useEffect + fetch | `use-checkmk-host-query.ts` | P1 | 2h |
| `src/hooks/checkmk/use-sync-status.ts` | useEffect + fetch | `use-checkmk-sync-query.ts` | P1 | 2h |

**Target Components:**
- `src/app/(dashboard)/checkmk/hosts-inventory/page.tsx`
- `src/components/features/checkmk/live-update/live-update-page.tsx`
- `src/components/features/checkmk/hosts/hosts-table.tsx`

#### Phase 4: Git Management 📋
| File | Current Pattern | New Hook | Priority | Effort |
|------|----------------|----------|----------|--------|
| `src/hooks/git/use-git-repositories.ts` | useEffect + useState | Use existing `use-git-repositories-query.ts` | P0 | 2h |
| `src/hooks/git/use-git-commits.ts` | useEffect + fetch | `use-git-commits-query.ts` | P1 | 3h |
| `src/hooks/git/use-git-branches.ts` | useEffect + fetch | `use-git-branches-query.ts` | P1 | 2h |
| `src/hooks/git/use-file-search.ts` | useEffect + debounce | `use-git-file-search-query.ts` | P2 | 3h |
| `src/hooks/git/use-diff-navigation.ts` | Local state only | ❌ Keep as-is | N/A | N/A |

**Mutations to Create:**
- `use-create-repository-mutation.ts` (POST /git-repositories)
- `use-update-repository-mutation.ts` (PUT /git-repositories/:id)
- `use-delete-repository-mutation.ts` (DELETE /git-repositories/:id)
- `use-sync-repository-mutation.ts` (POST /git-repositories/:id/sync) - Already exists with optimistic updates ✅

**Target Components:**
- `src/components/features/settings/git/git-management.tsx`
- `src/components/features/git/git-browser.tsx`
- `src/components/features/git/commit-history.tsx`

#### Phase 5: Nautobot GraphQL 📋
| File | Current Pattern | New Hook | Priority | Effort |
|------|----------------|----------|----------|--------|
| `src/hooks/nautobot/use-devices.ts` | useEffect + GraphQL | Use existing `use-nautobot-graphql-queries.ts` | P0 | 3h |
| `src/hooks/nautobot/use-locations.ts` | useEffect + GraphQL | Enhance `use-nautobot-graphql-queries.ts` | P1 | 2h |
| `src/hooks/nautobot/use-device-types.ts` | useEffect + GraphQL | Enhance `use-nautobot-graphql-queries.ts` | P1 | 2h |
| `src/hooks/shared/device-selector/use-device-preview.ts` | useEffect + REST | `use-device-preview-query.ts` | P2 | 2h |

**Target Components:**
- `src/components/features/nautobot/tools/bulk-edit/tabs/device-selection-tab.tsx`
- `src/components/features/nautobot/export/tabs/device-selection-tab.tsx`
- `src/components/features/nautobot/onboard/hooks/use-onboarding-data.ts`
- `src/components/features/inventory/device-list.tsx`

#### Phase 6: Bulk Operations 📋
| File | Current Pattern | New Hook | Priority | Effort |
|------|----------------|----------|----------|--------|
| `src/hooks/nautobot/use-bulk-update.ts` | Manual mutation | `use-bulk-update-devices-mutation.ts` | P0 | 6h |
| `src/hooks/checkmk/use-sync-devices.ts` | Manual mutation | `use-sync-devices-mutation.ts` | P0 | 5h |

**Target Components:**
- `src/components/features/nautobot/tools/bulk-edit/bulk-edit-page.tsx`
- `src/components/features/checkmk/sync-devices/sync-devices-page.tsx`

#### Phase 7: Remaining Data Fetching ⏳
| File | Current Pattern | New Hook | Priority | Effort |
|------|----------------|----------|----------|--------|
| `src/hooks/compliance/use-compliance-rules.ts` | useEffect + fetch | `use-compliance-rules-query.ts` | P2 | 3h |
| `src/hooks/compliance/use-compliance-checks.ts` | useEffect + fetch | `use-compliance-checks-query.ts` | P2 | 3h |
| `src/hooks/inventory/use-inventory-list.ts` | useEffect + fetch | `use-inventory-query.ts` | P2 | 2h |
| `src/hooks/settings/use-settings.ts` | useEffect + fetch | `use-settings-query.ts` | P2 | 4h |
| `src/hooks/credentials/use-credentials.ts` | useEffect + fetch | `use-credentials-query.ts` | P2 | 3h |
| `src/hooks/templates/use-templates.ts` | useEffect + fetch | `use-templates-query.ts` | P2 | 3h |
| `src/hooks/profiles/use-profiles.ts` | useEffect + fetch | `use-profiles-query.ts` | P2 | 2h |

#### DO NOT MIGRATE ❌
| File | Pattern | Reason |
|------|---------|--------|
| `src/hooks/use-session-manager.ts` | useEffect + timers + listeners | Session/token refresh with intervals, DOM listeners - must remain imperative |
| `src/hooks/use-api.ts` | Central API wrapper | Core utility used BY query hooks - keep as-is |
| `src/hooks/use-mobile.ts` | useEffect + MediaQuery listener | DOM/window listener - keep as-is |
| `src/hooks/git/use-diff-navigation.ts` | useEffect + local state | Pure UI state management - keep as-is |
| `src/app/homepage.tsx` (useEffect) | Local mount effect | Likely analytics or init - verify first |

### 9.3. Component-Level Migration Checklist

Track migration progress per feature area:

#### Git Management
- [ ] Update `git-management.tsx` to use `useGitRepositoriesQuery`
- [ ] Update `git-browser.tsx` to use `useGitCommitsQuery`
- [ ] Update `commit-history.tsx` to use `useGitCommitsQuery`
- [ ] Create mutation hooks (create/update/delete repository)
- [ ] Test caching: navigate away and back = instant load
- [ ] Test mutations: create/update/delete auto-refreshes list

#### CheckMK Integration
- [ ] Update `hosts-inventory/page.tsx` to use `useCheckMKHostsQuery`
- [ ] Update `live-update-page.tsx` to use `useCheckMKHostsQuery`
- [ ] Update `hosts-table.tsx` to use `useCheckMKHostsQuery`
- [ ] Test filtering: filter changes = correct cache key
- [ ] Test background refetch on window focus

#### Nautobot Tools
- [ ] Update `bulk-edit/device-selection-tab.tsx` to use GraphQL queries
- [ ] Update `export/device-selection-tab.tsx` to use GraphQL queries
- [ ] Update `bulk-edit-page.tsx` to use `useBulkUpdateDevicesMutation`
- [ ] Test deduplication: multiple components = one GraphQL request
- [ ] Test optimistic updates: UI updates instantly, rolls back on error

#### Job Management
- [ ] Update `onboarding-progress-modal.tsx` to use `useJobQuery`
- [ ] Update `jobs-view-page.tsx` to use `useJobQuery`
- [ ] Update `use-job-tracking.ts` to use `useJobQuery`
- [ ] Test polling: starts automatically, stops when job completes
- [ ] Test network resilience: polling continues with backoff on errors

### 9.4. Estimated Total Migration Effort

| Phase | Duration | Files | Components |
|-------|----------|-------|------------|
| Phase 1: Foundation | 1 day | 3 new files | 1 layout update |
| Phase 2: Job Polling | 1 day | 1 hook + tests | 3 components |
| Phase 3: CheckMK | 1 day | 3 hooks + tests | 3 components |
| Phase 4: Git | 1 day | 4 hooks + 4 mutations | 3 components |
| Phase 5: Nautobot | 1 day | 4 hooks (enhance existing) | 4 components |
| Phase 6: Bulk Ops | 2 days | 2 mutations + tests | 2 components |
| Phase 7: Cleanup | 2 days | ~10 remaining hooks | Various |
| **Total** | **9 days** | **~30 hooks + tests** | **~20 components** |

### 9.5. Success Metrics

Track these metrics before and after migration:

**Performance:**
- [ ] API call count reduced (measure with DevTools Network tab)
- [ ] Cache hit rate >50% (measure with React Query DevTools)
- [ ] Average load time improved (measure with Lighthouse)

**Code Quality:**
- [ ] Lines of code reduced by ~30% (eliminate useState/useEffect boilerplate)
- [ ] No more race condition bugs from stale closures
- [ ] Consistent error handling across all data fetching

**Developer Experience:**
- [ ] All queries visible in DevTools
- [ ] Cache state inspectable
- [ ] Mutation status trackable

**User Experience:**
- [ ] Faster page transitions (cached data)
- [ ] Instant UI updates (optimistic mutations)
- [ ] Background refetching keeps data fresh

---

## 10. Testing Strategy

### 9.1 Update Test Utilities

**File:** `src/test-utils/render.tsx`

```typescript
import { ReactElement } from 'react'
import { render as rtlRender, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/lib/auth-store'

interface User {
  id: string
  username: string
  email?: string
  roles: string[]
  permissions?: number | Array<{ resource: string; action: string }>
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  authState?: {
    user?: User | null
    token?: string | null
    isAuthenticated?: boolean
  }
}

// Create test query client with retries disabled
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
    },
    mutations: {
      retry: false,
    },
  },
})

/**
 * Custom render function with QueryClient and auth state
 */
export function render(ui: ReactElement, options: CustomRenderOptions = {}) {
  const { authState, ...renderOptions } = options

  // Create fresh query client for each test
  const queryClient = createTestQueryClient()

  // Set auth state if provided
  if (authState) {
    useAuthStore.setState({
      user: authState.user ?? null,
      token: authState.token ?? null,
      isAuthenticated: authState.isAuthenticated ?? false,
    })
  } else {
    // Reset to unauthenticated
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
    })
  }

  // Wrap with QueryClientProvider
  return rtlRender(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>,
    renderOptions
  )
}

/**
 * Render with authenticated user
 */
export function renderWithAuth(
  ui: ReactElement,
  user?: Partial<User>,
  options?: Omit<CustomRenderOptions, 'authState'>
) {
  const defaultUser: User = {
    id: '1',
    username: 'testuser',
    email: 'test@example.com',
    roles: ['user'],
    permissions: 15,
    ...user,
  }

  return render(ui, {
    ...options,
    authState: {
      user: defaultUser,
      token: 'mock-token',
      isAuthenticated: true,
    },
  })
}

/**
 * Render with admin user
 */
export function renderWithAdmin(
  ui: ReactElement,
  options?: Omit<CustomRenderOptions, 'authState'>
) {
  return renderWithAuth(
    ui,
    {
      id: '1',
      username: 'admin',
      email: 'admin@example.com',
      roles: ['admin'],
      permissions: 65535,
    },
    options
  )
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
```

---

### 9.2 Example Tests

**File:** `src/hooks/queries/use-hosts-query.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useHostsQuery } from './use-hosts-query'

// Mock useApi
const mockApiCall = vi.fn()
vi.mock('@/hooks/use-api', () => ({
  useApi: () => ({ apiCall: mockApiCall })
}))

// Test wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('useHostsQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch hosts successfully', async () => {
    const mockHosts = [
      { host_name: 'server-01', folder: '/prod' },
      { host_name: 'server-02', folder: '/dev' }
    ]

    mockApiCall.mockResolvedValueOnce({ hosts: mockHosts })

    const { result } = renderHook(() => useHostsQuery(), {
      wrapper: createWrapper()
    })

    // Initially loading
    expect(result.current.isLoading).toBe(true)

    // Wait for data
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockHosts)
    expect(mockApiCall).toHaveBeenCalledTimes(1)
  })

  it('should handle errors', async () => {
    const error = new Error('API Error')
    mockApiCall.mockRejectedValueOnce(error)

    const { result } = renderHook(() => useHostsQuery(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toEqual(error)
  })
})
```

**Component test example:**

```typescript
import { render, screen, waitFor } from '@/test-utils'
import { HostsInventoryPage } from './hosts-inventory-page'

it('should display hosts after loading', async () => {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({
      hosts: [{ host_name: 'server-01', folder: '/prod' }]
    })
  })

  render(<HostsInventoryPage />)

  // Loading state
  expect(screen.getByText(/loading/i)).toBeInTheDocument()

  // Data appears
  await waitFor(() => {
    expect(screen.getByText('server-01')).toBeInTheDocument()
  })
})
```

**Mutation test example:**

```typescript
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCreateRepositoryMutation } from './use-create-repository-mutation'

const mockApiCall = vi.fn()
vi.mock('@/hooks/use-api', () => ({
  useApi: () => ({ apiCall: mockApiCall })
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

it('should create repository and invalidate cache', async () => {
  const queryClient = new QueryClient()
  const wrapper = createWrapper()
  
  // Pre-populate cache
  queryClient.setQueryData(['git', 'repositories'], [
    { id: 1, name: 'repo-1' }
  ])

  mockApiCall.mockResolvedValueOnce({ id: 2, name: 'repo-2' })

  const { result } = renderHook(() => useCreateRepositoryMutation(), { wrapper })

  // Trigger mutation
  await act(async () => {
    result.current.mutate({ name: 'repo-2', url: 'https://...' })
  })

  // Wait for mutation to complete
  await waitFor(() => {
    expect(result.current.isSuccess).toBe(true)
  })

  // Verify API called correctly
  expect(mockApiCall).toHaveBeenCalledWith('git-repositories', {
    method: 'POST',
    body: { name: 'repo-2', url: 'https://...' }
  })

  // Verify cache was invalidated
  const state = queryClient.getQueryState(['git', 'repositories'])
  expect(state?.isInvalidated).toBe(true)
})

it('should handle mutation errors', async () => {
  const error = new Error('API Error')
  mockApiCall.mockRejectedValueOnce(error)

  const { result } = renderHook(() => useCreateRepositoryMutation(), {
    wrapper: createWrapper()
  })

  await act(async () => {
    result.current.mutate({ name: 'repo-2', url: 'https://...' })
  })

  await waitFor(() => {
    expect(result.current.isError).toBe(true)
    expect(result.current.error).toEqual(error)
  })
})
```

---

## 10. Migration Roadmap

### Phase 1: Foundation & Setup
**Duration:** 1 day

**Tasks:**
1. Install dependencies: `npm install @tanstack/react-query @tanstack/react-query-devtools`
2. Create `src/lib/query-client.ts` with error handling
3. Create `src/lib/query-keys.ts` with initial keys
4. Create `src/providers/query-provider.tsx`
5. Update `src/app/layout.tsx` to wrap with `QueryProvider`
6. Update `src/test-utils/render.tsx` to include `QueryClientProvider`

**Success Criteria:**
- ✅ App builds without errors (`npm run build`)
- ✅ DevTools visible in browser (bottom-right corner)
- ✅ No console errors about missing QueryClient
- ✅ Tests still pass (`npm run test:run`)

**Verification:**
```bash
npm run build
npm run dev
# Open http://localhost:3000
# Check for DevTools in bottom-right
# Open DevTools, verify no errors
```

**Rollback Strategy:**
If Phase 1 causes issues:
1. Remove `QueryProvider` from layout.tsx
2. Revert changes: `git revert <commit-sha>`
3. QueryClient files are harmless if unused
4. Document blocker before re-attempting

---

### Phase 2: Proof of Concept (Job Polling)
**Duration:** 1 day

**Why start with jobs?**
- Highest impact (eliminates setInterval mess)
- Simplest query (no complex state)
- Proves polling works

**Tasks:**
1. Add job query keys to `query-keys.ts`
2. Create `src/hooks/queries/use-job-query.ts` with polling logic
3. Refactor job status components to use `useJobQuery`
4. Test polling starts and stops correctly

**Target Components:**
- `/components/features/nautobot/onboard/components/onboarding-progress-modal.tsx`
- `/components/features/jobs/view/jobs-view-page.tsx`

**Success Criteria:**
- ✅ Job status polls every 2 seconds
- ✅ Polling stops when job completes (SUCCESS/FAILURE)
- ✅ Polling stops when component unmounts
- ✅ DevTools shows refetchInterval in action
- ✅ No more manual `setInterval` in job components

**Verification:**
```bash
# Start a job (onboard device, backup, etc.)
# Open progress modal
# Check DevTools "Queries" tab
# Verify query refetches every 2s
# Verify polling stops when job completes
```

**Rollback Strategy:**
If Phase 2 causes issues:
1. Revert `use-job-query.ts`: `git checkout HEAD~1 src/hooks/queries/use-job-query.ts`
2. Restore original job components with `setInterval` polling
3. Keep QueryProvider and setup (Phase 1) - it's still useful
4. Test other features to ensure no side effects
5. Document issue before re-attempting

---

### Phase 3: Core Data (CheckMK Hosts)
**Duration:** 1 day

**Why hosts next?**
- High-frequency data fetching
- Demonstrates caching benefits
- Has filters (tests parameterized keys)

**Tasks:**
1. Add CheckMK query keys
2. Create `src/hooks/queries/use-hosts-query.ts`
3. Refactor `src/hooks/checkmk/use-hosts-data.ts` to use TanStack Query
4. Update hosts inventory page
5. Test caching (navigate away and back = instant load)

**Target Components:**
- `/app/(dashboard)/checkmk/hosts-inventory/page.tsx`
- `/components/features/checkmk/live-update/live-update-page.tsx`

**Success Criteria:**
- ✅ Hosts load on page visit
- ✅ Navigate away and back = instant load (cache hit)
- ✅ Filters work (query key includes filter params)
- ✅ DevTools shows cached queries
- ✅ Background refetch on window focus works

**Verification:**
```bash
# Visit /checkmk/hosts-inventory
# Wait for hosts to load
# Navigate to /settings
# Navigate back to /checkmk/hosts-inventory
# Should load instantly (cache hit)
# Change browser tab, come back
# Should refetch in background
```

**Rollback Strategy:**
If Phase 3 causes issues:
1. Revert: `git revert <phase-3-commit>`
2. Restore original `use-hosts-data.ts` hook
3. Update imports in affected components
4. Keep Phase 1 & 2 (job polling) - they're independent
5. Check if issue is specific to CheckMK API or general pattern

---

### Phase 4: Mutations (Git Management)
**Duration:** 1 day

**Why Git Management?**
- Simple CRUD operations
- Demonstrates cache invalidation
- Good stepping stone before complex mutations

**Tasks:**
1. Add Git query keys
2. Create `src/hooks/queries/use-git-repositories-query.ts`
3. Create `src/hooks/mutations/use-create-repository-mutation.ts`
4. Create update/delete mutations
5. Refactor Git Management component
6. Test automatic list refresh after create/update/delete

**Target Components:**
- `/components/features/settings/git/git-management.tsx`

**Success Criteria:**
- ✅ Repository list loads
- ✅ Create repository → list updates automatically (no manual refetch)
- ✅ Edit repository → list updates automatically
- ✅ Delete repository → list updates automatically
- ✅ Toast notifications show on success/error
- ✅ DevTools shows invalidation triggering refetch

**Verification:**
```bash
# Visit /settings/git
# Add new repository
# Verify list updates without page refresh
# Edit repository
# Verify list updates
# Delete repository
# Verify removed from list
```

**Rollback Strategy:**
If Phase 4 causes issues:
1. Revert mutations: `git checkout HEAD~1 src/hooks/mutations/`
2. Restore original Git Management component state management
3. Keep query hooks (they're safe read-only)
4. Test that reads still work
5. Analyze if issue is with optimistic updates or cache invalidation

---

### Phase 5: GraphQL Integration (Nautobot)
**Duration:** 1 day

**Tasks:**
1. Add Nautobot query keys
2. Create `src/hooks/queries/use-nautobot-devices-query.ts`
3. Wrap existing GraphQL service (`nautobot-graphql.ts`)
4. Update device selection components
5. Verify request deduplication (multiple components = one request)

**Target Components:**
- `/components/features/nautobot/tools/bulk-edit/tabs/device-selection-tab.tsx`
- `/components/features/nautobot/export/tabs/device-selection-tab.tsx`

**Success Criteria:**
- ✅ GraphQL queries cached
- ✅ Multiple components requesting same data = ONE GraphQL request
- ✅ Network tab shows fewer duplicate requests
- ✅ Metadata (locations, roles) cached for 15 minutes

**Verification:**
```bash
# Open DevTools Network tab
# Visit /nautobot/tools/bulk-edit
# Count GraphQL requests
# Navigate to /nautobot/export
# Should reuse cached data (no new request if within staleTime)
```

**Rollback Strategy:**
If Phase 5 causes issues:
1. Revert: `git revert <phase-5-commit>`
2. Restore original GraphQL service calls in components
3. Keep previous phases (job polling, CheckMK, Git)
4. Check if issue is GraphQL-specific or cache deduplication
5. Consider incrementally migrating one Nautobot query at a time

---

### Phase 6: Complex Mutations (Bulk Operations)
**Duration:** 2 days

**Tasks:**
1. Create `src/hooks/mutations/use-bulk-update-devices-mutation.ts` with optimistic updates
2. Refactor bulk edit page
3. Test optimistic updates and rollback
4. Add similar patterns for CheckMK sync

**Target Components:**
- `/components/features/nautobot/tools/bulk-edit/bulk-edit-page.tsx`
- `/components/features/checkmk/sync-devices/sync-devices-page.tsx`

**Success Criteria:**
- ✅ UI updates instantly on bulk edit (optimistic)
- ✅ Changes roll back if API fails
- ✅ Final state syncs with server
- ✅ User sees immediate feedback (feels fast)

**Verification:**
```bash
# Visit /nautobot/tools/bulk-edit
# Select multiple devices
# Make changes
# Click save
# UI should update INSTANTLY (before API responds)
# Simulate API error (disconnect network)
# Verify changes roll back with error toast
```

**Rollback Strategy:**
If Phase 6 causes issues:
1. Immediately disable optimistic updates in `useBulkUpdateDevicesMutation`
2. Switch to simple invalidation pattern (like Phase 4)
3. Test if basic mutation works without optimistic updates
4. If still broken, revert entire bulk edit page
5. Optimistic updates are advanced - can be added later
6. Keep simpler mutations from Phase 4

---

### Phase 7: Cleanup & Optimization
**Duration:** 1-2 days

**Tasks:**
1. Audit codebase for remaining `useEffect` data fetching
2. Migrate remaining components
3. Remove unused `useState` for loading/error/data
4. Fine-tune `staleTime` per data type
5. Add query key coverage for all features
6. Document patterns in team wiki

**Success Criteria:**
- ✅ No more manual `setInterval` polling
- ✅ No more `useState` for server state (loading/error/data)
- ✅ All API calls use TanStack Query
- ✅ Consistent error handling across app
- ✅ DevTools shows all queries

---

## 11. Configuration Tuning

### ⚠️ CRITICAL: refetchOnWindowFocus and Forms

**Problem:** Global `refetchOnWindowFocus: true` can cause data loss in forms and editors.

**Scenario:**
1. User opens edit form, makes changes
2. User switches browser tab to check something
3. User returns to form
4. Query refetches in background
5. Component re-renders with fresh data
6. Form resets, user loses unsaved changes 😱

**Solution 1: Disable per-query**
```typescript
const { data } = useDeviceQuery(id, {
  refetchOnWindowFocus: false,  // Disable for edit forms
  refetchOnMount: false,        // Don't refetch on navigation back
})
```

**Solution 2: Use placeholderData**
```typescript
const { data } = useDeviceQuery(id, {
  placeholderData: (previousData) => previousData,  // Keep previous data during refetch
})
```

**Solution 3: Track dirty state**
```typescript
const [isDirty, setIsDirty] = useState(false)

const { data } = useDeviceQuery(id, {
  refetchOnWindowFocus: !isDirty,  // Only refetch if form is clean
})
```

**Affected components:**
- Device edit forms
- Template editors (Monaco)
- Bulk edit wizard
- Configuration editors
- Any form with unsaved changes

---

### Different staleTime for Different Data Types

```typescript
// Static metadata (locations, roles, device types)
staleTime: 15 * 60 * 1000, // 15 minutes
gcTime: 30 * 60 * 1000,    // 30 minutes

// Device inventory (moderate freshness)
staleTime: 60 * 1000,      // 1 minute
gcTime: 5 * 60 * 1000,     // 5 minutes

// Job status (always fresh)
staleTime: 0,              // Always refetch
gcTime: 1 * 60 * 1000,     // 1 minute

// GraphQL responses (can cache longer)
staleTime: 5 * 60 * 1000,  // 5 minutes
gcTime: 10 * 60 * 1000,    // 10 minutes
```

### Why refetchOnWindowFocus: true is Important

For a **network monitoring dashboard**:
- ✅ Users frequently switch between Cockpit and CLI/SSH
- ✅ Device status should stay current
- ✅ `staleTime` prevents excessive refetching (won't refetch if data is still fresh)
- ✅ Better UX than requiring manual refresh

**To disable for specific queries:**
```typescript
useQuery({
  queryKey: ['static-data'],
  queryFn: fetchStaticData,
  refetchOnWindowFocus: false, // Override for truly static data
})
```

---

### Performance: Using `select` to Prevent Re-renders

**Problem:** Component re-renders whenever ANY property in query data changes, even if component only uses subset.

**Example:**
```typescript
// BAD: Re-renders whenever ANY device property changes (status, location, etc.)
function DeviceNameList() {
  const { data: devices } = useDevicesQuery()
  const names = devices?.map(d => d.name)  // Computed on every render
  return <ul>{names?.map(n => <li key={n}>{n}</li>)}</ul>
}
```

**Better: Use `select` to transform data**
```typescript
// GOOD: Only re-renders when device NAMES change
function DeviceNameList() {
  const { data: names } = useDevicesQuery({
    select: (devices) => devices.map(d => d.name)  // Memoized by TanStack Query
  })
  return <ul>{names?.map(n => <li key={n}>{n}</li>)}</ul>
}
```

**Benefits:**
- ✅ Fewer re-renders (only when selected data changes)
- ✅ Automatic memoization (TanStack Query handles it)
- ✅ Can transform/filter data efficiently

**More examples:**
```typescript
// Select single field
const { data: deviceCount } = useDevicesQuery({
  select: (devices) => devices.length
})

// Select filtered subset
const { data: activeDevices } = useDevicesQuery({
  select: (devices) => devices.filter(d => d.status === 'active')
})

// Select transformed shape
const { data: deviceOptions } = useDevicesQuery({
  select: (devices) => devices.map(d => ({ value: d.id, label: d.name }))
})
```

---

## 12. Common Patterns Cheat Sheet

### Basic Query
```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['resource'],
  queryFn: fetchResource,
})
```

### Query with Parameters
```typescript
const { data } = useQuery({
  queryKey: ['resource', filters],
  queryFn: () => fetchResource(filters),
})
```

### Disabled Query (Conditional)
```typescript
const { data } = useQuery({
  queryKey: ['resource', id],
  queryFn: () => fetchResource(id),
  enabled: !!id, // Only run if id exists
})
```

### Polling Query
```typescript
const { data } = useQuery({
  queryKey: ['job', jobId],
  queryFn: () => fetchJob(jobId),
  refetchInterval: (query) => {
    return query.state.data?.status === 'running' ? 2000 : false
  }
})
```

### Basic Mutation
```typescript
const { mutate, isPending } = useMutation({
  mutationFn: createResource,
  onSuccess: () => {
    queryClient.invalidateQueries(['resources'])
  }
})
```

### Optimistic Mutation
```typescript
const { mutate } = useMutation({
  mutationFn: updateResource,
  onMutate: async (newData) => {
    await queryClient.cancelQueries(['resources'])
    const previous = queryClient.getQueryData(['resources'])
    queryClient.setQueryData(['resources'], newData)
    return { previous }
  },
  onError: (err, newData, context) => {
    queryClient.setQueryData(['resources'], context.previous)
  },
  onSuccess: () => {
    queryClient.invalidateQueries(['resources'])
  }
})
```

### Prefetching
```typescript
const queryClient = useQueryClient()

queryClient.prefetchQuery({
  queryKey: ['resource', id],
  queryFn: () => fetchResource(id),
})
```

---

## 13. Troubleshooting

### Query not refetching?
- Check `staleTime` (data might still be fresh)
- Check `enabled` flag (might be disabled)
- Check DevTools to see query state

### Infinite refetch loop?
- Check if `queryKey` contains unstable references (objects, arrays)
- Use `useMemo` or constants for query key dependencies
- Check if mutation is invalidating too broadly

### Cache not updating after mutation?
- Ensure `invalidateQueries` uses correct query key
- Check if query key structure matches
- Use DevTools to verify invalidation

### Tests failing?
- Ensure test wrapper includes `QueryClientProvider`
- Disable retries in test query client
- Use `waitFor` for async updates

### Auth errors retrying infinitely?
- Check retry logic in `makeQueryClient`
- Ensure 401/403 errors return `false` for retry

---

## 14. Resources

**Official Docs:**
- [TanStack Query Docs](https://tanstack.com/query/latest)
- [React Query Essentials](https://tanstack.com/query/latest/docs/react/guides/important-defaults)
- [Next.js App Router Integration](https://tanstack.com/query/latest/docs/react/guides/advanced-ssr)

**DevTools:**
- Press `Ctrl+Shift+R` to toggle DevTools (configurable)
- View queries, mutations, cache state
- Trigger manual refetch, invalidation
- Inspect query timelines

**Community:**
- [TanStack Discord](https://discord.gg/tanstack)
- [GitHub Discussions](https://github.com/TanStack/query/discussions)

---

## 15. Conclusion

This migration will:
- ✅ Eliminate race conditions from `useEffect` data fetching
- ✅ Remove ~80% of manual loading/error state management
- ✅ Enable intelligent caching (faster UX, fewer API calls)
- ✅ Standardize data fetching patterns across the codebase
- ✅ Make job polling declarative and automatic
- ✅ Provide visibility into app state via DevTools

**Estimated total effort:** 7-10 days for full migration

**Quick wins (Phase 1-2):** 2 days for foundation + job polling

**Team should:** Review this plan, ask questions, then proceed phase by phase with code reviews between phases.
