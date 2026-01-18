import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { queryKeys } from '@/lib/query-keys'
import type { SyncProperties } from '../types'

interface SyncDevicesInput {
  deviceIds: string[]
  syncProperties: SyncProperties
}

export function useSyncDevicesMutation() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ deviceIds, syncProperties }: SyncDevicesInput) => {
      const syncData = {
        data: {
          devices: deviceIds,
          default_prefix_status: syncProperties.prefix_status,
          interface_status: syncProperties.interface_status,
          ip_address_status: syncProperties.ip_address_status,
          namespace: syncProperties.namespace,
          sync_cables: syncProperties.sync_options.includes('cables'),
          sync_software_version: syncProperties.sync_options.includes('software'),
          sync_vlans: syncProperties.sync_options.includes('vlans'),
          sync_vrfs: syncProperties.sync_options.includes('vrfs'),
        },
      }

      return apiCall<{ success: boolean; message: string }>(
        'nautobot/sync-network-data',
        { method: 'POST', body: syncData }
      )
    },
    onSuccess: (result, variables) => {
      if (result?.success) {
        toast({
          title: 'Success',
          description: `Successfully synchronized ${variables.deviceIds.length} device${variables.deviceIds.length !== 1 ? 's' : ''}`,
        })
        // Invalidate devices query to refresh data
        queryClient.invalidateQueries({ queryKey: queryKeys.nautobot.devices() })
      } else {
        toast({
          title: 'Sync Failed',
          description: result?.message || 'Unknown error',
          variant: 'destructive',
        })
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Sync Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}
