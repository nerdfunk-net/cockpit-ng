import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { PaginatedResponse, JobSearchParams } from '../types'
import { STALE_TIME, JOB_POLL_INTERVAL } from '../utils/constants'
import { hasActiveJobs } from '../utils/job-utils'

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

      const queryString = searchParams.toString()
      const endpoint = queryString ? `job-runs?${queryString}` : 'job-runs'

      const response = await apiCall<PaginatedResponse>(endpoint, { method: 'GET' })
      return response
    },
    enabled,
    staleTime: STALE_TIME.JOBS_LIST,
    // Keep previous data while fetching next page (prevents UI flicker)
    placeholderData: keepPreviousData,

    // Auto-refresh when jobs are running
    // CRITICAL: Replaces manual setInterval (lines 281-291)
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data?.items) return false

      // Auto-poll every 3s if any job is running/pending
      return hasActiveJobs(data.items) ? JOB_POLL_INTERVAL : false
    },
  })
}
