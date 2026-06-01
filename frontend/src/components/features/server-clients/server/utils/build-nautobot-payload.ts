import type { DefaultsFields } from '@/components/features/settings/common/types/defaults-fields'
import type { DeviceSubmissionData } from '@/components/features/nautobot/add-device/types'
import type { VMFormValues } from '@/components/features/nautobot/add-vm/hooks/use-vm-form'
import type { ServerResponse } from '../types'
import { computeDiskGbFromMounts } from './compute-disk-gb-from-mounts'
import { extractServerMounts } from './extract-server-mounts'
import {
  filterValidNautobotInterfaces,
  mapServerInterfaces,
  mapServerInterfacesForDevice,
} from './map-server-interfaces'

function resolvePlatform(platform: string | undefined): string | undefined {
  if (!platform?.trim() || platform === 'detect') return undefined
  return platform
}

export function buildVmPayload(
  server: ServerResponse,
  defaults: DefaultsFields,
  clusterId: string
): VMFormValues {
  const mounts = extractServerMounts(server)
  const disk = computeDiskGbFromMounts(mounts)
  const interfaces = filterValidNautobotInterfaces(
    mapServerInterfaces({ server, defaults })
  )

  const payload: VMFormValues = {
    name: server.hostname,
    status: defaults.device_status,
    cluster: clusterId,
    role: defaults.device_role || undefined,
    clusterGroup: undefined,
    platform: resolvePlatform(defaults.platform),
    softwareVersion: undefined,
    softwareImageFile: undefined,
    vcpus:
      server.processor_count != null && server.processor_count > 0
        ? server.processor_count
        : undefined,
    memory:
      server.memtotal_mb != null && server.memtotal_mb > 0 ? server.memtotal_mb : undefined,
    disk: disk != null && disk > 0 ? disk : undefined,
    tags: [],
    customFieldValues: {},
    interfaces,
  }

  return payload
}

export function buildDevicePayload(
  server: ServerResponse,
  defaults: DefaultsFields,
  deviceTypeId: string,
  interfaceType: string
): DeviceSubmissionData {
  const locationId = server.location?.id ?? defaults.location
  const interfaces = filterValidNautobotInterfaces(
    mapServerInterfacesForDevice({
      server,
      defaults,
      interfaceType,
    })
  )

  return {
    name: server.hostname,
    role: defaults.device_role,
    status: defaults.device_status,
    location: locationId,
    device_type: deviceTypeId,
    platform: resolvePlatform(defaults.platform),
    interfaces,
    add_prefix: true,
    default_prefix_length: '/24',
  }
}

export function validateServerDefaultsForVm(defaults: DefaultsFields): string | null {
  if (!defaults.device_status?.trim()) return 'Device status is not configured in Server Defaults.'
  if (!defaults.device_role?.trim()) return 'Device role is not configured in Server Defaults.'
  if (!defaults.interface_status?.trim()) {
    return 'Interface status is not configured in Server Defaults.'
  }
  if (!defaults.namespace?.trim()) return 'Namespace is not configured in Server Defaults.'
  return null
}

export function validateServerDefaultsForDevice(
  server: ServerResponse,
  defaults: DefaultsFields
): string | null {
  const vmError = validateServerDefaultsForVm(defaults)
  if (vmError) return vmError
  if (server.location?.id || defaults.location?.trim()) return null
  return 'Location is not configured on the server or in Server Defaults.'
}
