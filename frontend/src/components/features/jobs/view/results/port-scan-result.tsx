'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type {
  PortScanHostResult,
  PortScanJobResult,
  PortScanNetworkResult,
  PortScanPortBinding,
} from '../types/job-results'
import {
  Radar,
  Network,
  Server,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface PortScanResultViewProps {
  result: PortScanJobResult
}

const EMPTY_NETWORKS: PortScanNetworkResult[] = []

const SCAN_TYPE_LABELS: Record<string, string> = {
  connect: 'Connect (-sT)',
  syn: 'SYN (-sS)',
  udp: 'UDP (-sU)',
}

export function PortScanResultView({ result }: PortScanResultViewProps) {
  const [expandedHosts, setExpandedHosts] = useState<Set<string>>(new Set())
  const networks = result.networks ?? EMPTY_NETWORKS

  const toggleHost = (ip: string) => {
    setExpandedHosts(prev => {
      const next = new Set(prev)
      if (next.has(ip)) {
        next.delete(ip)
      } else {
        next.add(ip)
      }
      return next
    })
  }

  const expandAll = () => {
    const allIps = networks.flatMap(n => n.hosts.map(h => h.ip_address))
    setExpandedHosts(new Set(allIps))
  }

  const collapseAll = () => {
    setExpandedHosts(new Set())
  }

  const totalHosts = networks.reduce((sum, n) => sum + n.hosts.length, 0)

  return (
    <div className="space-y-4">
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50/80 to-sky-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <Radar className="h-5 w-5 text-blue-600" />
            Port Scan Summary
          </CardTitle>
          <CardDescription>
            Nmap port scan results
            {result.agent_id && (
              <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                Agent: {result.agent_id}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <SummaryStat label="Networks" value={result.total_networks ?? networks.length} />
            <SummaryStat
              label="IPs Scanned"
              value={result.total_ips_scanned ?? 0}
            />
            <SummaryStat
              label="Reachable"
              value={result.total_reachable ?? 0}
              accent="green"
            />
            <SummaryStat
              label="Open TCP"
              value={result.total_open_tcp_ports ?? 0}
              accent="blue"
            />
            <SummaryStat
              label="Open UDP"
              value={result.total_open_udp_ports ?? 0}
              accent="purple"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {result.scan_type && (
              <Badge variant="outline" className="bg-white">
                {SCAN_TYPE_LABELS[result.scan_type] ?? result.scan_type}
              </Badge>
            )}
            {result.ports && (
              <Badge variant="outline" className="bg-white font-mono">
                Ports: {result.ports}
              </Badge>
            )}
            <Badge variant="outline" className="bg-white">
              Hosts scanned: {result.total_hosts_scanned ?? totalHosts}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {totalHosts > 0 && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Collapse All
          </Button>
        </div>
      )}

      {networks.map(network => (
        <Card
          key={network.network}
          className="overflow-hidden border-l-4 border-l-blue-500 shadow-sm p-0"
        >
          <CardHeader className="bg-gradient-to-r from-blue-50 to-sky-50 border-b py-3 px-4 rounded-none m-0">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base font-mono text-slate-700 flex items-center gap-2">
                <Network className="h-4 w-4 text-blue-600 shrink-0" />
                <span className="truncate">{network.network}</span>
              </CardTitle>
              <Badge variant="outline" className="shrink-0 font-semibold">
                {network.reachable_count} reachable / {network.total_ips} IPs
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {network.hosts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No reachable hosts found in this target.
              </p>
            ) : (
              network.hosts.map(host => (
                <HostResultCard
                  key={host.ip_address}
                  host={host}
                  expanded={expandedHosts.has(host.ip_address)}
                  onToggle={() => toggleHost(host.ip_address)}
                />
              ))
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function SummaryStat({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: 'green' | 'blue' | 'purple'
}) {
  const valueClass =
    accent === 'green'
      ? 'text-green-600'
      : accent === 'blue'
        ? 'text-blue-600'
        : accent === 'purple'
          ? 'text-violet-600'
          : 'text-slate-800'

  return (
    <div className="rounded-lg border bg-white/80 p-3 text-center shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </p>
      <p className={`text-2xl font-bold mt-1 ${valueClass}`}>
        {value.toLocaleString()}
      </p>
    </div>
  )
}

function HostResultCard({
  host,
  expanded,
  onToggle,
}: {
  host: PortScanHostResult
  expanded: boolean
  onToggle: () => void
}) {
  const tcpCount = host.tcp_ports?.length ?? 0
  const udpCount = host.udp_ports?.length ?? 0

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          {host.success ? (
            <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600 shrink-0" />
          )}
          <Server className="h-4 w-4 text-blue-600 shrink-0" />
          <div className="min-w-0">
            <p className="font-mono text-sm font-medium text-slate-800 truncate">
              {host.ip_address}
            </p>
            {host.hostname && host.hostname !== host.ip_address && (
              <p className="text-xs text-muted-foreground truncate">{host.hostname}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {host.success ? (
            <>
              <Badge variant="secondary">{tcpCount} TCP</Badge>
              <Badge variant="outline">{udpCount} UDP</Badge>
              {expanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </>
          ) : (
            <Badge variant="destructive" className="max-w-[200px] truncate">
              {host.error || 'Failed'}
            </Badge>
          )}
        </div>
      </button>

      {expanded && host.success && (
        <div className="border-t border-slate-100 p-4 space-y-4 bg-slate-50/50">
          {host.host_status && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Host status:</span>
              <Badge
                variant={host.host_status === 'up' ? 'default' : 'secondary'}
                className={host.host_status === 'up' ? 'bg-green-600' : undefined}
              >
                {host.host_status}
              </Badge>
            </div>
          )}

          <PortSection title="TCP Ports" ports={host.tcp_ports ?? []} accent="blue" />
          <PortSection title="UDP Ports" ports={host.udp_ports ?? []} accent="purple" />

          {host.services && host.services.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-700">Detected Services</h4>
              <div className="rounded-md border bg-white overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Port</TableHead>
                      <TableHead>Protocol</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Product</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {host.services.map(svc => (
                      <TableRow key={`${svc.protocol}-${svc.port}`}>
                        <TableCell className="font-mono">{svc.port}</TableCell>
                        <TableCell className="uppercase">{svc.protocol}</TableCell>
                        <TableCell>
                          {svc.state ? (
                            <Badge variant="outline" className="text-xs">
                              {svc.state}
                            </Badge>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>{svc.service ?? '—'}</TableCell>
                        <TableCell>
                          {[svc.product, svc.version].filter(Boolean).join(' ') || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {host.scan_arguments && (
            <div className="rounded-md bg-slate-900 p-3">
              <p className="text-xs text-slate-400 mb-1">Scan arguments</p>
              <p className="text-xs font-mono text-slate-100 break-all">
                {host.scan_arguments}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PortSection({
  title,
  ports,
  accent,
}: {
  title: string
  ports: PortScanPortBinding[]
  accent?: 'blue' | 'purple'
}) {
  const badgeClass =
    accent === 'blue'
      ? 'bg-blue-100 text-blue-800 hover:bg-blue-100'
      : accent === 'purple'
        ? 'bg-violet-100 text-violet-800 hover:bg-violet-100'
        : undefined

  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-700 mb-2">
        {title}{' '}
        <span className="font-normal text-muted-foreground">({ports.length})</span>
      </h4>
      {ports.length === 0 ? (
        <p className="text-sm text-muted-foreground">None detected</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {ports.map(p => (
            <Badge
              key={`${p.address}-${p.port}`}
              variant="secondary"
              className={`font-mono ${badgeClass ?? ''}`}
            >
              {p.port}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
