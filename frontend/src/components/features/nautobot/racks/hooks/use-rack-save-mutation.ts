import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { RackFaceAssignments } from '../types'

interface SaveRackInput {
  rackId: string
  locationId: string
  overwriteLocation: boolean
  localFront: RackFaceAssignments
  localRear: RackFaceAssignments
  originalFront: RackFaceAssignments
  originalRear: RackFaceAssignments
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
    }: SaveRackInput) => {
      const removals: Array<{ deviceId: string }> = []
      const assignments: Array<{
        deviceId: string
        rackId: string
        position: number
        face: 'front' | 'rear'
      }> = []

      for (const faceName of ['front', 'rear'] as const) {
        const local = faceName === 'front' ? localFront : localRear
        const original = faceName === 'front' ? originalFront : originalRear

        // Collect removals: device was in original but gone or replaced
        for (const [posStr, origSlot] of Object.entries(original)) {
          if (!origSlot) continue
          const pos = Number(posStr)
          const localSlot = local[pos]
          if (!localSlot || localSlot.deviceId !== origSlot.deviceId) {
            removals.push({ deviceId: origSlot.deviceId })
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

      await Promise.all([
        ...removals.map(({ deviceId }) =>
          apiCall(`nautobot/devices/${deviceId}`, {
            method: 'PATCH',
            body: JSON.stringify({ clear_rack_assignment: true }),
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
