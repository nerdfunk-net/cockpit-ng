import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { ApiResponse, DeviceOffboardingSettings } from '../types'
import { CACHE_TIME, DEFAULT_OFFBOARDING_SETTINGS } from '../utils/constants'

interface UseNautobotOffboardingQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseNautobotOffboardingQueryOptions = { enabled: true }

/**
 * Fetch device offboarding settings with automatic caching
 */
export function useNautobotOffboardingQuery(
  options: UseNautobotOffboardingQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.nautobotSettings.offboarding(),
    queryFn: async () => {
      const response = await apiCall<ApiResponse<DeviceOffboardingSettings>>('settings/offboarding')

      if (response.success && response.data) {
        return response.data
      }

      return DEFAULT_OFFBOARDING_SETTINGS
    },
    enabled,
    staleTime: CACHE_TIME.OFFBOARDING,
  })
}
