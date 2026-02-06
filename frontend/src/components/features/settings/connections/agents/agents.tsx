'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useApi } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import { Loader2, CheckCircle, XCircle, BarChart3, Plus } from 'lucide-react'
import { AgentCard } from './agent-card'
import { AgentModal } from './agent-modal'
import { HelpDialog, HelpButton } from './help-dialog'
import type { Agent, AgentsResponse, GitRepositoriesResponse, GitRepository } from './types'

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
      const data = await apiCall('settings/agents') as AgentsResponse
      console.log('Loaded agents data:', data)
      if (data.success && data.data) {
        console.log('Setting agents:', data.data.agents)
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
      const response = await apiCall('git-repositories') as GitRepositoriesResponse

      if (response.repositories) {
        // Filter for Cockpit Configs category (case-insensitive)
        const cockpitRepos = response.repositories.filter(repo =>
          repo.category.toLowerCase() === 'cockpit_configs'
        )
        setGitRepositories(cockpitRepos)
      }
    } catch (error) {
      console.error('Error loading git repositories:', error)
      showMessage('Failed to load git repositories', 'error')
    } finally {
      setLoadingGitRepos(false)
    }
  }, [apiCall, showMessage])

  const saveAgents = useCallback(async (updatedAgents: Agent[]) => {
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

      console.log('Saving agents payload:', payload)

      const response = await apiCall('settings/agents', {
        method: 'POST',
        body: JSON.stringify(payload),
      }) as AgentsResponse

      console.log('Save response:', response)

      if (response.success) {
        showMessage('Agents saved successfully', 'success')
        if (response.data) {
          console.log('Updating agents from response:', response.data.agents)
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
  }, [apiCall, settings, showMessage])

  const handleAddAgent = useCallback(() => {
    setSelectedAgent(null)
    setIsAgentModalOpen(true)
  }, [])

  const handleEditAgent = useCallback((agent: Agent) => {
    setSelectedAgent(agent)
    setIsAgentModalOpen(true)
  }, [])

  const handleRemoveAgent = useCallback((agentId: string) => {
    if (!confirm('Are you sure you want to remove this agent? This action cannot be undone.')) {
      return
    }

    const updatedAgents = agents.filter(a => a.id !== agentId)
    setAgents(updatedAgents)
    saveAgents(updatedAgents)
  }, [agents, saveAgents])

  const handleSaveAgent = useCallback((agent: Agent) => {
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
  }, [agents, selectedAgent, saveAgents])

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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-3 rounded-lg">
            <BarChart3 className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Agents Configuration</h1>
            <p className="text-muted-foreground">
              Configure external monitoring and observability agents
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton onClick={() => setIsHelpDialogOpen(true)} />
          <Button onClick={handleAddAgent} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add New Agent
          </Button>
        </div>
      </div>

      {message && (
        <div
          className={cn(
            'flex items-center gap-2 p-4 rounded-md',
            status === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          )}
        >
          {status === 'success' ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <XCircle className="h-5 w-5" />
          )}
          <span>{message}</span>
        </div>
      )}

      {/* Agents List */}
      {agents.length === 0 ? (
        <Card className="border-gray-200">
          <div className="p-12 text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-gray-100 p-4 rounded-full">
                <BarChart3 className="h-8 w-8 text-gray-400" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Agents Configured</h3>
            <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
              Get started by adding your first agent. Configure monitoring tools like Grafana, Telegraf,
              or Smokeping to keep your infrastructure observable.
            </p>
            <Button onClick={handleAddAgent} className="flex items-center gap-2 mx-auto">
              <Plus className="h-4 w-4" />
              Add Your First Agent
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {agents.map((agent) => (
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
      <HelpDialog isOpen={isHelpDialogOpen} onClose={() => setIsHelpDialogOpen(false)} />
    </div>
  )
}
