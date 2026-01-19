import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { TaskStatus } from '../types'
import { POLLING_INTERVAL } from '../utils/constants'

interface UseCheckIpTaskQueryOptions {
  taskId: string | null
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseCheckIpTaskQueryOptions = {
  taskId: null,
  enabled: true,
}

export function useCheckIpTaskQuery(
  options: UseCheckIpTaskQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { taskId, enabled = true } = options

  return useQuery({
    queryKey: queryKeys.checkIp.task(taskId!),
    queryFn: async () => {
      const response = await apiCall(`celery/tasks/${taskId}`, {
        method: 'GET'
      })
      return response as TaskStatus
    },
    enabled: enabled && !!taskId,

    // Auto-polling with smart start/stop
    refetchInterval: (query) => {
      const data = query.state.data

      if (!data) return POLLING_INTERVAL

      // Auto-stop when task completes
      const completedStatuses = ['SUCCESS', 'FAILURE', 'REVOKED']
      if (completedStatuses.includes(data.status)) {
        return false
      }

      return POLLING_INTERVAL
    },

    staleTime: 0,  // Always fetch fresh data for polling
  })
}
