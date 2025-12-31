/**
 * Bulk Edit Device Selection Tab
 * Uses the unified DeviceSelectionTab component from shared/
 */

import { DeviceSelectionTab as UnifiedDeviceSelectionTab } from '@/components/shared/device-selection-tab'
import type { DeviceInfo, LogicalCondition } from '@/components/shared/device-selector'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface DeviceSelectionTabProps {
  selectedDeviceIds: string[]
  selectedDevices: DeviceInfo[]
  onDevicesSelected: (devices: DeviceInfo[], conditions: LogicalCondition[]) => void
  onSelectionChange: (selectedIds: string[], devices: DeviceInfo[]) => void
  onOpenCSVUpload?: () => void
}

export function DeviceSelectionTab({ onOpenCSVUpload, ...props }: DeviceSelectionTabProps) {
  return (
    <div className="space-y-6">
      <UnifiedDeviceSelectionTab
        {...props}
        nextStepMessage="Switch to the Properties tab to configure default settings, or Bulk Edit tab to modify devices."
        alertStyle="success"
      />

      {/* CSV Upload Option */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            CSV Bulk Update
          </CardTitle>
          <CardDescription>
            Upload a CSV file to update multiple devices at once
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              You can also upload a CSV file with device data to perform bulk updates.
              The CSV must include an identifier column (id, name, or ip_address) and the fields you want to update.
            </AlertDescription>
          </Alert>
          <Button
            onClick={onOpenCSVUpload}
            variant="outline"
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload and Update
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
