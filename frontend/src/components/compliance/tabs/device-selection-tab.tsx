import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
      <Card>
        <CardHeader>
          <CardTitle>Select Devices</CardTitle>
          <CardDescription>
            Use logical operations to filter and select devices for compliance checking
          </CardDescription>
        </CardHeader>
      </Card>

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
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            <strong>{selectedDevices.length}</strong> device{selectedDevices.length !== 1 ? 's' : ''} selected.
            Switch to the <strong>Settings</strong> tab to configure compliance checks, or <strong>Check</strong> tab to run compliance verification.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
