'use client'

import { useCallback, useMemo, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { useServerMutations } from '@/hooks/queries/use-server-mutations'
import { useServerDefaultsQuery } from '@/components/features/settings/common/hooks/use-server-defaults-query'
import { useVMMutations } from '@/components/features/nautobot/add-vm/hooks/queries/use-vm-mutations'
import { useDeviceMutations } from '@/components/features/nautobot/add-device/hooks/queries/use-device-mutations'
import { useNautobotDropdownsQuery } from '@/components/features/nautobot/add-device/hooks/queries/use-nautobot-dropdowns-query'
import { resolveVirtualInterfaceType } from '../utils/resolve-virtual-interface-type'
import {
  buildDevicePayload,
  buildVmPayload,
  validateServerDefaultsForDevice,
  validateServerDefaultsForVm,
} from '../utils/build-nautobot-payload'
import type { ServerResponse } from '../types'

export function useAddServerToNautobot(server: ServerResponse) {
  const { toast } = useToast()
  const { data: defaults, isLoading: defaultsLoading } = useServerDefaultsQuery()
  const { createVM } = useVMMutations()
  const { createDevice } = useDeviceMutations()
  const { updateServer } = useServerMutations()
  const { data: deviceDropdowns, isLoading: deviceDropdownsLoading } = useNautobotDropdownsQuery({
    enabled: !server.is_virtual,
  })

  const [vmDialogOpen, setVmDialogOpen] = useState(false)
  const [deviceDialogOpen, setDeviceDialogOpen] = useState(false)

  const isPending =
    createVM.isPending || createDevice.isPending || updateServer.isPending

  const virtualInterfaceType = useMemo(() => {
    if (!deviceDropdowns?.interfaceTypes) return undefined
    return resolveVirtualInterfaceType(deviceDropdowns.interfaceTypes)
  }, [deviceDropdowns])

  const validateBeforeOpen = useCallback((): boolean => {
    if (!defaults) {
      toast({
        title: 'Server defaults unavailable',
        description: 'Could not load Server Defaults. Check settings and try again.',
        variant: 'destructive',
      })
      return false
    }

    if (!server.hostname?.trim()) {
      toast({
        title: 'Hostname required',
        description: 'This server has no hostname and cannot be added to Nautobot.',
        variant: 'destructive',
      })
      return false
    }

    if (server.is_virtual) {
      const error = validateServerDefaultsForVm(defaults)
      if (error) {
        toast({ title: 'Server defaults incomplete', description: error, variant: 'destructive' })
        return false
      }
      return true
    }

    const error = validateServerDefaultsForDevice(server, defaults)
    if (error) {
      toast({ title: 'Server defaults incomplete', description: error, variant: 'destructive' })
      return false
    }

    if (!virtualInterfaceType) {
      toast({
        title: 'Interface type unavailable',
        description: 'Could not resolve the "virtual" interface type from Nautobot.',
        variant: 'destructive',
      })
      return false
    }

    return true
  }, [defaults, server, toast, virtualInterfaceType])

  const openAddDialog = useCallback(() => {
    if (!validateBeforeOpen()) return
    if (server.is_virtual) {
      setVmDialogOpen(true)
    } else {
      setDeviceDialogOpen(true)
    }
  }, [server.is_virtual, validateBeforeOpen])

  const addVirtualServer = useCallback(
    async (clusterId: string) => {
      if (!defaults) return
      const payload = buildVmPayload(server, defaults, clusterId)
      const result = await createVM.mutateAsync(payload)
      if (!result.success || !result.vmId) {
        throw new Error(result.message || 'Failed to create virtual machine')
      }
      await updateServer.mutateAsync({
        id: server.id,
        data: { nautobot_uuid: result.vmId },
      })
      setVmDialogOpen(false)
    },
    [createVM, defaults, server, updateServer]
  )

  const addBareMetalServer = useCallback(
    async (deviceTypeId: string) => {
      if (!defaults || !virtualInterfaceType) return
      const payload = buildDevicePayload(server, defaults, deviceTypeId, virtualInterfaceType)
      const result = await createDevice.mutateAsync(payload)
      if (!result.success || !result.deviceId) {
        throw new Error(result.message || 'Failed to create device')
      }
      await updateServer.mutateAsync({
        id: server.id,
        data: { nautobot_uuid: result.deviceId },
      })
      setDeviceDialogOpen(false)
    },
    [createDevice, defaults, server, updateServer, virtualInterfaceType]
  )

  return {
    openAddDialog,
    addVirtualServer,
    addBareMetalServer,
    vmDialogOpen,
    setVmDialogOpen,
    deviceDialogOpen,
    setDeviceDialogOpen,
    isPending,
    defaultsLoading,
    deviceDropdownsLoading,
    deviceTypes: deviceDropdowns?.deviceTypes ?? [],
  }
}
