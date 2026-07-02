import { useQuery } from '@tanstack/react-query'

import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

export interface ServerFactsHistoryEntry {
  id: number
  recorded_at: string
}

interface ServerFactsHistoryListResponse {
  entries: ServerFactsHistoryEntry[]
}

interface UseServerFactsHistoryQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseServerFactsHistoryQueryOptions = {}

export function useServerFactsHistoryQuery(
  serverId: number | null,
  options: UseServerFactsHistoryQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.servers.factsHistory(serverId ?? 0),
    queryFn: () =>
      apiCall<ServerFactsHistoryListResponse>(`servers/${serverId}/facts/history`),
    enabled: enabled && serverId != null,
    staleTime: 30 * 1000,
  })
}
