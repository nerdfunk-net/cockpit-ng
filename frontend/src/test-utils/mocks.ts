import { vi } from 'vitest'

/**
 * Mock implementation for useApi hook
 */
export const createMockApiCall = (
  mockResponse?: unknown,
  mockError?: Error | null
) => {
  return vi.fn().mockImplementation(() => {
    if (mockError) {
      return Promise.reject(mockError)
    }
    return Promise.resolve(mockResponse)
  })
}

/**
 * Mock useApi hook with success response
 */
export const mockUseApiSuccess = (response: unknown) => {
  vi.mock('@/hooks/use-api', () => ({
    useApi: () => ({
      apiCall: createMockApiCall(response),
      loading: false,
      error: null,
    }),
  }))
}

/**
 * Mock useApi hook with error response
 */
export const mockUseApiError = (error: Error) => {
  vi.mock('@/hooks/use-api', () => ({
    useApi: () => ({
      apiCall: createMockApiCall(null, error),
      loading: false,
      error: error.message,
    }),
  }))
}

/**
 * Mock useApi hook with loading state
 */
export const mockUseApiLoading = () => {
  vi.mock('@/hooks/use-api', () => ({
    useApi: () => ({
      apiCall: vi.fn(),
      loading: true,
      error: null,
    }),
  }))
}

/**
 * Mock fetch for integration tests
 */
export const mockFetch = (response: unknown, status = 200) => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(response),
    text: () => Promise.resolve(JSON.stringify(response)),
  })
}

/**
 * Mock fetch with error
 */
export const mockFetchError = (error: Error) => {
  global.fetch = vi.fn().mockRejectedValue(error)
}

/**
 * Mock toast notifications
 */
export const mockToast = {
  toast: vi.fn(),
  dismiss: vi.fn(),
}

export const mockUseToast = () => {
  vi.mock('@/hooks/use-toast', () => ({
    useToast: () => mockToast,
  }))
}

/**
 * Reset all mocks
 */
export const resetAllMocks = () => {
  vi.clearAllMocks()
  vi.resetAllMocks()
}
