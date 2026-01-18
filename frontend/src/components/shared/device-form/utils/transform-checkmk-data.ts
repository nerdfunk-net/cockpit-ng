/**
 * Utility to transform CheckMK inventory and property mappings to DeviceFormValues format
 * This enables the shared device form to be pre-populated from CheckMK data
 */

import type { DeviceFormValues, InterfaceFormValues } from '../validation'
import type { CheckMKHost, PropertyMapping, NautobotMetadata } from '@/types/checkmk/types'

/**
 * Resolves a Nautobot ID from a name/value using metadata
 */
function resolveNautobotId(
  field: string,
  value: unknown,
  metadata: NautobotMetadata | null
): string {
  if (!value || !metadata) return ''
  
  const valueStr = String(value)
  
  switch (field) {
    case 'location':
      return metadata.locations?.find(l => 
        l.name.toLowerCase() === valueStr.toLowerCase()
      )?.id || ''
    
    case 'role':
      return metadata.roles?.find(r => 
        r.name.toLowerCase() === valueStr.toLowerCase()
      )?.id || ''
    
    case 'status':
      return metadata.statuses?.find(s => 
        s.name.toLowerCase() === valueStr.toLowerCase()
      )?.id || ''
    
    case 'device_type':
      return metadata.deviceTypes?.find(dt => {
        const dtAny = dt as { id: string; name?: string; display?: string; model?: string }
        return dtAny.name?.toLowerCase() === valueStr.toLowerCase() ||
               dtAny.display?.toLowerCase() === valueStr.toLowerCase() ||
               dtAny.model?.toLowerCase() === valueStr.toLowerCase()
      })?.id || ''
    
    case 'platform':
      return metadata.platforms?.find(p => 
        p.name.toLowerCase() === valueStr.toLowerCase()
      )?.id || ''
    
    default:
      return ''
  }
}

export interface InterfaceMappingData {
  enabled: boolean
  ipRole: string
  status: string
  ipAddress: string
  interfaceName: string
  isPrimary: boolean
}

/**
 * Transform CheckMK property mappings and interface mappings to DeviceFormValues
 * 
 * @param propertyMappings - Property mappings from CheckMK host attributes
 * @param nautobotMetadata - Nautobot metadata for ID resolution
 * @param interfaceMappings - Interface mappings from CheckMK inventory
 * @returns DeviceFormValues suitable for the shared form
 */
export function transformCheckMKToFormData(
  propertyMappings: Record<string, PropertyMapping>,
  nautobotMetadata: NautobotMetadata | null,
  interfaceMappings?: Record<string, InterfaceMappingData>,
  dropdownData?: { 
    namespaces?: Array<{ id: string; name: string }>; 
    nautobotDefaults?: { namespace?: string } | null;
    ipRoles?: Array<{ id: string; name: string }>;
  }
): Partial<DeviceFormValues> {
  const formData: Partial<DeviceFormValues> = {
    selectedTags: [],
    customFieldValues: {},
    interfaces: [],
    addPrefix: true,
    defaultPrefixLength: '/24',
  }

  // Extract custom fields from property mappings
  const customFields: Record<string, string> = {}

  // Process property mappings
  Object.entries(propertyMappings).forEach(([_key, mapping]) => {
    const { nautobotField, value } = mapping

    if (nautobotField === 'no_mapping' || !value) {
      return
    }

    if (nautobotField.startsWith('custom_field_')) {
      // Custom field
      const fieldKey = nautobotField.replace('custom_field_', '')
      customFields[fieldKey] = String(value)
    } else {
      // Standard field - resolve ID if needed
      const resolvedValue = ['location', 'role', 'status', 'device_type', 'platform'].includes(nautobotField)
        ? resolveNautobotId(nautobotField, value, nautobotMetadata)
        : String(value)

      // Map to form field names
      switch (nautobotField) {
        case 'name':
          formData.deviceName = resolvedValue
          break
        case 'role':
          formData.selectedRole = resolvedValue
          break
        case 'status':
          formData.selectedStatus = resolvedValue
          break
        case 'location':
          formData.selectedLocation = resolvedValue
          break
        case 'device_type':
          formData.selectedDeviceType = resolvedValue
          break
        case 'platform':
          formData.selectedPlatform = resolvedValue
          break
        case 'serial':
          formData.serialNumber = resolvedValue
          break
        default:
          break
      }
    }
  })

  formData.customFieldValues = customFields

  // Build interfaces array from interface mappings
  const interfaces: InterfaceFormValues[] = []
  let interfaceIdCounter = 1
  let ipIdCounter = 1

  if (interfaceMappings) {
    Object.entries(interfaceMappings).forEach(([_rowKey, mapping]) => {
      if (mapping.enabled && mapping.interfaceName && mapping.ipAddress) {
        // Parse IP address to separate address and CIDR
        const ipAddr = mapping.ipAddress

        // Determine IP role: look up ID from name, default to 'none' if not found
        let ipRole = 'none'
        if (mapping.ipRole && mapping.ipRole !== 'none') {
          const roleOption = dropdownData?.ipRoles?.find(
            r => r.name.toLowerCase() === mapping.ipRole.toLowerCase()
          )
          ipRole = roleOption?.id || 'none'
        }

        // Auto-select namespace if only one is available
        const defaultNamespace = dropdownData?.nautobotDefaults?.namespace || 
          (dropdownData?.namespaces && dropdownData.namespaces.length === 1 
            ? dropdownData.namespaces[0]!.id 
            : 'Global')

        // Check if interface already exists
        const existingInterface = interfaces.find(i => i.name === mapping.interfaceName)
        
        if (existingInterface) {
          // Add IP address to existing interface
          existingInterface.ip_addresses.push({
            id: String(ipIdCounter++),
            address: ipAddr || '',
            namespace: defaultNamespace,
            ip_role: ipRole,
            is_primary: mapping.isPrimary,
          })
        } else {
          // Create new interface with this IP address
          interfaces.push({
            id: String(interfaceIdCounter++),
            name: mapping.interfaceName,
            type: 'other', // Default type, can be enhanced later
            status: mapping.status || 'Active',
            ip_addresses: [{
              id: String(ipIdCounter++),
              address: ipAddr || '',
              namespace: defaultNamespace,
              ip_role: ipRole,
              is_primary: mapping.isPrimary,
            }],
            enabled: true,
            mgmt_only: false,
          })
        }
      }
    })
  }

  // Ensure at least one interface (form validation requirement)
  if (interfaces.length > 0) {
    // Apply primary IP logic:
    // 1. If device has interface starting with "Management" or "Mgmt", use first IP of that interface
    // 2. Otherwise, use first IP of first interface
    // 3. All other IPs are not primary
    
    let primarySet = false
    
    // First, reset all IPs to not primary
    interfaces.forEach(iface => {
      iface.ip_addresses.forEach(ip => {
        ip.is_primary = false
      })
    })
    
    // Look for Management/Mgmt interface
    const mgmtInterface = interfaces.find(iface => {
      const name = iface.name.toLowerCase()
      return name.startsWith('management') || name.startsWith('mgmt')
    })
    
    if (mgmtInterface && mgmtInterface.ip_addresses.length > 0) {
      // Set first IP of management interface as primary
      mgmtInterface.ip_addresses[0]!.is_primary = true
      primarySet = true
    }
    
    // If no management interface found, use first IP of first interface
    if (!primarySet && interfaces.length > 0 && interfaces[0]!.ip_addresses.length > 0) {
      interfaces[0]!.ip_addresses[0]!.is_primary = true
    }
    
    formData.interfaces = interfaces
  }

  return formData
}

/**
 * Helper to extract device name from CheckMK host
 */
export function getDeviceNameFromHost(host: CheckMKHost): string {
  return host.host_name || ''
}
