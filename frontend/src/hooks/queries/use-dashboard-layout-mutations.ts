import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { DashboardLayoutDoc } from '@/components/features/dashboard/types/dashboard'

export function useDashboardLayoutMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const saveDashboardLayout = useMutation({
    mutationFn: (layout: DashboardLayoutDoc) =>
      apiCall('profile/dashboard-layout', {
        method: 'PUT',
        body: JSON.stringify({ layout }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.layout() })
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to save dashboard layout',
        variant: 'destructive',
      })
    },
  })

  return { saveDashboardLayout }
}
