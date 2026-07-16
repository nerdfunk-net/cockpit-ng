import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AddDevicePage } from './add-device-page'

// Mock dependencies
const mockApiCall = vi.fn()
vi.mock('@/hooks/use-api', () => ({
  useApi: () => ({ apiCall: mockApiCall }),
}))

vi.mock('@/lib/auth-store', () => ({
  useAuthStore: () => ({ isAuthenticated: true }),
}))

// Mock UI components
vi.mock('@/components/ui/alert', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert">{children}</div>
  ),
  AlertDescription: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}))

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn()

function renderAddDevicePage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AddDevicePage />
    </QueryClientProvider>
  )
}

describe('AddDevicePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default API mocks for dropdowns
    mockApiCall.mockImplementation(url => {
      // Return empty arrays/objects to simulate successful "no data" load or basic data
      // This allows Promise.all to resolve and loading state to clear
      if (url === 'nautobot/roles/devices')
        return Promise.resolve([{ id: 'role-1', name: 'Router' }])
      if (url === 'settings/profiles')
        return Promise.resolve({
          success: true,
          data: [{ id: 1, name: 'Network', built_in_key: 'network', is_built_in: true }],
        })
      if (typeof url === 'string') return Promise.resolve([])
      return Promise.resolve([])
    })
  })

  it('should render the add device page', async () => {
    renderAddDevicePage()

    await screen.findByRole('button', { name: /add device/i }, { timeout: 5000 })

    expect(screen.getByText('Add Device to Nautobot')).toBeInTheDocument()
  })

  it('should validate form on submission', async () => {
    renderAddDevicePage()

    const submitBtn = await screen.findByRole(
      'button',
      { name: /add device/i },
      { timeout: 5000 }
    )
    fireEvent.click(submitBtn)

    // Field + summary can both surface the same validation copy
    const messages = await screen.findAllByText(/Device name is required/i)
    expect(messages.length).toBeGreaterThanOrEqual(1)
  })
})
