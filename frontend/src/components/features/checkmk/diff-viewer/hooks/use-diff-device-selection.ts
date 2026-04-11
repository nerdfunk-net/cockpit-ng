import { useState, useCallback, useMemo } from 'react'
import type { DiffDevice } from '../types'

export function useDiffDeviceSelection() {
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set())

  const handleSelectDevice = useCallback((nautobotId: string, checked: boolean) => {
    setSelectedDevices(prev => {
      const next = new Set(prev)
      if (checked) next.add(nautobotId)
      else next.delete(nautobotId)
      return next
    })
  }, [])

  const handleSelectAll = useCallback((devices: DiffDevice[], checked: boolean) => {
    if (checked) {
      setSelectedDevices(new Set(
        devices.filter(d => !!d.nautobot_id).map(d => d.nautobot_id!)
      ))
    } else {
      setSelectedDevices(new Set())
    }
  }, [])

  const clearSelection = useCallback(() => setSelectedDevices(new Set()), [])

  return useMemo(
    () => ({ selectedDevices, handleSelectDevice, handleSelectAll, clearSelection }),
    [selectedDevices, handleSelectDevice, handleSelectAll, clearSelection]
  )
}
