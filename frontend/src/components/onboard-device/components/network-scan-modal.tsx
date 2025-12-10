'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Minus, Search, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { Checkbox } from '@/components/ui/checkbox'

interface NetworkScanModalProps {
  open: boolean
  onClose: () => void
  onIPsSelected: (ips: string[]) => void
}

interface ScanResult {
  ip: string
  credential_id: number
  device_type: string
  hostname: string | null
  platform: string | null
}

interface ScanProgress {
  total: number
  scanned: number
  alive: number
  authenticated: number
  unreachable: number
  auth_failed: number
  driver_not_supported: number
}

interface ScanStatus {
  job_id: string
  state: string
  progress: ScanProgress
  results: ScanResult[]
}

interface UnreachableRange {
  start: string
  end: string
  count: number
}

const EMPTY_CIDR_LINE = ''

export function NetworkScanModal({ open, onClose, onIPsSelected }: NetworkScanModalProps) {
  const { apiCall } = useApi()

  // CIDR input lines with unique IDs
  const [cidrLines, setCidrLines] = useState<Array<{ id: string; value: string }>>([
    { id: crypto.randomUUID(), value: EMPTY_CIDR_LINE }
  ])
  const [cidrErrors, setCidrErrors] = useState<Record<string, string>>({})

  // Scanning state
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null)
  const [scanResults, setScanResults] = useState<ScanResult[]>([])
  const [scanState, setScanState] = useState<string>('')
  const [unreachableRanges, setUnreachableRanges] = useState<UnreachableRange[]>([])

  // Selection state
  const [selectedIPs, setSelectedIPs] = useState<Set<string>>(new Set())

  // Validate CIDR notation
  const validateCIDR = useCallback((cidr: string): string | null => {
    if (!cidr.trim()) return null

    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/
    if (!cidrRegex.test(cidr)) {
      return 'Invalid CIDR format (e.g., 192.168.1.0/24)'
    }

    const parts = cidr.split('/')
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return 'Invalid CIDR format (e.g., 192.168.1.0/24)'
    }

    const ip = parts[0]
    const prefixStr = parts[1]
    const prefix = parseInt(prefixStr, 10)

    // Validate IP octets
    const octets = ip.split('.').map(Number)
    if (octets.some(octet => octet < 0 || octet > 255)) {
      return 'Invalid IP address'
    }

    // Validate prefix
    if (isNaN(prefix) || prefix < 22 || prefix > 32) {
      return 'Prefix must be between /22 and /32'
    }

    return null
  }, [])

  // Handle CIDR line change with validation
  const handleCIDRChange = useCallback((id: string, value: string) => {
    setCidrLines(prev =>
      prev.map(line => (line.id === id ? { ...line, value } : line))
    )

    // Validate
    const error = validateCIDR(value)
    setCidrErrors(prev => {
      const newErrors = { ...prev }
      if (error) {
        newErrors[id] = error
      } else {
        delete newErrors[id]
      }
      return newErrors
    })
  }, [validateCIDR])

  // Add new CIDR line
  const handleAddLine = useCallback(() => {
    setCidrLines(prev => [...prev, { id: crypto.randomUUID(), value: EMPTY_CIDR_LINE }])
  }, [])

  // Remove CIDR line
  const handleRemoveLine = useCallback((id: string) => {
    setCidrLines(prev => prev.filter(line => line.id !== id))
    setCidrErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[id]
      return newErrors
    })
  }, [])

  // Poll scan status - use async function with recursion
  const pollScanStatus = useCallback(
    async function poll(jobId: string): Promise<void> {
      try {
        const status = await apiCall<ScanStatus>(`scan/${jobId}/status`, {
          method: 'GET'
        })

        if (status) {
          setScanProgress(status.progress)
          setScanState(status.state)

          if (status.state === 'finished') {
            setScanResults(status.results)
            setIsScanning(false)

            // Calculate unreachable ranges
            // For now, we'll just note that there were unreachable hosts
            // A more sophisticated algorithm could compute ranges
            const unreachableCount = status.progress.unreachable
            if (unreachableCount > 0) {
              setUnreachableRanges([{
                start: 'N/A',
                end: 'N/A',
                count: unreachableCount
              }])
            }
          } else {
            // Continue polling - schedule next poll
            setTimeout(() => poll(jobId), 1000)
          }
        }
      } catch (error) {
        console.error('Failed to poll scan status:', error)
        setIsScanning(false)
      }
    },
    [apiCall]
  )

  // Start network scan
  const handleStartScan = useCallback(async () => {
    // Filter out empty lines and validate
    const validCIDRs = cidrLines.filter(line => line.value.trim() !== '').map(line => line.value)

    if (validCIDRs.length === 0) {
      return
    }

    // Check for validation errors
    const hasErrors = Object.keys(cidrErrors).length > 0
    if (hasErrors) {
      return
    }

    setIsScanning(true)
    setScanProgress(null)
    setScanResults([])
    setUnreachableRanges([])
    setSelectedIPs(new Set())

    try {
      const response = await apiCall<{ job_id: string; total_targets: number; state: string }>(
        'scan/start',
        {
          method: 'POST',
          body: {
            cidrs: validCIDRs,
            ping_mode: 'fping'
            // No credential_ids = ping-only mode
          }
        }
      )

      if (response?.job_id) {
        setScanState(response.state)
        setScanProgress({
          total: response.total_targets,
          scanned: 0,
          alive: 0,
          authenticated: 0,
          unreachable: 0,
          auth_failed: 0,
          driver_not_supported: 0
        })

        // Start polling
        pollScanStatus(response.job_id)
      }
    } catch (error) {
      console.error('Failed to start scan:', error)
      setIsScanning(false)
    }
  }, [cidrLines, cidrErrors, apiCall, pollScanStatus])

  // Toggle IP selection
  const handleToggleIP = useCallback((ip: string) => {
    setSelectedIPs(prev => {
      const newSet = new Set(prev)
      if (newSet.has(ip)) {
        newSet.delete(ip)
      } else {
        newSet.add(ip)
      }
      return newSet
    })
  }, [])

  // Select all IPs
  const handleSelectAll = useCallback(() => {
    const allIPs = new Set(scanResults.map(r => r.ip))
    setSelectedIPs(allIPs)
  }, [scanResults])

  // Deselect all IPs
  const handleDeselectAll = useCallback(() => {
    setSelectedIPs(new Set())
  }, [])

  // Add selected IPs to onboarding
  const handleAddToOnboarding = useCallback(() => {
    const ips = Array.from(selectedIPs)
    onIPsSelected(ips)
    onClose()
  }, [selectedIPs, onIPsSelected, onClose])

  // Reset state when modal closes
  const handleClose = useCallback(() => {
    setCidrLines([{ id: crypto.randomUUID(), value: EMPTY_CIDR_LINE }])
    setCidrErrors({})
    setIsScanning(false)
    setScanProgress(null)
    setScanResults([])
    setScanState('')
    setUnreachableRanges([])
    setSelectedIPs(new Set())
    onClose()
  }, [onClose])

  // Calculate progress percentage
  const progressPercent = scanProgress
    ? Math.round((scanProgress.scanned / scanProgress.total) * 100)
    : 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-blue-500" />
            Scan Network
          </DialogTitle>
          <DialogDescription>
            Enter network addresses in CIDR notation to scan for reachable hosts
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* CIDR Input Section */}
          {!isScanning && scanResults.length === 0 && (
            <div className="space-y-3">
              <Label>Network Addresses (CIDR Notation)</Label>
              {cidrLines.map((line) => (
                <div key={line.id} className="flex items-start gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="e.g., 192.168.1.0/24"
                      value={line.value}
                      onChange={(e) => handleCIDRChange(line.id, e.target.value)}
                      className={cidrErrors[line.id] ? 'border-red-500' : ''}
                    />
                    {cidrErrors[line.id] && (
                      <p className="text-xs text-red-500 mt-1">{cidrErrors[line.id]}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleAddLine}
                    className="h-10 w-10"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  {cidrLines.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleRemoveLine(line.id)}
                      className="h-10 w-10"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              <Button
                onClick={handleStartScan}
                disabled={
                  cidrLines.filter(l => l.value.trim()).length === 0 ||
                  Object.keys(cidrErrors).length > 0
                }
                className="w-full"
              >
                <Search className="h-4 w-4 mr-2" />
                Scan Network
              </Button>
            </div>
          )}

          {/* Scanning Progress */}
          {isScanning && scanProgress && (
            <div className="space-y-4">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Scanning network...
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm pt-2">
                  <div className="text-center">
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-semibold">{scanProgress.total}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground">Scanned</p>
                    <p className="font-semibold">{scanProgress.scanned}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground">Reachable</p>
                    <p className="font-semibold text-green-600">{scanProgress.alive}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Scan Results */}
          {!isScanning && scanResults.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Scan Results</h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    disabled={scanResults.length === 0}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeselectAll}
                    disabled={selectedIPs.size === 0}
                  >
                    Deselect All
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-[400px] overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="w-12 p-2"></th>
                        <th className="text-left p-2">IP Address</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">Platform</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Reachable IPs */}
                      {scanResults.map((result) => (
                        <tr key={result.ip} className="border-t hover:bg-muted/50">
                          <td className="p-2 text-center">
                            <Checkbox
                              checked={selectedIPs.has(result.ip)}
                              onCheckedChange={() => handleToggleIP(result.ip)}
                            />
                          </td>
                          <td className="p-2 font-mono text-sm">{result.ip}</td>
                          <td className="p-2">
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="h-4 w-4" />
                              Reachable
                            </span>
                          </td>
                          <td className="p-2 text-sm text-muted-foreground">
                            {result.platform || 'Unknown'}
                          </td>
                        </tr>
                      ))}

                      {/* Unreachable ranges */}
                      {unreachableRanges.map((range) => (
                        <tr key={`unreachable-${range.start}-${range.end}-${range.count}`} className="border-t bg-muted/30">
                          <td className="p-2"></td>
                          <td className="p-2 text-sm text-muted-foreground">
                            {range.count} host{range.count !== 1 ? 's' : ''}
                          </td>
                          <td className="p-2">
                            <span className="flex items-center gap-1 text-red-600">
                              <XCircle className="h-4 w-4" />
                              Unreachable
                            </span>
                          </td>
                          <td className="p-2 text-sm text-muted-foreground">-</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-muted-foreground">
                  {selectedIPs.size} IP{selectedIPs.size !== 1 ? 's' : ''} selected
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleClose}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddToOnboarding}
                    disabled={selectedIPs.size === 0}
                  >
                    Add to Onboarding
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* No Results Message */}
          {!isScanning && scanState === 'finished' && scanResults.length === 0 && (
            <div className="text-center py-8">
              <XCircle className="h-12 w-12 text-red-400 mx-auto mb-2" />
              <p className="text-muted-foreground">No reachable hosts found</p>
              <Button
                variant="outline"
                onClick={() => {
                  setScanState('')
                  setScanProgress(null)
                  setUnreachableRanges([])
                }}
                className="mt-4"
              >
                Try Again
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
