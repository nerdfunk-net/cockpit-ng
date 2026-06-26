import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { DashboardLayoutDoc } from '@/components/features/dashboard/types/dashboard'

interface DashboardLayoutResponse {
  success: boolean
  data: DashboardLayoutDoc | null
}

export function useDashboardLayoutQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.dashboard.layout(),
    queryFn: () => apiCall<DashboardLayoutResponse>('profile/dashboard-layout'),
    staleTime: Infinity,
    select: response => response?.data ?? null,
  })
}
