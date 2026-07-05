import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/status-badge'
import { Edit2, GitBranch, KeyRound, Trash2 } from 'lucide-react'
import type { Agent, AgentType, GitRepository } from './types'

// All agent types share the same translucent badge treatment on the panel
// header; the label text (not color) distinguishes the type.
const TYPE_BADGE_CLASS =
  'bg-panel-header-foreground/20 text-panel-header-foreground border-panel-header-foreground/30'

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
    <div className="border-0 bg-card rounded-lg shadow-sm">
      <div className="panel-header py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center gap-2 flex-1">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm font-medium">{agent.name}</span>
            <Badge variant="outline" className={`text-xs px-1.5 py-0 ${TYPE_BADGE_CLASS}`}>
              {TYPE_LABELS[agentType]}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(agent)}
            className="h-7 w-7 p-0 hover:bg-panel-header-foreground/20"
            title="Edit agent"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(agent.id)}
            className="h-7 w-7 p-0 hover:bg-destructive/20"
            title="Remove agent"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="panel-content p-6">
        {agent.description && (
          <p className="text-sm text-muted-foreground mb-4">{agent.description}</p>
        )}

        <div className="space-y-4">
          {/* Agent ID */}
          <div className="flex items-start gap-2 text-sm">
            <span className="text-muted-foreground font-medium min-w-[80px]">Agent ID:</span>
            <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">
              {agent.agent_id || '(not set)'}
            </code>
          </div>

          {/* Shared secret status (all agent types) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <KeyRound className="h-4 w-4 text-primary" />
              <span className="font-medium">Shared Secret:</span>
            </div>
            <div className="ml-6">
              {agent.shared_secret ? (
                <StatusBadge variant="success">Configured</StatusBadge>
              ) : (
                <StatusBadge variant="warning">Not configured</StatusBadge>
              )}
            </div>
          </div>

          {/* Git repository (non-netmiko agent types) */}
          {agentType !== 'netmiko' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <GitBranch className="h-4 w-4 text-primary" />
                <span className="font-medium">Git Repository:</span>
              </div>
              {gitRepo ? (
                <div className="ml-6 p-3 bg-info rounded-md border border-info-border">
                  <p className="text-sm font-medium text-foreground">{gitRepo.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {gitRepo.url} • branch: {gitRepo.branch}
                  </p>
                </div>
              ) : (
                <div className="ml-6 p-3 bg-warning rounded-md border border-warning-border">
                  <StatusBadge variant="warning">Not configured</StatusBadge>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
