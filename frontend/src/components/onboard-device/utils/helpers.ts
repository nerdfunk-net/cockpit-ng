import type { LocationItem, DropdownOption } from '../types'
import { EMPTY_STRING_ARRAY } from '../constants'

/**
 * Validates an IP address or comma-separated list of IP addresses
 */
export function validateIPAddress(ip: string): boolean {
  if (!ip.trim()) return false

  const ipAddresses = ip.split(',').map(addr => addr.trim()).filter(addr => addr.length > 0)
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/

  return ipAddresses.length > 0 && ipAddresses.every(addr => ipRegex.test(addr))
}

/**
 * Builds hierarchical path for a location by traversing up the parent chain
 */
export function buildLocationPath(
  location: LocationItem,
  locationMap: Map<string, LocationItem>
): string {
  const path: string[] = []
  let current = location

  // Traverse up the hierarchy to build the full path
  while (current) {
    path.unshift(current.name) // Add to beginning of array

    // Move to parent if it exists
    if (current.parent?.id) {
      const parent = locationMap.get(current.parent.id)
      if (parent && !path.includes(parent.name)) {
        // Prevent circular references
        current = parent
      } else {
        break
      }
    } else {
      break // No parent, we've reached the root
    }
  }

  // Join path with arrows, or return just the name if it's a root location
  return path.length > 1 ? path.join(' → ') : path[0] || ''
}

/**
 * Builds location hierarchy with full paths and sorts alphabetically
 */
export function buildLocationHierarchy(locations: LocationItem[]): LocationItem[] {
  // Create a map for quick location lookup by ID
  const locationMap = new Map<string, LocationItem>()
  locations.forEach(location => {
    locationMap.set(location.id, location)
  })

  // Build hierarchical path for each location
  const processedLocations = locations.map(location => {
    const hierarchicalPath = buildLocationPath(location, locationMap)
    return {
      ...location,
      hierarchicalPath
    }
  })

  // Sort locations by their hierarchical path
  return processedLocations.sort((a, b) =>
    (a.hierarchicalPath || '').localeCompare(b.hierarchicalPath || '')
  )
}

/**
 * Finds a dropdown option by name or display value
 */
export function findDefaultOption(
  options: DropdownOption[],
  name: string
): DropdownOption | undefined {
  return options.find(option => option.name === name || option.display === name)
}

/**
 * Base interface for items that can be resolved by name or ID
 */
interface ResolvableItem {
  id: string
  name: string
  display?: string
  [key: string]: unknown
}

/**
 * Generic resolver function that converts a name or ID to an ID
 *
 * @param value - The value to resolve (name or ID)
 * @param items - Array of items to search
 * @param additionalFields - Additional fields to check (e.g., 'slug', 'hierarchicalPath')
 * @param fallbackValue - Value to return if no match found (default: empty string)
 * @returns The resolved ID or fallback value
 */
function resolveToId<T extends ResolvableItem>(
  value: string,
  items: T[],
  additionalFields: string[] = EMPTY_STRING_ARRAY,
  fallbackValue: string = ''
): string {
  if (!value) return fallbackValue

  // Check if value is already a UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (uuidRegex.test(value)) {
    if (items.some(item => item.id === value)) {
      return value
    }
  }

  // Try to find by exact match (case-insensitive)
  const lowerValue = value.toLowerCase()
  const match = items.find(item => {
    // Check standard fields
    if (item.name.toLowerCase() === lowerValue) return true
    if (item.display && item.display.toLowerCase() === lowerValue) return true

    // Check additional fields
    for (const field of additionalFields) {
      const fieldValue = item[field]
      if (fieldValue && String(fieldValue).toLowerCase() === lowerValue) {
        return true
      }
    }

    return false
  })

  if (match) {
    return match.id
  }

  // Return fallback value if no match
  return fallbackValue
}

/**
 * Resolves a name or ID to an ID from a list of options.
 * First checks if the value is already an ID (UUID format), then tries to find by name.
 * Also checks network_driver field for platforms (e.g., "cisco_ios").
 * Returns empty string if no match found.
 */
export function resolveNameToId(
  value: string,
  options: DropdownOption[]
): string {
  return resolveToId(value, options as ResolvableItem[], ['network_driver', 'slug'], '')
}

/**
 * Resolves a location name or ID to an ID.
 * Locations have hierarchical paths, so we need to handle those too.
 * Returns the original value if no match found (for backward compatibility).
 */
export function resolveLocationNameToId(
  value: string,
  locations: LocationItem[]
): string {
  return resolveToId(value, locations as ResolvableItem[], ['hierarchicalPath'], value)
}

/**
 * Validates CSV headers against expected columns
 */
export function validateCSVHeaders(
  headers: string[],
  requiredHeaders: string[]
): {
  isValid: boolean
  missingHeaders: string[]
  extraHeaders: string[]
} {
  const missingHeaders = requiredHeaders.filter(header => !headers.includes(header))
  const extraHeaders = headers.filter(header => !requiredHeaders.includes(header))

  return {
    isValid: missingHeaders.length === 0,
    missingHeaders,
    extraHeaders
  }
}
