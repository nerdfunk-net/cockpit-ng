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
  interfaces?: Array<{ name: string; id: string; status: string }>
  ipAddresses?: Array<{ address: string; id: string; interface: string; is_primary?: boolean }>
  primaryIp?: string
  warnings?: string[]
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

        // Interface creation (new format)
        if (response.interfaces && Array.isArray(response.interfaces)) {
          const successfulInterfaces = response.interfaces.filter(
            (iface: { status: string }) => iface.status === 'success'
          )
          if (successfulInterfaces.length > 0) {
            statusMessages.push(
              `✓ ${successfulInterfaces.length} interface(s) created successfully`
            )
          }

          // Check if any interfaces failed
          const failedInterfaces = response.interfaces.length - successfulInterfaces.length
          if (failedInterfaces > 0) {
            statusMessages.push(`⚠ ${failedInterfaces} interface(s) failed to create`)
            hasWarnings = true
          }
        } else if (response.interface?.id) {
          // Legacy single interface format
          statusMessages.push(`✓ Interface created successfully`)
        }

        // IP addresses
        if (response.ip_addresses && Array.isArray(response.ip_addresses)) {
          statusMessages.push(
            `✓ ${response.ip_addresses.length} IP address(es) assigned`
          )

          // Check for primary IP
          const primaryIp = response.ip_addresses.find(
            (ip: { is_primary?: boolean }) => ip.is_primary
          )
          if (primaryIp) {
            statusMessages.push(`✓ Primary IP set to ${primaryIp.address}`)
          }
        } else if (response.ip_address?.address) {
          // Legacy single IP format
          statusMessages.push(`✓ IP address ${response.ip_address.address} assigned`)
        }

        // Handle warnings from backend
        if (response.warnings && Array.isArray(response.warnings) && response.warnings.length > 0) {
          response.warnings.forEach((warning: string) => {
            statusMessages.push(`⚠ ${warning}`)
          })
          hasWarnings = true
        } else if (response.warning) {
          // Legacy single warning format
          statusMessages.push(`⚠ ${response.warning}`)
          hasWarnings = true
        }

        return {
          success: true,
          message: statusMessages.join('\n'),
          messageType: hasWarnings ? 'warning' : 'success',
          vmId: response.virtual_machine?.id,
          interfaces: response.interfaces,
          ipAddresses: response.ip_addresses,
          primaryIp: response.primary_ip,
          warnings: response.warnings,
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
