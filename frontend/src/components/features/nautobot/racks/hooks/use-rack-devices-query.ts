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
      const racks = response?.data?.racks
      const rack = Array.isArray(racks) && racks.length > 0 ? racks[0] : undefined
      if (!rack) return EMPTY_RACK_DEVICES

      const devices = Array.isArray(rack.devices) ? rack.devices : []
      const mappedDevices: RackDevice[] = devices.map((d) => {
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
          uHeight: d.device_type?.u_height ?? 1,
        }
      })

      // Map Nautobot rack reservations into RackDevice entries so they render
      // with the same reservation visual (blue-gray + amber stripe + [res] label).
      const reservations = Array.isArray(rack.rack_reservations) ? rack.rack_reservations : []
      const mappedReservations: RackDevice[] = reservations.flatMap((res) => {
        if (!Array.isArray(res.units) || res.units.length === 0) return []
        const position = Math.min(...res.units)
        // Use span from min to max unit to handle contiguous multi-unit reservations.
        const uHeight = Math.max(...res.units) - position + 1
        return [{
          id: `__reservation__::${res.id}`,
          name: res.description,
          position,
          face: 'front' as const,
          uHeight,
          isReservation: true,
        }]
      })

      return [...mappedDevices, ...mappedReservations]
    },
    enabled: !!rackId,
    staleTime: RACK_STALE_TIMES.DYNAMIC,
  })

  return {
    rackDevices: query.data ?? EMPTY_RACK_DEVICES,
    isLoading: query.isLoading,
  }
}
