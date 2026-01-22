import { useMutation } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'

interface BulkDiscoveryOptions {
  monitor_undecided_services: boolean
  remove_vanished_services: boolean
  update_service_labels: boolean
  update_service_parameters: boolean
  update_host_labels: boolean
}

interface BulkDiscoveryInput {
  hostnames: string[]
  options: BulkDiscoveryOptions
  do_full_scan: boolean
  bulk_size: number
  ignore_errors: boolean
}

interface BulkDiscoveryResponse {
  success: boolean
  message: string
  data: unknown
}

/**
 * Hook for CheckMK bulk discovery mutations
 *
 * Provides mutations for starting bulk service discovery on multiple hosts.
 *
 * @example
 * ```tsx
 * const { startBulkDiscovery } = useCheckmkDiscoveryMutations()
 *
 * // Start bulk discovery
 * startBulkDiscovery.mutate({
 *   hostnames: ['host1', 'host2'],
 *   options: { ... },
 *   do_full_scan: true,
 *   bulk_size: 10,
 *   ignore_errors: true
 * })
 * ```
 */
export function useCheckmkDiscoveryMutations() {
  const { apiCall } = useApi()
  const { toast } = useToast()

  const startBulkDiscovery = useMutation({
    mutationFn: async (input: BulkDiscoveryInput): Promise<BulkDiscoveryResponse> => {
      return apiCall('checkmk/service-discovery/bulk', {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },
    onSuccess: (data, variables) => {
      toast({
        title: 'Success',
        description: data.message || `Bulk discovery started for ${variables.hostnames.length} host(s)`,
      })
    },
    onError: (error: Error, variables) => {
      toast({
        title: 'Error',
        description: error.message || `Failed to start bulk discovery for ${variables.hostnames.length} host(s)`,
        variant: 'destructive',
      })
    },
  })

  return {
    startBulkDiscovery,
  }
}

export type { BulkDiscoveryOptions, BulkDiscoveryInput, BulkDiscoveryResponse }
