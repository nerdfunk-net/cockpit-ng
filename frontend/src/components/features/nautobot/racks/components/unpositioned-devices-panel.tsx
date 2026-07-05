'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { RackDevice, RackFaceAssignments, DeviceSearchResult } from '../types'

const UNSET_VALUE = 'unset'

interface UnpositionedDevicesPanelProps {
  devices: RackDevice[]
  uHeight: number
  frontAssignments: RackFaceAssignments
  rearAssignments: RackFaceAssignments
  onAdd: (position: number, face: 'front' | 'rear', device: DeviceSearchResult) => void
  onAddAsReservation: (position: number, device: DeviceSearchResult) => void
}

export function UnpositionedDevicesPanel({
  devices,
  uHeight,
  frontAssignments,
  rearAssignments,
  onAdd,
  onAddAsReservation,
}: UnpositionedDevicesPanelProps) {
  const [selectedPositions, setSelectedPositions] = useState<Record<string, string>>({})

  // Pre-fill position selector for devices that have a defaultPosition (e.g. from CSV import)
  useEffect(() => {
    setSelectedPositions(prev => {
      let changed = false
      const next = { ...prev }
      for (const device of devices) {
        if (device.defaultPosition !== undefined && !next[device.id]) {
          next[device.id] = String(device.defaultPosition)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [devices])

  const occupiedPositions = useMemo(() => {
    const s = new Set<number>()
    for (const [pos, a] of Object.entries(frontAssignments)) {
      if (a) s.add(Number(pos))
    }
    for (const [pos, a] of Object.entries(rearAssignments)) {
      if (a) s.add(Number(pos))
    }
    return s
  }, [frontAssignments, rearAssignments])

  const availablePositions = useMemo(
    () =>
      Array.from({ length: uHeight }, (_, i) => uHeight - i).filter(
        p => !occupiedPositions.has(p)
      ),
    [uHeight, occupiedPositions]
  )

  const handlePositionChange = useCallback((deviceId: string, value: string) => {
    setSelectedPositions(prev => ({ ...prev, [deviceId]: value }))
  }, [])

  const handleAssign = useCallback(
    (device: RackDevice, face: 'front' | 'rear') => {
      const posStr = selectedPositions[device.id]
      if (!posStr || posStr === UNSET_VALUE) return
      const position = Number(posStr)
      onAdd(position, face, {
        id: device.id,
        name: device.name,
        uHeight: device.uHeight,
      })
    },
    [selectedPositions, onAdd]
  )

  const handleAssignReservation = useCallback(
    (device: RackDevice) => {
      const posStr = selectedPositions[device.id]
      if (!posStr || posStr === UNSET_VALUE) return
      const position = Number(posStr)
      onAddAsReservation(position, {
        id: device.id,
        name: device.name,
        uHeight: device.uHeight,
      })
    },
    [selectedPositions, onAddAsReservation]
  )

  if (devices.length === 0) return null

  return (
    <div className="flex flex-col shrink-0" style={{ minWidth: 300, maxWidth: 380 }}>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        Non-Racked Devices
      </h3>
      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted border-b">
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                Name
              </th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                Position
              </th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {devices.map(device => {
              const selectedPos = selectedPositions[device.id] ?? UNSET_VALUE
              const isPositionSet = selectedPos !== UNSET_VALUE

              return (
                <tr key={device.id} className="border-b last:border-b-0">
                  <td
                    className="px-2 py-1.5 text-foreground truncate max-w-[140px]"
                    title={device.name}
                  >
                    {device.name}
                  </td>
                  <td className="px-2 py-1.5">
                    <Select
                      value={selectedPos}
                      onValueChange={v => handlePositionChange(device.id, v)}
                    >
                      <SelectTrigger className="h-6 text-xs w-20 px-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNSET_VALUE}>unset</SelectItem>
                        {availablePositions.map(pos => (
                          <SelectItem key={pos} value={String(pos)}>
                            {pos}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex gap-1">
                      {device.isReservation ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-1.5 text-xs font-semibold text-warning-foreground border-warning-border hover:bg-warning"
                          title="Place as rack reservation"
                          disabled={!isPositionSet}
                          onClick={() => handleAssignReservation(device)}
                        >
                          RES
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 w-6 p-0 text-xs font-semibold"
                            title="Assign to front face"
                            disabled={!isPositionSet}
                            onClick={() => handleAssign(device, 'front')}
                          >
                            F
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 w-6 p-0 text-xs font-semibold"
                            title="Assign to rear face"
                            disabled={!isPositionSet}
                            onClick={() => handleAssign(device, 'rear')}
                          >
                            R
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
