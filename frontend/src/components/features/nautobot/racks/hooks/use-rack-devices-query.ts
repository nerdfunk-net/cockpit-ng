import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { fetchRackDevices } from '@/services/nautobot-graphql'
import { RACK_STALE_TIMES, EMPTY_RACK_DEVICES } from '../constants'
import type { RackDevice } from '../types'

interface UseRackDevicesQueryOptions {
  rackId?: string
}

const DEFAULT_OPTIONS: UseRackDevicesQueryOptions = {}

export function useRackDevicesQuery({ rackId }: UseRackDevicesQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()

  const query = useQuery({
    queryKey: queryKeys.nautobot.rackDevices(rackId ?? ''),
    queryFn: async (): Promise<RackDevice[]> => {
      if (!rackId) return EMPTY_RACK_DEVICES
      const response = await fetchRackDevices(apiCall, rackId)
      const devices = response?.data?.devices
      if (!Array.isArray(devices)) return EMPTY_RACK_DEVICES
      return devices.map((d) => {
        // Nautobot may return face in different formats (lowercase, capitalized, or null).
        // Normalize to 'front' | 'rear' | null; default to 'front' when unrecognized
        // so devices without an explicit face still appear in the rack view.
        const rawFace = d.face ? String(d.face).toLowerCase().trim() : null
        const normalizedFace: 'front' | 'rear' | null =
          rawFace === 'front' ? 'front'
          : rawFace === 'rear' ? 'rear'
          : 'front' // default to front — most rack devices are front-mounted
        return {
          id: d.id,
          name: d.name,
          position: d.position,
          face: normalizedFace,
        }
      })
    },
    enabled: !!rackId,
    staleTime: RACK_STALE_TIMES.DYNAMIC,
  })

  return {
    rackDevices: query.data ?? EMPTY_RACK_DEVICES,
    isLoading: query.isLoading,
  }
}
