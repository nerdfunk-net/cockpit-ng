'use client'

import { useState, useCallback, useMemo } from 'react'
import type {
  ParsedDevice,
  CSVInterfaceData,
  CSVParseResult,
  DeviceValidationError,
  DeviceImportResult,
  ImportSummary,
  NautobotDropdownsResponse,
} from '../types'
import { DEFAULT_COLUMN_MAPPINGS, UNIQUE_DEVICE_FIELDS } from '../types'
import { CSV_IMPORT_NAUTOBOT_FIELDS } from '@/components/features/jobs/templates/utils/constants'

// Wizard steps
export type CsvImportStep =
  | 'upload'
  | 'mapping'
  | 'defaults'
  | 'preview'
  | 'importing'
  | 'summary'

// Mandatory device fields that need defaults if not in CSV
export const MANDATORY_DEVICE_FIELDS = [
  'device_type',
  'role',
  'status',
  'location',
] as const

// Interface fields that are mandatory when IP is mapped but interface columns are absent
export const MANDATORY_INTERFACE_FIELDS = [
  'interface_name',
  'interface_type',
  'interface_status',
  'interface_namespace',
] as const

// Form values passed from the Add Device page
export interface FormDefaults {
  deviceType?: string
  deviceTypeName?: string
  role?: string
  roleName?: string
  status?: string
  statusName?: string
  location?: string
  locationName?: string
  platform?: string
  platformName?: string
}

export interface PrefixConfig {
  addPrefix: boolean
  defaultPrefixLength: string
}

const DEFAULT_PREFIX_CONFIG: PrefixConfig = {
  addPrefix: false,
  defaultPrefixLength: '/24',
}

interface UseCsvImportProps {
  nautobotDefaults: NautobotDropdownsResponse['nautobotDefaults']
  formDefaults: FormDefaults
  onImportDevice: (device: ParsedDevice, prefixConfig: PrefixConfig) => Promise<DeviceImportResult>
}

export function useCsvImport({
  nautobotDefaults,
  formDefaults,
  onImportDevice,
}: UseCsvImportProps) {
  const [showModal, setShowModal] = useState(false)
  const [step, setStep] = useState<CsvImportStep>('upload')

  // Upload state
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvContent, setCsvContent] = useState<string>('')
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [delimiter, setDelimiter] = useState(nautobotDefaults?.csv_delimiter || ',')

  // Mapping state
  const [columnMapping, setColumnMapping] = useState<Record<string, string | null>>({})

  // Defaults state
  const [defaults, setDefaults] = useState<Record<string, string>>({})

  // Prefix configuration
  const [prefixConfig, setPrefixConfig] = useState<PrefixConfig>(DEFAULT_PREFIX_CONFIG)

  // Preview state
  const [parseResult, setParseResult] = useState<CSVParseResult | null>(null)
  const [dryRunErrors, setDryRunErrors] = useState<DeviceValidationError[]>([])
  const [isDryRun, setIsDryRun] = useState(false)

  // Import state
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 })
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)

  // Available Nautobot fields for the mapping dropdowns
  const nautobotFields = useMemo(() => CSV_IMPORT_NAUTOBOT_FIELDS['devices'] || [], [])

  // Determine which mandatory fields are NOT mapped from CSV
  const unmappedMandatoryFields = useMemo(() => {
    const mappedTargets = new Set(
      Object.values(columnMapping).filter((v): v is string => v !== null)
    )
    return MANDATORY_DEVICE_FIELDS.filter(field => !mappedTargets.has(field))
  }, [columnMapping])

  // Determine which interface fields need defaults — only when IP is mapped but interface columns are missing
  const unmappedMandatoryInterfaceFields = useMemo(() => {
    const mappedTargets = new Set(
      Object.values(columnMapping).filter((v): v is string => v !== null)
    )
    if (!mappedTargets.has('interface_ip_address')) return [] as const satisfies readonly string[]
    return MANDATORY_INTERFACE_FIELDS.filter(field => !mappedTargets.has(field))
  }, [columnMapping])

  // Parse CSV file and extract headers
  const handleFileSelect = useCallback(
    (file: File) => {
      setCsvFile(file)
      setIsParsing(true)
      setParseError('')
      setHeaders([])
      setParseResult(null)
      setImportSummary(null)
      setDryRunErrors([])

      const reader = new FileReader()

      reader.onload = e => {
        try {
          const text = e.target?.result as string
          if (!text || text.trim() === '') {
            setParseError('CSV file is empty')
            setIsParsing(false)
            return
          }

          setCsvContent(text)

          const lines = text.split('\n').filter(line => line.trim())
          if (lines.length === 0) {
            setParseError('CSV file has no content')
            setIsParsing(false)
            return
          }

          const headerLine = lines[0]
          if (!headerLine) {
            setParseError('CSV file has no headers')
            setIsParsing(false)
            return
          }

          // Remove BOM and normalize
          const cleanHeaderLine = headerLine.replace(/^\uFEFF/, '').replace(/\r/g, '')
          const parsedHeaders = cleanHeaderLine
            .split(delimiter)
            .map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
            .filter(h => h !== '')

          setHeaders(parsedHeaders)

          // Auto-detect column mappings
          const initialMapping: Record<string, string | null> = {}
          parsedHeaders.forEach(header => {
            const autoMap = DEFAULT_COLUMN_MAPPINGS[header]
            if (autoMap) {
              initialMapping[header] = autoMap
            } else if (header.startsWith('cf_')) {
              initialMapping[header] = header
            } else {
              // Check if header matches a Nautobot field directly
              const directMatch = nautobotFields.find(f => f === header)
              initialMapping[header] = directMatch || null
            }
          })
          setColumnMapping(initialMapping)

          // Pre-fill defaults from form values
          const initialDefaults: Record<string, string> = {}
          if (formDefaults.deviceType)
            initialDefaults['device_type'] = formDefaults.deviceType
          if (formDefaults.role) initialDefaults['role'] = formDefaults.role
          if (formDefaults.status) initialDefaults['status'] = formDefaults.status
          if (formDefaults.location) initialDefaults['location'] = formDefaults.location
          if (formDefaults.platform) initialDefaults['platform'] = formDefaults.platform
          // Pre-fill interface defaults from Nautobot system defaults
          if (nautobotDefaults?.interface_status)
            initialDefaults['interface_status'] = nautobotDefaults.interface_status
          if (nautobotDefaults?.namespace)
            initialDefaults['interface_namespace'] = nautobotDefaults.namespace
          setDefaults(initialDefaults)

          setIsParsing(false)
          setStep('mapping')
        } catch (error) {
          setParseError(
            `Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
          setIsParsing(false)
        }
      }

      reader.onerror = () => {
        setParseError('Failed to read file')
        setIsParsing(false)
      }

      reader.readAsText(file)
    },
    [delimiter, nautobotFields, formDefaults, nautobotDefaults]
  )

  // Build parsed devices from CSV content + mapping + defaults
  const buildParsedDevices = useCallback((): CSVParseResult => {
    const lines = csvContent.split('\n').filter(line => line.trim())
    const validationErrors: DeviceValidationError[] = []

    // Find the name column from mapping
    const nameHeader = Object.entries(columnMapping).find(
      ([, target]) => target === 'name'
    )?.[0]

    if (!nameHeader) {
      return {
        devices: [],
        headers,
        validationErrors: [
          {
            deviceName: 'Global',
            field: 'name',
            message: 'No column is mapped to "name". A device name column is required.',
            severity: 'error',
          },
        ],
        rowCount: lines.length - 1,
      }
    }

    const deviceMap = new Map<
      string,
      {
        device: Partial<ParsedDevice>
        interfaces: CSVInterfaceData[]
        rowIndices: number[]
      }
    >()

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      if (!line || !line.trim()) continue

      const values = parseCSVLine(line, delimiter)
      if (values.length !== headers.length) {
        validationErrors.push({
          deviceName: `Row ${i + 1}`,
          field: 'columns',
          message: `Expected ${headers.length} columns, got ${values.length}`,
          severity: 'warning',
        })
        continue
      }

      // Build row object
      const row: Record<string, string> = {}
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || ''
      })

      const deviceName = row[nameHeader]
      if (!deviceName) {
        validationErrors.push({
          deviceName: `Row ${i + 1}`,
          field: 'name',
          message: 'Device name is empty',
          severity: 'error',
        })
        continue
      }

      // Extract fields based on mapping
      const deviceFields: Partial<ParsedDevice> = { name: deviceName }
      const interfaceFields: Partial<CSVInterfaceData> = {}
      const customFields: Record<string, string> = {}
      let tags: string[] = []

      for (const [header, value] of Object.entries(row)) {
        if (!value) continue

        const mappedField = columnMapping[header]
        if (mappedField === null || mappedField === undefined) continue // "Not Used" or unmapped

        if (mappedField.startsWith('interface_')) {
          const fieldName = mappedField.replace('interface_', '')
          setInterfaceField(interfaceFields, fieldName, value)
        } else if (mappedField.startsWith('cf_')) {
          const fieldName = mappedField.substring(3)
          customFields[fieldName] = value
        } else if (mappedField === 'tags') {
          tags = value
            .split(',')
            .map(t => t.trim())
            .filter(Boolean)
        } else {
          setDeviceField(deviceFields, mappedField, value)
        }
      }

      if (Object.keys(customFields).length > 0) {
        deviceFields.custom_fields = customFields
      }
      if (tags.length > 0) {
        deviceFields.tags = tags
      }

      // Get or create device entry
      let deviceEntry = deviceMap.get(deviceName)
      if (!deviceEntry) {
        deviceEntry = { device: deviceFields, interfaces: [], rowIndices: [] }
        deviceMap.set(deviceName, deviceEntry)
      } else {
        // Merge device fields, check for conflicts
        for (const field of UNIQUE_DEVICE_FIELDS) {
          const existingValue = (deviceEntry.device as Record<string, unknown>)[field]
          const newValue = (deviceFields as Record<string, unknown>)[field]
          if (existingValue && newValue && existingValue !== newValue) {
            validationErrors.push({
              deviceName,
              field,
              message: `Conflicting values: "${existingValue}" vs "${newValue}"`,
              severity: 'error',
            })
          } else if (newValue && !existingValue) {
            ;(deviceEntry.device as Record<string, unknown>)[field] = newValue
          }
        }
      }

      deviceEntry.rowIndices.push(i + 1)

      // If an IP is present but no interface name, use the default interface name so the interface is created
      if (interfaceFields.ip_address && !interfaceFields.name && defaults['interface_name']) {
        interfaceFields.name = defaults['interface_name']
      }

      if (interfaceFields.name) {
        deviceEntry.interfaces.push(interfaceFields as CSVInterfaceData)
      }
    }

    // Convert map to array, apply defaults
    const devices: ParsedDevice[] = []
    deviceMap.forEach(entry => {
      const interfaces = entry.interfaces.map(iface => ({
        ...iface,
        type: iface.type || defaults['interface_type'] || '',
        status:
          iface.status ||
          defaults['interface_status'] ||
          nautobotDefaults?.interface_status ||
          '',
        namespace:
          iface.namespace ||
          defaults['interface_namespace'] ||
          nautobotDefaults?.namespace,
      }))

      // Auto-set primary IP for single-interface devices
      const hasPrimarySet = interfaces.some(iface => iface.is_primary_ipv4 === true)
      if (!hasPrimarySet && interfaces.length === 1 && interfaces[0]) {
        interfaces[0].is_primary_ipv4 = true
      }

      const device: ParsedDevice = {
        name: entry.device.name!,
        role: entry.device.role || defaults['role'] || undefined,
        status: entry.device.status || defaults['status'] || undefined,
        location: entry.device.location || defaults['location'] || undefined,
        device_type: entry.device.device_type || defaults['device_type'] || undefined,
        platform: entry.device.platform || defaults['platform'] || undefined,
        software_version: entry.device.software_version,
        serial: entry.device.serial,
        asset_tag: entry.device.asset_tag,
        tags: entry.device.tags,
        custom_fields: entry.device.custom_fields,
        interfaces,
      }
      devices.push(device)
    })

    // Validate mandatory fields
    devices.forEach(device => {
      if (!device.device_type) {
        validationErrors.push({
          deviceName: device.name,
          field: 'device_type',
          message: 'Device type is required but not provided in CSV or defaults',
          severity: 'error',
        })
      }
      if (!device.role) {
        validationErrors.push({
          deviceName: device.name,
          field: 'role',
          message: 'Role is required but not provided in CSV or defaults',
          severity: 'error',
        })
      }
      if (!device.status) {
        validationErrors.push({
          deviceName: device.name,
          field: 'status',
          message: 'Status is required but not provided in CSV or defaults',
          severity: 'error',
        })
      }
      if (!device.location) {
        validationErrors.push({
          deviceName: device.name,
          field: 'location',
          message: 'Location is required but not provided in CSV or defaults',
          severity: 'error',
        })
      }
      if (device.interfaces.length === 0) {
        validationErrors.push({
          deviceName: device.name,
          field: 'interfaces',
          message: 'Device has no interfaces defined',
          severity: 'warning',
        })
      }
      device.interfaces.forEach((iface, index) => {
        if (!iface.type) {
          validationErrors.push({
            deviceName: device.name,
            field: `interface_${index + 1}_type`,
            message: `Interface "${iface.name}" is missing type`,
            severity: 'error',
          })
        }
      })
    })

    return {
      devices,
      headers,
      validationErrors,
      rowCount: lines.length - 1,
    }
  }, [csvContent, columnMapping, defaults, delimiter, headers, nautobotDefaults])

  // Navigate to preview step (builds parsed devices)
  const goToPreview = useCallback(() => {
    const result = buildParsedDevices()
    setParseResult(result)
    setDryRunErrors([])
    setStep('preview')
  }, [buildParsedDevices])

  // Dry run — validate without importing
  const runDryRun = useCallback(() => {
    setIsDryRun(true)
    const result = buildParsedDevices()
    setParseResult(result)
    setDryRunErrors(result.validationErrors)
    setIsDryRun(false)
  }, [buildParsedDevices])

  // Import all parsed devices
  const importDevices = useCallback(async () => {
    if (!parseResult || parseResult.devices.length === 0) return

    const blockingErrors = parseResult.validationErrors.filter(
      e => e.severity === 'error'
    )
    if (blockingErrors.length > 0) return

    setStep('importing')
    setIsImporting(true)
    setImportProgress({ current: 0, total: parseResult.devices.length })

    const results: DeviceImportResult[] = []

    for (let i = 0; i < parseResult.devices.length; i++) {
      const device = parseResult.devices[i]
      if (!device) continue

      setImportProgress({ current: i + 1, total: parseResult.devices.length })

      try {
        const result = await onImportDevice(device, prefixConfig)
        results.push(result)
      } catch (error) {
        results.push({
          deviceName: device.name,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const summary: ImportSummary = {
      total: results.length,
      success: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'error').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      results,
    }

    setImportSummary(summary)
    setIsImporting(false)
    setStep('summary')
  }, [parseResult, onImportDevice, prefixConfig])

  // Navigation
  const goToStep = useCallback(
    (targetStep: CsvImportStep) => {
      if (targetStep === 'preview') {
        goToPreview()
      } else {
        setStep(targetStep)
      }
    },
    [goToPreview]
  )

  // Reset all state
  const reset = useCallback(() => {
    setCsvFile(null)
    setCsvContent('')
    setHeaders([])
    setParseError('')
    setColumnMapping({})
    setDefaults({})
    setPrefixConfig(DEFAULT_PREFIX_CONFIG)
    setParseResult(null)
    setDryRunErrors([])
    setImportSummary(null)
    setStep('upload')
  }, [])

  const closeModal = useCallback(() => {
    setShowModal(false)
    reset()
  }, [reset])

  return useMemo(
    () => ({
      // Modal state
      showModal,
      setShowModal,
      closeModal,
      step,
      goToStep,

      // Upload
      csvFile,
      isParsing,
      parseError,
      headers,
      delimiter,
      setDelimiter,
      handleFileSelect,

      // Mapping
      columnMapping,
      setColumnMapping,
      nautobotFields,
      unmappedMandatoryFields,
      unmappedMandatoryInterfaceFields,

      // Defaults
      defaults,
      setDefaults,

      // Prefix configuration
      prefixConfig,
      setPrefixConfig,

      // Preview
      parseResult,
      dryRunErrors,
      isDryRun,
      goToPreview,
      runDryRun,

      // Import
      isImporting,
      importProgress,
      importSummary,
      importDevices,

      // Reset
      reset,
    }),
    [
      showModal,
      closeModal,
      step,
      goToStep,
      csvFile,
      isParsing,
      parseError,
      headers,
      delimiter,
      handleFileSelect,
      columnMapping,
      nautobotFields,
      unmappedMandatoryFields,
      unmappedMandatoryInterfaceFields,
      defaults,
      parseResult,
      dryRunErrors,
      isDryRun,
      goToPreview,
      runDryRun,
      isImporting,
      importProgress,
      importSummary,
      importDevices,
      prefixConfig,
      setPrefixConfig,
      reset,
    ]
  )
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

// Helper to set device field
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
function setInterfaceField(
  iface: Partial<CSVInterfaceData>,
  field: string,
  value: string
) {
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
    case 'mtu': {
      const mtu = parseInt(value)
      if (!isNaN(mtu)) iface.mtu = mtu
      break
    }
    case 'mode':
      iface.mode = value
      break
    case 'untagged_vlan':
      iface.untagged_vlan = value
      break
    case 'tagged_vlans':
      iface.tagged_vlans = value
        .split(',')
        .map(v => v.trim())
        .filter(Boolean)
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
      iface.tags = value
        .split(',')
        .map(v => v.trim())
        .filter(Boolean)
      break
  }
}
