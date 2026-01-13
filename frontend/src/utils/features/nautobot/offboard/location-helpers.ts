import type { LocationItem } from '@/types/features/nautobot/offboard'

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

export function buildLocationHierarchy(locations: LocationItem[]): LocationItem[] {
  const map = new Map<string, LocationItem>()
  locations.forEach(l => map.set(l.id, { ...l }))

  const processed = locations.map(loc => {
    const copy = { ...loc }
    copy.hierarchicalPath = buildLocationPath(copy, map)
    return copy
  })

  processed.sort((a, b) => (a.hierarchicalPath || '').localeCompare(b.hierarchicalPath || ''))
  return processed
}
