import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

export interface ScanPrefixResult {
  has_data: boolean
  message?: string
  job_id?: number
  job_name?: string
  completed_at?: string
  total_prefixes?: number
  total_ips_scanned?: number
  total_reachable?: number
  total_unreachable?: number
  reachability_percent?: number
  resolve_dns?: boolean
  success?: boolean
  was_split?: boolean
}

export function useScanPrefixQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.dashboard.scanPrefix(),
    queryFn: () => apiCall<ScanPrefixResult>('job-runs/dashboard/scan-prefix'),
    staleTime: 2 * 60 * 1000,
  })
}
