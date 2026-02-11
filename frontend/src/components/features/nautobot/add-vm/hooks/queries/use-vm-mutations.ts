import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { VMFormValues } from '../use-vm-form'

interface VMCreationResult {
  success: boolean
  message: string
  messageType: 'success' | 'error' | 'warning'
  vmId?: string
  interfaceId?: string
  warning?: string
}

export function useVMMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const createVM = useMutation({
    mutationFn: async (data: VMFormValues): Promise<VMCreationResult> => {
      try {
        // Call the backend API to create the VM
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await apiCall<any>('nautobot/virtualization/virtual-machines', {
          method: 'POST',
          body: JSON.stringify(data),
        })

        // Parse the response
        const statusMessages: string[] = []
        let hasWarnings = false

        // VM creation
        if (response.virtual_machine?.id) {
          statusMessages.push(`✓ Virtual machine "${data.name}" created successfully`)
        } else {
          statusMessages.push(`⚠ VM created but no ID returned`)
          hasWarnings = true
        }

        // Interface creation
        if (response.interface?.id) {
          statusMessages.push(`✓ Interface "${data.interfaceName}" created successfully`)
        } else if (data.interfaceName) {
          statusMessages.push(`⚠ Interface "${data.interfaceName}" was not created`)
          hasWarnings = true
        }

        // IP address warning
        if (response.warning) {
          statusMessages.push(`⚠ ${response.warning}`)
          hasWarnings = true
        }

        return {
          success: true,
          message: statusMessages.join('\n'),
          messageType: hasWarnings ? 'warning' : 'success',
          vmId: response.virtual_machine?.id,
          interfaceId: response.interface?.id,
          warning: response.warning,
        }
      } catch (error) {
        return {
          success: false,
          message: `Failed to create VM: ${error instanceof Error ? error.message : 'Unknown error'}`,
          messageType: 'error',
        }
      }
    },
    onSuccess: (result) => {
      if (result.success) {
        // Invalidate relevant queries to refresh data
        queryClient.invalidateQueries({ queryKey: queryKeys.nautobot.all })

        toast({
          title: result.messageType === 'warning' ? 'Partial Success' : 'Success',
          description: result.message,
          variant: result.messageType === 'warning' ? 'default' : 'default',
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

  return { createVM }
}
