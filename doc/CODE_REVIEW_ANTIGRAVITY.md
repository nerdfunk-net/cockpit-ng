# Frontend Codebase Analysis Report

## Executive Summary
The frontend codebase is built on a modern stack (Next.js 15, React 19, TypeScript, Tailwind CSS). While the technology choices are solid, the codebase suffers from several architectural issues that will hinder scalability and maintainability. The most critical gap is the **complete absence of a unit testing framework**. Structurally, several "God Components" exist that rely on monolithic files rather than composed, smaller components.

## Critical Issues

### 1. Lack of Testing Infrastructure
**Severity: CRITICAL**
- **Issue**: The `package.json` contains no scripts or dependencies for unit testing (e.g., Jest, Vitest, React Testing Library).
- **Impact**: Refactoring is extremely risky. There is no automated way to verify that changes don't break existing functionality.
- **Recommendation**: Immediately install Vitest and React Testing Library. Establish a baseline of tests before tackling major refactors.

### 2. Manual Data Fetching & State Management
**Severity: HIGH**
- **Issue**: The application uses a custom `useApi` hook wrapping the native `fetch` API. Data loading is manually handled in `useEffect` hooks across components.
- **Impact**:
    - **Race Conditions**: Manual effect handling often leads to race conditions.
    - **No Caching**: Data is not cached, leading to redundant network requests.
    - **Boilerplate**: Components are cluttered with loading/error state management variables.
- **Recommendation**: Adopt **TanStack Query (React Query)** or **SWR**. This will delete hundreds of lines of boilerplate code and improve application performance.

### 3. "God Components" (Monolithic Files)
**Severity: MEDIUM**
- **Issue**: several files exceed 1500-2000 lines of code, mixing UI, logic, types, and API calls.
- **Top Offenders**:
    1. `src/components/shared/device-selector.tsx` (**~2,160 lines**)
       - Contains complex tree-based logic, legacy structures, and UI all in one.
    2. `src/components/features/settings/git/git-management.tsx` (**~1,940 lines**)
       - Handles the entire Git management workflow including CRUD, logs, and syncing logic.
- **Impact**: These files are difficult to read, impossible to test in isolation, and prone to merge conflicts.
- **Recommendation**: Apply the same refactoring pattern used for `hosts-inventory-page.tsx`:
    - Extract Types to `types/`
    - Extract Logic to Custom Hooks (`hooks/`)
    - Extract UI Sub-components (`components/`)

## Refactoring Success
**Status: VERIFIED**
The file `hosts-inventory-page.tsx` was identified in a previous plan as a refactoring target.
- **Current Status**: Successfully refactored.
- **Size**: Reduced to reasonable size.
- **Structure**: Logic has been moved to hooks (`use-hosts-data.ts`, `use-hosts-filter.ts`) and sub-components (`modals/`, `renderers/`).
- **Takeaway**: This proves the team has a working pattern for breaking down monoliths. This pattern should be applied to `git-management.tsx` next.

## Action Plan

1.  **Infrastructure (Day 1)**
    - Install Vitest + React Testing Library.
    - Create a "Smoke Test" for the main dashboard render.

2.  **Refactoring - Git Management (Day 2-3)**
    - Create `src/components/features/settings/git/hooks/`
    - Extract `useGitRepositories` and `useGitOperations`.
    - Extract UI components: `GitRepositoryCard`, `GitCredentialForm`, `GitDebugModal`.

3.  **Refactoring - Device Selector (Day 4-5)**
    - Isolate the recursive tree logic into a pure utility or hook.
    - Break down the UI into `ConditionGroup` and `ConditionItem` components.
