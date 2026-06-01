import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { DefaultsApiResponse, DefaultsFields } from '../types/defaults-fields'
import {
  DEFAULTS_FIELDS_CACHE_TIME,
  EMPTY_DEFAULTS_FIELDS,
} from '../utils/defaults-fields-constants'

interface UseNetworkDefaultsQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseNetworkDefaultsQueryOptions = { enabled: true }

export function useNetworkDefaultsQuery(
  options: UseNetworkDefaultsQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.commonSettings.networkDefaults(),
    queryFn: async () => {
      const response = await apiCall<DefaultsApiResponse>(
        'settings/network/defaults'
      )

      if (response.success && response.data) {
        return response.data
      }

      return EMPTY_DEFAULTS_FIELDS
    },
    enabled,
    staleTime: DEFAULTS_FIELDS_CACHE_TIME,
  })
}

export type { DefaultsFields as NetworkDefaults }
