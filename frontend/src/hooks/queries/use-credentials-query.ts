import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

interface GitCredential {
  id?: number
  name: string
  username: string
  type: string
  source?: string
}

const CREDENTIALS_STALE_TIME = 5 * 60 * 1000  // 5 minutes
const EMPTY_CREDENTIALS: GitCredential[] = []

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
    staleTime: CREDENTIALS_STALE_TIME,
  })
}
