import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

export interface PortScanDashboardSummary {
  has_data: boolean
  message?: string
  total_runs?: number
  successful_runs?: number
  failed_runs?: number
  total_networks?: number
  total_ips_scanned?: number
  total_reachable?: number
  total_unreachable?: number
  total_hosts_scanned?: number
  total_open_tcp_ports?: number
  total_open_udp_ports?: number
  reachability_percent?: number
  latest_completed_at?: string
}

export function usePortScanQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.dashboard.portScan(),
    queryFn: () => apiCall<PortScanDashboardSummary>('job-runs/dashboard/port-scan'),
    staleTime: 2 * 60 * 1000,
  })
}
