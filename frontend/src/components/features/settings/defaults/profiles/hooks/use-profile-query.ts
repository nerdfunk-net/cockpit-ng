import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { ProfileApiResponse } from '../types'
import { PROFILES_CACHE_TIME } from '../utils/constants'

interface UseProfileQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseProfileQueryOptions = {}

/**
 * Fetch a single profile's field values by id. Also reused cross-feature
 * (e.g. by CSV Updates) to load whichever profile the user picked as
 * `useProfileFieldsQuery`.
 */
export function useProfileQuery(
  profileId: number | null,
  options: UseProfileQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.profiles.detail(profileId ?? 'none'),
    queryFn: async () => {
      const response = await apiCall<ProfileApiResponse>(`settings/profiles/${profileId}`)

      if (response.success && response.data) {
        return response.data
      }

      throw new Error(response.message || 'Failed to load profile')
    },
    enabled: profileId != null && enabled,
    staleTime: PROFILES_CACHE_TIME,
  })
}
