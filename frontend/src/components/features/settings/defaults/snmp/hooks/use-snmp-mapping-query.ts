import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { LoadResponse } from '../types'
import { CACHE_TIME, SNMP_FILE_NAME } from '../utils/constants'

interface UseSnmpMappingOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseSnmpMappingOptions = { enabled: true }

/**
 * Fetch SNMP mapping YAML content with automatic caching
 */
export function useSnmpMappingQuery(options: UseSnmpMappingOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.commonSettings.snmpMapping(),
    queryFn: async () => {
      const response = await apiCall<LoadResponse>(`config/${SNMP_FILE_NAME}`)

      if (response.success && response.data) {
        return response.data
      }

      throw new Error('Failed to load SNMP mapping')
    },
    enabled,
    staleTime: CACHE_TIME.SNMP_MAPPING,
  })
}
