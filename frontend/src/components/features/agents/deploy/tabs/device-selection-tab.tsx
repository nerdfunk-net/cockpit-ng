import { DeviceSelectionTab as UnifiedDeviceSelectionTab } from '@/components/shared/device-selection-tab'
import type { DeviceInfo, LogicalCondition } from '@/components/shared/device-selector'

interface DeviceSelectionTabProps {
  selectedDeviceIds: string[]
  selectedDevices: DeviceInfo[]
  onDevicesSelected: (devices: DeviceInfo[]) => void
}

export function DeviceSelectionTab({
  selectedDeviceIds,
  selectedDevices,
  onDevicesSelected
}: DeviceSelectionTabProps) {
  const handleDevicesSelected = (devices: DeviceInfo[], _conditions: LogicalCondition[]) => {
    onDevicesSelected(devices)
  }

  const handleSelectionChange = (_selectedIds: string[], devices: DeviceInfo[]) => {
    onDevicesSelected(devices)
  }

  return (
    <UnifiedDeviceSelectionTab
      selectedDeviceIds={selectedDeviceIds}
      selectedDevices={selectedDevices}
      onDevicesSelected={handleDevicesSelected}
      onSelectionChange={handleSelectionChange}
      nextStepMessage="Switch to the Variables & Templates tab to configure your deployment."
      alertStyle="success"
    />
  )
}
