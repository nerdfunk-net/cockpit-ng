import { useState, useEffect, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'

export interface Agent {
  id: string
  agent_id?: string
  name: string
  description: string
  git_repository_id: number | null
}

interface AgentsSettings {
  agents: Agent[]
}

interface AgentsResponse {
  success: boolean
  data?: AgentsSettings
  message?: string
}

const EMPTY_AGENTS: Agent[] = []

export function useAgentSelector() {
  const [agents, setAgents] = useState<Agent[]>(EMPTY_AGENTS)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const { apiCall } = useApi()

  useEffect(() => {
    const loadAgents = async () => {
      try {
        const response = await apiCall<AgentsResponse>('settings/agents')
        if (response.success && response.data?.agents) {
          const configuredAgents = response.data.agents
          setAgents(configuredAgents)

          // Auto-select first agent if available and has agent_id configured
          if (configuredAgents.length > 0 && configuredAgents[0]) {
            const firstAgent = configuredAgents[0]
            if (firstAgent.agent_id) {
              setSelectedAgentId(firstAgent.agent_id)
            }
          }
        }
      } catch (error) {
        console.error('Failed to load agents:', error)
      } finally {
        setLoading(false)
      }
    }

    loadAgents()
  }, [apiCall])

  const selectedAgent = useMemo(
    () => agents.find(a => a.agent_id === selectedAgentId) || null,
    [agents, selectedAgentId]
  )

  return useMemo(() => ({
    agents,
    selectedAgentId,
    selectedAgent,
    setSelectedAgentId,
    loading
  }), [agents, selectedAgentId, selectedAgent, loading])
}
