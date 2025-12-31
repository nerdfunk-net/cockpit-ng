/**
 * Nautobot Export Device Selection Tab
 * Uses the unified DeviceSelectionTab component from shared/
 */

import { DeviceSelectionTab as UnifiedDeviceSelectionTab } from '@/components/shared/device-selection-tab'
import type { DeviceInfo, LogicalCondition } from '@/components/shared/device-selector'

interface DeviceSelectionTabProps {
  selectedDeviceIds: string[]
  selectedDevices: DeviceInfo[]
  onDevicesSelected: (devices: DeviceInfo[], conditions: LogicalCondition[]) => void
  onSelectionChange: (selectedIds: string[], devices: DeviceInfo[]) => void
}

export function DeviceSelectionTab(props: DeviceSelectionTabProps) {
  return (
    <UnifiedDeviceSelectionTab
      {...props}
      nextStepMessage="Switch to the Properties tab to select export properties, or Export tab to download data."
      alertStyle="success"
    />
  )
}
