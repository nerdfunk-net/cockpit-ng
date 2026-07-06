'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/shared/status-badge'
import {
  usePortScanDetailsQuery,
  type PortScanDashboardNetwork,
} from '@/hooks/queries/use-port-scan-query'
import type { PortScanHostResult } from '@/components/features/jobs/view/types/job-results'
import {
  Radar,
  Network,
  Loader2,
  AlertTriangle,
  Server,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface PortScanDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const SCAN_TYPE_LABELS: Record<string, string> = {
  connect: 'Connect (-sT)',
  syn: 'SYN (-sS)',
  udp: 'UDP (-sU)',
}

const EMPTY_NETWORKS: PortScanDashboardNetwork[] = []

export function PortScanDetailsDialog({ open, onOpenChange }: PortScanDetailsDialogProps) {
  const { data, isLoading, isError } = usePortScanDetailsQuery({ enabled: open })
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null)

  const networks = data?.networks ?? EMPTY_NETWORKS

  const activeNetwork = useMemo(
    () => networks.find(network => network.network === selectedNetwork) ?? null,
    [networks, selectedNetwork]
  )

  useEffect(() => {
    if (!open) {
      setSelectedNetwork(null)
      return
    }
    const firstNetwork = networks[0]
    if (!selectedNetwork && firstNetwork) {
      setSelectedNetwork(firstNetwork.network)
    }
  }, [open, networks, selectedNetwork])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[85vw] !w-[85vw] max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Port Scan Details</DialogTitle>
          <DialogDescription>
            Browse port scan results by network
          </DialogDescription>
        </DialogHeader>

        <div className="panel-header py-2 px-4 pr-14 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Radar className="h-4 w-4" />
            <span className="text-sm font-medium">Port Scan Details</span>
          </div>
          <div className="text-xs text-panel-header-muted">
            {data?.has_data
              ? `${data.total_networks ?? networks.length} network${(data.total_networks ?? networks.length) === 1 ? '' : 's'}`
              : 'No networks'}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 bg-muted/50">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading port scan details...</span>
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center gap-2 py-20 text-error-foreground bg-muted/50">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm">Failed to load port scan details</span>
          </div>
        ) : !data?.has_data ? (
          <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground bg-muted/50">
            <AlertTriangle className="h-5 w-5 text-warning-foreground" />
            <span className="text-sm">{data?.message ?? 'No port scan data available'}</span>
          </div>
        ) : (
          <div className="flex flex-1 min-h-[480px] overflow-hidden">
            <div className="w-72 border-r border-border shrink-0 bg-muted flex flex-col">
              <div className="px-3 py-2 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Scanned Networks
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {networks.map(network => {
                  const isSelected = network.network === selectedNetwork
                  return (
                    <button
                      key={network.network}
                      type="button"
                      onClick={() => setSelectedNetwork(network.network)}
                      className={cn(
                        'w-full text-left rounded-lg border px-3 py-2.5 transition-colors',
                        isSelected
                          ? 'border-primary bg-card shadow-sm'
                          : 'border-transparent hover:bg-card/80'
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <Network className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-mono font-medium text-foreground truncate">
                            {network.network}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {network.reachable_count} reachable / {network.total_ips} IPs
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {network.hosts.length} host{network.hosts.length === 1 ? '' : 's'}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                              TCP {network.open_tcp_ports}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex-1 p-6 panel-content overflow-y-auto">
              {activeNetwork ? (
                <NetworkDetailPanel network={activeNetwork} />
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <Network className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Select a network to view scan details</p>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="px-4 py-3 border-t border-border bg-card">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function NetworkDetailPanel({ network }: { network: PortScanDashboardNetwork }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground font-mono break-all">
            {network.network}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {network.reachable_count} reachable hosts out of {network.total_ips} IPs scanned
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {network.scan_type && (
            <Badge variant="outline" className="bg-card">
              {SCAN_TYPE_LABELS[network.scan_type] ?? network.scan_type}
            </Badge>
          )}
          {network.ports && (
            <Badge variant="outline" className="bg-card font-mono">
              Ports: {network.ports}
            </Badge>
          )}
          {network.agent_id && (
            <Badge variant="outline" className="bg-card">
              Agent: {network.agent_id}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <DetailStat label="Hosts" value={network.hosts.length} />
        <DetailStat label="Reachable" value={network.reachable_count} accent="success" />
        <DetailStat label="Open TCP" value={network.open_tcp_ports} accent="primary" />
        <DetailStat label="Open UDP" value={network.open_udp_ports} />
      </div>

      {(network.job_name || network.last_scanned_at) && (
        <div className="text-xs text-muted-foreground border border-border rounded-lg bg-muted/50 px-3 py-2">
          {network.job_name && (
            <p>
              <span className="font-medium text-foreground">Last job:</span> {network.job_name}
            </p>
          )}
          {network.last_scanned_at && (
            <p className={network.job_name ? 'mt-1' : undefined}>
              <span className="font-medium text-foreground">Scanned:</span>{' '}
              {new Date(network.last_scanned_at).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {network.hosts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
          <p className="text-sm">No reachable hosts found in this network.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Host</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>TCP Ports</TableHead>
                <TableHead>UDP Ports</TableHead>
                <TableHead>Services</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {network.hosts.map(host => (
                <HostRow key={host.ip_address} host={host} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function DetailStat({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: 'success' | 'primary'
}) {
  const valueClass =
    accent === 'success'
      ? 'text-success-foreground'
      : accent === 'primary'
        ? 'text-primary'
        : 'text-foreground'

  return (
    <div className="rounded-lg border border-border bg-card/80 p-3 text-center">
      <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
      <p className={cn('text-2xl font-bold mt-1', valueClass)}>{value.toLocaleString()}</p>
    </div>
  )
}

function HostRow({ host }: { host: PortScanHostResult }) {
  const tcpPorts = host.tcp_ports?.map(port => port.port).join(', ') || '—'
  const udpPorts = host.udp_ports?.map(port => port.port).join(', ') || '—'
  const services = host.services?.length ?? 0

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          {host.success ? (
            <CheckCircle className="h-4 w-4 text-success-foreground shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 text-error-foreground shrink-0" />
          )}
          <Server className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="font-mono text-sm font-medium text-foreground">{host.ip_address}</p>
            {host.hostname && host.hostname !== host.ip_address && (
              <p className="text-xs text-muted-foreground truncate">{host.hostname}</p>
            )}
            {!host.success && host.error && (
              <p className="text-xs text-error-foreground truncate">{host.error}</p>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        {host.host_status === 'up' ? (
          <StatusBadge variant="success">{host.host_status}</StatusBadge>
        ) : host.host_status ? (
          <Badge variant="secondary">{host.host_status}</Badge>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell className="font-mono text-sm">{tcpPorts}</TableCell>
      <TableCell className="font-mono text-sm">{udpPorts}</TableCell>
      <TableCell>{services > 0 ? services : '—'}</TableCell>
    </TableRow>
  )
}
