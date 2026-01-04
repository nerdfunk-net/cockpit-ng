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

  // Template and commands state
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
  const [commands, setCommands] = useState<Omit<SnapshotCommand, 'id' | 'template_id' | 'created_at'>[]>(EMPTY_COMMANDS)

  // Active tab state
  const [activeTab, setActiveTab] = useState('devices')

  const handleDevicesSelected = (devices: DeviceInfo[], conditions: LogicalCondition[]) => {
    const deviceIds = devices.map(d => d.id)
    setSelectedDeviceIds(deviceIds)
    setSelectedDevices(devices)
  }

  const handleSelectionChange = (selectedIds: string[], devices: DeviceInfo[]) => {
    setSelectedDeviceIds(selectedIds)
    setSelectedDevices(devices)
  }

  const handleTemplateSelected = (templateId: number | null) => {
    setSelectedTemplateId(templateId)
  }

  const handleCommandsChanged = (
    newCommands: Omit<SnapshotCommand, 'id' | 'template_id' | 'created_at'>[]
  ) => {
    setCommands(newCommands)
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Camera className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Network Snapshots</h1>
          <p className="text-muted-foreground">
            Capture and compare device snapshots with TextFSM parsing
          </p>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
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
            {commands.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">
                {commands.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="snapshots">Snapshots</TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="mt-6">
          <DevicesTab
            selectedDeviceIds={selectedDeviceIds}
            selectedDevices={selectedDevices}
            onDevicesSelected={handleDevicesSelected}
            onSelectionChange={handleSelectionChange}
          />
        </TabsContent>

        <TabsContent value="commands" className="mt-6">
          <CommandsTab
            selectedTemplateId={selectedTemplateId}
            commands={commands}
            onTemplateSelected={handleTemplateSelected}
            onCommandsChanged={handleCommandsChanged}
          />
        </TabsContent>

        <TabsContent value="snapshots" className="mt-6">
          <SnapshotsTab
            selectedTemplateId={selectedTemplateId}
            commands={commands}
            selectedDevices={selectedDevices}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
