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
import { useAuthStore } from '@/lib/auth-store'
import { useToast } from '@/hooks/use-toast'

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
  const { token } = useAuthStore()
  const { toast } = useToast()

  const [taskStatus, setTaskStatus] = useState<string>('PENDING')
  const [taskResult, setTaskResult] = useState<TaskResult | null>(null)
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [polling, setPolling] = useState(true)

  // Fetch task status
  const fetchTaskStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/proxy/celery/tasks/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

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
  }, [taskId, token, toast])

  // Poll task status
  useEffect(() => {
    if (!polling) return

    fetchTaskStatus()
    const interval = setInterval(fetchTaskStatus, 2000)

    return () => clearInterval(interval)
  }, [polling, fetchTaskStatus])

  // Calculate progress percentage
  const progressPercentage = useMemo(() => {
    if (taskStatus === 'SUCCESS') return 100
    if (progress?.total && progress?.current) {
      return Math.round((progress.current / progress.total) * 100)
    }
    return 0
  }, [taskStatus, progress])

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="!max-w-6xl max-h-[85vh] overflow-y-auto w-[90vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Wifi className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-gray-900">
              Ping Network Results
            </span>
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
          <div className="space-y-4 bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <span className="text-sm font-medium text-slate-700">
                {progress?.status || 'Starting...'}
              </span>
            </div>
            <Progress value={progressPercentage} className="w-full [&>div]:bg-blue-600" />
            <div className="text-sm text-slate-600 font-medium">
              {progress?.current || 0} / {progress?.total || 0} processed
            </div>
          </div>
        )}

        {/* Results Section */}
        {taskStatus === 'SUCCESS' && taskResult && taskResult.success && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-4 gap-4">
              <Card className="border-blue-200 bg-gradient-to-br from-slate-50 to-slate-100">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-600 font-semibold">Total IPs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-700">{taskResult.total_ips_scanned}</div>
                </CardContent>
              </Card>
              <Card className="border-blue-200 bg-gradient-to-br from-slate-50 to-slate-100">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-600 font-semibold">Networks</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-700">{taskResult.total_networks}</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-300 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-green-700 font-semibold">Reachable</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {taskResult.total_reachable}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-300 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-red-700 font-semibold">Unreachable</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {taskResult.total_unreachable}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Network Results */}
            <div className="space-y-4">
              {taskResult.networks.map((network) => (
                <Card key={network.network} className="border-l-4 border-l-blue-500 shadow-md hover:shadow-lg transition-shadow overflow-hidden p-0">
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 border-b-0 rounded-none m-0 py-3 px-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-mono text-slate-700">{network.network}</CardTitle>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 font-semibold shadow-sm">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          {network.reachable_count}
                        </Badge>
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 font-semibold shadow-sm">
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
                        <h4 className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-2 bg-green-50 p-2 rounded-md border border-green-200">
                          <Wifi className="w-4 h-4" />
                          Reachable ({network.reachable_count})
                        </h4>
                        <div className="grid grid-cols-1 gap-2">
                          {network.reachable.map((host) => (
                            <div
                              key={host.ip}
                              className="flex items-center justify-between p-3 bg-green-50 rounded-md border border-green-200 hover:border-green-300 transition-colors shadow-sm"
                            >
                              <span className="font-mono text-sm font-medium text-slate-700">{host.ip}</span>
                              {host.hostname && (
                                <span className="text-sm text-slate-600 font-medium">({host.hostname})</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Unreachable IPs */}
                    {network.unreachable.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2 bg-red-50 p-2 rounded-md border border-red-200">
                          <WifiOff className="w-4 h-4" />
                          Unreachable ({network.unreachable_count})
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {network.unreachable.map((ipRange) => (
                            <Badge
                              key={ipRange}
                              variant="outline"
                              className="bg-red-50 text-red-700 border-red-300 font-mono font-semibold shadow-sm hover:shadow transition-shadow"
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
          <Card className="bg-red-50 border-red-300 shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="bg-red-100 p-2 rounded-lg">
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                </div>
                <div>
                  <p className="font-semibold text-red-800 mb-1 text-lg">Task Failed</p>
                  <p className="text-sm text-red-700 font-medium">{taskResult.error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
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
