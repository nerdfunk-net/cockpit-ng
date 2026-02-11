import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

export const vmFormSchema = z.object({
  name: z.string().min(1, 'VM name is required'),
  status: z.string().min(1, 'Status is required'),
  cluster: z.string().min(1, 'Cluster is required'),
  role: z.string().optional(),
  clusterGroup: z.string().optional(),
  interfaceName: z.string().optional(),
  primaryIpv4: z.string().optional(),
  namespace: z.string().optional(),
  platform: z.string().optional(),
  softwareVersion: z.string().optional(),
  softwareImageFile: z.string().optional(),
  vcpus: z.union([z.coerce.number().int().positive(), z.literal('')]).optional(),
  memory: z.union([z.coerce.number().int().positive(), z.literal('')]).optional(),
  disk: z.union([z.coerce.number().int().positive(), z.literal('')]).optional(),
  tags: z.array(z.string()).optional(),
})

export type VMFormValues = z.infer<typeof vmFormSchema>
export type VMFormReturn = ReturnType<typeof useVMForm>

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
      interfaceName: '',
      primaryIpv4: '',
      namespace: '',
      platform: '',
      softwareVersion: '',
      softwareImageFile: '',
      vcpus: '',
      memory: '',
      disk: '',
      tags: [],
    },
  })

  return form
}
