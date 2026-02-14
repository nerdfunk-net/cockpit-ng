import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import type { Agent, GitRepository } from './types'

interface AgentModalProps {
  isOpen: boolean
  agent: Agent | null
  gitRepositories: GitRepository[]
  loadingGitRepos: boolean
  onSave: (agent: Agent) => void
  onCancel: () => void
}

export function AgentModal({
  isOpen,
  agent,
  gitRepositories,
  loadingGitRepos,
  onSave,
  onCancel,
}: AgentModalProps) {
  const [formData, setFormData] = useState<Agent>({
    id: '',
    agent_id: '',
    name: '',
    description: '',
    git_repository_id: null,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (agent) {
      setFormData({
        ...agent,
        agent_id: agent.agent_id || '', // Ensure agent_id is always a string
      })
    } else {
      setFormData({
        id: crypto.randomUUID(),
        agent_id: '',
        name: '',
        description: '',
        git_repository_id: null,
      })
    }
    setErrors({})
  }, [agent, isOpen])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.agent_id.trim()) {
      newErrors.agent_id = 'Agent ID is required'
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }

    if (!formData.git_repository_id) {
      newErrors.git_repository_id = 'Git repository is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = () => {
    if (validateForm()) {
      onSave(formData)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-[600px]">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-3 px-6 -mt-6 -mx-6 mb-4 rounded-t-lg">
          <DialogTitle className="text-white">{agent ? 'Edit Agent' : 'Add New Agent'}</DialogTitle>
          <DialogDescription className="text-blue-100">
            {agent
              ? 'Update the agent configuration details below.'
              : 'Configure a new agent for monitoring and observability.'}
          </DialogDescription>
        </div>

        <div className="space-y-4 py-4">
          {/* Agent ID */}
          <div className="space-y-2">
            <Label htmlFor="agent-id">
              Agent ID <span className="text-red-500">*</span>
            </Label>
            <Input
              id="agent-id"
              placeholder="e.g., grafana-01, telegraf-prod, smokeping-main"
              value={formData.agent_id}
              onChange={(e) => setFormData({ ...formData, agent_id: e.target.value })}
              className={errors.agent_id ? 'border-red-500' : ''}
            />
            {errors.agent_id && (
              <p className="text-xs text-red-500">{errors.agent_id}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Unique identifier used by the cockpit agent to register with Redis
            </p>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="agent-name">
              Agent Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="agent-name"
              placeholder="e.g., Grafana, Telegraf, Smokeping"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="agent-description">Description</Label>
            <Textarea
              id="agent-description"
              placeholder="Brief description of what this agent does..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Optional: Add details about this agent&apos;s purpose and configuration
            </p>
          </div>

          {/* Git Repository */}
          <div className="space-y-2">
            <Label htmlFor="agent-git-repo">
              Configuration Repository <span className="text-red-500">*</span>
            </Label>
            {loadingGitRepos ? (
              <div className="flex items-center space-x-2 p-3 border border-gray-300 rounded-md bg-gray-50">
                <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
                <span className="text-sm text-gray-600">Loading repositories...</span>
              </div>
            ) : gitRepositories.length > 0 ? (
              <>
                <Select
                  value={formData.git_repository_id?.toString() || ''}
                  onValueChange={(value) =>
                    setFormData({ ...formData, git_repository_id: parseInt(value) || null })
                  }
                >
                  <SelectTrigger
                    id="agent-git-repo"
                    className={`h-auto min-h-[44px] ${errors.git_repository_id ? 'border-red-500' : ''}`}
                  >
                    <SelectValue placeholder="Select a repository" />
                  </SelectTrigger>
                  <SelectContent className="max-w-[550px]">
                    {gitRepositories.map((repo) => (
                      <SelectItem 
                        key={repo.id} 
                        value={repo.id.toString()} 
                        className="cursor-pointer focus:bg-blue-50 focus:text-gray-900"
                      >
                        <div className="flex flex-col py-1">
                          <span className="font-medium">{repo.name}</span>
                          <span className="text-xs text-muted-foreground mt-0.5">
                            {repo.url} • branch: {repo.branch}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.git_repository_id && (
                  <p className="text-xs text-red-500">{errors.git_repository_id}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Only repositories with category &quot;Agent&quot; are shown
                </p>
              </>
            ) : (
              <div className="p-4 border border-amber-200 rounded-md bg-amber-50">
                <p className="text-sm text-amber-800">
                  <strong>No repositories found.</strong> Please add an Agent repository in
                  Settings → Git Management.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>{agent ? 'Save Changes' : 'Add Agent'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
