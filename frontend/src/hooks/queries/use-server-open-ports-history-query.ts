import { useQuery } from '@tanstack/react-query'

import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

export interface ServerOpenPortsHistoryEntry {
  id: number
  recorded_at: string
}

interface ServerOpenPortsHistoryListResponse {
  entries: ServerOpenPortsHistoryEntry[]
}

interface UseServerOpenPortsHistoryQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseServerOpenPortsHistoryQueryOptions = {}

export function useServerOpenPortsHistoryQuery(
  serverId: number | null,
  options: UseServerOpenPortsHistoryQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.servers.openPortsHistory(serverId ?? 0),
    queryFn: () =>
      apiCall<ServerOpenPortsHistoryListResponse>(
        `servers/${serverId}/open-ports/history`
      ),
    enabled: enabled && serverId != null,
    staleTime: 30 * 1000,
  })
}
