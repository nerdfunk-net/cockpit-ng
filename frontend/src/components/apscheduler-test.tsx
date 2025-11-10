'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useApi } from '@/hooks/use-api'
import { Loader2, Play, Square, RefreshCw, Clock, CheckCircle, AlertCircle } from 'lucide-react'

interface SchedulerJob {
  id: string
  name: string
  next_run: string | null
  trigger: string
}

interface SchedulerStatus {
  scheduler_running: boolean
  total_jobs: number
  jobs: SchedulerJob[]
  error?: string
}

interface JobResult {
  job_id?: string
  status?: string
  message?: string
  error?: string
}

export default function APSchedulerTest() {
  const { apiCall } = useApi()
  const [isStarting, setIsStarting] = useState(false)
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastResult, setLastResult] = useState<JobResult | null>(null)

  // Auto-refresh scheduler status every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading && !isStarting) {
        refreshStatus()
      }
    }, 5000)

    // Initial load
    refreshStatus()

    return () => clearInterval(interval)
  }, [loading, isStarting])

  const startParallelJob = async () => {
    setIsStarting(true)
    setLastResult(null)
    try {
      const result = await apiCall('jobs/compare-devices', {
        method: 'POST'
      })
      setLastResult(result as JobResult)
      console.log('Started APScheduler job:', result)
      await refreshStatus()
    } catch (error) {
      console.error('Error starting parallel job:', error)
      setLastResult({ error: String(error) })
    } finally {
      setIsStarting(false)
    }
  }

  const refreshStatus = async () => {
    setLoading(true)
    try {
      const status = await apiCall<SchedulerStatus>('jobs/scheduler-status')
      setSchedulerStatus(status)
    } catch (error) {
      console.error('Error getting scheduler status:', error)
      setSchedulerStatus({
        scheduler_running: false,
        total_jobs: 0,
        jobs: [],
        error: String(error)
      })
    } finally {
      setLoading(false)
    }
  }

  const cancelJob = async (jobId: string) => {
    try {
      await apiCall(`jobs/${jobId}/cancel`, {
        method: 'DELETE'
      })
      console.log(`Cancelled job: ${jobId}`)
      await refreshStatus()
    } catch (error) {
      console.error('Error cancelling job:', error)
      alert(`Error cancelling job: ${error}`)
    }
  }

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return 'N/A'
    try {
      return new Date(dateStr).toLocaleString()
    } catch {
      return dateStr
    }
  }

  const getStatusIcon = (running: boolean) => {
    return running ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <AlertCircle className="h-4 w-4 text-red-500" />
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            APScheduler Testing
            <Button
              variant="outline"
              size="sm"
              onClick={refreshStatus}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Control Panel */}
          <div className="flex gap-2">
            <Button
              onClick={startParallelJob}
              disabled={isStarting || loading}
              className="flex items-center gap-2"
            >
              {isStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Start Parallel Job
            </Button>
          </div>

          {/* Last Result */}
          {lastResult && (
            <div className="p-3 border rounded-md bg-gray-50">
              <h4 className="font-semibold text-sm mb-2">Last Job Result:</h4>
              {lastResult.error ? (
                <div className="text-red-600 text-sm font-mono">
                  Error: {lastResult.error}
                </div>
              ) : (
                <div className="space-y-1 text-sm">
                  <div><strong>Job ID:</strong> <span className="font-mono">{lastResult.job_id}</span></div>
                  <div><strong>Status:</strong> <Badge variant="outline">{lastResult.status}</Badge></div>
                  <div><strong>Message:</strong> {lastResult.message}</div>
                </div>
              )}
            </div>
          )}

          {/* Scheduler Status */}
          {schedulerStatus && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {getStatusIcon(schedulerStatus.scheduler_running)}
                <span className="font-medium">
                  Scheduler Status:
                </span>
                <Badge variant={schedulerStatus.scheduler_running ? "default" : "destructive"}>
                  {schedulerStatus.scheduler_running ? "Running" : "Stopped"}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="font-medium">Total Jobs:</span>
                <Badge variant="secondary">{schedulerStatus.total_jobs}</Badge>
              </div>

              {schedulerStatus.error && (
                <div className="text-red-600 text-sm p-2 bg-red-50 border border-red-200 rounded">
                  <strong>Error:</strong> {schedulerStatus.error}
                </div>
              )}
              
              {/* Job List */}
              {schedulerStatus.jobs.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Active Jobs:</h4>
                  {schedulerStatus.jobs.map((job: SchedulerJob) => (
                    <div key={job.id} className="flex items-center justify-between p-3 border rounded bg-white">
                      <div className="flex-1">
                        <div className="font-mono text-sm font-medium">{job.id}</div>
                        <div className="text-xs text-gray-500 mt-1">{job.name}</div>
                        <div className="text-xs text-gray-400">
                          Next run: {formatDateTime(job.next_run)}
                        </div>
                        <div className="text-xs text-gray-400">
                          Trigger: {job.trigger}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => cancelJob(job.id)}
                        className="ml-2"
                      >
                        <Square className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {schedulerStatus.total_jobs === 0 && !schedulerStatus.error && (
                <div className="text-gray-500 text-center py-4 italic">
                  No active jobs
                </div>
              )}
            </div>
          )}

          {!schedulerStatus && !loading && (
            <div className="text-gray-500 text-center py-4">
              Click refresh to load scheduler status
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
