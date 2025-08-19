import { useAuthStore } from '@/lib/auth-store'

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: any
  headers?: Record<string, string>
}

export function useApi() {
  const { token, logout } = useAuthStore()

  const apiCall = async <T = any>(endpoint: string, options: ApiOptions = {}): Promise<T> => {
    const { method = 'GET', body, headers = {} } = options
    
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers
    }

    if (token) {
      defaultHeaders.Authorization = `Bearer ${token}`
    }

    const fetchOptions: RequestInit = {
      method,
      headers: defaultHeaders
    }

    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body)
    }

    const response = await fetch(`/api/proxy/${endpoint}`, fetchOptions)
    
    if (!response.ok) {
      const errorText = await response.text()
      
      // Handle authentication failures
      if (response.status === 401 || response.status === 403) {
        logout() // Clear invalid token
        throw new Error(`Authentication failed (${response.status}): Please log in again`)
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
  }

  return { apiCall }
}
