import { z } from 'zod'

const nonNegativeInt = z.number().int().min(0)

const distributionRowSchema = z.object({
  location: z.string().min(1),
  network: nonNegativeInt,
  server: nonNegativeInt,
  vm: nonNegativeInt,
})

export const testsBaselineFormSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Name is required')
      .max(128)
      .transform(val =>
        val
          .trim()
          .split('')
          .filter(c => /[a-zA-Z0-9_-]/.test(c))
          .join('')
      )
      .refine(val => val.length > 0, 'Name must contain at least one valid character'),
    prefixes: z.string().min(1, 'At least one prefix is required'),
    network_device_role: z.string().min(1),
    server_role: z.string().min(1),
    vm_role: z.string().min(1),
    tags: z.string().min(1),
    custom_fields: z.string(),
    location_hierarchy: z.string().min(1),
    number_of_locations: z.number().int().min(1),
    number_of_network_devices: nonNegativeInt,
    number_of_servers: nonNegativeInt,
    number_of_virtual_machines: nonNegativeInt,
    number_of_clusters: nonNegativeInt,
    distribution_mode: z.enum(['even', 'random', 'manual']),
    distribution_seed: z.number().int(),
    manual_distribution: z.array(distributionRowSchema),
  })
  .superRefine((data, ctx) => {
    if (
      data.number_of_virtual_machines > 0 &&
      data.number_of_clusters < 1
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one cluster is required when creating VMs',
        path: ['number_of_clusters'],
      })
    }

    if (data.distribution_mode === 'manual') {
      const totalNetwork = data.manual_distribution.reduce(
        (sum, row) => sum + row.network,
        0
      )
      const totalServer = data.manual_distribution.reduce(
        (sum, row) => sum + row.server,
        0
      )
      const totalVm = data.manual_distribution.reduce(
        (sum, row) => sum + row.vm,
        0
      )
      if (totalNetwork !== data.number_of_network_devices) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Network devices must sum to ${data.number_of_network_devices} (got ${totalNetwork})`,
          path: ['manual_distribution'],
        })
      }
      if (totalServer !== data.number_of_servers) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Servers must sum to ${data.number_of_servers} (got ${totalServer})`,
          path: ['manual_distribution'],
        })
      }
      if (totalVm !== data.number_of_virtual_machines) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `VMs must sum to ${data.number_of_virtual_machines} (got ${totalVm})`,
          path: ['manual_distribution'],
        })
      }
    }
  })

export type TestsBaselineFormValues = z.infer<typeof testsBaselineFormSchema>
