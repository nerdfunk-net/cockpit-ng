/**
 * Snapshot Device Selection Tab
 * Uses the unified DeviceSelectionTab component from shared/
 */

import { DeviceSelectionTab as UnifiedDeviceSelectionTab } from '@/components/shared/device-selection-tab'
import type { DeviceInfo, LogicalCondition } from '@/components/shared/device-selector'

interface DevicesTabProps {
  selectedDeviceIds: string[]
  selectedDevices: DeviceInfo[]
  onDevicesSelected: (devices: DeviceInfo[], conditions: LogicalCondition[]) => void
  onSelectionChange: (selectedIds: string[], devices: DeviceInfo[]) => void
}

export function DevicesTab(props: DevicesTabProps) {
  return (
    <UnifiedDeviceSelectionTab
      {...props}
      nextStepMessage="Switch to the Commands tab to configure snapshot commands, or Snapshots tab to execute and compare snapshots."
      alertStyle="success"
    />
  )
}
