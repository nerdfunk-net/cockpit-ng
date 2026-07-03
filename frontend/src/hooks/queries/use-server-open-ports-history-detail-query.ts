import { useQuery } from '@tanstack/react-query'

import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { ServerOpenPorts } from '@/components/features/server-clients/server/types'

export interface ServerOpenPortsHistoryDetail {
  id: number
  recorded_at: string
  open_ports: ServerOpenPorts | null
}

interface UseServerOpenPortsHistoryDetailQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseServerOpenPortsHistoryDetailQueryOptions = {}

export function useServerOpenPortsHistoryDetailQuery(
  serverId: number | null,
  historyId: number | null,
  options: UseServerOpenPortsHistoryDetailQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.servers.openPortsHistoryDetail(serverId ?? 0, historyId ?? 0),
    queryFn: () =>
      apiCall<ServerOpenPortsHistoryDetail>(
        `servers/${serverId}/open-ports/history/${historyId}`
      ),
    enabled: enabled && serverId != null && historyId != null,
    staleTime: 60 * 1000,
  })
}
