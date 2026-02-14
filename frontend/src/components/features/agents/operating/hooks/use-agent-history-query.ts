import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { HISTORY_STALE_TIME } from '../utils/constants'
import type { CommandHistoryResponse } from '../types'

interface UseAgentHistoryQueryOptions {
  enabled?: boolean
  limit?: number
}

const DEFAULT_OPTIONS: UseAgentHistoryQueryOptions = {}

export function useAgentHistoryQuery(
  agentId: string,
  options: UseAgentHistoryQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true, limit = 50 } = options

  return useQuery({
    queryKey: queryKeys.cockpitAgents.history(agentId),
    queryFn: async () =>
      apiCall<CommandHistoryResponse>(
        `cockpit-agent/${encodeURIComponent(agentId)}/history?limit=${limit}`
      ),
    enabled: enabled && !!agentId,
    staleTime: HISTORY_STALE_TIME,
  })
}
