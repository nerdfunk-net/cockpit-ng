'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'

const TERMINAL_STATUSES = ['SUCCESS', 'FAILURE', 'REVOKED']

interface TaskStatusData {
  task_id: string
  status: string
  progress?: { current?: number; total?: number; status?: string }
  result?: unknown
  error?: string
}

interface CsvProcessingStepProps {
  taskId: string
  onComplete: (status: string, result: unknown, error: string | undefined) => void
}

export function CsvProcessingStep({ taskId, onComplete }: CsvProcessingStepProps) {
  const { apiCall } = useApi()

  const { data: taskStatus } = useQuery<TaskStatusData>({
    queryKey: ['csv-update-task', taskId],
    queryFn: () => apiCall(`celery/tasks/${taskId}`),
    enabled: !!taskId,
    refetchInterval: query => {
      const status = (query.state.data as TaskStatusData | undefined)?.status
      if (status && TERMINAL_STATUSES.includes(status)) return false
      return 2000
    },
    staleTime: 0,
  })

  useEffect(() => {
    if (taskStatus && TERMINAL_STATUSES.includes(taskStatus.status)) {
      onComplete(taskStatus.status, taskStatus.result, taskStatus.error)
    }
  }, [taskStatus, onComplete])

  const progress = taskStatus?.progress as
    | { current?: number; total?: number; status?: string }
    | undefined
  const progressPercent =
    progress?.current && progress?.total
      ? Math.round((progress.current / progress.total) * 100)
      : null

  const statusText = (() => {
    switch (taskStatus?.status) {
      case 'PENDING':
        return 'Task queued, waiting to start…'
      case 'STARTED':
        return 'Task started…'
      case 'PROGRESS':
        return (
          progress?.status ??
          (progress?.current && progress?.total
            ? `Processing ${progress.current} of ${progress.total} records…`
            : 'Processing…')
        )
      case 'SUCCESS':
        return 'Completed successfully'
      case 'FAILURE':
        return 'Task failed'
      case 'REVOKED':
        return 'Task was cancelled'
      default:
        return 'Connecting to task…'
    }
  })()

  const isTerminal = taskStatus && TERMINAL_STATUSES.includes(taskStatus.status)

  return (
    <div className="py-8 flex flex-col items-center gap-6">
      {/* Icon */}
      <div>
        {!isTerminal ? (
          <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
        ) : taskStatus?.status === 'SUCCESS' ? (
          <CheckCircle className="h-12 w-12 text-green-500" />
        ) : (
          <AlertTriangle className="h-12 w-12 text-red-500" />
        )}
      </div>

      {/* Status text */}
      <div className="text-center space-y-1">
        <p className="text-base font-medium text-gray-800">{statusText}</p>
        {!isTerminal && (
          <p className="text-xs text-gray-400">
            Task ID: <span className="font-mono">{taskId}</span>
          </p>
        )}
      </div>

      {/* Progress bar */}
      {progressPercent !== null && (
        <div className="w-full max-w-sm space-y-1">
          <Progress value={progressPercent} className="h-2" />
          <p className="text-xs text-center text-gray-500">
            {progress?.current} / {progress?.total} records
          </p>
        </div>
      )}

      {/* Error detail */}
      {taskStatus?.status === 'FAILURE' && taskStatus.error && (
        <Alert className="status-error w-full max-w-sm">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm break-all">
            {taskStatus.error}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
