import { useAgentsQuery } from '@/hooks/queries/use-agents-query'
import type { Agent } from '@/components/features/settings/connections/agents/types'

const EMPTY_AGENTS: Agent[] = []

export function useGetDataAgents() {
  const query = useAgentsQuery()
  const agents = (query.data ?? EMPTY_AGENTS).filter(agent => agent.type === 'get_data')

  return { ...query, data: agents }
}
