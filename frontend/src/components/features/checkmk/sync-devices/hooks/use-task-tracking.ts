import { useState, useCallback, useEffect, useRef } from 'react'
import { useApi } from '@/hooks/use-api'
import type { DeviceTask, CeleryTaskStatus } from '@/types/features/checkmk/sync-devices'

interface UseTaskTrackingProps {
  onTaskSuccess?: () => void
  showMessage: (text: string, type: 'success' | 'error' | 'info') => void
}

export function useTaskTracking({ onTaskSuccess, showMessage }: UseTaskTrackingProps) {
  const { apiCall } = useApi()
  const [activeTasks, setActiveTasks] = useState<Map<string, DeviceTask>>(new Map())
  const [expandedErrorTasks, setExpandedErrorTasks] = useState<Set<string>>(new Set())
  const pollingIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Poll Celery task status
  const pollTaskStatus = useCallback(async (taskId: string) => {
    try {
      const response = await apiCall<CeleryTaskStatus>(`celery/tasks/${taskId}`)

      if (response) {
        let shouldStopPolling = false

        // Update task in activeTasks and check if we should stop polling
        setActiveTasks(prev => {
          const task = prev.get(taskId)
          if (!task) return prev

          const updated = new Map(prev)

          // Extract batch progress if available
          const batchProgress = response.progress?.current && response.progress?.total ? {
            current: response.progress.current,
            total: response.progress.total,
            success: Number(response.progress.success) || 0,
            failed: Number(response.progress.failed) || 0
          } : undefined

          updated.set(taskId, {
            ...task,
            status: response.status,
            message: response.progress?.status || response.result?.message || task.message,
            batchProgress
          })

          // Check if task is complete
          if (response.status === 'SUCCESS' || response.status === 'FAILURE') {
            shouldStopPolling = true
          }

          return updated
        })

        // Handle completion or failure
        if (shouldStopPolling) {
          // Stop polling immediately using ref
          const interval = pollingIntervalsRef.current.get(taskId)
          if (interval) {
            clearInterval(interval)
            pollingIntervalsRef.current.delete(taskId)
          }

          // Handle success/failure states
          // Check both Celery status AND result.success field
          const taskSucceeded = response.status === 'SUCCESS' && response.result?.success !== false
          const taskFailed = response.status === 'FAILURE' || (response.status === 'SUCCESS' && response.result?.success === false)

          if (taskSucceeded) {
            if (onTaskSuccess) {
              onTaskSuccess()
            }
            // Remove task after 1 second on success
            setTimeout(() => {
              setActiveTasks(prev => {
                const updated = new Map(prev)
                updated.delete(taskId)
                return updated
              })
            }, 1000)
          } else if (taskFailed) {
            // Mark task as failed in the UI
            setActiveTasks(prev => {
              const task = prev.get(taskId)
              if (!task) return prev

              // Extract error message from result
              let errorMessage = response.result?.message || response.error || task.message

              // If there are failed results, extract the first error for display
              if (response.result?.results && Array.isArray(response.result.results)) {
                const failedResult = response.result.results.find((r: { success: boolean; error?: string }) => r.success === false)
                if (failedResult?.error) {
                  errorMessage = failedResult.error
                }
              }

              const updated = new Map(prev)
              updated.set(taskId, {
                ...task,
                status: 'FAILURE',
                message: errorMessage
              })
              return updated
            })
            // Keep failed tasks visible - don't auto-remove
            // They will stay in the panel showing the error
          }
        }
      }
    } catch (err) {
      console.error(`Error polling task ${taskId}:`, err)
      // Stop polling on error using ref
      const interval = pollingIntervalsRef.current.get(taskId)
      if (interval) {
        clearInterval(interval)
        pollingIntervalsRef.current.delete(taskId)
      }
    }
  }, [apiCall, onTaskSuccess])

  // Start tracking a Celery task
  const trackTask = useCallback((
    taskId: string,
    deviceId: string | string[],
    deviceName: string,
    operation: 'add' | 'update' | 'sync'
  ) => {
    const task: DeviceTask = {
      taskId,
      deviceId,
      deviceName,
      operation,
      status: 'PENDING',
      message: `${operation === 'add' ? 'Adding' : operation === 'update' ? 'Updating' : 'Syncing'} ${deviceName}...`,
      startedAt: new Date()
    }

    setActiveTasks(prev => new Map(prev).set(taskId, task))

    // Start polling for this task using ref
    const interval = setInterval(() => {
      void pollTaskStatus(taskId)
    }, 2000) // Poll every 2 seconds

    pollingIntervalsRef.current.set(taskId, interval)

    // Initial poll
    void pollTaskStatus(taskId)
  }, [pollTaskStatus])

  // Cancel a running task
  const cancelTask = useCallback(async (taskId: string) => {
    try {
      await apiCall(`celery/tasks/${taskId}`, {
        method: 'DELETE'
      })

      // Stop polling
      const interval = pollingIntervalsRef.current.get(taskId)
      if (interval) {
        clearInterval(interval)
        pollingIntervalsRef.current.delete(taskId)
      }

      // Update task state to cancelled
      setActiveTasks(prev => {
        const task = prev.get(taskId)
        if (!task) return prev

        const updated = new Map(prev)
        updated.set(taskId, {
          ...task,
          status: 'REVOKED',
          message: 'Task cancelled by user'
        })
        return updated
      })

      // Remove task after a short delay
      setTimeout(() => {
        setActiveTasks(prev => {
          const updated = new Map(prev)
          updated.delete(taskId)
          return updated
        })
      }, 2000)

    } catch (err) {
      console.error(`Failed to cancel task ${taskId}:`, err)
      showMessage('Failed to cancel task', 'error')
    }
  }, [apiCall, showMessage])

  // Toggle error details expansion
  const toggleErrorDetails = useCallback((taskId: string) => {
    setExpandedErrorTasks(prev => {
      const newSet = new Set(prev)
      if (newSet.has(taskId)) {
        newSet.delete(taskId)
      } else {
        newSet.add(taskId)
      }
      return newSet
    })
  }, [])

  // Dismiss a failed task
  const dismissTask = useCallback((taskId: string) => {
    // Stop polling if still active
    const interval = pollingIntervalsRef.current.get(taskId)
    if (interval) {
      clearInterval(interval)
      pollingIntervalsRef.current.delete(taskId)
    }

    // Remove task from active tasks
    setActiveTasks(prev => {
      const updated = new Map(prev)
      updated.delete(taskId)
      return updated
    })

    // Also remove from expanded errors if present
    setExpandedErrorTasks(prev => {
      const newSet = new Set(prev)
      newSet.delete(taskId)
      return newSet
    })
  }, [])

  // Cleanup all polling intervals on unmount
  useEffect(() => {
    const intervals = pollingIntervalsRef.current
    return () => {
      intervals.forEach(interval => clearInterval(interval))
      intervals.clear()
    }
  }, [])

  return {
    activeTasks,
    expandedErrorTasks,
    trackTask,
    cancelTask,
    dismissTask,
    toggleErrorDetails
  }
}
