import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Edit2, Trash2, GitBranch } from 'lucide-react'
import type { Agent, GitRepository } from './types'

interface AgentCardProps {
  agent: Agent
  gitRepositories: GitRepository[]
  onEdit: (agent: Agent) => void
  onRemove: (agentId: string) => void
}

export function AgentCard({ agent, gitRepositories, onEdit, onRemove }: AgentCardProps) {
  const gitRepo = gitRepositories.find(repo => repo.id === agent.git_repository_id)

  return (
    <div className="border-0 bg-white rounded-lg shadow-sm">
      <div className="bg-gradient-to-r from-purple-400/80 to-purple-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2 flex-1">
          <div className="flex items-center space-x-2 flex-1">
            <span className="text-sm font-medium">{agent.name}</span>
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

      <div className="p-4 bg-gradient-to-b from-white to-gray-50">
        {agent.description && (
          <p className="text-sm text-gray-600 mb-4">{agent.description}</p>
        )}

        <div className="space-y-3">
          {/* Agent ID */}
          <div className="flex items-start gap-2 text-sm">
            <span className="text-gray-500 font-medium min-w-[80px]">Agent ID:</span>
            <code className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono">
              {agent.agent_id || '(not set)'}
            </code>
          </div>

          {/* Git Repository */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <GitBranch className="h-4 w-4 text-gray-400" />
              <span className="text-gray-700 font-medium">Git Repository:</span>
            </div>
            {gitRepo ? (
              <div className="ml-6 p-3 bg-white rounded-md border border-gray-200">
                <p className="text-sm font-medium text-gray-900">{gitRepo.name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {gitRepo.url} • branch: {gitRepo.branch}
                </p>
              </div>
            ) : (
              <div className="ml-6 p-3 bg-amber-50 rounded-md border border-amber-200">
                <p className="text-sm text-amber-800">
                  <Badge variant="outline" className="border-amber-400 text-amber-700">
                    Not configured
                  </Badge>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
