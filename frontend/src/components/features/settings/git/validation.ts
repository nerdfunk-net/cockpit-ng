// Git Repository Form Validation Schemas

import { z } from 'zod'

// Repository form schema
export const repositoryFormSchema = z.object({
  name: z.string().min(1, 'Repository name is required'),
  category: z.enum(['device_configs', 'cockpit_configs', 'templates', 'agent']),
  url: z.string().url('Invalid repository URL'),
  branch: z.string().min(1, 'Branch name is required'),
  auth_type: z.enum(['none', 'token', 'ssh_key', 'generic']),
  credential_name: z.string(),
  path: z.string(),
  verify_ssl: z.boolean(),
  git_author_name: z.string(),
  git_author_email: z.string().refine(
    (val) => val === '' || z.string().email().safeParse(val).success,
    { message: 'Invalid email format' }
  ),
  description: z.string(),
})

// Connection test schema
export const connectionTestSchema = z.object({
  url: z.string().url('Invalid repository URL'),
  branch: z.string().min(1, 'Branch name is required'),
  auth_type: z.enum(['none', 'token', 'ssh_key', 'generic']),
  credential_name: z.string().nullable(),
  verify_ssl: z.boolean(),
})

// Infer TypeScript types from schemas
export type RepositoryFormValues = z.infer<typeof repositoryFormSchema>
export type ConnectionTestValues = z.infer<typeof connectionTestSchema>
