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
import { useAgentsQuery } from '@/hooks/queries/use-agents-query'
import ScanResultsModal from '@/components/features/network/tools/scan/scan-results-modal'

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

export default function ScanToolPage() {
  const { toast } = useToast()
  const { data: agentsData, isLoading: loadingAgents } = useAgentsQuery()

  const nmapAgents = useMemo(
    () => (agentsData ?? EMPTY_AGENTS).filter(a => a.type === 'nmap' && a.agent_id),
    [agentsData]
  )

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
      const response = await fetch('/api/proxy/celery/tasks/nmap-scan-network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cidrs: validCidrs,
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

      toast({
        title: 'Scan Started',
        description: `Scanning ${validCidrs.length} network(s) via agent ${selectedAgentId}...`,
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
    cidrInputs,
    selectedAgentId,
    ports,
    scanType,
    serviceDetection,
    timeout,
    toast,
  ])

  const canSubmit = useMemo(() => {
    const hasValidCidr = cidrInputs.some(i => i.value.trim() && !i.error)
    return hasValidCidr && !!selectedAgentId && !isSubmitting && !loadingAgents
  }, [cidrInputs, selectedAgentId, isSubmitting, loadingAgents])

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Radar className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Network Port Scan</h1>
              <p className="text-gray-600 mt-1">
                Scan open ports on reachable hosts in CIDR networks via an Nmap agent
              </p>
            </div>
          </div>
        </div>

        <Card className="shadow-lg border-0 overflow-hidden p-0">
          <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4">
            <CardTitle className="flex items-center space-x-2 text-sm font-medium">
              <Radar className="h-4 w-4" />
              <span>Scan Configuration</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-6">
            {/* CIDR Networks */}
            <div className="space-y-4">
              <Label className="text-base font-semibold text-slate-700">
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
                              ? 'border-red-500 focus:ring-red-500 bg-white'
                              : 'focus:ring-blue-500 focus:border-blue-500 border-slate-300 bg-white font-mono text-slate-900 placeholder:text-slate-400 shadow-sm'
                          }
                        />
                        {input.error && (
                          <div className="flex items-center gap-1 mt-1 text-sm text-red-600 bg-red-50 p-2 rounded-md border border-red-200">
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
                        className="flex-shrink-0 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => handleRemoveRow(input.id)}
                        disabled={cidrInputs.length === 1}
                        className="flex-shrink-0 hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors disabled:opacity-50"
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-slate-500 bg-slate-50 p-3 rounded-md border border-slate-200">
                Enter CIDR networks (netmask /19 to /32). Alive hosts are discovered via
                ping before nmap scanning.
              </p>
            </div>

            {/* Agent + Scan type row */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nmap-agent">
                  Nmap Agent <span className="text-red-500">*</span>
                </Label>
                {loadingAgents ? (
                  <div className="flex items-center gap-2 p-3 border border-blue-200 rounded-md bg-blue-50">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    <span className="text-sm text-blue-800">Loading agents...</span>
                  </div>
                ) : nmapAgents.length === 0 ? (
                  <div className="p-4 border border-amber-200 rounded-md bg-amber-50">
                    <p className="text-sm text-amber-800">
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
                className="font-mono focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-muted-foreground">
                Port specification passed to nmap, e.g. &quot;22,80,443&quot; or
                &quot;1-1024&quot;
              </p>
            </div>

            {/* Service detection */}
            <div className="flex items-center space-x-2 bg-gradient-to-br from-slate-50 to-slate-100 p-4 rounded-lg border border-slate-200">
              <Checkbox
                id="service-detection"
                checked={serviceDetection}
                onCheckedChange={checked => setServiceDetection(checked as boolean)}
                className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
              />
              <div>
                <Label
                  htmlFor="service-detection"
                  className="text-sm font-medium leading-none cursor-pointer text-slate-700"
                >
                  Service detection (-sV)
                </Label>
                <p className="text-sm text-slate-600 mt-1">
                  Identify service names and versions (slower)
                </p>
              </div>
            </div>

            {/* Advanced */}
            <div className="border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-blue-600 transition-colors"
              >
                {showAdvanced ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                Advanced Options
              </button>

              {showAdvanced && (
                <div className="mt-4 bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                  <div className="space-y-2 max-w-xs">
                    <Label htmlFor="scan-timeout" className="text-sm font-medium text-slate-700">
                      Scan Timeout (seconds)
                    </Label>
                    <Input
                      id="scan-timeout"
                      type="number"
                      min={30}
                      max={3600}
                      value={timeout}
                      onChange={e => setTimeout(parseInt(e.target.value, 10) || 300)}
                      className="focus:ring-blue-500 focus:border-blue-500 border-blue-300 bg-white font-mono"
                    />
                    <p className="text-xs text-slate-600">Per-host nmap timeout (30–3600s)</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-200">
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="min-w-[150px] bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all"
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
