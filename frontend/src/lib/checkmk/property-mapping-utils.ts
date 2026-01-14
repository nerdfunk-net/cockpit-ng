// Types imported from centralized location
import type { 
  CheckMKHost, 
  CheckMKConfig, 
  NautobotMetadata, 
  PropertyMapping 
} from '@/types/checkmk/types'

/**
 * Initialize property mappings from a CheckMK host to Nautobot fields
 * Pure function that can be tested independently
 */
export function initializePropertyMappings(
  host: CheckMKHost,
  checkmkConfig: CheckMKConfig | null,
  nautobotMetadata: NautobotMetadata | null
): Record<string, PropertyMapping> {
  const mappings: Record<string, PropertyMapping> = {}
  
  // Extract all tag_ attributes from CheckMK
  const attrs = host.attributes || {}
  
  // Add host_name
  mappings['host_name'] = {
    nautobotField: 'name',
    value: host.host_name,
    isCore: true
  }
  
  // Add IP address if available
  if (attrs.ipaddress) {
    mappings['ipaddress'] = {
      nautobotField: 'primary_ip4',
      value: attrs.ipaddress,
      isCore: true
    }
  }
  
  // Check for Location attribute (case-insensitive) - takes priority over folder
  const locationKey = Object.keys(attrs).find(key => key.toLowerCase() === 'location')
  if (locationKey && attrs[locationKey]) {
    mappings[locationKey] = {
      nautobotField: 'location',
      value: attrs[locationKey],
      isCore: true
    }
  } else if (host.folder) {
    // Fallback to folder if no Location attribute
    mappings['folder'] = {
      nautobotField: 'location',
      value: host.folder,
      isCore: true
    }
  }
  
  // Check for status attribute (tag_status or status)
  const statusKey = Object.keys(attrs).find(key => key.toLowerCase() === 'status' || key === 'tag_status')
  if (statusKey && attrs[statusKey]) {
    mappings[statusKey] = {
      nautobotField: 'status',
      value: attrs[statusKey],
      isCore: true
    }
  }
  
  // Check for role attribute (tag_role or role)
  const roleKey = Object.keys(attrs).find(key => key.toLowerCase() === 'role' || key === 'tag_role')
  if (roleKey && attrs[roleKey]) {
    mappings[roleKey] = {
      nautobotField: 'role',
      value: attrs[roleKey],
      isCore: true
    }
  } else {
    // Role is mandatory - add empty mapping to be filled by user
    mappings['role'] = {
      nautobotField: 'role',
      value: '',
      isCore: true
    }
  }
  
  // Check for device_type attribute (tag_device_type or device_type)
  const deviceTypeKey = Object.keys(attrs).find(key => key.toLowerCase() === 'device_type' || key === 'tag_device_type')
  if (deviceTypeKey && attrs[deviceTypeKey]) {
    mappings[deviceTypeKey] = {
      nautobotField: 'device_type',
      value: attrs[deviceTypeKey],
      isCore: true
    }
  } else {
    // Device type is mandatory - add empty mapping to be filled by user
    mappings['device_type'] = {
      nautobotField: 'device_type',
      value: '',
      isCore: true
    }
  }
  
  // Reverse mapping from CheckMK config
  // The config has attr2htg (nautobot_attr: checkmk_htg) and cf2htg (nautobot_cf: checkmk_htg)
  // We need to reverse these: checkmk_htg → nautobot field
  const reverseAttr2htg: Record<string, string> = {}
  const reverseCf2htg: Record<string, string> = {}
  const reverseTags2htg: Record<string, string> = {}
  
  if (checkmkConfig) {
    // Reverse attr2htg: "status.name": "status" → tag_status maps to "status"
    if (checkmkConfig.attr2htg) {
      Object.entries(checkmkConfig.attr2htg).forEach(([nautobotAttr, checkmkHtg]) => {
        reverseAttr2htg[`tag_${checkmkHtg}`] = nautobotAttr
      })
    }
    
    // Reverse cf2htg: "net": "net" → tag_net maps to custom_field_net
    if (checkmkConfig.cf2htg) {
      Object.entries(checkmkConfig.cf2htg).forEach(([nautobotCf, checkmkHtg]) => {
        reverseCf2htg[`tag_${checkmkHtg}`] = `custom_field_${nautobotCf}`
      })
    }
    
    // Reverse tags2htg: similar to cf2htg
    if (checkmkConfig.tags2htg) {
      Object.entries(checkmkConfig.tags2htg).forEach(([nautobotTag, checkmkHtg]) => {
        reverseTags2htg[`tag_${checkmkHtg}`] = `custom_field_${nautobotTag}`
      })
    }
  }
  
  // Build a map of custom field keys from Nautobot metadata (if available)
  const customFieldKeys = new Set<string>()
  if (nautobotMetadata?.customFields) {
    nautobotMetadata.customFields.forEach(cf => {
      customFieldKeys.add(cf.key.toLowerCase())
    })
  }
  
  // Add all tag_ attributes with intelligent mapping
  Object.keys(attrs).forEach(key => {
    if (key.startsWith('tag_')) {
      const cleanKey = key.replace('tag_', '').toLowerCase()
      
      // Skip if already processed as a core attribute (status, role)
      if (mappings[key]) {
        return
      }
      let nautobotField = 'no_mapping'
      let isCore = false
      
      // Check if this is a core attribute (status)
      const isStatusAttribute = reverseAttr2htg[key] && reverseAttr2htg[key].startsWith('status')
      
      // Priority 1: Check if we have a reverse mapping from CheckMK config
      const attrPath = reverseAttr2htg[key]
      if (attrPath) {
        // Map to Nautobot attribute (e.g., "status.name" → "status")
        nautobotField = attrPath.split('.')[0] || 'no_mapping' // Get first part (e.g., "status")
        isCore = true
      } else {
        const cfPath = reverseCf2htg[key]
        if (cfPath) {
          // Map to custom field from config - only if it exists in Nautobot
          const cfKey = cfPath.replace('custom_field_', '')
          if (customFieldKeys.has(cfKey.toLowerCase())) {
            nautobotField = cfPath
          }
        } else {
          const tagPath = reverseTags2htg[key]
          if (tagPath) {
            // Map to custom field from tags - only if it exists in Nautobot
            const cfKey = tagPath.replace('custom_field_', '')
            if (customFieldKeys.has(cfKey.toLowerCase())) {
              nautobotField = tagPath
            }
          }
        }
      }
      
      if (customFieldKeys.has(cleanKey) && nautobotField === 'no_mapping') {
        // Priority 2: Check if there's a matching custom field in Nautobot
        // e.g., tag_latency → custom_field_latency if "latency" custom field exists
        nautobotField = `custom_field_${cleanKey}`
      }
      // Otherwise use 'no_mapping' - attribute won't be synced
      
      // Mark as core if it maps to a core Nautobot attribute
      const isCoreNautobotField = ['name', 'primary_ip4', 'location', 'status', 'role', 'device_type', 'platform'].includes(nautobotField)
      
      mappings[key] = {
        nautobotField,
        value: attrs[key],
        isCore: isStatusAttribute || isCore || isCoreNautobotField
      }
    }
  })
  
  return mappings
}

/**
 * Resolve Nautobot ID from name/value using metadata
 * Pure function for ID resolution
 */
export function resolveNautobotId(
  field: string,
  value: unknown,
  nautobotMetadata: NautobotMetadata | null
): string {
  if (!nautobotMetadata || !value) return String(value)
  
  const valueStr = String(value).toLowerCase()
  
  // Map field to metadata array
  const fieldMappings: Record<string, Array<{ id: string; name: string }>> = {
    'location': nautobotMetadata.locations,
    'role': nautobotMetadata.roles,
    'status': nautobotMetadata.statuses,
    'device_type': nautobotMetadata.deviceTypes,
    'platform': nautobotMetadata.platforms,
  }
  
  const metadataArray = fieldMappings[field]
  if (!metadataArray) return String(value)
  
  // Try to find exact match first
  const exactMatch = metadataArray.find(item => item.name.toLowerCase() === valueStr)
  if (exactMatch) return exactMatch.id
  
  // Try partial match
  const partialMatch = metadataArray.find(item => item.name.toLowerCase().includes(valueStr))
  if (partialMatch) return partialMatch.id
  
  // Return original value if no match
  return String(value)
}

/**
 * Interface for interface mapping data
 */
export interface InterfaceMappingData {
  enabled: boolean
  ipRole: string
  status: string
  ipAddress: string
  interfaceName: string
  isPrimary: boolean
}

/**
 * Interface data for add device request (matches backend InterfaceData model)
 */
export interface InterfaceDataPayload {
  name: string
  type: string
  status: string
  ip_address?: string
  namespace?: string
  is_primary_ipv4?: boolean
  ip_role?: string  // IP address role (e.g., "Secondary", "Anycast")
  enabled?: boolean
  mgmt_only?: boolean
  description?: string
}

/**
 * Build device payload from property mappings for Nautobot sync
 * Pure function that transforms mappings to API payload
 */
export function buildDevicePayload(
  propertyMappings: Record<string, PropertyMapping>,
  nautobotMetadata: NautobotMetadata | null,
  interfaceMappings?: Record<string, InterfaceMappingData>
): { devicePayload: Record<string, unknown>; customFields: Record<string, string> } {
  const devicePayload: Record<string, unknown> = {}
  
  const customFields: Record<string, string> = {}
  
  Object.entries(propertyMappings).forEach(([_checkMkKey, mapping]) => {
    const { nautobotField, value } = mapping
    
    // Skip fields with no mapping
    if (nautobotField === 'no_mapping') {
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
        : value
      
      devicePayload[nautobotField] = resolvedValue
    }
  })
  
  // Add custom fields to payload
  if (Object.keys(customFields).length > 0) {
    devicePayload.custom_fields = customFields
  }

  // Build interfaces array from interface mappings
  const interfaces: InterfaceDataPayload[] = []
  if (interfaceMappings) {
    Object.entries(interfaceMappings).forEach(([_rowKey, mapping]) => {
      if (mapping.enabled && mapping.interfaceName && mapping.ipAddress) {
        // Parse IP address to separate address and CIDR
        const ipParts = mapping.ipAddress.split('/')
        const ipAddr = ipParts[0]
        
        // Determine IP role: only set if not 'none'
        const ipRole = mapping.ipRole && mapping.ipRole !== 'none' ? mapping.ipRole : undefined
        
        console.log(`[DEBUG] Building interface payload: name=${mapping.interfaceName}, ip=${ipAddr}, isPrimary=${mapping.isPrimary}, ipRole=${mapping.ipRole}, sending_ip_role=${ipRole}`)
        
        interfaces.push({
          name: mapping.interfaceName,
          type: 'other', // Default type, can be enhanced later
          status: mapping.status || 'Active',
          ip_address: ipAddr,
          namespace: 'Global', // Default namespace, could be made configurable
          is_primary_ipv4: mapping.isPrimary, // Use the user-selected primary flag
          ip_role: ipRole, // Only set if not 'none'
          enabled: true,
          mgmt_only: false,
        })
      }
    })
  }
  
  console.log(`[DEBUG] Total interfaces in payload: ${interfaces.length}`)
  if (interfaces.length > 0) {
    console.log('[DEBUG] Interface payload details:', JSON.stringify(interfaces, null, 2))
  }
  
  // Add interfaces to payload
  devicePayload.interfaces = interfaces
  
  return { devicePayload, customFields }
}
