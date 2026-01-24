import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { ApiResponse, SNMPMapping } from '../types'
import { CACHE_TIME } from '../utils/constants'

interface UseSnmpMappingsQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseSnmpMappingsQueryOptions = { enabled: true }

/**
 * Fetch SNMP mappings for compliance checks with automatic caching
 */
export function useSnmpMappingsQuery(
  options: UseSnmpMappingsQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.complianceSettings.snmpMappings(),
    queryFn: async () => {
      const response = await apiCall<ApiResponse<SNMPMapping[]>>(
        'settings/compliance/snmp-mappings'
      )

      if (response?.success && response?.data) {
        return response.data
      }

      throw new Error('Failed to load SNMP mappings')
    },
    enabled,
    staleTime: CACHE_TIME.SNMP_MAPPINGS,
  })
}
