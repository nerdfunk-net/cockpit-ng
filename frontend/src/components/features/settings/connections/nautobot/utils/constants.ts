import type { NautobotSettings } from '../types'

// React best practice: Extract default objects to prevent re-render loops
export const DEFAULT_NAUTOBOT_SETTINGS: NautobotSettings = {
  url: '',
  token: '',
  timeout: 30,
  verify_ssl: true,
} as const

export const EMPTY_ARRAY: never[] = []

export const CACHE_TIME = {
  SETTINGS: 5 * 60 * 1000, // 5 minutes
  OPTIONS: 10 * 60 * 1000, // 10 minutes (dropdown options rarely change)
  CUSTOM_FIELDS: 10 * 60 * 1000, // 10 minutes
} as const

export const MESSAGE_TIMEOUT = 5000 as const
