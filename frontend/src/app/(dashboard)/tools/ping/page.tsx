'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Minus, Wifi, AlertCircle, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { useToast } from '@/hooks/use-toast'
import PingResultsModal from '@/components/tools/ping-results-modal'

interface CidrInput {
  id: number
  value: string
  error: string
}

// CIDR validation function
const validateCIDR = (cidr: string): string => {
  if (!cidr.trim()) {
    return ''  // Empty is allowed
  }

  // Check basic format: IP/netmask
  const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/
  if (!cidrRegex.test(cidr)) {
    return 'Invalid CIDR format (expected: 192.168.1.0/24)'
  }

  const parts = cidr.split('/')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return 'Invalid CIDR format (expected: 192.168.1.0/24)'
  }

  const ip = parts[0]
  const netmaskStr = parts[1]
  const netmask = parseInt(netmaskStr, 10)

  // Check netmask range (19-32 as specified)
  if (isNaN(netmask) || netmask < 19 || netmask > 32) {
    return 'Netmask must be between /19 and /32'
  }

  // Validate IP octets
  const octets = ip.split('.')
  for (const octet of octets) {
    const num = parseInt(octet, 10)
    if (num < 0 || num > 255) {
      return 'Invalid IP address octets'
    }
  }

  return ''  // Valid
}

export default function PingPage() {
  const { token } = useAuthStore()
  const { toast } = useToast()

  // State for CIDR inputs
  const [cidrInputs, setCidrInputs] = useState<CidrInput[]>([
    { id: 1, value: '', error: '' }
  ])
  const [nextId, setNextId] = useState(2)
  const [resolveDns, setResolveDns] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Advanced fping options
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [count, setCount] = useState(3)
  const [timeout, setTimeout] = useState(500)
  const [retry, setRetry] = useState(3)
  const [interval, setInterval] = useState(10)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)

  // Add new CIDR input row
  const handleAddRow = useCallback(() => {
    setCidrInputs(prev => [...prev, { id: nextId, value: '', error: '' }])
    setNextId(prev => prev + 1)
  }, [nextId])

  // Remove CIDR input row
  const handleRemoveRow = useCallback((id: number) => {
    setCidrInputs(prev => {
      // Don't allow removing if only one row left
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
  }, [toast])

  // Update CIDR value and validate
  const handleCidrChange = useCallback((id: number, value: string) => {
    setCidrInputs(prev => prev.map(input => {
      if (input.id === id) {
        const error = validateCIDR(value)
        return { ...input, value, error }
      }
      return input
    }))
  }, [])

  // Submit ping request
  const handleSubmit = useCallback(async () => {
    // Validate all inputs
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

    // Check for validation errors
    const hasErrors = cidrInputs.some(input => input.value.trim() && input.error)
    if (hasErrors) {
      toast({
        title: 'Validation Error',
        description: 'Please fix all CIDR validation errors',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/proxy/celery/tasks/ping-network', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          cidrs: validCidrs,
          resolve_dns: resolveDns,
          count: count,
          timeout: timeout,
          retry: retry,
          interval: interval,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to start ping task')
      }

      const data = await response.json()
      setTaskId(data.task_id)
      setShowModal(true)

      toast({
        title: 'Task Started',
        description: `Pinging ${validCidrs.length} network(s)...`,
      })
    } catch (error) {
      console.error('Failed to start ping task:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to start ping task'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [cidrInputs, resolveDns, token, toast, count, timeout, retry, interval])

  return (
    <>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Wifi className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Network Ping Tool</h1>
              <p className="text-gray-600 mt-1">Ping CIDR networks and resolve DNS names</p>
            </div>
          </div>
        </div>

        <Card className="shadow-lg border-0 overflow-hidden p-0">
          <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4">
            <CardTitle className="flex items-center space-x-2 text-sm font-medium">
              <Wifi className="h-4 w-4" />
              <span>Network Ping Configuration</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-6">
            {/* CIDR Networks Section */}
            <div className="space-y-4">
              <Label className="text-base font-semibold text-slate-700">CIDR Networks</Label>
              <div className="space-y-3">
                {cidrInputs.map((input) => (
                  <div key={input.id} className="space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <Input
                          type="text"
                          placeholder="e.g., 192.168.1.0/24"
                          value={input.value}
                          onChange={(e) => handleCidrChange(input.id, e.target.value)}
                          className={input.error
                            ? 'border-red-500 focus:ring-red-500 bg-white'
                            : 'focus:ring-blue-500 focus:border-blue-500 border-slate-300 bg-white font-mono text-slate-900 placeholder:text-slate-400 shadow-sm'}
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
                Enter CIDR networks (netmask /19 to /32). Click + to add more networks.
              </p>
            </div>

            {/* Options Section */}
            <div className="space-y-4 bg-gradient-to-br from-slate-50 to-slate-100 p-4 rounded-lg border border-slate-200">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="resolve-dns"
                  checked={resolveDns}
                  onCheckedChange={(checked) => setResolveDns(checked as boolean)}
                  className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                />
                <Label
                  htmlFor="resolve-dns"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-slate-700"
                >
                  Resolve DNS
                </Label>
              </div>
              <p className="text-sm text-slate-600 ml-6">
                Resolve hostnames for reachable IP addresses
              </p>
            </div>

            {/* Advanced Options */}
            <div className="border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-blue-600 transition-colors"
              >
                {showAdvanced ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                Advanced Options
              </button>

              {showAdvanced && (
                <div className="mt-4 grid grid-cols-2 gap-4 bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                  <div className="space-y-2">
                    <Label htmlFor="count" className="text-sm font-medium text-slate-700">
                      Ping Count
                    </Label>
                    <Input
                      id="count"
                      type="number"
                      min="1"
                      max="10"
                      value={count}
                      onChange={(e) => setCount(parseInt(e.target.value) || 3)}
                      className="focus:ring-blue-500 focus:border-blue-500 border-blue-300 bg-white font-mono text-slate-900 shadow-sm"
                    />
                    <p className="text-xs text-slate-600">Number of pings per host (1-10)</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timeout" className="text-sm font-medium text-slate-700">
                      Timeout (ms)
                    </Label>
                    <Input
                      id="timeout"
                      type="number"
                      min="100"
                      max="5000"
                      step="100"
                      value={timeout}
                      onChange={(e) => setTimeout(parseInt(e.target.value) || 500)}
                      className="focus:ring-blue-500 focus:border-blue-500 border-blue-300 bg-white font-mono text-slate-900 shadow-sm"
                    />
                    <p className="text-xs text-slate-600">Individual target timeout (100-5000ms)</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="retry" className="text-sm font-medium text-slate-700">
                      Retries
                    </Label>
                    <Input
                      id="retry"
                      type="number"
                      min="0"
                      max="10"
                      value={retry}
                      onChange={(e) => setRetry(parseInt(e.target.value) || 3)}
                      className="focus:ring-blue-500 focus:border-blue-500 border-blue-300 bg-white font-mono text-slate-900 shadow-sm"
                    />
                    <p className="text-xs text-slate-600">Number of retries (0-10)</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="interval" className="text-sm font-medium text-slate-700">
                      Interval (ms)
                    </Label>
                    <Input
                      id="interval"
                      type="number"
                      min="1"
                      max="1000"
                      value={interval}
                      onChange={(e) => setInterval(parseInt(e.target.value) || 10)}
                      className="focus:ring-blue-500 focus:border-blue-500 border-blue-300 bg-white font-mono text-slate-900 shadow-sm"
                    />
                    <p className="text-xs text-slate-600">Interval between packets (1-1000ms)</p>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4 border-t border-slate-200">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="min-w-[150px] bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Wifi className="w-4 h-4 mr-2" />
                    Ping Networks
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results Modal */}
      {showModal && taskId && (
        <PingResultsModal
          taskId={taskId}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
