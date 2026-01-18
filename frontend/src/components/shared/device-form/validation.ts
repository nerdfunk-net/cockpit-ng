import { z } from 'zod'

// ============================================================================
// IP Address Schema
// ============================================================================

export const ipAddressSchema = z.object({
  id: z.string(),
  address: z
    .string()
    .min(1, 'IP address is required')
    .refine(
      (val) => {
        if (!val.trim()) return false
        const ipPattern = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/
        return ipPattern.test(val.trim())
      },
      'Invalid IP address format (use x.x.x.x or x.x.x.x/mask)'
    ),
  namespace: z.string().min(1, 'Namespace is required'),
  ip_role: z.string(),
  is_primary: z.boolean().optional(),
})

// ============================================================================
// Interface Schema
// ============================================================================

export const interfaceSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Interface name is required'),
  type: z.string().min(1, 'Interface type is required'),
  status: z.string().min(1, 'Interface status is required'),
  ip_addresses: z.array(ipAddressSchema).min(1, 'At least one IP address is required'),
  enabled: z.boolean().optional(),
  mgmt_only: z.boolean().optional(),
  description: z.string().optional(),
  mac_address: z.string().optional(),
  mtu: z
    .any()
    .transform((val): number | undefined => {
      // Convert empty string, null, undefined, or NaN to undefined
      if (val === '' || val === null || val === undefined) return undefined
      // If it's already a valid number, return it
      if (typeof val === 'number' && !Number.isNaN(val)) return val
      // Convert string numbers to actual numbers
      if (typeof val === 'string') {
        const trimmed = val.trim()
        if (trimmed === '') return undefined
        const num = Number(trimmed)
        return Number.isNaN(num) ? undefined : num
      }
      // For any other type, return undefined
      return undefined
    })
    .optional(),
  mode: z.string().optional(),
  untagged_vlan: z.string().optional(),
  tagged_vlans: z.array(z.string()).optional(),
  parent_interface: z.string().optional(),
  bridge: z.string().optional(),
  lag: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

// ============================================================================
// Device Form Schema
// ============================================================================

export const deviceFormSchema = z.object({
  deviceName: z.string().min(1, 'Device name is required'),
  serialNumber: z.string().optional(),
  selectedRole: z.string().min(1, 'Device role is required'),
  selectedStatus: z.string().min(1, 'Device status is required'),
  selectedLocation: z.string().min(1, 'Location is required'),
  selectedDeviceType: z.string().min(1, 'Device type is required'),
  selectedPlatform: z.string().optional(),
  selectedSoftwareVersion: z.string().optional(),
  selectedTags: z.array(z.string()),
  customFieldValues: z.record(z.string(), z.string()),
  addPrefix: z.boolean(),
  defaultPrefixLength: z.string(),
  interfaces: z.array(interfaceSchema).min(1, 'At least one interface is required'),
})

// ============================================================================
// Infer TypeScript Types from Schemas
// ============================================================================

export type DeviceFormValues = z.infer<typeof deviceFormSchema>
export type InterfaceFormValues = z.infer<typeof interfaceSchema>

export type IpAddressFormValues = z.infer<typeof ipAddressSchema>