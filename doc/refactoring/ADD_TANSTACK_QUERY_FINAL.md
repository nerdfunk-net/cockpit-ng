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

// Toast integration (using existing Shadcn toast)
let toastFunction: ((options: { title: string; description: string; variant?: 'default' | 'destructive' }) => void) | null = null

export function setToastFunction(toast: typeof toastFunction) {
  toastFunction = toast
}

function makeQueryClient() {
  return new QueryClient({
    // Global query error handling
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Skip auth errors (useApi handles logout/redirect)
        if (error instanceof Error &&
            (error.message.includes('Session expired') ||
             error.message.includes('401'))) {
          return
        }

        // Show toast for unexpected errors
        if (toastFunction) {
          toastFunction({
            title: 'Error loading data',
            description: error instanceof Error ? error.message : 'Unknown error',
            variant: 'destructive'
          })
        }
      }
    }),

    // Global mutation error handling
    mutationCache: new MutationCache({
      onError: (error) => {
        // Skip auth errors
        if (error instanceof Error &&
            (error.message.includes('Session expired') ||
             error.message.includes('401'))) {
          return
        }

        // Show toast (can be overridden by onError in specific mutations)
        if (toastFunction) {
          toastFunction({
            title: 'Operation failed',
            description: error instanceof Error ? error.message : 'Unknown error',
            variant: 'destructive'
          })
        }
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
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,

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
  const { toast } = useToast()

  // Inject toast function into query client
  useEffect(() => {
    setToastFunction(toast)
  }, [toast])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />
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

export const queryKeys = {
  // CheckMK
  checkmk: {
    all: ['checkmk'] as const,
    hosts: (filters?: { folder?: string; name?: string }) =>
      [...queryKeys.checkmk.all, 'hosts', filters].filter(Boolean) as const,
    host: (id: string) => [...queryKeys.checkmk.all, 'host', id] as const,
    syncStatus: () => [...queryKeys.checkmk.all, 'sync-status'] as const,
  },

  // Git Repositories
  git: {
    all: ['git'] as const,
    repositories: () => [...queryKeys.git.all, 'repositories'] as const,
    repository: (id: number) => [...queryKeys.git.all, 'repository', id] as const,
    status: (id: number) => [...queryKeys.git.repository(id), 'status'] as const,
  },

  // Celery Jobs
  jobs: {
    all: ['jobs'] as const,
    list: (filters?: { status?: string }) =>
      [...queryKeys.jobs.all, 'list', filters].filter(Boolean) as const,
    detail: (id: string) => [...queryKeys.jobs.all, 'detail', id] as const,
    templates: () => [...queryKeys.jobs.all, 'templates'] as const,
    schedules: () => [...queryKeys.jobs.all, 'schedules'] as const,
  },

  // Nautobot
  nautobot: {
    all: ['nautobot'] as const,
    devices: (filters?: { location?: string; role?: string }) =>
      [...queryKeys.nautobot.all, 'devices', filters].filter(Boolean) as const,
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
    refetchInterval: (query) => {
      const data = query.state.data

      // If no data yet, keep polling
      if (!data) return pollInterval

      // Stop polling if job reached terminal state
      if (TERMINAL_JOB_STATES.includes(data.status as typeof TERMINAL_JOB_STATES[number])) {
        return false
      }

      // Continue polling
      return pollInterval
    },

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

export function useBulkUpdateDevicesMutation() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: (payload: BulkUpdatePayload) =>
      apiCall('nautobot/devices/bulk-update', {
        method: 'POST',
        body: payload
      }),

    // OPTIMISTIC UPDATE: Update cache before API responds
    onMutate: async (payload) => {
      // Cancel any outgoing refetches (so they don't overwrite optimistic update)
      await queryClient.cancelQueries(queryKeys.nautobot.devices())

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
      return { previousDevices }
    },

    // ROLLBACK: If mutation fails, restore previous state
    onError: (error, payload, context) => {
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
    },

    // SYNC: After success, refetch to ensure sync with server
    onSuccess: () => {
      queryClient.invalidateQueries(queryKeys.nautobot.devices())

      toast({
        title: 'Success',
        description: 'Devices updated successfully'
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

## 9. Testing Strategy

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
