import type { SelectedInterface, ServerResponse } from '../types'

interface Ipv4Info {
  address?: string
  netmask?: string
  broadcast?: string
  network?: string
  prefix?: string
}

/** Read IPv4 details for an interface name from stored Ansible facts. */
export function getIpv4FromFacts(
  server: ServerResponse,
  ifaceName: string
): Pick<SelectedInterface, 'address' | 'netmask' | 'broadcast' | 'network' | 'prefix'> | undefined {
  const ansibleFacts = server.ansible_facts?.ansible_facts as Record<string, unknown> | undefined
  const rawFacts = server.ansible_facts?.facts as Record<string, unknown> | undefined

  const ipv4 =
    ((ansibleFacts?.[ifaceName] as Record<string, unknown> | undefined)?.ipv4 as
      | Ipv4Info
      | undefined) ??
    ((rawFacts?.[`ansible_${ifaceName}`] as Record<string, unknown> | undefined)?.ipv4 as
      | Ipv4Info
      | undefined)

  if (!ipv4?.address) return undefined

  return {
    address: ipv4.address,
    netmask: ipv4.netmask,
    broadcast: ipv4.broadcast,
    network: ipv4.network,
    prefix: ipv4.prefix,
  }
}
