import { Card } from '@/components/ui/card'
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
    <Card className="border-gray-200 hover:border-blue-300 transition-colors">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{agent.name}</h3>
            {agent.description && (
              <p className="text-sm text-gray-600 mb-3">{agent.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(agent)}
              className="h-8 w-8 p-0"
              title="Edit agent"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(agent.id)}
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
              title="Remove agent"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <GitBranch className="h-4 w-4 text-gray-400" />
            <span className="text-gray-700 font-medium">Git Repository:</span>
          </div>
          {gitRepo ? (
            <div className="ml-6 p-3 bg-gray-50 rounded-md border border-gray-200">
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
    </Card>
  )
}
