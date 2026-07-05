import { useState, useEffect, useCallback } from 'react'
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
import { Eye, EyeOff, Loader2, RefreshCw } from 'lucide-react'
import type { Agent, AgentType, GitRepository } from './types'

const AGENT_TYPE_LABELS: Record<AgentType, string> = {
  generic: 'Generic',
  'git-based': 'Git-based',
  ansible: 'Ansible',
  netmiko: 'Netmiko',
  nmap: 'Nmap',
}

interface AgentModalProps {
  isOpen: boolean
  agent: Agent | null
  gitRepositories: GitRepository[]
  loadingGitRepos: boolean
  onSave: (agent: Agent) => void
  onCancel: () => void
}

const EMPTY_FORM: Agent = {
  id: '',
  agent_id: '',
  name: '',
  description: '',
  type: 'generic',
  git_repository_id: null,
  shared_secret: '',
}

function generateSecret(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export function AgentModal({
  isOpen,
  agent,
  gitRepositories,
  loadingGitRepos,
  onSave,
  onCancel,
}: AgentModalProps) {
  const [formData, setFormData] = useState<Agent>(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showSecret, setShowSecret] = useState(false)

  useEffect(() => {
    if (agent) {
      setFormData({
        ...agent,
        agent_id: agent.agent_id || '',
        type: agent.type ?? 'generic',
        shared_secret: agent.shared_secret || '',
      })
    } else {
      setFormData({
        ...EMPTY_FORM,
        id: crypto.randomUUID(),
      })
    }
    setErrors({})
    setShowSecret(false)
  }, [agent, isOpen])

  const isGitRepoRequired = formData.type === 'git-based'
  const isNetmiko = formData.type === 'netmiko'

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.agent_id?.trim()) {
      newErrors.agent_id = 'Agent ID is required'
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }

    if (isGitRepoRequired && !formData.git_repository_id) {
      newErrors.git_repository_id = 'Git repository is required for git-based agents'
    }

    if (!formData.shared_secret?.trim()) {
      newErrors.shared_secret = 'Shared secret is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleTypeChange = useCallback((value: AgentType) => {
    setFormData(prev => ({
      ...prev,
      type: value,
      git_repository_id: value === 'netmiko' ? null : prev.git_repository_id,
    }))
    setErrors(prev => ({
      ...prev,
      git_repository_id: '',
      shared_secret: '',
    }))
  }, [])

  const handleGenerateSecret = useCallback(() => {
    setFormData(prev => ({ ...prev, shared_secret: generateSecret() }))
    if (errors.shared_secret) {
      setErrors(prev => ({ ...prev, shared_secret: '' }))
    }
  }, [errors.shared_secret])

  const handleSave = () => {
    if (validateForm()) {
      onSave(formData)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onCancel()}>
      <DialogContent className="sm:max-w-[600px]">
        <div className="panel-header py-2 px-4 -mt-6 -mx-6 mb-4 rounded-t-lg">
          <DialogTitle>
            {agent ? 'Edit Agent' : 'Add New Agent'}
          </DialogTitle>
          <DialogDescription className="text-panel-header-muted">
            {agent
              ? 'Update the agent configuration details below.'
              : 'Configure a new agent for monitoring and observability.'}
          </DialogDescription>
        </div>

        <div className="space-y-4 py-4">
          {/* Agent ID */}
          <div className="space-y-2">
            <Label htmlFor="agent-id">
              Agent ID <span className="text-destructive">*</span>
            </Label>
            <Input
              id="agent-id"
              placeholder="e.g., grafana-01, telegraf-prod, netmiko-probe-01"
              value={formData.agent_id}
              onChange={e => setFormData({ ...formData, agent_id: e.target.value })}
              className={errors.agent_id ? 'border-destructive' : ''}
            />
            {errors.agent_id && (
              <p className="text-xs text-destructive">{errors.agent_id}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Unique identifier used by the cockpit agent to register with Redis
            </p>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="agent-name">
              Agent Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="agent-name"
              placeholder="e.g., Grafana, Telegraf, Netmiko Probe"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="agent-description">Description</Label>
            <Textarea
              id="agent-description"
              placeholder="Brief description of what this agent does..."
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Optional: Add details about this agent&apos;s purpose and configuration
            </p>
          </div>

          {/* Agent Type */}
          <div className="space-y-2">
            <Label htmlFor="agent-type">
              Agent Type <span className="text-destructive">*</span>
            </Label>
            <Select value={formData.type} onValueChange={handleTypeChange}>
              <SelectTrigger id="agent-type">
                <SelectValue placeholder="Select agent type" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(AGENT_TYPE_LABELS) as AgentType[]).map(t => (
                  <SelectItem key={t} value={t}>
                    {AGENT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {formData.type === 'git-based'
                ? 'Git-based agents deploy configuration from a Git repository (required).'
                : formData.type === 'ansible'
                  ? 'Ansible agents run playbooks, optionally sourced from a Git repository.'
                  : formData.type === 'nmap'
                    ? 'Nmap agents run port scans from their network position, optionally sourced from a Git repository.'
                    : formData.type === 'netmiko'
                      ? 'Netmiko agents connect directly to network devices via SSH from an isolated network segment.'
                      : 'Generic agents can optionally use a Git repository for configuration.'}
            </p>
          </div>

          {/* Shared Secret (all agent types) */}
          <div className="space-y-2">
            <Label htmlFor="agent-shared-secret">
              Shared Secret <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="agent-shared-secret"
                  type={showSecret ? 'text' : 'password'}
                  placeholder="64-character hex secret"
                  value={formData.shared_secret || ''}
                  onChange={e =>
                    setFormData({ ...formData, shared_secret: e.target.value })
                  }
                  className={`pr-10 font-mono text-sm ${errors.shared_secret ? 'border-destructive' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showSecret ? 'Hide secret' : 'Show secret'}
                >
                  {showSecret ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGenerateSecret}
                className="shrink-0 gap-1.5"
                title="Generate a random secret"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Generate
              </Button>
            </div>
            {errors.shared_secret && (
              <p className="text-xs text-destructive">{errors.shared_secret}</p>
            )}
            <p className="text-xs text-muted-foreground">
              This value must match{' '}
              <code className="bg-muted px-1 rounded">COCKPIT_SHARED_SECRET</code>{' '}
              in the agent&apos;s <code className="bg-muted px-1 rounded">.env</code>{' '}
              file. Used to sign and authenticate all Redis messages.
            </p>
          </div>

          {/* Git Repository (hidden for netmiko agents) */}
          {!isNetmiko && (
            <div className="space-y-2">
              <Label htmlFor="agent-git-repo">
                Configuration Repository{' '}
                {isGitRepoRequired && <span className="text-destructive">*</span>}
              </Label>
              {loadingGitRepos ? (
                <div className="flex items-center gap-2 p-3 border border-info-border rounded-md bg-info">
                  <Loader2 className="h-4 w-4 animate-spin text-info-foreground" />
                  <span className="text-sm text-info-foreground">Loading repositories...</span>
                </div>
              ) : gitRepositories.length > 0 ? (
                <>
                  <Select
                    value={formData.git_repository_id?.toString() || ''}
                    onValueChange={value =>
                      setFormData({
                        ...formData,
                        git_repository_id: parseInt(value) || null,
                      })
                    }
                  >
                    <SelectTrigger
                      id="agent-git-repo"
                      className={`h-auto min-h-[44px] ${errors.git_repository_id ? 'border-destructive' : ''}`}
                    >
                      <SelectValue
                        placeholder={
                          isGitRepoRequired
                            ? 'Select a repository'
                            : 'Select a repository (optional)'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="max-w-[550px]">
                      {gitRepositories.map(repo => (
                        <SelectItem
                          key={repo.id}
                          value={repo.id.toString()}
                          className="cursor-pointer"
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
                    <p className="text-xs text-destructive">{errors.git_repository_id}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {isGitRepoRequired
                      ? 'Required for git-based agents. Only repositories with category "Agent" are shown.'
                      : 'Optional. Only repositories with category "Agent" are shown.'}
                  </p>
                </>
              ) : (
                <div className="p-4 border border-warning-border rounded-md bg-warning">
                  <p className="text-sm text-warning-foreground">
                    <strong>No repositories found.</strong> Please add an Agent repository
                    in Settings → Git Management.
                  </p>
                </div>
              )}
            </div>
          )}
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
