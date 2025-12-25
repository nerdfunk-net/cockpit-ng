'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { InfoIcon, Save } from 'lucide-react'
import type { DeviceInfo } from '@/components/shared/device-selector'
import type { BulkEditProperties } from '../bulk-edit-page'
import { EditableDeviceTable } from '../components/editable-device-table'
import { ColumnSelector } from '../components/column-selector'

interface BulkEditTabProps {
  selectedDevices: DeviceInfo[]
  properties: BulkEditProperties
  modifiedDevices: Map<string, Partial<DeviceInfo>>
  onDeviceModified: (deviceId: string, changes: Partial<DeviceInfo>) => void
  onSaveDevices: () => void
}

export interface ColumnDefinition {
  id: string
  label: string
  field: string
  editable: boolean
  width?: string // Optional width (e.g., '200px', '15%', 'auto')
}

// Default columns shown in the table
const DEFAULT_COLUMNS: ColumnDefinition[] = [
  { id: 'name', label: 'Name', field: 'name', editable: true, width: '200px' },
  { id: 'status', label: 'Status', field: 'status', editable: true, width: '150px' },
  { id: 'serial', label: 'Serial', field: 'serial', editable: true, width: '150px' },
  { id: 'primary_ip4', label: 'Primary IPv4', field: 'primary_ip4', editable: true, width: '150px' },
]

export function BulkEditTab({
  selectedDevices,
  properties: _properties,
  modifiedDevices,
  onDeviceModified,
  onSaveDevices,
}: BulkEditTabProps) {
  const [visibleColumns, setVisibleColumns] = useState<ColumnDefinition[]>(DEFAULT_COLUMNS)
  const [availableColumns, setAvailableColumns] = useState<ColumnDefinition[]>([])
  const [isLoadingColumns, setIsLoadingColumns] = useState(false)

  const loadAvailableColumns = useCallback(async () => {
    setIsLoadingColumns(true)
    try {
      // TODO: Fetch device schema from Nautobot API
      // For now, use predefined columns
      const columns: ColumnDefinition[] = [
        { id: 'name', label: 'Name', field: 'name', editable: true, width: '200px' },
        { id: 'status', label: 'Status', field: 'status', editable: true, width: '150px' },
        { id: 'serial', label: 'Serial', field: 'serial', editable: true, width: '150px' },
        { id: 'primary_ip4', label: 'Primary IPv4', field: 'primary_ip4', editable: true, width: '150px' },
        { id: 'location', label: 'Location', field: 'location', editable: true, width: '250px' },
        { id: 'role', label: 'Role', field: 'role', editable: true, width: '150px' },
        { id: 'device_type', label: 'Device Type', field: 'device_type', editable: false, width: '150px' },
        { id: 'manufacturer', label: 'Manufacturer', field: 'manufacturer', editable: false, width: '150px' },
        { id: 'platform', label: 'Platform', field: 'platform', editable: false, width: '150px' },
        { id: 'tags', label: 'Tags', field: 'tags', editable: true, width: '200px' },
      ]
      setAvailableColumns(columns)
    } catch (error) {
      console.error('Failed to load available columns:', error)
    } finally {
      setIsLoadingColumns(false)
    }
  }, [])

  // Load available columns from Nautobot on mount
  useEffect(() => {
    loadAvailableColumns()
  }, [loadAvailableColumns])

  const handleAddColumn = useCallback((columnId: string) => {
    const column = availableColumns.find(c => c.id === columnId)
    if (column && !visibleColumns.find(c => c.id === columnId)) {
      setVisibleColumns(prev => [...prev, column])
    }
  }, [availableColumns, visibleColumns])

  const handleRemoveColumn = useCallback((columnId: string) => {
    setVisibleColumns(prev => prev.filter(c => c.id !== columnId))
  }, [])

  const modifiedCount = useMemo(() => modifiedDevices.size, [modifiedDevices])

  if (selectedDevices.length === 0) {
    return (
      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertDescription>
          No devices selected. Please go to the Devices tab and select devices to edit.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Bulk Edit Devices</CardTitle>
              <CardDescription>
                Edit multiple devices at once. Modified rows are highlighted in red.
              </CardDescription>
            </div>
            <ColumnSelector
              availableColumns={availableColumns}
              visibleColumns={visibleColumns}
              onAddColumn={handleAddColumn}
              onRemoveColumn={handleRemoveColumn}
              isLoading={isLoadingColumns}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Device count and modified count */}
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              Showing <strong>{selectedDevices.length}</strong> device{selectedDevices.length !== 1 ? 's' : ''}
            </div>
            {modifiedCount > 0 && (
              <div className="text-red-600 font-medium">
                {modifiedCount} device{modifiedCount !== 1 ? 's' : ''} modified
              </div>
            )}
          </div>

          {/* Editable Table */}
          <EditableDeviceTable
            devices={selectedDevices}
            columns={visibleColumns}
            modifiedDevices={modifiedDevices}
            onDeviceModified={onDeviceModified}
          />

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={onSaveDevices}
              disabled={modifiedCount === 0}
              size="lg"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Devices
              {modifiedCount > 0 && ` (${modifiedCount})`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
