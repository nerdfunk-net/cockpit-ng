import { z } from 'zod'

// ============================================================================
// Interface Schema
// ============================================================================

export const interfaceSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Interface name is required'),
  type: z.string().min(1, 'Interface type is required'),
  status: z.string().min(1, 'Interface status is required'),
  ip_address: z
    .string()
    .refine(
      (val) => {
        if (!val.trim()) return true // Allow empty
        const ipPattern = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/
        return ipPattern.test(val.trim())
      },
      'Invalid IP address format (use x.x.x.x or x.x.x.x/mask)'
    ),
  namespace: z.string().optional(),
  is_primary_ipv4: z.boolean().optional(),
  enabled: z.boolean().optional(),
  mgmt_only: z.boolean().optional(),
  description: z.string().optional(),
  mac_address: z.string().optional(),
  mtu: z.number().optional(),
  mode: z.string().optional(),
  untagged_vlan: z.string().optional(),
  tagged_vlans: z.array(z.string()).optional(),
  parent_interface: z.string().optional(),
  bridge: z.string().optional(),
  lag: z.string().optional(),
  tags: z.array(z.string()).optional(),
}).refine(
  (data) => {
    // Namespace required when IP address is provided
    if (data.ip_address && data.ip_address.trim() && !data.namespace) {
      return false
    }
    return true
  },
  {
    message: 'Namespace is required when IP address is provided',
    path: ['namespace'],
  }
)

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
