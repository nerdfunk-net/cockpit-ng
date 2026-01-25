import type { CheckMKSettings } from '../types'

// React best practice: Extract default objects to prevent re-render loops
export const DEFAULT_CHECKMK_SETTINGS: CheckMKSettings = {
  url: '',
  site: '',
  username: '',
  password: '',
  verify_ssl: true,
} as const

export const EMPTY_STRING = ''

export const YAML_FILES = {
  CHECKMK: 'checkmk.yaml',
  QUERIES: 'checkmk_queries.yaml',
} as const

export const CACHE_TIME = {
  SETTINGS: 5 * 60 * 1000, // 5 minutes
  YAML: 2 * 60 * 1000, // 2 minutes
} as const

export const MESSAGE_TIMEOUT = 5000 as const

export const TAB_VALUES = {
  CONNECTION: 'connection',
  CHECKMK_CONFIG: 'checkmk-config',
  QUERIES: 'queries',
} as const
