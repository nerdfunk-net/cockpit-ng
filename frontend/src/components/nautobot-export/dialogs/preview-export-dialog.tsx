/**
 * Dialog for previewing export data before downloading
 */

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Eye, Copy, Check, Loader2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import type { DeviceInfo } from '@/components/shared/device-selector'
import { useApi } from '@/hooks/use-api'

interface PreviewExportDialogProps {
  show: boolean
  onClose: () => void
  devices: DeviceInfo[]
  properties: string[]
  format: 'yaml' | 'csv'
  csvOptions?: {
    delimiter: string
    quoteChar: string
    includeHeaders: boolean
  }
}

export function PreviewExportDialog({
  show,
  onClose,
  devices,
  properties,
  format,
  csvOptions,
}: PreviewExportDialogProps) {
  const { apiCall } = useApi()
  const [copied, setCopied] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [previewDevices, setPreviewDevices] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  // Fetch full device data when dialog opens
  useEffect(() => {
    if (show && devices.length > 0) {
      fetchPreviewData()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, devices, properties])

  const fetchPreviewData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const deviceIds = devices.map(d => d.id)
      const response = await apiCall<{
        success: boolean
        preview_content: string
        total_devices: number
        previewed_devices: number
        message?: string
      }>('api/celery/preview-export-devices', {
        method: 'POST',
        body: JSON.stringify({
          device_ids: deviceIds,
          properties: properties,
          max_devices: 5,
          export_format: format,
          csv_options: csvOptions ? {
            ...csvOptions,
            includeHeaders: csvOptions.includeHeaders?.toString() ?? 'true',
          } : undefined,
        }),
      })

      if (response.success) {
        setPreviewDevices([{ preview_content: response.preview_content }])
      } else {
        setError(response.message || 'Failed to fetch preview data')
      }
    } catch (err) {
      console.error('Error fetching preview data:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch preview data')
    } finally {
      setIsLoading(false)
    }
  }

  const generatePreview = (): string => {
    // Return the backend-generated preview content
    if (previewDevices.length > 0 && previewDevices[0].preview_content) {
      return previewDevices[0].preview_content
    }
    return ''
  }

  const generateYAMLPreview = (): string => {
    const yamlLines: string[] = ['devices:']

    // Use fetched preview devices (already limited to 5)
    previewDevices.forEach((device) => {
      yamlLines.push(`  - name: "${device.name || 'unknown'}"`)

      properties.forEach((prop) => {
        let value = device[prop]

        // Format the value appropriately for YAML
        if (value === null || value === undefined) {
          value = 'null'
        } else if (typeof value === 'object') {
          value = JSON.stringify(value)
        } else if (typeof value === 'string') {
          value = `"${value.replace(/"/g, '\\"')}"`
        }

        yamlLines.push(`    ${prop}: ${value}`)
      })
    })

    if (devices.length > 5) {
      yamlLines.push(`  # ... and ${devices.length - 5} more device(s)`)
    }

    return yamlLines.join('\n')
  }

  const generateCSVPreview = (): string => {
    const delimiter = csvOptions?.delimiter || ';'  // Default to semicolon for import compatibility
    const quoteChar = csvOptions?.quoteChar || '"'
    const includeHeaders = csvOptions?.includeHeaders ?? true

    // Build flattened rows (one per interface) - import-compatible format
    const flattenedRows: any[] = []

    previewDevices.forEach((device) => {
      // Extract device-level fields
      const deviceFields = extractDeviceFields(device)

      // Get interfaces
      const interfaces = device.interfaces || []

      if (interfaces && interfaces.length > 0) {
        // One row per interface
        interfaces.forEach((iface: any) => {
          const row = { ...deviceFields, ...extractInterfaceFields(iface, device) }
          flattenedRows.push(row)
        })
      } else {
        // No interfaces - single row with device data only
        flattenedRows.push(deviceFields)
      }
    })

    if (flattenedRows.length === 0) {
      return 'No data to preview'
    }

    // Determine all unique column names
    const allColumns = new Set<string>()
    flattenedRows.forEach(row => {
      Object.keys(row).forEach(key => allColumns.add(key))
    })

    // Order columns: device fields first, then interface fields, then custom fields
    const deviceCols = ['name', 'device_type', 'ip_address', 'serial', 'asset_tag', 'role', 'status', 'location', 'platform', 'namespace', 'software_version', 'tags']
    const interfaceCols = Array.from(allColumns).filter(col => col.startsWith('interface_')).sort()
    const customCols = Array.from(allColumns).filter(col => col.startsWith('cf_')).sort()
    const otherCols = Array.from(allColumns).filter(col =>
      !deviceCols.includes(col) && !col.startsWith('interface_') && !col.startsWith('cf_')
    ).sort()

    const orderedColumns: string[] = []
    deviceCols.forEach(col => {
      if (allColumns.has(col)) orderedColumns.push(col)
    })
    orderedColumns.push(...interfaceCols, ...customCols, ...otherCols)

    const csvLines: string[] = []

    // Add headers if enabled
    if (includeHeaders) {
      const headers = orderedColumns.map(col => `${quoteChar}${col}${quoteChar}`)
      csvLines.push(headers.join(delimiter))
    }

    // Add data rows
    flattenedRows.forEach((row) => {
      const values = orderedColumns.map((col) => {
        const value = row[col] || ''
        const strValue = String(value)

        // Quote the value
        if (strValue.includes(delimiter) || strValue.includes(quoteChar) || strValue.includes('\n')) {
          return `${quoteChar}${strValue.replace(new RegExp(quoteChar, 'g'), quoteChar + quoteChar)}${quoteChar}`
        }
        return `${quoteChar}${strValue}${quoteChar}`
      })
      csvLines.push(values.join(delimiter))
    })

    if (devices.length > 5) {
      csvLines.push(`# ... and ${devices.length - 5} more device(s)`)
    }

    return csvLines.join('\n')
  }

  const extractDeviceFields = (device: any): Record<string, string> => {
    const fields: Record<string, string> = {}

    if (device.name) fields.name = String(device.name)
    if (device.serial) fields.serial = String(device.serial)
    if (device.asset_tag) fields.asset_tag = String(device.asset_tag)
    if (device.software_version) fields.software_version = String(device.software_version)

    // Nested objects - extract name only
    if (device.role) fields.role = typeof device.role === 'object' ? device.role.name : String(device.role)
    if (device.status) fields.status = typeof device.status === 'object' ? device.status.name : String(device.status)
    if (device.location) fields.location = typeof device.location === 'object' ? device.location.name : String(device.location)
    if (device.device_type) fields.device_type = typeof device.device_type === 'object' ? (device.device_type.model || device.device_type.name) : String(device.device_type)
    if (device.platform) fields.platform = typeof device.platform === 'object' ? device.platform.name : String(device.platform)

    // Tags - comma-separated
    if (device.tags && Array.isArray(device.tags)) {
      const tagNames = device.tags.map((tag: any) => typeof tag === 'object' ? tag.name : String(tag))
      if (tagNames.length > 0) fields.tags = tagNames.join(',')
    }

    // Primary IPv4 address - extract from primary_ip4 object
    if (device.primary_ip4 && typeof device.primary_ip4 === 'object') {
      const primaryAddr = device.primary_ip4.address
      if (primaryAddr) fields.ip_address = String(primaryAddr)

      // Extract namespace from primary IP's parent prefix
      if (device.primary_ip4.parent && typeof device.primary_ip4.parent === 'object') {
        const parent = device.primary_ip4.parent
        if (parent.namespace && typeof parent.namespace === 'object') {
          const namespaceName = parent.namespace.name
          if (namespaceName) fields.namespace = String(namespaceName)
        }
      }
    }

    // Custom fields - prefix with cf_
    if (device._custom_field_data && typeof device._custom_field_data === 'object') {
      Object.entries(device._custom_field_data).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          fields[`cf_${key}`] = String(value)
        }
      })
    }

    return fields
  }

  const extractInterfaceFields = (iface: any, device: any): Record<string, string> => {
    const fields: Record<string, string> = {}

    if (iface.name) fields.interface_name = String(iface.name)
    if (iface.type) fields.interface_type = String(iface.type)
    if (iface.status) fields.interface_status = typeof iface.status === 'object' ? iface.status.name : String(iface.status)
    if (iface.description) fields.interface_description = String(iface.description)
    if (iface.mac_address) fields.interface_mac_address = String(iface.mac_address)
    if (iface.mtu) fields.interface_mtu = String(iface.mtu)
    if (iface.mode) fields.interface_mode = String(iface.mode)
    if (iface.enabled !== undefined) fields.interface_enabled = String(iface.enabled).toLowerCase()

    // IP addresses - first one
    if (iface.ip_addresses && Array.isArray(iface.ip_addresses) && iface.ip_addresses.length > 0) {
      const firstIp = iface.ip_addresses[0]
      if (firstIp.address) {
        fields.interface_ip_address = String(firstIp.address)

        // Check if primary
        if (device.primary_ip4 && typeof device.primary_ip4 === 'object') {
          const primaryAddr = device.primary_ip4.address
          fields.set_primary_ipv4 = primaryAddr === firstIp.address ? 'true' : 'false'
        }
      }
    }

    // Parent interface
    if (iface.parent_interface) {
      fields.interface_parent_interface = typeof iface.parent_interface === 'object' ? iface.parent_interface.name : String(iface.parent_interface)
    }

    // LAG
    if (iface.lag) {
      fields.interface_lag = typeof iface.lag === 'object' ? iface.lag.name : String(iface.lag)
    }

    // VLANs
    if (iface.untagged_vlan) {
      fields.interface_untagged_vlan = typeof iface.untagged_vlan === 'object' ? iface.untagged_vlan.name : String(iface.untagged_vlan)
    }

    if (iface.tagged_vlans && Array.isArray(iface.tagged_vlans)) {
      const vlanNames = iface.tagged_vlans.map((vlan: any) => typeof vlan === 'object' ? vlan.name : String(vlan))
      if (vlanNames.length > 0) fields.interface_tagged_vlans = vlanNames.join(',')
    }

    // Interface tags
    if (iface.tags && Array.isArray(iface.tags)) {
      const tagNames = iface.tags.map((tag: any) => typeof tag === 'object' ? tag.name : String(tag))
      if (tagNames.length > 0) fields.interface_tags = tagNames.join(',')
    }

    return fields
  }

  const handleCopy = () => {
    const preview = generatePreview()
    navigator.clipboard.writeText(preview)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const preview = isLoading || error ? '' : generatePreview()
  const lineCount = preview.split('\n').length
  const charCount = preview.length

  return (
    <Dialog open={show} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-green-600" />
            Export Preview
          </DialogTitle>
          <DialogDescription>
            Preview of the first 5 devices in {format.toUpperCase()} format.
            Full device data will be fetched from Nautobot during actual export.
          </DialogDescription>
        </DialogHeader>

        {/* Loading/Error States */}
        {isLoading && (
          <div className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-green-600" />
            <p className="text-sm text-gray-600">Fetching full device data from Nautobot...</p>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded">
            <p className="text-sm text-red-800">
              <strong>Error:</strong> {error}
            </p>
          </div>
        )}

        {!isLoading && !error && previewDevices.length > 0 && (
          <>
            {/* Success Notice */}
            <div className="p-3 bg-green-50 border-l-4 border-green-500 rounded">
              <p className="text-sm text-green-800">
                <strong>✓ Real Data Preview:</strong> Showing complete device data fetched directly from Nautobot using the same GraphQL query as the export.
                All properties including <code className="bg-green-100 px-1 py-0.5 rounded text-xs">serial</code>, <code className="bg-green-100 px-1 py-0.5 rounded text-xs">asset_tag</code>, <code className="bg-green-100 px-1 py-0.5 rounded text-xs">_custom_field_data</code>, etc. are shown with actual values.
              </p>
            </div>
          </>
        )}

        {!isLoading && !error && previewDevices.length > 0 && (
          <>
            {/* Preview Stats */}
            <div className="flex items-center gap-4 p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-white border-green-300 text-green-700">
              {devices.length} device{devices.length !== 1 ? 's' : ''}
            </Badge>
            <Badge variant="outline" className="bg-white border-green-300 text-green-700">
              {properties.length} propert{properties.length !== 1 ? 'ies' : 'y'}
            </Badge>
            <Badge variant="outline" className="bg-white border-green-300 text-green-700">
              {format.toUpperCase()}
            </Badge>
          </div>
          <div className="ml-auto text-xs text-green-700">
            {lineCount} lines · {charCount.toLocaleString()} characters
          </div>
        </div>

        {/* Format-specific info */}
        {format === 'csv' && csvOptions && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-medium text-blue-800 mb-2">CSV Options:</p>
            <div className="grid grid-cols-3 gap-4 text-xs text-blue-700">
              <div>
                <span className="font-medium">Delimiter:</span>{' '}
                <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200">
                  {csvOptions.delimiter || '(empty)'}
                </code>
              </div>
              <div>
                <span className="font-medium">Quote:</span>{' '}
                <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200">
                  {csvOptions.quoteChar || '(empty)'}
                </code>
              </div>
              <div>
                <span className="font-medium">Headers:</span>{' '}
                <Badge variant={csvOptions.includeHeaders ? 'default' : 'secondary'} className="text-xs">
                  {csvOptions.includeHeaders ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Preview Content */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-800 text-gray-100 px-4 py-2 flex items-center justify-between">
            <span className="text-sm font-medium">Preview (First 5 devices)</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="text-gray-100 hover:bg-gray-700 hover:text-white"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <div className="bg-gray-900 p-4 overflow-auto max-h-[400px]">
            <pre className="text-sm font-mono text-gray-100 whitespace-pre">
              {preview}
            </pre>
          </div>
        </div>

            {devices.length > 5 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> This preview shows only the first 5 devices.
                  The full export will contain all <strong>{devices.length}</strong> selected devices.
                </p>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
