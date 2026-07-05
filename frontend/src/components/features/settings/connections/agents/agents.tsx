'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { useApi } from '@/hooks/use-api'
import { Loader2, BarChart3, Plus } from 'lucide-react'
import { StatusAlert } from '@/components/shared/status-alert'
import { IconChip } from '@/components/shared/icon-chip'
import { AgentCard } from './agent-card'
import { AgentModal } from './agent-modal'
import { HelpDialog, HelpButton } from './help-dialog'
import type {
  Agent,
  AgentsSettings,
  AgentsResponse,
  GitRepositoriesResponse,
  GitRepository,
} from './types'
import { useConfirmDialog } from '@/hooks/use-confirm-dialog'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'

type StatusType = 'idle' | 'success' | 'error' | 'saving'

export default function AgentsSettingsForm() {
  const { apiCall } = useApi()
  const [agents, setAgents] = useState<Agent[]>([])
  const [settings, setSettings] = useState<AgentsSettings | null>(null)
  const [status, setStatus] = useState<StatusType>('idle')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [gitRepositories, setGitRepositories] = useState<GitRepository[]>([])
  const [loadingGitRepos, setLoadingGitRepos] = useState(false)

  // Confirm dialog
  const { confirmDialog, openConfirm } = useConfirmDialog()

  // Modal state
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false)

  const showMessage = useCallback((msg: string, type: 'success' | 'error') => {
    setMessage(msg)
    setStatus(type === 'success' ? 'success' : 'error')

    setTimeout(() => {
      setMessage('')
      setStatus('idle')
    }, 5000)
  }, [])

  const loadAgents = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = (await apiCall('settings/agents')) as AgentsResponse
      if (data.success && data.data) {
        setSettings(data.data)
        setAgents(data.data.agents || [])
      }
    } catch (error) {
      console.error('Error loading agents:', error)
      showMessage('Failed to load agents', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [apiCall, showMessage])

  const loadGitRepositories = useCallback(async () => {
    try {
      setLoadingGitRepos(true)
      const response = (await apiCall('git-repositories')) as GitRepositoriesResponse

      if (response.repositories) {
        // Filter for Agent category (case-insensitive)
        const agentRepos = response.repositories.filter(
          repo => repo.category.toLowerCase() === 'agent'
        )
        setGitRepositories(agentRepos)
      }
    } catch (error) {
      console.error('Error loading git repositories:', error)
      showMessage('Failed to load git repositories', 'error')
    } finally {
      setLoadingGitRepos(false)
    }
  }, [apiCall, showMessage])

  const saveAgents = useCallback(
    async (updatedAgents: Agent[]) => {
      try {
        setStatus('saving')

        // Merge with existing settings to preserve backend-required fields
        const payload: AgentsSettings = {
          deployment_method: settings?.deployment_method || 'git',
          local_root_path: settings?.local_root_path || '',
          sftp_hostname: settings?.sftp_hostname || '',
          sftp_port: settings?.sftp_port || 22,
          sftp_path: settings?.sftp_path || '',
          sftp_username: settings?.sftp_username || '',
          sftp_password: settings?.sftp_password || '',
          use_global_credentials: settings?.use_global_credentials || false,
          global_credential_id: settings?.global_credential_id || null,
          git_repository_id: settings?.git_repository_id || null,
          agents: updatedAgents,
        }

        const response = (await apiCall('settings/agents', {
          method: 'POST',
          body: JSON.stringify(payload),
        })) as AgentsResponse

        if (response.success) {
          showMessage('Agents saved successfully', 'success')
          if (response.data) {
            setSettings(response.data)
            setAgents(response.data.agents || [])
          }
        } else {
          showMessage(response.message || 'Failed to save agents', 'error')
        }
      } catch (error) {
        console.error('Error saving agents:', error)
        showMessage('Failed to save agents', 'error')
      }
    },
    [apiCall, settings, showMessage]
  )

  const handleAddAgent = useCallback(() => {
    setSelectedAgent(null)
    setIsAgentModalOpen(true)
  }, [])

  const handleEditAgent = useCallback((agent: Agent) => {
    setSelectedAgent(agent)
    setIsAgentModalOpen(true)
  }, [])

  const handleRemoveAgent = useCallback(
    (agentId: string) => {
      openConfirm({
        title: 'Remove Agent',
        description:
          'Are you sure you want to remove this agent? This action cannot be undone.',
        variant: 'destructive',
        onConfirm: () => {
          const updatedAgents = agents.filter(a => a.id !== agentId)
          setAgents(updatedAgents)
          saveAgents(updatedAgents)
        },
      })
    },
    [agents, saveAgents, openConfirm]
  )

  const handleSaveAgent = useCallback(
    (agent: Agent) => {
      let updatedAgents: Agent[]

      if (selectedAgent) {
        // Edit existing agent
        updatedAgents = agents.map(a => (a.id === agent.id ? agent : a))
      } else {
        // Add new agent
        updatedAgents = [...agents, agent]
      }

      setAgents(updatedAgents)
      saveAgents(updatedAgents)
      setIsAgentModalOpen(false)
      setSelectedAgent(null)
    },
    [agents, selectedAgent, saveAgents]
  )

  const handleCancelAgent = useCallback(() => {
    setIsAgentModalOpen(false)
    setSelectedAgent(null)
  }, [])

  useEffect(() => {
    loadAgents()
  }, [loadAgents])

  useEffect(() => {
    if (gitRepositories.length === 0) {
      loadGitRepositories()
    }
  }, [gitRepositories.length, loadGitRepositories])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <IconChip>
              <BarChart3 className="h-6 w-6" />
            </IconChip>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Agents Configuration</h1>
              <p className="text-muted-foreground mt-2">
                Configure external monitoring and observability agents
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <IconChip>
            <BarChart3 className="h-6 w-6" />
          </IconChip>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Agents Configuration</h1>
            <p className="text-muted-foreground mt-2">
              Configure external monitoring and observability agents
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton onClick={() => setIsHelpDialogOpen(true)} />
          <Button
            onClick={handleAddAgent}
            disabled={status === 'saving'}
            className="flex items-center gap-2"
          >
            {status === 'saving' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add New Agent
          </Button>
        </div>
      </div>

      {message && (
        <StatusAlert variant={status === 'success' ? 'success' : 'error'}>
          {message}
        </StatusAlert>
      )}

      {/* Agents List */}
      <div className="shadow-lg border-0 p-0 bg-card rounded-lg">
        <div className="panel-header py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="text-sm font-medium">Configured Agents</span>
          </div>
          <div className="text-xs text-panel-header-muted">
            {agents.length} agent{agents.length !== 1 ? 's' : ''} configured
          </div>
        </div>
        <div className="panel-content p-6">
          {agents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="flex justify-center mb-4">
                <IconChip className="p-4 rounded-full">
                  <BarChart3 className="h-8 w-8" />
                </IconChip>
              </div>
              <p className="text-lg font-medium">No Agents Configured</p>
              <p className="text-sm mt-1 max-w-md mx-auto text-muted-foreground">
                Get started by adding your first agent. Configure monitoring tools like
                Grafana, Telegraf, or Smokeping to keep your infrastructure observable.
              </p>
              <Button
                onClick={handleAddAgent}
                className="flex items-center gap-2 mx-auto mt-6"
              >
                <Plus className="h-4 w-4" />
                Add Your First Agent
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {agents.map(agent => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  gitRepositories={gitRepositories}
                  onEdit={handleEditAgent}
                  onRemove={handleRemoveAgent}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Agent Modal */}
      <AgentModal
        isOpen={isAgentModalOpen}
        agent={selectedAgent}
        gitRepositories={gitRepositories}
        loadingGitRepos={loadingGitRepos}
        onSave={handleSaveAgent}
        onCancel={handleCancelAgent}
      />

      {/* Help Dialog */}
      <HelpDialog
        isOpen={isHelpDialogOpen}
        onClose={() => setIsHelpDialogOpen(false)}
      />

      <ConfirmDialog {...confirmDialog} />
    </div>
  )
}
