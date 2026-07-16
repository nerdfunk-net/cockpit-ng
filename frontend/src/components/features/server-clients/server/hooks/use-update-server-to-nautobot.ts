'use client'

import { useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'
import { useServerDefaultsQuery } from '@/components/features/settings/defaults/profiles/hooks/use-server-defaults-query'
import { useVMMutations } from '@/components/features/nautobot/add-vm/hooks/queries/use-vm-mutations'
import { useDeviceMutations } from '@/components/features/nautobot/add-device/hooks/queries/use-device-mutations'
import { useNautobotDropdownsQuery } from '@/components/features/nautobot/add-device/hooks/queries/use-nautobot-dropdowns-query'
import { useSoftwareVersionsQuery } from '@/components/features/nautobot/add-vm/hooks/queries/use-software-versions-query'
import { resolveVirtualInterfaceType } from '../utils/resolve-virtual-interface-type'
import {
  buildDeviceUpdatePayload,
  buildVmUpdatePayload,
  resolveServerSoftwareVersionId,
  validateServerDefaultsForDevice,
  validateServerDefaultsForVm,
} from '../utils/build-nautobot-payload'
import type { ServerResponse } from '../types'

const EMPTY_SOFTWARE_VERSIONS: never[] = []

export function useUpdateServerToNautobot(server: ServerResponse) {
  const { toast } = useToast()
  const { data: defaults, isLoading: defaultsLoading } = useServerDefaultsQuery()
  const { updateVM } = useVMMutations()
  const { updateDevice } = useDeviceMutations()
  const { data: deviceDropdowns, isLoading: deviceDropdownsLoading } =
    useNautobotDropdownsQuery({
      enabled: !server.is_virtual && Boolean(server.nautobot_uuid),
    })
  const { data: softwareVersions = EMPTY_SOFTWARE_VERSIONS } = useSoftwareVersionsQuery({})

  const virtualInterfaceType =
    deviceDropdowns?.interfaceTypes &&
    resolveVirtualInterfaceType(deviceDropdowns.interfaceTypes)

  const isPending = updateVM.isPending || updateDevice.isPending

  const updateServerInNautobot = useCallback(async () => {
    if (!server.nautobot_uuid?.trim()) {
      toast({
        title: 'Cannot update',
        description: 'This server has no Nautobot UUID. Add it to Nautobot first.',
        variant: 'destructive',
      })
      return
    }

    if (!defaults) {
      toast({
        title: 'Server defaults unavailable',
        description: 'Could not load Server Defaults. Check settings and try again.',
        variant: 'destructive',
      })
      return
    }

    if (server.is_virtual) {
      const error = validateServerDefaultsForVm(defaults)
      if (error) {
        toast({ title: 'Server defaults incomplete', description: error, variant: 'destructive' })
        return
      }
      if (!server.cluster?.id) {
        toast({
          title: 'Cluster required',
          description: 'Set a cluster on this virtual server before updating Nautobot.',
          variant: 'destructive',
        })
        return
      }

      const softwareVersionId = resolveServerSoftwareVersionId(
        server,
        defaults,
        softwareVersions
      )
      const payload = buildVmUpdatePayload(server, defaults, softwareVersionId)
      const result = await updateVM.mutateAsync({
        vmId: server.nautobot_uuid,
        data: payload,
      })
      if (!result.success) {
        throw new Error(result.message || 'Failed to update virtual machine')
      }
      return
    }

    const error = validateServerDefaultsForDevice(server, defaults)
    if (error) {
      toast({ title: 'Server defaults incomplete', description: error, variant: 'destructive' })
      return
    }

    if (!virtualInterfaceType) {
      toast({
        title: 'Interface type unavailable',
        description: 'Could not resolve the "virtual" interface type from Nautobot.',
        variant: 'destructive',
      })
      return
    }

    const softwareVersionId = resolveServerSoftwareVersionId(
      server,
      defaults,
      softwareVersions
    )
    const payload = buildDeviceUpdatePayload(
      server,
      defaults,
      virtualInterfaceType,
      softwareVersionId
    )
    const result = await updateDevice.mutateAsync({
      deviceId: server.nautobot_uuid,
      data: payload,
    })
    if (!result.success) {
      throw new Error(result.message || 'Failed to update device')
    }
  }, [
    defaults,
    server,
    softwareVersions,
    toast,
    updateDevice,
    updateVM,
    virtualInterfaceType,
  ])

  return {
    updateServerInNautobot,
    isPending,
    defaultsLoading,
    deviceDropdownsLoading,
    canUpdate: Boolean(server.nautobot_uuid?.trim()),
  }
}
