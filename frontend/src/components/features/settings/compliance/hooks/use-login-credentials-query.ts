import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { ApiResponse, LoginCredential } from '../types'
import { CACHE_TIME } from '../utils/constants'

interface UseLoginCredentialsQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseLoginCredentialsQueryOptions = { enabled: true }

/**
 * Fetch login credentials for compliance checks with automatic caching
 */
export function useLoginCredentialsQuery(
  options: UseLoginCredentialsQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.complianceSettings.loginCredentials(),
    queryFn: async () => {
      const response = await apiCall<ApiResponse<LoginCredential[]>>(
        'settings/compliance/login-credentials'
      )

      if (response?.success && response?.data) {
        return response.data
      }

      throw new Error('Failed to load login credentials')
    },
    enabled,
    staleTime: CACHE_TIME.LOGIN_CREDENTIALS,
  })
}
