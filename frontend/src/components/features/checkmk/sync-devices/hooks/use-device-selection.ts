import { useState, useCallback } from 'react'
import type { Device } from '../types/sync-devices.types'

/**
 * Hook for managing device selection state
 */
export function useDeviceSelection() {
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set())

  const handleSelectAll = useCallback((checked: boolean, currentDevices: Device[]) => {
    if (checked) {
      // Only select devices on the current page
      setSelectedDevices(new Set(currentDevices.map(device => device.id)))
    } else {
      // Deselect all devices (not just current page)
      setSelectedDevices(new Set())
    }
  }, [])

  const handleSelectAllFiltered = useCallback((filteredDevices: Device[]) => {
    setSelectedDevices(new Set(filteredDevices.map(device => device.id)))
  }, [])

  const handleSelectDevice = useCallback((deviceId: string, checked: boolean) => {
    setSelectedDevices(prev => {
      const newSelected = new Set(prev)
      if (checked) {
        newSelected.add(deviceId)
      } else {
        newSelected.delete(deviceId)
      }
      return newSelected
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedDevices(new Set())
  }, [])

  return {
    selectedDevices,
    handleSelectAll,
    handleSelectAllFiltered,
    handleSelectDevice,
    clearSelection
  }
}
