/**
 * Netmiko Device Selection Tab
 * Uses the unified DeviceSelectionTab component from shared/
 */

import { DeviceSelectionTab as UnifiedDeviceSelectionTab } from '@/components/shared/device-selection-tab'
import type { DeviceInfo, LogicalCondition } from '@/components/shared/device-selector'

interface DeviceSelectionTabProps {
  previewDevices: DeviceInfo[]
  deviceConditions: LogicalCondition[]
  selectedDeviceIds: string[]
  selectedDevices: DeviceInfo[]
  onDevicesSelected: (devices: DeviceInfo[], conditions: LogicalCondition[]) => void
  onSelectionChange: (selectedIds: string[], devices: DeviceInfo[]) => void
}

export function DeviceSelectionTab(props: DeviceSelectionTabProps) {
  return (
    <UnifiedDeviceSelectionTab
      {...props}
      nextStepMessage="Switch to the Variables & Templates tab to configure templates, or Commands tab to execute commands."
      alertStyle="success"
    />
  )
}
