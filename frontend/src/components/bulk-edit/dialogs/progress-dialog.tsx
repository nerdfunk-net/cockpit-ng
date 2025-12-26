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
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2, XCircle, AlertCircle, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { useApi } from '@/hooks/use-api'

interface JobStatus {
  id: number
  job_name: string
  job_type: string
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  queued_at: string
  started_at?: string
  completed_at?: string
  duration_seconds?: number
  error_message?: string
  result?: {
    devices_processed?: number
    successful_updates?: number
    failed_updates?: number
    skipped_updates?: number
  }
  triggered_by: string
}

interface ProgressDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobId: string | null
  taskId: string | null
  onJobComplete?: (status: JobStatus) => void
}

export function ProgressDialog({
  open,
  onOpenChange,
  jobId,
  taskId: _taskId,
  onJobComplete,
}: ProgressDialogProps) {
  const { apiCall } = useApi()
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [jobCompleted, setJobCompleted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Derive polling state from props and completion status
  const isPolling = useMemo(
    () => open && jobId !== null && !jobCompleted && !error,
    [open, jobId, jobCompleted, error]
  )

  const fetchJobStatus = useCallback(async () => {
    if (!jobId) return

    try {
      const data = await apiCall(`job-runs/${jobId}`) as JobStatus
      setJobStatus(data)

      // Stop polling if job is complete
      if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
        setJobCompleted(true)
        if (onJobComplete) {
          onJobComplete(data)
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch job status'
      setError(errorMessage)
    }
  }, [jobId, apiCall, onJobComplete])

  // Poll for job status updates (includes initial fetch)
  useEffect(() => {
    if (!isPolling) return

    // Fetch immediately on mount (in next tick to satisfy linter)
    const initialFetch = setTimeout(() => {
      fetchJobStatus()
    }, 0)

    // Then poll every 2 seconds
    const interval = setInterval(() => {
      fetchJobStatus()
    }, 2000)

    return () => {
      clearTimeout(initialFetch)
      clearInterval(interval)
    }
  }, [isPolling, fetchJobStatus])

  const handleClose = () => {
    setIsPolling(false)
    onOpenChange(false)
  }

  const getStatusIcon = () => {
    if (!jobStatus) return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />

    switch (jobStatus.status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />
      case 'running':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-600" />
    }
  }

  const getStatusColor = () => {
    if (!jobStatus) return 'text-blue-600'

    switch (jobStatus.status) {
      case 'completed':
        return 'text-green-600'
      case 'failed':
        return 'text-red-600'
      case 'running':
        return 'text-blue-600'
      default:
        return 'text-yellow-600'
    }
  }

  // Calculate progress percentage based on status
  const progressPercent = (() => {
    if (!jobStatus) return 0

    switch (jobStatus.status) {
      case 'completed':
        return 100
      case 'failed':
        return 100
      case 'running':
        // If we have result data, calculate based on that
        if (jobStatus.result?.devices_processed) {
          const total = (jobStatus.result.successful_updates || 0) +
                       (jobStatus.result.failed_updates || 0) +
                       (jobStatus.result.skipped_updates || 0)
          return total > 0 ? (jobStatus.result.devices_processed / total) * 100 : 50
        }
        return 50 // Default to 50% for running jobs without progress data
      case 'queued':
      case 'pending':
        return 10
      default:
        return 0
    }
  })()

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getStatusIcon()}
            <span>Bulk Update Progress</span>
          </DialogTitle>
          <DialogDescription>
            {jobId ? `Job ID: ${jobId}` : 'Updating devices...'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Error Display */}
          {error && (
            <Alert className="border-red-500 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className={`font-medium ${getStatusColor()}`}>
                {jobStatus?.status.toUpperCase() || 'LOADING'}
              </span>
              <span className="text-gray-600">{progressPercent.toFixed(0)}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>

          {/* Job Details */}
          {jobStatus && (
            <div className="space-y-3">
              {/* Device Counts */}
              {jobStatus.result && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="border rounded-lg p-3 text-center">
                    <div className="flex items-center justify-center mb-1">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="text-2xl font-bold text-green-600">
                      {jobStatus.result.successful_updates}
                    </div>
                    <div className="text-xs text-gray-600">Successful</div>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <div className="flex items-center justify-center mb-1">
                      <XCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="text-2xl font-bold text-red-600">
                      {jobStatus.result.failed_updates}
                    </div>
                    <div className="text-xs text-gray-600">Failed</div>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <div className="flex items-center justify-center mb-1">
                      <AlertCircle className="h-5 w-5 text-gray-600" />
                    </div>
                    <div className="text-2xl font-bold text-gray-600">
                      {jobStatus.result.devices_processed}
                    </div>
                    <div className="text-xs text-gray-600">Total Processed</div>
                  </div>
                </div>
              )}

              {/* Progress Info */}
              {jobStatus.result?.devices_processed !== undefined && (
                <div className="text-sm text-gray-600">
                  Processed {jobStatus.result.devices_processed} devices
                </div>
              )}

              {/* Error Message */}
              {jobStatus.error_message && (
                <Alert className="border-red-500 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">{jobStatus.error_message}</AlertDescription>
                </Alert>
              )}

              {/* Timestamps */}
              <div className="text-xs text-gray-500 space-y-1">
                {jobStatus.started_at && (
                  <div>Started: {new Date(jobStatus.started_at).toLocaleString()}</div>
                )}
                {jobStatus.completed_at && (
                  <div>Completed: {new Date(jobStatus.completed_at).toLocaleString()}</div>
                )}
              </div>
            </div>
          )}

          {/* View Full Job Details Link */}
          {jobId && (
            <div className="pt-4 border-t">
              <Link
                href={`/jobs/view?job_id=${jobId}`}
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline"
                onClick={handleClose}
              >
                <ExternalLink className="h-4 w-4" />
                View Full Job Details
              </Link>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            {(jobStatus?.status === 'completed' || jobStatus?.status === 'failed') && (
              <Button onClick={handleClose}>Close</Button>
            )}
            {jobStatus?.status === 'running' && (
              <Button variant="outline" onClick={handleClose}>
                Close (Running in Background)
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
