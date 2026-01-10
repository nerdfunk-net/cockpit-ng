import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useApi } from './use-api'
import { useAuthStore } from '@/lib/auth-store'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Note: next/navigation is already mocked globally in vitest.setup.ts

describe('useApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Reset auth store
    useAuthStore.setState({
      token: 'test-token',
      user: {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        roles: ['user'],
      },
      isAuthenticated: true,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should make successful GET request', async () => {
    const mockData = { id: 1, name: 'Test' }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve(mockData),
    })

    const { result } = renderHook(() => useApi())
    const data = await result.current.apiCall('test')

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/proxy/test',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        }),
      })
    )
    expect(data).toEqual(mockData)
  })

  it('should make successful POST request with JSON body', async () => {
    const mockData = { success: true }
    const requestBody = { name: 'New Item' }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve(mockData),
    })

    const { result } = renderHook(() => useApi())
    const data = await result.current.apiCall('items', {
      method: 'POST',
      body: requestBody,
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/proxy/items',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(requestBody),
      })
    )
    expect(data).toEqual(mockData)
  })

  it('should handle FormData body correctly', async () => {
    const mockData = { success: true }
    const formData = new FormData()
    formData.append('file', 'test-file')

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve(mockData),
    })

    const { result } = renderHook(() => useApi())
    await result.current.apiCall('upload', {
      method: 'POST',
      body: formData,
    })

    const fetchCall = mockFetch.mock.calls[0]
    const callHeaders = fetchCall[1].headers

    // FormData should not have Content-Type header (browser sets it with boundary)
    expect(callHeaders['Content-Type']).toBeUndefined()
    expect(fetchCall[1].body).toBe(formData)
  })

  it('should handle 401 unauthorized and redirect to login', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    })

    const { result } = renderHook(() => useApi())

    await expect(result.current.apiCall('protected')).rejects.toThrow(
      'Session expired, redirecting to login...'
    )

    // Wait for logout to complete
    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(false)
      expect(useAuthStore.getState().token).toBeNull()
    })
  })

  it('should handle 403 forbidden without logging out', async () => {
    const errorDetail = 'Insufficient permissions'
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: () => Promise.resolve(JSON.stringify({ detail: errorDetail })),
    })

    const { result } = renderHook(() => useApi())

    await expect(result.current.apiCall('admin')).rejects.toThrow(errorDetail)

    // User should still be authenticated
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(useAuthStore.getState().token).toBe('test-token')
  })

  it('should handle generic API errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    })

    const { result } = renderHook(() => useApi())

    await expect(result.current.apiCall('error')).rejects.toThrow(
      'API Error 500: Internal Server Error'
    )
  })

  it('should handle empty responses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      headers: new Headers(),
      json: () => Promise.reject(new Error('No content')),
    })

    const { result } = renderHook(() => useApi())
    const data = await result.current.apiCall('delete', { method: 'DELETE' })

    expect(data).toEqual({})
  })

  it('should include custom headers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({}),
    })

    const { result } = renderHook(() => useApi())
    await result.current.apiCall('test', {
      headers: { 'X-Custom-Header': 'custom-value' },
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/proxy/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Custom-Header': 'custom-value',
          Authorization: 'Bearer test-token',
        }),
      })
    )
  })

  it('should handle requests without auth token', async () => {
    useAuthStore.setState({ token: null, user: null, isAuthenticated: false })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({}),
    })

    const { result } = renderHook(() => useApi())
    await result.current.apiCall('public')

    const fetchCall = mockFetch.mock.calls[0]
    const callHeaders = fetchCall[1].headers

    expect(callHeaders.Authorization).toBeUndefined()
  })

  it('should support PUT and PATCH methods', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ success: true }),
    })

    const { result } = renderHook(() => useApi())

    // Test PUT
    await result.current.apiCall('item/1', {
      method: 'PUT',
      body: { name: 'Updated' },
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/proxy/item/1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated' }),
      })
    )

    // Test PATCH
    await result.current.apiCall('item/1', {
      method: 'PATCH',
      body: { name: 'Patched' },
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/proxy/item/1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ name: 'Patched' }),
      })
    )
  })
})
