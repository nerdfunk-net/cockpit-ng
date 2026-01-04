/**
 * Network Snapshots Page
 * Main component for snapshot management
 */

'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Camera } from 'lucide-react'
import type { DeviceInfo, LogicalCondition } from '@/components/shared/device-selector'
import type { SnapshotCommand } from './types/snapshot-types'

// Tab Components
import { DevicesTab } from './tabs/devices-tab'
import { CommandsTab } from './tabs/commands-tab'
import { SnapshotsTab } from './tabs/snapshots-tab'

const EMPTY_DEVICES: DeviceInfo[] = []
const EMPTY_DEVICE_IDS: string[] = []
const EMPTY_COMMANDS: Omit<SnapshotCommand, 'id' | 'template_id' | 'created_at'>[] = []

export default function SnapshotsPage() {
  // Device selection state
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>(EMPTY_DEVICE_IDS)
  const [selectedDevices, setSelectedDevices] = useState<DeviceInfo[]>(EMPTY_DEVICES)

  const handleDevicesSelected = (devices: DeviceInfo[], _conditions: LogicalCondition[]) => {
    const deviceIds = devices.map(d => d.id)
    setSelectedDeviceIds(deviceIds)
    setSelectedDevices(devices)
  }

  const handleSelectionChange = (selectedIds: string[], devices: DeviceInfo[]) => {
    setSelectedDeviceIds(selectedIds)
    setSelectedDevices(devices)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Camera className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Network Snapshots</h1>
            <p className="text-gray-600 mt-1">Capture and compare device state snapshots</p>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="devices" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="devices">
            Devices
            {selectedDevices.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">
                {selectedDevices.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="commands">
            Commands
          </TabsTrigger>
          <TabsTrigger value="snapshots">Snapshots</TabsTrigger>
        </TabsList>

        {/* Devices Tab */}
        <TabsContent value="devices">
          <DevicesTab
            selectedDeviceIds={selectedDeviceIds}
            selectedDevices={selectedDevices}
            onDevicesSelected={handleDevicesSelected}
            onSelectionChange={handleSelectionChange}
          />
        </TabsContent>

        {/* Commands Tab */}
        <TabsContent value="commands">
          <CommandsTab />
        </TabsContent>

        {/* Snapshots Tab */}
        <TabsContent value="snapshots">
          <SnapshotsTab
            selectedTemplateId={null}
            commands={EMPTY_COMMANDS}
            selectedDevices={selectedDevices}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
