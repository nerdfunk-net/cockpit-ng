import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Edit2, GitBranch, KeyRound, Trash2 } from 'lucide-react'
import type { Agent, AgentType, GitRepository } from './types'

const TYPE_BADGE_CLASSES: Record<AgentType, string> = {
  generic: 'bg-white/20 text-white border-white/30',
  'git-based': 'bg-blue-600/80 text-white border-blue-400/50',
  ansible: 'bg-amber-500/80 text-white border-amber-400/50',
  netmiko: 'bg-emerald-500/80 text-white border-emerald-400/50',
  nmap: 'bg-violet-500/80 text-white border-violet-400/50',
}

const TYPE_LABELS: Record<AgentType, string> = {
  generic: 'Generic',
  'git-based': 'Git-based',
  ansible: 'Ansible',
  netmiko: 'Netmiko',
  nmap: 'Nmap',
}

interface AgentCardProps {
  agent: Agent
  gitRepositories: GitRepository[]
  onEdit: (agent: Agent) => void
  onRemove: (agentId: string) => void
}

export function AgentCard({
  agent,
  gitRepositories,
  onEdit,
  onRemove,
}: AgentCardProps) {
  const gitRepo = gitRepositories.find(repo => repo.id === agent.git_repository_id)
  const agentType = agent.type ?? 'generic'

  return (
    <div className="border-0 bg-white rounded-lg shadow-sm">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center gap-2 flex-1">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm font-medium">{agent.name}</span>
            <Badge
              variant="outline"
              className={`text-xs px-1.5 py-0 ${TYPE_BADGE_CLASSES[agentType]}`}
            >
              {TYPE_LABELS[agentType]}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(agent)}
            className="h-7 w-7 p-0 hover:bg-white/20"
            title="Edit agent"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(agent.id)}
            className="h-7 w-7 p-0 hover:bg-red-500/20"
            title="Remove agent"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="p-6 bg-gradient-to-b from-white to-gray-50">
        {agent.description && (
          <p className="text-sm text-muted-foreground mb-4">{agent.description}</p>
        )}

        <div className="space-y-4">
          {/* Agent ID */}
          <div className="flex items-start gap-2 text-sm">
            <span className="text-muted-foreground font-medium min-w-[80px]">Agent ID:</span>
            <code className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono">
              {agent.agent_id || '(not set)'}
            </code>
          </div>

          {/* Shared secret status (all agent types) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <KeyRound className="h-4 w-4 text-blue-600" />
              <span className="font-medium">Shared Secret:</span>
            </div>
            <div className="ml-6">
              {agent.shared_secret ? (
                <Badge className="bg-green-100 text-green-800 border-green-300">
                  Configured
                </Badge>
              ) : (
                <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                  Not configured
                </Badge>
              )}
            </div>
          </div>

          {/* Git repository (non-netmiko agent types) */}
          {agentType !== 'netmiko' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <GitBranch className="h-4 w-4 text-blue-600" />
                <span className="font-medium">Git Repository:</span>
              </div>
              {gitRepo ? (
                <div className="ml-6 p-3 bg-blue-50 rounded-md border border-blue-200">
                  <p className="text-sm font-medium text-slate-900">{gitRepo.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {gitRepo.url} • branch: {gitRepo.branch}
                  </p>
                </div>
              ) : (
                <div className="ml-6 p-3 bg-amber-50 rounded-md border border-amber-200">
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                    Not configured
                  </Badge>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
