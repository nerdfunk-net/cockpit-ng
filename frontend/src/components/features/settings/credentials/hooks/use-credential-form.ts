import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  credentialFormSchema,
  credentialEditSchema,
  type CredentialFormValues,
  type CredentialEditValues
} from '../validation'
import type { Credential } from '../types'

interface UseCredentialFormOptions {
  credential?: Credential  // For edit mode
}

const DEFAULT_OPTIONS: UseCredentialFormOptions = {}

export function useCredentialForm(
  options: UseCredentialFormOptions = DEFAULT_OPTIONS
) {
  const { credential } = options
  const isEditing = !!credential

  const defaultValues: CredentialFormValues = {
    name: credential?.name || '',
    username: credential?.username || '',
    type: (credential?.type as 'ssh' | 'ssh_key' | 'tacacs' | 'generic' | 'token') || 'ssh',
    password: '',
    ssh_private_key: '',
    ssh_passphrase: '',
    valid_until: credential?.valid_until || '',
  }

  return useForm<CredentialFormValues | CredentialEditValues>({
    resolver: zodResolver(
      isEditing ? credentialEditSchema : credentialFormSchema
    ),
    defaultValues,
    mode: 'onChange',
  })
}
