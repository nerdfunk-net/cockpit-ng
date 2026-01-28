import type { NautobotSettings, NautobotDefaults, DeviceOffboardingSettings } from '../types'

// React best practice: Extract default objects to prevent re-render loops
export const DEFAULT_NAUTOBOT_SETTINGS: NautobotSettings = {
  url: '',
  token: '',
  timeout: 30,
  verify_ssl: true,
} as const

export const DEFAULT_NAUTOBOT_DEFAULTS: NautobotDefaults = {
  location: '',
  platform: '',
  interface_status: '',
  device_status: '',
  ip_address_status: '',
  ip_prefix_status: '',
  namespace: '',
  device_role: '',
  secret_group: '',
  csv_delimiter: ',',
  csv_quote_char: '"',
} as const

export const DEFAULT_OFFBOARDING_SETTINGS: DeviceOffboardingSettings = {
  remove_all_custom_fields: false,
  clear_device_name: false,
  keep_serial: false,
  location_id: '',
  status_id: '',
  role_id: '',
  custom_field_settings: {},
} as const

export const EMPTY_ARRAY: never[] = []

export const CACHE_TIME = {
  SETTINGS: 5 * 60 * 1000,  // 5 minutes
  DEFAULTS: 5 * 60 * 1000,  // 5 minutes
  OPTIONS: 10 * 60 * 1000,  // 10 minutes (dropdown options rarely change)
  OFFBOARDING: 5 * 60 * 1000,  // 5 minutes
  CUSTOM_FIELDS: 10 * 60 * 1000,  // 10 minutes
} as const

export const MESSAGE_TIMEOUT = 5000 as const

export const TAB_VALUES = {
  CONNECTION: 'connection',
  DEFAULTS: 'defaults',
  OFFBOARDING: 'offboarding',
} as const
