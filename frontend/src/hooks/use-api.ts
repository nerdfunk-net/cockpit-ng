import { useAuthStore } from '@/lib/auth-store'
import { useRouter } from 'next/navigation'
import { useCallback, useRef, useEffect, useMemo } from 'react'

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: unknown
  headers?: Record<string, string>
}

/**
 * Thrown by apiCall on any non-2xx response. `status` and `detail` let
 * callers branch on structured error bodies (e.g. a 409 whose
 * `detail` is `{ message, impact }`) instead of parsing `error.message`.
 */
export class ApiError extends Error {
  status: number
  detail: unknown

  constructor(message: string, status: number, detail: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

const EMPTY_OPTIONS: ApiOptions = {}
const EMPTY_HEADERS: Record<string, string> = {}

export function useApi() {
  const { logout } = useAuthStore()
  const router = useRouter()

  const logoutRef = useRef(logout)
  const routerRef = useRef(router)

  useEffect(() => {
    logoutRef.current = logout
    routerRef.current = router
  }, [logout, router])

  const apiCall = useCallback(
    async <T = unknown>(
      endpoint: string,
      options: ApiOptions = EMPTY_OPTIONS
    ): Promise<T> => {
      const { method = 'GET', body, headers = EMPTY_HEADERS } = options

      const defaultHeaders: Record<string, string> = {
        ...headers,
      }

      // Authorization is injected server-side by the proxy from the httpOnly cookie
      if (!(body instanceof FormData)) {
        defaultHeaders['Content-Type'] = 'application/json'
      }

      const fetchOptions: RequestInit = {
        method,
        headers: defaultHeaders,
      }

      if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        if (body instanceof FormData) {
          fetchOptions.body = body
        } else {
          fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body)
        }
      }

      const response = await fetch(`/api/proxy/${endpoint}`, fetchOptions)

      if (!response.ok) {
        const errorText = await response.text()

        if (response.status === 401) {
          logoutRef.current()
          if (typeof window !== 'undefined') {
            setTimeout(() => {
              window.location.replace('/login')
            }, 100)
          }
          return Promise.reject(new Error('Session expired, redirecting to login...'))
        }

        let errorMessage = `API Error ${response.status}`
        let errorDetail: unknown = undefined
        try {
          const errorData = JSON.parse(errorText)
          if (errorData.detail) {
            const detail = errorData.detail
            errorDetail = detail
            if (typeof detail === 'object' && detail !== null && typeof detail.message === 'string') {
              errorMessage = detail.message
            } else {
              errorMessage = String(detail)
            }
          } else if (errorText) {
            errorMessage = `${errorMessage}: ${errorText}`
          }
        } catch {
          if (errorText) errorMessage = `${errorMessage}: ${errorText}`
        }
        throw new ApiError(errorMessage, response.status, errorDetail)
      }

      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        return response.json()
      } else {
        return {} as T
      }
    },
    []
  )

  return useMemo(() => ({ apiCall }), [apiCall])
}
