import { useState, useRef, useEffect, useCallback } from 'react'
import type { JobProgress, CeleryTaskProgress, CeleryTaskResult } from '../types/sync-devices.types'
import { getCeleryTaskStatus, cancelCeleryTask } from '../api/sync-devices.api'

/**
 * Hook for managing Celery task polling and progress tracking
 */
export function useCeleryJobPolling(token: string | null, onTaskComplete?: (result: unknown) => void) {
  const [celeryTaskId, setCeleryTaskId] = useState<string | null>(null)
  const [jobProgress, setJobProgress] = useState<JobProgress | null>(null)
  const [isJobRunning, setIsJobRunning] = useState(false)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Poll task status
  const pollTaskStatus = useCallback(async (taskId: string) => {
    if (!token) return

    try {
      const data = await getCeleryTaskStatus(token, taskId)

      // Update progress from Celery task state
      if (data.progress || data.result) {
        const progress = (data.progress || {}) as CeleryTaskProgress
        const result = (data.result || {}) as CeleryTaskResult

        setJobProgress({
          processed: progress.current || result.completed || 0,
          total: progress.total || result.total || 0,
          message: progress.status || result.message || 'Processing...',
          status: data.status === 'SUCCESS' ? 'completed' :
                 data.status === 'FAILURE' ? 'failed' :
                 data.status === 'PROGRESS' ? 'running' : 'pending',
          current: progress.current,
          success: progress.completed || result.completed,
          failed: progress.failed || result.failed
        })
      }

      // If task completed or failed, stop polling
      if (data.status === 'SUCCESS' || data.status === 'FAILURE') {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
        setIsJobRunning(false)

        // Call completion callback if provided
        if (data.status === 'SUCCESS' && onTaskComplete) {
          onTaskComplete(data.result)
        }
      }
    } catch (error) {
      console.error('Error polling Celery task:', error)
    }
  }, [token, onTaskComplete])

  // Start polling a task
  const startPolling = useCallback((taskId: string) => {
    setCeleryTaskId(taskId)
    setIsJobRunning(true)
    setJobProgress({
      processed: 0,
      total: 0,
      message: 'Starting...',
      status: 'pending'
    })

    // Start polling interval
    pollingIntervalRef.current = setInterval(() => {
      pollTaskStatus(taskId)
    }, 2000) // Poll every 2 seconds

    // Initial poll
    pollTaskStatus(taskId)
  }, [pollTaskStatus])

  // Cancel task
  const cancelTask = useCallback(async () => {
    if (!celeryTaskId || !token) return

    try {
      await cancelCeleryTask(token, celeryTaskId)
      
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      setIsJobRunning(false)
      setCeleryTaskId(null)
      setJobProgress(null)
      
      return true
    } catch (error) {
      console.error('Error cancelling task:', error)
      return false
    }
  }, [celeryTaskId, token])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  return {
    celeryTaskId,
    jobProgress,
    isJobRunning,
    startPolling,
    cancelTask,
    pollTaskStatus
  }
}
