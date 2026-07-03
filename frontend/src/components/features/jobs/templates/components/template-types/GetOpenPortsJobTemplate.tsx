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

export interface OpenPortsPrefixEntry {
  _key: string
  value: string
}

interface CockpitAgent {
  agent_id: string
  hostname: string
  status: string
}

interface GetOpenPortsJobTemplateProps {
  formOpenPortsPrefixEntries: OpenPortsPrefixEntry[]
  setFormOpenPortsPrefixEntries: (entries: OpenPortsPrefixEntry[]) => void
  formOpenPortsAgentId: string
  setFormOpenPortsAgentId: (value: string) => void
  ansibleAgents: CockpitAgent[]
  loadingAgents: boolean
}

export function GetOpenPortsJobTemplate({
  formOpenPortsPrefixEntries,
  setFormOpenPortsPrefixEntries,
  formOpenPortsAgentId,
  setFormOpenPortsAgentId,
  ansibleAgents,
  loadingAgents,
}: GetOpenPortsJobTemplateProps) {
  // Auto-select the sole Ansible agent when exactly one is configured
  useEffect(() => {
    if (
      ansibleAgents.length === 1 &&
      ansibleAgents[0]?.agent_id &&
      !formOpenPortsAgentId
    ) {
      setFormOpenPortsAgentId(ansibleAgents[0].agent_id)
    }
  }, [ansibleAgents, formOpenPortsAgentId, setFormOpenPortsAgentId])

  const handlePrefixChange = (index: number, value: string) => {
    const current = formOpenPortsPrefixEntries[index]
    if (!current) return
    const newEntries = [...formOpenPortsPrefixEntries]
    newEntries[index] = { _key: current._key, value }
    setFormOpenPortsPrefixEntries(newEntries)
  }

  const handlePrefixRemove = (index: number) => {
    setFormOpenPortsPrefixEntries(
      formOpenPortsPrefixEntries.filter((_, i) => i !== index)
    )
  }

  const handlePrefixAdd = () => {
    setFormOpenPortsPrefixEntries([
      ...formOpenPortsPrefixEntries,
      { _key: generateEntryKey(), value: '' },
    ])
  }

  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50/30 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-rose-600" />
          <Label className="text-sm font-semibold text-rose-900">IP Prefixes</Label>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handlePrefixAdd}
          className="h-7 text-xs border-rose-200 text-rose-700 hover:bg-rose-50"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Prefix
        </Button>
      </div>

      <div className="space-y-2">
        {formOpenPortsPrefixEntries.map((entry, idx) => (
          <div key={entry._key} className="flex items-center gap-2">
            <Input
              value={entry.value}
              onChange={e => handlePrefixChange(idx, e.target.value)}
              placeholder="192.168.178.0/24"
              className="bg-white border-rose-200 focus:border-rose-400 focus:ring-rose-400"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handlePrefixRemove(idx)}
              disabled={formOpenPortsPrefixEntries.length <= 1}
              className="h-9 w-9 shrink-0 text-rose-500 hover:text-red-600 hover:bg-red-50"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <p className="text-xs text-rose-700">
        Prefixes to scan in CIDR notation, e.g. 192.168.178.0/24. Each prefix is pinged
        to find reachable hosts before scanning for open TCP/UDP ports.
      </p>

      <div className="space-y-1.5 pt-2 border-t border-rose-200">
        <Label className="text-xs text-rose-700">
          Ansible Agent <span className="text-red-500">*</span>
        </Label>
        {loadingAgents ? (
          <div className="flex items-center justify-center h-9 bg-white border border-rose-200 rounded-md">
            <Loader2 className="h-4 w-4 animate-spin text-rose-500" />
          </div>
        ) : (
          <Select value={formOpenPortsAgentId} onValueChange={setFormOpenPortsAgentId}>
            <SelectTrigger className="h-9 bg-white border-rose-200">
              <SelectValue placeholder="Select an Ansible agent…" />
            </SelectTrigger>
            <SelectContent>
              {ansibleAgents.map(agent => (
                <SelectItem key={agent.agent_id} value={agent.agent_id}>
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-gray-500" />
                    <span>{agent.hostname}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <p className="text-xs text-rose-600">
          Only agents of type &quot;Ansible&quot; are shown. The agent logs into each
          reachable host and scans for open TCP/UDP ports.
        </p>
      </div>
    </div>
  )
}
