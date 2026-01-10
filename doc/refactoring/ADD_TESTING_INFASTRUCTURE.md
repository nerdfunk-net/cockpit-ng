# Implementation Plan: Adding Testing Infrastructure

## 1. Objective
Establish a robust testing environment for the Next.js 15 frontend using Vitest and React Testing Library to enable safe refactoring and prevent regression.

## 2. Technology Stack
- **Test Runner**: [Vitest](https://vitest.dev/) (Fast, native ESM, compatible with Vite/Next.js ecosystem)
- **Component Testing**: [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- **DOM Matchers**: `@testing-library/jest-dom`
- **User Interactions**: `@testing-library/user-event`
- **Environment**: `jsdom` (Simulates browser environment in Node.js)
- **Mocking**: `vi.mock` (Built-in Vitest mocking) & `msw` (Mock Service Worker - optional if deep integration tests preferred later, but starting with Vitest mocks for simplicity).

## 3. Implementation Steps

### Phase 1: Installation & Configuration
1.  **Install Dependencies**:
    ```bash
    npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom @testing-library/user-event @vitest/coverage-v8
    ```
    *Note: `@vitest/coverage-v8` is added for coverage reporting.*

2.  **Create Configuration (`vitest.config.ts`)**:
    - Configure alias mapping.
    - Set up test environment and assertions.
    - **Add Coverage Configuration**.

    ```typescript
    import { defineConfig } from 'vitest/config'
    import react from '@vitejs/plugin-react'
    import path from 'path'

    export default defineConfig({
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        },
      },
      test: {
        environment: 'jsdom',
        setupFiles: ['./vitest.setup.ts'],
        globals: true,
        coverage: {
          provider: 'v8',
          reporter: ['text', 'json', 'html'],
          exclude: ['node_modules/', 'vitest.setup.ts'],
        },
      },
    })
    ```

3.  **Setup Environment (`vitest.setup.ts`)**:
    ```typescript
    import '@testing-library/jest-dom'
    import { cleanup } from '@testing-library/react'
    import { afterEach, vi } from 'vitest'

    // Auto-cleanup after each test
    afterEach(() => {
      cleanup()
      vi.clearAllMocks()
    })

    // Global mocks for Next.js features if needed (e.g., useRouter)
    vi.mock('next/navigation', () => ({
      useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
        prefetch: vi.fn(),
      }),
      usePathname: () => '/',
      useSearchParams: () => new URLSearchParams(),
    }))
    ```

4.  **Update `package.json`**:
    ```json
    "scripts": {
      "test": "vitest",
      "test:run": "vitest run",
      "test:coverage": "vitest run --coverage"
    }
    ```

### Phase 2: Proof of Concept & Real-World Patterns
Instead of trivial tests, we will implement patterns that reflect the codebase's actual complexity.

1.  **Mocking the Auth Store (`zustand`)**:
    - Verify that components react correctly to authentication state.
    - Create a test helper to render with specific auth states.

2.  **Testing a Feature Hook (`useHostsFilter`)**:
    - This hooks contains logic (sort, filter).
    - It should be tested using `renderHook` from `@testing-library/react`.

3.  **Testing a Component with API Interaction**:
    - Create a test for a component that uses `useApi`.
    - Mock `useApi` locally to return success/failure states and assert UI updates (Loading spinners, Error alerts).

### Phase 3: Critical Path Coverage (Smoke Tests)
1.  **Dashboard Rendering**:
    - Ensure the shell layout renders.
2.  **Route Protection**:
    - Verify redirects for unauthenticated users on protected routes.

### Phase 4: CI/CD Integration
1.  **Pipeline Integration**:
    - Add `npm run test:run` to the build pipeline.

## 4. Testing Guidelines & Strategies

### 4.1. Mocking Strategy

#### API Proxy & Data Fetching (`useApi`)
Since the application uses a custom `useApi` hook, we should primarily mock this hook rather than `fetch` directly for component tests. This simplifies tests and avoids implementation details of `fetch`.
```typescript
// Example: Mocking useApi
vi.mock('@/hooks/use-api', () => ({
  useApi: () => ({
     // Mock the implementation of apiCall
     apiCall: vi.fn().mockResolvedValue({ some: 'data' })
  })
}))
```
For integration tests where we want to test the response parsing logic within `useApi`, we will mock the global `fetch`.

#### Auth Store (`zustand`)
Zustand stores persist across tests if not handled.
- **Strategy**: Export the store creating function or use a mock with `vi.mock`.
- **Recommendation**: Create a test utility `renderWithAuth(ui, { user, token } = {})` that initializes the store with a specific state before rendering.

#### GraphQL (If applicable)
If GraphQL is used (e.g., via Apollo or raw requests):
- **Mocking**: Mock the network layer (similar to `useApi`) returning the expected GraphQL JSON structure.
- **Stubbing**: Do not rely on a real schema during unit tests.

### 4.2. Next.js 15 Server vs. Client Components

#### Client Components (`'use client'`)
- **Strategy**: Test using **React Testing Library**.
- **Focus**: User interactions, state updates, effect logic.
- **Environment**: `jsdom` handles these perfectly.

#### Server Components
- **Challenge**: Server Components (RSC) cannot be fully rendered in `jsdom` as they are async and rely on server infrastructure.
- **Strategy**:
  1.  **Unit Test Logic**: Extract data fetching and processing logic into pure functions/services (e.g., `lib/features/checkmk/get-hosts.ts`) and unit test those functions.
  2.  **Component Tests**: Refactor SCs to pass data to Client Components as props. Test the Client Component in isolation.
  3.  **Integration**: Use E2E tests (Playwright/Cypress) to verify the full Server Component rendering pipeline. **Do not attempt to unit test RSCs with React Testing Library.**

### 4.3. Coverage Configuration
We will enforce coverage on business logic directories while excluding UI definitions and configuration files.

**Target Thresholds (Initial):**
- Statements: 50%
- Branches: 50%
- Functions: 50%
- Lines: 50%

**Exclusions:**
- `src/components/ui/*` (Shadcn UI components - assumed correct)
- `*.config.ts`, `*.d.ts`

## 5. Next Steps
1.  Approve this plan.
2.  Execute Phase 1 (Installation).
3.  Execute Phase 2 (PoC with `useHostsFilter` and `Auth` mocking).
