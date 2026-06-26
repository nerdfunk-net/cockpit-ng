import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

interface JobRunStats {
  total: number
  completed: number
  failed: number
  running: number
}

interface BackupDeviceStats {
  total_devices: number
  successful_devices: number
  failed_devices: number
}

export interface JobDashboardStats {
  job_runs: JobRunStats
  backup_devices: BackupDeviceStats
}

export function useJobStatsQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.dashboard.jobStats(),
    queryFn: () => apiCall<JobDashboardStats>('job-runs/dashboard/stats'),
    staleTime: 60 * 1000,
  })
}
