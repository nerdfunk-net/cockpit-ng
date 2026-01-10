# Add TanStack Query to Additional Frontend Apps

Purpose
-------
This document is a step-by-step migration plan to migrate additional frontend features/apps in this repository to use TanStack Query (`@tanstack/react-query`) for server state management. It is written to be followed by another agent or developer with minimal ambient knowledge.

Goals
-----
- Standardize data fetching & mutation patterns across apps.
- Use TanStack Query for caching, deduplication, background refetch, polling, optimistic updates and error handling.
- Keep imperative effects (`useEffect`) for DOM/subscription/timer concerns and local UI state.
- Provide examples, conventions, and a reproducible migration checklist.

Prerequisites & global setup
----------------------------
1. Ensure `@tanstack/react-query` is installed in `frontend/` (check `package.json`).
2. Add a single `QueryClient` provider at the application root. In a Next.js app this typically lives in the `app/layout.tsx` or a `providers` component.

Example provider (Next.js app):

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000,
    },
    mutations: {
      retry: 0,
    },
  },
})

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
```

Notes:
- Tune `staleTime`, `cacheTime` and `retry` to the app behaviour. Defaults above are conservative.

Repository conventions (recommended)
----------------------------------
- Put new query hooks under `frontend/src/hooks/queries/` with names `use-xxx-query.ts`.
- Put mutation hooks under `frontend/src/hooks/queries/` or `frontend/src/hooks/mutations/` named `use-xxx-mutation.ts`.
- Keep an app-wide `queryKeys` helper under `frontend/src/lib/query-keys.ts` and use it to compose stable query keys.
- Use the central `useApi()` wrapper inside `queryFn`/`mutationFn` to ensure consistent auth/error handling.

When to migrate
----------------
Migrate code that:
- Loads remote data (lists, details) with `useEffect` + `fetch`/`axios`.
- Needs caching, dedupe, background refetch, polling, or optimistic updates.

Do NOT migrate code that:
- Manages local UI-only state (dialogs, form inputs, temporary UI state).
- Uses timers, DOM listeners, or other subscription-based side effects (these should remain `useEffect`).

Candidate features (high-value)
------------------------------
- Git: repositories, commits, branches, file search (already partial migration present).
- Nautobot integrations: device lists, exports, bulk-edit, onboarding datasets.
- Jobs: job results, job status polling, exports.
- Any frequently used lists or shared resources across pages.

Migration patterns and recipes
-----------------------------
Overview recipe (read/query)
1. Identify a `useEffect` that does a fetch and sets component/hook state.
2. Create a new query hook `frontend/src/hooks/queries/use-<resource>-query.ts`.
3. Add `queryKey` entry in `queryKeys`.
4. Implement `useQuery({ queryKey, queryFn })` calling `useApi().apiCall()` internally.
5. Replace the `useEffect` consumer with the new `useQuery` usage and map `data` to previous shape.

Example: converting `use-git-repositories.ts` -> `use-git-repositories-query.ts`

- Existing pattern (simplified):

```ts
// used in many components
useEffect(() => {
  setLoading(true)
  const r = await apiCall('git-repositories')
  setRepositories(r.repositories)
  setLoading(false)
}, [])
```

- Convert to query hook:

```ts
export function useGitRepositoriesQuery(options = {}) {
  const { apiCall } = useApi()
  return useQuery({
    queryKey: queryKeys.git.repositories(),
    queryFn: () => apiCall('git-repositories'),
    staleTime: 30 * 1000,
  })
}
```

Then update consuming components to use `data`, `isLoading`, `error`, `refetch` instead of local state.

Overview recipe (mutations & optimistic updates)
1. Identify UI action that does POST/PUT/DELETE and updates local state or refetches list.
2. Create `useMutation` hook and use `useQueryClient()` for cache updates.
3. Implement optimistic update pattern: cancelQueries -> getQueryData -> setQueryData -> do mutation -> onError rollback -> onSettled invalidateQueries.

Example optimistic mutation (pattern):

```ts
const queryClient = useQueryClient()
const mutation = useMutation(apiCallFn, {
  onMutate: async (variables) => {
    await queryClient.cancelQueries({ queryKey: queryKeys.git.repositories() })
    const previous = queryClient.getQueryData(queryKeys.git.repositories())
    queryClient.setQueryData(queryKeys.git.repositories(), old => /* updated */)
    return { previous }
  },
  onError: (err, variables, context) => {
    if (context?.previous) queryClient.setQueryData(queryKeys.git.repositories(), context.previous)
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.git.repositories() })
  }
})
```

Special patterns
----------------
- Polling/long-running jobs: use `refetchInterval` or manual `refetch` with `setInterval` as needed. Use `enabled` to pause polling when not necessary.
- Pagination: use `useInfiniteQuery` when the backend supports cursor or page tokens. Otherwise, pass page number in query key and `queryFn`.
- Dependent queries: use the `enabled` option (e.g., `enabled: !!parentId`) to avoid running before prerequisites are ready.
- Error handling: surface `error` to components. Use a shared error boundary or notification system for global errors.

Testing & QA
------------
- Unit test query hooks by mocking `useApi().apiCall` and using `@tanstack/react-query`'s `QueryClientProvider` in tests.
- Snapshot/DOM tests: replace local state mocks with query results or mock the `QueryClient` cache entries.
- Manually verify in dev that caching/invalidations/optimistic updates behave as expected.

Step-by-step migration checklist (per feature)
-------------------------------------------
1. Add `queryKey` helper if not present: `queryKeys.<feature>.<resource>()`.
2. Create `frontend/src/hooks/queries/use-<resource>-query.ts` with `useQuery`.
3. Create `frontend/src/hooks/queries/use-<resource>-mutation.ts` for writes where needed.
4. Update components to import the new hooks and remove the `useEffect` fetch + local state.
5. Run TypeScript and linter. Fix any typing issues.
6. Add/adjust unit tests for the new hook and consuming components.
7. Verify behavior in the browser: load, cache behavior, background refetch, optimistic update, error display.
8. Update docs: add a short example to `frontend/CONTRIBUTING-QUERY.md` or to component README.

Rollout strategy (incremental)
------------------------------
- Migrate one small service first (e.g., `git-repositories`) to validate conventions.
- Next migrate higher-impact reads like `git-commits`, `device lists`, and job polling.
- For bulk-edit/table flows: migrate data fetching first (useQuery), then progressively replace table rendering with TanStack Table if useful.

Example conversion plan for `use-git-commits` (detailed)
1. Open `frontend/src/hooks/git/use-git-commits.ts` (find existing `useEffect` + fetch).
2. Add entry `queryKeys.git.commits(repoId: string)` to `query-keys` helper.
3. Create `frontend/src/hooks/queries/use-git-commits-query.ts`:
   - `queryFn` should call `apiCall('git-commits', { method: 'GET', ...})` or the existing wrapped endpoint.
   - Add `enabled: !!repoId` if repoId param required.
4. Update components that used `useGitCommits()` or `useEffect` to use `const { data, isLoading, refetch } = useGitCommitsQuery({ repoId })`.
5. Remove previous `useEffect` fetch and local `commits` state.
6. Add tests and run the app.

Common pitfalls & notes
----------------------
- Avoid moving session/token refresh logic into react-query. Keep `useSessionManager` (timers, listeners) as-is.
- Keep `useApi()` as the single place for `fetch`/auth; call it from `queryFn` to preserve consistent auth & error behavior.
- Mind SSR and Next.js: queries running on server-side may need special handling (hydration, `dehydrate`/`Hydrate`). Add SSR/SSG notes only if the feature is server-rendered.

Roll-back plan
--------------
If a migration causes regressions:
1. Revert the PR (git revert/rollback branch).
2. Restore original `useEffect` hook and local state.
3. Revisit the migration, fix tests and behavior, then reapply.

Checklist for this repository (suggested initial targets)
------------------------------------------------------
- `frontend/src/hooks/git/use-git-repositories.ts` -> already has query variant; ensure consumers use it.
- `frontend/src/hooks/git/use-git-commits.ts` -> migrate to `useQuery` (high value).
- `frontend/src/hooks/git/use-git-branches.ts` -> migrate.
- Device lists in Nautobot bulk-edit and export pages -> migrate reads.
- Jobs polling (job results/status) -> use `useQuery` or `refetchInterval`.

Appendix: Useful snippets
------------------------
- Basic `useQuery`:

```ts
const { data, isLoading, error, refetch } = useQuery({
  queryKey: ['todos'],
  queryFn: () => apiCall<TodosResponse>('todos'),
})
```

- Basic `useMutation` with `useQueryClient`:

```ts
const queryClient = useQueryClient()
const mutation = useMutation((payload) => apiCall('update', { method: 'POST', body: payload }), {
  onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.someResource() })
})
```

Contact / references
--------------------
- See existing examples in `frontend/src/hooks/queries/` for conventions and `use-git-mutations-optimistic.ts` for an optimistic update example.

If you'd like, I can:
- Create `frontend/CONTRIBUTING-QUERY.md` with short patterns and examples.
- Open a PR that migrates one hook (I recommend `use-git-commits`) and updates one consuming component as a template.

---
Generated on: 2026-01-10
