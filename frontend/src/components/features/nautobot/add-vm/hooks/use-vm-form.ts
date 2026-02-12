import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ipAddressSchema } from '@/components/shared/device-form/validation'

// VM-specific interface schema (simplified for virtual interfaces)
const vmInterfaceSchema = z.object({
  id: z.string(),
  name: z.string().optional(), // Interface name
  status: z.string().optional(), // Interface status
  ip_addresses: z.array(ipAddressSchema).optional().default([]), // Optional IP addresses
  enabled: z.boolean().optional(),
  mgmt_only: z.boolean().optional(),
  description: z.string().optional(),
  mac_address: z.string().optional(),
  mtu: z
    .any()
    .transform((val): number | undefined => {
      if (val === '' || val === null || val === undefined) return undefined
      if (typeof val === 'number' && !Number.isNaN(val)) return val
      if (typeof val === 'string') {
        const trimmed = val.trim()
        if (trimmed === '') return undefined
        const num = Number(trimmed)
        return Number.isNaN(num) ? undefined : num
      }
      return undefined
    })
    .optional(),
  mode: z.string().optional(),
  untagged_vlan: z.string().optional(),
  tagged_vlans: z.array(z.string()).optional(),
  parent_interface: z.string().optional(),
  bridge: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export const vmFormSchema = z.object({
  name: z.string().min(1, 'VM name is required'),
  status: z.string().min(1, 'Status is required'),
  cluster: z.string().min(1, 'Cluster is required'),
  role: z.string().optional(),
  clusterGroup: z.string().optional(),
  platform: z.string().optional(),
  softwareVersion: z.string().optional(),
  softwareImageFile: z.string().optional(),
  vcpus: z.union([z.coerce.number().int().positive(), z.literal('')]).optional(),
  memory: z.union([z.coerce.number().int().positive(), z.literal('')]).optional(),
  disk: z.union([z.coerce.number().int().positive(), z.literal('')]).optional(),
  tags: z.array(z.string()).optional(),
  customFieldValues: z.record(z.string(), z.string()).optional(),
  interfaces: z.array(vmInterfaceSchema).optional().default([]), // Optional, defaults to empty array
})

export type VMFormValues = z.infer<typeof vmFormSchema>
export type VMFormReturn = ReturnType<typeof useVMForm>
export type VMInterfaceSchema = z.infer<typeof vmInterfaceSchema>

// Re-export IP address schema for convenience
export { ipAddressSchema }

export function useVMForm() {
  const form = useForm<VMFormValues, unknown, VMFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(vmFormSchema) as any,
    defaultValues: {
      name: '',
      status: '',
      cluster: '',
      role: '',
      clusterGroup: '',
      platform: '',
      softwareVersion: '',
      softwareImageFile: '',
      vcpus: '',
      memory: '',
      disk: '',
      tags: [],
      customFieldValues: {},
      interfaces: [],
    },
  })

  return form
}
