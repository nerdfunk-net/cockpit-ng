# Optimistic Updates with TanStack Query

## Overview

Optimistic updates provide **instant UI feedback** by updating the interface **before** the API call completes. This creates a snappy, responsive user experience while maintaining data consistency through automatic rollback on errors.

## When to Use Optimistic Updates

### ✅ Good Candidates
- **Quick actions**: Toggling switches, starring items, marking as read
- **High success rate**: Operations that rarely fail
- **User expectations**: Actions where users expect instant feedback
- **Network-independent**: UI changes don't depend on server response

### ❌ Avoid For
- **Complex validation**: Server needs to validate before committing
- **Dependent operations**: Results affect subsequent operations
- **High failure rate**: Often fails due to permissions or validation
- **Background jobs**: Long-running async tasks (use polling instead)

## How It Works

```typescript
const mutation = useMutation({
  mutationFn: async (data) => {
    // API call
    return apiCall('/endpoint', { method: 'POST', body: JSON.stringify(data) })
  },

  // 1️⃣ BEFORE API call (runs immediately)
  onMutate: async (variables) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['myData'] })

    // Snapshot current data
    const previous = queryClient.getQueryData(['myData'])

    // Update cache optimistically
    queryClient.setQueryData(['myData'], (old) => {
      // Return new data
      return { ...old, status: 'updating' }
    })

    // Return context for rollback
    return { previous }
  },

  // 2️⃣ ON SUCCESS (API succeeded)
  onSuccess: () => {
    // Invalidate to get real server data
    queryClient.invalidateQueries({ queryKey: ['myData'] })
  },

  // 3️⃣ ON ERROR (API failed) - AUTOMATIC ROLLBACK
  onError: (error, variables, context) => {
    // Restore previous data
    if (context?.previous) {
      queryClient.setQueryData(['myData'], context.previous)
    }
    // Show error message
    toast({ title: 'Error', description: error.message })
  },

  // 4️⃣ ALWAYS (success or error)
  onSettled: () => {
    // Ensure data is fresh
    queryClient.invalidateQueries({ queryKey: ['myData'] })
  },
})
```

## Flow Diagram

```
User clicks button
       ↓
[onMutate] ──→ Update UI immediately (optimistic)
       ↓           ↓
       ↓      Save snapshot for rollback
       ↓
[mutationFn] ─→ Send API request
       ↓
       ├──→ Success ──→ [onSuccess] ──→ Invalidate cache ──→ Refetch real data
       │
       └──→ Error ──→ [onError] ──→ Restore snapshot ──→ Show error
                           ↓
                      [onSettled] ──→ Always refetch
```

## Real-World Example: Git Repository Sync

### Regular Mutation (No Optimistic Update)
```typescript
// User clicks "Sync"
//   ↓
// [1-2 seconds] ... waiting ... (no feedback)
//   ↓
// API responds
//   ↓
// UI updates to show "Synced"
//
// Problem: User waits with no feedback!
```

### Optimistic Mutation
```typescript
// User clicks "Sync"
//   ↓
// [INSTANT] UI shows "Syncing..." (optimistic)
//   ↓
// API request sent in background
//   ↓
// [1-2 seconds] ... user can continue working ...
//   ↓
// API responds → UI updates to show final state
//
// Benefit: Instant feedback, better UX!
```

### Implementation

```typescript
import { useGitMutationsOptimistic } from '@/hooks/queries/use-git-mutations-optimistic'

function GitRepoCard({ repo }) {
  const { syncRepositoryOptimistic } = useGitMutationsOptimistic()

  return (
    <div>
      <p>Status: {repo.sync_status}</p>
      <Button
        onClick={() => syncRepositoryOptimistic.mutate({
          id: repo.id,
          name: repo.name
        })}
        disabled={syncRepositoryOptimistic.isPending}
      >
        {syncRepositoryOptimistic.isPending ? 'Syncing...' : 'Sync'}
      </Button>
    </div>
  )
}
```

## Optimistic Update Patterns

### Pattern 1: Update Item in List

```typescript
onMutate: async (updatedItem) => {
  await queryClient.cancelQueries({ queryKey: ['items'] })

  const previous = queryClient.getQueryData(['items'])

  queryClient.setQueryData(['items'], (old) => {
    return old.map((item) =>
      item.id === updatedItem.id ? { ...item, ...updatedItem } : item
    )
  })

  return { previous }
}
```

### Pattern 2: Add Item to List

```typescript
onMutate: async (newItem) => {
  await queryClient.cancelQueries({ queryKey: ['items'] })

  const previous = queryClient.getQueryData(['items'])

  queryClient.setQueryData(['items'], (old) => {
    return [...old, { ...newItem, id: 'temp-' + Date.now() }]
  })

  return { previous }
}
```

### Pattern 3: Remove Item from List

```typescript
onMutate: async (itemId) => {
  await queryClient.cancelQueries({ queryKey: ['items'] })

  const previous = queryClient.getQueryData(['items'])

  queryClient.setQueryData(['items'], (old) => {
    return old.filter((item) => item.id !== itemId)
  })

  return { previous }
}
```

### Pattern 4: Toggle Boolean Field

```typescript
onMutate: async ({ id, field, value }) => {
  await queryClient.cancelQueries({ queryKey: ['items'] })

  const previous = queryClient.getQueryData(['items'])

  queryClient.setQueryData(['items'], (old) => {
    return old.map((item) =>
      item.id === id ? { ...item, [field]: value } : item
    )
  })

  return { previous }
}
```

## Benefits of Optimistic Updates

### 1. **Perceived Performance**
- UI responds instantly
- No waiting for server
- Feels faster even if it's not

### 2. **Better UX**
- Users see immediate feedback
- Can continue working while API processes
- Reduces uncertainty

### 3. **Automatic Rollback**
- No manual cleanup code
- Consistent error handling
- Data integrity maintained

### 4. **Network Resilience**
- Works even on slow connections
- Degrades gracefully
- User never blocked

## Common Pitfalls

### ❌ Forgetting to Cancel Queries

```typescript
// BAD: Outgoing refetch might overwrite optimistic update
onMutate: async (data) => {
  queryClient.setQueryData(['items'], newData)
  return { previous: oldData }
}

// GOOD: Cancel first
onMutate: async (data) => {
  await queryClient.cancelQueries({ queryKey: ['items'] })
  queryClient.setQueryData(['items'], newData)
  return { previous: oldData }
}
```

### ❌ Not Returning Context

```typescript
// BAD: No way to rollback
onMutate: async (data) => {
  queryClient.setQueryData(['items'], newData)
  // Missing: return { previous }
}

// GOOD: Return snapshot
onMutate: async (data) => {
  const previous = queryClient.getQueryData(['items'])
  queryClient.setQueryData(['items'], newData)
  return { previous }
}
```

### ❌ Forgetting onSettled

```typescript
// BAD: Cache might be stale
onSuccess: () => {
  // Do nothing
}

// GOOD: Always refetch
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: ['items'] })
}
```

## Testing Optimistic Updates

```typescript
import { render, screen, userEvent } from '@/test-utils/render'

test('optimistic update shows immediate feedback', async () => {
  render(<MyComponent />)

  const button = screen.getByText('Toggle')
  await userEvent.click(button)

  // Should update UI immediately (before API responds)
  expect(screen.getByText('Active')).toBeInTheDocument()

  // Wait for API call to complete
  await waitFor(() => {
    expect(mockApiCall).toHaveBeenCalled()
  })
})

test('optimistic update rolls back on error', async () => {
  // Mock API to fail
  mockApiCall.mockRejectedValueOnce(new Error('API Error'))

  render(<MyComponent />)

  expect(screen.getByText('Inactive')).toBeInTheDocument()

  const button = screen.getByText('Toggle')
  await userEvent.click(button)

  // Should show optimistic state
  expect(screen.getByText('Active')).toBeInTheDocument()

  // Wait for rollback
  await waitFor(() => {
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })
})
```

## Performance Considerations

### Optimistic updates are FAST:
- ✅ No network round-trip
- ✅ Immediate UI update
- ✅ No loading spinners needed

### But watch out for:
- ⚠️ Complex data transformations in onMutate
- ⚠️ Large objects (deep cloning)
- ⚠️ Multiple simultaneous mutations

### Optimization tips:
```typescript
// ✅ GOOD: Simple, fast updates
onMutate: async (id) => {
  const previous = queryClient.getQueryData(['items'])
  queryClient.setQueryData(['items'], old =>
    old.map(item => item.id === id ? { ...item, active: true } : item)
  )
  return { previous }
}

// ❌ AVOID: Heavy computation in onMutate
onMutate: async (data) => {
  const previous = queryClient.getQueryData(['items'])
  const processed = await heavyDataProcessing(data) // Don't do this!
  queryClient.setQueryData(['items'], processed)
  return { previous }
}
```

## References

- [TanStack Query Optimistic Updates Docs](https://tanstack.com/query/latest/docs/react/guides/optimistic-updates)
- [Real-world example: `use-git-mutations-optimistic.ts`](./use-git-mutations-optimistic.ts)

## Summary

Optimistic updates transform slow, blocking operations into instant, responsive interactions. Use them for:
- ✅ Quick, high-success-rate operations
- ✅ Actions where users expect instant feedback
- ✅ Network-independent UI changes

Avoid them for:
- ❌ Complex server validation
- ❌ Long-running background jobs
- ❌ Operations with high failure rates
