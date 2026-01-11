// Credentials Query Hook for Git Authentication

import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { QUERY_STALE_TIMES, EMPTY_CREDENTIALS } from '../../constants'
import type { GitCredential } from '../../types'

interface UseCredentialsQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseCredentialsQueryOptions = {
  enabled: true,
}

/**
 * Fetches credentials suitable for git authentication
 * Filters for token, ssh_key, and generic types
 */
export function useCredentialsQuery(
  options: UseCredentialsQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.credentials.list({ git: true }),
    queryFn: async (): Promise<GitCredential[]> => {
      try {
        const response = await apiCall<GitCredential[]>('credentials/?include_expired=false')
        // Filter for git-compatible credentials
        const filtered = (response || []).filter(
          c => c.type === 'token' || c.type === 'ssh_key' || c.type === 'generic'
        )
        return filtered
      } catch (error) {
        console.error('Error loading credentials:', error)
        return EMPTY_CREDENTIALS
      }
    },
    enabled,
    staleTime: QUERY_STALE_TIMES.CREDENTIALS,
  })
}
