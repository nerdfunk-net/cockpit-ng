import { useQuery } from '@tanstack/react-query'

import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

export interface ServerFactsHistoryDetail {
  id: number
  recorded_at: string
  ansible_facts: Record<string, unknown> | null
}

interface UseServerFactsHistoryDetailQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseServerFactsHistoryDetailQueryOptions = {}

export function useServerFactsHistoryDetailQuery(
  serverId: number | null,
  historyId: number | null,
  options: UseServerFactsHistoryDetailQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.servers.factsHistoryDetail(serverId ?? 0, historyId ?? 0),
    queryFn: () =>
      apiCall<ServerFactsHistoryDetail>(
        `servers/${serverId}/facts/history/${historyId}`
      ),
    enabled: enabled && serverId != null && historyId != null,
    staleTime: 60 * 1000,
  })
}
