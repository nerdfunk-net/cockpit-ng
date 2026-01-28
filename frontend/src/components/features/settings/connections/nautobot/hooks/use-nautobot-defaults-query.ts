import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { ApiResponse, NautobotDefaults } from '../types'
import { CACHE_TIME, DEFAULT_NAUTOBOT_DEFAULTS } from '../utils/constants'

interface UseNautobotDefaultsQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseNautobotDefaultsQueryOptions = { enabled: true }

/**
 * Fetch Nautobot default values with automatic caching
 */
export function useNautobotDefaultsQuery(
  options: UseNautobotDefaultsQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.nautobotSettings.defaults(),
    queryFn: async () => {
      const response = await apiCall<ApiResponse<NautobotDefaults>>('settings/nautobot/defaults')

      if (response.success && response.data) {
        return response.data
      }

      return DEFAULT_NAUTOBOT_DEFAULTS
    },
    enabled,
    staleTime: CACHE_TIME.DEFAULTS,
  })
}
