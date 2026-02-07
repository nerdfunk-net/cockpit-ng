import { useAuthStore } from '@/lib/auth-store'
import { useRouter } from 'next/navigation'
import { useCallback, useRef, useEffect, useMemo } from 'react'

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: unknown
  headers?: Record<string, string>
}

const EMPTY_OPTIONS: ApiOptions = {}
const EMPTY_HEADERS: Record<string, string> = {}

export function useApi() {
  const { token, logout } = useAuthStore()
  const router = useRouter()
  
  // Use refs to access current values without recreating apiCall
  const tokenRef = useRef(token)
  const logoutRef = useRef(logout)
  const routerRef = useRef(router)
  
  // Keep refs in sync with current values
  useEffect(() => {
    tokenRef.current = token
    logoutRef.current = logout
    routerRef.current = router
  }, [token, logout, router])

  const apiCall = useCallback(async <T = unknown>(endpoint: string, options: ApiOptions = EMPTY_OPTIONS): Promise<T> => {
    const { method = 'GET', body, headers = EMPTY_HEADERS } = options
    
    const defaultHeaders: Record<string, string> = {
      ...headers
    }

    // Only set Content-Type to application/json if body is not FormData
    if (!(body instanceof FormData)) {
      defaultHeaders['Content-Type'] = 'application/json'
    }

    // Use ref to get current token value
    if (tokenRef.current) {
      defaultHeaders.Authorization = `Bearer ${tokenRef.current}`
    }

    const fetchOptions: RequestInit = {
      method,
      headers: defaultHeaders
    }

    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      if (body instanceof FormData) {
        // Let browser set Content-Type with boundary for FormData
        fetchOptions.body = body
      } else {
        fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body)
      }
    }

    const response = await fetch(`/api/proxy/${endpoint}`, fetchOptions)
    
    if (!response.ok) {
      const errorText = await response.text()
      
      // Handle authentication failures (401) - redirect to login
      if (response.status === 401) {
        logoutRef.current() // Clear invalid token
        // Use window.location.replace to ensure clean redirect without URL parameters
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            window.location.replace('/login')
          }, 100)
        }
        // Return a rejected promise that components can handle gracefully
        return Promise.reject(new Error('Session expired, redirecting to login...'))
      }
      
      // Handle authorization failures (403) - don't logout, just throw error with details
      if (response.status === 403) {
        let errorMessage = 'Access denied'
        try {
          const errorData = JSON.parse(errorText)
          errorMessage = errorData.detail || errorMessage
        } catch {
          // If can't parse JSON, use default message
        }
        throw new Error(errorMessage)
      }
      
      throw new Error(`API Error ${response.status}: ${errorText}`)
    }

    // Handle empty responses
    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      return response.json()
    } else {
      return {} as T
    }
  }, []) // Empty dependencies - all values accessed via refs

  // Memoize the return object to ensure stable reference
  return useMemo(() => ({ apiCall }), [apiCall])
}
