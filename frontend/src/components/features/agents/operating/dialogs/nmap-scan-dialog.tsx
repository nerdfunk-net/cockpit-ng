'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Radar, Loader2 } from 'lucide-react'
import type { UseMutationResult } from '@tanstack/react-query'
import type { NmapScanInput, NmapScanResult } from '../types'

interface NmapScanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentId: string
  mutation: UseMutationResult<NmapScanResult, Error, NmapScanInput>
}

export function NmapScanDialog({
  open,
  onOpenChange,
  agentId,
  mutation,
}: NmapScanDialogProps) {
  const [ipAddress, setIpAddress] = useState('')
  const [ports, setPorts] = useState('1-1024')
  const [scanType, setScanType] = useState<'connect' | 'syn' | 'udp'>('connect')
  const [serviceDetection, setServiceDetection] = useState(false)

  const handleSubmit = useCallback(() => {
    mutation.mutate({
      agent_id: agentId,
      ip_address: ipAddress.trim(),
      ports: ports.trim() || undefined,
      scan_type: scanType,
      service_detection: serviceDetection,
    })
  }, [agentId, ipAddress, ports, scanType, serviceDetection, mutation])

  const handleClose = useCallback(() => {
    mutation.reset()
    setIpAddress('')
    setPorts('1-1024')
    setScanType('connect')
    setServiceDetection(false)
    onOpenChange(false)
  }, [mutation, onOpenChange])

  const canScan = useMemo(
    () => ipAddress.trim().length > 0 && !mutation.isPending,
    [ipAddress, mutation.isPending]
  )

  const output = mutation.data?.output

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radar className="h-5 w-5" />
            Nmap Port Scan — Agent: {agentId}
          </DialogTitle>
          <DialogDescription>
            Scan open ports on a target reachable from this agent. No SSH credentials
            required.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {!mutation.isSuccess ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="nmap-ip">Target IP or hostname</Label>
                <Input
                  id="nmap-ip"
                  placeholder="192.168.1.10"
                  value={ipAddress}
                  onChange={e => setIpAddress(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nmap-ports">Ports</Label>
                <Input
                  id="nmap-ports"
                  placeholder="1-1024"
                  value={ports}
                  onChange={e => setPorts(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nmap-scan-type">Scan type</Label>
                <Select
                  value={scanType}
                  onValueChange={value =>
                    setScanType(value as 'connect' | 'syn' | 'udp')
                  }
                >
                  <SelectTrigger id="nmap-scan-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="connect">Connect (-sT, no root)</SelectItem>
                    <SelectItem value="syn">SYN (-sS, requires root)</SelectItem>
                    <SelectItem value="udp">UDP (-sU, requires root)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between sm:col-span-2 rounded-lg border p-3">
                <div>
                  <Label htmlFor="nmap-service-detection">Service detection (-sV)</Label>
                  <p className="text-xs text-muted-foreground">
                    Identify service names and versions (slower)
                  </p>
                </div>
                <Switch
                  id="nmap-service-detection"
                  checked={serviceDetection}
                  onCheckedChange={setServiceDetection}
                />
              </div>
            </div>
          ) : output ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline">{output.hostname}</Badge>
                <Badge variant="outline">{output.ip_address}</Badge>
                <Badge
                  className={
                    output.host_status === 'up'
                      ? 'bg-green-100 text-green-700 hover:bg-green-100'
                      : undefined
                  }
                >
                  {output.host_status}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  {mutation.data.execution_time_ms}ms · {output.scan_arguments}
                </span>
              </div>

              <PortTable title="TCP ports" ports={output.tcp_ports} />
              <PortTable title="UDP ports" ports={output.udp_ports} />

              {output.services.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Detected services</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Port</TableHead>
                        <TableHead>Protocol</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Product</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {output.services.map(svc => (
                        <TableRow key={`${svc.protocol}-${svc.port}`}>
                          <TableCell>{svc.port}</TableCell>
                          <TableCell className="uppercase">{svc.protocol}</TableCell>
                          <TableCell>{svc.service ?? '—'}</TableCell>
                          <TableCell>
                            {[svc.product, svc.version].filter(Boolean).join(' ') || '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            {mutation.isSuccess ? 'Close' : 'Cancel'}
          </Button>
          {!mutation.isSuccess && (
            <Button onClick={handleSubmit} disabled={!canScan}>
              {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {mutation.isPending ? 'Scanning…' : 'Start Scan'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PortTable({
  title,
  ports,
}: {
  title: string
  ports: { address: string; port: number }[]
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">
        {title}{' '}
        <span className="text-muted-foreground font-normal">({ports.length})</span>
      </h4>
      {ports.length === 0 ? (
        <p className="text-sm text-muted-foreground">None detected</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {ports.map(p => (
            <Badge key={`${p.address}-${p.port}`} variant="secondary">
              {p.port}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
