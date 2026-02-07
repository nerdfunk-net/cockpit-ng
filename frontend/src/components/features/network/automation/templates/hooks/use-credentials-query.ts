import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { STALE_TIME, EMPTY_CREDENTIALS } from '../utils/template-constants'
import type { SSHCredential } from '../types/templates'

interface UseCredentialsQueryOptions {
  source?: string
  includeExpired?: boolean
  type?: string
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseCredentialsQueryOptions = {}

/**
 * Fetch credentials with automatic caching.
 * Uses existing queryKeys.credentials.list() from lib/query-keys.ts.
 */
export function useCredentialsQuery(options: UseCredentialsQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { source, includeExpired = false, type, enabled = true } = options

  return useQuery({
    queryKey: queryKeys.credentials.list({ source, includeExpired }),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (includeExpired) params.set('include_expired', 'true')
      if (source) params.set('source', source)
      const qs = params.toString()
      return apiCall<SSHCredential[]>(`credentials${qs ? `?${qs}` : ''}`)
    },
    enabled,
    staleTime: STALE_TIME.CREDENTIALS,
    select: (data) => {
      const credentials = data || EMPTY_CREDENTIALS
      return type ? credentials.filter(c => c.type === type) : credentials
    },
  })
}
