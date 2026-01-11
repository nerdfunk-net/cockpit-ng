import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

// Terminal job states that should stop polling
const TERMINAL_JOB_STATES = ['SUCCESS', 'FAILURE', 'REVOKED'] as const
type JobStatus = 'PENDING' | 'PROGRESS' | 'SUCCESS' | 'FAILURE' | 'REVOKED'

interface TaskProgress {
  stage?: string
  status?: string
  progress?: number
  device_id?: string
  device_name?: string
  job_id?: string
  job_url?: string
  device_count?: number
  current_device?: number
  current_ip?: string
  ip_addresses?: string[]
}

interface DeviceResult {
  success: boolean
  ip_address: string
  device_id?: string
  device_name?: string
  error?: string
  stage?: string
  update_results?: Array<{ success: boolean; type: string; message?: string; error?: string }>
  sync_result?: { success: boolean; job_url?: string }
}

interface TaskStatus {
  task_id: string
  status: JobStatus
  result?: {
    success: boolean
    partial_success?: boolean
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
    device_count?: number
    successful_devices?: number
    failed_devices?: number
    devices?: DeviceResult[]
    sync_result?: {
      success: boolean
      job_url?: string
    }
  }
  error?: string
  progress?: TaskProgress
}

interface UseJobQueryOptions {
  taskId: string | null
  pollInterval?: number
  enabled?: boolean
}

/**
 * Hook for polling job/task status using TanStack Query
 *
 * Automatically polls the Celery task endpoint every 2 seconds (configurable)
 * and stops polling when the task reaches a terminal state (SUCCESS, FAILURE, REVOKED)
 *
 * @param options.taskId - The Celery task ID to poll
 * @param options.pollInterval - Polling interval in milliseconds (default: 2000)
 * @param options.enabled - Whether to enable the query (default: true)
 *
 * @example
 * ```tsx
 * const { data: taskStatus, isLoading } = useJobQuery({
 *   taskId: '123-456-789',
 *   pollInterval: 2000
 * })
 *
 * // Polling automatically stops when task completes
 * if (taskStatus?.status === 'SUCCESS') {
 *   // Handle success
 * }
 * ```
 */
export function useJobQuery(options: UseJobQueryOptions) {
  const { apiCall } = useApi()
  const { taskId, pollInterval = 2000, enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.detail(taskId || ''),

    queryFn: async () => {
      if (!taskId) return null
      return apiCall<TaskStatus>(`celery/tasks/${taskId}`, { method: 'GET' })
    },

    // Only run if taskId exists and enabled
    enabled: !!taskId && enabled,

    // Polling logic: stops automatically when job completes
    refetchInterval: (query) => {
      const data = query.state.data

      // If no data yet, keep polling
      if (!data) return pollInterval

      // Stop polling if job reached terminal state
      if (TERMINAL_JOB_STATES.includes(data.status as typeof TERMINAL_JOB_STATES[number])) {
        return false
      }

      // Continue polling
      return pollInterval
    },

    // Don't cache job status (always fetch fresh)
    staleTime: 0,
  })
}

// Export types for use in components
export type { TaskStatus, TaskProgress, DeviceResult, JobStatus }
