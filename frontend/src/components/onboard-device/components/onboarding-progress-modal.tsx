'use client'

import { useEffect, useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle2, XCircle, AlertCircle, ExternalLink } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { useApi } from '@/hooks/use-api'

interface OnboardingProgressModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskId: string | null
  ipAddress: string
}

interface TaskProgress {
  stage?: string
  status?: string
  progress?: number
  device_id?: string
  device_name?: string
  job_id?: string
  job_url?: string
}

interface TaskStatus {
  task_id: string
  status: 'PENDING' | 'PROGRESS' | 'SUCCESS' | 'FAILURE' | 'REVOKED'
  result?: {
    success: boolean
    message?: string
    error?: string
    device_id?: string
    device_name?: string
    ip_address?: string
    job_id?: string
    job_url?: string
    tags_applied?: number
    custom_fields_applied?: number
    stage?: string
    sync_result?: {
      success: boolean
      job_url?: string
    }
  }
  error?: string
  progress?: TaskProgress
}

const STAGE_DESCRIPTIONS: Record<string, string> = {
  onboarding: 'Initiating device onboarding...',
  waiting: 'Waiting for Nautobot onboarding job...',
  device_lookup: 'Device onboarded, retrieving device information...',
  updating: 'Updating device with tags and custom fields...',
  syncing: 'Syncing network data from device...',
  completed: 'Device onboarding, configuration, and sync completed successfully!',
  onboarding_failed: 'Onboarding job failed',
  device_lookup_failed: 'Failed to retrieve device information',
  update_partial_success: 'Device onboarded but some updates failed',
  exception: 'An unexpected error occurred'
}

export function OnboardingProgressModal({
  open,
  onOpenChange,
  taskId,
  ipAddress
}: OnboardingProgressModalProps) {
  const { apiCall } = useApi()
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [pollCount, setPollCount] = useState(0)

  const pollTaskStatus = useCallback(async () => {
    if (!taskId) return

    try {
      const status = await apiCall<TaskStatus>(`celery/tasks/${taskId}`, {
        method: 'GET'
      })

      setTaskStatus(status)

      // Stop polling if task is complete (success, failure, or revoked)
      if (['SUCCESS', 'FAILURE', 'REVOKED'].includes(status.status)) {
        setIsPolling(false)
      }
    } catch (error) {
      console.error('Error polling task status:', error)
      setIsPolling(false)
    }
  }, [taskId, apiCall])

  // Start polling when modal opens with a task ID
  // Using setTimeout to defer state updates to avoid synchronous setState in effect
  useEffect(() => {
    if (!open || !taskId) {
      return
    }
    // Defer state updates to next tick to satisfy lint rule
    const timeoutId = setTimeout(() => {
      setIsPolling(true)
      setPollCount(0)
      setTaskStatus(null)
    }, 0)
    return () => clearTimeout(timeoutId)
  }, [open, taskId])

  // Poll for task status
  useEffect(() => {
    if (!open || !taskId || !isPolling) {
      return
    }

    // Use setTimeout for initial poll to avoid synchronous setState in effect
    const initialPollTimeout = setTimeout(() => {
      pollTaskStatus()
    }, 0)

    const interval = setInterval(() => {
      pollTaskStatus()
      setPollCount(prev => prev + 1)
    }, 2000) // Poll every 2 seconds

    return () => {
      clearTimeout(initialPollTimeout)
      clearInterval(interval)
    }
  }, [open, taskId, isPolling, pollTaskStatus])

  const getStatusIcon = () => {
    if (!taskStatus) return <Loader2 className="h-6 w-6 animate-spin text-blue-500" />

    switch (taskStatus.status) {
      case 'SUCCESS':
        return <CheckCircle2 className="h-6 w-6 text-green-500" />
      case 'FAILURE':
      case 'REVOKED':
        return <XCircle className="h-6 w-6 text-red-500" />
      case 'PROGRESS':
        return <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      default:
        return <AlertCircle className="h-6 w-6 text-yellow-500" />
    }
  }

  const getProgressValue = () => {
    if (taskStatus?.status === 'SUCCESS') return 100
    if (taskStatus?.status === 'FAILURE') return 0
    if (taskStatus?.progress?.progress) return taskStatus.progress.progress
    return 0
  }

  const getStatusMessage = () => {
    if (!taskStatus) return 'Initializing onboarding task...'

    if (taskStatus.status === 'SUCCESS' && taskStatus.result) {
      return taskStatus.result.message || 'Device onboarded successfully!'
    }

    if (taskStatus.status === 'FAILURE') {
      return taskStatus.error || taskStatus.result?.error || 'Onboarding failed'
    }

    if (taskStatus.status === 'PROGRESS' && taskStatus.progress) {
      const stage = taskStatus.progress.stage || ''
      return taskStatus.progress.status || STAGE_DESCRIPTIONS[stage] || 'Processing...'
    }

    if (taskStatus.status === 'PENDING') {
      return 'Task queued, waiting to start...'
    }

    return 'Processing...'
  }

  const handleClose = () => {
    setIsPolling(false)
    onOpenChange(false)
  }

  const canClose = !isPolling || taskStatus?.status === 'SUCCESS' || taskStatus?.status === 'FAILURE' || taskStatus?.status === 'REVOKED'

  return (
    <Dialog open={open} onOpenChange={canClose ? onOpenChange : undefined}>
      <DialogContent className="sm:max-w-[500px]" onPointerDownOutside={(e) => !canClose && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getStatusIcon()}
            Device Onboarding Progress
          </DialogTitle>
          <DialogDescription>
            Onboarding device with IP: {ipAddress}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress value={getProgressValue()} className="h-2" />
            <p className="text-sm text-muted-foreground text-center">
              {getProgressValue()}% complete
            </p>
          </div>

          {/* Status Message */}
          <div className="rounded-lg border p-4 bg-muted/50">
            <p className="text-sm">
              {getStatusMessage()}
            </p>
          </div>

          {/* Device Details (when available) */}
          {taskStatus?.progress?.device_name && (
            <div className="rounded-lg border p-3 bg-background">
              <h4 className="text-sm font-medium mb-2">Device Information</h4>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p><span className="font-medium">Name:</span> {taskStatus.progress.device_name}</p>
                {taskStatus.progress.device_id && (
                  <p className="font-mono text-xs"><span className="font-medium">ID:</span> {taskStatus.progress.device_id}</p>
                )}
              </div>
            </div>
          )}

          {/* Success Result Details */}
          {taskStatus?.status === 'SUCCESS' && taskStatus.result && (
            <div className="rounded-lg border p-3 bg-green-50 dark:bg-green-950/20">
              <h4 className="text-sm font-medium mb-2 text-green-900 dark:text-green-100">
                Onboarding Complete!
              </h4>
              <div className="space-y-1 text-sm text-green-800 dark:text-green-200">
                {taskStatus.result.device_name && (
                  <p><span className="font-medium">Device:</span> {taskStatus.result.device_name}</p>
                )}
                {taskStatus.result.tags_applied !== undefined && taskStatus.result.tags_applied > 0 && (
                  <p><span className="font-medium">Tags applied:</span> {taskStatus.result.tags_applied}</p>
                )}
                {taskStatus.result.custom_fields_applied !== undefined && taskStatus.result.custom_fields_applied > 0 && (
                  <p><span className="font-medium">Custom fields applied:</span> {taskStatus.result.custom_fields_applied}</p>
                )}
                {taskStatus.result.sync_result && (
                  <p><span className="font-medium">Network sync:</span> {taskStatus.result.sync_result.success ? '✓ Completed' : '✗ Failed'}</p>
                )}
                {taskStatus.result.job_url && (
                  <p className="flex items-center gap-1 pt-2">
                    <a
                      href={taskStatus.result.job_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1"
                    >
                      View Onboarding Job <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>
                )}
                {taskStatus.result.sync_result?.job_url && (
                  <p className="flex items-center gap-1">
                    <a
                      href={taskStatus.result.sync_result.job_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1"
                    >
                      View Sync Job <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Error Details */}
          {taskStatus?.status === 'FAILURE' && (
            <div className="rounded-lg border p-3 bg-red-50 dark:bg-red-950/20">
              <h4 className="text-sm font-medium mb-2 text-red-900 dark:text-red-100">
                Onboarding Failed
              </h4>
              <p className="text-sm text-red-800 dark:text-red-200">
                {taskStatus.error || taskStatus.result?.error || 'An unknown error occurred'}
              </p>
              {taskStatus.result?.job_url && (
                <p className="flex items-center gap-1 pt-2">
                  <a
                    href={taskStatus.result.job_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1 text-xs"
                  >
                    View Nautobot Job <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              )}
            </div>
          )}

          {/* Debug Info (for development) */}
          {process.env.NODE_ENV === 'development' && taskStatus && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Debug Info</summary>
              <pre className="mt-2 p-2 bg-muted rounded overflow-x-auto overflow-y-auto max-h-40 whitespace-pre-wrap break-all text-[10px]">
                {JSON.stringify(taskStatus, null, 2)}
              </pre>
            </details>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-2">
          {isPolling && (
            <p className="text-xs text-muted-foreground mr-auto flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Polling status... ({pollCount})
            </p>
          )}
          <Button
            onClick={handleClose}
            disabled={!canClose}
            variant={taskStatus?.status === 'SUCCESS' ? 'default' : 'outline'}
          >
            {taskStatus?.status === 'SUCCESS' ? 'Done' : 'Close'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
