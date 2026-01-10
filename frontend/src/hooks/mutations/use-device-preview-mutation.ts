import { useMutation } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import type { BackendOperation, DeviceInfo } from '@/types/shared/device-selector'

interface DevicePreviewPayload {
  operations: BackendOperation[]
}

interface DevicePreviewResponse {
  devices: DeviceInfo[]
  total_count: number
  operations_executed: number
}

/**
 * Hook for device preview mutation using TanStack Query
 *
 * Provides a mutation for previewing devices based on condition tree operations.
 * This is used in bulk edit, export, and other device selection flows.
 *
 * @example
 * ```tsx
 * const { mutate: previewDevices, isPending, data, error } = useDevicePreviewMutation()
 *
 * // Trigger preview
 * previewDevices(
 *   { operations: [{ operation_type: 'AND', conditions: [...] }] },
 *   {
 *     onSuccess: (data) => {
 *       console.log(`Found ${data.total_count} devices`)
 *     }
 *   }
 * )
 * ```
 */
export function useDevicePreviewMutation() {
  const { apiCall } = useApi()

  return useMutation({
    mutationFn: async (payload: DevicePreviewPayload) => {
      return apiCall<DevicePreviewResponse>('inventory/preview', {
        method: 'POST',
        body: payload
      })
    },

    // Don't retry preview requests (user can manually retry)
    retry: false,
  })
}

export type { DevicePreviewPayload, DevicePreviewResponse }
