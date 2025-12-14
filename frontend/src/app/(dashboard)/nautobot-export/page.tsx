'use client'

import { useState, useMemo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Download } from 'lucide-react'
import type { DeviceInfo, LogicalCondition } from '@/components/shared/device-selector'
import { useApi } from '@/hooks/use-api'

// Tab Components
import { DeviceSelectionTab } from '@/components/nautobot-export/tabs/device-selection-tab'
import { PropertiesTab } from '@/components/nautobot-export/tabs/properties-tab'
import { ExportTab } from '@/components/nautobot-export/tabs/export-tab'

export default function NautobotExportPage() {
  const { apiCall } = useApi()
  // Device selection state
  const [previewDevices, setPreviewDevices] = useState<DeviceInfo[]>([])
  const [deviceConditions, setDeviceConditions] = useState<LogicalCondition[]>([])
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([])
  const [selectedDevices, setSelectedDevices] = useState<DeviceInfo[]>([])

  // Properties state
  const [selectedProperties, setSelectedProperties] = useState<string[]>([
    'name',
    'device_type',
    'asset_tag',
    'config_context',
    '_custom_field_data',
    'serial',
    'primary_ip4',
    'interfaces',
    'tags',
  ])

  // Export state
  const [exportFormat, setExportFormat] = useState<'yaml' | 'csv'>('yaml')
  const [csvDelimiter, setCsvDelimiter] = useState(',')
  const [csvQuoteChar, setCsvQuoteChar] = useState('"')
  const [csvIncludeHeaders, setCsvIncludeHeaders] = useState(true)

  const handleDevicesSelected = useMemo(
    () => (devices: DeviceInfo[], conditions: LogicalCondition[]) => {
      setPreviewDevices(devices)
      setDeviceConditions(conditions)
      const deviceIds = devices.map(d => d.id)
      setSelectedDeviceIds(deviceIds)
      setSelectedDevices(devices)
    },
    []
  )

  const handleSelectionChange = useMemo(
    () => (selectedIds: string[], devices: DeviceInfo[]) => {
      setSelectedDeviceIds(selectedIds)
      setSelectedDevices(devices)
    },
    []
  )

  const handleExport = async () => {
    if (selectedDevices.length === 0) {
      alert('Please select devices first using the Devices tab.')
      return
    }

    if (selectedProperties.length === 0) {
      alert('Please select at least one property to export.')
      return
    }

    try {
      // Prepare request body
      const requestBody = {
        device_ids: selectedDevices.map(d => d.id),
        properties: selectedProperties,
        export_format: exportFormat,
        csv_options: exportFormat === 'csv' ? {
          delimiter: csvDelimiter,
          quoteChar: csvQuoteChar,
          includeHeaders: csvIncludeHeaders.toString(),
        } : undefined,
      }

      // Call backend API to trigger export task using apiCall hook
      const data = await apiCall<{ task_id: string; job_id: string; status: string; message: string }>(
        'api/celery/tasks/export-devices',
        {
          method: 'POST',
          body: requestBody,
        }
      )

      // Show success message with task ID
      alert(`Export task started successfully!\n\nTask ID: ${data.task_id}\n\nYou can track the progress in Jobs / View. Once complete, you can download the file from there.`)

      // Optionally redirect to Jobs/View page
      // window.location.href = '/jobs/view'
    } catch (error) {
      console.error('Export error:', error)
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-purple-100 p-2 rounded-lg">
            <Download className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Nautobot Export</h1>
            <p className="text-gray-600 mt-1">Export selected Nautobot devices to CSV or YAML</p>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="devices" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        {/* Devices Tab */}
        <TabsContent value="devices" className="space-y-6">
          <DeviceSelectionTab
            previewDevices={previewDevices}
            deviceConditions={deviceConditions}
            selectedDeviceIds={selectedDeviceIds}
            selectedDevices={selectedDevices}
            onDevicesSelected={handleDevicesSelected}
            onSelectionChange={handleSelectionChange}
          />
        </TabsContent>

        {/* Properties Tab */}
        <TabsContent value="properties" className="space-y-6">
          <PropertiesTab
            selectedProperties={selectedProperties}
            onPropertiesChange={setSelectedProperties}
          />
        </TabsContent>

        {/* Export Tab */}
        <TabsContent value="export" className="space-y-6">
          <ExportTab
            selectedDevices={selectedDevices}
            selectedProperties={selectedProperties}
            exportFormat={exportFormat}
            onExportFormatChange={setExportFormat}
            csvDelimiter={csvDelimiter}
            onCsvDelimiterChange={setCsvDelimiter}
            csvQuoteChar={csvQuoteChar}
            onCsvQuoteCharChange={setCsvQuoteChar}
            csvIncludeHeaders={csvIncludeHeaders}
            onCsvIncludeHeadersChange={setCsvIncludeHeaders}
            onExport={handleExport}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
