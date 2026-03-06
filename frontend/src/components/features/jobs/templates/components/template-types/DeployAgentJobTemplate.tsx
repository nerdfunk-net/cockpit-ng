'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Rocket, Bot, RefreshCw, Plus } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { DeployTemplateEntryComponent } from './DeployTemplateEntry'
import type { DeployTemplateEntryData } from './DeployTemplateEntry'

interface Agent {
  id: string
  name: string
  description: string
  git_repository_id: number | null
  agent_id?: string
}

interface AgentsSettings {
  agents: Agent[]
}

interface AgentsResponse {
  success: boolean
  data?: AgentsSettings
  message?: string
}

interface TemplateListItem {
  id: number
  name: string
  scope: 'global' | 'private'
}

interface SavedInventory {
  id: number
  name: string
  description?: string
  scope: string
  created_by: string
}

interface DeployAgentJobTemplateProps {
  formDeployAgentId: string
  setFormDeployAgentId: (value: string) => void
  formDeployTemplateEntries: DeployTemplateEntryData[]
  setFormDeployTemplateEntries: (entries: DeployTemplateEntryData[]) => void
  formActivateAfterDeploy: boolean
  setFormActivateAfterDeploy: (value: boolean) => void
  savedInventories: SavedInventory[]
  loadingInventories: boolean
}

const EMPTY_AGENTS: Agent[] = []
const EMPTY_TEMPLATES: TemplateListItem[] = []

let nextEntryKey = 0
export function generateEntryKey(): string {
  return `entry-${++nextEntryKey}`
}

export type { DeployTemplateEntryData }

export function DeployAgentJobTemplate({
  formDeployAgentId,
  setFormDeployAgentId,
  formDeployTemplateEntries,
  setFormDeployTemplateEntries,
  formActivateAfterDeploy,
  setFormActivateAfterDeploy,
  savedInventories,
  loadingInventories,
}: DeployAgentJobTemplateProps) {
  const token = useAuthStore(state => state.token)

  // Defensive: ensure entries is always a valid array (guards against HMR/state mismatch)
  const entries = useMemo(
    () => (Array.isArray(formDeployTemplateEntries) ? formDeployTemplateEntries : []),
    [formDeployTemplateEntries]
  )
  useEffect(() => {
    if (!Array.isArray(formDeployTemplateEntries) || formDeployTemplateEntries.length === 0) {
      setFormDeployTemplateEntries([
        { _key: generateEntryKey(), templateId: null, inventoryId: null, path: '', customVariables: {} },
      ])
    }
  }, [formDeployTemplateEntries, setFormDeployTemplateEntries])

  const [agents, setAgents] = useState<Agent[]>(EMPTY_AGENTS)
  const [loadingAgents, setLoadingAgents] = useState(false)
  const [templates, setTemplates] = useState<TemplateListItem[]>(EMPTY_TEMPLATES)
  const [loadingTemplates, setLoadingTemplates] = useState(false)

  // Fetch agent templates (category=agent)
  const fetchTemplates = useCallback(async () => {
    if (!token) return
    setLoadingTemplates(true)
    try {
      const response = await fetch('/api/proxy/api/templates?category=agent', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      if (response.ok) {
        const data = await response.json()
        setTemplates(data?.templates || data || [])
      }
    } catch (error) {
      console.error('Error fetching agent templates:', error)
    } finally {
      setLoadingTemplates(false)
    }
  }, [token])

  // Fetch agents from settings
  const fetchAgents = useCallback(async () => {
    if (!token) return
    setLoadingAgents(true)
    try {
      const response = await fetch('/api/proxy/settings/agents', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      if (response.ok) {
        const data: AgentsResponse = await response.json()
        if (data.success && data.data?.agents) {
          const configuredAgents = data.data.agents.filter(a => a.git_repository_id !== null)
          setAgents(configuredAgents)
        }
      }
    } catch (error) {
      console.error('Error fetching agents:', error)
    } finally {
      setLoadingAgents(false)
    }
  }, [token])

  useEffect(() => {
    fetchTemplates()
    fetchAgents()
  }, [fetchTemplates, fetchAgents])

  const handleEntryChange = useCallback((index: number, entry: DeployTemplateEntryData) => {
    const newEntries = [...entries]
    newEntries[index] = entry
    setFormDeployTemplateEntries(newEntries)
  }, [entries, setFormDeployTemplateEntries])

  const handleEntryRemove = useCallback((index: number) => {
    const newEntries = entries.filter((_, i) => i !== index)
    setFormDeployTemplateEntries(newEntries)
  }, [entries, setFormDeployTemplateEntries])

  const handleAddEntry = useCallback(() => {
    setFormDeployTemplateEntries([
      ...entries,
      { _key: generateEntryKey(), templateId: null, inventoryId: null, path: '', customVariables: {} },
    ])
  }, [entries, setFormDeployTemplateEntries])

  return (
    <>
      {/* Panel 1: Target Agent */}
      <div className="rounded-lg border border-teal-200 bg-teal-50/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Rocket className="h-4 w-4 text-teal-600" />
          <Label className="text-sm font-semibold text-teal-900">Target Agent</Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="deploy-agent" className="text-sm text-teal-900">
            Agent <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formDeployAgentId || 'none'}
            onValueChange={(value) => setFormDeployAgentId(value === 'none' ? '' : value)}
            disabled={loadingAgents}
          >
            <SelectTrigger className="bg-white border-teal-200 focus:border-teal-400 focus:ring-teal-400">
              <SelectValue placeholder={loadingAgents ? 'Loading...' : 'Select an agent...'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No agent selected</SelectItem>
              {agents.map((a) => (
                <SelectItem
                  key={a.id}
                  value={a.agent_id || ''}
                  disabled={!a.agent_id}
                >
                  <div className="flex items-center gap-2">
                    <Bot className="h-3 w-3" />
                    {a.name}
                    {!a.agent_id && <span className="text-xs text-red-500">(no agent_id)</span>}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-teal-700">
            Agent with a Git repository configured for deployment
          </p>
        </div>
      </div>

      {/* Panel 2: Templates */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-semibold text-teal-900">Templates</Label>
            {loadingTemplates && <Loader2 className="h-3 w-3 animate-spin text-teal-500" />}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddEntry}
            className="h-7 text-xs border-teal-200 text-teal-700 hover:bg-teal-50"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Template
          </Button>
        </div>

        {entries.map((entry, idx) => (
          <DeployTemplateEntryComponent
            key={entry._key}
            index={idx}
            entry={entry}
            onChange={handleEntryChange}
            onRemove={handleEntryRemove}
            canRemove={entries.length > 1}
            templates={templates}
            savedInventories={savedInventories}
            loadingInventories={loadingInventories}
            loadingTemplates={loadingTemplates}
          />
        ))}
      </div>

      {/* Panel 3: Agent Activation */}
      <div className="rounded-lg border border-teal-200 bg-teal-50/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-teal-600" />
          <Label className="text-sm font-semibold text-teal-900">Agent Activation</Label>
        </div>
        <div className="flex items-center space-x-3">
          <Switch
            id="activate-after-deploy"
            checked={formActivateAfterDeploy}
            onCheckedChange={setFormActivateAfterDeploy}
          />
          <Label htmlFor="activate-after-deploy" className="text-sm text-teal-900 cursor-pointer">
            Activate (pull and restart) after deploying the agent
          </Label>
        </div>
        <p className="text-xs text-teal-700">
          When enabled, the agent will automatically pull the latest changes from Git and restart after deployment completes.
        </p>
      </div>
    </>
  )
}
