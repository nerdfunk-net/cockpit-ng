import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { Profile, ProfileListApiResponse } from '../types'
import { EMPTY_PROFILES, PROFILES_CACHE_TIME } from '../utils/constants'

interface UseProfilesQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseProfilesQueryOptions = {}

/**
 * List all profiles (built-in Network/Server plus any custom profiles).
 */
export function useProfilesQuery(options: UseProfilesQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.profiles.list(),
    queryFn: async () => {
      const response = await apiCall<ProfileListApiResponse>('settings/profiles')

      if (response.success && response.data) {
        return response.data
      }

      return EMPTY_PROFILES as Profile[]
    },
    enabled,
    staleTime: PROFILES_CACHE_TIME,
  })
}
