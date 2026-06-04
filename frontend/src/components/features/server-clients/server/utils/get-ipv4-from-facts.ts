import type { SelectedInterface, ServerResponse } from '../types'

interface Ipv4Info {
  address?: string
  netmask?: string
  broadcast?: string
  network?: string
  prefix?: string
}

export type Ipv4FromFacts = Pick<
  SelectedInterface,
  'address' | 'netmask' | 'broadcast' | 'network' | 'prefix'
>

function toIpv4Pick(ipv4: Ipv4Info | undefined): Ipv4FromFacts | undefined {
  if (!ipv4?.address) return undefined
  return {
    address: ipv4.address,
    netmask: ipv4.netmask,
    broadcast: ipv4.broadcast,
    network: ipv4.network,
    prefix: ipv4.prefix,
  }
}

function getFactsRoots(server: ServerResponse): {
  nested: Record<string, unknown> | undefined
  hostvars: Record<string, unknown> | undefined
  wrapped: Record<string, unknown> | undefined
} {
  const stored = server.ansible_facts
  if (!stored) {
    return { nested: undefined, hostvars: undefined, wrapped: undefined }
  }
  return {
    nested: stored.ansible_facts as Record<string, unknown> | undefined,
    hostvars: stored as Record<string, unknown>,
    wrapped: stored.facts as Record<string, unknown> | undefined,
  }
}

function readIfaceIpv4(
  ifaceName: string,
  roots: ReturnType<typeof getFactsRoots>
): Ipv4FromFacts | undefined {
  const { nested, hostvars, wrapped } = roots
  const prefixedKey = `ansible_${ifaceName}`

  const ipv4 =
    ((nested?.[ifaceName] as Record<string, unknown> | undefined)?.ipv4 as
      | Ipv4Info
      | undefined) ??
    ((hostvars?.[prefixedKey] as Record<string, unknown> | undefined)?.ipv4 as
      | Ipv4Info
      | undefined) ??
    ((wrapped?.[prefixedKey] as Record<string, unknown> | undefined)?.ipv4 as
      | Ipv4Info
      | undefined)

  return toIpv4Pick(ipv4)
}

/** Read default IPv4 (route) from stored Ansible facts. */
export function getDefaultIpv4FromFacts(server: ServerResponse): Ipv4FromFacts | undefined {
  const { nested, hostvars, wrapped } = getFactsRoots(server)

  const defaultIpv4 =
    (nested?.default_ipv4 as Ipv4Info | undefined) ??
    (hostvars?.ansible_default_ipv4 as Ipv4Info | undefined) ??
    (wrapped?.ansible_default_ipv4 as Ipv4Info | undefined)

  return toIpv4Pick(defaultIpv4)
}

/** Read IPv4 details for an interface name from stored Ansible facts. */
export function getIpv4FromFacts(server: ServerResponse, ifaceName: string): Ipv4FromFacts | undefined {
  return readIfaceIpv4(ifaceName, getFactsRoots(server))
}

/** Merge a selected interface row with Ansible facts (and default IPv4 for the primary iface). */
export function mergeInterfaceWithFacts(
  server: ServerResponse,
  iface: SelectedInterface
): SelectedInterface {
  const name = iface.name?.trim()
  if (!name) return iface

  const factsIpv4 = getIpv4FromFacts(server, name)
  const primaryName = server.primary_interface?.trim()
  const defaultIpv4 =
    primaryName === name ? getDefaultIpv4FromFacts(server) : undefined

  return {
    ...iface,
    address: iface.address?.trim() || factsIpv4?.address || defaultIpv4?.address,
    netmask: iface.netmask ?? factsIpv4?.netmask ?? defaultIpv4?.netmask,
    prefix: iface.prefix ?? factsIpv4?.prefix ?? defaultIpv4?.prefix,
    broadcast: iface.broadcast ?? factsIpv4?.broadcast ?? defaultIpv4?.broadcast,
    network: iface.network ?? factsIpv4?.network ?? defaultIpv4?.network,
  }
}
