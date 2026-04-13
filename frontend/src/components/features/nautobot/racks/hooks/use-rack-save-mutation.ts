import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { RackFaceAssignments, RackDevice } from '../types'

interface SaveRackInput {
  rackId: string
  locationId: string
  overwriteLocation: boolean
  localFront: RackFaceAssignments
  localRear: RackFaceAssignments
  originalFront: RackFaceAssignments
  originalRear: RackFaceAssignments
  localUnpositioned: RackDevice[]
  originalUnpositioned: RackDevice[]
}

export function useRackSaveMutation() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const saveRack = useMutation({
    mutationFn: async ({
      rackId,
      locationId,
      overwriteLocation,
      localFront,
      localRear,
      originalFront,
      originalRear,
      localUnpositioned,
      originalUnpositioned,
    }: SaveRackInput) => {
      const isReservationId = (id: string) => id.startsWith('__reservation__::')

      const removals: Array<{ deviceId: string }> = []
      const positionClears: Array<{ deviceId: string }> = []
      const assignments: Array<{
        deviceId: string
        rackId: string
        position: number
        face: 'front' | 'rear'
      }> = []
      // Reservation slots to be created via the rack-reservation endpoint
      const reservationSlots: Array<{ position: number; deviceName: string }> = []

      // Device IDs that were moved to "unpositioned" (clear position/face, keep rack)
      const movedToUnpositionedIds = new Set(localUnpositioned.map((d) => d.id))
      const originalUnpositionedIds = new Set(originalUnpositioned.map((d) => d.id))

      for (const faceName of ['front', 'rear'] as const) {
        const local = faceName === 'front' ? localFront : localRear
        const original = faceName === 'front' ? originalFront : originalRear

        // Collect removals/positionClears: device was in original but gone or replaced
        for (const [posStr, origSlot] of Object.entries(original)) {
          if (!origSlot) continue
          if (isReservationId(origSlot.deviceId)) continue // reservations handled separately
          const pos = Number(posStr)
          const localSlot = local[pos]
          if (!localSlot || localSlot.deviceId !== origSlot.deviceId) {
            if (movedToUnpositionedIds.has(origSlot.deviceId)) {
              positionClears.push({ deviceId: origSlot.deviceId })
            } else {
              removals.push({ deviceId: origSlot.deviceId })
            }
          }
        }

        // Collect assignments: device is in local but wasn't there or is different
        for (const [posStr, localSlot] of Object.entries(local)) {
          if (!localSlot) continue
          const pos = Number(posStr)

          if (localSlot.isReservation) {
            const origSlot = original[pos]
            // Skip if this reservation was already loaded from Nautobot (same id + position).
            // Only queue new reservations (created from CSV import) for POST.
            if (origSlot?.isReservation && origSlot.deviceId === localSlot.deviceId) continue

            // Track reservation slots (deduplicate by deviceName across both faces)
            const alreadyQueued = reservationSlots.some(
              (r) => r.deviceName === localSlot.deviceName && r.position === pos
            )
            if (!alreadyQueued) {
              reservationSlots.push({ position: pos, deviceName: localSlot.deviceName })
            }
            continue
          }

          if (isReservationId(localSlot.deviceId)) continue // safety guard

          const origSlot = original[pos]
          if (!origSlot || origSlot.deviceId !== localSlot.deviceId) {
            assignments.push({
              deviceId: localSlot.deviceId,
              rackId,
              position: pos,
              face: faceName,
            })
          }
        }
      }

      // Position-clears for devices newly added to unpositioned (not in original unpositioned)
      // that weren't already captured from the face diffs above
      const alreadyHandledIds = new Set([
        ...positionClears.map((r) => r.deviceId),
        ...removals.map((r) => r.deviceId),
        ...assignments.map((a) => a.deviceId),
      ])
      for (const device of localUnpositioned) {
        if (device.isReservation) continue // reservations don't have real device IDs
        if (!originalUnpositionedIds.has(device.id) && !alreadyHandledIds.has(device.id)) {
          positionClears.push({ deviceId: device.id })
        }
      }

      // Collect Nautobot reservation UUIDs that were removed or replaced
      const reservationDeletions: string[] = []
      for (const faceName of ['front', 'rear'] as const) {
        const local = faceName === 'front' ? localFront : localRear
        const original = faceName === 'front' ? originalFront : originalRear
        for (const [posStr, origSlot] of Object.entries(original)) {
          if (!origSlot?.isReservation) continue
          const pos = Number(posStr)
          const localSlot = local[pos]
          if (!localSlot || localSlot.deviceId !== origSlot.deviceId) {
            const uuid = origSlot.deviceId.replace('__reservation__::', '')
            if (!reservationDeletions.includes(uuid)) {
              reservationDeletions.push(uuid)
            }
          }
        }
      }

      // Group reservations by deviceName so a multi-unit device creates one reservation
      const reservationsByName = new Map<string, number[]>()
      for (const { position, deviceName } of reservationSlots) {
        const existing = reservationsByName.get(deviceName) ?? []
        reservationsByName.set(deviceName, [...existing, position])
      }

      await Promise.all([
        ...removals.map(({ deviceId }) =>
          apiCall(`nautobot/devices/${deviceId}`, {
            method: 'PATCH',
            body: JSON.stringify({ clear_rack_assignment: true }),
          })
        ),
        ...positionClears.map(({ deviceId }) =>
          apiCall(`nautobot/devices/${deviceId}`, {
            method: 'PATCH',
            body: JSON.stringify({ clear_position_only: true }),
          })
        ),
        ...assignments.map(({ deviceId, rackId: rid, position, face }) =>
          apiCall(`nautobot/devices/${deviceId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              rack: rid,
              position,
              face,
              ...(overwriteLocation && locationId ? { location: locationId } : {}),
            }),
          })
        ),
        ...Array.from(reservationsByName.entries()).map(([description, units]) =>
          apiCall('nautobot/rack-reservation', {
            method: 'POST',
            body: JSON.stringify({
              rack_id: rackId,
              units,
              description,
              location_id: locationId,
            }),
          })
        ),
        ...(reservationDeletions.length > 0 ? [
          apiCall(
            `nautobot/rack-reservation?${reservationDeletions.map((id) => `ids=${encodeURIComponent(id)}`).join('&')}`,
            { method: 'DELETE' }
          ),
        ] : []),
      ])
    },

    onSuccess: (_data, { rackId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.nautobot.rackDevices(rackId),
      })
      toast({ title: 'Rack saved', description: 'Device assignments updated successfully.' })
    },

    onError: (error: Error) => {
      toast({
        title: 'Save failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  return { saveRack: saveRack.mutate, isSaving: saveRack.isPending }
}
