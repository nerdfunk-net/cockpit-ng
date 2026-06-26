import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

export interface CompareDevicesResult {
  has_data: boolean
  message?: string
  job_id?: number
  job_name?: string
  completed_at?: string
  total?: number
  completed?: number
  failed?: number
  differences_found?: number
  in_sync?: number
  success?: boolean
}

export function useCheckmkSyncQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.dashboard.checkmkSync(),
    queryFn: () => apiCall<CompareDevicesResult>('job-runs/dashboard/compare-devices'),
    staleTime: 2 * 60 * 1000,
  })
}
