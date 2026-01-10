# Refactoring Plan: Manual Data Fetching & State Management

## Goal
Replace manual data fetching logic (custom `useApi` hook + `useEffect` + local `useState`) with **TanStack Query (React Query)** to eliminate race conditions, remove boilerplate, and standardize state management.

## 1. Next.js 15 App Router Integration

To ensure data isn't shared between requests on the server while maintaining a singleton on the client, we will implement the **`makeQueryClient` pattern**.

### `src/lib/query-client.ts`
```typescript
import {
  isServer,
  QueryClient,
  defaultShouldDehydrateQuery,
} from '@tanstack/react-query'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === 'pending',
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined = undefined

export function getQueryClient() {
  if (isServer) {
    // Server: always make a new query client
    return makeQueryClient()
  } else {
    // Browser: make a new query client if we don't have one
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient
  }
}
```

### `src/providers/query-provider.tsx`
```tsx
'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { getQueryClient } from '@/lib/query-client'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

## 2. Query Key Strategy
We will use a **Query Key Factory** pattern to ensure type safety and consistency across the application.

### `src/lib/query-keys.ts`
```typescript
export const queryKeys = {
  checkmk: {
    all: ['checkmk'] as const,
    hosts: () => [...queryKeys.checkmk.all, 'hosts'] as const,
    host: (id: string) => [...queryKeys.checkmk.hosts(), id] as const,
  },
  git: {
    all: ['git'] as const,
    repositories: () => [...queryKeys.git.all, 'repositories'] as const,
    repository: (id: number) => [...queryKeys.git.repositories(), id] as const,
    status: (id: number) => [...queryKeys.git.repository(id), 'status'] as const,
  },
  jobs: {
    all: ['jobs'] as const,
    detail: (id: string) => [...queryKeys.jobs.all, id] as const,
  },
  nautobot: {
    all: ['nautobot'] as const,
    devices: () => [...queryKeys.nautobot.all, 'devices'] as const,
    locations: () => [...queryKeys.nautobot.all, 'locations'] as const,
    deviceTypes: () => [...queryKeys.nautobot.all, 'deviceTypes'] as const,
  }
}
```

## 3. Custom Hook Conventions

- **Naming**: `use[Resource]Query`, `use[Resource]Mutation`.
- **Location**: `src/hooks/[domain]/use-[resource].ts` (e.g., `src/hooks/checkmk/use-hosts.ts`).
- **Return Value**: Return the query result directly or a simplified object if transformation is needed.

**Example**:
```typescript
export function useGitRepositoriesQuery() {
  const { apiCall } = useApi()
  return useQuery({
    queryKey: queryKeys.git.repositories(),
    queryFn: () => apiCall<{ repositories: GitRepository[] }>('git-repositories')
      .then(res => res.repositories)
  })
}
```

## 4. GraphQL Integration

We will wrap existing GraphQL helpers from `nautobot-graphql.ts` in `useQuery`.

```typescript
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { executeNautobotQuery, DEVICES_DETAILED } from '@/services/nautobot-graphql'
import { queryKeys } from '@/lib/query-keys'

export function useNautobotDevicesQuery() {
  const { apiCall } = useApi()
  
  return useQuery({
    queryKey: queryKeys.nautobot.devices(),
    queryFn: async () => {
      const response = await executeNautobotQuery(apiCall, DEVICES_DETAILED)
      return response.data.devices
    }
  })
}
```

## 5. Job Polling Pattern
We will replace manual `setInterval` polling with `useQuery`'s built-in `refetchInterval`.

### `src/hooks/use-job-polling.ts`
```typescript
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

export function useJobPolling(jobId: string | null, options = { interval: 2000 }) {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.jobs.detail(jobId || ''),
    queryFn: async () => {
      if (!jobId) return null
      return apiCall<JobStatus>(`celery/tasks/${jobId}`)
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return options.interval
      // Stop polling if complete
      if (['SUCCESS', 'FAILURE', 'REVOKED'].includes(data.status)) {
        return false
      }
      return options.interval
    }
  })
}
```

## 6. Mutation Patterns & Optimistic Updates

We will use `useMutation` for data modifying operations.

**Example: Adding a Repository**
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner' // Assuming sonner is used, or alert/etc.

export function useAddRepositoryMutation() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (newRepo: GitFormData) => 
      apiCall('git-repositories', { method: 'POST', body: JSON.stringify(newRepo) }),
      
    // Optimistic Update (Optional, simpler to just invalidate for now)
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.git.repositories() })
      toast.success('Repository added successfully')
    },
    onError: (error) => {
       toast.error(`Failed to add repository: ${(error as Error).message}`)
    }
  })
}
```

## 7. Error Handling Strategy

1.  **Global Level (QueryClient)**:
    Global error callback for unhandled errors (optional).

2.  **Auth Errors (401/403)**:
    The existing `useApi` hook already handles 401 redirects. TanStack Query will simply receive the rejected promise. We should ensure `useApi` throws errors that carry meaningful messages.

3.  **UI Feedback**:
    Use `onError` callbacks in mutations for toasts.
    Use `isError` and `error` properties in queries for inline error messages.

## 8. Testing Strategy

We will update `src/test-utils/render.tsx` (or similar) to wrap tests in a `QueryClientProvider`.

### `src/test-utils/wrapper.tsx`
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as rtlRender } from '@testing-library/react'
import { ReactNode } from 'react'

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false, // Turn off retries for testing
      gcTime: 0, // Garbage collect instantly
    },
  },
})

export function renderWithClient(ui: ReactNode) {
  const testClient = createTestQueryClient()
  const { rerender, ...result } = rtlRender(
    <QueryClientProvider client={testClient}>{ui}</QueryClientProvider>
  )
  return {
    ...result,
    rerender: (rerenderUi: ReactNode) =>
      rerender(
        <QueryClientProvider client={testClient}>{rerenderUi}</QueryClientProvider>
      )
  }
}
```

## 9. Migration Roadmap

### Phase 1: Foundation (Day 1)
- Install dependencies.
- Create `src/lib/query-client.ts`, `src/lib/query-keys.ts`, `src/providers/query-provider.tsx`.
- Update `src/app/layout.tsx`.
- Update `src/test-utils`.

### Phase 2: Core Data (Day 2)
- Refactor `useHostsData` (CheckMK).
- Refactor `useJobPolling`.
- Verify with manual tests.

### Phase 3: Complex Features (Day 3)
- Refactor `GitManagement` (Mutations, Optimistic usage).
- Refactor `Nautobot` GraphQL queries.

### Phase 4: Cleanup (Day 4)
- Audit codebase for remaining `useEffect` data fetching.
- standardizing remaining `useApi` calls.
