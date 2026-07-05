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
import { Loader2, CheckCircle, XCircle, Wifi, WifiOff, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { IconChip } from '@/components/shared/icon-chip'

const EMPTY_NETWORKS: NetworkResult[] = []

interface NetworkResult {
  network: string
  total_ips: number
  reachable_count: number
  unreachable_count: number
  reachable: Array<{ ip: string; hostname?: string }>
  unreachable: string[]
}

interface TaskResult {
  success: boolean
  networks: NetworkResult[]
  total_networks: number
  total_ips_scanned: number
  total_reachable: number
  total_unreachable: number
  resolve_dns: boolean
  error?: string
}

interface ProgressData {
  current?: number
  total?: number
  status?: string
}

interface PingResultsModalProps {
  taskId: string
  onClose: () => void
}

export default function PingResultsModal({ taskId, onClose }: PingResultsModalProps) {
  const { toast } = useToast()

  const [taskStatus, setTaskStatus] = useState<string>('PENDING')
  const [taskResult, setTaskResult] = useState<TaskResult | null>(null)
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [polling, setPolling] = useState(true)

  // Fetch task status
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
          total_networks: 0,
          total_ips_scanned: 0,
          total_reachable: 0,
          total_unreachable: 0,
          resolve_dns: false,
        })
        setPolling(false)
        toast({
          title: 'Task Failed',
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

  // Poll task status
  useEffect(() => {
    if (!polling) return

    fetchTaskStatus()
    const interval = setInterval(fetchTaskStatus, 2000)

    return () => clearInterval(interval)
  }, [polling, fetchTaskStatus])

  // Calculate progress percentage
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
            <IconChip variant="primary">
              <Wifi className="w-5 h-5" />
            </IconChip>
            <span className="text-foreground">Ping Network Results</span>
          </DialogTitle>
          <DialogDescription>
            {taskStatus === 'PENDING' && '⏳ Task is queued and waiting to start...'}
            {taskStatus === 'PROGRESS' && '🔄 Pinging networks...'}
            {taskStatus === 'SUCCESS' && '✅ Ping completed'}
            {taskStatus === 'FAILURE' && '❌ Ping failed'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Section */}
        {(taskStatus === 'PENDING' || taskStatus === 'PROGRESS') && (
          <div className="space-y-4 bg-info p-6 rounded-lg border border-info-border">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm font-medium text-info-foreground">
                {progress?.status || 'Starting...'}
              </span>
            </div>
            <Progress
              value={progressPercentage}
              className="w-full [&>div]:bg-primary"
            />
            <div className="text-sm text-info-foreground font-medium">
              {progress?.current || 0} / {progress?.total || 0} processed
            </div>
          </div>
        )}

        {/* Results Section */}
        {taskStatus === 'SUCCESS' && taskResult && taskResult.success && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-4 gap-4">
              <Card className="border-border bg-muted">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground font-semibold">
                    Total IPs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {taskResult.total_ips_scanned}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border bg-muted">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground font-semibold">
                    Networks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {taskResult.total_networks}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-success border-success-border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-success-foreground font-semibold">
                    Reachable
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success-foreground">
                    {taskResult.total_reachable}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-error border-error-border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-error-foreground font-semibold">
                    Unreachable
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-error-foreground">
                    {taskResult.total_unreachable}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Network Results */}
            <div className="space-y-4">
              {taskResult.networks.map(network => (
                <Card
                  key={network.network}
                  className="border-l-4 border-l-primary shadow-md hover:shadow-lg transition-shadow overflow-hidden p-0"
                >
                  <CardHeader className="bg-info border-b-0 rounded-none m-0 py-3 px-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-mono text-info-foreground">
                        {network.network}
                      </CardTitle>
                      <div className="flex gap-2">
                        <Badge
                          variant="outline"
                          className="status-success border font-semibold shadow-sm"
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          {network.reachable_count}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="status-error border font-semibold shadow-sm"
                        >
                          <XCircle className="w-3 h-3 mr-1" />
                          {network.unreachable_count}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Reachable IPs */}
                    {network.reachable.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-success-foreground mb-3 flex items-center gap-2 bg-success p-2 rounded-md border border-success-border">
                          <Wifi className="w-4 h-4" />
                          Reachable ({network.reachable_count})
                        </h4>
                        <div className="grid grid-cols-1 gap-2">
                          {network.reachable.map(host => (
                            <div
                              key={host.ip}
                              className="flex items-center justify-between p-3 bg-success rounded-md border border-success-border transition-colors shadow-sm"
                            >
                              <span className="font-mono text-sm font-medium text-success-foreground">
                                {host.ip}
                              </span>
                              {host.hostname && (
                                <span className="text-sm text-success-foreground font-medium">
                                  ({host.hostname})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Unreachable IPs */}
                    {network.unreachable.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-error-foreground mb-3 flex items-center gap-2 bg-error p-2 rounded-md border border-error-border">
                          <WifiOff className="w-4 h-4" />
                          Unreachable ({network.unreachable_count})
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {network.unreachable.map(ipRange => (
                            <Badge
                              key={ipRange}
                              variant="outline"
                              className="status-error border font-mono font-semibold shadow-sm hover:shadow transition-shadow"
                            >
                              {ipRange}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Error Section */}
        {taskStatus === 'FAILURE' && taskResult && !taskResult.success && (
          <Card className="status-error shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <IconChip variant="error">
                  <XCircle className="w-5 h-5 flex-shrink-0" />
                </IconChip>
                <div>
                  <p className="font-semibold text-error-foreground mb-1 text-lg">
                    Task Failed
                  </p>
                  <p className="text-sm text-error-foreground font-medium">
                    {taskResult.error}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} className="font-medium">
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
