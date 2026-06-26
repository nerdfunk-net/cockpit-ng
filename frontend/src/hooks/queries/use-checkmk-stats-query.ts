import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

interface CheckMKStats {
  total_hosts: number
  timestamp: string
}

export function useCheckmkStatsQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.dashboard.checkmkStats(),
    queryFn: () => apiCall<CheckMKStats>('checkmk/stats'),
    staleTime: 5 * 60 * 1000,
  })
}
