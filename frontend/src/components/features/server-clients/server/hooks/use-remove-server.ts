'use client'

import { useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'
import { useServerMutations } from '@/hooks/queries/use-server-mutations'
import { useVMMutations } from '@/components/features/nautobot/add-vm/hooks/queries/use-vm-mutations'
import { useDeviceMutations } from '@/components/features/nautobot/add-device/hooks/queries/use-device-mutations'
import type { ServerResponse } from '../types'

export function useRemoveServer(server: ServerResponse, onRemoved: () => void) {
  const { toast } = useToast()
  const { deleteServer } = useServerMutations()
  const { deleteVM } = useVMMutations()
  const { deleteDevice } = useDeviceMutations()

  const isPending =
    deleteServer.isPending || deleteVM.isPending || deleteDevice.isPending

  const removeServer = useCallback(
    async (alsoRemoveFromNautobot: boolean) => {
      const nautobotUuid = server.nautobot_uuid?.trim()

      try {
        if (alsoRemoveFromNautobot && nautobotUuid) {
          if (server.is_virtual) {
            const result = await deleteVM.mutateAsync(nautobotUuid)
            if (!result.success) {
              throw new Error(result.message)
            }
          } else {
            const result = await deleteDevice.mutateAsync(nautobotUuid)
            if (!result.success) {
              throw new Error(result.message)
            }
          }
        }

        await deleteServer.mutateAsync(server.id)

        const description =
          alsoRemoveFromNautobot && nautobotUuid
            ? 'The server was removed from Cockpit and Nautobot.'
            : 'The server was removed from Cockpit.'

        toast({
          title: 'Server removed',
          description,
        })

        onRemoved()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        toast({
          title: 'Failed to remove server',
          description: message,
          variant: 'destructive',
        })
        throw error
      }
    },
    [
      deleteDevice,
      deleteServer,
      deleteVM,
      onRemoved,
      server.id,
      server.is_virtual,
      server.nautobot_uuid,
      toast,
    ]
  )

  return {
    removeServer,
    isPending,
    hasNautobotLink: Boolean(server.nautobot_uuid?.trim()),
    nautobotResourceLabel: server.is_virtual ? 'virtual machine' : 'device',
  }
}
