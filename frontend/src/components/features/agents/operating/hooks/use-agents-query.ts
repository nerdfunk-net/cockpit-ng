import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { AGENTS_STALE_TIME, POLLING_INTERVAL } from '../utils/constants'
import type { AgentListResponse } from '../types'

interface UseAgentsQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseAgentsQueryOptions = {}

export function useAgentsQuery(options: UseAgentsQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.cockpitAgents.list(),
    queryFn: async () => apiCall<AgentListResponse>('cockpit-agent/list'),
    enabled,
    staleTime: AGENTS_STALE_TIME,
    refetchInterval: POLLING_INTERVAL,
  })
}
