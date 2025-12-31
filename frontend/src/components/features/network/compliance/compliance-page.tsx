'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CheckCircle } from 'lucide-react'
import type { DeviceInfo, LogicalCondition } from '@/components/shared/device-selector'

// Tab Components
import { DeviceSelectionTab } from './tabs/device-selection-tab'
import { SettingsTab } from './tabs/settings-tab'
import { CheckTab } from './tabs/check-tab'

// Hooks
import { useComplianceSettings } from './hooks/use-compliance-settings'

export default function CompliancePage() {
  // Device selection state
  const [previewDevices, setPreviewDevices] = useState<DeviceInfo[]>([])
  const [deviceConditions, setDeviceConditions] = useState<LogicalCondition[]>([])
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([])
  const [selectedDevices, setSelectedDevices] = useState<DeviceInfo[]>([])

  // Compliance settings hook
  const complianceSettings = useComplianceSettings()

  const handleDevicesSelected = (devices: DeviceInfo[], conditions: LogicalCondition[]) => {
    setPreviewDevices(devices)
    setDeviceConditions(conditions)
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
        <div className="flex items-center gap-4">
          <div className="bg-green-100 p-2 rounded-lg">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Compliance Check</h1>
            <p className="text-gray-600">Verify network device compliance with your security policies</p>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="devices" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="check">Check</TabsTrigger>
        </TabsList>

        {/* Devices Tab */}
        <TabsContent value="devices" className="space-y-6">
          <DeviceSelectionTab
            selectedDeviceIds={selectedDeviceIds}
            selectedDevices={selectedDevices}
            onDevicesSelected={handleDevicesSelected}
            onSelectionChange={handleSelectionChange}
          />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <SettingsTab
            checkSshLogins={complianceSettings.checkSshLogins}
            setCheckSshLogins={complianceSettings.setCheckSshLogins}
            checkSnmpCredentials={complianceSettings.checkSnmpCredentials}
            setCheckSnmpCredentials={complianceSettings.setCheckSnmpCredentials}
            checkConfiguration={complianceSettings.checkConfiguration}
            setCheckConfiguration={complianceSettings.setCheckConfiguration}
            selectedLoginIds={complianceSettings.selectedLoginIds}
            setSelectedLoginIds={complianceSettings.setSelectedLoginIds}
            selectedSnmpIds={complianceSettings.selectedSnmpIds}
            setSelectedSnmpIds={complianceSettings.setSelectedSnmpIds}
            selectedRegexIds={complianceSettings.selectedRegexIds}
            setSelectedRegexIds={complianceSettings.setSelectedRegexIds}
            loginCredentials={complianceSettings.loginCredentials}
            snmpMappings={complianceSettings.snmpMappings}
            regexPatterns={complianceSettings.regexPatterns}
            isLoading={complianceSettings.isLoading}
            loadSettings={complianceSettings.loadSettings}
          />
        </TabsContent>

        {/* Check Tab */}
        <TabsContent value="check" className="space-y-6">
          <CheckTab
            selectedDevices={selectedDevices}
            checkSshLogins={complianceSettings.checkSshLogins}
            checkSnmpCredentials={complianceSettings.checkSnmpCredentials}
            checkConfiguration={complianceSettings.checkConfiguration}
            selectedLoginIds={complianceSettings.selectedLoginIds}
            selectedSnmpIds={complianceSettings.selectedSnmpIds}
            selectedRegexIds={complianceSettings.selectedRegexIds}
            loginCredentials={complianceSettings.loginCredentials}
            snmpMappings={complianceSettings.snmpMappings}
            regexPatterns={complianceSettings.regexPatterns}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
