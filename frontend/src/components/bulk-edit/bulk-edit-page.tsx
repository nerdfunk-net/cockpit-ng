'use client'

import { useState, useCallback, useMemo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Edit } from 'lucide-react'
import type { DeviceInfo, LogicalCondition } from '@/components/shared/device-selector'

// Tab Components
import { DeviceSelectionTab } from './tabs/device-selection-tab'
import { PropertiesTab } from './tabs/properties-tab'
import { BulkEditTab } from './tabs/bulk-edit-tab'

// Types
export interface InterfaceConfig {
  name: string
  type: string
  status: string
}

export interface BulkEditProperties {
  interfaceConfig: InterfaceConfig
}

const EMPTY_DEVICES: DeviceInfo[] = []
const EMPTY_CONDITIONS: LogicalCondition[] = []
const EMPTY_DEVICE_IDS: string[] = []
const EMPTY_MAP: Map<string, Partial<DeviceInfo>> = new Map()

const DEFAULT_INTERFACE_CONFIG: InterfaceConfig = {
  name: '',
  type: '1000base-t',
  status: 'active',
}

const DEFAULT_PROPERTIES: BulkEditProperties = {
  interfaceConfig: DEFAULT_INTERFACE_CONFIG,
}

export default function BulkEditPage() {
  // Device selection state
  const [previewDevices, setPreviewDevices] = useState<DeviceInfo[]>(EMPTY_DEVICES)
  const [deviceConditions, setDeviceConditions] = useState<LogicalCondition[]>(EMPTY_CONDITIONS)
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>(EMPTY_DEVICE_IDS)
  const [selectedDevices, setSelectedDevices] = useState<DeviceInfo[]>(EMPTY_DEVICES)

  // Properties state
  const [properties, setProperties] = useState<BulkEditProperties>(DEFAULT_PROPERTIES)

  // Bulk edit state
  const [modifiedDevices, setModifiedDevices] = useState<Map<string, Partial<DeviceInfo>>>(EMPTY_MAP)

  const handleDevicesSelected = useCallback((devices: DeviceInfo[], conditions: LogicalCondition[]) => {
    setPreviewDevices(devices)
    setDeviceConditions(conditions)
    const deviceIds = devices.map(d => d.id)
    setSelectedDeviceIds(deviceIds)
    setSelectedDevices(devices)
  }, [])

  const handleSelectionChange = useCallback((selectedIds: string[], devices: DeviceInfo[]) => {
    setSelectedDeviceIds(selectedIds)
    setSelectedDevices(devices)
  }, [])

  const handlePropertiesChange = useCallback((newProperties: BulkEditProperties) => {
    setProperties(newProperties)
  }, [])

  const handleDeviceModified = useCallback((deviceId: string, changes: Partial<DeviceInfo>) => {
    setModifiedDevices(prev => {
      const next = new Map(prev)
      next.set(deviceId, changes)
      return next
    })
  }, [])

  const handleSaveDevices = useCallback(() => {
    // TODO: Implement save functionality
    // eslint-disable-next-line no-console
    console.log('Saving devices:', modifiedDevices)
  }, [modifiedDevices])

  const stableState = useMemo(() => ({
    previewDevices,
    deviceConditions,
    selectedDeviceIds,
    selectedDevices,
    properties,
    modifiedDevices,
  }), [previewDevices, deviceConditions, selectedDeviceIds, selectedDevices, properties, modifiedDevices])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-purple-100 p-2 rounded-lg">
            <Edit className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Bulk Edit Devices</h1>
            <p className="text-gray-600 mt-1">Edit multiple device properties efficiently</p>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="devices" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="bulk-edit">Bulk Edit</TabsTrigger>
        </TabsList>

        {/* Devices Tab */}
        <TabsContent value="devices" className="space-y-6">
          <DeviceSelectionTab
            previewDevices={stableState.previewDevices}
            deviceConditions={stableState.deviceConditions}
            selectedDeviceIds={stableState.selectedDeviceIds}
            selectedDevices={stableState.selectedDevices}
            onDevicesSelected={handleDevicesSelected}
            onSelectionChange={handleSelectionChange}
          />
        </TabsContent>

        {/* Properties Tab */}
        <TabsContent value="properties" className="space-y-6">
          <PropertiesTab
            properties={stableState.properties}
            onPropertiesChange={handlePropertiesChange}
          />
        </TabsContent>

        {/* Bulk Edit Tab */}
        <TabsContent value="bulk-edit" className="space-y-6">
          <BulkEditTab
            selectedDevices={stableState.selectedDevices}
            properties={stableState.properties}
            modifiedDevices={stableState.modifiedDevices}
            onDeviceModified={handleDeviceModified}
            onSaveDevices={handleSaveDevices}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
