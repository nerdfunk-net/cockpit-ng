/**
 * Compliance Device Selection Tab
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
      title="Select Devices"
      description="Use logical operations to filter and select devices for compliance checking"
      nextStepMessage="Switch to the Settings tab to configure compliance checks, or Check tab to run compliance verification."
      showCard={true}
      alertStyle="default"
    />
  )
}
