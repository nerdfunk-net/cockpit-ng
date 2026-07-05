'use client'

import { useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Minus,
  Radar,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { IconChip } from '@/components/shared/icon-chip'
import { useAgentsQuery } from '@/hooks/queries/use-agents-query'
import { useSavedInventoriesQuery } from '@/hooks/queries/use-saved-inventories-queries'
import ScanResultsModal from '@/components/features/network/tools/scan/scan-results-modal'
import {
  ScanInventorySection,
  type ScanTargetSource,
} from '@/components/features/network/tools/scan/scan-inventory-section'

interface CidrInput {
  id: number
  value: string
  error: string
}

const validateCIDR = (cidr: string): string => {
  if (!cidr.trim()) {
    return ''
  }

  const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/
  if (!cidrRegex.test(cidr)) {
    return 'Invalid CIDR format (expected: 192.168.1.0/24)'
  }

  const parts = cidr.split('/')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return 'Invalid CIDR format (expected: 192.168.1.0/24)'
  }

  const ip = parts[0]
  const netmask = parseInt(parts[1], 10)

  if (isNaN(netmask) || netmask < 19 || netmask > 32) {
    return 'Netmask must be between /19 and /32'
  }

  const octets = ip.split('.')
  for (const octet of octets) {
    const num = parseInt(octet, 10)
    if (num < 0 || num > 255) {
      return 'Invalid IP address octets'
    }
  }

  return ''
}

const EMPTY_AGENTS: never[] = []
const EMPTY_INVENTORIES: never[] = []

export default function ScanToolPage() {
  const { toast } = useToast()
  const { data: agentsData, isLoading: loadingAgents } = useAgentsQuery()
  const { data: inventoriesData, isLoading: loadingInventories } =
    useSavedInventoriesQuery()

  const nmapAgents = useMemo(
    () => (agentsData ?? EMPTY_AGENTS).filter(a => a.type === 'nmap' && a.agent_id),
    [agentsData]
  )
  const savedInventories = useMemo(
    () => inventoriesData?.inventories ?? EMPTY_INVENTORIES,
    [inventoriesData]
  )

  const [targetSource, setTargetSource] = useState<ScanTargetSource>('cidr')
  const [inventoryName, setInventoryName] = useState('')

  const [cidrInputs, setCidrInputs] = useState<CidrInput[]>([
    { id: 1, value: '', error: '' },
  ])
  const [nextId, setNextId] = useState(2)
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [scanType, setScanType] = useState<'connect' | 'syn' | 'udp'>('connect')
  const [ports, setPorts] = useState('1-1024')
  const [serviceDetection, setServiceDetection] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [timeout, setTimeout] = useState(300)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)

  const handleAddRow = useCallback(() => {
    setCidrInputs(prev => [...prev, { id: nextId, value: '', error: '' }])
    setNextId(prev => prev + 1)
  }, [nextId])

  const handleRemoveRow = useCallback(
    (id: number) => {
      setCidrInputs(prev => {
        if (prev.length === 1) {
          toast({
            title: 'Cannot remove',
            description: 'At least one CIDR input is required',
            variant: 'destructive',
          })
          return prev
        }
        return prev.filter(input => input.id !== id)
      })
    },
    [toast]
  )

  const handleCidrChange = useCallback((id: number, value: string) => {
    setCidrInputs(prev =>
      prev.map(input => {
        if (input.id === id) {
          return { ...input, value, error: validateCIDR(value) }
        }
        return input
      })
    )
  }, [])

  const handleSubmit = useCallback(async () => {
    if (targetSource === 'cidr') {
      const validCidrs = cidrInputs
        .filter(input => input.value.trim())
        .map(input => input.value.trim())

      if (validCidrs.length === 0) {
        toast({
          title: 'Validation Error',
          description: 'Please enter at least one CIDR network',
          variant: 'destructive',
        })
        return
      }

      const hasErrors = cidrInputs.some(input => input.value.trim() && input.error)
      if (hasErrors) {
        toast({
          title: 'Validation Error',
          description: 'Please fix all CIDR validation errors',
          variant: 'destructive',
        })
        return
      }
    } else if (!inventoryName) {
      toast({
        title: 'Validation Error',
        description: 'Please select a saved inventory',
        variant: 'destructive',
      })
      return
    }

    if (!selectedAgentId) {
      toast({
        title: 'Validation Error',
        description: 'Please select an Nmap agent',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)

    try {
      const validCidrs =
        targetSource === 'cidr'
          ? cidrInputs.filter(i => i.value.trim()).map(i => i.value.trim())
          : []

      const response = await fetch('/api/proxy/celery/tasks/nmap-scan-network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_source: targetSource,
          cidrs: validCidrs,
          inventory_name: targetSource === 'inventory' ? inventoryName : undefined,
          agent_id: selectedAgentId,
          ports: ports.trim() || undefined,
          scan_type: scanType,
          service_detection: serviceDetection,
          timeout,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to start scan task')
      }

      const data = await response.json()
      setTaskId(data.task_id)
      setShowModal(true)

      const targetDescription =
        targetSource === 'inventory'
          ? `inventory "${inventoryName}"`
          : `${validCidrs.length} network(s)`

      toast({
        title: 'Scan Started',
        description: `Scanning ${targetDescription} via agent ${selectedAgentId}...`,
      })
    } catch (error) {
      console.error('Failed to start nmap scan task:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start scan task',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [
    targetSource,
    inventoryName,
    cidrInputs,
    selectedAgentId,
    ports,
    scanType,
    serviceDetection,
    timeout,
    toast,
  ])

  const canSubmit = useMemo(() => {
    const hasValidTarget =
      targetSource === 'inventory'
        ? !!inventoryName
        : cidrInputs.some(i => i.value.trim() && !i.error)
    return hasValidTarget && !!selectedAgentId && !isSubmitting && !loadingAgents
  }, [
    targetSource,
    inventoryName,
    cidrInputs,
    selectedAgentId,
    isSubmitting,
    loadingAgents,
  ])

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <IconChip variant="primary">
              <Radar className="h-6 w-6" />
            </IconChip>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Network Port Scan</h1>
              <p className="text-muted-foreground mt-2">
                Scan open ports on reachable hosts via CIDR networks or a saved inventory
              </p>
            </div>
          </div>
        </div>

        <Card className="shadow-lg border-0 overflow-hidden p-0">
          <CardHeader className="panel-header border-b-0 rounded-none m-0 py-2 px-4">
            <CardTitle className="flex items-center space-x-2 text-sm font-medium">
              <Radar className="h-4 w-4" />
              <span>Scan Configuration</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 panel-content space-y-6">
            <ScanInventorySection
              targetSource={targetSource}
              setTargetSource={setTargetSource}
              inventoryName={inventoryName}
              setInventoryName={setInventoryName}
              savedInventories={savedInventories}
              loadingInventories={loadingInventories}
            />

            {targetSource === 'cidr' && (
            <div className="space-y-4">
              <Label className="text-base font-semibold text-foreground">
                CIDR Networks
              </Label>
              <div className="space-y-3">
                {cidrInputs.map(input => (
                  <div key={input.id} className="space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <Input
                          type="text"
                          placeholder="e.g., 192.168.1.0/24"
                          value={input.value}
                          onChange={e => handleCidrChange(input.id, e.target.value)}
                          className={
                            input.error
                              ? 'border-destructive focus:ring-destructive bg-card'
                              : 'focus:ring-ring/30 focus:border-primary border-border bg-card font-mono text-foreground placeholder:text-muted-foreground shadow-sm'
                          }
                        />
                        {input.error && (
                          <div className="flex items-center gap-1 mt-1 text-sm text-error-foreground bg-error p-2 rounded-md border border-error-border">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span>{input.error}</span>
                          </div>
                        )}
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={handleAddRow}
                        className="flex-shrink-0 hover:bg-info hover:border-info-border hover:text-info-foreground transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => handleRemoveRow(input.id)}
                        disabled={cidrInputs.length === 1}
                        className="flex-shrink-0 hover:bg-error hover:border-error-border hover:text-error-foreground transition-colors disabled:opacity-50"
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md border border-border">
                Enter CIDR networks (netmask /19 to /32). Alive hosts are discovered via
                ping before nmap scanning.
              </p>
            </div>
            )}

            {targetSource === 'inventory' && (
              <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md border border-border">
                Device IP addresses are resolved from the selected inventory via Nautobot.
                Alive hosts are discovered via ping before nmap scanning.
              </p>
            )}

            {/* Agent + Scan type row */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nmap-agent">
                  Nmap Agent <span className="text-destructive">*</span>
                </Label>
                {loadingAgents ? (
                  <div className="flex items-center gap-2 p-3 border border-info-border rounded-md bg-info">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm text-info-foreground">
                      Loading agents...
                    </span>
                  </div>
                ) : nmapAgents.length === 0 ? (
                  <div className="p-4 border border-warning-border rounded-md bg-warning">
                    <p className="text-sm text-warning-foreground">
                      No Nmap agents configured. Add one in{' '}
                      <strong>Settings → Connections → Agents</strong> with type{' '}
                      <strong>Nmap</strong>.
                    </p>
                  </div>
                ) : (
                  <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                    <SelectTrigger id="nmap-agent">
                      <SelectValue placeholder="Select an Nmap agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {nmapAgents.map(agent => (
                        <SelectItem key={agent.id} value={agent.agent_id!}>
                          {agent.name} ({agent.agent_id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="scan-type">Scan Type</Label>
                <Select
                  value={scanType}
                  onValueChange={v => setScanType(v as 'connect' | 'syn' | 'udp')}
                >
                  <SelectTrigger id="scan-type">
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

            {/* Ports */}
            <div className="space-y-2">
              <Label htmlFor="scan-ports">Ports</Label>
              <Input
                id="scan-ports"
                placeholder="1-1024"
                value={ports}
                onChange={e => setPorts(e.target.value)}
                className="font-mono focus:ring-ring/30 focus:border-primary"
              />
              <p className="text-xs text-muted-foreground">
                Port specification passed to nmap, e.g. &quot;22,80,443&quot; or
                &quot;1-1024&quot;
              </p>
            </div>

            {/* Service detection */}
            <div className="flex items-center space-x-2 bg-muted p-4 rounded-lg border border-border">
              <Checkbox
                id="service-detection"
                checked={serviceDetection}
                onCheckedChange={checked => setServiceDetection(checked as boolean)}
              />
              <div>
                <Label
                  htmlFor="service-detection"
                  className="text-sm font-medium leading-none cursor-pointer text-foreground"
                >
                  Service detection (-sV)
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Identify service names and versions (slower)
                </p>
              </div>
            </div>

            {/* Advanced */}
            <div className="border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors"
              >
                {showAdvanced ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                Advanced Options
              </button>

              {showAdvanced && (
                <div className="mt-4 bg-info p-4 rounded-lg border border-info-border">
                  <div className="space-y-2 max-w-xs">
                    <Label
                      htmlFor="scan-timeout"
                      className="text-sm font-medium text-info-foreground"
                    >
                      Scan Timeout (seconds)
                    </Label>
                    <Input
                      id="scan-timeout"
                      type="number"
                      min={30}
                      max={3600}
                      value={timeout}
                      onChange={e => setTimeout(parseInt(e.target.value, 10) || 300)}
                      className="focus:ring-ring/30 focus:border-primary border-info-border bg-card font-mono"
                    />
                    <p className="text-xs text-info-foreground">
                      Per-host nmap timeout (30–3600s)
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="min-w-[150px] shadow-md hover:shadow-lg transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Radar className="w-4 h-4 mr-2" />
                    Start Scan
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {showModal && taskId && (
        <ScanResultsModal taskId={taskId} onClose={() => setShowModal(false)} />
      )}
    </>
  )
}
