import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

export interface IPAddressesResult {
  has_data: boolean
  message?: string
  job_id?: number
  job_name?: string
  completed_at?: string
  total?: number
  filter_field?: string
  filter_type?: string | null
  filter_value?: string
  include_null?: boolean
  success?: boolean
}

export function useIPAddressesQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.dashboard.ipAddresses(),
    queryFn: () => apiCall<IPAddressesResult>('job-runs/dashboard/ip-addresses'),
    staleTime: 2 * 60 * 1000,
  })
}
