# TanStack Query Best Practices

## Overview

This guide documents the patterns and best practices for using TanStack Query in this codebase. Follow these guidelines to ensure consistency, performance, and maintainability.

## Table of Contents

1. [Query Key Management](#query-key-management)
2. [Hook Organization](#hook-organization)
3. [Caching Strategy](#caching-strategy)
4. [Error Handling](#error-handling)
5. [Loading States](#loading-states)
6. [Mutations](#mutations)
7. [Optimistic Updates](#optimistic-updates)
8. [Testing](#testing)
9. [Common Patterns](#common-patterns)
10. [Anti-Patterns](#anti-patterns)

---

## Query Key Management

### ✅ DO: Use the Centralized Query Key Factory

**Always** use `queryKeys` from `@/lib/query-keys.ts`:

```typescript
import { queryKeys } from '@/lib/query-keys'

// ✅ GOOD
useQuery({
  queryKey: queryKeys.git.repositories(),
  queryFn: () => fetchRepos()
})

// ❌ BAD
useQuery({
  queryKey: ['git-repositories'],  // Don't use inline keys
  queryFn: () => fetchRepos()
})
```

### ✅ DO: Add New Keys to the Factory

When adding new queries, update `query-keys.ts`:

```typescript
// @/lib/query-keys.ts
export const queryKeys = {
  myFeature: {
    all: ['myFeature'] as const,
    list: () => [...queryKeys.myFeature.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.myFeature.all, 'detail', id] as const,
  },
}
```

### ✅ DO: Use Hierarchical Keys

Structure keys from **general to specific**:

```typescript
// Hierarchy: feature → action → filters
queryKeys.checkmk.hosts()           // All hosts
queryKeys.checkmk.hosts({ folder: 'network' })  // Filtered hosts
queryKeys.checkmk.host('123')       // Specific host
```

This enables **targeted cache invalidation**:

```typescript
// Invalidate ALL CheckMK data
queryClient.invalidateQueries({ queryKey: queryKeys.checkmk.all })

// Invalidate only hosts
queryClient.invalidateQueries({ queryKey: queryKeys.checkmk.hosts() })

// Invalidate specific host
queryClient.invalidateQueries({ queryKey: queryKeys.checkmk.host('123') })
```

---

## Hook Organization

### ✅ DO: One Hook Per Query Type

Create dedicated hooks in `/src/hooks/queries/`:

```typescript
// ✅ GOOD: use-checkmk-hosts-query.ts
export function useCheckmkHostsQuery(options = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  return useQuery({
    queryKey: queryKeys.checkmk.hosts(options.filters),
    queryFn: () => fetchHosts(apiCall),
    ...
  })
}

// ❌ BAD: Generic hook with switch statement
export function useCheckmkQuery(type: string) {
  // Don't do this!
}
```

### ✅ DO: Group Related Mutations

Group CRUD operations in one file:

```typescript
// use-git-mutations.ts
export function useGitMutations() {
  return {
    createRepository,    // ✅ Related mutations together
    updateRepository,
    deleteRepository,
    syncRepository,
  }
}
```

### ✅ DO: Use Consistent Naming

```typescript
// Queries (data fetching)
use[Feature][Resource]Query        // useNautobotDevicesQuery
use[Feature][Resource]RestQuery    // useNautobotLocationsRestQuery

// Mutations (data modification)
use[Feature]Mutations              // useGitMutations
use[Feature]MutationsOptimistic    // useGitMutationsOptimistic
```

---

## Caching Strategy

### ✅ DO: Match staleTime to Data Volatility

```typescript
// Static data (rarely changes)
staleTime: 5 * 60 * 1000,  // 5 minutes
gcTime: 30 * 60 * 1000,    // 30 minutes
// Examples: device types, locations, platforms

// Semi-static data
staleTime: 60 * 1000,      // 1 minute
gcTime: 10 * 60 * 1000,    // 10 minutes
// Examples: repositories, devices, hosts

// Dynamic data
staleTime: 0,              // Always stale
// Examples: job status (use polling)
```

### ✅ DO: Use Global Defaults

Set defaults in `query-client.ts`:

```typescript
// Global defaults apply to ALL queries
defaultOptions: {
  queries: {
    staleTime: 30 * 1000,     // 30s default
    gcTime: 5 * 60 * 1000,    // 5min default
    refetchOnWindowFocus: true,  // ✅ Critical for network monitoring
    refetchOnReconnect: true,
  }
}
```

Override in specific hooks:

```typescript
// Override for job polling
useQuery({
  ...
  staleTime: 0,  // Always fetch fresh
  refetchInterval: 2000,  // Poll every 2s
})
```

### ✅ DO: Enable Window Focus Refetch

```typescript
// ✅ GOOD: Keeps data fresh when user returns to tab
refetchOnWindowFocus: true

// ❌ BAD: Data becomes stale when user switches tabs
refetchOnWindowFocus: false
```

**Why?** Users frequently switch between Cockpit and CLI/SSH. Auto-refetch ensures they see current data.

---

## Error Handling

### ✅ DO: Use Global Error Handler

Configure in `query-client.ts`:

```typescript
queryCache: new QueryCache({
  onError: (error) => {
    // Skip auth errors (useApi handles logout)
    if (error.message.includes('401') || error.message.includes('Session expired')) {
      return
    }

    // Show toast for other errors
    toastFunction({
      title: 'Error loading data',
      description: error.message,
      variant: 'destructive'
    })
  }
})
```

### ✅ DO: Skip Auth Errors in Retry Logic

```typescript
retry: (failureCount, error) => {
  // ✅ NEVER retry auth errors
  if (error instanceof Error) {
    if (error.message.includes('401') ||
        error.message.includes('403') ||
        error.message.includes('Session expired')) {
      return false
    }
  }
  return failureCount < 1
}
```

**Why?** Prevents infinite retry loops when token expires.

### ✅ DO: Handle Errors in Mutations

```typescript
useMutation({
  mutationFn: ...,
  onError: (error: Error) => {
    toast({
      title: 'Operation failed',
      description: error.message || 'Unknown error',
      variant: 'destructive'
    })
  }
})
```

---

## Loading States

### ✅ DO: Use Semantic Loading States

```typescript
const { data, isLoading, isFetching, isRefetching } = useQuery(...)

// ✅ GOOD: Specific states
if (isLoading) return <Spinner />           // Initial load
if (isFetching) return <Badge>Updating</Badge>  // Background fetch
if (isRefetching) return <Icon>↻</Icon>     // Refetch indicator

// ❌ BAD: Generic loading
if (isLoading || isFetching) return <Spinner />  // Too broad
```

### ✅ DO: Show Partial Data During Refetch

```typescript
const { data, isLoading, isRefetching } = useQuery(...)

if (isLoading && !data) {
  return <Skeleton />  // Initial load
}

return (
  <div className={isRefetching ? 'opacity-50' : ''}>
    {data?.items.map(...)}  {/* Show stale data while refetching */}
  </div>
)
```

---

## Mutations

### ✅ DO: Invalidate Affected Queries

```typescript
useMutation({
  mutationFn: createRepo,
  onSuccess: () => {
    // ✅ Invalidate to trigger refetch
    queryClient.invalidateQueries({ queryKey: queryKeys.git.repositories() })
  }
})
```

### ✅ DO: Use Hierarchical Invalidation

```typescript
// Invalidate all Git data
queryClient.invalidateQueries({ queryKey: queryKeys.git.all })

// Invalidate specific resource
queryClient.invalidateQueries({ queryKey: queryKeys.git.repositories() })
```

### ✅ DO: Show Toast Notifications

```typescript
useMutation({
  mutationFn: ...,
  onSuccess: () => {
    toast({ title: 'Success', description: 'Repository created!' })
  },
  onError: (error: Error) => {
    toast({
      title: 'Error',
      description: error.message,
      variant: 'destructive'
    })
  }
})
```

---

## Optimistic Updates

See [OPTIMISTIC_UPDATES.md](./OPTIMISTIC_UPDATES.md) for full guide.

### ✅ DO: Use for Instant UI Feedback

```typescript
useMutation({
  mutationFn: ...,
  onMutate: async (variables) => {
    await queryClient.cancelQueries({ queryKey: ['items'] })
    const previous = queryClient.getQueryData(['items'])
    queryClient.setQueryData(['items'], optimisticData)
    return { previous }
  },
  onError: (err, variables, context) => {
    queryClient.setQueryData(['items'], context?.previous)  // Rollback
  }
})
```

### ✅ DO: Use for High-Success Operations

- Toggle switches
- Mark as read/unread
- Star/favorite items
- Enable/disable features

### ❌ DON'T: Use for Complex Validation

- Server-side validation needed
- Multiple dependent operations
- High failure rate

---

## Testing

### ✅ DO: Use Test Utilities

```typescript
import { render } from '@/test-utils/render'

// ✅ Automatically includes QueryClient
test('renders data', async () => {
  render(<MyComponent />)
  await waitFor(() => {
    expect(screen.getByText('Data')).toBeInTheDocument()
  })
})
```

### ✅ DO: Disable Retry in Tests

Test utilities automatically configure:

```typescript
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false, gcTime: 0 },
    mutations: { retry: false },
  },
})
```

---

## Common Patterns

### Pattern 1: Query with Filters

```typescript
interface UseMyQueryOptions {
  filters?: { name?: string; status?: string }
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseMyQueryOptions = {}

export function useMyQuery(options: UseMyQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { filters, enabled = true } = options

  return useQuery({
    queryKey: queryKeys.myResource.list(filters),
    queryFn: () => apiCall('my-resource', { method: 'GET' }),
    enabled,
  })
}
```

### Pattern 2: Dependent Queries

```typescript
// Query 1
const { data: userId } = useUserQuery()

// Query 2 depends on Query 1
const { data: profile } = useProfileQuery({
  userId,
  enabled: !!userId  // Only run when userId exists
})
```

### Pattern 3: Polling with Auto-Stop

```typescript
export function useJobQuery(taskId: string) {
  return useQuery({
    queryKey: queryKeys.jobs.detail(taskId),
    queryFn: () => fetchJob(taskId),
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return 2000  // Keep polling

      // Stop when job completes
      if (TERMINAL_STATES.includes(data.status)) {
        return false
      }

      return 2000  // Continue polling
    },
    staleTime: 0,  // Always fetch fresh
  })
}
```

### Pattern 4: Derived State with useMemo

```typescript
const { data } = useMyQuery()

// ✅ Derive from query data
const items = useMemo(() => data?.items || [], [data])
const activeItems = useMemo(() =>
  items.filter(item => item.active),
  [items]
)

// ❌ DON'T duplicate in useState
const [items, setItems] = useState([])  // Bad!
```

---

## Anti-Patterns

### ❌ DON'T: Inline Object Literals as Default Parameters

```typescript
// ❌ BAD: Creates new object every render
export function useMyQuery(options = {}) { }

// ✅ GOOD: Use constant
const DEFAULT_OPTIONS = {}
export function useMyQuery(options = DEFAULT_OPTIONS) { }
```

### ❌ DON'T: Call setState in useEffect

```typescript
// ❌ BAD: Can cause infinite loops
useEffect(() => {
  setData(queryData)
}, [queryData])

// ✅ GOOD: Derive with useMemo
const data = useMemo(() => queryData || [], [queryData])
```

### ❌ DON'T: Store Query Data in useState

```typescript
// ❌ BAD: Duplicate state
const { data } = useQuery(...)
const [items, setItems] = useState([])
useEffect(() => { setItems(data) }, [data])

// ✅ GOOD: Use query data directly
const { data } = useQuery(...)
const items = data?.items || []
```

### ❌ DON'T: Use Inline Query Keys

```typescript
// ❌ BAD
useQuery({ queryKey: ['repos'], ... })

// ✅ GOOD
useQuery({ queryKey: queryKeys.git.repositories(), ... })
```

### ❌ DON'T: Skip Query Cancellation in onMutate

```typescript
// ❌ BAD: Outgoing refetch might overwrite optimistic update
onMutate: async (data) => {
  queryClient.setQueryData(['items'], newData)
}

// ✅ GOOD: Cancel first
onMutate: async (data) => {
  await queryClient.cancelQueries({ queryKey: ['items'] })
  queryClient.setQueryData(['items'], newData)
}
```

---

## Quick Reference

| Scenario | Pattern | Example |
|----------|---------|---------|
| Fetch data | `useQuery` | `useCheckmkHostsQuery()` |
| Create/Update/Delete | `useMutation` | `useGitMutations().createRepository` |
| Poll for updates | `useQuery` + `refetchInterval` | `useJobQuery()` |
| Instant UI feedback | Optimistic updates | `useGitMutationsOptimistic()` |
| Dependent queries | `enabled` option | `enabled: !!userId` |
| Derived state | `useMemo` | `useMemo(() => data?.items, [data])` |
| Background refetch | Auto-refetch on focus | `refetchOnWindowFocus: true` |
| Cache invalidation | After mutation | `invalidateQueries()` |

---

## Migration Checklist

When migrating to TanStack Query:

- [ ] Add query keys to `query-keys.ts`
- [ ] Create hook in `hooks/queries/`
- [ ] Use `DEFAULT_OPTIONS` constant for default parameters
- [ ] Configure appropriate `staleTime` and `gcTime`
- [ ] Add error handling in mutations
- [ ] Invalidate affected queries after mutations
- [ ] Test with `@/test-utils/render`
- [ ] Remove old manual state management code
- [ ] Update imports in consuming components

---

## Resources

- [TanStack Query Docs](https://tanstack.com/query/latest/docs/react/overview)
- [Optimistic Updates Guide](./OPTIMISTIC_UPDATES.md)
- [Query Key Factory](../../lib/query-keys.ts)
- [QueryClient Config](../../lib/query-client.ts)

---

## Getting Help

- Check existing hooks in `/src/hooks/queries/` for patterns
- Review this guide for common scenarios
- See migration docs for detailed examples
- Ask team for code review before merging large changes
