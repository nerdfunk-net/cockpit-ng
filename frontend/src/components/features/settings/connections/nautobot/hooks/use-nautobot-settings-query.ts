import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { ApiResponse, NautobotSettings } from '../types'
import { CACHE_TIME, DEFAULT_NAUTOBOT_SETTINGS } from '../utils/constants'

interface UseNautobotSettingsQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseNautobotSettingsQueryOptions = { enabled: true }

/**
 * Fetch Nautobot connection settings with automatic caching
 */
export function useNautobotSettingsQuery(
  options: UseNautobotSettingsQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.nautobotSettings.settings(),
    queryFn: async () => {
      const response = await apiCall<ApiResponse<NautobotSettings>>('settings/nautobot')

      if (response.success && response.data) {
        return response.data
      }

      return DEFAULT_NAUTOBOT_SETTINGS
    },
    enabled,
    staleTime: CACHE_TIME.SETTINGS,
  })
}
