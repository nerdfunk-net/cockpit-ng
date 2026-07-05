'use client'

import { useEffect, useState, useCallback } from 'react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, Network, Bot } from 'lucide-react'
import { StatusAlert } from '@/components/shared/status-alert'
import { cn } from '@/lib/utils'
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
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)
  const [agents, setAgents] = useState<CockpitAgent[]>(EMPTY_AGENTS)
  const [loadingAgents, setLoadingAgents] = useState(false)

  const fetchAgents = useCallback(async () => {
    if (!isAuthenticated) return
    setLoadingAgents(true)
    try {
      const response = await fetch('/api/proxy/cockpit-agent/list', {
        headers: {
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
  }, [isAuthenticated])

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  return (
    <div className="rounded-lg border border-info-border bg-info/30 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Network className="h-4 w-4 text-info-foreground" />
        <Label className="text-sm font-semibold text-info-foreground">
          Set Primary IP Settings
        </Label>
      </div>

      {/* Strategy selector */}
      <div className="space-y-1.5">
        <Label className="text-xs text-info-foreground">
          Strategy <span className="text-destructive">*</span>
        </Label>
        <Select value={formStrategy} onValueChange={setFormStrategy}>
          <SelectTrigger className="h-9 bg-card border-info-border">
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
        <p className="text-xs text-info-foreground">
          The criterion used to determine which IP address becomes the primary IP.
        </p>
      </div>

      {/* IP is reachable: agent selector */}
      {formStrategy === 'ip_reachable' && (
        <div className="space-y-1.5">
          <Label className="text-xs text-info-foreground">
            Cockpit Agent <span className="text-destructive">*</span>
          </Label>
          {loadingAgents ? (
            <div className="flex items-center justify-center h-9 bg-card border border-info-border rounded-md">
              <Loader2 className="h-4 w-4 animate-spin text-info-foreground" />
            </div>
          ) : (
            <Select value={formAgentId} onValueChange={setFormAgentId}>
              <SelectTrigger className="h-9 bg-card border-info-border">
                <SelectValue placeholder="Select agent…" />
              </SelectTrigger>
              <SelectContent>
                {agents.map(agent => (
                  <SelectItem key={agent.agent_id} value={agent.agent_id}>
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-muted-foreground" />
                      <span>{agent.hostname}</span>
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-xs',
                          agent.status === 'online'
                            ? 'bg-success text-success-foreground'
                            : 'bg-error text-error-foreground'
                        )}
                      >
                        {agent.status}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <p className="text-xs text-info-foreground">
            This agent will ping all IPs of each device. The single reachable IP will be
            set as primary. Devices with multiple reachable IPs are skipped (ambiguous).
          </p>
        </div>
      )}

      {/* Interface Name: future feature note */}
      {formStrategy === 'interface_name' && (
        <StatusAlert variant="warning">
          The <strong>Interface Name</strong> strategy will be implemented in a future
          release. You can save this template now and it will return a scaffold
          response when executed.
        </StatusAlert>
      )}
    </div>
  )
}
