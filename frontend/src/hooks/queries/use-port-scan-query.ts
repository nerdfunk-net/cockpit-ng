import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { PortScanHostResult } from '@/components/features/jobs/view/types/job-results'

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

export interface PortScanDashboardNetwork {
  network: string
  total_ips: number
  reachable_count: number
  hosts: PortScanHostResult[]
  open_tcp_ports: number
  open_udp_ports: number
  last_scanned_at?: string | null
  job_id?: number
  job_name?: string | null
  agent_id?: string | null
  scan_type?: string | null
  ports?: string | null
}

export interface PortScanDashboardDetails {
  has_data: boolean
  message?: string
  networks?: PortScanDashboardNetwork[]
  total_networks?: number
}

export function usePortScanQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.dashboard.portScan(),
    queryFn: () => apiCall<PortScanDashboardSummary>('job-runs/dashboard/port-scan'),
    staleTime: 2 * 60 * 1000,
  })
}

interface UsePortScanDetailsQueryOptions {
  enabled?: boolean
}

const DEFAULT_DETAILS_OPTIONS: UsePortScanDetailsQueryOptions = {}

export function usePortScanDetailsQuery(
  options: UsePortScanDetailsQueryOptions = DEFAULT_DETAILS_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.dashboard.portScanDetails(),
    queryFn: () =>
      apiCall<PortScanDashboardDetails>('job-runs/dashboard/port-scan/details'),
    enabled,
    staleTime: 2 * 60 * 1000,
  })
}
