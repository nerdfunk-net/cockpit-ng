import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { StackDevicesResponse } from '../types/stacks-types'

export function useStackDevicesQuery() {
  const { apiCall } = useApi()

  return useQuery<StackDevicesResponse>({
    queryKey: queryKeys.nautobot.stackDevices(),
    queryFn: () =>
      apiCall<StackDevicesResponse>('nautobot/devices/stacks', { method: 'GET' }),
    staleTime: 30 * 1000,
  })
}
