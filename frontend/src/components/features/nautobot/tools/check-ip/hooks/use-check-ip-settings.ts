import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { NautobotSettings } from '../types'

export function useCheckIpSettings() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.checkIp.settings(),
    queryFn: async () => {
      const response = await apiCall('settings/nautobot', { method: 'GET' })
      return response as NautobotSettings
    },
    staleTime: 5 * 60 * 1000,  // Cache for 5 minutes
  })
}
