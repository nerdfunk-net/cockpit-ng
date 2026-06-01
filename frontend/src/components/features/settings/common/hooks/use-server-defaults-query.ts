import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { DefaultsApiResponse, DefaultsFields } from '../types/defaults-fields'
import {
  DEFAULTS_FIELDS_CACHE_TIME,
  EMPTY_DEFAULTS_FIELDS,
} from '../utils/defaults-fields-constants'

interface UseServerDefaultsQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseServerDefaultsQueryOptions = { enabled: true }

export function useServerDefaultsQuery(
  options: UseServerDefaultsQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.commonSettings.serverDefaults(),
    queryFn: async () => {
      const response = await apiCall<DefaultsApiResponse>('settings/server/defaults')

      if (response.success && response.data) {
        return response.data
      }

      return EMPTY_DEFAULTS_FIELDS
    },
    enabled,
    staleTime: DEFAULTS_FIELDS_CACHE_TIME,
  })
}

export type { DefaultsFields as ServerDefaults }
