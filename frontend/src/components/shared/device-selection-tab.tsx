/**
 * Unified Device Selection Tab Component
 *
 * This component consolidates the 3 previously identical device selection tab implementations
 * from netmiko, compliance, and nautobot-export.
 *
 * Usage:
 *   <DeviceSelectionTab
 *     title="Select Devices"
 *     description="Use logical operations to filter devices"
 *     nextStepMessage="Switch to the Settings tab to configure..."
 *     showCard={true}
 *     alertStyle="success"
 *     {...deviceProps}
 *   />
 */

'use client'

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2 } from 'lucide-react'
import { DeviceSelector, type DeviceInfo, type LogicalCondition } from './device-selector'

interface DeviceSelectionTabProps {
  // Required device selector props
  selectedDeviceIds: string[]
  selectedDevices: DeviceInfo[]
  onDevicesSelected: (devices: DeviceInfo[], conditions: LogicalCondition[]) => void
  onSelectionChange: (selectedIds: string[], devices: DeviceInfo[]) => void

  // Optional customization props
  title?: string
  description?: string
  nextStepMessage?: string
  showCard?: boolean
  alertStyle?: 'default' | 'success' | 'info'
  onInventoryLoaded?: (inventoryId: number) => void
}

const EMPTY_DEVICES: DeviceInfo[] = []
const EMPTY_DEVICE_IDS: string[] = []

export function DeviceSelectionTab({
  selectedDeviceIds = EMPTY_DEVICE_IDS,
  selectedDevices = EMPTY_DEVICES,
  onDevicesSelected,
  onSelectionChange,
  title = 'Select Devices',
  description = 'Use logical operations to filter and select devices',
  nextStepMessage,
  showCard = false,
  alertStyle = 'default',
  onInventoryLoaded,
}: DeviceSelectionTabProps) {
  // Determine alert CSS classes based on style
  const alertClasses = alertStyle === 'success'
    ? 'bg-green-50 border-green-200'
    : alertStyle === 'info'
    ? 'bg-blue-50 border-blue-200'
    : ''

  const alertTextClasses = alertStyle === 'success'
    ? 'text-green-800'
    : alertStyle === 'info'
    ? 'text-blue-800'
    : ''

  const iconClasses = alertStyle === 'success'
    ? 'text-green-600'
    : alertStyle === 'info'
    ? 'text-blue-600'
    : ''

  return (
    <div className="space-y-6">
      {showCard && (
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
        </Card>
      )}

      <DeviceSelector
        onDevicesSelected={onDevicesSelected}
        showActions={true}
        showSaveLoad={true}
        enableSelection={true}
        selectedDeviceIds={selectedDeviceIds}
        onSelectionChange={onSelectionChange}
        onInventoryLoaded={onInventoryLoaded}
      />

      {selectedDevices.length > 0 && nextStepMessage && (
        <Alert className={alertClasses}>
          <CheckCircle2 className={`h-4 w-4 ${iconClasses}`} />
          <AlertDescription className={alertTextClasses}>
            <strong>{selectedDevices.length}</strong> device{selectedDevices.length !== 1 ? 's' : ''} selected.
            {' '}{nextStepMessage}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
