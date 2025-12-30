import type { DeviceInfo } from '@/components/shared/device-selector'

/**
 * Type guard for objects with id property
 */
interface WithId {
  id: string
}

/**
 * Type guard for objects with address property
 */
interface WithAddress {
  address: string
}

/**
 * Type guard to check if object has id property
 */
function hasId(obj: unknown): obj is WithId {
  return typeof obj === 'object' && obj !== null && 'id' in obj && typeof (obj as WithId).id === 'string'
}

/**
 * Type guard to check if object has address property
 */
function hasAddress(obj: unknown): obj is WithAddress {
  return typeof obj === 'object' && obj !== null && 'address' in obj && typeof (obj as WithAddress).address === 'string'
}

/**
 * Extracts the UUID or string value from a DeviceInfo field
 */
function extractFieldId(field: unknown): string | string[] | null {
  if (field === null || field === undefined) {
    return null
  }

  // Handle arrays first (before object check since arrays are objects)
  if (Array.isArray(field)) {
    // If it's an array of objects with id fields, extract the IDs
    if (field.length > 0 && hasId(field[0])) {
      return field.map((item: unknown) => hasId(item) ? item.id : '').filter(Boolean)
    }
    // For array of strings/primitives
    return field.map(String)
  }

  // Handle object types with id field (e.g., role: { id: "uuid", name: "..." })
  if (hasId(field)) {
    return field.id
  }

  // Handle object types with address field (e.g., primary_ip4: { address: "10.0.0.1/24" })
  if (hasAddress(field)) {
    return field.address
  }

  // For other objects, stringify them
  if (typeof field === 'object' && field !== null) {
    return JSON.stringify(field)
  }

  return String(field)
}

/**
 * Converts the modifiedDevices Map to JSON array format for the backend API
 *
 * @param modifiedDevices - Map of device IDs to their modified fields
 * @param interfaceConfig - Interface configuration for primary IP (optional)
 * @param namespace - IP namespace for IP address creation (optional)
 * @param addPrefixesAutomatically - Whether to automatically create missing IP prefixes (optional)
 * @param useAssignedIpIfExists - Whether to use existing IP if it exists with different netmask (optional)
 * @returns Array of device update objects
 *
 * Example output:
 * ```json
 * [
 *   {
 *     "id": "abc-123",
 *     "name": "ROUTER-01",
 *     "status": "status-uuid",
 *     "location": "location-uuid",
 *     "primary_ip4": "192.168.1.1/24",
 *     "mgmt_interface_name": "Loopback0",
 *     "mgmt_interface_type": "virtual",
 *     "mgmt_interface_status": "active",
 *     "mgmt_interface_create_on_ip_change": false,
 *     "namespace": "namespace-uuid",
 *     "add_prefixes_automatically": true,
 *     "use_assigned_ip_if_exists": false
 *   }
 * ]
 * ```
 */
export function convertModifiedDevicesToJSON(
  modifiedDevices: Map<string, Partial<DeviceInfo>>,
  interfaceConfig?: { name: string; type: string; status: string; createOnIpChange: boolean },
  namespace?: string,
  addPrefixesAutomatically?: boolean,
  useAssignedIpIfExists?: boolean
): Array<Record<string, unknown>> {
  if (modifiedDevices.size === 0) {
    throw new Error('No modified devices to save')
  }

  const devices: Array<Record<string, unknown>> = []

  for (const [deviceId, changes] of modifiedDevices.entries()) {
    const device: Record<string, unknown> = {
      id: deviceId,
    }

    // Add all modified fields
    for (const [key, value] of Object.entries(changes)) {
      // Skip the id field if it's in changes (we already added it)
      if (key === 'id') continue

      const extractedValue = extractFieldId(value)
      if (extractedValue !== null) {
        device[key] = extractedValue
      }
    }

    // If primary_ip4 is being changed and we have interface config, add interface fields
    if ('primary_ip4' in changes && interfaceConfig) {
      device.mgmt_interface_name = interfaceConfig.name
      device.mgmt_interface_type = interfaceConfig.type
      device.mgmt_interface_status = interfaceConfig.status
      device.mgmt_interface_create_on_ip_change = interfaceConfig.createOnIpChange
    }

    // If primary_ip4 is being changed and we have a namespace, add namespace field
    if ('primary_ip4' in changes && namespace) {
      device.namespace = namespace
    }

    // If primary_ip4 is being changed and addPrefixesAutomatically is set, add it
    if ('primary_ip4' in changes && addPrefixesAutomatically !== undefined) {
      device.add_prefixes_automatically = addPrefixesAutomatically
    }

    // If primary_ip4 is being changed and useAssignedIpIfExists is set, add it
    if ('primary_ip4' in changes && useAssignedIpIfExists !== undefined) {
      device.use_assigned_ip_if_exists = useAssignedIpIfExists
    }

    devices.push(device)
  }

  return devices
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
