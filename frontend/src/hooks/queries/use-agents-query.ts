import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { Agent } from '@/components/features/settings/connections/agents/types'

interface AgentsSettingsResponse {
  success: boolean
  data?: { agents: Agent[] }
}

interface UseAgentsQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseAgentsQueryOptions = {}

export function useAgentsQuery(options: UseAgentsQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.agents.list(),
    queryFn: () => apiCall<AgentsSettingsResponse>('settings/agents'),
    enabled,
    staleTime: 5 * 60 * 1000,
    select: (data) => data?.data?.agents ?? [],
  })
}
