import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

interface NautobotStats {
  devices: number
  locations: number
  ip_addresses: number
  prefixes: number
}

export function useNautobotStatsQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.dashboard.nautobotStats(),
    queryFn: () => apiCall<NautobotStats>('nautobot/stats'),
    staleTime: 5 * 60 * 1000,
  })
}
