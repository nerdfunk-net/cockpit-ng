import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { JobSchedule, JobTemplate, Credential, SchedulerDebugInfo } from '../types'
import { STALE_TIME, EMPTY_SCHEDULES, EMPTY_TEMPLATES, EMPTY_CREDENTIALS } from '../utils/constants'

interface UseScheduleQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseScheduleQueryOptions = { enabled: true }

/**
 * Fetch all job schedules
 * Replaces: fetchJobSchedules() (lines 149-169)
 */
export function useJobSchedules(options: UseScheduleQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.schedules(),
    queryFn: async () => {
      const response = await apiCall<JobSchedule[]>('api/job-schedules', { method: 'GET' })
      return response || EMPTY_SCHEDULES
    },
    enabled,
    staleTime: STALE_TIME.SCHEDULES,
  })
}

/**
 * Fetch all job templates
 * Replaces: fetchJobTemplates() (lines 172-190)
 */
export function useJobTemplates(options: UseScheduleQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.templates(),
    queryFn: async () => {
      const response = await apiCall<{ templates: JobTemplate[] }>('api/job-templates', { method: 'GET' })
      return response?.templates || EMPTY_TEMPLATES
    },
    enabled,
    staleTime: STALE_TIME.TEMPLATES,
  })
}

/**
 * Fetch credentials for scheduler
 * Replaces: fetchCredentials() (lines 193-211)
 */
export function useCredentials(options: UseScheduleQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.credentials.list(),
    queryFn: async () => {
      const response = await apiCall<Credential[]>('api/credentials', { method: 'GET' })
      return response || EMPTY_CREDENTIALS
    },
    enabled,
    staleTime: STALE_TIME.CREDENTIALS,
  })
}

/**
 * Fetch scheduler debug info
 * Replaces: fetchSchedulerDebug() (lines 214-246)
 */
export function useSchedulerDebug(options: UseScheduleQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.schedulerDebug(),
    queryFn: async () => {
      const response = await apiCall<SchedulerDebugInfo>(
        'api/job-schedules/debug/scheduler-status',
        { method: 'GET' }
      )
      return response
    },
    enabled,
    staleTime: STALE_TIME.DEBUG,
  })
}
