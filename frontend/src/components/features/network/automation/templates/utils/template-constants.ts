import type { Template, SSHCredential } from '../types/templates'

export const DEFAULT_FILE_PATH = 'templates/{device_name}-{template_name}.txt'

export const STALE_TIME = {
  TEMPLATES: 30 * 1000,
  CREDENTIALS: 2 * 60 * 1000,
  DEVICE_SEARCH: 10 * 1000,
} as const

export const DEVICE_SEARCH_MIN_CHARS = 3

export const EMPTY_TEMPLATES: Template[] = []
export const EMPTY_CREDENTIALS: SSHCredential[] = []
