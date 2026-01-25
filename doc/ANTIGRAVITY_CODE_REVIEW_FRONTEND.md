# Frontend Code Review

**Date:** 2026-01-25
**Reviewer:** Antigravity
**Scope:** Frontend Codebase (`/frontend/src`) against `CLAUDE.md` specifications.

## 1. Executive Summary

The frontend codebase is largely compliant with the architectural specifications defined in `CLAUDE.md`. The directory structure, technology stack (Next.js, Tailwind, Shadcn UI), and authentication patterns are correctly implemented.

However, **critical violations** regarding data fetching patterns were identified in the **Jobs** and **Dashboard** features. These components completely bypass the mandatory TanStack Query architecture in favor of manual state management, which is explicitly forbidden.

## 2. Compliance Matrix

| Area | Status | Notes |
|------|--------|-------|
| **Tech Stack** | ✅ Pass | Next.js 15, React 19, Tailwind 4, Shadcn UI present. |
| **Architecture** | ✅ Pass | Feature-based structure (`/components/features/{domain}`) is followed. |
| **Data Fetching** | ❌ **FAIL** | **Critical violations found.** Manual `useEffect` + `fetch` used instead of TanStack Query. |
| **Authentication** | ✅ Pass | `useAuthStore` and `api/proxy` pattern correctly used. |
| **Styling** | ⚠️ Warning | Mostly Tailwind, but some inline styles and hard-coded colors exist. |
| **Type Safety** | ✅ Pass | TypeScript is used extensively. |

## 3. Detailed Findings

### 3.1. Critical: Manual Data Fetching Violations

`CLAUDE.md` explicitly states:
> **MANDATORY for all data fetching:** Use TanStack Query instead of manual state management
> **DON'T:** Use manual `useState + useEffect` for server data

**Violating Files:**
1.  **`src/components/features/jobs/view/jobs-view-page.tsx`**
    -   Uses `useState` for `jobRuns`, `loading`, `error`.
    -   Uses `useEffect` to call `fetchJobRuns` and `fetchTemplates`.
    -   Manually manages polling with `setInterval`.
    -   Manually manages complex query parameters.
    -   **Impact**: Race conditions, no caching, boiler-plate heavy, hard to maintain.

2.  **`src/components/layout/dashboard-scan-prefix-stats.tsx`**
    -   Uses `useEffect` to call `loadData`.
    -   Manually sets loading/error states.
    -   **Impact**: Inconsistent state management with the rest of the app.

### 3.2. Code Quality & Best Practices

1.  **Console Logs in Production**:
    -   `src/components/features/jobs/view/jobs-view-page.tsx` contains `console.log` statements (e.g., `console.log('[Jobs] Auto-refreshing job list...')`). These should be removed or replaced with a proper logger.

2.  **State Management**:
    -   The `JobsViewPage` component is overly complex (900+ lines) because it handles data fetching logic locally. Migrating to a custom hook (e.g., `useJobsQuery`) would significantly reduce component size and complexity.

### 3.3. UX & Styling

1.  **Inline Styles**:
    -   Inline styles are used for dynamic widths (e.g., progress bars), which is acceptable.
    -   `src/components/shared/searchable-dropdown.tsx` uses inline styles for positioning. This is acceptable but could be improved with a library like `@floating-ui/react` (or Radix UI's Popover which is already available via Shadcn).

2.  **Tailwind Usage**:
    -   Usage of specific color scales (e.g., `bg-teal-100`, `text-indigo-700`) is mixed with semantic names. While not a strict violation, sticking to semantic colors (e.g., `text-primary`, `bg-muted`) improves theming support.

## 4. Recommendations

### Immediate Actions (High Priority)
1.  **Refactor `JobsViewPage`**:
    -   Create `useJobsQuery` in `src/hooks/queries/use-jobs-query.ts`.
    -   Create `useJobMutations` for cancel/delete actions.
    -   Replace manual `fetch` calls with `useQuery` and `useMutation`.
    -   Use `refetchInterval` option in `useQuery` for polling instead of `setInterval`.

2.  **Refactor `DashboardScanPrefixStats`**:
    -   Create a separate query hook or add to `use-jobs-query.ts` (or similar domain hook).
    -   Replace `useEffect` with `useQuery`.

### Secondary Actions (Medium Priority)
1.  **Cleanup**: Remove `console.log` statements from production code.
2.  **Audit**: Perform a grep search for other instances of `useEffect` + `apiCall` to catch any other hidden violations.

## 5. Security Review

-   **Authentication**: The app correctly uses the `/api/proxy` pattern to communicate with the backend, ensuring tokens are handled securely (assuming the proxy middleware handles token injection/refresh properly).
-   **Authorization**: Components check for `token` before making calls.
-   **Input Validation**: `SearchableDropdown` cleans inputs.
-   **No immediate security flaws detected** in the reviewed files, though the manual `fetch` implementations are more prone to error than the standardized `useQuery` hooks.
