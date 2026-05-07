import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { VirtualChassisDetail } from '../../types'

export function useVirtualChassisDetailQuery(vcId: string) {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.nautobot.virtualChassisDetail(vcId),
    queryFn: async (): Promise<VirtualChassisDetail> =>
      apiCall<VirtualChassisDetail>(`nautobot/virtual-chassis/${vcId}`, { method: 'GET' }),
    enabled: !!vcId,
    staleTime: 5 * 60 * 1000,
  })
}
