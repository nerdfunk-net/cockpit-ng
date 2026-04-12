'use client'

import { useState, useMemo, useCallback } from 'react'
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
}

export function UnpositionedDevicesPanel({
  devices,
  uHeight,
  frontAssignments,
  rearAssignments,
  onAdd,
}: UnpositionedDevicesPanelProps) {
  const [selectedPositions, setSelectedPositions] = useState<Record<string, string>>({})

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
        (p) => !occupiedPositions.has(p)
      ),
    [uHeight, occupiedPositions]
  )

  const handlePositionChange = useCallback((deviceId: string, value: string) => {
    setSelectedPositions((prev) => ({ ...prev, [deviceId]: value }))
  }, [])

  const handleAssign = useCallback(
    (device: RackDevice, face: 'front' | 'rear') => {
      const posStr = selectedPositions[device.id]
      if (!posStr || posStr === UNSET_VALUE) return
      const position = Number(posStr)
      onAdd(position, face, { id: device.id, name: device.name, uHeight: device.uHeight })
    },
    [selectedPositions, onAdd]
  )

  if (devices.length === 0) return null

  return (
    <div className="flex flex-col shrink-0" style={{ minWidth: 300, maxWidth: 380 }}>
      <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">
        Non-Racked Devices
      </h3>
      <div className="border border-gray-200 rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-2 py-1.5 text-left font-medium text-gray-600">Name</th>
              <th className="px-2 py-1.5 text-left font-medium text-gray-600">Position</th>
              <th className="px-2 py-1.5 text-left font-medium text-gray-600">Action</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => {
              const selectedPos = selectedPositions[device.id] ?? UNSET_VALUE
              const isPositionSet = selectedPos !== UNSET_VALUE

              return (
                <tr key={device.id} className="border-b border-gray-100 last:border-b-0">
                  <td
                    className="px-2 py-1.5 text-gray-800 truncate max-w-[140px]"
                    title={device.name}
                  >
                    {device.name}
                  </td>
                  <td className="px-2 py-1.5">
                    <Select
                      value={selectedPos}
                      onValueChange={(v) => handlePositionChange(device.id, v)}
                    >
                      <SelectTrigger className="h-6 text-xs w-20 px-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNSET_VALUE}>unset</SelectItem>
                        {availablePositions.map((pos) => (
                          <SelectItem key={pos} value={String(pos)}>
                            {pos}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex gap-1">
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
