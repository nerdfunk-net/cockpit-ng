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
      const removals: Array<{ deviceId: string }> = []
      const positionClears: Array<{ deviceId: string }> = []
      const assignments: Array<{
        deviceId: string
        rackId: string
        position: number
        face: 'front' | 'rear'
      }> = []

      // Device IDs that were moved to "unpositioned" (clear position/face, keep rack)
      const movedToUnpositionedIds = new Set(localUnpositioned.map((d) => d.id))
      const originalUnpositionedIds = new Set(originalUnpositioned.map((d) => d.id))

      for (const faceName of ['front', 'rear'] as const) {
        const local = faceName === 'front' ? localFront : localRear
        const original = faceName === 'front' ? originalFront : originalRear

        // Collect removals/positionClears: device was in original but gone or replaced
        for (const [posStr, origSlot] of Object.entries(original)) {
          if (!origSlot) continue
          const pos = Number(posStr)
          const localSlot = local[pos]
          if (!localSlot || localSlot.deviceId !== origSlot.deviceId) {
            if (movedToUnpositionedIds.has(origSlot.deviceId)) {
              // Keep rack, only clear position and face
              positionClears.push({ deviceId: origSlot.deviceId })
            } else {
              // Full rack removal
              removals.push({ deviceId: origSlot.deviceId })
            }
          }
        }

        // Collect assignments: device is in local but wasn't there or is different
        for (const [posStr, localSlot] of Object.entries(local)) {
          if (!localSlot) continue
          const pos = Number(posStr)
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
        if (!originalUnpositionedIds.has(device.id) && !alreadyHandledIds.has(device.id)) {
          positionClears.push({ deviceId: device.id })
        }
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
