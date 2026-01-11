import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { DeviceSubmissionData, DeviceSubmissionResult } from '../../types'

export function useDeviceMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const createDevice = useMutation({
    mutationFn: async (data: DeviceSubmissionData): Promise<DeviceSubmissionResult> => {
      try {
        const response = await apiCall<any>('nautobot/add-device', {
          method: 'POST',
          body: JSON.stringify(data),
        })

        // Parse workflow result
        const workflowStatus = response.workflow_status
        const summary = response.summary

        const statusMessages: string[] = []
        let hasErrors = false
        let hasWarnings = false

        // Device creation
        if (workflowStatus?.create_device === 'SUCCESS') {
          statusMessages.push(`✓ Device "${data.name}" created successfully`)
        } else if (workflowStatus?.create_device === 'FAILURE') {
          statusMessages.push(`✗ Failed to create device "${data.name}"`)
          hasErrors = true
        }

        // Interfaces
        if (summary?.interfaces_created > 0) {
          statusMessages.push(`✓ Created ${summary.interfaces_created} interface(s)`)
        } else if (data.interfaces.length > 0) {
          statusMessages.push(`⚠ No interfaces were created`)
          hasWarnings = true
        }

        // IP addresses
        if (summary?.ip_addresses_created > 0) {
          statusMessages.push(`✓ Created ${summary.ip_addresses_created} IP address(es)`)
        }

        return {
          success: !hasErrors,
          message: statusMessages.join('\n'),
          messageType: hasErrors ? 'error' : hasWarnings ? 'warning' : 'success',
          deviceId: response.device_id,
          summary,
        }
      } catch (error) {
        return {
          success: false,
          message: `Workflow failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          messageType: 'error',
        }
      }
    },
    onSuccess: (result) => {
      if (result.success) {
        // Invalidate relevant queries
        queryClient.invalidateQueries({ queryKey: queryKeys.nautobot.all })

        toast({
          title: 'Success',
          description: result.message,
        })
      } else {
        toast({
          title: 'Error',
          description: result.message,
          variant: 'destructive',
        })
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  return { createDevice }
}
