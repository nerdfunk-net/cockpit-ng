import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { Credential } from '../../types'
import { STALE_TIME, EMPTY_CREDENTIALS } from '../../constants'

interface UseCredentialsQueryOptions {
  filters?: {
    source?: string
    includeExpired?: boolean
  }
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseCredentialsQueryOptions = {}

/**
 * Fetch credentials with automatic caching
 */
export function useCredentialsQuery(
  options: UseCredentialsQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { filters, enabled = true } = options

  return useQuery({
    queryKey: queryKeys.credentials.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters?.source) params.set('source', filters.source)
      if (filters?.includeExpired) params.set('include_expired', 'true')

      const response = await apiCall<Credential[]>(
        `credentials?${params.toString()}`
      )
      return response || EMPTY_CREDENTIALS
    },
    enabled,
    staleTime: STALE_TIME.CREDENTIALS,
  })
}
