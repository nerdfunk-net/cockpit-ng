import type { Device, LocationItem, TableFilters, DropdownOption } from '../types'

/**
 * Build hierarchical path for a location (e.g., "Parent → Child → Grandchild")
 */
export function buildLocationPath(
  location: LocationItem,
  locationMap: Map<string, LocationItem>
): string {
  const names: string[] = []
  const visited = new Set<string>()
  let current: LocationItem | undefined = location

  while (current) {
    if (visited.has(current.id)) {
      names.unshift(`${current.name} (cycle)`)
      break
    }
    visited.add(current.id)
    names.unshift(current.name)

    const parentId = current.parent?.id
    if (!parentId) break
    current = locationMap.get(parentId)
    if (!current) break
  }

  return names.join(' → ')
}

/**
 * Build location hierarchy with hierarchicalPath for each location
 */
export function buildLocationHierarchy(locations: LocationItem[]): LocationItem[] {
  const map = new Map<string, LocationItem>()
  locations.forEach((l) => map.set(l.id, { ...l }))

  const processed = locations.map((loc) => {
    const copy = { ...loc }
    copy.hierarchicalPath = buildLocationPath(copy, map)
    return copy
  })

  processed.sort((a, b) =>
    (a.hierarchicalPath || '').localeCompare(b.hierarchicalPath || '')
  )
  return processed
}

/**
 * Filter devices based on table filters and role filters
 */
export function filterDevices(
  devices: Device[],
  filters: TableFilters,
  roleFilters: Record<string, boolean>
): Device[] {
  let filtered = devices

  // Device name filter
  if (filters.deviceName) {
    const search = filters.deviceName.toLowerCase()
    filtered = filtered.filter((device) =>
      device.name?.toLowerCase().includes(search)
    )
  }

  // Role filter (multi-select)
  if (Object.keys(roleFilters).length > 0) {
    filtered = filtered.filter((device) => {
      const deviceRole = device.role?.name || ''
      // If the device's role isn't in our filter list, show it (backward compatibility)
      if (!(deviceRole in roleFilters)) return true
      return roleFilters[deviceRole] === true
    })
  }

  // Location filter
  if (filters.location && filters.location !== 'all') {
    filtered = filtered.filter(
      (device) => device.location?.name === filters.location
    )
  }

  // IP address filter
  if (filters.ipAddress) {
    const search = filters.ipAddress.toLowerCase()
    filtered = filtered.filter((device) =>
      device.primary_ip4?.address?.toLowerCase().includes(search)
    )
  }

  // Status filter
  if (filters.status && filters.status !== 'all') {
    filtered = filtered.filter(
      (device) => device.status?.name === filters.status
    )
  }

  return filtered
}

/**
 * Extract unique filter options from device list
 */
export function extractFilterOptions(devices: Device[]): {
  roles: DropdownOption[]
  locations: DropdownOption[]
  statuses: DropdownOption[]
} {
  const roles = new Set<string>()
  const locations = new Set<string>()
  const statuses = new Set<string>()

  devices.forEach((device) => {
    if (device.role?.name) roles.add(device.role.name)
    if (device.location?.name) locations.add(device.location.name)
    if (device.status?.name) statuses.add(device.status.name)
  })

  return {
    roles: Array.from(roles).sort().map((name) => ({ id: name, name })),
    locations: Array.from(locations).sort().map((name) => ({ id: name, name })),
    statuses: Array.from(statuses).sort().map((name) => ({ id: name, name })),
  }
}

/**
 * Get status badge color class
 */
export function getStatusBadgeClass(status: string): string {
  const statusLower = status.toLowerCase()
  if (statusLower.includes('active') || statusLower.includes('online')) {
    return 'bg-blue-500'
  }
  if (statusLower.includes('failed') || statusLower.includes('offline')) {
    return 'bg-red-500'
  }
  if (statusLower.includes('maintenance')) {
    return 'bg-yellow-500'
  }
  return 'bg-gray-500'
}

/**
 * Page size options for pagination
 */
export const PAGE_SIZE_OPTIONS = [10, 50, 100, 200, 500] as const
