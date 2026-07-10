import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { Agent } from '@/components/features/settings/connections/agents/types'
import type { AgentListResponse } from '@/components/features/agents/operating/types'

export interface GetDataAgentOption extends Agent {
  status?: string
  data_flows: string[]
}

const EMPTY_AGENTS: GetDataAgentOption[] = []

interface AgentsSettingsResponse {
  success: boolean
  data?: { agents: Agent[] }
}

function parseDataFlows(value?: string): string[] {
  if (!value) return []
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

export function useGetDataAgents() {
  const { apiCall } = useApi()

  const query = useQuery({
    queryKey: [...queryKeys.agents.list(), 'get-data-enriched'],
    queryFn: async () => {
      const [settingsResponse, runtimeResponse] = await Promise.all([
        apiCall<AgentsSettingsResponse>('settings/agents'),
        apiCall<AgentListResponse>('cockpit-agent/list'),
      ])

      const configuredAgents = (settingsResponse?.data?.agents ?? EMPTY_AGENTS).filter(
        agent => agent.type === 'get_data'
      )
      const runtimeById = new Map(
        (runtimeResponse?.agents ?? []).map(agent => [agent.agent_id, agent])
      )

      return configuredAgents.map(agent => {
        const runtime = runtimeById.get(agent.agent_id ?? agent.id)
        return {
          ...agent,
          status: runtime?.status,
          data_flows: parseDataFlows(runtime?.data_flows),
        } satisfies GetDataAgentOption
      })
    },
    staleTime: 30 * 1000,
  })

  const agents = useMemo(() => query.data ?? EMPTY_AGENTS, [query.data])

  return { ...query, data: agents }
}
