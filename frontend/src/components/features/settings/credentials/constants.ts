import type { Credential } from './types'

// React best practice: Extract default objects to prevent re-render loops
export const CREDENTIAL_TYPES = [
  { value: 'ssh', label: 'SSH' },
  { value: 'ssh_key', label: 'SSH Key' },
  { value: 'tacacs', label: 'TACACS' },
  { value: 'generic', label: 'Generic' },
  { value: 'token', label: 'Token' }
] as const

export const EMPTY_CREDENTIALS: Credential[] = []

export const STALE_TIME = {
  CREDENTIALS: 30 * 1000, // 30 seconds - credentials change moderately
} as const
