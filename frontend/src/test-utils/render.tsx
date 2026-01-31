import { ReactElement } from 'react'
import { render as rtlRender, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/lib/auth-store'
import type { User } from '@/types/auth'

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

const DEFAULT_RENDER_OPTIONS: CustomRenderOptions = {}

/**
 * Custom render function that sets up auth state and QueryClient before rendering
 */
export function render(ui: ReactElement, options: CustomRenderOptions = DEFAULT_RENDER_OPTIONS) {
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
    // Reset to default unauthenticated state
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
    permissions: 15, // Default permissions bitmask
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
      permissions: 65535, // All permissions
    },
    options
  )
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react'
