import { ReactElement } from 'react'
import { render as rtlRender, RenderOptions } from '@testing-library/react'
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

/**
 * Custom render function that sets up auth state before rendering
 */
export function render(ui: ReactElement, options: CustomRenderOptions = {}) {
  const { authState, ...renderOptions } = options

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

  return rtlRender(ui, renderOptions)
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
