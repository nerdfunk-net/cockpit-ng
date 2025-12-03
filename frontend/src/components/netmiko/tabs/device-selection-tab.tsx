import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2 } from 'lucide-react'
import { DeviceSelector, type DeviceInfo, type LogicalCondition } from '@/components/shared/device-selector'

interface DeviceSelectionTabProps {
  previewDevices: DeviceInfo[]
  deviceConditions: LogicalCondition[]
  selectedDeviceIds: string[]
  selectedDevices: DeviceInfo[]
  onDevicesSelected: (devices: DeviceInfo[], conditions: LogicalCondition[]) => void
  onSelectionChange: (selectedIds: string[], devices: DeviceInfo[]) => void
}

export function DeviceSelectionTab({
  previewDevices,
  deviceConditions,
  selectedDeviceIds,
  selectedDevices,
  onDevicesSelected,
  onSelectionChange,
}: DeviceSelectionTabProps) {
  return (
    <div className="space-y-6">
      <DeviceSelector
        onDevicesSelected={onDevicesSelected}
        showActions={true}
        showSaveLoad={true}
        initialConditions={deviceConditions}
        initialDevices={previewDevices}
        enableSelection={true}
        selectedDeviceIds={selectedDeviceIds}
        onSelectionChange={onSelectionChange}
      />

      {selectedDevices.length > 0 && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>{selectedDevices.length}</strong> device{selectedDevices.length !== 1 ? 's' : ''} selected.
            Switch to the <strong>Variables & Templates</strong> tab to configure templates, or <strong>Commands</strong> tab to execute commands.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
