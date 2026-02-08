import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'

interface SnmpMapping {
  id: number
  name: string
  snmp_community: string | null
  snmp_version: string
  snmp_v3_user: string | null
  snmp_v3_auth_protocol: string | null
  snmp_v3_priv_protocol: string | null
  description: string
  is_active: boolean
  created_at: string
  updated_at: string
  snmp_v3_auth_password: string | null
  snmp_v3_priv_password: string | null
}

interface SnmpMappingsResponse {
  success: boolean
  data: SnmpMapping[]
}

export function useSnmpMappings(enabled: boolean = true) {
  const { apiCall } = useApi()

  const {
    data: snmpData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['snmp-mappings'],
    queryFn: async () => {
      const response = await apiCall<SnmpMappingsResponse>(
        'settings/compliance/snmp-mappings',
        { method: 'GET' }
      )
      return response
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  return {
    snmpMappings: snmpData?.data || [],
    isLoading,
    error,
  }
}
