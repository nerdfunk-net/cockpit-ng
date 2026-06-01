import type { DefaultsFields } from '@/components/features/settings/common/types/defaults-fields'
import type { InterfaceData } from '@/components/features/nautobot/add-device/types'
import type { SelectedInterface, ServerResponse } from '../types'
import { formatInterfaceAddress, isPrimaryInterfaceAddress } from './format-interface-address'
import { getIpv4FromFacts } from './get-ipv4-from-facts'

export interface MappedNautobotInterface {
  id: string
  name: string
  status: string
  ip_addresses: Array<{
    id: string
    address: string
    namespace: string
    ip_role: string
    is_primary?: boolean
  }>
  type?: string
}

export interface MapServerInterfacesOptions {
  server: ServerResponse
  defaults: DefaultsFields
  interfaceType?: string
}

function mapSingleInterface(
  iface: SelectedInterface,
  index: number,
  options: MapServerInterfacesOptions
): MappedNautobotInterface | null {
  const name = iface.name?.trim()
  if (!name) return null

  const { server, defaults, interfaceType } = options
  const status = defaults.interface_status
  const namespace = defaults.namespace
  if (!status || !namespace) return null

  const address = formatInterfaceAddress(iface)
  const primaryInterfaceName = server.primary_interface?.trim()
  const isPrimaryByName =
    Boolean(primaryInterfaceName) && name === primaryInterfaceName
  const ip_addresses = address
    ? [
        {
          id: `ip-${index}`,
          address,
          namespace,
          ip_role: '',
          is_primary:
            isPrimaryByName ||
            isPrimaryInterfaceAddress(address, server.primary_ipv4),
        },
      ]
    : []

  const mapped: MappedNautobotInterface = {
    id: `iface-${index}`,
    name,
    status,
    ip_addresses,
  }

  if (interfaceType) {
    mapped.type = interfaceType
  }

  return mapped
}

/**
 * Build interface list for Nautobot from selected_interfaces, ensuring the server's
 * primary_interface / primary_ipv4 pair is included (Ansible default route).
 */
export function resolveServerInterfaceSources(server: ServerResponse): SelectedInterface[] {
  const fromSelected = [...(server.selected_interfaces ?? [])]
  const primaryName = server.primary_interface?.trim()
  const primaryIp = server.primary_ipv4?.trim()

  if (!primaryName || !primaryIp) {
    return fromSelected
  }

  const existingIdx = fromSelected.findIndex(i => i.name?.trim() === primaryName)
  const factsIpv4 = getIpv4FromFacts(server, primaryName)

  if (existingIdx >= 0) {
    const existing = fromSelected[existingIdx]!
    fromSelected[existingIdx] = {
      ...existing,
      address: existing.address?.trim() || factsIpv4?.address || primaryIp,
      netmask: existing.netmask ?? factsIpv4?.netmask,
      prefix: existing.prefix ?? factsIpv4?.prefix,
      broadcast: existing.broadcast ?? factsIpv4?.broadcast,
      network: existing.network ?? factsIpv4?.network,
    }
    return fromSelected
  }

  return [
    {
      name: primaryName,
      address: factsIpv4?.address ?? primaryIp,
      netmask: factsIpv4?.netmask,
      prefix: factsIpv4?.prefix,
      broadcast: factsIpv4?.broadcast,
      network: factsIpv4?.network,
    },
    ...fromSelected,
  ]
}

/** Map server interfaces to Nautobot interface payloads. */
export function mapServerInterfaces(
  options: MapServerInterfacesOptions
): MappedNautobotInterface[] {
  const interfaces = resolveServerInterfaceSources(options.server)
  return interfaces
    .map((iface, index) => mapSingleInterface(iface, index, options))
    .filter((iface): iface is MappedNautobotInterface => iface !== null)
}

/** Keep only interfaces valid for VM/device creation (name + status). */
export function filterValidNautobotInterfaces<T extends { name?: string; status?: string }>(
  interfaces: T[]
): T[] {
  return interfaces.filter(
    iface => iface.name?.trim() !== '' && iface.status?.trim() !== ''
  )
}

/** Device add-device payload uses InterfaceData (type required). */
export function mapServerInterfacesForDevice(
  options: MapServerInterfacesOptions & { interfaceType: string }
): InterfaceData[] {
  return mapServerInterfaces(options).map(iface => ({
    id: iface.id,
    name: iface.name,
    type: iface.type ?? options.interfaceType,
    status: iface.status,
    ip_addresses: iface.ip_addresses,
  }))
}
