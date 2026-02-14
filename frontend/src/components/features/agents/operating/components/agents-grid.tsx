'use client'

import { Server } from 'lucide-react'
import { AgentCard } from './agent-card'
import type { CockpitAgent } from '../types'

interface AgentsGridProps {
  agents: CockpitAgent[]
  onGitPull: (agentId: string) => void
  onDockerRestart: (agentId: string) => void
  onViewHistory: (agentId: string) => void
}

export function AgentsGrid({ agents, onGitPull, onDockerRestart, onViewHistory }: AgentsGridProps) {
  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Server className="h-12 w-12 mb-3 opacity-40" />
        <p className="text-sm font-medium">No agents registered</p>
        <p className="text-xs mt-1">Deploy a Cockpit agent to get started</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {agents.map((agent) => (
        <AgentCard
          key={agent.agent_id}
          agent={agent}
          onGitPull={onGitPull}
          onDockerRestart={onDockerRestart}
          onViewHistory={onViewHistory}
        />
      ))}
    </div>
  )
}
