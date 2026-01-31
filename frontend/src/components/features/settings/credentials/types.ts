export interface Credential {
  id: number
  name: string
  username: string
  type: string
  valid_until?: string
  status: 'active' | 'expiring' | 'expired'
  created_at?: string
  updated_at?: string
  has_ssh_key?: boolean
  has_ssh_passphrase?: boolean
}

export interface CredentialFormData {
  name: string
  username: string
  type: string
  password: string
  ssh_private_key: string
  ssh_passphrase: string
  valid_until?: string
}

export interface CredentialCreatePayload {
  name: string
  username: string
  type: string
  valid_until: string | null
  password?: string
  ssh_private_key?: string
  ssh_passphrase?: string
}

export interface CredentialUpdatePayload extends CredentialCreatePayload {
  id: number
}
