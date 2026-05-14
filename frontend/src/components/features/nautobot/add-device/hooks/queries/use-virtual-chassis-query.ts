import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { VirtualChassisItem } from '../../types'

export function useVirtualChassisQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.nautobot.virtualChassis(),
    queryFn: async (): Promise<VirtualChassisItem[]> => {
      return apiCall<VirtualChassisItem[]>('nautobot/virtual-chassis', {
        method: 'GET',
      })
    },
    staleTime: 5 * 60 * 1000,
  })
}
