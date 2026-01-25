import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { ApiResponse, CheckMKSettings } from '../types'
import { CACHE_TIME } from '../utils/constants'

interface UseCheckMKSettingsQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseCheckMKSettingsQueryOptions = { enabled: true }

/**
 * Fetch CheckMK connection settings with automatic caching
 */
export function useCheckMKSettingsQuery(
  options: UseCheckMKSettingsQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.checkmkSettings.settings(),
    queryFn: async () => {
      const response = await apiCall<ApiResponse<CheckMKSettings>>('settings/checkmk')

      if (response.success && response.data) {
        return response.data
      }

      throw new Error('Failed to load CheckMK settings')
    },
    enabled,
    staleTime: CACHE_TIME.SETTINGS,
  })
}
