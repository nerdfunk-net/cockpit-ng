'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Rocket, FileCode, Bot, RefreshCw } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'

interface TemplateVariable {
  value: string
  type: 'custom' | 'inventory'
  metadata: Record<string, unknown>
}

interface TemplateListItem {
  id: number
  name: string
  scope: 'global' | 'private'
}

interface TemplateDetail {
  id: number
  name: string
  file_path?: string
  variables?: Record<string, TemplateVariable>
}

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

interface DeployAgentJobTemplateProps {
  formDeployTemplateId: number | null
  setFormDeployTemplateId: (value: number | null) => void
  formDeployAgentId: string
  setFormDeployAgentId: (value: string) => void
  formDeployPath: string
  setFormDeployPath: (value: string) => void
  formDeployCustomVariables: Record<string, string>
  setFormDeployCustomVariables: (value: Record<string, string>) => void
  formActivateAfterDeploy: boolean
  setFormActivateAfterDeploy: (value: boolean) => void
}

const EMPTY_TEMPLATES: TemplateListItem[] = []
const EMPTY_AGENTS: Agent[] = []

export function DeployAgentJobTemplate({
  formDeployTemplateId,
  setFormDeployTemplateId,
  formDeployAgentId,
  setFormDeployAgentId,
  formDeployPath,
  setFormDeployPath,
  formDeployCustomVariables,
  setFormDeployCustomVariables,
  formActivateAfterDeploy,
  setFormActivateAfterDeploy,
}: DeployAgentJobTemplateProps) {
  const token = useAuthStore(state => state.token)

  const [templates, setTemplates] = useState<TemplateListItem[]>(EMPTY_TEMPLATES)
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [selectedTemplateDetail, setSelectedTemplateDetail] = useState<TemplateDetail | null>(null)
  const [loadingTemplateDetail, setLoadingTemplateDetail] = useState(false)
  const [agents, setAgents] = useState<Agent[]>(EMPTY_AGENTS)
  const [loadingAgents, setLoadingAgents] = useState(false)

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
          // Only show agents with a git repository configured
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

  // Fetch template detail when selection changes
  const fetchTemplateDetail = useCallback(async (templateId: number) => {
    if (!token) return
    setLoadingTemplateDetail(true)
    try {
      const response = await fetch(`/api/proxy/api/templates/${templateId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      if (response.ok) {
        const data = await response.json()
        setSelectedTemplateDetail(data)

        // Set default path from template if not already set
        if (data.file_path && !formDeployPath) {
          setFormDeployPath(data.file_path)
        }
      }
    } catch (error) {
      console.error('Error fetching template detail:', error)
    } finally {
      setLoadingTemplateDetail(false)
    }
  }, [token, formDeployPath, setFormDeployPath])

  useEffect(() => {
    if (formDeployTemplateId) {
      fetchTemplateDetail(formDeployTemplateId)
    } else {
      setSelectedTemplateDetail(null)
    }
  }, [formDeployTemplateId, fetchTemplateDetail])

  // Extract custom variables from the selected template
  const customVariables = useMemo(() => {
    if (!selectedTemplateDetail?.variables) return []
    return Object.entries(selectedTemplateDetail.variables)
      .filter(([, variable]) => variable.type === 'custom')
      .map(([name, variable]) => ({
        name,
        defaultValue: variable.value,
        currentValue: formDeployCustomVariables[name] ?? variable.value,
      }))
  }, [selectedTemplateDetail, formDeployCustomVariables])

  const handleTemplateChange = useCallback((value: string) => {
    if (value === 'none') {
      setFormDeployTemplateId(null)
      setFormDeployPath('')
      setFormDeployCustomVariables({})
    } else {
      setFormDeployTemplateId(parseInt(value))
      // Reset custom variables when template changes
      setFormDeployCustomVariables({})
    }
  }, [setFormDeployTemplateId, setFormDeployPath, setFormDeployCustomVariables])

  const handleVariableChange = useCallback((name: string, value: string) => {
    setFormDeployCustomVariables({
      ...formDeployCustomVariables,
      [name]: value,
    })
  }, [formDeployCustomVariables, setFormDeployCustomVariables])

  return (
    <>
      {/* Template & Agent Selection */}
      <div className="rounded-lg border border-teal-200 bg-teal-50/30 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Rocket className="h-4 w-4 text-teal-600" />
          <Label className="text-sm font-semibold text-teal-900">Deploy Agent Configuration</Label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Template Selector */}
          <div className="space-y-2">
            <Label htmlFor="deploy-template" className="text-sm text-teal-900">
              Agent Template <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formDeployTemplateId?.toString() || 'none'}
              onValueChange={handleTemplateChange}
              disabled={loadingTemplates}
            >
              <SelectTrigger className="bg-white border-teal-200 focus:border-teal-400 focus:ring-teal-400">
                <SelectValue placeholder={loadingTemplates ? 'Loading...' : 'Select an agent template...'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No template selected</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id.toString()}>
                    {t.name} ({t.scope})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-teal-700">
              Select a Jinja2 template (category: agent) to render and deploy
            </p>
          </div>

          {/* Agent Selector */}
          <div className="space-y-2">
            <Label htmlFor="deploy-agent" className="text-sm text-teal-900">
              Target Agent <span className="text-red-500">*</span>
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

        {/* Path Input */}
        <div className="space-y-2">
          <Label htmlFor="deploy-path" className="text-sm text-teal-900">
            <div className="flex items-center gap-2">
              <FileCode className="h-3.5 w-3.5" />
              Deployment Path
            </div>
          </Label>
          <Input
            id="deploy-path"
            type="text"
            value={formDeployPath}
            onChange={(e) => setFormDeployPath(e.target.value)}
            placeholder="e.g., configs/telegraf.conf"
            className="bg-white border-teal-200 focus:border-teal-400 focus:ring-teal-400"
          />
          <p className="text-xs text-teal-700">
            File path relative to the Git repository root. Defaults to the template&apos;s file_path if not set.
          </p>
        </div>
      </div>

      {/* Loading template detail */}
      {loadingTemplateDetail && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-teal-500" />
          <span className="ml-2 text-sm text-gray-600">Loading template details...</span>
        </div>
      )}

      {/* Custom Variables Section */}
      {!loadingTemplateDetail && selectedTemplateDetail && customVariables.length > 0 && (
        <div className="rounded-lg border border-teal-200 bg-teal-50/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FileCode className="h-4 w-4 text-teal-600" />
            <Label className="text-sm font-semibold text-teal-900">Template Variables</Label>
          </div>
          <p className="text-xs text-teal-700">
            Override custom variable values for this deployment. At execution time, the latest template variables will be merged with these overrides.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {customVariables.map(({ name, defaultValue, currentValue }) => (
              <div key={name} className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`deploy-var-${name}`} className="text-sm font-medium text-teal-900">
                    {name}
                  </Label>
                  <span className="text-xs text-teal-600">
                    Default: {defaultValue}
                  </span>
                </div>
                <Input
                  id={`deploy-var-${name}`}
                  value={currentValue}
                  onChange={(e) => handleVariableChange(name, e.target.value)}
                  placeholder={`Override value for ${name}`}
                  className="bg-white border-teal-200 focus:border-teal-400 focus:ring-teal-400"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No variables info */}
      {!loadingTemplateDetail && selectedTemplateDetail && customVariables.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50/30 p-3">
          <p className="text-xs text-gray-600">
            This template has no custom variables to override.
          </p>
        </div>
      )}

      {/* Activate After Deploy */}
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
          <span className="text-orange-600 font-medium"> (Feature not yet implemented)</span>
        </p>
      </div>
    </>
  )
}
