'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  ParsedDevice,
  CSVInterfaceData,
  CSVParseResult,
  DeviceValidationError,
  DeviceImportResult,
  ImportSummary,
  DEFAULT_COLUMN_MAPPINGS,
  UNIQUE_DEVICE_FIELDS,
} from '../types'

interface NautobotDefaults {
  location: string
  platform: string
  interface_status: string
  device_status: string
  ip_address_status: string
  namespace: string
  device_role: string
  secret_group: string
  csv_delimiter: string
}

interface UseCSVUploadProps {
  nautobotDefaults: NautobotDefaults | null
  onImportDevice: (device: ParsedDevice) => Promise<DeviceImportResult>
}

export function useCSVUpload({ nautobotDefaults, onImportDevice }: UseCSVUploadProps) {
  const [showModal, setShowModal] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [parseResult, setParseResult] = useState<CSVParseResult | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string>('')
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 })
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({})
  const [showMappingConfig, setShowMappingConfig] = useState(false)

  // Get delimiter from defaults or use comma
  const delimiter = nautobotDefaults?.csv_delimiter || ','

  // Parse CSV file
  const parseCSV = useCallback((file: File) => {
    setCsvFile(file)
    setIsParsing(true)
    setParseError('')
    setParseResult(null)
    setImportSummary(null)

    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        if (!text || text.trim() === '') {
          setParseError('CSV file is empty')
          setIsParsing(false)
          return
        }

        const lines = text.split('\n').filter(line => line.trim())
        if (lines.length === 0) {
          setParseError('CSV file has no content')
          setIsParsing(false)
          return
        }

        // Parse headers (first line)
        const headerLine = lines[0]
        if (!headerLine) {
          setParseError('CSV file has no headers')
          setIsParsing(false)
          return
        }

        // Remove BOM and other invisible characters, then split and normalize
        const cleanHeaderLine = headerLine.replace(/^\uFEFF/, '').replace(/\r/g, '')
        const headers = cleanHeaderLine.split(delimiter).map(h => h.trim().toLowerCase().replace(/['"]/g, ''))

        // DEBUG: Log parsed headers
        console.log('=== CSV PARSING DEBUG ===')
        console.log('Delimiter:', JSON.stringify(delimiter))
        console.log('Raw header line:', JSON.stringify(headerLine))
        console.log('Clean header line:', JSON.stringify(cleanHeaderLine))
        console.log('Parsed headers:', headers)
        console.log('Headers with char codes:', headers.map(h => ({
          header: h,
          length: h.length,
          charCodes: Array.from(h).map(c => c.charCodeAt(0))
        })))

        // Initialize column mappings based on headers
        const initialMappings: Record<string, string> = {}
        headers.forEach(header => {
          const mapping = DEFAULT_COLUMN_MAPPINGS[header]
          if (mapping) {
            initialMappings[header] = mapping
          } else if (header.startsWith('cf_')) {
            // Custom field mapping (cf_fieldname -> cf_fieldname)
            initialMappings[header] = header
          }
        })
        setColumnMappings(initialMappings)

        // Check for device name column
        const nameColumn = headers.find(h =>
          h === 'name' || h === 'device_name' || h === 'hostname'
        )

        // DEBUG: Log name column search
        console.log('Looking for name column...')
        console.log('Found nameColumn:', nameColumn)
        console.log('Exact matches:', {
          name: headers.includes('name'),
          device_name: headers.includes('device_name'),
          hostname: headers.includes('hostname')
        })

        if (!nameColumn) {
          setParseError(`CSV must have a "name", "device_name", or "hostname" column. Found columns: [${headers.join(', ')}]`)
          setIsParsing(false)
          return
        }

        // Parse data rows and group by device name
        const deviceMap = new Map<string, {
          device: Partial<ParsedDevice>
          interfaces: CSVInterfaceData[]
          rowIndices: number[]
        }>()

        const validationErrors: DeviceValidationError[] = []

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i]
          if (!line || !line.trim()) continue

          const values = parseCSVLine(line, delimiter)
          if (values.length !== headers.length) {
            validationErrors.push({
              deviceName: `Row ${i + 1}`,
              field: 'columns',
              message: `Expected ${headers.length} columns, got ${values.length}`,
              severity: 'warning'
            })
            continue
          }

          // Create row object from headers and values
          const row: Record<string, string> = {}
          headers.forEach((header, index) => {
            row[header] = values[index]?.trim() || ''
          })

          // Get device name
          const deviceName = row[nameColumn]
          if (!deviceName) {
            validationErrors.push({
              deviceName: `Row ${i + 1}`,
              field: 'name',
              message: 'Device name is empty',
              severity: 'error'
            })
            continue
          }

          // Extract device fields, interface fields, tags, and custom fields
          const deviceFields: Partial<ParsedDevice> = { name: deviceName }
          const interfaceFields: Partial<CSVInterfaceData> = {}
          const customFields: Record<string, string> = {}
          let tags: string[] = []

          for (const [header, value] of Object.entries(row)) {
            if (!value) continue

            const mappedField = initialMappings[header] || header

            if (mappedField.startsWith('interface_')) {
              // Interface field
              const fieldName = mappedField.replace('interface_', '')
              setInterfaceField(interfaceFields, fieldName, value)
            } else if (header.startsWith('cf_') || mappedField.startsWith('cf_')) {
              // Custom field (cf_ prefix)
              const fieldName = header.startsWith('cf_')
                ? header.substring(3)
                : mappedField.substring(3)
              customFields[fieldName] = value
            } else if (header === 'tags' || mappedField === 'tags') {
              // Tags column (comma-separated list)
              tags = value.split(',').map(t => t.trim()).filter(Boolean)
            } else {
              // Device field
              setDeviceField(deviceFields, mappedField, value)
            }
          }

          // Add custom fields and tags to device fields
          if (Object.keys(customFields).length > 0) {
            deviceFields.custom_fields = customFields
          }
          if (tags.length > 0) {
            deviceFields.tags = tags
          }

          // Get or create device entry
          let deviceEntry = deviceMap.get(deviceName)
          if (!deviceEntry) {
            deviceEntry = {
              device: deviceFields,
              interfaces: [],
              rowIndices: []
            }
            deviceMap.set(deviceName, deviceEntry)
          } else {
            // Merge device fields and check for conflicts
            for (const field of UNIQUE_DEVICE_FIELDS) {
              const existingValue = (deviceEntry.device as Record<string, unknown>)[field]
              const newValue = (deviceFields as Record<string, unknown>)[field]

              if (existingValue && newValue && existingValue !== newValue) {
                validationErrors.push({
                  deviceName,
                  field,
                  message: `Conflicting values: "${existingValue}" vs "${newValue}"`,
                  severity: 'error'
                })
              } else if (newValue && !existingValue) {
                (deviceEntry.device as Record<string, unknown>)[field] = newValue
              }
            }
          }

          deviceEntry.rowIndices.push(i + 1)

          // Add interface if it has a name
          if (interfaceFields.name) {
            deviceEntry.interfaces.push(interfaceFields as CSVInterfaceData)
          }
        }

        // Convert map to array and apply defaults
        const devices: ParsedDevice[] = []
        deviceMap.forEach((entry) => {
          const interfaces = entry.interfaces.map(iface => ({
            ...iface,
            status: iface.status || nautobotDefaults?.interface_status || '',
            namespace: iface.namespace || nautobotDefaults?.namespace,
          }))

          // Auto-set is_primary_ipv4 for single-interface devices if not already set
          const hasPrimarySet = interfaces.some(iface => iface.is_primary_ipv4 === true)
          if (!hasPrimarySet && interfaces.length === 1 && interfaces[0]) {
            interfaces[0].is_primary_ipv4 = true
          }

          const device: ParsedDevice = {
            name: entry.device.name!,
            role: entry.device.role || nautobotDefaults?.device_role,
            status: entry.device.status || nautobotDefaults?.device_status,
            location: entry.device.location || nautobotDefaults?.location,
            device_type: entry.device.device_type,
            platform: entry.device.platform || nautobotDefaults?.platform,
            software_version: entry.device.software_version,
            serial: entry.device.serial,
            asset_tag: entry.device.asset_tag,
            tags: entry.device.tags,
            custom_fields: entry.device.custom_fields,
            interfaces
          }
          devices.push(device)
        })

        // Validate devices have required fields
        devices.forEach(device => {
          if (!device.device_type) {
            validationErrors.push({
              deviceName: device.name,
              field: 'device_type',
              message: 'Device type is required but not provided in CSV or defaults',
              severity: 'error'
            })
          }
          if (device.interfaces.length === 0) {
            validationErrors.push({
              deviceName: device.name,
              field: 'interfaces',
              message: 'Device has no interfaces defined',
              severity: 'warning'
            })
          }
          device.interfaces.forEach((iface, index) => {
            if (!iface.type) {
              validationErrors.push({
                deviceName: device.name,
                field: `interface_${index + 1}_type`,
                message: `Interface "${iface.name}" is missing type`,
                severity: 'error'
              })
            }
          })
        })

        setParseResult({
          devices,
          headers,
          validationErrors,
          rowCount: lines.length - 1
        })
        setIsParsing(false)

      } catch (error) {
        setParseError(`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`)
        setIsParsing(false)
      }
    }

    reader.onerror = () => {
      setParseError('Failed to read file')
      setIsParsing(false)
    }

    reader.readAsText(file)
  }, [delimiter, nautobotDefaults])

  // Import all parsed devices
  const importDevices = useCallback(async () => {
    if (!parseResult || parseResult.devices.length === 0) return

    // Check for blocking errors
    const blockingErrors = parseResult.validationErrors.filter(e => e.severity === 'error')
    if (blockingErrors.length > 0) {
      setParseError(`Cannot import: ${blockingErrors.length} error(s) must be resolved`)
      return
    }

    setIsImporting(true)
    setImportProgress({ current: 0, total: parseResult.devices.length })

    const results: DeviceImportResult[] = []

    for (let i = 0; i < parseResult.devices.length; i++) {
      const device = parseResult.devices[i]
      if (!device) continue

      setImportProgress({ current: i + 1, total: parseResult.devices.length })

      try {
        const result = await onImportDevice(device)
        results.push(result)
      } catch (error) {
        results.push({
          deviceName: device.name,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const summary: ImportSummary = {
      total: results.length,
      success: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'error').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      results
    }

    setImportSummary(summary)
    setIsImporting(false)
  }, [parseResult, onImportDevice])

  // Update column mapping
  const updateMapping = useCallback((csvColumn: string, nautobotField: string) => {
    setColumnMappings(prev => ({
      ...prev,
      [csvColumn]: nautobotField
    }))
  }, [])

  // Re-parse with new mappings
  const applyMappings = useCallback(() => {
    if (csvFile) {
      parseCSV(csvFile)
    }
    setShowMappingConfig(false)
  }, [csvFile, parseCSV])

  // Reset state
  const reset = useCallback(() => {
    setCsvFile(null)
    setParseResult(null)
    setParseError('')
    setImportSummary(null)
    setColumnMappings({})
    setShowMappingConfig(false)
  }, [])

  // Close modal and reset
  const closeModal = useCallback(() => {
    setShowModal(false)
    reset()
  }, [reset])

  return useMemo(() => ({
    // State
    showModal,
    csvFile,
    parseResult,
    isParsing,
    parseError,
    isImporting,
    importProgress,
    importSummary,
    columnMappings,
    showMappingConfig,

    // Actions
    setShowModal,
    parseCSV,
    importDevices,
    updateMapping,
    applyMappings,
    setShowMappingConfig,
    reset,
    closeModal,
  }), [
    showModal,
    csvFile,
    parseResult,
    isParsing,
    parseError,
    isImporting,
    importProgress,
    importSummary,
    columnMappings,
    showMappingConfig,
    parseCSV,
    importDevices,
    updateMapping,
    applyMappings,
    reset,
    closeModal,
  ])
}

// Helper to parse CSV line handling quoted values
function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }

  result.push(current)
  return result
}

// Helper to set device field with type conversion
function setDeviceField(device: Partial<ParsedDevice>, field: string, value: string) {
  switch (field) {
    case 'name':
      device.name = value
      break
    case 'role':
      device.role = value
      break
    case 'status':
      device.status = value
      break
    case 'location':
      device.location = value
      break
    case 'device_type':
      device.device_type = value
      break
    case 'platform':
      device.platform = value
      break
    case 'software_version':
      device.software_version = value
      break
    case 'serial':
      device.serial = value
      break
    case 'asset_tag':
      device.asset_tag = value
      break
  }
}

// Helper to set interface field with type conversion
function setInterfaceField(iface: Partial<CSVInterfaceData>, field: string, value: string) {
  switch (field) {
    case 'name':
      iface.name = value
      break
    case 'type':
      iface.type = value
      break
    case 'status':
      iface.status = value
      break
    case 'ip_address':
      iface.ip_address = value
      break
    case 'namespace':
      iface.namespace = value
      break
    case 'is_primary_ipv4':
      iface.is_primary_ipv4 = value.toLowerCase() === 'true' || value === '1'
      break
    case 'enabled':
      iface.enabled = value.toLowerCase() === 'true' || value === '1'
      break
    case 'mgmt_only':
      iface.mgmt_only = value.toLowerCase() === 'true' || value === '1'
      break
    case 'description':
      iface.description = value
      break
    case 'mac_address':
      iface.mac_address = value
      break
    case 'mtu':
      const mtu = parseInt(value)
      if (!isNaN(mtu)) iface.mtu = mtu
      break
    case 'mode':
      iface.mode = value
      break
    case 'untagged_vlan':
      iface.untagged_vlan = value
      break
    case 'tagged_vlans':
      iface.tagged_vlans = value.split(',').map(v => v.trim()).filter(Boolean)
      break
    case 'parent_interface':
      iface.parent_interface = value
      break
    case 'bridge':
      iface.bridge = value
      break
    case 'lag':
      iface.lag = value
      break
    case 'tags':
      iface.tags = value.split(',').map(v => v.trim()).filter(Boolean)
      break
  }
}
