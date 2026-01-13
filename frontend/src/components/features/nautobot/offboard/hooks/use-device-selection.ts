import { useState, useCallback } from 'react'
import type { Device } from '@/types/features/nautobot/offboard'

export function useDeviceSelection() {
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set())

  const handleSelectDevice = useCallback((deviceId: string, checked: boolean) => {
    setSelectedDevices(prev => {
      const newSet = new Set(prev)
      if (checked) {
        newSet.add(deviceId)
      } else {
        newSet.delete(deviceId)
      }
      return newSet
    })
  }, [])

  const handleSelectAll = useCallback((devices: Device[], checked: boolean) => {
    if (checked) {
      setSelectedDevices(prev => {
        const newSet = new Set(prev)
        devices.forEach(device => newSet.add(device.id))
        return newSet
      })
    } else {
      setSelectedDevices(new Set())
    }
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedDevices(new Set())
  }, [])

  return {
    selectedDevices,
    handleSelectDevice,
    handleSelectAll,
    clearSelection
  }
}
