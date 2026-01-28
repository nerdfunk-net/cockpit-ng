import type { LocationItem } from '../types'

/**
 * Builds hierarchical path for each location
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
 * Builds full hierarchical path for a single location
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
      if (parent && !path.includes(parent.name)) { // Prevent circular references
        current = parent
      } else {
        break
      }
    } else {
      break // No parent, we've reached the root
    }
  }

  // Join path with arrows, or return just the name if it's a root location
  return path.length > 1 ? path.join(' → ') : (path[0] || '')
}

/**
 * Filters locations by search query
 */
export function filterLocations(
  locations: LocationItem[],
  searchQuery: string
): LocationItem[] {
  if (!searchQuery.trim()) {
    return locations
  }

  const searchLower = searchQuery.toLowerCase()
  return locations.filter(location =>
    location.hierarchicalPath?.toLowerCase().includes(searchLower)
  )
}
