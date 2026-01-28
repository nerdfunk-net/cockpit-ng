import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { JobRun } from '../types'
import { STALE_TIME } from '../utils/constants'

interface UseJobDetailQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseJobDetailQueryOptions = { enabled: true }

/**
 * Fetch single job details (for viewing result dialog)
 */
export function useJobDetailQuery(
  jobId: number | null,
  options: UseJobDetailQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.detail(jobId ?? 0),
    queryFn: async () => {
      if (!jobId) throw new Error('No job ID provided')

      const response = await apiCall<JobRun>(`job-runs/${jobId}`, { method: 'GET' })
      return response
    },
    enabled: enabled && !!jobId,
    staleTime: STALE_TIME.DETAIL,
  })
}
