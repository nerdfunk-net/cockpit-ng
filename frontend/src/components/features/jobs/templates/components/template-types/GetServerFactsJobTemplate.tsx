'use client'

import { useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Network, Bot, Plus, X } from 'lucide-react'
import { generateEntryKey } from './DeployAgentJobTemplate'

export interface FactsPrefixEntry {
  _key: string
  value: string
}

interface CockpitAgent {
  agent_id: string
  hostname: string
  status: string
}

interface GetServerFactsJobTemplateProps {
  formFactsPrefixEntries: FactsPrefixEntry[]
  setFormFactsPrefixEntries: (entries: FactsPrefixEntry[]) => void
  formFactsAgentId: string
  setFormFactsAgentId: (value: string) => void
  ansibleAgents: CockpitAgent[]
  loadingAgents: boolean
}

export function GetServerFactsJobTemplate({
  formFactsPrefixEntries,
  setFormFactsPrefixEntries,
  formFactsAgentId,
  setFormFactsAgentId,
  ansibleAgents,
  loadingAgents,
}: GetServerFactsJobTemplateProps) {
  // Auto-select the sole Ansible agent when exactly one is configured
  useEffect(() => {
    if (ansibleAgents.length === 1 && ansibleAgents[0]?.agent_id && !formFactsAgentId) {
      setFormFactsAgentId(ansibleAgents[0].agent_id)
    }
  }, [ansibleAgents, formFactsAgentId, setFormFactsAgentId])

  const handlePrefixChange = (index: number, value: string) => {
    const current = formFactsPrefixEntries[index]
    if (!current) return
    const newEntries = [...formFactsPrefixEntries]
    newEntries[index] = { _key: current._key, value }
    setFormFactsPrefixEntries(newEntries)
  }

  const handlePrefixRemove = (index: number) => {
    setFormFactsPrefixEntries(formFactsPrefixEntries.filter((_, i) => i !== index))
  }

  const handlePrefixAdd = () => {
    setFormFactsPrefixEntries([
      ...formFactsPrefixEntries,
      { _key: generateEntryKey(), value: '' },
    ])
  }

  return (
    <div className="rounded-lg border border-info-border bg-info/30 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-info-foreground" />
          <Label className="text-sm font-semibold text-info-foreground">IP Prefixes</Label>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handlePrefixAdd}
          className="h-7 text-xs border-info-border text-info-foreground hover:bg-info"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Prefix
        </Button>
      </div>

      <div className="space-y-2">
        {formFactsPrefixEntries.map((entry, idx) => (
          <div key={entry._key} className="flex items-center gap-2">
            <Input
              value={entry.value}
              onChange={e => handlePrefixChange(idx, e.target.value)}
              placeholder="192.168.178.0/24"
              className="bg-card border-info-border focus:border-primary focus:ring-ring/30"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handlePrefixRemove(idx)}
              disabled={formFactsPrefixEntries.length <= 1}
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive hover:bg-error"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <p className="text-xs text-info-foreground">
        Prefixes to scan in CIDR notation, e.g. 192.168.178.0/24. Each prefix is pinged
        to find reachable hosts before attempting to gather facts.
      </p>

      <div className="space-y-1.5 pt-2 border-t border-info-border">
        <Label className="text-xs text-info-foreground">
          Ansible Agent <span className="text-destructive">*</span>
        </Label>
        {loadingAgents ? (
          <div className="flex items-center justify-center h-9 bg-card border border-info-border rounded-md">
            <Loader2 className="h-4 w-4 animate-spin text-info-foreground" />
          </div>
        ) : (
          <Select value={formFactsAgentId} onValueChange={setFormFactsAgentId}>
            <SelectTrigger className="h-9 bg-card border-info-border">
              <SelectValue placeholder="Select an Ansible agent…" />
            </SelectTrigger>
            <SelectContent>
              {ansibleAgents.map(agent => (
                <SelectItem key={agent.agent_id} value={agent.agent_id}>
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                    <span>{agent.hostname}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <p className="text-xs text-info-foreground">
          Only agents of type &quot;Ansible&quot; are shown. The agent logs into each
          reachable host and gathers Ansible facts.
        </p>
      </div>
    </div>
  )
}
