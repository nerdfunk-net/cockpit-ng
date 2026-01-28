import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { TemplatesResponse } from '../types'
import { STALE_TIME } from '../utils/constants'

interface UseJobTemplatesQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseJobTemplatesQueryOptions = { enabled: true }

/**
 * Fetch available job templates for filter dropdown
 */
export function useJobTemplatesQuery(options: UseJobTemplatesQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.templates(),
    queryFn: async () => {
      const response = await apiCall<TemplatesResponse>('job-runs/templates', { method: 'GET' })
      return response.templates || []
    },
    enabled,
    staleTime: STALE_TIME.TEMPLATES,
  })
}
