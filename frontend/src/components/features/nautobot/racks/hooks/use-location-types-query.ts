import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { RACK_STALE_TIMES } from '../constants'
import type { LocationType } from '../types'

export function useLocationTypesQuery() {
  const { apiCall } = useApi()
  return useQuery({
    queryKey: queryKeys.nautobot.locationTypes(),
    queryFn: () => apiCall<LocationType[]>('nautobot/location-types'),
    staleTime: RACK_STALE_TIMES.STATIC,
  })
}

export interface LocationTypeOption {
  id: string
  label: string
  depth: number
}

/**
 * Converts a flat list of LocationType objects (each with an optional parent
 * reference) into a sorted list of display options.
 *
 * Each option's label is the full hierarchy path from the root type to that
 * type, e.g. "Country > State > City > Building > Room".
 * Options are sorted by depth (root first), then alphabetically within each
 * depth level.
 */
export function buildLocationTypeOptions(types: LocationType[]): LocationTypeOption[] {
  if (types.length === 0) return []

  // Build id → type lookup map
  const byId = new Map<string, LocationType>()
  for (const t of types) {
    byId.set(t.id, t)
  }

  // Compute depth and full path for each type
  const getDepthAndPath = (type: LocationType): { depth: number; path: string } => {
    const chain: string[] = [type.name]
    let current: LocationType = type

    let guard = 0
    while (current.parent && guard < 20) {
      const parent = byId.get(current.parent.id)
      if (!parent) break
      chain.unshift(parent.name)
      current = parent
      guard++
    }

    return { depth: chain.length - 1, path: chain.join(' > ') }
  }

  const options: LocationTypeOption[] = types.map(t => {
    const { depth, path } = getDepthAndPath(t)
    return { id: t.id, label: path, depth }
  })

  // Sort by depth, then alphabetically
  options.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth
    return a.label.localeCompare(b.label)
  })

  return options
}
