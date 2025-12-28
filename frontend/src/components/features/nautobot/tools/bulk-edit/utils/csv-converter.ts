import type { DeviceInfo } from '@/components/shared/device-selector'

/**
 * Escapes a CSV field value by wrapping it in quotes if necessary
 * and escaping any quotes within the value.
 */
function escapeCsvField(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return ''
  }

  const stringValue = String(value)

  // If the value contains commas, quotes, or newlines, wrap it in quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    // Escape existing quotes by doubling them
    return `"${stringValue.replace(/"/g, '""')}"`
  }

  return stringValue
}

/**
 * Extracts a string value from a DeviceInfo field that might be an object or string
 */
function extractFieldValue(field: unknown): string | null {
  if (field === null || field === undefined) {
    return null
  }

  // Handle object types (e.g., device_type: { name: "..." })
  if (typeof field === 'object' && field !== null) {
    if ('name' in field && typeof field.name === 'string') {
      return field.name
    }
    if ('address' in field && typeof field.address === 'string') {
      return field.address
    }
    // For other objects, try JSON stringify
    return JSON.stringify(field)
  }

  // Handle arrays (e.g., tags)
  if (Array.isArray(field)) {
    return field.join(',')
  }

  return String(field)
}

/**
 * Converts the modifiedDevices Map to CSV format for the backend API
 *
 * @param modifiedDevices - Map of device IDs to their modified fields
 * @param interfaceConfig - Interface configuration for primary IP (optional)
 * @param namespace - IP namespace for IP address creation (optional, defaults to 'Global')
 * @returns CSV string with header row and data rows
 *
 * Example output:
 * ```csv
 * id,name,status,location,primary_ip4,interface_name,interface_type,interface_status,ip_namespace
 * abc-123,ROUTER-01,active,HQ,192.168.1.1/24,Loopback0,virtual,active,Global
 * def-456,SWITCH-02,planned,DC1,,,
 * ```
 */
export function convertModifiedDevicesToCSV(
  modifiedDevices: Map<string, Partial<DeviceInfo>>,
  interfaceConfig?: { name: string; type: string; status: string },
  namespace?: string
): string {
  if (modifiedDevices.size === 0) {
    throw new Error('No modified devices to save')
  }

  // Check if any device has primary_ip4 changes
  const hasPrimaryIp4Changes = Array.from(modifiedDevices.values()).some(
    changes => 'primary_ip4' in changes
  )

  // Collect all unique field names across all modified devices
  const fieldNames = new Set<string>(['id']) // Always include 'id' as first column

  for (const changes of modifiedDevices.values()) {
    Object.keys(changes).forEach(key => {
      // Skip the 'id' field if it's in the changes (we add it separately)
      if (key !== 'id') {
        fieldNames.add(key)
      }
    })
  }

  // If primary_ip4 is being changed and we have interface config, add interface columns
  if (hasPrimaryIp4Changes && interfaceConfig) {
    fieldNames.add('interface_name')
    fieldNames.add('interface_type')
    fieldNames.add('interface_status')
  }

  // If primary_ip4 is being changed and we have a namespace, add namespace column
  if (hasPrimaryIp4Changes && namespace) {
    fieldNames.add('ip_namespace')
  }

  const columns = Array.from(fieldNames)

  // Build header row
  const headerRow = columns.map(escapeCsvField).join(',')

  // Build data rows
  const dataRows: string[] = []

  for (const [deviceId, changes] of modifiedDevices.entries()) {
    const deviceHasPrimaryIp4 = 'primary_ip4' in changes

    const rowValues = columns.map(columnName => {
      if (columnName === 'id') {
        return escapeCsvField(deviceId)
      }

      // Handle interface configuration columns
      if (columnName === 'interface_name') {
        return deviceHasPrimaryIp4 && interfaceConfig
          ? escapeCsvField(interfaceConfig.name)
          : ''
      }
      if (columnName === 'interface_type') {
        return deviceHasPrimaryIp4 && interfaceConfig
          ? escapeCsvField(interfaceConfig.type)
          : ''
      }
      if (columnName === 'interface_status') {
        return deviceHasPrimaryIp4 && interfaceConfig
          ? escapeCsvField(interfaceConfig.status)
          : ''
      }

      // Handle IP namespace column
      if (columnName === 'ip_namespace') {
        return deviceHasPrimaryIp4 && namespace
          ? escapeCsvField(namespace)
          : ''
      }

      // Get the value for this column from the changes
      const value = changes[columnName as keyof DeviceInfo]
      const extractedValue = extractFieldValue(value)

      return escapeCsvField(extractedValue)
    })

    dataRows.push(rowValues.join(','))
  }

  // Combine header and data rows
  return [headerRow, ...dataRows].join('\n')
}

/**
 * Validates that the modifiedDevices Map has valid data
 *
 * @param modifiedDevices - Map to validate
 * @throws Error if validation fails
 */
export function validateModifiedDevices(
  modifiedDevices: Map<string, Partial<DeviceInfo>>
): void {
  if (modifiedDevices.size === 0) {
    throw new Error('No devices have been modified')
  }

  // Check that each device has at least one modified field
  for (const [deviceId, changes] of modifiedDevices.entries()) {
    const fieldCount = Object.keys(changes).length
    if (fieldCount === 0) {
      throw new Error(`Device ${deviceId} has no modified fields`)
    }
  }
}
