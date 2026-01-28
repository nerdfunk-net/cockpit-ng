import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type {
  CeleryStatus,
  CelerySettings,
  WorkersData,
  TaskStatus,
  Schedule,
  QueueMetrics,
  CeleryStatusResponse,
  CelerySettingsResponse,
  CeleryWorkersResponse,
  CelerySchedulesResponse,
  CeleryQueuesResponse
} from '../types'
import { STALE_TIME, DEFAULT_CELERY_SETTINGS, EMPTY_SCHEDULES, TASK_POLL_INTERVAL } from '../utils/constants'
import { isTaskActive } from '../utils/celery-utils'

interface UseCeleryStatusOptions {
  enabled?: boolean
}

interface UseQueryOptions {
  enabled?: boolean
}

const DEFAULT_STATUS_OPTIONS: UseCeleryStatusOptions = { enabled: true }
const DEFAULT_QUERY_OPTIONS: UseQueryOptions = {}

/**
 * Fetch Celery status with automatic caching
 */
export function useCeleryStatus(options: UseCeleryStatusOptions = DEFAULT_STATUS_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery<CeleryStatus>({
    queryKey: queryKeys.celery.status(),
    queryFn: async () => {
      const response = await apiCall<CeleryStatusResponse>('/api/celery/status', { method: 'GET' })
      if (!response?.success) {
        throw new Error('Failed to load Celery status')
      }
      return response.status
    },
    enabled,
    staleTime: STALE_TIME.STATUS,
  })
}

/**
 * Fetch Celery settings with automatic caching
 */
export function useCelerySettings(options: UseQueryOptions = DEFAULT_QUERY_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery<CelerySettings>({
    queryKey: queryKeys.celery.settings(),
    queryFn: async () => {
      const response = await apiCall<CelerySettingsResponse>('/api/celery/settings', { method: 'GET' })
      if (!response?.success || !response.settings) {
        throw new Error('Failed to load Celery settings')
      }
      return {
        ...DEFAULT_CELERY_SETTINGS,
        ...response.settings
      } as CelerySettings
    },
    enabled,
    staleTime: STALE_TIME.SETTINGS,
  })
}

/**
 * Fetch Celery workers with automatic caching
 */
export function useCeleryWorkers(options: UseQueryOptions = DEFAULT_QUERY_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery<WorkersData>({
    queryKey: queryKeys.celery.workers(),
    queryFn: async () => {
      const response = await apiCall<CeleryWorkersResponse>('/api/celery/workers', { method: 'GET' })
      if (!response?.success || !response.workers) {
        throw new Error('Failed to load Celery workers')
      }
      return response.workers
    },
    enabled,
    staleTime: STALE_TIME.WORKERS,
  })
}

/**
 * Fetch Celery schedules with automatic caching
 */
export function useCelerySchedules(options: UseQueryOptions = DEFAULT_QUERY_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery<Schedule[]>({
    queryKey: queryKeys.celery.schedules(),
    queryFn: async () => {
      const response = await apiCall<CelerySchedulesResponse>('/api/celery/schedules', { method: 'GET' })
      if (!response?.success) {
        throw new Error('Failed to load Celery schedules')
      }
      return response.schedules || EMPTY_SCHEDULES
    },
    enabled,
    staleTime: STALE_TIME.SCHEDULES,
  })
}

/**
 * Fetch Celery queues with metrics and worker assignments
 */
export function useCeleryQueues(options: UseQueryOptions = DEFAULT_QUERY_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery<QueueMetrics[]>({
    queryKey: queryKeys.celery.queues(),
    queryFn: async () => {
      const response = await apiCall<CeleryQueuesResponse>('/api/celery/queues', { method: 'GET' })
      if (!response?.success) {
        throw new Error('Failed to load Celery queues')
      }
      return response.queues || []
    },
    enabled,
    staleTime: STALE_TIME.WORKERS, // Same freshness as workers
  })
}

/**
 * Fetch task status with automatic polling
 * CRITICAL: Fixes manual polling bug - uses TanStack Query refetchInterval
 */
export function useTaskStatus(taskId: string | null, options: UseQueryOptions = DEFAULT_QUERY_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery<TaskStatus>({
    queryKey: queryKeys.celery.task(taskId!),
    queryFn: async () => {
      const response = await apiCall<TaskStatus>(`/api/celery/tasks/${taskId}`, { method: 'GET' })
      return response
    },
    enabled: enabled && !!taskId,
    staleTime: STALE_TIME.TASK,
    // Auto-polling: stops when task completes (SUCCESS, FAILURE, REVOKED)
    refetchInterval: (query) => {
      const status = query.state.data?.status
      // Stop polling if task is done, otherwise poll every 2s
      return isTaskActive(status) ? TASK_POLL_INTERVAL : false
    },
  })
}
