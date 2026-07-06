'use client'

import { useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Radar, Plus, X } from 'lucide-react'
import {
  ScanInventorySection,
  type ScanTargetSource,
} from '@/components/features/network/tools/scan/scan-inventory-section'
import { generateEntryKey } from './DeployAgentJobTemplate'
import type { SavedInventory } from '../../types'

export interface PortScanCidrEntry {
  _key: string
  value: string
}

interface NmapAgent {
  agent_id: string
  hostname: string
}

interface PortScanJobTemplateProps {
  formPortScanTargetSource: ScanTargetSource
  setFormPortScanTargetSource: (value: ScanTargetSource) => void
  formPortScanInventoryName: string
  setFormPortScanInventoryName: (value: string) => void
  formPortScanCidrEntries: PortScanCidrEntry[]
  setFormPortScanCidrEntries: (entries: PortScanCidrEntry[]) => void
  formPortScanAgentId: string
  setFormPortScanAgentId: (value: string) => void
  formPortScanType: 'connect' | 'syn' | 'udp'
  setFormPortScanType: (value: 'connect' | 'syn' | 'udp') => void
  formPortScanPorts: string
  setFormPortScanPorts: (value: string) => void
  formPortScanServiceDetection: boolean
  setFormPortScanServiceDetection: (value: boolean) => void
  formPortScanUsePrimaryIpOnly: boolean
  setFormPortScanUsePrimaryIpOnly: (value: boolean) => void
  formPortScanTimeout: string
  setFormPortScanTimeout: (value: string) => void
  nmapAgents: NmapAgent[]
  loadingAgents: boolean
  savedInventories: SavedInventory[]
  loadingInventories: boolean
}

export function PortScanJobTemplate({
  formPortScanTargetSource,
  setFormPortScanTargetSource,
  formPortScanInventoryName,
  setFormPortScanInventoryName,
  formPortScanCidrEntries,
  setFormPortScanCidrEntries,
  formPortScanAgentId,
  setFormPortScanAgentId,
  formPortScanType,
  setFormPortScanType,
  formPortScanPorts,
  setFormPortScanPorts,
  formPortScanServiceDetection,
  setFormPortScanServiceDetection,
  formPortScanUsePrimaryIpOnly,
  setFormPortScanUsePrimaryIpOnly,
  formPortScanTimeout,
  setFormPortScanTimeout,
  nmapAgents,
  loadingAgents,
  savedInventories,
  loadingInventories,
}: PortScanJobTemplateProps) {
  useEffect(() => {
    if (nmapAgents.length === 1 && nmapAgents[0]?.agent_id && !formPortScanAgentId) {
      setFormPortScanAgentId(nmapAgents[0].agent_id)
    }
  }, [nmapAgents, formPortScanAgentId, setFormPortScanAgentId])

  const handleCidrChange = (index: number, value: string) => {
    const current = formPortScanCidrEntries[index]
    if (!current) return
    const newEntries = [...formPortScanCidrEntries]
    newEntries[index] = { _key: current._key, value }
    setFormPortScanCidrEntries(newEntries)
  }

  const handleCidrRemove = (index: number) => {
    setFormPortScanCidrEntries(
      formPortScanCidrEntries.filter((_, i) => i !== index)
    )
  }

  const handleCidrAdd = () => {
    setFormPortScanCidrEntries([
      ...formPortScanCidrEntries,
      { _key: generateEntryKey(), value: '' },
    ])
  }

  return (
    <div className="space-y-4">
      <ScanInventorySection
        targetSource={formPortScanTargetSource}
        setTargetSource={setFormPortScanTargetSource}
        inventoryName={formPortScanInventoryName}
        setInventoryName={setFormPortScanInventoryName}
        usePrimaryIpOnly={formPortScanUsePrimaryIpOnly}
        setUsePrimaryIpOnly={setFormPortScanUsePrimaryIpOnly}
        savedInventories={savedInventories}
        loadingInventories={loadingInventories}
      />

      {formPortScanTargetSource === 'cidr' && (
        <div className="rounded-lg border border-info-border bg-info/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold text-info-foreground">IP Prefixes</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCidrAdd}
              className="h-7 text-xs border-info-border text-info-foreground hover:bg-info"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Prefix
            </Button>
          </div>
          <div className="space-y-2">
            {formPortScanCidrEntries.map((entry, idx) => (
              <div key={entry._key} className="flex items-center gap-2">
                <Input
                  value={entry.value}
                  onChange={e => handleCidrChange(idx, e.target.value)}
                  placeholder="192.168.1.0/24"
                  className="bg-card border-info-border focus:border-primary focus:ring-ring/30 font-mono"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCidrRemove(idx)}
                  disabled={formPortScanCidrEntries.length <= 1}
                  className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive hover:bg-error"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <p className="text-xs text-info-foreground">
            CIDR prefixes (/19 to /32). Alive hosts are discovered via ping before
            nmap scanning.
          </p>
        </div>
      )}

      <div className="rounded-lg border border-info-border bg-info/30 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Radar className="h-4 w-4 text-info-foreground" />
          <Label className="text-sm font-semibold text-info-foreground">Scan Options</Label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-info-foreground">
              Nmap Agent <span className="text-destructive">*</span>
            </Label>
            {loadingAgents ? (
              <div className="flex items-center justify-center h-9 bg-card border border-info-border rounded-md">
                <Loader2 className="h-4 w-4 animate-spin text-info-foreground" />
              </div>
            ) : nmapAgents.length === 0 ? (
              <p className="text-xs text-warning-foreground bg-warning border border-warning-border rounded-md p-2">
                No Nmap agents configured. Add one in Settings → Connections → Agents.
              </p>
            ) : (
              <Select
                value={formPortScanAgentId}
                onValueChange={setFormPortScanAgentId}
              >
                <SelectTrigger className="h-9 bg-card border-info-border">
                  <SelectValue placeholder="Select an Nmap agent" />
                </SelectTrigger>
                <SelectContent>
                  {nmapAgents.map(agent => (
                    <SelectItem key={agent.agent_id} value={agent.agent_id}>
                      {agent.hostname} ({agent.agent_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-info-foreground">Scan Type</Label>
            <Select
              value={formPortScanType}
              onValueChange={v =>
                setFormPortScanType(v as 'connect' | 'syn' | 'udp')
              }
            >
              <SelectTrigger className="h-9 bg-card border-info-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="connect">Connect (-sT, no root)</SelectItem>
                <SelectItem value="syn">SYN (-sS, requires root)</SelectItem>
                <SelectItem value="udp">UDP (-sU, requires root)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-info-foreground">Ports</Label>
            <Input
              value={formPortScanPorts}
              onChange={e => setFormPortScanPorts(e.target.value)}
              placeholder="1-1024"
              className="bg-card border-info-border font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-info-foreground">Scan Timeout (seconds)</Label>
            <Input
              type="number"
              min={30}
              max={3600}
              value={formPortScanTimeout}
              onChange={e => setFormPortScanTimeout(e.target.value)}
              className="bg-card border-info-border font-mono"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="port-scan-service-detection"
            checked={formPortScanServiceDetection}
            onCheckedChange={checked =>
              setFormPortScanServiceDetection(checked === true)
            }
          />
          <Label
            htmlFor="port-scan-service-detection"
            className="text-sm font-medium cursor-pointer text-info-foreground"
          >
            Service detection (-sV)
          </Label>
        </div>
      </div>
    </div>
  )
}
