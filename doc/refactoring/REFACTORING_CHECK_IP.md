# Refactoring Plan: Check IP Page Component

**Component:** `frontend/src/components/features/nautobot/tools/check-ip/check-ip-page.tsx`
**Created:** 2026-01-19
**Status:** Planning
**Lines of Code:** 545

## TL;DR - What's Wrong & How to Fix It

**Problems:**
1. 🐛 **Polling broken** - Stale closure bug in manual setTimeout polling
2. 🚫 **Architecture violation** - Uses manual `useState`/`useEffect` instead of mandatory TanStack Query
3. 📏 **Too large** - 545 lines, should be < 200 per component
4. ⚠️ **Missing standards** - No react-hook-form, wrong folder structure, re-render risks

**Solution:**
1. ✅ **Migrate to TanStack Query** - Fixes polling bug automatically, handles caching/retries
2. ✅ **Decompose into 6 components** - Upload form, progress, summary, results, etc.
3. ✅ **Add proper validation** - react-hook-form + zod
4. ✅ **Follow React best practices** - Memoization, constant extraction, exhaustive deps

**Critical Path:** Phase 1 (foundation) → Phase 3 (TanStack Query) → Phase 2 (decomposition)

**Minimum Viable:** Phases 1-3 establishes proper architecture and fixes the bug.

---

## Executive Summary

The Check IP Page component has grown to 545 lines and exhibits several **critical architecture violations** and code quality issues that affect maintainability, testability, and reliability. This plan addresses:

1. **Critical Polling Bug** - Stale closure issue (fixed by TanStack Query migration)
2. **Architecture Violations** - Manual state management instead of mandatory TanStack Query
3. **Component Decomposition** - Breaking down monolithic 545-line component
4. **Standards Compliance** - Aligning with CLAUDE.md requirements (forms, structure, React best practices)

## Key Changes Summary

| Current Approach | Required Approach (CLAUDE.md) |
|------------------|-------------------------------|
| Manual `useState` + `useEffect` polling | **TanStack Query with auto-polling** |
| `setTimeout` with `useRef` workaround | **`refetchInterval` (no bug possible)** |
| Custom form validation | **react-hook-form + zod** |
| `lib/` and `constants/` folders | **types/, utils/ (feature-based)** |
| Inline default arrays/objects | **Module-level constants** |
| Manual loading/error state | **TanStack Query built-in states** |

**Bottom Line:** TanStack Query migration is not optional—it's mandatory per CLAUDE.md and fixes the polling bug as a side effect.

## Quick Wins (Can Start Immediately)

These tasks can be done right now without breaking existing functionality:

### 1. Extract Type Definitions (30 min)
- Create `types/index.ts`
- Move all interfaces out of component
- No behavioral changes

### 2. Extract Constants (15 min)
- Create `utils/constants.ts`
- Move magic strings/numbers
- Fixes potential re-render issues

### 3. Extract Utility Functions (45 min)
- Create `utils/check-ip-utils.ts`
- Move `getStatusIcon()`, `getStatusColor()`
- Add unit tests
- No UI changes

### 4. Add Query Keys (15 min)
- Add to `/lib/query-keys.ts`
- Doesn't change any behavior yet
- Sets up foundation for Phase 3

### 5. Add CSV Export Utility (30 min)
- Create `utils/csv-export.ts`
- Extract and improve export logic
- Easier to test in isolation

**Total Time: ~2.5 hours**
**Risk: Zero** (no behavioral changes)
**Benefit:** Immediate code quality improvement, sets up for bigger changes

## Critical Issues

### 1. ⚠️ Polling Bug - Stale Closure (HIGH PRIORITY)

**Location:** Lines 153-162
**Severity:** Critical - Breaks functionality
**Impact:** Polling may not work correctly due to stale closure over `isPolling` state

**Current Code:**
```tsx
const startPolling = useCallback((taskId: string) => {
  setIsPolling(true)
  const poll = async () => {
    const isComplete = await pollTaskStatus(taskId)
    if (!isComplete && isPolling) {  // ❌ Captures initial value
      setTimeout(poll, 2000)
    }
  }
  poll()
}, [pollTaskStatus, isPolling])  // ❌ Dependency causes issues
```

**Solution: TanStack Query (Mandatory)**

Instead of manual polling with `useRef` workarounds, use TanStack Query which handles this automatically:

```tsx
// hooks/use-check-ip-task-query.ts
export function useCheckIpTaskQuery(taskId: string | null) {
  return useQuery({
    queryKey: queryKeys.checkIp.task(taskId!),
    queryFn: async () => fetchTaskStatus(taskId!),
    enabled: !!taskId,

    // Auto-polling with smart start/stop
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return 2000

      // Auto-stops when task completes
      if (['SUCCESS', 'FAILURE', 'REVOKED'].includes(data.status)) {
        return false
      }

      return 2000
    },
    staleTime: 0,
  })
}
```

**Benefits:**
- ✅ **Eliminates stale closure bug entirely** (TanStack Query manages internal state)
- ✅ No need for `useRef` workaround
- ✅ No manual `isPolling` state
- ✅ Auto-stops polling when task completes
- ✅ Built-in error handling and retry logic
- ✅ Automatic cache management
- ✅ Follows mandatory CLAUDE.md architecture

**Note:** This is not optional. TanStack Query is mandatory for all data fetching per CLAUDE.md standards.

### 2. ⚠️ Architecture Violations (CRITICAL)

**Violations of CLAUDE.md Standards:**

**Issue 2.1: Manual State Management Instead of TanStack Query**
- ❌ Using `useState` + `useEffect` for server data
- ❌ Manual polling with `setTimeout`
- ❌ No caching mechanism
- ✅ **Required:** TanStack Query for all data fetching

**Issue 2.2: Missing Form Validation Standard**
- ❌ Custom form validation logic
- ✅ **Required:** react-hook-form + zod validation

**Issue 2.3: Potential Re-render Loop Risks**
- ⚠️ Default parameters using inline arrays/objects
- ⚠️ Non-memoized derived state
- ✅ **Required:** Follow React best practices (constants for defaults, useMemo for derived state)

**Issue 2.4: Structure Not Following Feature-Based Organization**
- ⚠️ May need verification of proper folder structure
- ✅ **Required:** check-ip/components/, check-ip/hooks/, check-ip/types/, check-ip/utils/

## Component Decomposition

### Current Structure Problems

- Single component with 545 lines
- 9 useState hooks
- Multiple responsibilities mixed together
- Difficult to test individual features
- Hard to reuse logic in other components

### Proposed Structure

```
check-ip/
├── check-ip-page.tsx              (Main container - 150 lines)
├── components/
│   ├── check-ip-upload-form.tsx   (File upload & config - 120 lines)
│   ├── check-ip-progress.tsx      (Progress indicator - 40 lines)
│   ├── check-ip-summary.tsx       (Statistics - 60 lines)
│   ├── check-ip-results.tsx       (Results table - 100 lines)
│   └── status-alert.tsx           (Reusable alert - 40 lines)
├── hooks/
│   ├── use-check-ip-task-query.ts (TanStack Query for polling - 40 lines)
│   ├── use-check-ip-mutations.ts  (Upload mutation - 60 lines)
│   └── use-check-ip-settings.ts   (Settings query - 30 lines)
├── types/
│   └── index.ts                   (Type definitions)
├── utils/
│   ├── check-ip-utils.ts          (Utility functions)
│   ├── csv-export.ts              (Export functionality)
│   └── constants.ts               (Status types, icons, colors)
└── dialogs/                       (Future: modals if needed)
```

**Note:** Structure follows CLAUDE.md standards (types/, utils/ instead of lib/, constants/)

## Detailed Refactoring Steps

### Phase 1: Critical Fixes & Foundation

#### Task 1.1: Verify API & Backend Architecture (CRITICAL)
- [ ] Confirm component uses `/api/proxy/check-ip/*` not direct backend URLs
- [ ] Check for hardcoded `http://localhost:8000` URLs
- [ ] Verify backend has repository layer (`CheckIpRepository`)
- [ ] Verify backend has service layer (`CheckIpService`)
- [ ] Confirm router uses `require_permission()` dependency

#### Task 1.2: Add Query Keys (TanStack Query Foundation)
- [ ] Add to `/frontend/src/lib/query-keys.ts`:
  ```tsx
  export const queryKeys = {
    checkIp: {
      all: ['checkIp'] as const,
      task: (taskId: string) => [...queryKeys.checkIp.all, 'task', taskId] as const,
      settings: () => [...queryKeys.checkIp.all, 'settings'] as const,
    },
  }
  ```

#### Task 1.3: Extract Type Definitions
- [ ] Create `types/index.ts` (NOT `lib/check-ip-types.ts`)
- [ ] Move interfaces: `StatusMessage`, `CheckResult`, `TaskStatus`
- [ ] Add status constants:
  ```tsx
  export const RESULT_STATUS = {
    MATCH: 'match',
    NAME_MISMATCH: 'name_mismatch',
    IP_NOT_FOUND: 'ip_not_found',
    ERROR: 'error'
  } as const

  export const MESSAGE_TYPE = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
  } as const

  export type ResultStatus = typeof RESULT_STATUS[keyof typeof RESULT_STATUS]
  export type MessageType = typeof MESSAGE_TYPE[keyof typeof MESSAGE_TYPE]
  ```

#### Task 1.4: Extract Utility Functions
- [ ] Create `utils/check-ip-utils.ts`
- [ ] Move `getStatusIcon()` function
- [ ] Move `getStatusColor()` function
- [ ] Add unit tests for utilities

#### Task 1.5: Extract CSV Export
- [ ] Create `utils/csv-export.ts`
- [ ] Move `handleExportResults()` logic
- [ ] Make it generic for reuse:
  ```tsx
  export function exportToCSV(
    data: CheckResult[],
    filename: string
  ): void
  ```
- [ ] Add proper CSV escaping for special characters

#### Task 1.6: Extract Constants
- [ ] Create `utils/constants.ts`
- [ ] Define default values:
  ```tsx
  export const DEFAULT_DELIMITER = ';'
  export const DEFAULT_QUOTE_CHAR = '"'
  export const POLLING_INTERVAL = 2000
  export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

  // React best practice: Extract default arrays/objects
  export const EMPTY_RESULTS: CheckResult[] = []
  export const DEFAULT_CSV_OPTIONS = {
    delimiter: DEFAULT_DELIMITER,
    quoteChar: DEFAULT_QUOTE_CHAR,
  } as const
  ```

### Phase 2: Component Decomposition

#### Task 2.1: Create Status Alert Component
- [ ] Create `components/status-alert.tsx`
- [ ] Accept `message: StatusMessage` prop
- [ ] Include icon logic from current implementation
- [ ] Add proper ARIA labels
- [ ] Create Storybook story

#### Task 2.2: Create Upload Form Component
- [ ] Create `components/check-ip-upload-form.tsx`
- [ ] Props:
  ```tsx
  interface CheckIPUploadFormProps {
    onSubmit: (data: UploadFormData) => void
    isDisabled: boolean
  }

  interface UploadFormData {
    file: File
    delimiter: string
    quoteChar: string
  }
  ```
- [ ] **MANDATORY:** Use react-hook-form + zod (per CLAUDE.md):
  ```tsx
  import { useForm } from "react-hook-form"
  import { zodResolver } from "@hookform/resolvers/zod"
  import { z } from "zod"
  import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form"

  const uploadFormSchema = z.object({
    file: z.instanceof(File, { message: "Please select a CSV file" }),
    delimiter: z.string().length(1, "Delimiter must be a single character"),
    quoteChar: z.string().length(1, "Quote character must be a single character"),
  })

  const form = useForm<z.infer<typeof uploadFormSchema>>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: {
      delimiter: DEFAULT_DELIMITER,
      quoteChar: DEFAULT_QUOTE_CHAR,
    }
  })
  ```
- [ ] Include CSV configuration inputs
- [ ] Include file selection logic
- [ ] Add unit tests

#### Task 2.3: Create Progress Component
- [ ] Create `components/check-ip-progress.tsx`
- [ ] Props:
  ```tsx
  interface CheckIPProgressProps {
    taskStatus: TaskStatus
    isPolling: boolean
  }
  ```
- [ ] Include progress bar and message
- [ ] Handle all status states
- [ ] Add unit tests

#### Task 2.4: Create Summary Component
- [ ] Create `components/check-ip-summary.tsx`
- [ ] Props:
  ```tsx
  interface CheckIPSummaryProps {
    results: CheckResult[]
  }
  ```
- [ ] Use `useMemo` for computed stats:
  ```tsx
  const stats = useMemo(() => ({
    total: results.length,
    matches: results.filter(r => r.status === RESULT_STATUS.MATCH).length,
    mismatches: results.filter(r => r.status === RESULT_STATUS.NAME_MISMATCH).length,
    notFound: results.filter(r => r.status === RESULT_STATUS.IP_NOT_FOUND).length
  }), [results])
  ```
- [ ] Add unit tests

#### Task 2.5: Create Results Component
- [ ] Create `components/check-ip-results.tsx`
- [ ] Props:
  ```tsx
  interface CheckIPResultsProps {
    results: CheckResult[]
    showAll: boolean
    onToggleShowAll: () => void
    onExport: () => void
  }
  ```
- [ ] Use `useMemo` for filtered results
- [ ] Consider virtualization for large datasets (react-window)
- [ ] Add pagination if needed
- [ ] Add unit tests

### Phase 3: TanStack Query Migration (CRITICAL - Mandatory)

**Note:** TanStack Query is mandatory for all data fetching per CLAUDE.md. This replaces manual state management and fixes the polling bug automatically.

#### Task 3.1: Create Task Polling Query Hook
- [ ] Create `hooks/use-check-ip-task-query.ts`
- [ ] **Replaces manual polling with TanStack Query:**
  ```tsx
  import { useQuery } from '@tanstack/react-query'
  import { useApi } from '@/hooks/use-api'
  import { queryKeys } from '@/lib/query-keys'
  import type { TaskStatus } from '../types'

  interface UseCheckIpTaskQueryOptions {
    taskId: string | null
    enabled?: boolean
  }

  const DEFAULT_OPTIONS: UseCheckIpTaskQueryOptions = {
    taskId: null,
    enabled: true,
  }

  export function useCheckIpTaskQuery(
    options: UseCheckIpTaskQueryOptions = DEFAULT_OPTIONS
  ) {
    const { apiCall } = useApi()
    const { taskId, enabled = true } = options

    return useQuery({
      queryKey: queryKeys.checkIp.task(taskId!),
      queryFn: async () => {
        const response = await apiCall(`check-ip/task/${taskId}`, {
          method: 'GET'
        })
        return response as TaskStatus
      },
      enabled: enabled && !!taskId,

      // Auto-polling with smart start/stop
      refetchInterval: (query) => {
        const data = query.state.data
        if (!data) return 2000

        // Auto-stop when task completes
        if (['SUCCESS', 'FAILURE', 'REVOKED'].includes(data.status)) {
          return false
        }

        return 2000  // Continue polling every 2s
      },

      staleTime: 0,  // Always fetch fresh data for polling
    })
  }
  ```
- [ ] **Benefits:**
  - ✅ Eliminates stale closure bug
  - ✅ No need for `useRef` workaround
  - ✅ No manual `isPolling` state
  - ✅ Auto-stops polling when complete
  - ✅ Built-in error handling
  - ✅ Automatic cache management

#### Task 3.2: Create Upload Mutation Hook
- [ ] Create `hooks/use-check-ip-mutations.ts`
- [ ] **Replaces manual upload state:**
  ```tsx
  import { useMutation, useQueryClient } from '@tanstack/react-query'
  import { useApi } from '@/hooks/use-api'
  import { queryKeys } from '@/lib/query-keys'
  import { useToast } from '@/hooks/use-toast'

  interface UploadCsvData {
    file: File
    delimiter: string
    quoteChar: string
  }

  interface UploadCsvResponse {
    task_id: string
    message: string
  }

  export function useCheckIpMutations() {
    const { apiCall } = useApi()
    const queryClient = useQueryClient()
    const { toast } = useToast()

    const uploadCsv = useMutation({
      mutationFn: async (data: UploadCsvData) => {
        const formData = new FormData()
        formData.append('file', data.file)
        formData.append('delimiter', data.delimiter)
        formData.append('quote_char', data.quoteChar)

        const response = await apiCall('check-ip/upload', {
          method: 'POST',
          body: formData
        })

        return response as UploadCsvResponse
      },

      onSuccess: (result) => {
        toast({
          title: 'Upload successful',
          description: 'Processing CSV file...',
        })
        // Return taskId to caller
        return result.task_id
      },

      onError: (error: Error) => {
        toast({
          title: 'Upload failed',
          description: error.message,
          variant: 'destructive'
        })
      }
    })

    return {
      uploadCsv,
      isUploading: uploadCsv.isPending
    }
  }
  ```

#### Task 3.3: Create Settings Query Hook
- [ ] Create `hooks/use-check-ip-settings.ts`
- [ ] **Fetch Nautobot settings:**
  ```tsx
  import { useQuery } from '@tanstack/react-query'
  import { useApi } from '@/hooks/use-api'
  import { queryKeys } from '@/lib/query-keys'

  export function useCheckIpSettings() {
    const { apiCall } = useApi()

    return useQuery({
      queryKey: queryKeys.checkIp.settings(),
      queryFn: async () => apiCall('settings/nautobot', { method: 'GET' }),
      staleTime: 5 * 60 * 1000,  // Cache for 5 minutes
    })
  }
  ```

#### Task 3.4: Simplify Client State Management
- [ ] **Remove complex `useReducer`** (over-engineering)
- [ ] Use simple `useState` for client-only UI state:
  ```tsx
  // Client-side UI state only
  const [showAll, setShowAll] = useState(false)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)

  // Server state managed by TanStack Query
  const { data: taskStatus, isLoading: isPolling } = useCheckIpTaskQuery({
    taskId: currentTaskId
  })

  const { uploadCsv, isUploading } = useCheckIpMutations()
  const { data: settings } = useCheckIpSettings()

  // Derived state with useMemo
  const results = useMemo(() => taskStatus?.results || EMPTY_RESULTS, [taskStatus])
  const filteredResults = useMemo(() =>
    showAll ? results : results.filter(r => r.status !== 'match'),
    [results, showAll]
  )
  ```
- [ ] **Benefits:**
  - ✅ Server state separated from client state
  - ✅ Automatic caching and refetching
  - ✅ No need for complex action types
  - ✅ Less code to maintain

### Phase 4: Polish & Optimization

#### Task 4.1: React Best Practices - Prevent Re-render Loops (CRITICAL)

**Rule 1: Default Parameters - Use Constants**
- [ ] Extract all default arrays/objects to module-level constants:
  ```tsx
  // ❌ WRONG - Creates new array every render
  function Component({ items = [] }) { }

  // ✅ CORRECT
  const EMPTY_RESULTS: CheckResult[] = []
  const DEFAULT_CSV_OPTIONS = {
    delimiter: ';',
    quoteChar: '"',
  } as const

  function Component({
    items = EMPTY_RESULTS,
    options = DEFAULT_CSV_OPTIONS
  }) { }
  ```

**Rule 2: Custom Hooks - Memoize Returns**
- [ ] Ensure all custom hooks return memoized objects:
  ```tsx
  // ❌ WRONG - New object every render
  export function useCheckIpData() {
    const [state, setState] = useState()
    return { state, setState }  // New object!
  }

  // ✅ CORRECT
  export function useCheckIpData() {
    const [state, setState] = useState()
    return useMemo(() => ({
      state,
      setState
    }), [state])
  }
  ```

**Rule 3: useEffect Dependencies - MUST Be Stable**
- [ ] Verify all dependencies are stable or memoized:
  ```tsx
  // ❌ WRONG
  const config = { key: 'value' }
  useEffect(() => doSomething(config), [config])  // Runs every render!

  // ✅ CORRECT
  const DEFAULT_CONFIG = { key: 'value' }  // Outside component
  useEffect(() => doSomething(DEFAULT_CONFIG), [])
  ```

**Rule 4: Callbacks to Hooks - ALWAYS useCallback**
- [ ] Wrap all callback props in useCallback:
  ```tsx
  // ❌ WRONG
  const { data } = useMyHook({
    onChange: () => doSomething()  // New function every render!
  })

  // ✅ CORRECT
  const handleChange = useCallback(() => doSomething(), [])
  const { data } = useMyHook({ onChange: handleChange })
  ```

**Rule 5: Exhaustive Dependencies**
- [ ] Enable ESLint rule `exhaustive-deps`
- [ ] Include ALL dependencies in useEffect/useMemo/useCallback
- [ ] Use `useCallback` for functions used as dependencies

#### Task 4.2: Memoization & Performance
- [ ] Use `useMemo` for filtered results:
  ```tsx
  const filteredResults = useMemo(() =>
    showAll ? results : results.filter(r => r.status !== 'match'),
    [results, showAll]
  )
  ```
- [ ] Use `useMemo` for computed statistics:
  ```tsx
  const stats = useMemo(() => ({
    total: results.length,
    matches: results.filter(r => r.status === RESULT_STATUS.MATCH).length,
    mismatches: results.filter(r => r.status === RESULT_STATUS.NAME_MISMATCH).length,
    notFound: results.filter(r => r.status === RESULT_STATUS.IP_NOT_FOUND).length
  }), [results])
  ```
- [ ] Use `useCallback` appropriately for event handlers
- [ ] Consider `React.memo` for child components
- [ ] Add performance monitoring if needed

#### Task 4.3: Extract Repeated Styles
- [ ] Create shared Tailwind components or classes
- [ ] Extract card header gradient:
  ```tsx
  // In tailwind.config.ts or as component
  const cardHeaderClass = "bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4"
  ```
- [ ] Consider using `@apply` or CSS modules

#### Task 4.4: Accessibility Improvements
- [ ] Add ARIA labels to file input
- [ ] Add ARIA live regions for status updates
- [ ] Ensure keyboard navigation works
- [ ] Add focus management
- [ ] Test with screen reader
- [ ] Add skip links if needed

#### Task 4.5: Error Handling Enhancements
- [ ] Add retry mechanism for failed uploads
- [ ] Add timeout handling for polling
- [ ] Add user-friendly error messages
- [ ] Add error boundary around component
- [ ] Log errors to monitoring service

#### Task 4.6: Add Loading States
- [ ] Skeleton loading for initial render
- [ ] Loading state for settings fetch
- [ ] Optimistic UI updates where appropriate

### Phase 5: Testing & Documentation (Week 5)

#### Task 5.1: Unit Tests
- [ ] Test all utility functions (100% coverage)
- [ ] Test custom hooks with `@testing-library/react-hooks`
- [ ] Test individual components with `@testing-library/react`
- [ ] Mock API calls appropriately
- [ ] Test error scenarios

#### Task 5.2: Integration Tests
- [ ] Test complete upload flow
- [ ] Test polling mechanism
- [ ] Test export functionality
- [ ] Test filter toggle
- [ ] Test reset functionality

#### Task 5.3: E2E Tests
- [ ] Create Playwright/Cypress test
- [ ] Test happy path: upload → poll → view results → export
- [ ] Test error scenarios
- [ ] Test with different CSV formats

#### Task 5.4: Documentation
- [ ] Add JSDoc comments to all public functions
- [ ] Create component usage examples
- [ ] Document props with descriptions
- [ ] Update README with component structure
- [ ] Add Storybook stories for all components

## Anti-Patterns to Avoid

### ❌ DO NOT Do These During Refactoring

**1. Don't Try to "Fix" Manual Polling**
- ❌ Adding `useRef` workarounds to existing polling
- ❌ Complex state machines for polling lifecycle
- ✅ **Instead:** Migrate to TanStack Query (eliminates the problem)

**2. Don't Over-Engineer State Management**
- ❌ Creating complex `useReducer` with 10+ action types
- ❌ Adding Redux/Zustand for server state
- ✅ **Instead:** TanStack Query for server state, simple `useState` for UI state

**3. Don't Create Custom Validation Logic**
- ❌ Writing custom form validation functions
- ❌ Manual error state management
- ✅ **Instead:** Use react-hook-form + zod (mandatory)

**4. Don't Break Backward Compatibility Unnecessarily**
- ❌ Changing API contracts during refactoring
- ❌ Renaming props without migration path
- ✅ **Instead:** Internal refactoring only, maintain external API

**5. Don't Skip Tests**
- ❌ "We'll add tests later"
- ❌ Testing only happy path
- ✅ **Instead:** Write tests alongside refactoring, test error cases

**6. Don't Introduce New Dependencies**
- ❌ Adding new libraries for problems solved by existing tools
- ❌ Using different query library instead of TanStack Query
- ✅ **Instead:** Use what's already in the stack (per CLAUDE.md)

**7. Don't Ignore ESLint Warnings**
- ❌ Disabling exhaustive-deps rule
- ❌ Using `// eslint-disable-next-line` without good reason
- ✅ **Instead:** Fix the underlying issue (usually memoization)

**8. Don't Create Files at Wrong Locations**
- ❌ `/components/check-ip-form.tsx` (root level)
- ❌ `/lib/check-ip-types.ts` (not feature-based)
- ✅ **Instead:** `/components/features/nautobot/tools/check-ip/components/`, `/types/`

## Migration Strategy

### Approach: Incremental Refactoring

1. **Keep Original Working** - Don't break existing functionality
2. **Create New Structure Alongside** - Build new components in parallel
3. **TanStack Query First** - Migrate to proper data fetching before UI changes
4. **Gradual Migration** - Switch one section at a time
5. **Rollback Plan** - Keep original component until fully tested

### Step-by-Step Migration

1. **Foundation (Phase 1):**
   - Verify API architecture (proxy pattern, backend layers)
   - Add query keys to central factory
   - Extract types and utilities (no UI change)
   - Extract constants (no UI change)

2. **TanStack Query Migration (Phase 3 - Do Before Phase 2):**
   - Create query hooks (polling, settings)
   - Create mutation hooks (upload)
   - Test polling behavior thoroughly
   - **This fixes the polling bug automatically**

3. **Component Decomposition (Phase 2):**
   - Create new component files
   - Update main component to use new child components one at a time
   - Use new query/mutation hooks in components

4. **Polish (Phase 4):**
   - Apply React best practices
   - Optimize performance
   - Extract repeated styles

5. **Validate (Phase 5):**
   - Comprehensive testing
   - Documentation
   - Remove old code when stable

**Why TanStack Query Before Components:**
- Fixes critical polling bug first
- Simplifies component state (no manual loading/error states)
- Components can be built using clean hook APIs
- Reduces risk of maintaining two broken implementations

## Testing Strategy

### Test Coverage Goals
- Utilities: 100%
- Hooks: 95%
- Components: 90%
- Integration: 80%

### Testing Tools
- **Unit:** Jest + React Testing Library
- **Integration:** React Testing Library
- **E2E:** Playwright or Cypress
- **Visual:** Storybook + Chromatic

## Performance Considerations

### Current Performance Issues
- Results filtering computed multiple times per render
- No virtualization for large result sets
- No pagination

### Optimizations
1. Use `useMemo` for expensive computations
2. Add virtualization with `react-window` if results > 100 items
3. Consider pagination for very large datasets
4. Lazy load results component
5. Debounce filter operations if search is added

## Success Metrics

### Code Quality
- [ ] Component size < 200 lines each
- [ ] Cyclomatic complexity < 10 per function
- [ ] Test coverage > 85%
- [ ] No ESLint warnings
- [ ] TypeScript strict mode enabled
- [ ] **CRITICAL:** No `useState` + `useEffect` for server data (TanStack Query only)
- [ ] **CRITICAL:** All forms use react-hook-form + zod
- [ ] **CRITICAL:** No inline arrays/objects in default parameters

### Architecture Compliance (CLAUDE.md)
- [ ] All data fetching uses TanStack Query
- [ ] Query keys in centralized factory (`/lib/query-keys.ts`)
- [ ] API calls via `/api/proxy/*` (not direct backend)
- [ ] Feature-based folder structure (components/, hooks/, types/, utils/)
- [ ] All UI components from Shadcn
- [ ] Backend has repository/service/router layers
- [ ] Backend routes use `require_permission()` dependency

### User Experience
- [ ] No regression in functionality
- [ ] Improved loading states (TanStack Query built-in)
- [ ] Better error messages (Toast notifications)
- [ ] Faster perceived performance (automatic caching)
- [ ] Polling auto-stops when task completes

### Developer Experience
- [ ] Easier to test (isolated hooks and components)
- [ ] Clear component boundaries
- [ ] Reusable hooks and utilities
- [ ] Good documentation
- [ ] Type safety throughout
- [ ] No stale closure bugs
- [ ] Predictable re-render behavior

## Risks & Mitigation

### Risk 1: Breaking Existing Functionality
**Mitigation:**
- Comprehensive test suite before refactoring
- Incremental changes with testing after each step
- Feature flag for new implementation
- Rollback plan

### Risk 2: Time Investment
**Mitigation:**
- Prioritize critical bug fix (Phase 1)
- Incremental approach allows stopping at any phase
- Benefits compound over time

### Risk 3: API Changes During Refactoring
**Mitigation:**
- Abstract API calls into hook
- Keep API contract types separate
- Version API if possible

## Future Enhancements (Post-Refactoring)

1. **Batch Operations** - Process multiple CSV files simultaneously
2. **Advanced Filtering** - Search and filter results with text search
3. **Result History** - Save and compare previous checks
4. **Auto-save** - Save results automatically to backend
5. **Export Formats** - Add JSON, Excel, PDF export options
6. **Scheduling** - Schedule recurring checks via job templates
7. **Notifications** - Email/Slack when check completes (long-running jobs)
8. **Diff View** - Compare results between two check runs
9. **Bulk Actions** - Select multiple results for bulk operations
10. **Result Annotations** - Add notes/comments to specific results

**Note:** Polling with TanStack Query is the proper approach (not WebSockets) for task status tracking per CLAUDE.md standards.

## Priority Levels

| Phase | Priority | Rationale |
|-------|----------|-----------|
| Phase 1: Critical Fixes & Foundation | **HIGHEST** | Fixes architecture violations, sets up TanStack Query foundation |
| Phase 2: Component Decomposition | **HIGH** | Improves maintainability and testability |
| Phase 3: TanStack Query Migration | **CRITICAL** | Mandatory per CLAUDE.md, fixes polling bug automatically |
| Phase 4: Polish & Optimization | **HIGH** | Prevents re-render loops and performance issues |
| Phase 5: Testing & Documentation | **HIGH** | Ensures quality and maintainability |

**Minimum Viable Refactoring:** Phases 1-3 (establishes proper architecture)

## Approval & Sign-off

- [ ] Technical Lead Review
- [ ] Product Owner Approval
- [ ] QA Test Plan Created
- [ ] Rollback Plan Documented

## Notes

### This Refactoring as a Template

This refactoring should serve as a **reference implementation** for other tool pages and components:

1. **TanStack Query Pattern** - Use this polling implementation as template for other async tasks
2. **Component Structure** - Feature-based organization (components/, hooks/, types/, utils/)
3. **Form Validation** - react-hook-form + zod pattern for all forms
4. **React Best Practices** - Constant extraction, memoization patterns
5. **Testing Strategy** - Unit/integration/E2E test structure

### Broader Impact

- **Identify similar components** that violate CLAUDE.md standards
- **Create migration checklist** based on this plan
- **Extract shared patterns** into reusable utilities:
  - Generic polling hook factory
  - CSV export utility
  - Status display components
  - Form validation schemas
- **Update onboarding docs** with these patterns
- **Create ADR (Architecture Decision Record)** documenting why TanStack Query is mandatory

### Knowledge Transfer

- **Document lessons learned** after each phase
- **Create code examples** in Storybook
- **Update CLAUDE.md** if gaps are discovered
- **Share patterns** in team code review sessions

---

**Last Updated:** 2026-01-19
**Next Review:** After Phase 3 completion (TanStack Query migration)
