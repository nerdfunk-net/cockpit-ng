'use client'

import { useEffect, useState, useCallback } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, Network, Bot, Info } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'

interface CockpitAgent {
  agent_id: string
  hostname: string
  status: string
}

interface AgentListResponse {
  agents: CockpitAgent[]
}

interface SetPrimaryIpJobTemplateProps {
  formStrategy: string
  setFormStrategy: (value: string) => void
  formAgentId: string
  setFormAgentId: (value: string) => void
}

const EMPTY_AGENTS: CockpitAgent[] = []

const STRATEGY_OPTIONS = [
  { value: 'ip_reachable', label: 'IP is reachable' },
  { value: 'interface_name', label: 'Interface Name' },
]

export function SetPrimaryIpJobTemplate({
  formStrategy,
  setFormStrategy,
  formAgentId,
  setFormAgentId,
}: SetPrimaryIpJobTemplateProps) {
  const token = useAuthStore(state => state.token)
  const [agents, setAgents] = useState<CockpitAgent[]>(EMPTY_AGENTS)
  const [loadingAgents, setLoadingAgents] = useState(false)

  const fetchAgents = useCallback(async () => {
    if (!token) return
    setLoadingAgents(true)
    try {
      const response = await fetch('/api/proxy/cockpit-agent/list', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      if (response.ok) {
        const data: AgentListResponse = await response.json()
        setAgents(data?.agents ?? [])
      }
    } catch {
      // silently ignore — agent list is best-effort
    } finally {
      setLoadingAgents(false)
    }
  }, [token])

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  return (
    <div className="rounded-lg border border-cyan-200 bg-cyan-50/30 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Network className="h-4 w-4 text-cyan-600" />
        <Label className="text-sm font-semibold text-cyan-900">Set Primary IP Settings</Label>
      </div>

      {/* Strategy selector */}
      <div className="space-y-1.5">
        <Label className="text-xs text-cyan-700">
          Strategy <span className="text-red-500">*</span>
        </Label>
        <Select value={formStrategy} onValueChange={setFormStrategy}>
          <SelectTrigger className="h-9 bg-white border-cyan-200">
            <SelectValue placeholder="Select strategy…" />
          </SelectTrigger>
          <SelectContent>
            {STRATEGY_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-cyan-600">
          The criterion used to determine which IP address becomes the primary IP.
        </p>
      </div>

      {/* IP is reachable: agent selector */}
      {formStrategy === 'ip_reachable' && (
        <div className="space-y-1.5">
          <Label className="text-xs text-cyan-700">
            Cockpit Agent <span className="text-red-500">*</span>
          </Label>
          {loadingAgents ? (
            <div className="flex items-center justify-center h-9 bg-white border border-cyan-200 rounded-md">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-500" />
            </div>
          ) : (
            <Select value={formAgentId} onValueChange={setFormAgentId}>
              <SelectTrigger className="h-9 bg-white border-cyan-200">
                <SelectValue placeholder="Select agent…" />
              </SelectTrigger>
              <SelectContent>
                {agents.map(agent => (
                  <SelectItem key={agent.agent_id} value={agent.agent_id}>
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-gray-500" />
                      <span>{agent.hostname}</span>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${agent.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                      >
                        {agent.status}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <p className="text-xs text-cyan-600">
            This agent will ping all IPs of each device. The single reachable IP will be set as primary.
            Devices with multiple reachable IPs are skipped (ambiguous).
          </p>
        </div>
      )}

      {/* Interface Name: future feature note */}
      {formStrategy === 'interface_name' && (
        <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-3">
          <Info className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700">
            The <strong>Interface Name</strong> strategy will be implemented in a future release.
            You can save this template now and it will return a scaffold response when executed.
          </p>
        </div>
      )}
    </div>
  )
}
