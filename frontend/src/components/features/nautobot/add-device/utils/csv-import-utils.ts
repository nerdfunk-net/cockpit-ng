/**
 * Pure CSV parsing utilities for the add-device CSV import feature.
 * All functions are stateless and have no React dependencies.
 */

import type {
  ParsedDevice,
  CSVInterfaceData,
  CSVParseResult,
  DeviceValidationError,
  NautobotDropdownsResponse,
} from '../types'
import { DEFAULT_COLUMN_MAPPINGS, UNIQUE_DEVICE_FIELDS } from '../types'

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

/**
 * Auto-detect column mappings based on CSV headers and known Nautobot fields.
 * Returns a record of { csvHeader → nautobotField | null }.
 */
export function buildInitialColumnMapping(
  headers: string[],
  nautobotFields: string[]
): Record<string, string | null> {
  const initialMapping: Record<string, string | null> = {}
  headers.forEach(header => {
    const autoMap = DEFAULT_COLUMN_MAPPINGS[header]
    if (autoMap) {
      initialMapping[header] = autoMap
    } else if (header.startsWith('cf_')) {
      initialMapping[header] = header
    } else {
      const directMatch = nautobotFields.find(f => f === header)
      initialMapping[header] = directMatch || null
    }
  })
  return initialMapping
}

/**
 * Parse CSV content into a structured list of devices using the given column mapping and defaults.
 */
export function parseCsvDevices(
  csvContent: string,
  columnMapping: Record<string, string | null>,
  defaults: Record<string, string>,
  delimiter: string,
  headers: string[],
  nautobotDefaults: NautobotDropdownsResponse['nautobotDefaults']
): CSVParseResult {
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

    // If an IP is present but no interface name, use the default interface name
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
}

// Parse a single CSV line, handling quoted values
export function parseCSVLine(line: string, delimiter: string): string[] {
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
