'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Loader2,
  CheckCircle,
  XCircle,
  Radar,
  X,
  Server,
  Network,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const EMPTY_NETWORKS: NmapNetworkResult[] = []

interface NmapPortBinding {
  address: string
  port: number
}

interface NmapHostResult {
  ip_address: string
  hostname?: string
  host_status?: string
  tcp_ports: NmapPortBinding[]
  udp_ports: NmapPortBinding[]
  services?: Array<{
    protocol: string
    port: number
    service?: string | null
    product?: string | null
    version?: string | null
  }>
  success: boolean
  error?: string | null
}

interface NmapNetworkResult {
  network: string
  total_ips: number
  reachable_count: number
  hosts: NmapHostResult[]
}

interface NmapScanTaskResult {
  success: boolean
  agent_id?: string
  scan_type?: string
  ports?: string | null
  networks: NmapNetworkResult[]
  total_networks?: number
  total_ips_scanned?: number
  total_reachable?: number
  total_hosts_scanned?: number
  total_open_tcp_ports?: number
  total_open_udp_ports?: number
  error?: string
}

interface ProgressData {
  current?: number
  total?: number
  status?: string
}

interface ScanResultsModalProps {
  taskId: string
  onClose: () => void
}

export default function ScanResultsModal({ taskId, onClose }: ScanResultsModalProps) {
  const { toast } = useToast()

  const [taskStatus, setTaskStatus] = useState<string>('PENDING')
  const [taskResult, setTaskResult] = useState<NmapScanTaskResult | null>(null)
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [polling, setPolling] = useState(true)
  const [expandedHost, setExpandedHost] = useState<string | null>(null)

  const fetchTaskStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/proxy/celery/tasks/${taskId}`)

      if (!response.ok) {
        throw new Error('Failed to fetch task status')
      }

      const data = await response.json()
      setTaskStatus(data.status)

      if (data.status === 'PROGRESS') {
        setProgress(data.progress)
      } else if (data.status === 'SUCCESS') {
        setTaskResult(data.result)
        setPolling(false)
      } else if (data.status === 'FAILURE') {
        setTaskResult({
          success: false,
          error: data.error || 'Task failed',
          networks: EMPTY_NETWORKS,
        })
        setPolling(false)
        toast({
          title: 'Scan Failed',
          description: data.error || 'Unknown error occurred',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Failed to fetch task status:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch task status',
        variant: 'destructive',
      })
    }
  }, [taskId, toast])

  useEffect(() => {
    if (!polling) return

    fetchTaskStatus()
    const interval = setInterval(fetchTaskStatus, 2000)

    return () => clearInterval(interval)
  }, [polling, fetchTaskStatus])

  const progressCurrent = progress?.current
  const progressTotal = progress?.total
  const progressPercentage = useMemo(() => {
    if (taskStatus === 'SUCCESS') return 100
    if (progressTotal && progressCurrent) {
      return Math.round((progressCurrent / progressTotal) * 100)
    }
    return 0
  }, [taskStatus, progressCurrent, progressTotal])

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="!max-w-6xl max-h-[85vh] overflow-y-auto w-[90vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="bg-violet-100 p-2 rounded-lg">
              <Radar className="w-5 h-5 text-violet-600" />
            </div>
            <span className="text-gray-900">Nmap Scan Results</span>
          </DialogTitle>
          <DialogDescription>
            {taskStatus === 'PENDING' && 'Task is queued and waiting to start...'}
            {taskStatus === 'PROGRESS' && 'Scanning reachable hosts...'}
            {taskStatus === 'SUCCESS' && 'Scan completed'}
            {taskStatus === 'FAILURE' && 'Scan failed'}
          </DialogDescription>
        </DialogHeader>

        {(taskStatus === 'PENDING' || taskStatus === 'PROGRESS') && (
          <div className="space-y-4 bg-gradient-to-br from-violet-50 to-violet-100 p-6 rounded-lg border border-violet-200">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-violet-600" />
              <span className="text-sm font-medium text-slate-700">
                {progress?.status || 'Starting...'}
              </span>
            </div>
            <Progress
              value={progressPercentage}
              className="w-full [&>div]:bg-violet-600"
            />
            <div className="text-sm text-slate-600 font-medium">
              {progress?.current || 0} / {progress?.total || 0} processed
            </div>
          </div>
        )}

        {taskStatus === 'SUCCESS' && taskResult?.success && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <SummaryCard label="Networks" value={taskResult.total_networks ?? 0} />
              <SummaryCard label="IPs Scanned" value={taskResult.total_ips_scanned ?? 0} />
              <SummaryCard
                label="Reachable"
                value={taskResult.total_reachable ?? 0}
                accent="green"
              />
              <SummaryCard
                label="Open TCP"
                value={taskResult.total_open_tcp_ports ?? 0}
                accent="blue"
              />
              <SummaryCard
                label="Open UDP"
                value={taskResult.total_open_udp_ports ?? 0}
                accent="purple"
              />
            </div>

            {taskResult.agent_id && (
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="outline">Agent: {taskResult.agent_id}</Badge>
                {taskResult.scan_type && (
                  <Badge variant="outline">Scan: {taskResult.scan_type}</Badge>
                )}
                {taskResult.ports && (
                  <Badge variant="outline">Ports: {taskResult.ports}</Badge>
                )}
              </div>
            )}

            <div className="space-y-4">
              {taskResult.networks.map(network => (
                <Card
                  key={network.network}
                  className="border-l-4 border-l-violet-500 shadow-md overflow-hidden p-0"
                >
                  <CardHeader className="bg-gradient-to-r from-violet-50 to-violet-100 border-b-0 rounded-none m-0 py-3 px-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-mono text-slate-700 flex items-center gap-2">
                        <Network className="h-4 w-4 text-violet-600" />
                        {network.network}
                      </CardTitle>
                      <Badge variant="outline" className="font-semibold">
                        {network.reachable_count} reachable / {network.total_ips} IPs
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    {network.hosts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No reachable hosts found in this network.
                      </p>
                    ) : (
                      network.hosts.map(host => (
                        <HostResultCard
                          key={host.ip_address}
                          host={host}
                          expanded={expandedHost === host.ip_address}
                          onToggle={() =>
                            setExpandedHost(prev =>
                              prev === host.ip_address ? null : host.ip_address
                            )
                          }
                        />
                      ))
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {taskStatus === 'FAILURE' && taskResult && !taskResult.success && (
          <Card className="status-error shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="bg-red-100 p-2 rounded-lg">
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                </div>
                <div>
                  <p className="font-semibold text-red-800 mb-1 text-lg">Scan Failed</p>
                  <p className="text-sm text-red-700 font-medium">{taskResult.error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
          <Button
            variant="outline"
            onClick={onClose}
            className="hover:bg-slate-100 border-slate-300 text-slate-700 font-medium"
          >
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: 'green' | 'blue' | 'purple'
}) {
  const accentClasses =
    accent === 'green'
      ? 'from-green-50 to-emerald-50 border-green-300'
      : accent === 'blue'
        ? 'from-blue-50 to-sky-50 border-blue-300'
        : accent === 'purple'
          ? 'from-violet-50 to-purple-50 border-violet-300'
          : 'from-slate-50 to-slate-100 border-slate-200'

  const valueClasses =
    accent === 'green'
      ? 'text-green-600'
      : accent === 'blue'
        ? 'text-blue-600'
        : accent === 'purple'
          ? 'text-violet-600'
          : 'text-slate-700'

  return (
    <Card className={`bg-gradient-to-br ${accentClasses}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-slate-600 font-semibold">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${valueClasses}`}>{value}</div>
      </CardContent>
    </Card>
  )
}

function HostResultCard({
  host,
  expanded,
  onToggle,
}: {
  host: NmapHostResult
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
          <Server className="h-4 w-4 text-violet-600 shrink-0" />
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
          <PortSection title="TCP Ports" ports={host.tcp_ports} />
          <PortSection title="UDP Ports" ports={host.udp_ports} />

          {host.services && host.services.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-700">Detected Services</h4>
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
                  {host.services.map(svc => (
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
      )}
    </div>
  )
}

function PortSection({
  title,
  ports,
}: {
  title: string
  ports: NmapPortBinding[]
}) {
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
            <Badge key={`${p.address}-${p.port}`} variant="secondary" className="font-mono">
              {p.port}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
