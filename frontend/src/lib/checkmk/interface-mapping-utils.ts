/**
 * Utilities for mapping CheckMK inventory interfaces to Nautobot
 */

export interface CheckMKInterface {
  index: number
  name: string // description field
  alias: string
  admin_status: number
  oper_status: number
  phys_address: string
  port_type: number
  speed: number
  available: boolean
  ipAddresses: CheckMKAddress[]
}

export interface CheckMKAddress {
  address: string
  broadcast: string
  cidr: number
  device: string
  netmask: string
  network: string
  type: string
}

export interface InterfaceMapping {
  interface: CheckMKInterface
  enabled: boolean // Whether to sync this interface
  role: string // Interface role (e.g., "access", "trunk", "management")
}

/**
 * Parse interfaces and addresses from CheckMK inventory data
 */
export function parseInterfacesFromInventory(inventoryData: Record<string, unknown> | null): CheckMKInterface[] {
  if (!inventoryData) return []

  try {
    const result = inventoryData.result as Record<string, unknown>
    if (!result) return []

    // Get the first hostname key (e.g., "LAB")
    const hostname = Object.keys(result)[0]
    if (!hostname) return []

    const hostData = result[hostname] as Record<string, unknown>
    const nodes = hostData?.Nodes as Record<string, unknown>
    if (!nodes) return []

    const networking = nodes.networking as Record<string, unknown>
    if (!networking) return []

    const networkingNodes = networking.Nodes as Record<string, unknown>
    if (!networkingNodes) return []

    // Extract interfaces
    const interfacesNode = networkingNodes.interfaces as Record<string, unknown>
    const interfacesTable = interfacesNode?.Table as Record<string, unknown>
    const interfacesRows = (interfacesTable?.Rows as Array<Record<string, unknown>>) || []

    // Extract addresses
    const addressesNode = networkingNodes.addresses as Record<string, unknown>
    const addressesTable = addressesNode?.Table as Record<string, unknown>
    const addressesRows = (addressesTable?.Rows as Array<Record<string, unknown>>) || []

    // Map interfaces and join with addresses
    return interfacesRows.map((iface) => {
      const ifaceName = String(iface.description || '')
      const ifaceAlias = String(iface.alias || '')

      // Find matching addresses by device field
      // Match both exact name and alias (e.g., "Ethernet0/0" or "Et0/0")
      const matchingAddresses = addressesRows.filter((addr) => {
        const device = String(addr.device || '')
        return device === ifaceName || device === ifaceAlias ||
               ifaceName.includes(device) || ifaceAlias.includes(device)
      })

      return {
        index: Number(iface.index || 0),
        name: ifaceName,
        alias: ifaceAlias,
        admin_status: Number(iface.admin_status || 0),
        oper_status: Number(iface.oper_status || 0),
        phys_address: String(iface.phys_address || ''),
        port_type: Number(iface.port_type || 0),
        speed: Number(iface.speed || 0),
        available: Boolean(iface.available),
        ipAddresses: matchingAddresses.map((addr) => ({
          address: String(addr.address || ''),
          broadcast: String(addr.broadcast || ''),
          cidr: Number(addr.cidr || 0),
          device: String(addr.device || ''),
          netmask: String(addr.netmask || ''),
          network: String(addr.network || ''),
          type: String(addr.type || 'ipv4'),
        })),
      }
    })
  } catch (err) {
    console.error('Failed to parse interfaces from inventory:', err)
    return []
  }
}

/**
 * Get admin status label
 */
export function getAdminStatusLabel(status: number): string {
  switch (status) {
    case 1:
      return 'Up'
    case 2:
      return 'Down'
    default:
      return 'Unknown'
  }
}

/**
 * Get operational status label
 */
export function getOperStatusLabel(status: number): string {
  switch (status) {
    case 1:
      return 'Up'
    case 2:
      return 'Down'
    default:
      return 'Unknown'
  }
}

/**
 * Format speed in human-readable format
 */
export function formatSpeed(speed: number): string {
  if (speed >= 1000000000) {
    return `${(speed / 1000000000).toFixed(0)} Gbps`
  } else if (speed >= 1000000) {
    return `${(speed / 1000000).toFixed(0)} Mbps`
  } else if (speed >= 1000) {
    return `${(speed / 1000).toFixed(0)} Kbps`
  }
  return `${speed} bps`
}
