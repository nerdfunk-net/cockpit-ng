// Git Repository Management Constants

import type { GitFormData, GitCredential } from './types'

// Empty arrays (prevent re-render loops)
export const EMPTY_CREDENTIALS: GitCredential[] = []
export const EMPTY_STRING_ARRAY: string[] = []
export const EMPTY_BRANCHES: string[] = []

// Default form values
export const DEFAULT_FORM_DATA: GitFormData = {
  name: '',
  category: '',
  url: '',
  branch: 'main',
  auth_type: 'none',
  credential_name: '__none__',
  path: '',
  verify_ssl: true,
  git_author_name: '',
  git_author_email: '',
  description: '',
} as const

// Repository categories
export const REPOSITORY_CATEGORIES = [
  { value: 'device_configs', label: 'Device Configs' },
  { value: 'cockpit_configs', label: 'Cockpit Configs' },
  { value: 'templates', label: 'Templates' },
  { value: 'ansible', label: 'Ansible' },
] as const

// Authentication types
export const AUTH_TYPES = [
  { value: 'none', label: 'None (Public Repository)' },
  { value: 'token', label: 'Token' },
  { value: 'ssh_key', label: 'SSH Key' },
  { value: 'generic', label: 'Generic (Username/Password)' },
] as const

// TanStack Query stale times
export const QUERY_STALE_TIMES = {
  CREDENTIALS: 5 * 60 * 1000,  // 5 minutes
} as const
