import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { Profile, ProfileListApiResponse } from '../types'
import { EMPTY_PROFILES, PROFILES_CACHE_TIME } from '../utils/constants'

/**
 * List all profiles (built-in Network/Server plus any custom profiles).
 */
export function useProfilesQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.profiles.list(),
    queryFn: async () => {
      const response = await apiCall<ProfileListApiResponse>('settings/profiles')

      if (response.success && response.data) {
        return response.data
      }

      return EMPTY_PROFILES as Profile[]
    },
    staleTime: PROFILES_CACHE_TIME,
  })
}
