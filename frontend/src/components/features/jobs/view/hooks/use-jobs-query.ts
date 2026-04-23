import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { PaginatedResponse, JobSearchParams } from '../types'
import { STALE_TIME, JOB_POLL_INTERVAL, HIDDEN_JOB_TYPES } from '../utils/constants'

interface UseJobsQueryOptions {
  params?: JobSearchParams
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseJobsQueryOptions = { enabled: true }

/**
 * Fetch paginated job runs with filters and auto-refresh
 * CRITICAL: Uses TanStack Query refetchInterval to replace manual setInterval polling
 */
export function useJobsQuery(options: UseJobsQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { params, enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.list(params),
    queryFn: async () => {
      // Build query string from params
      const searchParams = new URLSearchParams()

      if (params?.page) searchParams.append('page', params.page.toString())
      if (params?.page_size) searchParams.append('page_size', params.page_size.toString())

      // Handle multi-select filters
      if (params?.status) {
        const statusArr = Array.isArray(params.status) ? params.status : [params.status]
        if (statusArr.length > 0) searchParams.append('status', statusArr.join(','))
      }
      if (params?.job_type) {
        const typeArr = Array.isArray(params.job_type) ? params.job_type : [params.job_type]
        if (typeArr.length > 0) searchParams.append('job_type', typeArr.join(','))
      }
      if (params?.triggered_by) {
        const triggerArr = Array.isArray(params.triggered_by) ? params.triggered_by : [params.triggered_by]
        if (triggerArr.length > 0) searchParams.append('triggered_by', triggerArr.join(','))
      }
      if (params?.template_id) {
        const templateArr = Array.isArray(params.template_id) ? params.template_id : [params.template_id]
        if (templateArr.length > 0) searchParams.append('template_id', templateArr.join(','))
      }

      // Always exclude noisy system cache job types
      const excludeTypes = params?.exclude_job_type
        ? Array.isArray(params.exclude_job_type) ? params.exclude_job_type : [params.exclude_job_type]
        : [...HIDDEN_JOB_TYPES]
      if (excludeTypes.length > 0) searchParams.append('exclude_job_type', excludeTypes.join(','))

      const queryString = searchParams.toString()
      const endpoint = queryString ? `job-runs?${queryString}` : 'job-runs'

      return apiCall<PaginatedResponse>(endpoint, { method: 'GET' })
    },
    enabled,
    staleTime: STALE_TIME.JOBS_LIST,
    // Keep previous data while fetching next page (prevents UI flicker)
    placeholderData: keepPreviousData,

    // Always poll while the Jobs page is mounted.
    // Checking only the current page's items for active jobs is unreliable:
    // a running job sorted by queued_at may be on a page other than page 1
    // when more-recently-queued completed jobs push it off the visible page.
    refetchInterval: JOB_POLL_INTERVAL,
  })
}
