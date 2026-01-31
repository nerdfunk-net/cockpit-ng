import { z } from 'zod'

export const credentialFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(128),
  username: z.string().min(1, 'Username is required').max(128),
  type: z.enum(['ssh', 'ssh_key', 'tacacs', 'generic', 'token']),
  password: z.string().optional(),
  ssh_private_key: z.string().optional(),
  ssh_passphrase: z.string().optional(),
  valid_until: z.string().optional(),
}).refine(
  (data) => {
    // For SSH key type, require SSH private key
    if (data.type === 'ssh_key') {
      return !!data.ssh_private_key?.trim()
    }
    // For other types, require password
    return !!data.password?.trim()
  },
  {
    message: 'SSH private key required for SSH Key type, password required for other types',
    path: ['password'],
  }
)

export type CredentialFormValues = z.infer<typeof credentialFormSchema>

// For edit mode - all fields optional except name/username
export const credentialEditSchema = z.object({
  name: z.string().min(1, 'Name is required').max(128),
  username: z.string().min(1, 'Username is required').max(128),
  type: z.enum(['ssh', 'ssh_key', 'tacacs', 'generic', 'token']),
  password: z.string().optional(),
  ssh_private_key: z.string().optional(),
  ssh_passphrase: z.string().optional(),
  valid_until: z.string().optional(),
})

export type CredentialEditValues = z.infer<typeof credentialEditSchema>
