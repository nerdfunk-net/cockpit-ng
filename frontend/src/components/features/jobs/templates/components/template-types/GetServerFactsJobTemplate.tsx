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
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-indigo-600" />
          <Label className="text-sm font-semibold text-indigo-900">IP Prefixes</Label>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handlePrefixAdd}
          className="h-7 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
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
              className="bg-white border-indigo-200 focus:border-indigo-400 focus:ring-indigo-400"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handlePrefixRemove(idx)}
              disabled={formFactsPrefixEntries.length <= 1}
              className="h-9 w-9 shrink-0 text-indigo-500 hover:text-red-600 hover:bg-red-50"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <p className="text-xs text-indigo-700">
        Prefixes to scan in CIDR notation, e.g. 192.168.178.0/24. Each prefix is pinged
        to find reachable hosts before attempting to gather facts.
      </p>

      <div className="space-y-1.5 pt-2 border-t border-indigo-200">
        <Label className="text-xs text-indigo-700">
          Ansible Agent <span className="text-red-500">*</span>
        </Label>
        {loadingAgents ? (
          <div className="flex items-center justify-center h-9 bg-white border border-indigo-200 rounded-md">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
          </div>
        ) : (
          <Select value={formFactsAgentId} onValueChange={setFormFactsAgentId}>
            <SelectTrigger className="h-9 bg-white border-indigo-200">
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
        <p className="text-xs text-indigo-600">
          Only agents of type &quot;Ansible&quot; are shown. The agent logs into each
          reachable host and gathers Ansible facts.
        </p>
      </div>
    </div>
  )
}
