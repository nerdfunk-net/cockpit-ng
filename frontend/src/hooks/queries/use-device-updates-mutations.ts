import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { queryKeys } from '@/lib/query-keys'

interface ProcessDeviceUpdatesInput {
  devices: Array<Record<string, unknown>>
  dryRun?: boolean
}

interface CeleryTaskResponse {
  task_id: string
  job_id: string
  status: string
  message: string
}

/**
 * Submits a batch of device updates (including full per-interface create/update
 * specs) to the JSON `tasks/update-devices` endpoint.
 */
export function useDeviceUpdatesMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const processDeviceUpdates = useMutation({
    mutationFn: async (input: ProcessDeviceUpdatesInput): Promise<CeleryTaskResponse> => {
      const response = await apiCall('celery/tasks/update-devices', {
        method: 'POST',
        body: JSON.stringify({
          devices: input.devices,
          dry_run: input.dryRun ?? false,
        }),
      })

      return response as CeleryTaskResponse
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.nautobot.devices() })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to process device updates',
        variant: 'destructive',
      })
    },
  })

  return { processDeviceUpdates }
}
