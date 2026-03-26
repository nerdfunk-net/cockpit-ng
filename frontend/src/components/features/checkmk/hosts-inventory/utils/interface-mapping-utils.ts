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
 * Extract letter prefix and numeric/special suffix from interface name
 * Examples: "Et0/0" -> { prefix: "Et", suffix: "0/0" }
 *           "GigabitEthernet1/1" -> { prefix: "GigabitEthernet", suffix: "1/1" }
 */
function extractInterfaceParts(name: string): { prefix: string; suffix: string } {
  const match = name.match(/^([a-zA-Z]+)(.*)$/)
  if (match && match[1] !== undefined && match[2] !== undefined) {
    return {
      prefix: match[1],
      suffix: match[2],
    }
  }
  return { prefix: name, suffix: '' }
}

/**
 * Smart matching of device name to interface name
 * Handles abbreviated names like "Et0/0" -> "Ethernet0/0"
 */
function matchesInterface(deviceName: string, interfaceName: string, interfaceAlias: string): boolean {
  // Exact match (case-insensitive)
  if (deviceName.toLowerCase() === interfaceName.toLowerCase() ||
      deviceName.toLowerCase() === interfaceAlias.toLowerCase()) {
    return true
  }

  // Extract parts from device name (e.g., "Et0/0" -> prefix="Et", suffix="0/0")
  const deviceParts = extractInterfaceParts(deviceName)

  // Extract parts from interface name (e.g., "Ethernet0/0" -> prefix="Ethernet", suffix="0/0")
  const ifaceParts = extractInterfaceParts(interfaceName)
  const aliasParts = interfaceAlias ? extractInterfaceParts(interfaceAlias) : { prefix: '', suffix: '' }

  // Check if numeric/special suffix matches
  const suffixMatches = (parts: { prefix: string; suffix: string }) => {
    if (!deviceParts.suffix || !parts.suffix) return false
    return parts.suffix === deviceParts.suffix
  }

  // Check if prefix matches (case-insensitive, check if interface prefix starts with device prefix)
  const prefixMatches = (parts: { prefix: string; suffix: string }) => {
    if (!deviceParts.prefix || !parts.prefix) return false
    return parts.prefix.toLowerCase().startsWith(deviceParts.prefix.toLowerCase())
  }

  // Match if both suffix and prefix match for interface name
  if (suffixMatches(ifaceParts) && prefixMatches(ifaceParts)) {
    return true
  }

  // Match if both suffix and prefix match for interface alias
  if (interfaceAlias && suffixMatches(aliasParts) && prefixMatches(aliasParts)) {
    return true
  }

  // Fallback: check if interface name contains device name
  if (interfaceName.toLowerCase().includes(deviceName.toLowerCase()) ||
      interfaceAlias.toLowerCase().includes(deviceName.toLowerCase())) {
    return true
  }

  return false
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
      const ifaceDescription = String(iface.description || '')
      const ifaceAlias = String(iface.alias || '')
      
      // Use alias as interface name, fall back to description if alias is empty
      const ifaceName = ifaceAlias || ifaceDescription

      // Find matching addresses using smart matching
      // Handles abbreviated names like "Et0/0" -> "Ethernet0/0"
      const matchingAddresses = addressesRows.filter((addr) => {
        const device = String(addr.device || '')
        return matchesInterface(device, ifaceDescription, ifaceAlias)
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

/**
 * Parse interfaces from addresses table (alternative to interfaces table)
 * Uses addresses.Rows[] to extract interface and IP information
 * Default behavior: Interface status = Active, First IP role = None, Others = Secondary
 */
export function parseInterfacesFromAddresses(inventoryData: Record<string, unknown> | null): CheckMKInterface[] {
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

    // Extract addresses
    const addressesNode = networkingNodes.addresses as Record<string, unknown>
    const addressesTable = addressesNode?.Table as Record<string, unknown>
    const addressesRows = (addressesTable?.Rows as Array<Record<string, unknown>>) || []

    // Group addresses by interface name (device field)
    const interfaceMap = new Map<string, CheckMKAddress[]>()

    addressesRows.forEach((addr) => {
      const device = String(addr.device || '')
      if (!device) return

      const address: CheckMKAddress = {
        address: String(addr.address || ''),
        broadcast: String(addr.broadcast || ''),
        cidr: Number(addr.prefixlength || 0), // Use prefixlength from addresses table
        device: device,
        netmask: String(addr.netmask || ''),
        network: String(addr.network || ''),
        type: String(addr.type || 'ipv4'),
      }

      if (!interfaceMap.has(device)) {
        interfaceMap.set(device, [])
      }
      interfaceMap.get(device)!.push(address)
    })

    // Convert grouped addresses to CheckMKInterface array
    const interfaces: CheckMKInterface[] = []
    let index = 0

    interfaceMap.forEach((addresses, interfaceName) => {
      interfaces.push({
        index: ++index,
        name: interfaceName,
        alias: interfaceName,
        admin_status: 1, // Default to Up
        oper_status: 1,  // Default to Up
        phys_address: '', // Not available from addresses table
        port_type: 6,    // Default to Ethernet
        speed: 0,        // Not available from addresses table
        available: true, // Default to true
        ipAddresses: addresses,
      })
    })

    return interfaces
  } catch (err) {
    console.error('Failed to parse interfaces from addresses:', err)
    return []
  }
}
